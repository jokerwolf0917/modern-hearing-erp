from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Customer, Employee, EmployeeRole, RepairRecord, RepairStatus, Store
from app.routers.deps import get_current_employee, require_admin
from app.schemas.repairs import RepairImportResult, RepairRecordCreate, RepairRecordResponse

router = APIRouter(prefix="/api/repairs", tags=["repairs"])


async def _resolve_store_scope(
    *,
    session: AsyncSession,
    current_employee: Employee,
    requested_store_id: uuid.UUID | None,
) -> uuid.UUID | None:
    if current_employee.role == EmployeeRole.ADMIN:
        if requested_store_id is None:
            return None
        if await session.get(Store, requested_store_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="门店不存在")
        return requested_store_id

    if current_employee.store_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号未绑定门店")

    if requested_store_id is not None and requested_store_id != current_employee.store_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能查看当前门店的维修记录")

    return current_employee.store_id


async def _get_store_by_name(session: AsyncSession, name: str) -> Store | None:
    stmt = select(Store).where(Store.name == name.strip())
    return await session.scalar(stmt)


async def _get_customer_by_identity(session: AsyncSession, name: str, phone: str) -> Customer | None:
    stmt = select(Customer).where(Customer.name == name.strip(), Customer.phone == phone.strip())
    return await session.scalar(stmt)


def _serialize_repair(repair: RepairRecord) -> RepairRecordResponse:
    customer = repair.customer
    store = repair.store
    handler = repair.handler
    return RepairRecordResponse(
        id=repair.id,
        customer_id=repair.customer_id,
        customer_name=customer.name if customer else "-",
        customer_phone=customer.phone if customer else "-",
        store_id=repair.store_id,
        store_name=store.name if store else "-",
        machine_model=repair.machine_model,
        receive_date=repair.receive_date,
        due_date=repair.due_date,
        issue_description=repair.issue_description,
        status=repair.status,
        handled_by=repair.handled_by,
        handled_by_name=handler.username if handler else None,
    )


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def _parse_status(value: str | None) -> RepairStatus:
    normalized = (value or "").strip().upper()
    if normalized in {"", "PENDING", "待修"}:
        return RepairStatus.PENDING
    if normalized in {"FACTORY", "返厂"}:
        return RepairStatus.FACTORY
    if normalized in {"DELIVERED", "已交付"}:
        return RepairStatus.DELIVERED
    return RepairStatus.PENDING


