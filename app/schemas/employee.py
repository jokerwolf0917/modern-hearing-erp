import uuid

from pydantic import BaseModel, Field

from app.models import EmployeeRole


class EmployeeCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=6, max_length=128)
    role: EmployeeRole
    store_id: uuid.UUID | None = None


class EmployeeUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=80)
    role: EmployeeRole | None = None
    store_id: uuid.UUID | None = None


class EmployeeResponse(BaseModel):
    id: uuid.UUID
    username: str
    role: EmployeeRole
    store_id: uuid.UUID | None
    store_name: str | None
    is_active: bool


class EmployeePasswordReset(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)
