from __future__ import annotations

import asyncio
from collections.abc import Iterable
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import brand_display, category_display
from app.core.security import get_password_hash
from app.database import AsyncSessionLocal, Base, engine
from app.models import (
    Appointment,
    AppointmentStatus,
    BrandEnum,
    CategoryEnum,
    Customer,
    Employee,
    EmployeeRole,
    FittingRecord,
    Inventory,
    InventoryLedger,
    InventorySummary,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    RepairRecord,
    RepairStatus,
    StockTransaction,
    Store,
    StoreType,
    TransactionType,
)


BUSINESS_TZ = ZoneInfo("Australia/Sydney")
UTC = ZoneInfo("UTC")
MONTH_KEY = datetime.now(BUSINESS_TZ).strftime("%Y-%m")


STORE_SEED = [
    {
        "name": "Sydney Flagship Store",
        "address": "201 George Street, Sydney NSW",
        "phone": "0290101001",
        "store_type": StoreType.STREET,
    },
    {
        "name": "Melbourne Branch",
        "address": "188 Collins Street, Melbourne VIC",
        "phone": "0390202002",
        "store_type": StoreType.STREET,
    },
    {
        "name": "People's Hospital Hearing Center",
        "address": "55 Health Avenue, Parramatta NSW",
        "phone": "0288803003",
        "store_type": StoreType.HOSPITAL,
    },
    {
        "name": "West Lakes Experience Store",
        "address": "9 Lake Road, Adelaide SA",
        "phone": "0888104004",
        "store_type": StoreType.STREET,
    },
]


EMPLOYEE_SEED = [
    {"username": "admin", "role": EmployeeRole.ADMIN, "store_name": None},
    {"username": "sydney_manager", "role": EmployeeRole.STORE_MANAGER, "store_name": "Sydney Flagship Store"},
    {"username": "sydney_staff", "role": EmployeeRole.STAFF, "store_name": "Sydney Flagship Store"},
    {"username": "melbourne_manager", "role": EmployeeRole.STORE_MANAGER, "store_name": "Melbourne Branch"},
    {"username": "melbourne_staff", "role": EmployeeRole.STAFF, "store_name": "Melbourne Branch"},
    {"username": "hospital_manager", "role": EmployeeRole.STORE_MANAGER, "store_name": "People's Hospital Hearing Center"},
    {"username": "hospital_staff", "role": EmployeeRole.STAFF, "store_name": "People's Hospital Hearing Center"},
    {"username": "adl_staff", "role": EmployeeRole.STAFF, "store_name": "West Lakes Experience Store"},
]


