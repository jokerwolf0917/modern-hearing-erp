from __future__ import annotations

import csv
import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.catalog import brand_display, category_display
from app.database import get_db
from app.models import (
    Customer,
    Employee,
    EmployeeRole,
    FittingRecord,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    RepairRecord,
    StockTransaction,
    Store,
    TransactionType,
)
from app.routers.deps import get_current_employee, require_admin
from app.schemas.customers import (
    CustomerCreate,
    CustomerDetailResponse,
    CustomerImportResult,
    CustomerListResponse,
    CustomerResponse,
    CustomerSaleRecordCreate,
    CustomerUpdate,
    FittingRecordResponse,
    RepairRecordResponse,
    StockTransactionResponse,
)

router = APIRouter(prefix="/api/customers", tags=["customers"])


def _normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


async def _ensure_store_exists(session: AsyncSession, store_id: uuid.UUID) -> Store:
    store = await session.get(Store, store_id)
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="门店不存在")
    return store


async def _resolve_store_scope(
    *,
    session: AsyncSession,
    current_employee: Employee,
    requested_store_id: uuid.UUID | None,
) -> uuid.UUID | None:
    if current_employee.role == EmployeeRole.ADMIN:
        if requested_store_id is None:
            return None
        await _ensure_store_exists(session, requested_store_id)
        return requested_store_id

    if current_employee.store_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号未绑定门店")

    if requested_store_id is not None and requested_store_id != current_employee.store_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能操作当前门店的数据")

    return current_employee.store_id


def _serialize_customer(customer: Customer) -> CustomerResponse:
    return CustomerResponse(
        id=customer.id,
        name=customer.name,
        phone=customer.phone,
        gender=customer.gender,
        birth_date=customer.birth_date,
        address=customer.address,
        primary_store_id=customer.primary_store_id,
        primary_store_name=customer.primary_store.name if customer.primary_store else None,
        created_at=customer.created_at,
    )


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> CustomerResponse:
    primary_store_id = await _resolve_store_scope(
        session=session,
        current_employee=current_employee,
        requested_store_id=payload.primary_store_id,
    )

    customer = Customer(
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        gender=_normalize_text(payload.gender),
        birth_date=payload.birth_date,
        address=_normalize_text(payload.address),
        primary_store_id=primary_store_id,
    )
    session.add(customer)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该客户已存在（姓名、电话、性别、生日完全一致），禁止重复录入",
        ) from exc
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建客户时发生数据库错误",
        ) from exc

    await session.refresh(customer, attribute_names=["primary_store"])
    return _serialize_customer(customer)


@router.put("/{customer_id}", response_model=CustomerResponse, status_code=status.HTTP_200_OK)
async def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> CustomerResponse:
    customer = await session.get(Customer, customer_id, options=[selectinload(Customer.primary_store)])
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="客户不存在")

    requested_store_id = payload.primary_store_id if payload.primary_store_id is not None else customer.primary_store_id
    primary_store_id = await _resolve_store_scope(
        session=session,
        current_employee=current_employee,
        requested_store_id=requested_store_id,
    )

    customer.name = payload.name.strip()
    customer.phone = payload.phone.strip()
    customer.gender = _normalize_text(payload.gender)
    customer.birth_date = payload.birth_date
    customer.address = _normalize_text(payload.address)
    customer.primary_store_id = primary_store_id

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该客户已存在（姓名、电话、性别、生日完全一致），禁止重复录入",
        ) from exc
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新客户资料时发生数据库错误",
        ) from exc

    await session.refresh(customer, attribute_names=["primary_store"])
    return _serialize_customer(customer)