@router.get("", response_model=list[RepairRecordResponse], status_code=status.HTTP_200_OK)
async def get_repairs(
    search: str | None = Query(default=None),
    store_id: uuid.UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> list[RepairRecordResponse]:
    scoped_store_id = await _resolve_store_scope(
        session=session,
        current_employee=current_employee,
        requested_store_id=store_id,
    )

    stmt = (
        select(RepairRecord)
        .options(
            selectinload(RepairRecord.customer),
            selectinload(RepairRecord.store),
            selectinload(RepairRecord.handler),
        )
        .order_by(RepairRecord.due_date.asc(), RepairRecord.receive_date.asc())
    )

    if search:
        keyword = f"%{search.strip()}%"
        stmt = stmt.join(Customer, RepairRecord.customer_id == Customer.id).where(
            or_(
                Customer.name.ilike(keyword),
                Customer.phone.ilike(keyword),
                RepairRecord.machine_model.ilike(keyword),
            )
        )

    if scoped_store_id is not None:
        stmt = stmt.where(RepairRecord.store_id == scoped_store_id)

    result = await session.execute(stmt)
    repairs = result.scalars().unique().all()
    return [_serialize_repair(repair) for repair in repairs]


@router.post("", response_model=RepairRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_repair(
    payload: RepairRecordCreate,
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> RepairRecordResponse:
    customer = await session.get(Customer, payload.customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="客户不存在")

    scoped_store_id = await _resolve_store_scope(
        session=session,
        current_employee=current_employee,
        requested_store_id=payload.store_id,
    )
    if scoped_store_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请指定门店")

    duplicate_stmt = select(RepairRecord).where(
        RepairRecord.customer_id == payload.customer_id,
        RepairRecord.store_id == scoped_store_id,
        RepairRecord.machine_model == payload.machine_model.strip(),
        RepairRecord.receive_date == payload.receive_date,
        RepairRecord.due_date == payload.due_date,
    )
    if await session.scalar(duplicate_stmt) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该维修记录已存在，禁止重复录入")

    repair = RepairRecord(
        customer_id=payload.customer_id,
        store_id=scoped_store_id,
        machine_model=payload.machine_model.strip(),
        receive_date=payload.receive_date,
        due_date=payload.due_date,
        issue_description=payload.issue_description.strip() if payload.issue_description else None,
        status=payload.status,
        handled_by=payload.handled_by or current_employee.id,
    )
    session.add(repair)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该维修记录已存在，禁止重复录入") from exc
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建维修记录时发生数据库错误") from exc

    refreshed = await session.scalar(
        select(RepairRecord)
        .options(
            selectinload(RepairRecord.customer),
            selectinload(RepairRecord.store),
            selectinload(RepairRecord.handler),
        )
        .where(RepairRecord.id == repair.id)
    )
    if refreshed is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="维修记录创建后读取失败")
    return _serialize_repair(refreshed)


@router.post("/import", response_model=RepairImportResult, status_code=status.HTTP_200_OK)
async def import_repairs(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
) -> RepairImportResult:
    _ = current_employee
    content = await file.read()
    decoded = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))

    imported_count = 0
    skipped_count = 0

    for row in reader:
        customer_name = (row.get("customer_name") or row.get("客户姓名") or "").strip()
        customer_phone = (row.get("customer_phone") or row.get("电话") or "").strip()
        store_name = (row.get("store_name") or row.get("门店") or "").strip()
        machine_model = (row.get("machine_model") or row.get("机器型号") or "").strip()
        receive_date = _parse_date(row.get("receive_date") or row.get("送修日期"))
        due_date = _parse_date(row.get("due_date") or row.get("预计交付日"))
        issue_description = (row.get("issue_description") or row.get("故障描述") or "").strip() or None
        status = _parse_status(row.get("status") or row.get("状态"))

        if not all([customer_name, customer_phone, store_name, machine_model, receive_date, due_date]):
            skipped_count += 1
            continue

        customer = await _get_customer_by_identity(session, customer_name, customer_phone)
        store = await _get_store_by_name(session, store_name)
        if customer is None or store is None:
            skipped_count += 1
            continue

        duplicate_stmt = select(RepairRecord.id).where(
            RepairRecord.customer_id == customer.id,
            RepairRecord.store_id == store.id,
            RepairRecord.machine_model == machine_model,
            RepairRecord.receive_date == receive_date,
            RepairRecord.due_date == due_date,
        )
        if await session.scalar(duplicate_stmt) is not None:
            skipped_count += 1
            continue

        session.add(
            RepairRecord(
                customer_id=customer.id,
                store_id=store.id,
                machine_model=machine_model,
                receive_date=receive_date,
                due_date=due_date,
                issue_description=issue_description,
                status=status,
            )
        )
        imported_count += 1

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="批量导入维修记录失败") from exc

    return RepairImportResult(imported_count=imported_count, skipped_count=skipped_count)


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
async def export_repairs(
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
) -> StreamingResponse:
    _ = current_employee
    stmt = (
        select(RepairRecord)
        .options(
            selectinload(RepairRecord.customer),
            selectinload(RepairRecord.store),
            selectinload(RepairRecord.handler),
        )
        .order_by(RepairRecord.due_date.asc(), RepairRecord.receive_date.asc())
    )
    result = await session.execute(stmt)
    repairs = result.scalars().unique().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "customer_name",
        "customer_phone",
        "store_name",
        "machine_model",
        "receive_date",
        "due_date",
        "issue_description",
        "status",
        "handled_by_name",
    ])

    for repair in repairs:
        writer.writerow([
            repair.customer.name if repair.customer else "",
            repair.customer.phone if repair.customer else "",
            repair.store.name if repair.store else "",
            repair.machine_model,
            repair.receive_date.isoformat(),
            repair.due_date.isoformat(),
            repair.issue_description or "",
            repair.status.value,
            repair.handler.username if repair.handler else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="repairs.csv"'},
    )
