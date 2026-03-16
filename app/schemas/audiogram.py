import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class AudiogramCreate(BaseModel):
    test_date: date
    left_ear_data: dict[str, int] = Field(min_length=1)
    right_ear_data: dict[str, int] = Field(min_length=1)
    notes: str | None = Field(default=None, max_length=500)


class AudiogramRead(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    test_date: date
    left_ear_data: dict[str, int]
    right_ear_data: dict[str, int]
    notes: str | None
    created_at: datetime