PRODUCT_SEED = [
    {
        "product_code": "SIG-RIC-001",
        "brand": BrandEnum.SIGNIA,
        "category": CategoryEnum.RIC,
        "name_cn": "西嘉 Styletto AX",
        "name_en": "Signia Styletto AX",
        "specification": "Rechargeable / Pair",
        "matrix": "7AX",
        "original_price": Decimal("9800.00"),
        "cost_price": Decimal("5200.00"),
        "manufacturer": "WS Audiology",
        "registration_no": "AU-SIG-RIC-001",
        "unit": "套",
        "remark": "高端充电RIC",
    },
    {
        "product_code": "SIG-CIC-002",
        "brand": BrandEnum.SIGNIA,
        "category": CategoryEnum.CIC,
        "name_cn": "西嘉 Silk Charge&Go",
        "name_en": "Signia Silk Charge&Go",
        "specification": "CIC / Pair",
        "matrix": "5IX",
        "original_price": Decimal("7600.00"),
        "cost_price": Decimal("3900.00"),
        "manufacturer": "WS Audiology",
        "registration_no": "AU-SIG-CIC-002",
        "unit": "套",
        "remark": "即配型隐形机",
    },
    {
        "product_code": "PHO-BTE-003",
        "brand": BrandEnum.PHONAK,
        "category": CategoryEnum.BTE,
        "name_cn": "峰力 Naida Paradise",
        "name_en": "Phonak Naida Paradise",
        "specification": "BTE / Pair",
        "matrix": "P90",
        "original_price": Decimal("11200.00"),
        "cost_price": Decimal("6100.00"),
        "manufacturer": "Sonova",
        "registration_no": "AU-PHO-BTE-003",
        "unit": "套",
        "remark": "重度听损适配",
    },
    {
        "product_code": "PHO-ITE-004",
        "brand": BrandEnum.PHONAK,
        "category": CategoryEnum.ITE,
        "name_cn": "峰力 Virto Paradise",
        "name_en": "Phonak Virto Paradise",
        "specification": "ITE / Pair",
        "matrix": "P70",
        "original_price": Decimal("8700.00"),
        "cost_price": Decimal("4600.00"),
        "manufacturer": "Sonova",
        "registration_no": "AU-PHO-ITE-004",
        "unit": "套",
        "remark": "定制耳内机",
    },
    {
        "product_code": "PHI-RIC-005",
        "brand": BrandEnum.PHILIPS,
        "category": CategoryEnum.RIC,
        "name_cn": "飞利浦 HearLink",
        "name_en": "Philips HearLink",
        "specification": "RIC / Pair",
        "matrix": "9040",
        "original_price": Decimal("8200.00"),
        "cost_price": Decimal("4300.00"),
        "manufacturer": "Demant",
        "registration_no": "AU-PHI-RIC-005",
        "unit": "套",
        "remark": "门店热销款",
    },
    {
        "product_code": "SIE-ITC-006",
        "brand": BrandEnum.SIEMENS,
        "category": CategoryEnum.ITC,
        "name_cn": "西门子 Insio",
        "name_en": "Siemens Insio",
        "specification": "ITC / Pair",
        "matrix": "3BX",
        "original_price": Decimal("6800.00"),
        "cost_price": Decimal("3500.00"),
        "manufacturer": "WS Audiology",
        "registration_no": "AU-SIE-ITC-006",
        "unit": "套",
        "remark": "经典耳道机",
    },
    {
        "product_code": "SIG-IIC-007",
        "brand": BrandEnum.SIGNIA,
        "category": CategoryEnum.IIC,
        "name_cn": "西嘉 Insio IX IIC",
        "name_en": "Signia Insio IX IIC",
        "specification": "IIC / Pair",
        "matrix": "7IX",
        "original_price": Decimal("12600.00"),
        "cost_price": Decimal("6800.00"),
        "manufacturer": "WS Audiology",
        "registration_no": "AU-SIG-IIC-007",
        "unit": "套",
        "remark": "超隐形高端机",
    },
    {
        "product_code": "PHO-IIC-008",
        "brand": BrandEnum.PHONAK,
        "category": CategoryEnum.IIC_CIC,
        "name_cn": "峰力 Lyric",
        "name_en": "Phonak Lyric",
        "specification": "IIC/CIC / Pair",
        "matrix": "Lyric 4",
        "original_price": Decimal("9900.00"),
        "cost_price": Decimal("5400.00"),
        "manufacturer": "Sonova",
        "registration_no": "AU-PHO-IIC-008",
        "unit": "套",
        "remark": "深耳道类展示机",
    },
    {
        "product_code": "STD-SET-009",
        "brand": BrandEnum.PHILIPS,
        "category": CategoryEnum.STANDARD_MACHINE,
        "name_cn": "飞利浦标准成品机",
        "name_en": "Philips Standard Unit",
        "specification": "Standard / Pair",
        "matrix": "Entry",
        "original_price": Decimal("5200.00"),
        "cost_price": Decimal("2600.00"),
        "manufacturer": "Demant",
        "registration_no": "AU-PHI-STD-009",
        "unit": "套",
        "remark": "标准成品机",
    },
    {
        "product_code": "BHM-SET-010",
        "brand": BrandEnum.SIEMENS,
        "category": CategoryEnum.BEHIND_EAR_MACHINE,
        "name_cn": "西门子耳背机",
        "name_en": "Siemens Behind-Ear",
        "specification": "BTE / Pair",
        "matrix": "Classic",
        "original_price": Decimal("6100.00"),
        "cost_price": Decimal("3000.00"),
        "manufacturer": "WS Audiology",
        "registration_no": "AU-SIE-BHM-010",
        "unit": "套",
        "remark": "中文业务分类机型",
    },
    {
        "product_code": "CUS-SET-011",
        "brand": BrandEnum.SIGNIA,
        "category": CategoryEnum.CUSTOM_MACHINE,
        "name_cn": "西嘉定制机",
        "name_en": "Signia Custom Device",
        "specification": "Custom / Pair",
        "matrix": "Custom 5",
        "original_price": Decimal("8800.00"),
        "cost_price": Decimal("4700.00"),
        "manufacturer": "WS Audiology",
        "registration_no": "AU-SIG-CUS-011",
        "unit": "套",
        "remark": "按耳样定制",
    },
    {
        "product_code": "REC-2-012",
        "brand": BrandEnum.SIGNIA,
        "category": CategoryEnum.RECEIVER_2,
        "name_cn": "2.0受话器",
        "name_en": "Receiver 2.0",
        "specification": "M / 2.0",
        "matrix": "2M",
        "original_price": Decimal("580.00"),
        "cost_price": Decimal("230.00"),
        "manufacturer": "WS Audiology",
        "registration_no": None,
        "unit": "个",
        "remark": "附件类",
    },
    {
        "product_code": "REC-3-013",
        "brand": BrandEnum.PHONAK,
        "category": CategoryEnum.RECEIVER_3,
        "name_cn": "3.0受话器",
        "name_en": "Receiver 3.0",
        "specification": "P / 3.0",
        "matrix": "3P",
        "original_price": Decimal("760.00"),
        "cost_price": Decimal("320.00"),
        "manufacturer": "Sonova",
        "registration_no": None,
        "unit": "个",
        "remark": "高功率受话器",
    },
    {
        "product_code": "CHR-014",
        "brand": BrandEnum.SIGNIA,
        "category": CategoryEnum.CHARGER,
        "name_cn": "便携充电器",
        "name_en": "Portable Charger",
        "specification": "USB-C",
        "matrix": "CHR-AX",
        "original_price": Decimal("980.00"),
        "cost_price": Decimal("410.00"),
        "manufacturer": "WS Audiology",
        "registration_no": None,
        "unit": "个",
        "remark": "配套充电器",
    },
    {
        "product_code": "EAR-015",
        "brand": BrandEnum.ZHILI,
        "category": CategoryEnum.EAR_MOLD,
        "name_cn": "定制耳模",
        "name_en": "Custom Ear Mold",
        "specification": "Silicone",
        "matrix": "MOLD-S",
        "original_price": Decimal("260.00"),
        "cost_price": Decimal("90.00"),
        "manufacturer": "Zhili Medical",
        "registration_no": None,
        "unit": "只",
        "remark": "个性化附件",
    },
    {
        "product_code": "ACC-016",
        "brand": BrandEnum.PHILIPS,
        "category": CategoryEnum.ACCESSORY,
        "name_cn": "多功能清洁套装",
        "name_en": "Cleaning Accessory Kit",
        "specification": "Care Set",
        "matrix": "KIT-01",
        "original_price": Decimal("120.00"),
        "cost_price": Decimal("45.00"),
        "manufacturer": "Demant",
        "registration_no": None,
        "unit": "套",
        "remark": "常规配件",
    },
    {
        "product_code": "CARE-017",
        "brand": BrandEnum.ZHILI,
        "category": CategoryEnum.CARE_DEVICE,
        "name_cn": "护理宝",
        "name_en": "Care Device",
        "specification": "Dry Box",
        "matrix": "CARE-BOX",
        "original_price": Decimal("390.00"),
        "cost_price": Decimal("160.00"),
        "manufacturer": "Zhili Medical",
        "registration_no": None,
        "unit": "台",
        "remark": "干燥护理",
    },
    {
        "product_code": "CROS-018",
        "brand": BrandEnum.PHONAK,
        "category": CategoryEnum.CROS,
        "name_cn": "同声移系统",
        "name_en": "CROS System",
        "specification": "Pairing Kit",
        "matrix": "CROS-P",
        "original_price": Decimal("5400.00"),
        "cost_price": Decimal("2900.00"),
        "manufacturer": "Sonova",
        "registration_no": "AU-PHO-CROS-018",
        "unit": "套",
        "remark": "单侧聋方案",
    },
    {
        "product_code": "DEM-019",
        "brand": BrandEnum.SIGNIA,
        "category": CategoryEnum.DEMO_MACHINE,
        "name_cn": "演示样机",
        "name_en": "Demo Device",
        "specification": "Display Unit",
        "matrix": "DEMO-AX",
        "original_price": Decimal("0.00"),
        "cost_price": Decimal("0.00"),
        "manufacturer": "WS Audiology",
        "registration_no": None,
        "unit": "台",
        "remark": "门店展示",
    },
    {
        "product_code": "BAT-020",
        "brand": BrandEnum.POWERONE,
        "category": CategoryEnum.BATTERY,
        "name_cn": "PowerOne 电池 6粒装",
        "name_en": "PowerOne Battery 6-pack",
        "specification": "312 / 6-pack",
        "matrix": "BAT-312",
        "original_price": Decimal("28.00"),
        "cost_price": Decimal("10.00"),
        "manufacturer": "VARTA",
        "registration_no": None,
        "unit": "板",
        "remark": "高频耗材",
    },
    {
        "product_code": "BAT-021",
        "brand": BrandEnum.ZHILI,
        "category": CategoryEnum.BATTERY,
        "name_cn": "至力电池 10粒装",
        "name_en": "Zhili Battery 10-pack",
        "specification": "13 / 10-pack",
        "matrix": "BAT-13",
        "original_price": Decimal("36.00"),
        "cost_price": Decimal("12.00"),
        "manufacturer": "Zhili Medical",
        "registration_no": None,
        "unit": "板",
        "remark": "门店常备",
    },
    {
        "product_code": "SIG-RIC-022",
        "brand": BrandEnum.SIGNIA,
        "category": CategoryEnum.RIC,
        "name_cn": "西嘉 Pure Charge&Go",
        "name_en": "Signia Pure Charge&Go",
        "specification": "RIC / Pair",
        "matrix": "3IX",
        "original_price": Decimal("7200.00"),
        "cost_price": Decimal("3600.00"),
        "manufacturer": "WS Audiology",
        "registration_no": "AU-SIG-RIC-022",
        "unit": "套",
        "remark": "主销RIC",
    },
    {
        "product_code": "PHI-BTE-023",
        "brand": BrandEnum.PHILIPS,
        "category": CategoryEnum.BTE,
        "name_cn": "飞利浦 BTE",
        "name_en": "Philips BTE",
        "specification": "BTE / Pair",
        "matrix": "9030",
        "original_price": Decimal("5600.00"),
        "cost_price": Decimal("2800.00"),
        "manufacturer": "Demant",
        "registration_no": "AU-PHI-BTE-023",
        "unit": "套",
        "remark": "基础款耳背机",
    },
    {
        "product_code": "SIE-CIC-024",
        "brand": BrandEnum.SIEMENS,
        "category": CategoryEnum.CIC,
        "name_cn": "西门子 CIC",
        "name_en": "Siemens CIC",
        "specification": "CIC / Pair",
        "matrix": "2NX",
        "original_price": Decimal("6300.00"),
        "cost_price": Decimal("3100.00"),
        "manufacturer": "WS Audiology",
        "registration_no": "AU-SIE-CIC-024",
        "unit": "套",
        "remark": "入门隐形机",
    },
]


