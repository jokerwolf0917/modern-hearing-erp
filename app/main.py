import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app import models  # noqa: F401
from app.database import AsyncSessionLocal, Base, engine
from app.routers.analytics import router as analytics_router
from app.routers.appointment import router as appointment_router
from app.routers.auth import ensure_default_admin
from app.routers.auth import router as auth_router
from app.routers.customers import router as customers_router
from app.routers.employee import router as employee_router
from app.routers.fittings import router as fittings_router
from app.routers.inventory import router as inventory_router
from app.routers.order import router as order_router
from app.routers.product import router as product_router
from app.routers.repairs import router as repairs_router
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

app.include_router(auth_router)
app.include_router(customers_router)
app.include_router(repairs_router)
app.include_router(fittings_router)
app.include_router(appointment_router)
app.include_router(inventory_router)
app.include_router(order_router)
app.include_router(analytics_router)
app.include_router(employee_router)
app.include_router(store_router)
app.include_router(product_router)


def _should_reset_schema(sync_conn) -> bool:
    inspector = inspect(sync_conn)
    table_names = set(inspector.get_table_names())
    expected_columns: dict[str, set[str]] = {
        "employees": {"id", "username", "hashed_password", "role", "store_id", "is_active", "created_at"},
        "stores": {"id", "name", "address", "phone", "store_type", "created_at"},
        "customers": {
            "id",
            "name",
            "phone",
            "age",
            "gender",
            "hearing_loss_type",
            "birth_date",
            "address",
            "primary_store_id",
            "created_at",
        },
        "products": {
            "id",
            "product_code",
            "category",
            "brand",
            "name_cn",
            "name_en",
            "specification",
            "matrix",
            "original_price",
            "cost_price",
            "manufacturer",
            "registration_no",
            "has_sn_tracking",
            "unit",
            "remark",
            "created_at",
        },
        "inventories": {"id", "store_id", "product_id", "quantity", "last_updated"},
        "inventory_ledger": {"id", "store_id", "product_id", "change_amount", "reference_type", "created_at"},
        "transfers": {"id", "from_store_id", "to_store_id", "product_id", "quantity", "status", "created_at"},
        "orders": {"id", "customer_id", "store_id", "total_amount", "status", "created_at"},
        "order_items": {"id", "order_id", "product_id", "quantity", "unit_price"},
        "appointments": {
            "id",
            "store_id",
            "customer_id",
            "employee_id",
            "appointment_time",
            "type",
            "status",
            "notes",
            "created_at",
        },
        "stock_transactions": {
            "id",
            "transaction_date",
            "store_id",
            "product_id",
            "customer_id",
            "type",
            "quantity",
            "unit_price",
            "handled_by",
            "target",
            "remark",
            "created_at",
        },
        "inventory_summaries": {
            "id",
            "store_id",
            "product_id",
            "last_month_stock",
            "in_this_month",
            "out_this_month",
            "sales_this_month",
            "expected_stock",
            "actual_stock",
            "month_year",
            "created_at",
        },
        "repair_records": {
            "id",
            "customer_id",
            "store_id",
            "machine_model",
            "receive_date",
            "due_date",
            "issue_description",
            "status",
            "handled_by",
            "created_at",
        },
        "fitting_records": {
            "id",
            "customer_id",
            "store_id",
            "product_id",
            "fitting_date",
            "device_name",
            "fitting_notes",
            "result_summary",
            "created_by",
            "created_at",
        },
    }
    legacy_tables = {"audiograms", "product_serials", "users"}

    if legacy_tables.intersection(table_names):
        return True

    for table_name, columns in expected_columns.items():
        if table_name not in table_names:
            return True
        existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
        if not columns.issubset(existing_columns):
            return True

    return False


def _drop_legacy_tables(sync_conn) -> None:
    for table_name in ("audiograms", "product_serials", "users"):
        sync_conn.execute(text(f'DROP TABLE IF EXISTS "{table_name}"'))


@app.on_event("startup")
async def on_startup() -> None:
    if os.getenv("APP_ENV", "development").lower() != "development":
        return

    async with engine.begin() as conn:
        reset_required = await conn.run_sync(_should_reset_schema)
        if reset_required:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(_drop_legacy_tables)
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        await ensure_default_admin(session)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "ERP Backend Running"}
