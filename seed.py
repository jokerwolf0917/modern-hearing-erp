import argparse
import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, Base, engine
from app.models import (
    Appointment,
    Audiogram,
    Customer,
    Employee,
    EmployeeRole,
    Inventory,
    InventoryLedger,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductSerial,
    ProductSerialStatus,
    Store,
    StoreType,
    Transfer,
    User,
)


def days_ago(days: int, hour: int, minute: int = 0) -> datetime:
    now = datetime.now(timezone.utc)
    target = now - timedelta(days=days)
    return target.replace(hour=hour, minute=minute, second=0, microsecond=0)


async def get_store(session: AsyncSession, name: str) -> Store | None:
    return await session.scalar(select(Store).where(Store.name == name))


async def get_customer(session: AsyncSession, name: str, phone: str) -> Customer | None:
    return await session.scalar(
        select(Customer).where(Customer.name == name, Customer.phone == phone),
    )


async def get_product(session: AsyncSession, sku: str) -> Product | None:
    return await session.scalar(select(Product).where(Product.sku == sku))


async def get_inventory(session: AsyncSession, store_id, product_id) -> Inventory | None:
    return await session.scalar(
        select(Inventory).where(
            Inventory.store_id == store_id,
            Inventory.product_id == product_id,
        ),
    )


async def get_serial(session: AsyncSession, sn_code: str) -> ProductSerial | None:
    return await session.scalar(select(ProductSerial).where(ProductSerial.sn_code == sn_code))


async def ledger_exists(
    session: AsyncSession,
    *,
    store_id,
    product_id,
    change_amount: int,
    reference_type: str,
    created_at: datetime,
) -> bool:
    existing = await session.scalar(
        select(InventoryLedger.id).where(
            InventoryLedger.store_id == store_id,
            InventoryLedger.product_id == product_id,
            InventoryLedger.change_amount == change_amount,
            InventoryLedger.reference_type == reference_type,
            InventoryLedger.created_at == created_at,
        )
    )
    return existing is not None


