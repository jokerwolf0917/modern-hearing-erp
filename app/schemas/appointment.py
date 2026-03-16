from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models import AppointmentStatus


class AppointmentCreate(BaseModel):
    store_id: UUID
    customer_id: UUID
    appointment_time: datetime
    type: str = Field(min_length=1, max_length=40)
    notes: str | None = Field(default=None, max_length=500)


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus


class AppointmentResponse(BaseModel):
    id: UUID
    store_id: UUID
    customer_id: UUID
    employee_id: UUID
    appointment_time: datetime
    type: str
    status: AppointmentStatus
    notes: str | None
    customer_name: str
    customer_phone: str
    employee_username: str
    store_name: str
    created_at: datetime