FIRST_NAMES = [
    "Liam", "Noah", "Oliver", "Elijah", "James", "Lucas", "Mason", "Ethan", "Alexander", "Henry",
    "Amelia", "Olivia", "Ava", "Charlotte", "Sophia", "Isabella", "Mia", "Harper", "Evelyn", "Ella",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Taylor",
    "Clark", "Walker", "Hall", "Young", "Allen", "King", "Wright", "Scott", "Green", "Baker",
]

GENDERS = ["男", "女"]
HEARING_LOSS_TYPES = ["轻度", "中度", "中重度", "重度", None]
APPOINTMENT_TYPES = ["初诊", "调音", "复查", "保养"]


def dt_in_tz(days_offset: int, hour: int, minute: int = 0) -> datetime:
    base_date = datetime.now(BUSINESS_TZ).date() + timedelta(days=days_offset)
    return datetime.combine(base_date, time(hour=hour, minute=minute), tzinfo=BUSINESS_TZ)


async def ensure_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_or_create_store(session: AsyncSession, payload: dict[str, object]) -> Store:
    store = await session.scalar(select(Store).where(Store.name == payload["name"]))
    if store is None:
        store = Store(**payload)
        session.add(store)
        await session.flush()
    else:
        store.address = payload["address"]  # type: ignore[index]
        store.phone = payload["phone"]  # type: ignore[index]
        store.store_type = payload["store_type"]  # type: ignore[index]
    return store


