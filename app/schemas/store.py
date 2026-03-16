import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models import StoreType


class StoreCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    address: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=1, max_length=30)
    store_type: StoreType = StoreType.STREET


class StoreRead(BaseModel):
    id: uuid.UUID
    name: str
    address: str | None
    phone: str | None
    store_type: StoreType
    created_at: datetime
