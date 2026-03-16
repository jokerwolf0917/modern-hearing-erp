import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


GenderType = Literal["\u7537", "\u5973", "\u672a\u77e5"]
HearingLossType = Literal[
    "\u6b63\u5e38",
    "\u8f7b\u5ea6",
    "\u4e2d\u5ea6",
    "\u91cd\u5ea6",
    "\u6781\u91cd\u5ea6",
]


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=3, max_length=30)
    age: int = Field(ge=0, le=120)
    gender: GenderType
    hearing_loss_type: HearingLossType


class CustomerRead(BaseModel):
    id: uuid.UUID
    name: str
    phone: str
    age: int | None
    gender: str | None
    hearing_loss_type: str | None
    created_at: datetime


class CustomerListResponse(BaseModel):
    items: list[CustomerRead]
    total: int
    page: int
    page_size: int
