import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    sku: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=80)
    cost_price: Decimal = Field(ge=0)
    retail_price: Decimal = Field(gt=0)
    brand: str = Field(min_length=1, max_length=80)
    manufacturer: str = Field(min_length=1, max_length=120)
    registration_no: str = Field(min_length=1, max_length=120)
    has_sn_tracking: bool = False


class ProductUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    sku: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=80)
    cost_price: Decimal = Field(ge=0)
    retail_price: Decimal = Field(gt=0)
    brand: str = Field(min_length=1, max_length=80)
    manufacturer: str = Field(min_length=1, max_length=120)
    registration_no: str = Field(min_length=1, max_length=120)
    has_sn_tracking: bool = False


class ProductRead(BaseModel):
    id: uuid.UUID
    name: str
    sku: str
    category: str
    cost_price: Decimal
    retail_price: Decimal
    brand: str | None
    manufacturer: str | None
    registration_no: str | None
    has_sn_tracking: bool