async def get_or_create_employee(
    session: AsyncSession,
    username: str,
    role: EmployeeRole,
    store: Store | None,
) -> Employee:
    employee = await session.scalar(select(Employee).where(Employee.username == username))
    if employee is None:
        employee = Employee(
            username=username,
            hashed_password=get_password_hash("Demo123!"),
            role=role,
            store_id=store.id if store else None,
            is_active=True,
        )
        session.add(employee)
        await session.flush()
    else:
        employee.hashed_password = get_password_hash("Demo123!")
        employee.role = role
        employee.store_id = store.id if store else None
        employee.is_active = True
    return employee


async def get_or_create_product(session: AsyncSession, payload: dict[str, object]) -> Product:
    product = await session.scalar(select(Product).where(Product.product_code == payload["product_code"]))
    if product is None:
        product = Product(**payload)
        session.add(product)
        await session.flush()
    else:
        for key, value in payload.items():
            setattr(product, key, value)
    return product


async def get_or_create_customer(
    session: AsyncSession,
    *,
    name: str,
    phone: str,
    gender: str,
    birth_date_value: date,
    address: str,
    primary_store_id,
    age: int,
    hearing_loss_type: str | None,
) -> Customer:
    stmt = select(Customer).where(
        Customer.name == name,
        Customer.phone == phone,
        Customer.gender == gender,
        Customer.birth_date == birth_date_value,
    )
    customer = await session.scalar(stmt)
    if customer is None:
        customer = Customer(
            name=name,
            phone=phone,
            gender=gender,
            birth_date=birth_date_value,
            address=address,
            primary_store_id=primary_store_id,
            age=age,
            hearing_loss_type=hearing_loss_type,
        )
        session.add(customer)
        await session.flush()
    else:
        customer.address = address
        customer.primary_store_id = primary_store_id
        customer.age = age
        customer.hearing_loss_type = hearing_loss_type
    return customer


