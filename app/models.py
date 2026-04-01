from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SqlEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.database import Base


def enum_values(enum_class: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_class]


class EmployeeRole(str, enum.Enum):
    ADMIN = "ADMIN"
    STORE_MANAGER = "STORE_MANAGER"
    STAFF = "STAFF"


class StoreType(str, enum.Enum):
    STREET = "street"
    HOSPITAL = "hospital"


class BrandEnum(str, enum.Enum):
    SIGNIA = "SIGNIA"
    PHONAK = "PHONAK"
    PHILIPS = "PHILIPS"
    SIEMENS = "SIEMENS"
    POWERONE = "POWERONE"
    ZHILI = "ZHILI"


class CategoryEnum(str, enum.Enum):
    BTE = "BTE"
    RIC = "RIC"
    ITC = "ITC"
    ITE = "ITE"
    IIC = "IIC"
    CIC = "CIC"
    IIC_CIC = "IIC_CIC"
    STANDARD_MACHINE = "标准机"
    BEHIND_EAR_MACHINE = "耳背机"
    CUSTOM_MACHINE = "定制机"
    RECEIVER_2 = "受话器_2"
    RECEIVER_3 = "受话器_3"
    CHARGER = "充电器"
    EAR_MOLD = "耳模"
    ACCESSORY = "配件"
    CARE_DEVICE = "护理宝"
    CROS = "同声移"
    DEMO_MACHINE = "Demo机"
    BATTERY = "电池"


class TransactionType(str, enum.Enum):
    INBOUND = "INBOUND"
    OUTBOUND = "OUTBOUND"
    SALE = "SALE"


class RepairStatus(str, enum.Enum):
    PENDING = "PENDING"
    FACTORY = "FACTORY"
    DELIVERED = "DELIVERED"


class TransferStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_TRANSIT = "IN_TRANSIT"
    COMPLETED = "COMPLETED"


class OrderStatus(str, enum.Enum):
    PAID = "PAID"
    RETURNED = "RETURNED"
    CANCELLED = "CANCELLED"


class AppointmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class Store(TimestampMixin, Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    store_type: Mapped[StoreType] = mapped_column(
        SqlEnum(StoreType, values_callable=enum_values),
        nullable=False,
        default=StoreType.STREET,
    )

    employees: Mapped[list["Employee"]] = relationship(back_populates="store")
    customers: Mapped[list["Customer"]] = relationship(back_populates="primary_store")
    inventories: Mapped[list["Inventory"]] = relationship(back_populates="store")
    outgoing_transfers: Mapped[list["Transfer"]] = relationship(
        back_populates="from_store",
        foreign_keys="Transfer.from_store_id",
    )
    incoming_transfers: Mapped[list["Transfer"]] = relationship(
        back_populates="to_store",
        foreign_keys="Transfer.to_store_id",
    )
    orders: Mapped[list["Order"]] = relationship(back_populates="store")
    stock_transactions: Mapped[list["StockTransaction"]] = relationship(back_populates="store")
    inventory_summaries: Mapped[list["InventorySummary"]] = relationship(back_populates="store")
    repairs: Mapped[list["RepairRecord"]] = relationship(back_populates="store")
    fitting_records: Mapped[list["FittingRecord"]] = relationship(back_populates="store")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="store")


class Employee(TimestampMixin, Base):
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[EmployeeRole] = mapped_column(
        SqlEnum(EmployeeRole, values_callable=enum_values),
        nullable=False,
        default=EmployeeRole.STAFF,
    )
    store_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stores.id"), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)

    store: Mapped["Store | None"] = relationship(back_populates="employees")
    handled_transactions: Mapped[list["StockTransaction"]] = relationship(back_populates="handler")
    handled_repairs: Mapped[list["RepairRecord"]] = relationship(back_populates="handler")
    created_fittings: Mapped[list["FittingRecord"]] = relationship(back_populates="creator")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="employee")


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("name", "phone", "gender", "birth_date", name="uq_customer_identity"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    hearing_loss_type: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    primary_store_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("stores.id"),
        nullable=True,
        index=True,
    )

    primary_store: Mapped["Store | None"] = relationship(back_populates="customers")
    orders: Mapped[list["Order"]] = relationship(back_populates="customer")
    stock_transactions: Mapped[list["StockTransaction"]] = relationship(back_populates="customer")
    repairs: Mapped[list["RepairRecord"]] = relationship(back_populates="customer")
    fitting_records: Mapped[list["FittingRecord"]] = relationship(back_populates="customer")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="customer")


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    product_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    category: Mapped[CategoryEnum] = mapped_column(
        SqlEnum(CategoryEnum, values_callable=enum_values),
        nullable=False,
    )
    brand: Mapped[BrandEnum] = mapped_column(
        SqlEnum(BrandEnum, values_callable=enum_values),
        nullable=False,
    )
    name_cn: Mapped[str] = mapped_column(String(150), nullable=False)
    name_en: Mapped[str | None] = mapped_column(String(150), nullable=True)
    specification: Mapped[str | None] = mapped_column(String(255), nullable=True)
    matrix: Mapped[str | None] = mapped_column(String(120), nullable=True)
    original_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    manufacturer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    registration_no: Mapped[str | None] = mapped_column(String(120), nullable=True)
    has_sn_tracking: Mapped[bool] = mapped_column(nullable=False, default=False)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    sku = synonym("product_code")
    name = synonym("name_cn")
    retail_price = synonym("original_price")

    inventories: Mapped[list["Inventory"]] = relationship(back_populates="product")
    transfers: Mapped[list["Transfer"]] = relationship(back_populates="product")
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="product")
    stock_transactions: Mapped[list["StockTransaction"]] = relationship(back_populates="product")
    inventory_summaries: Mapped[list["InventorySummary"]] = relationship(back_populates="product")
    fitting_records: Mapped[list["FittingRecord"]] = relationship(back_populates="product")


