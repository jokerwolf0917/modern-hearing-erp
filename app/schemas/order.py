import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.models import OrderStatus


class OrderItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(gt=0)
    sn_codes: list[str] = Field(default_factory=list)


class OrderCreate(BaseModel):
    customer_id: uuid.UUID
    store_id: uuid.UUID
    items: list[OrderItemCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_items(self) -> "OrderCreate":
        if not self.items:
            raise ValueError("At least one order item is required")
        return self


class OrderItemRead(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    product_name: str
    sku: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    sn_codes: list[str] = Field(default_factory=list)


class OrderRead(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    store_id: uuid.UUID
    total_amount: Decimal
    status: OrderStatus
    created_at: datetime
    items: list[OrderItemRead]


class OrderListItem(BaseModel):
    class Item(BaseModel):
        class SerialDetail(BaseModel):
            sn_code: str
            warranty_ends_at: datetime | None = None

        product_name: str
        sku: str
        quantity: int
        unit_price: Decimal
        serial_details: list[SerialDetail] = Field(default_factory=list)

    id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    store_id: uuid.UUID
    store_name: str
    total_amount: Decimal
    status: OrderStatus
    created_at: datetime
    items: list[Item]