async def ensure_inventory(session: AsyncSession, store_id, product_id, target_qty: int) -> Inventory:
    inventory = await session.scalar(
        select(Inventory).where(Inventory.store_id == store_id, Inventory.product_id == product_id)
    )
    if inventory is None:
        inventory = Inventory(store_id=store_id, product_id=product_id, quantity=target_qty)
        session.add(inventory)
        await session.flush()
    else:
        inventory.quantity = target_qty
    return inventory


async def ensure_inventory_summary(
    session: AsyncSession,
    *,
    store_id,
    product_id,
    last_month_stock: int,
    in_this_month: int,
    out_this_month: int,
    sales_this_month: int,
    actual_stock: int,
) -> InventorySummary:
    summary = await session.scalar(
        select(InventorySummary).where(
            InventorySummary.store_id == store_id,
            InventorySummary.product_id == product_id,
            InventorySummary.month_year == MONTH_KEY,
        )
    )
    expected_stock = last_month_stock + in_this_month - out_this_month - sales_this_month
    if summary is None:
        summary = InventorySummary(
            store_id=store_id,
            product_id=product_id,
            last_month_stock=last_month_stock,
            in_this_month=in_this_month,
            out_this_month=out_this_month,
            sales_this_month=sales_this_month,
            expected_stock=expected_stock,
            actual_stock=actual_stock,
            month_year=MONTH_KEY,
        )
        session.add(summary)
        await session.flush()
    else:
        summary.last_month_stock = last_month_stock
        summary.in_this_month = in_this_month
        summary.out_this_month = out_this_month
        summary.sales_this_month = sales_this_month
        summary.expected_stock = expected_stock
        summary.actual_stock = actual_stock
    return summary


