import uuid

from pydantic import BaseModel

from app.models import EmployeeRole


class EmployeeInfo(BaseModel):
    id: uuid.UUID
    username: str
    role: EmployeeRole
    store_id: uuid.UUID | None
    is_active: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    employee: EmployeeInfo
