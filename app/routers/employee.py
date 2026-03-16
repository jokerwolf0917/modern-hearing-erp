from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.database import get_db
from app.models import Employee, EmployeeRole, Store
from app.routers.deps import get_current_active_user
from app.schemas.employee import EmployeeCreate, EmployeePasswordReset, EmployeeResponse, EmployeeUpdate


router = APIRouter(prefix="/api/employees", tags=["employees"])


def _ensure_admin(current_user: Employee) -> None:
    if current_user.role != EmployeeRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can manage employees.",
        )


async def _get_employee_or_404(session: AsyncSession, employee_id: UUID) -> Employee:
    employee = await session.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")
    return employee


async def _validate_store_for_role(
    session: AsyncSession,
    role: EmployeeRole,
    store_id: UUID | None,
) -> UUID | None:
    if role == EmployeeRole.ADMIN:
        return None

    if store_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Store assignment is required for non-admin employees.",
        )

    store = await session.get(Store, store_id)
    if store is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store not found.",
        )
    return store.id


async def _build_employee_response(session: AsyncSession, employee: Employee) -> EmployeeResponse:
    store_name = None
    if employee.store_id is not None:
        store = await session.get(Store, employee.store_id)
        store_name = store.name if store is not None else None

    return EmployeeResponse(
        id=employee.id,
        username=employee.username,
        role=employee.role,
        store_id=employee.store_id,
        store_name=store_name,
        is_active=employee.is_active,
    )


@router.get("", response_model=list[EmployeeResponse], status_code=status.HTTP_200_OK)
async def list_employees(
    current_user: Employee = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
) -> list[EmployeeResponse]:
    _ensure_admin(current_user)

    try:
        result = await session.execute(
            select(Employee, Store.name.label("store_name"))
            .outerjoin(Store, Store.id == Employee.store_id)
            .order_by(Employee.username.asc())
        )
        rows = result.all()
        return [
            EmployeeResponse(
                id=employee.id,
                username=employee.username,
                role=employee.role,
                store_id=employee.store_id,
                store_name=store_name,
                is_active=employee.is_active,
            )
            for employee, store_name in rows
        ]
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading employees.",
        )


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    current_user: Employee = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    _ensure_admin(current_user)

    try:
        store_id = await _validate_store_for_role(session, payload.role, payload.store_id)
        employee = Employee(
            username=payload.username,
            hashed_password=get_password_hash(payload.password),
            role=payload.role,
            store_id=store_id,
            is_active=True,
        )
        session.add(employee)
        await session.commit()
        await session.refresh(employee)
        return await _build_employee_response(session, employee)
    except HTTPException:
        await session.rollback()
        raise
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists.",
        )
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating employee.",
        )


@router.put("/{employee_id}", response_model=EmployeeResponse, status_code=status.HTTP_200_OK)
async def update_employee(
    employee_id: UUID,
    payload: EmployeeUpdate,
    current_user: Employee = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    _ensure_admin(current_user)

    try:
        employee = await _get_employee_or_404(session, employee_id)
        update_data = payload.model_dump(exclude_unset=True)

        if (
            employee_id == current_user.id
            and "role" in update_data
            and update_data["role"] != EmployeeRole.ADMIN
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="安全拦截：您不能剥夺自己的超级管理员权限！",
            )

        if "username" in update_data and update_data["username"] is not None:
            employee.username = update_data["username"]

        next_role = update_data.get("role", employee.role)
        next_store_id = update_data.get("store_id", employee.store_id)
        employee.role = next_role
        employee.store_id = await _validate_store_for_role(session, next_role, next_store_id)

        await session.commit()
        await session.refresh(employee)
        return await _build_employee_response(session, employee)
    except HTTPException:
        await session.rollback()
        raise
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists.",
        )
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating employee.",
        )


@router.put("/{employee_id}/toggle-active", response_model=EmployeeResponse, status_code=status.HTTP_200_OK)
async def toggle_employee_active(
    employee_id: UUID,
    current_user: Employee = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
) -> EmployeeResponse:
    _ensure_admin(current_user)

    if employee_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="安全拦截：您不能禁用自己当前的管理员账号！",
        )

    try:
        employee = await _get_employee_or_404(session, employee_id)
        employee.is_active = not employee.is_active
        await session.commit()
        await session.refresh(employee)
        return await _build_employee_response(session, employee)
    except HTTPException:
        await session.rollback()
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating employee status.",
        )


@router.put("/{employee_id}/reset-password", status_code=status.HTTP_200_OK)
async def reset_employee_password(
    employee_id: UUID,
    payload: EmployeePasswordReset,
    current_user: Employee = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    _ensure_admin(current_user)

    try:
        employee = await _get_employee_or_404(session, employee_id)
        employee.hashed_password = get_password_hash(payload.new_password)
        await session.commit()
        return {"message": "Password reset successfully."}
    except HTTPException:
        await session.rollback()
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while resetting employee password.",
        )