async def clear_demo_transactions(session: AsyncSession) -> None:
    for model in (Appointment, FittingRecord, RepairRecord, OrderItem, Order, StockTransaction, InventoryLedger, InventorySummary):
        rows = await session.scalars(select(model))
        for row in rows:
            await session.delete(row)
    await session.flush()


def customer_name(index: int) -> str:
    return f"{FIRST_NAMES[index % len(FIRST_NAMES)]} {LAST_NAMES[(index * 3) % len(LAST_NAMES)]}"


def customer_phone(index: int) -> str:
    return f"04{12000000 + index:08d}"


def customer_birth_date(index: int) -> date:
    return date(1958 + (index % 40), (index % 12) + 1, ((index * 2) % 27) + 1)


def customer_address(index: int) -> str:
    suburbs = ["Sydney", "Melbourne", "Parramatta", "Adelaide", "Chatswood", "Burwood", "Glenelg", "Box Hill"]
    return f"{20 + index} Demo Street, {suburbs[index % len(suburbs)]}"


async def create_seed_data(session: AsyncSession) -> dict[str, int]:
    stores: dict[str, Store] = {}
    for payload in STORE_SEED:
        store = await get_or_create_store(session, payload)
        stores[store.name] = store

    employees: dict[str, Employee] = {}
    for payload in EMPLOYEE_SEED:
        store = stores.get(payload["store_name"]) if payload["store_name"] else None
        employee = await get_or_create_employee(session, payload["username"], payload["role"], store)
        employees[employee.username] = employee

    products: list[Product] = []
    for payload in PRODUCT_SEED:
        products.append(await get_or_create_product(session, payload))

    customers: list[Customer] = []
    store_list = list(stores.values())
    for index in range(60):
        store = store_list[index % len(store_list)]
        birth = customer_birth_date(index)
        customer = await get_or_create_customer(
            session,
            name=customer_name(index),
            phone=customer_phone(index),
            gender=GENDERS[index % len(GENDERS)],
            birth_date_value=birth,
            address=customer_address(index),
            primary_store_id=store.id,
            age=datetime.now(BUSINESS_TZ).year - birth.year,
            hearing_loss_type=HEARING_LOSS_TYPES[index % len(HEARING_LOSS_TYPES)],
        )
        customers.append(customer)

    await clear_demo_transactions(session)

    inventory_rows = 0
    ledger_rows = 0
    stock_rows = 0
    summary_rows = 0

    for store_index, store in enumerate(store_list):
        handler = next(
            employee
            for employee in employees.values()
            if employee.store_id == store.id and employee.role in {EmployeeRole.STORE_MANAGER, EmployeeRole.STAFF}
        )

        for product_index, product in enumerate(products):
            last_month_stock = 4 + ((store_index + product_index) % 6)
            inbound_qty = 6 + ((store_index * 2 + product_index) % 10)
            outbound_qty = (store_index + product_index) % 3
            sales_qty = (store_index * 3 + product_index) % 5
            actual_stock = max(last_month_stock + inbound_qty - outbound_qty - sales_qty, 0)

            await ensure_inventory(session, store.id, product.id, actual_stock)
            inventory_rows += 1

            await ensure_inventory_summary(
                session,
                store_id=store.id,
                product_id=product.id,
                last_month_stock=last_month_stock,
                in_this_month=inbound_qty,
                out_this_month=outbound_qty,
                sales_this_month=sales_qty,
                actual_stock=actual_stock,
            )
            summary_rows += 1

            inbound_date = dt_in_tz(-25 + (product_index % 8), 10 + (store_index % 3))
            inbound_dt = inbound_date.astimezone(UTC)
            session.add(
                StockTransaction(
                    transaction_date=inbound_dt,
                    store_id=store.id,
                    product_id=product.id,
                    customer_id=None,
                    type=TransactionType.INBOUND,
                    quantity=inbound_qty,
                    unit_price=product.cost_price,
                    handled_by=handler.id,
                    target="Head Office Purchasing",
                    remark=f"{brand_display(product.brand.name)} {category_display(product.category.name)} 补货入库",
                )
            )
            session.add(
                InventoryLedger(
                    store_id=store.id,
                    product_id=product.id,
                    change_amount=inbound_qty,
                    reference_type="stock_in",
                )
            )
            stock_rows += 1
            ledger_rows += 1

            if outbound_qty > 0:
                outbound_date = dt_in_tz(-12 + (product_index % 6), 15)
                session.add(
                    StockTransaction(
                        transaction_date=outbound_date.astimezone(UTC),
                        store_id=store.id,
                        product_id=product.id,
                        customer_id=None,
                        type=TransactionType.OUTBOUND,
                        quantity=outbound_qty,
                        unit_price=product.cost_price,
                        handled_by=handler.id,
                        target="Display / External Usage",
                        remark=f"{product.name_cn} 调拨或展示出库",
                    )
                )
                session.add(
                    InventoryLedger(
                        store_id=store.id,
                        product_id=product.id,
                        change_amount=-outbound_qty,
                        reference_type="transfer",
                    )
                )
                stock_rows += 1
                ledger_rows += 1

    orders_created = 0
    order_items_created = 0
    repairs_created = 0
    fittings_created = 0
    appointments_created = 0

    machine_products = [
        product
        for product in products
        if product.category
        in {
            CategoryEnum.BTE,
            CategoryEnum.RIC,
            CategoryEnum.ITC,
            CategoryEnum.ITE,
            CategoryEnum.IIC,
            CategoryEnum.CIC,
            CategoryEnum.IIC_CIC,
            CategoryEnum.STANDARD_MACHINE,
            CategoryEnum.BEHIND_EAR_MACHINE,
            CategoryEnum.CUSTOM_MACHINE,
        }
    ]
    accessory_products = [product for product in products if product not in machine_products]

    for index in range(36):
        customer = customers[index]
        store = stores[next(name for name, value in stores.items() if value.id == customer.primary_store_id)]
        handler = next(employee for employee in employees.values() if employee.store_id == store.id)
        machine = machine_products[index % len(machine_products)]
        accessory = accessory_products[index % len(accessory_products)]
        order_time = dt_in_tz(-(index % 7), 9 + (index % 8), 15).astimezone(UTC)

        order = Order(
            customer_id=customer.id,
            store_id=store.id,
            total_amount=Decimal("0.00"),
            status=OrderStatus.PAID,
            created_at=order_time.replace(tzinfo=None),
        )
        session.add(order)
        await session.flush()

        items: list[tuple[Product, int, Decimal]] = [
            (machine, 1, machine.original_price),
        ]
        if index % 2 == 0:
            items.append((accessory, 1 + (index % 2), accessory.original_price))

        total_amount = Decimal("0.00")
        for product, quantity, unit_price in items:
            session.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=unit_price,
                )
            )
            line_total = unit_price * quantity
            total_amount += line_total
            order_items_created += 1

            inventory = await session.scalar(
                select(Inventory).where(Inventory.store_id == store.id, Inventory.product_id == product.id)
            )
            if inventory is not None:
                inventory.quantity = max(inventory.quantity - quantity, 0)

            session.add(
                StockTransaction(
                    transaction_date=order_time,
                    store_id=store.id,
                    product_id=product.id,
                    customer_id=customer.id,
                    type=TransactionType.SALE,
                    quantity=quantity,
                    unit_price=unit_price,
                    handled_by=handler.id,
                    target=customer.name,
                    remark=f"{product.name_cn} 销售登记",
                )
            )
            session.add(
                InventoryLedger(
                    store_id=store.id,
                    product_id=product.id,
                    change_amount=-quantity,
                    reference_type="sale",
                )
            )
            stock_rows += 1
            ledger_rows += 1

        order.total_amount = total_amount
        orders_created += 1

    for index, customer in enumerate(customers[:24]):
        store = stores[next(name for name, value in stores.items() if value.id == customer.primary_store_id)]
        handler = next(employee for employee in employees.values() if employee.store_id == store.id)
        product = machine_products[index % len(machine_products)]
        receive_date = datetime.now(BUSINESS_TZ).date() - timedelta(days=12 - (index % 6))
        due_date = datetime.now(BUSINESS_TZ).date() + timedelta(days=(index % 9) - 3)
        status = [RepairStatus.PENDING, RepairStatus.FACTORY, RepairStatus.DELIVERED][index % 3]

        session.add(
            RepairRecord(
                customer_id=customer.id,
                store_id=store.id,
                machine_model=product.name_cn,
                receive_date=receive_date,
                due_date=due_date,
                issue_description=f"{product.name_cn} 需要调试、清洁和性能复检",
                status=status,
                handled_by=handler.id,
            )
        )
        repairs_created += 1

    for index, customer in enumerate(customers[:30]):
        store = stores[next(name for name, value in stores.items() if value.id == customer.primary_store_id)]
        creator = next(employee for employee in employees.values() if employee.store_id == store.id)
        product = machine_products[(index * 2) % len(machine_products)]

        session.add(
            FittingRecord(
                customer_id=customer.id,
                store_id=store.id,
                product_id=product.id,
                fitting_date=datetime.now(BUSINESS_TZ).date() - timedelta(days=index % 20),
                device_name=product.name_cn,
                fitting_notes=f"完成 {category_display(product.category.name)} 初次验配与增益微调",
                result_summary=["适应良好", "需要继续跟进", "佩戴舒适，建议一周复查"][index % 3],
                created_by=creator.id,
            )
        )
        fittings_created += 1

    for index, customer in enumerate(customers[:28]):
        store = stores[next(name for name, value in stores.items() if value.id == customer.primary_store_id)]
        employee = next(employee for employee in employees.values() if employee.store_id == store.id)
        appointment_time = dt_in_tz((index % 14) - 6, 9 + (index % 6), 30)
        if index % 5 == 0:
            appointment_status = AppointmentStatus.COMPLETED
        elif index % 7 == 0:
            appointment_status = AppointmentStatus.CANCELLED
        else:
            appointment_status = AppointmentStatus.PENDING

        session.add(
            Appointment(
                store_id=store.id,
                customer_id=customer.id,
                employee_id=employee.id,
                appointment_time=appointment_time.astimezone(UTC).replace(tzinfo=None),
                type=APPOINTMENT_TYPES[index % len(APPOINTMENT_TYPES)],
                status=appointment_status,
                notes="Demo seed appointment for UI testing",
            )
        )
        appointments_created += 1

    await session.flush()

    return {
        "stores": len(stores),
        "employees": len(employees),
        "customers": len(customers),
        "products": len(products),
        "inventories": inventory_rows,
        "inventory_summaries": summary_rows,
        "stock_transactions": stock_rows,
        "inventory_ledger": ledger_rows,
        "orders": orders_created,
        "order_items": order_items_created,
        "repairs": repairs_created,
        "fittings": fittings_created,
        "appointments": appointments_created,
    }


async def print_current_counts(session: AsyncSession) -> None:
    tables: Iterable[tuple[str, type]] = (
        ("stores", Store),
        ("employees", Employee),
        ("customers", Customer),
        ("products", Product),
        ("inventories", Inventory),
        ("inventory_summaries", InventorySummary),
        ("stock_transactions", StockTransaction),
        ("orders", Order),
        ("order_items", OrderItem),
        ("repairs", RepairRecord),
        ("fittings", FittingRecord),
        ("appointments", Appointment),
    )
    print("\nCurrent totals:")
    for label, model in tables:
        total = await session.scalar(select(func.count()).select_from(model))
        print(f"  {label}: {total}")


async def main() -> None:
    await ensure_schema()
    async with AsyncSessionLocal() as session:
        async with session.begin():
            summary = await create_seed_data(session)

        print("Seed complete.\n")
        print("Added / refreshed demo data:")
        for key, value in summary.items():
            print(f"  {key}: {value}")
        print("\nDemo employee password: Demo123!")
        await print_current_counts(session)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
