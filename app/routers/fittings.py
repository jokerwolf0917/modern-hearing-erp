from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Customer, Employee, FittingRecord, Product, Store
from app.routers.deps import get_current_employee
from app.schemas.fittings import FittingRecordCreate, FittingRecordResponse


router = APIRouter(prefix="/api/fittings", tags=["fittings"])


@router.post("", response_model=FittingRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_fitting_record(
    payload: FittingRecordCreate,
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> FittingRecordResponse:
    normalized_device_name = payload.device_name.strip() if payload.device_name else None

    if await session.get(Customer, payload.customer_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="客户不存在")
    if await session.get(Store, payload.store_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="门店不存在")
    if payload.product_id is not None and await session.get(Product, payload.product_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")

    duplicate_stmt = select(FittingRecord).where(
        FittingRecord.customer_id == payload.customer_id,
        FittingRecord.store_id == payload.store_id,
        FittingRecord.product_id == payload.product_id,
        FittingRecord.device_name == normalized_device_name,
        FittingRecord.fitting_date == payload.fitting_date,
    )
    if await session.scalar(duplicate_stmt) is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该验配记录已存在，禁止重复录入",
        )

    fitting_record = FittingRecord(
        customer_id=payload.customer_id,
        store_id=payload.store_id,
        product_id=payload.product_id,
        fitting_date=payload.fitting_date,
        device_name=normalized_device_name,
        fitting_notes=payload.fitting_notes.strip() if payload.fitting_notes else None,
        result_summary=payload.result_summary.strip() if payload.result_summary else None,
        created_by=payload.created_by or current_employee.id,
    )
    session.add(fitting_record)

    try:
        await session.commit()
        await session.refresh(fitting_record)
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该验配记录已存在，禁止重复录入",
        ) from exc
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建验配记录时发生数据库错误",
        ) from exc

    return FittingRecordResponse.model_validate(fitting_record)


@router.get("", response_model=list[FittingRecordResponse], status_code=status.HTTP_200_OK)
async def list_fittings(
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> list[FittingRecordResponse]:
    _ = current_employee

    result = await session.execute(
        select(FittingRecord)
        .options(
            selectinload(FittingRecord.product),
            selectinload(FittingRecord.store),
            selectinload(FittingRecord.creator),
        )
        .order_by(FittingRecord.fitting_date.desc(), FittingRecord.created_at.desc())
    )
    records = result.scalars().all()
    return [FittingRecordResponse.model_validate(record) for record in records]


@router.get("/customer/{customer_id}", response_model=list[FittingRecordResponse], status_code=status.HTTP_200_OK)
async def list_customer_fittings(
    customer_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> list[FittingRecordResponse]:
    _ = current_employee

    result = await session.execute(
        select(FittingRecord)
        .where(FittingRecord.customer_id == customer_id)
        .order_by(FittingRecord.fitting_date.desc(), FittingRecord.created_at.desc())
    )
    records = result.scalars().all()
    return [FittingRecordResponse.model_validate(record) for record in records]