@router.get("", response_model=CustomerListResponse, status_code=status.HTTP_200_OK)
async def list_customers(
    q: str | None = Query(default=None, description="Search by name or phone"),
    store_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> CustomerListResponse:
    scoped_store_id = await _resolve_store_scope(
        session=session,
        current_employee=current_employee,
        requested_store_id=store_id,
    )

    filters: list[object] = []
    if q:
        keyword = f"%{q.strip()}%"
        filters.append(or_(Customer.name.ilike(keyword), Customer.phone.ilike(keyword)))
    if scoped_store_id is not None:
        filters.append(Customer.primary_store_id == scoped_store_id)

    count_stmt = select(func.count(Customer.id))
    data_stmt = select(Customer).options(selectinload(Customer.primary_store)).order_by(Customer.created_at.desc())

    if filters:
        count_stmt = count_stmt.where(*filters)
        data_stmt = data_stmt.where(*filters)

    total = await session.scalar(count_stmt)
    result = await session.execute(data_stmt.offset((page - 1) * page_size).limit(page_size))
    customers = result.scalars().all()

    return CustomerListResponse(
        items=[_serialize_customer(customer) for customer in customers],
        total=int(total or 0),
        page=page,
        page_size=page_size,
    )


@router.get("/{customer_id}/details", response_model=CustomerDetailResponse, status_code=status.HTTP_200_OK)
async def get_customer_details(
    customer_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> CustomerDetailResponse:
    stmt = (
        select(Customer)
        .options(
            selectinload(Customer.primary_store),
            selectinload(Customer.stock_transactions).selectinload(StockTransaction.store),
            selectinload(Customer.stock_transactions).selectinload(StockTransaction.product),
            selectinload(Customer.stock_transactions).selectinload(StockTransaction.handler),
            selectinload(Customer.repairs).selectinload(RepairRecord.store),
            selectinload(Customer.repairs).selectinload(RepairRecord.handler),
            selectinload(Customer.fitting_records).selectinload(FittingRecord.store),
            selectinload(Customer.fitting_records).selectinload(FittingRecord.product),
            selectinload(Customer.fitting_records).selectinload(FittingRecord.creator),
        )
        .where(Customer.id == customer_id)
    )
    customer = await session.scalar(stmt)

    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="客户不存在")

    if (
        current_employee.role != EmployeeRole.ADMIN
        and current_employee.store_id is not None
        and customer.primary_store_id not in {None, current_employee.store_id}
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能查看当前门店的客户")

    transactions = [
        StockTransactionResponse(
            id=transaction.id,
            transaction_date=transaction.transaction_date,
            store_id=transaction.store_id,
            store_name=transaction.store.name,
            product_id=transaction.product_id,
            product_code=transaction.product.product_code,
            category=transaction.product.category.name,
            category_display=category_display(transaction.product.category),
            brand=transaction.product.brand.name,
            brand_display=brand_display(transaction.product.brand),
            product_name=transaction.product.name_cn,
            product_name_en=transaction.product.name_en,
            specification=transaction.product.specification,
            original_price=transaction.product.original_price,
            type=transaction.type,
            quantity=transaction.quantity,
            unit_price=transaction.unit_price,
            handled_by=transaction.handled_by,
            handled_by_name=transaction.handler.username if transaction.handler else None,
            target=transaction.target,
            remark=transaction.remark,
        )
        for transaction in sorted(customer.stock_transactions, key=lambda item: item.transaction_date, reverse=True)
        if transaction.type == TransactionType.SALE
    ]

    repairs = [
        RepairRecordResponse(
            id=repair.id,
            customer_id=repair.customer_id,
            store_id=repair.store_id,
            store_name=repair.store.name,
            machine_model=repair.machine_model,
            receive_date=repair.receive_date,
            due_date=repair.due_date,
            issue_description=repair.issue_description,
            status=repair.status,
            handled_by=repair.handled_by,
            handled_by_name=repair.handler.username if repair.handler else None,
        )
        for repair in sorted(customer.repairs, key=lambda item: item.due_date)
    ]

    fitting_records = [
        FittingRecordResponse(
            id=fitting.id,
            customer_id=fitting.customer_id,
            store_id=fitting.store_id,
            store_name=fitting.store.name,
            product_id=fitting.product_id,
            product_name=fitting.product.name_cn if fitting.product else None,
            fitting_date=fitting.fitting_date,
            device_name=fitting.device_name,
            fitting_notes=fitting.fitting_notes,
            result_summary=fitting.result_summary,
            created_by=fitting.created_by,
            created_by_name=fitting.creator.username if fitting.creator else None,
        )
        for fitting in sorted(customer.fitting_records, key=lambda item: item.fitting_date, reverse=True)
    ]

    base = _serialize_customer(customer)
    return CustomerDetailResponse(
        **base.model_dump(),
        transactions=transactions,
        repairs=repairs,
        fitting_records=fitting_records,
    )


@router.post("/{customer_id}/sales-records", response_model=StockTransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_customer_sale_record(
    customer_id: uuid.UUID,
    payload: CustomerSaleRecordCreate,
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
) -> StockTransactionResponse:
    customer = await session.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="客户不存在")

    scoped_store_id = await _resolve_store_scope(
        session=session,
        current_employee=current_employee,
        requested_store_id=payload.store_id,
    )
    if scoped_store_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请指定门店")

    store = await _ensure_store_exists(session, scoped_store_id)
    product = await session.get(Product, payload.product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")

    duplicate_stmt = select(StockTransaction).where(
        StockTransaction.customer_id == customer_id,
        StockTransaction.store_id == scoped_store_id,
        StockTransaction.product_id == payload.product_id,
        StockTransaction.type == TransactionType.SALE,
        StockTransaction.transaction_date == payload.transaction_date,
        StockTransaction.quantity == payload.quantity,
        StockTransaction.unit_price == payload.unit_price,
    )
    if await session.scalar(duplicate_stmt) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该持有设备记录已存在，禁止重复录入")

    order = Order(
        customer_id=customer_id,
        store_id=scoped_store_id,
        total_amount=payload.unit_price * payload.quantity,
        status=OrderStatus.PAID,
        created_at=payload.transaction_date.replace(tzinfo=None),
    )
    session.add(order)
    await session.flush()

    session.add(
        OrderItem(
            order_id=order.id,
            product_id=payload.product_id,
            quantity=payload.quantity,
            unit_price=payload.unit_price,
        )
    )

    transaction = StockTransaction(
        transaction_date=payload.transaction_date,
        store_id=scoped_store_id,
        product_id=payload.product_id,
        customer_id=customer_id,
        type=TransactionType.SALE,
        quantity=payload.quantity,
        unit_price=payload.unit_price,
        handled_by=current_employee.id,
        target=customer.name,
        remark=_normalize_text(payload.remark),
    )
    session.add(transaction)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该持有设备记录已存在，禁止重复录入") from exc
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="补录持有设备记录时发生数据库错误",
        ) from exc

    await session.refresh(transaction)
    return StockTransactionResponse(
        id=transaction.id,
        transaction_date=transaction.transaction_date,
        store_id=transaction.store_id,
        store_name=store.name,
        product_id=transaction.product_id,
        product_code=product.product_code,
        category=product.category.name,
        category_display=category_display(product.category),
        brand=product.brand.name,
        brand_display=brand_display(product.brand),
        product_name=product.name_cn,
        product_name_en=product.name_en,
        specification=product.specification,
        original_price=product.original_price,
        type=transaction.type,
        quantity=transaction.quantity,
        unit_price=transaction.unit_price,
        handled_by=transaction.handled_by,
        handled_by_name=current_employee.username,
        target=transaction.target,
        remark=transaction.remark,
    )


@router.post("/import", response_model=CustomerImportResult, status_code=status.HTTP_200_OK)
async def import_customers(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
) -> CustomerImportResult:
    _ = current_employee

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅支持 CSV 文件")

    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    imported_count = 0
    skipped_count = 0

    for row in reader:
        name = (row.get("name") or row.get("客户姓名") or "").strip()
        phone = (row.get("phone") or row.get("手机号码") or row.get("电话") or "").strip()
        gender = (row.get("gender") or row.get("性别") or "").strip() or None
        address = (row.get("address") or row.get("地址") or "").strip() or None
        birth_date_raw = (row.get("birth_date") or row.get("生日") or row.get("出生日期") or "").strip()

        if not name or not phone:
            skipped_count += 1
            continue

        birth_date_value: date | None = None
        if birth_date_raw:
            try:
                birth_date_value = date.fromisoformat(birth_date_raw)
            except ValueError:
                skipped_count += 1
                continue

        try:
            async with session.begin_nested():
                session.add(
                    Customer(
                        name=name,
                        phone=phone,
                        gender=gender,
                        birth_date=birth_date_value,
                        address=address,
                    )
                )
                await session.flush()
            imported_count += 1
        except IntegrityError:
            skipped_count += 1

    try:
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导入客户时发生数据库错误",
        ) from exc

    return CustomerImportResult(imported_count=imported_count, skipped_count=skipped_count)


@router.get("/export", response_class=StreamingResponse, status_code=status.HTTP_200_OK)
async def export_customers(
    session: AsyncSession = Depends(get_db),
    current_employee: Employee = Depends(require_admin),
) -> StreamingResponse:
    _ = current_employee

    result = await session.execute(
        select(Customer)
        .options(selectinload(Customer.primary_store))
        .order_by(Customer.created_at.desc())
    )
    customers = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["客户姓名", "电话", "性别", "生日", "地址", "所属门店", "建档时间"])

    for customer in customers:
        writer.writerow(
            [
                customer.name,
                customer.phone,
                customer.gender or "",
                customer.birth_date.isoformat() if customer.birth_date else "",
                customer.address or "",
                customer.primary_store.name if customer.primary_store else "",
                customer.created_at.isoformat(),
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="customers.csv"'},
    )