async def get_demo_order(
    session: AsyncSession,
    *,
    customer_id,
    store_id,
    product_id,
    quantity: int,
    total_amount: Decimal,
) -> Order | None:
    return await session.scalar(
        select(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(
            Order.customer_id == customer_id,
            Order.store_id == store_id,
            Order.total_amount == total_amount,
            OrderItem.product_id == product_id,
            OrderItem.quantity == quantity,
        )
        .limit(1),
    )


def make_ledger(
    *,
    store_id,
    product_id,
    change_amount: int,
    reference_type: str,
    created_at: datetime,
) -> InventoryLedger:
    ledger = InventoryLedger(
        store_id=store_id,
        product_id=product_id,
        change_amount=change_amount,
        reference_type=reference_type,
    )
    ledger.created_at = created_at
    return ledger


async def ensure_ledger(
    session: AsyncSession,
    *,
    store_id,
    product_id,
    change_amount: int,
    reference_type: str,
    created_at: datetime,
) -> None:
    if await ledger_exists(
        session,
        store_id=store_id,
        product_id=product_id,
        change_amount=change_amount,
        reference_type=reference_type,
        created_at=created_at,
    ):
        return

    session.add(
        make_ledger(
            store_id=store_id,
            product_id=product_id,
            change_amount=change_amount,
            reference_type=reference_type,
            created_at=created_at,
        )
    )


async def ensure_store(
    session: AsyncSession,
    *,
    name: str,
    address: str,
    phone: str,
    store_type: StoreType,
) -> Store:
    store = await get_store(session, name)
    if store:
        return store

    store = Store(
        name=name,
        address=address,
        phone=phone,
        store_type=store_type,
    )
    session.add(store)
    await session.flush()
    return store


async def ensure_customer(
    session: AsyncSession,
    *,
    name: str,
    phone: str,
    gender: str,
    age: int,
    hearing_loss_type: str,
    primary_store_id,
) -> Customer:
    customer = await get_customer(session, name, phone)
    if customer:
        return customer

    customer = Customer(
        name=name,
        phone=phone,
        gender=gender,
        age=age,
        hearing_loss_type=hearing_loss_type,
        primary_store_id=primary_store_id,
    )
    session.add(customer)
    await session.flush()
    return customer


async def ensure_product(
    session: AsyncSession,
    *,
    name: str,
    sku: str,
    category: str,
    cost_price: Decimal,
    retail_price: Decimal,
    brand: str,
    manufacturer: str,
    registration_no: str,
    has_sn_tracking: bool,
) -> Product:
    product = await get_product(session, sku)
    if product:
        return product

    product = Product(
        name=name,
        sku=sku,
        category=category,
        cost_price=cost_price,
        retail_price=retail_price,
        brand=brand,
        manufacturer=manufacturer,
        registration_no=registration_no,
        has_sn_tracking=has_sn_tracking,
    )
    session.add(product)
    await session.flush()
    return product


async def ensure_inventory(
    session: AsyncSession,
    *,
    store_id,
    product_id,
    quantity: int,
    last_updated: datetime,
) -> Inventory:
    inventory = await get_inventory(session, store_id, product_id)
    if inventory:
        if inventory.quantity < quantity:
            inventory.quantity = quantity
        inventory.last_updated = max(inventory.last_updated, last_updated)
        return inventory

    inventory = Inventory(
        store_id=store_id,
        product_id=product_id,
        quantity=quantity,
        last_updated=last_updated,
    )
    session.add(inventory)
    await session.flush()
    return inventory


async def ensure_serial(
    session: AsyncSession,
    *,
    store_id,
    product_id,
    sn_code: str,
    status: ProductSerialStatus,
    created_at: datetime,
    order_item_id=None,
    warranty_ends_at=None,
) -> ProductSerial:
    serial = await get_serial(session, sn_code)
    if serial:
        return serial

    serial = ProductSerial(
        store_id=store_id,
        product_id=product_id,
        sn_code=sn_code,
        status=status,
        order_item_id=order_item_id,
        warranty_ends_at=warranty_ends_at,
    )
    serial.created_at = created_at
    session.add(serial)
    await session.flush()
    return serial


async def ensure_demo_order(
    session: AsyncSession,
    *,
    customer: Customer,
    store: Store,
    product: Product,
    quantity: int,
    unit_price: Decimal,
    created_at: datetime,
    serial_codes: list[str] | None = None,
    serial_warranty_ends_at: datetime | None = None,
) -> Order:
    total_amount = unit_price * quantity
    existing_order = await get_demo_order(
        session,
        customer_id=customer.id,
        store_id=store.id,
        product_id=product.id,
        quantity=quantity,
        total_amount=total_amount,
    )
    if existing_order:
        return existing_order

    order = Order(
        customer_id=customer.id,
        store_id=store.id,
        total_amount=total_amount,
        status=OrderStatus.PAID,
    )
    order.created_at = created_at
    session.add(order)
    await session.flush()

    order_item = OrderItem(
        order_id=order.id,
        product_id=product.id,
        quantity=quantity,
        unit_price=unit_price,
    )
    session.add(order_item)
    await session.flush()

    if serial_codes:
        for sn_code in serial_codes:
            await ensure_serial(
                session,
                store_id=store.id,
                product_id=product.id,
                sn_code=sn_code,
                status=ProductSerialStatus.SOLD,
                created_at=created_at - timedelta(hours=4),
                order_item_id=order_item.id,
                warranty_ends_at=serial_warranty_ends_at,
            )

    await ensure_ledger(
        session,
        store_id=store.id,
        product_id=product.id,
        change_amount=-quantity,
        reference_type="sales_out",
        created_at=created_at,
    )
    return order


async def seed_data() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    stock_in_signia_time = days_ago(3, 9, 15)
    order_one_time = days_ago(2, 11, 10)
    stock_in_phonak_time = days_ago(3, 10, 0)
    order_two_time = days_ago(1, 14, 20)
    stock_in_battery_sydney_time = days_ago(3, 8, 45)
    stock_in_battery_melbourne_time = days_ago(2, 9, 30)
    order_three_time = days_ago(0, 16, 5)

    async with AsyncSessionLocal() as session:
        async with session.begin():
            sydney_store = await ensure_store(
                session,
                name="Sydney Flagship Store",
                address="123 George Street, Sydney NSW",
                phone="02 9000 1000",
                store_type=StoreType.STREET,
            )
            melbourne_store = await ensure_store(
                session,
                name="Melbourne Branch",
                address="88 Collins Street, Melbourne VIC",
                phone="03 9000 2000",
                store_type=StoreType.STREET,
            )

            john_doe = await ensure_customer(
                session,
                name="John Doe",
                phone="0412345678",
                gender="Male",
                age=62,
                hearing_loss_type="Moderate",
                primary_store_id=sydney_store.id,
            )
            alice_smith = await ensure_customer(
                session,
                name="Alice Smith",
                phone="0487654321",
                gender="Female",
                age=54,
                hearing_loss_type="Mild",
                primary_store_id=melbourne_store.id,
            )

            signia_pure = await ensure_product(
                session,
                name="Signia Pure 312 X",
                sku="SIG-312-X",
                category="Hearing Aid",
                cost_price=Decimal("4200.00"),
                retail_price=Decimal("6500.00"),
                brand="Signia",
                manufacturer="WS Audiology",
                registration_no="ARTG-SIG-312X",
                has_sn_tracking=True,
            )
            phonak_lumity = await ensure_product(
                session,
                name="Phonak Audéo Lumity",
                sku="PHO-LUM-01",
                category="Hearing Aid",
                cost_price=Decimal("4700.00"),
                retail_price=Decimal("7200.00"),
                brand="Phonak",
                manufacturer="Sonova",
                registration_no="ARTG-PHO-LUM01",
                has_sn_tracking=True,
            )
            battery_pack = await ensure_product(
                session,
                name="Standard Battery 6-pack",
                sku="BAT-006",
                category="Accessory",
                cost_price=Decimal("6.00"),
                retail_price=Decimal("15.00"),
                brand="Generic",
                manufacturer="Hearing Supply Co.",
                registration_no="ACC-BAT-006",
                has_sn_tracking=False,
            )

            await ensure_inventory(
                session,
                store_id=sydney_store.id,
                product_id=signia_pure.id,
                quantity=2,
                last_updated=stock_in_signia_time,
            )
            await ensure_inventory(
                session,
                store_id=sydney_store.id,
                product_id=battery_pack.id,
                quantity=50,
                last_updated=stock_in_battery_sydney_time,
            )
            await ensure_inventory(
                session,
                store_id=melbourne_store.id,
                product_id=phonak_lumity.id,
                quantity=1,
                last_updated=stock_in_phonak_time,
            )
            await ensure_inventory(
                session,
                store_id=melbourne_store.id,
                product_id=battery_pack.id,
                quantity=18,
                last_updated=stock_in_battery_melbourne_time,
            )

            for sn_code in ["SN-SIG-0001", "SN-SIG-0002"]:
                await ensure_serial(
                    session,
                    store_id=sydney_store.id,
                    product_id=signia_pure.id,
                    sn_code=sn_code,
                    status=ProductSerialStatus.IN_STOCK,
                    created_at=stock_in_signia_time,
                )

            await ensure_serial(
                session,
                store_id=melbourne_store.id,
                product_id=phonak_lumity.id,
                sn_code="SN-PHO-0002",
                status=ProductSerialStatus.IN_STOCK,
                created_at=stock_in_phonak_time,
            )

            await ensure_ledger(
                session,
                store_id=sydney_store.id,
                product_id=signia_pure.id,
                change_amount=3,
                reference_type="manual_in",
                created_at=stock_in_signia_time,
            )
            await ensure_ledger(
                session,
                store_id=melbourne_store.id,
                product_id=phonak_lumity.id,
                change_amount=2,
                reference_type="manual_in",
                created_at=stock_in_phonak_time,
            )
            await ensure_ledger(
                session,
                store_id=sydney_store.id,
                product_id=battery_pack.id,
                change_amount=50,
                reference_type="manual_in",
                created_at=stock_in_battery_sydney_time,
            )
            await ensure_ledger(
                session,
                store_id=melbourne_store.id,
                product_id=battery_pack.id,
                change_amount=20,
                reference_type="manual_in",
                created_at=stock_in_battery_melbourne_time,
            )

            await ensure_demo_order(
                session,
                customer=john_doe,
                store=sydney_store,
                product=signia_pure,
                quantity=1,
                unit_price=signia_pure.retail_price,
                created_at=order_one_time,
                serial_codes=["SN-SIG-0003"],
                serial_warranty_ends_at=order_one_time + timedelta(days=365 * 2),
            )
            await ensure_demo_order(
                session,
                customer=alice_smith,
                store=melbourne_store,
                product=phonak_lumity,
                quantity=1,
                unit_price=phonak_lumity.retail_price,
                created_at=order_two_time,
                serial_codes=["SN-PHO-0001"],
                serial_warranty_ends_at=order_two_time + timedelta(days=365 * 2),
            )
            await ensure_demo_order(
                session,
                customer=john_doe,
                store=melbourne_store,
                product=battery_pack,
                quantity=2,
                unit_price=battery_pack.retail_price,
                created_at=order_three_time,
            )

        print("Seed completed successfully.")
        print(f"Stores ready: {sydney_store.name}, {melbourne_store.name}")
        print(f"Customers ready: {john_doe.name}, {alice_smith.name}")
        print(
            "Products ready: "
            f"{signia_pure.sku}, {phonak_lumity.sku}, {battery_pack.sku}"
        )
        print("Recent demo orders have been inserted for dashboard analytics.")


async def reset_business_data() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(delete(Appointment))
            await session.execute(delete(Audiogram))
            await session.execute(delete(ProductSerial))
            await session.execute(delete(Transfer))
            await session.execute(delete(InventoryLedger))
            await session.execute(delete(OrderItem))
            await session.execute(delete(Order))
            await session.execute(delete(Inventory))
            await session.execute(delete(Customer))
            await session.execute(delete(Product))
            await session.execute(delete(User))
            await session.execute(update(Employee).values(store_id=None))
            await session.execute(delete(Employee).where(Employee.role != EmployeeRole.ADMIN))
            await session.execute(delete(Store))

    print("Existing business data cleared. Admin accounts were preserved.")


async def main(reset: bool) -> None:
    try:
        if reset:
            await reset_business_data()
        await seed_data()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the ERP database with English demo data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing business data before seeding the demo dataset.",
    )
    args = parser.parse_args()
    asyncio.run(main(reset=args.reset))