class Inventory(Base):
    __tablename__ = "inventories"
    __table_args__ = (UniqueConstraint("store_id", "product_id", name="uq_inventory_store_product"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    store: Mapped["Store"] = relationship(back_populates="inventories")
    product: Mapped["Product"] = relationship(back_populates="inventories")


class InventoryLedger(TimestampMixin, Base):
    __tablename__ = "inventory_ledger"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    change_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)


class Transfer(TimestampMixin, Base):
    __tablename__ = "transfers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    from_store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    to_store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[TransferStatus] = mapped_column(
        SqlEnum(TransferStatus, values_callable=enum_values),
        nullable=False,
        default=TransferStatus.PENDING,
    )

    from_store: Mapped["Store"] = relationship(
        back_populates="outgoing_transfers",
        foreign_keys=[from_store_id],
    )
    to_store: Mapped["Store"] = relationship(
        back_populates="incoming_transfers",
        foreign_keys=[to_store_id],
    )
    product: Mapped["Product"] = relationship(back_populates="transfers")


class StockTransaction(TimestampMixin, Base):
    __tablename__ = "stock_transactions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    type: Mapped[TransactionType] = mapped_column(
        SqlEnum(TransactionType, values_callable=enum_values),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    handled_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"), nullable=True, index=True)
    target: Mapped[str | None] = mapped_column(String(255), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)

    store: Mapped["Store"] = relationship(back_populates="stock_transactions")
    product: Mapped["Product"] = relationship(back_populates="stock_transactions")
    customer: Mapped["Customer | None"] = relationship(back_populates="stock_transactions")
    handler: Mapped["Employee | None"] = relationship(back_populates="handled_transactions")


class InventorySummary(TimestampMixin, Base):
    __tablename__ = "inventory_summaries"
    __table_args__ = (
        UniqueConstraint("store_id", "product_id", "month_year", name="uq_inventory_summary_month"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    last_month_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    in_this_month: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    out_this_month: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sales_this_month: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expected_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    actual_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    month_year: Mapped[str] = mapped_column(String(7), nullable=False, index=True)

    store: Mapped["Store"] = relationship(back_populates="inventory_summaries")
    product: Mapped["Product"] = relationship(back_populates="inventory_summaries")


class RepairRecord(TimestampMixin, Base):
    __tablename__ = "repair_records"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    machine_model: Mapped[str] = mapped_column(String(255), nullable=False)
    receive_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    issue_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RepairStatus] = mapped_column(
        SqlEnum(RepairStatus, values_callable=enum_values),
        nullable=False,
        default=RepairStatus.PENDING,
    )
    handled_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"), nullable=True, index=True)

    customer: Mapped["Customer"] = relationship(back_populates="repairs")
    store: Mapped["Store"] = relationship(back_populates="repairs")
    handler: Mapped["Employee | None"] = relationship(back_populates="handled_repairs")


class FittingRecord(TimestampMixin, Base):
    __tablename__ = "fitting_records"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("products.id"), nullable=True, index=True)
    fitting_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    device_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fitting_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"), nullable=True, index=True)

    customer: Mapped["Customer"] = relationship(back_populates="fitting_records")
    store: Mapped["Store"] = relationship(back_populates="fitting_records")
    product: Mapped["Product | None"] = relationship(back_populates="fitting_records")
    creator: Mapped["Employee | None"] = relationship(back_populates="created_fittings")


class Appointment(TimestampMixin, Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"), nullable=False, index=True)
    appointment_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    status: Mapped[AppointmentStatus] = mapped_column(
        SqlEnum(AppointmentStatus, values_callable=enum_values),
        nullable=False,
        default=AppointmentStatus.PENDING,
    )
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    store: Mapped["Store"] = relationship(back_populates="appointments")
    customer: Mapped["Customer"] = relationship(back_populates="appointments")
    employee: Mapped["Employee"] = relationship(back_populates="appointments")


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        SqlEnum(OrderStatus, values_callable=enum_values),
        nullable=False,
        default=OrderStatus.PAID,
    )

    customer: Mapped["Customer"] = relationship(back_populates="orders")
    store: Mapped["Store"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    order: Mapped["Order"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship(back_populates="order_items")
