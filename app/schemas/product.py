from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    product_code: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=64)
    brand: str = Field(min_length=1, max_length=64)
    name_cn: str = Field(min_length=1, max_length=150)
    name_en: str | None = Field(default=None, max_length=150)
    specification: str | None = Field(default=None, max_length=255)
    matrix: str | None = Field(default=None, max_length=120)
    original_price: Decimal = Field(ge=0)
    unit: str | None = Field(default=None, max_length=30)
    remark: str | None = None


class ProductUpdate(ProductCreate):
    pass


class ProductRead(BaseModel):
    id: uuid.UUID
    product_code: str
    category: str
    category_display: str
    brand: str
    brand_display: str
    name_cn: str
    name_en: str | None
    specification: str | None
    matrix: str | None
    original_price: Decimal
    unit: str | None
    remark: str | None
    created_at: datetime


class ProductImportResult(BaseModel):
    imported_count: int
    skipped_count: int
