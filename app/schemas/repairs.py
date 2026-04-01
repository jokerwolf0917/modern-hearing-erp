from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, Field

from app.models import RepairStatus


class RepairRecordCreate(BaseModel):
    customer_id: uuid.UUID
    store_id: uuid.UUID
    machine_model: str = Field(min_length=1, max_length=255)
    receive_date: date
    due_date: date
    issue_description: str | None = None
    status: RepairStatus = RepairStatus.PENDING
    handled_by: uuid.UUID | None = None


class RepairRecordResponse(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    customer_phone: str
    store_id: uuid.UUID
    store_name: str
    machine_model: str
    receive_date: date
    due_date: date
    issue_description: str | None
    status: RepairStatus
    handled_by: uuid.UUID | None
    handled_by_name: str | None


class RepairImportResult(BaseModel):
    imported_count: int
    skipped_count: int
