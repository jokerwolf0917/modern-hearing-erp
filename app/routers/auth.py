from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash, verify_password
from app.database import get_db
from app.models import Employee, EmployeeRole
from app.schemas.auth import EmployeeInfo, LoginResponse


router = APIRouter(prefix="/api/auth", tags=["auth"])


async def ensure_default_admin(session: AsyncSession) -> None:
    existing_admin = await session.scalar(select(Employee).where(Employee.username == "admin"))
    if existing_admin is not None:
        return

    session.add(
        Employee(
            username="admin",
            hashed_password=get_password_hash("admin"),
            role=EmployeeRole.ADMIN,
            store_id=None,
            is_active=True,
        )
    )
    await session.commit()


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_db),
) -> LoginResponse:
    try:
        employee = await session.scalar(select(Employee).where(Employee.username == form_data.username))
        if employee is None or not verify_password(form_data.password, employee.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")

        if not employee.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employee account is inactive")

        access_token = create_access_token(subject=str(employee.id))
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            employee=EmployeeInfo(
                id=employee.id,
                username=employee.username,
                role=employee.role,
                store_id=employee.store_id,
                is_active=employee.is_active,
            ),
        )
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while logging in.",
        )
