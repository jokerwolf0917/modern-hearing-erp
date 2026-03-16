import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Appointment, AppointmentStatus, Customer, Employee, EmployeeRole, Store
from app.routers.deps import get_current_active_user
from app.schemas.appointment import AppointmentCreate, AppointmentResponse, AppointmentStatusUpdate


router = APIRouter(prefix="/api/appointments", tags=["appointments"])
BUSINESS_TIMEZONE = ZoneInfo("Australia/Sydney")
UTC = ZoneInfo("UTC")


def _to_storage_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=BUSINESS_TIMEZONE).astimezone(UTC).replace(tzinfo=None)
    return value.astimezone(UTC).replace(tzinfo=None)


def _to_response_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC).astimezone(BUSINESS_TIMEZONE)
    return value.astimezone(BUSINESS_TIMEZONE)


def _serialize_appointment(
    appointment: Appointment,
    customer_name: str,
    customer_phone: str,
    employee_username: str,
    store_name: str,
) -> AppointmentResponse:
    return AppointmentResponse(
        id=appointment.id,
        store_id=appointment.store_id,
        customer_id=appointment.customer_id,
        employee_id=appointment.employee_id,
        appointment_time=_to_response_datetime(appointment.appointment_time),
        type=appointment.type,
        status=appointment.status,
        notes=appointment.notes,
        customer_name=customer_name,
        customer_phone=customer_phone,
        employee_username=employee_username,
        store_name=store_name,
        created_at=_to_response_datetime(appointment.created_at),
    )


@router.get("", response_model=list[AppointmentResponse], status_code=status.HTTP_200_OK)
async def list_appointments(
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> list[AppointmentResponse]:
    try:
        normalized_start_time = _to_storage_datetime(start_time) if start_time is not None else None
        normalized_end_time = _to_storage_datetime(end_time) if end_time is not None else None

        stmt = (
            select(Appointment, Customer.name, Customer.phone, Employee.username, Store.name)
            .join(Customer, Customer.id == Appointment.customer_id)
            .join(Employee, Employee.id == Appointment.employee_id)
            .join(Store, Store.id == Appointment.store_id)
            .order_by(Appointment.appointment_time.asc(), Appointment.created_at.asc())
        )

        if normalized_start_time is not None:
            stmt = stmt.where(Appointment.appointment_time >= normalized_start_time)
        if normalized_end_time is not None:
            stmt = stmt.where(Appointment.appointment_time <= normalized_end_time)

        if current_user.role != EmployeeRole.ADMIN:
            if current_user.store_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Current user is not assigned to a store",
                )
            stmt = stmt.where(Appointment.store_id == current_user.store_id)

        result = await session.execute(stmt)
        return [
            _serialize_appointment(appointment, customer_name, customer_phone, employee_username, store_name)
            for appointment, customer_name, customer_phone, employee_username, store_name in result.all()
        ]
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading appointments.",
        )


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> AppointmentResponse:
    current_user_role = current_user.role
    current_user_store_id = current_user.store_id
    current_user_id = current_user.id
    current_user_username = current_user.username

    try:
        if session.in_transaction():
            await session.rollback()
        async with session.begin():
            if current_user_role != EmployeeRole.ADMIN:
                if current_user_store_id is None or current_user_store_id != payload.store_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You can only create appointments for your own store.",
                    )

            store = await session.get(Store, payload.store_id)
            if store is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

            customer = await session.get(Customer, payload.customer_id)
            if customer is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
            if customer.primary_store_id != payload.store_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Customer does not belong to the selected store.",
                )

            appointment = Appointment(
                store_id=payload.store_id,
                customer_id=payload.customer_id,
                employee_id=current_user_id,
                appointment_time=_to_storage_datetime(payload.appointment_time),
                type=payload.type.strip(),
                status=AppointmentStatus.PENDING,
                notes=payload.notes.strip() if payload.notes else None,
            )
            session.add(appointment)
            await session.flush()
            await session.refresh(appointment)

            return _serialize_appointment(
                appointment,
                customer_name=customer.name,
                customer_phone=customer.phone,
                employee_username=current_user_username,
                store_name=store.name,
            )
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating appointment.",
        )


@router.put("/{appointment_id}/status", response_model=AppointmentResponse, status_code=status.HTTP_200_OK)
async def update_appointment_status(
    appointment_id: uuid.UUID,
    payload: AppointmentStatusUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> AppointmentResponse:
    current_user_role = current_user.role
    current_user_store_id = current_user.store_id

    try:
        if session.in_transaction():
            await session.rollback()
        async with session.begin():
            result = await session.execute(
                select(Appointment, Customer.name, Customer.phone, Employee.username, Store.name)
                .join(Customer, Customer.id == Appointment.customer_id)
                .join(Employee, Employee.id == Appointment.employee_id)
                .join(Store, Store.id == Appointment.store_id)
                .where(Appointment.id == appointment_id)
            )
            row = result.one_or_none()
            if row is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

            appointment, customer_name, customer_phone, employee_username, store_name = row

            if current_user_role != EmployeeRole.ADMIN:
                if current_user_store_id is None or current_user_store_id != appointment.store_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You can only update appointments for your own store.",
                    )

            appointment.status = payload.status
            await session.flush()
            await session.refresh(appointment)

            return _serialize_appointment(
                appointment,
                customer_name=customer_name,
                customer_phone=customer_phone,
                employee_username=employee_username,
                store_name=store_name,
            )
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while updating appointment status.",
        )
