import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, UniqueConstraint, Uuid, func
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def enum_values(enum_class: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_class]


class StoreType(str, enum.Enum):
    HOSPITAL = "hospital"
    STREET = "street"


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"


class EmployeeRole(str, enum.Enum):
    ADMIN = "admin"
    STORE_MANAGER = "store_manager"
    STAFF = "staff"


class TransferStatus(str, enum.Enum):
    PENDING = "pending"
    IN_TRANSIT = "in_transit"
    COMPLETED = "completed"


class OrderStatus(str, enum.Enum):
    PAID = "paid"
    RETURNED = "returned"
    CANCELLED = "cancelled"


class ProductSerialStatus(str, enum.Enum):
    IN_STOCK = "in_stock"
    SOLD = "sold"
    RETURNED = "returned"
    DEFECTIVE = "defective"


class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class Store(TimestampMixin, Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    store_type: Mapped[StoreType] = mapped_column(
        SqlEnum(StoreType, values_callable=enum_values),
        nullable=False,
        default=StoreType.STREET,
    )

    users: Mapped[list["User"]] = relationship(back_populates="store")
    inventories: Mapped[list["Inventory"]] = relationship(back_populates="store")
    outgoing_transfers: Mapped[list["Transfer"]] = relationship(
        back_populates="from_store",
        foreign_keys="Transfer.from_store_id",
    )
    incoming_transfers: Mapped[list["Transfer"]] = relationship(
        back_populates="to_store",
        foreign_keys="Transfer.to_store_id",
    )
    customers: Mapped[list["Customer"]] = relationship(back_populates="primary_store")
    orders: Mapped[list["Order"]] = relationship(back_populates="store")
    employees: Mapped[list["Employee"]] = relationship(back_populates="store")
    product_serials: Mapped[list["ProductSerial"]] = relationship(back_populates="store")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="store")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, values_callable=enum_values),
        nullable=False,
        default=UserRole.STAFF,
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    store: Mapped["Store"] = relationship(back_populates="users")


class Employee(Base):
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
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    store: Mapped["Store | None"] = relationship(back_populates="employees")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="employee")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    sku: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    retail_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    manufacturer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    registration_no: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    has_sn_tracking: Mapped[bool] = mapped_column(nullable=False, default=False)

    inventories: Mapped[list["Inventory"]] = relationship(back_populates="product")
    transfers: Mapped[list["Transfer"]] = relationship(back_populates="product")
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="product")
    serials: Mapped[list["ProductSerial"]] = relationship(back_populates="product")


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


class ProductSerial(TimestampMixin, Base):
    __tablename__ = "product_serials"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    sn_code: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    status: Mapped[ProductSerialStatus] = mapped_column(
        SqlEnum(ProductSerialStatus, values_callable=enum_values),
        nullable=False,
        default=ProductSerialStatus.IN_STOCK,
    )
    order_item_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("order_items.id"), nullable=True, index=True)
    warranty_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    store: Mapped["Store"] = relationship(back_populates="product_serials")
    product: Mapped["Product"] = relationship(back_populates="serials")
    order_item: Mapped["OrderItem | None"] = relationship(back_populates="serials")


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


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    hearing_loss_type: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    primary_store_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stores.id"), nullable=False, index=True)
    ocr_raw_data: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)

    primary_store: Mapped["Store"] = relationship(back_populates="customers")
    orders: Mapped[list["Order"]] = relationship(back_populates="customer")
    audiograms: Mapped[list["Audiogram"]] = relationship(
        back_populates="customer",
        cascade="all, delete-orphan",
        order_by="desc(Audiogram.test_date)",
    )
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="customer")


class Audiogram(TimestampMixin, Base):
    __tablename__ = "audiograms"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    test_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    left_ear_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    right_ear_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    customer: Mapped["Customer"] = relationship(back_populates="audiograms")


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
    serials: Mapped[list["ProductSerial"]] = relationship(back_populates="order_item")
