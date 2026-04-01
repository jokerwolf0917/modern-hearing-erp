from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class FittingRecordCreate(BaseModel):
    customer_id: uuid.UUID
    store_id: uuid.UUID
    product_id: uuid.UUID | None = None
    fitting_date: date
    device_name: str | None = Field(default=None, max_length=255)
    fitting_notes: str | None = None
    result_summary: str | None = None
    created_by: uuid.UUID | None = None


class FittingRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID
    store_id: uuid.UUID
    product_id: uuid.UUID | None
    fitting_date: date
    device_name: str | None
    fitting_notes: str | None
    result_summary: str | None
    created_by: uuid.UUID | None
    created_at: datetime
