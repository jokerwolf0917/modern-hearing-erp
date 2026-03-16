import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, Base, engine
from app.models import Product, Store, StoreType


async def _print_existing_data(session: AsyncSession) -> None:
    stores = (await session.execute(select(Store).order_by(Store.name))).scalars().all()
    products = (await session.execute(select(Product).order_by(Product.sku))).scalars().all()

    print("Stores:")
    for store in stores:
        print(f"- {store.name}: {store.id} ({store.store_type.value})")

    print("Products:")
    for product in products:
        print(f"- {product.sku} | {product.name}: {product.id}")


async def seed_data() -> None:
    # Ensure tables exist before seeding.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        existing_stores = (await session.execute(select(Store.id).limit(1))).first()
        existing_products = (await session.execute(select(Product.id).limit(1))).first()

        # Reuse existing records instead of inserting duplicates.
        if existing_stores or existing_products:
            print("Seed data already exists. Reusing current records.")
            await _print_existing_data(session)
            return

        stores = [
            Store(name="\u897f\u5609\u89e3\u653e\u8def\u5e97", store_type=StoreType.STREET),
            Store(name="\u4eba\u6c11\u533b\u9662\u5e97", store_type=StoreType.HOSPITAL),
        ]

        products = [
            Product(
                name="Signia Insio 1IX ITC",
                sku="SIG-ITC-001",
                category="hearing_aid",
                retail_price=Decimal("7990.00"),
            ),
            Product(
                name="Signia Pure 312 X BTE",
                sku="SIG-BTE-002",
                category="hearing_aid",
                retail_price=Decimal("6500.00"),
            ),
            Product(
                name="\u4e13\u7528\u52a9\u542c\u5668\u7535\u6c60 6\u7c92\u88c5",
                sku="ACC-BAT-001",
                category="accessory",
                retail_price=Decimal("35.00"),
            ),
        ]

        session.add_all(stores + products)
        await session.commit()

        print("Seed data inserted successfully.")
        await _print_existing_data(session)


if __name__ == "__main__":
    asyncio.run(seed_data())
