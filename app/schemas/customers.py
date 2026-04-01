from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import RepairStatus, TransactionType


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=1, max_length=30)
    gender: str | None = Field(default=None, max_length=20)
    birth_date: date | None = None
    address: str | None = Field(default=None, max_length=255)
    primary_store_id: uuid.UUID | None = None


class CustomerUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=1, max_length=30)
    gender: str | None = Field(default=None, max_length=20)
    birth_date: date | None = None
    address: str | None = Field(default=None, max_length=255)
    primary_store_id: uuid.UUID | None = None


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str
    gender: str | None
    birth_date: date | None
    address: str | None
    primary_store_id: uuid.UUID | None = None
    primary_store_name: str | None = None
    created_at: datetime


class StockTransactionResponse(BaseModel):
    id: uuid.UUID
    transaction_date: datetime
    store_id: uuid.UUID
    store_name: str
    product_id: uuid.UUID
    product_code: str
    category: str
    category_display: str
    brand: str
    brand_display: str
    product_name: str
    product_name_en: str | None
    specification: str | None
    original_price: Decimal
    type: TransactionType
    quantity: int
    unit_price: Decimal | None
    handled_by: uuid.UUID | None
    handled_by_name: str | None
    target: str | None
    remark: str | None


class RepairRecordResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    store_id: uuid.UUID
    store_name: str
    machine_model: str
    receive_date: date
    due_date: date
    issue_description: str | None
    status: RepairStatus
    handled_by: uuid.UUID | None
    handled_by_name: str | None


class FittingRecordResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    store_id: uuid.UUID
    store_name: str
    product_id: uuid.UUID | None
    product_name: str | None
    fitting_date: date
    device_name: str | None
    fitting_notes: str | None
    result_summary: str | None
    created_by: uuid.UUID | None
    created_by_name: str | None


class CustomerDetailResponse(CustomerResponse):
    transactions: list[StockTransactionResponse]
    repairs: list[RepairRecordResponse]
    fitting_records: list[FittingRecordResponse]


class CustomerListResponse(BaseModel):
    items: list[CustomerResponse]
    total: int
    page: int
    page_size: int


class CustomerImportResult(BaseModel):
    imported_count: int
    skipped_count: int


class CustomerSaleRecordCreate(BaseModel):
    store_id: uuid.UUID
    product_id: uuid.UUID
    transaction_date: datetime
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(gt=0)
    remark: str | None = Field(default=None, max_length=255)
