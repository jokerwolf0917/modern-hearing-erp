import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app import models  # noqa: F401
from app.routers.auth import ensure_default_admin
from app.routers.auth import router as auth_router
from app.database import Base, engine
from app.routers.ai_parser import router as ai_parser_router
from app.routers.analytics import router as analytics_router
from app.routers.appointment import router as appointment_router
from app.routers.audiogram import router as audiogram_router
from app.routers.customer import router as customer_router
from app.routers.employee import router as employee_router
from app.routers.inventory import router as inventory_router
from app.routers.order import router as order_router
from app.routers.product import router as product_router
from app.routers.store import router as store_router


cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
).split(",")

app = FastAPI(title="Hearing Aid ERP Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(inventory_router)
app.include_router(auth_router)
app.include_router(ai_parser_router)
app.include_router(analytics_router)
app.include_router(appointment_router)
app.include_router(customer_router)
app.include_router(employee_router)
app.include_router(audiogram_router)
app.include_router(order_router)
app.include_router(store_router)
app.include_router(product_router)


def _migrate_customer_table(sync_conn) -> None:
    inspector = inspect(sync_conn)
    if 'customers' not in inspector.get_table_names():
        return

    columns = {column['name'] for column in inspector.get_columns('customers')}
    statements: list[str] = []

    if 'age' not in columns:
        statements.append('ALTER TABLE customers ADD COLUMN age INTEGER')
    if 'gender' not in columns:
        statements.append('ALTER TABLE customers ADD COLUMN gender VARCHAR(20)')
    if 'hearing_loss_type' not in columns:
        statements.append('ALTER TABLE customers ADD COLUMN hearing_loss_type VARCHAR(30)')

    for statement in statements:
        sync_conn.execute(text(statement))


def _migrate_store_table(sync_conn) -> None:
    inspector = inspect(sync_conn)
    if "stores" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("stores")}
    statements: list[str] = []

    if "address" not in columns:
        statements.append("ALTER TABLE stores ADD COLUMN address VARCHAR(255)")
    if "phone" not in columns:
        statements.append("ALTER TABLE stores ADD COLUMN phone VARCHAR(30)")

    for statement in statements:
        sync_conn.execute(text(statement))


def _migrate_product_table(sync_conn) -> None:
    inspector = inspect(sync_conn)
    if "products" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("products")}
    statements: list[str] = []

    if "cost_price" not in columns:
        statements.append("ALTER TABLE products ADD COLUMN cost_price NUMERIC(10, 2) DEFAULT 0 NOT NULL")
    if "brand" not in columns:
        statements.append("ALTER TABLE products ADD COLUMN brand VARCHAR(80)")
    if "manufacturer" not in columns:
        statements.append("ALTER TABLE products ADD COLUMN manufacturer VARCHAR(120)")
    if "registration_no" not in columns:
        statements.append("ALTER TABLE products ADD COLUMN registration_no VARCHAR(120)")
    if "has_sn_tracking" not in columns:
        statements.append("ALTER TABLE products ADD COLUMN has_sn_tracking BOOLEAN DEFAULT 0 NOT NULL")

    for statement in statements:
        sync_conn.execute(text(statement))

    sync_conn.execute(
        text(
            "UPDATE products SET brand = COALESCE(NULLIF(brand, ''), 'UNKNOWN'), "
            "manufacturer = COALESCE(NULLIF(manufacturer, ''), 'UNKNOWN'), "
            "registration_no = COALESCE(NULLIF(registration_no, ''), 'PENDING-' || sku)"
        )
    )


@app.on_event("startup")
async def on_startup() -> None:
    """Create tables automatically in development mode."""
    if os.getenv("APP_ENV", "development").lower() != "development":
        return

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_migrate_customer_table)
        await conn.run_sync(_migrate_store_table)
        await conn.run_sync(_migrate_product_table)

    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        await ensure_default_admin(session)


@app.get("/")
async def root() -> str:
    return "ERP Backend Running"
