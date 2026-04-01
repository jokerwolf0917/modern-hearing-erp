from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.catalog import brand_display, category_display
from app.database import get_db
from app.models import (
    Employee,
    EmployeeRole,
    Inventory,
    InventoryLedger,
    InventorySummary,
    Product,
    StockTransaction,
    Store,
    TransactionType,
    Transfer,
    TransferStatus,
)
from app.routers.deps import get_current_active_user


router = APIRouter(prefix="/api/inventory", tags=["inventory"])


class StockInRequest(BaseModel):
    store_id: uuid.UUID
    product_id: uuid.UUID
    quantity: int = Field(gt=0)
    transaction_date: datetime | None = None
    remark: str | None = None


class TransferRequest(BaseModel):
    from_store_id: uuid.UUID
    to_store_id: uuid.UUID
    product_id: uuid.UUID
    quantity: int = Field(gt=0)
    transaction_date: datetime | None = None
    remark: str | None = None

    @model_validator(mode="after")
    def validate_store_pair(self) -> "TransferRequest":
        if self.from_store_id == self.to_store_id:
            raise ValueError("from_store_id and to_store_id cannot be the same")
        return self


class StockInResponse(BaseModel):
    inventory_id: uuid.UUID
    store_id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    ledger_id: uuid.UUID


class TransferResponse(BaseModel):
    transfer_id: uuid.UUID
    from_store_id: uuid.UUID
    to_store_id: uuid.UUID
    product_id: uuid.UUID
    quantity: int
    status: TransferStatus
    remaining_stock: int
    ledger_id: uuid.UUID


class StockSummaryItem(BaseModel):
    inventory_id: uuid.UUID
    store_id: uuid.UUID
    store_name: str
    product_id: uuid.UUID
    product_code: str
    category: str
    category_display: str
    brand: str
    brand_display: str
    name_cn: str
    name_en: str | None
    specification: str | None
    original_price: Decimal
    quantity: int
    unit: str | None


class InventoryLedgerRow(BaseModel):
    inventory_id: uuid.UUID
    store_id: uuid.UUID
    store_name: str
    product_id: uuid.UUID
    product_code: str
    category: str
    category_display: str
    brand: str
    brand_display: str
    name_cn: str
    name_en: str | None
    specification: str | None
    original_price: Decimal
    last_month_stock: int
    in_this_month: int
    out_this_month: int
    sales_this_month: int
    expected_stock: int
    actual_stock: int
    unit: str | None
    remark: str | None


class LedgerHistoryItem(BaseModel):
    ledger_id: uuid.UUID
    created_at: datetime
    store_id: uuid.UUID
    store_name: str
    product_id: uuid.UUID
    product_code: str
    product_name: str
    reference_type: str
    change_amount: int
    quantity_before: int
    quantity_after: int


class DashboardMetrics(BaseModel):
    total_inventory_items: int
    today_stock_in_count: int
    today_transfer_count: int
    low_stock_warning_count: int


class ClearDirtyDataRequest(BaseModel):
    store_id: uuid.UUID


async def _ensure_store_exists(session: AsyncSession, store_id: uuid.UUID, detail: str) -> Store:
    store = await session.get(Store, store_id)
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return store


async def _ensure_product_exists(session: AsyncSession, product_id: uuid.UUID) -> Product:
    product = await session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")
    return product


async def _get_or_create_inventory(
    session: AsyncSession,
    store_id: uuid.UUID,
    product_id: uuid.UUID,
) -> Inventory:
    result = await session.execute(
        select(Inventory).where(
            Inventory.store_id == store_id,
            Inventory.product_id == product_id,
        )
    )
    inventory = result.scalar_one_or_none()
    if inventory is None:
        inventory = Inventory(store_id=store_id, product_id=product_id, quantity=0)
        session.add(inventory)
        await session.flush()
    return inventory


async def _load_summary_map(
    session: AsyncSession,
    store_ids: list[uuid.UUID],
    product_ids: list[uuid.UUID],
) -> dict[tuple[uuid.UUID, uuid.UUID], InventorySummary]:
    if not store_ids or not product_ids:
        return {}

    result = await session.execute(
        select(InventorySummary)
        .where(InventorySummary.store_id.in_(store_ids), InventorySummary.product_id.in_(product_ids))
        .order_by(InventorySummary.month_year.desc(), InventorySummary.created_at.desc())
    )
    summaries = result.scalars().all()
    summary_map: dict[tuple[uuid.UUID, uuid.UUID], InventorySummary] = {}
    for summary in summaries:
        key = (summary.store_id, summary.product_id)
        summary_map.setdefault(key, summary)
    return summary_map


@router.post("/stock-in", response_model=StockInResponse, status_code=status.HTTP_201_CREATED)
async def stock_in(
    payload: StockInRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> StockInResponse:
    current_time = payload.transaction_date or datetime.now(timezone.utc)

    for attempt in range(2):
        try:
            async with session.begin():
                store = await _ensure_store_exists(session, payload.store_id, "门店不存在")
                product = await _ensure_product_exists(session, payload.product_id)

                inventory = await _get_or_create_inventory(session, payload.store_id, payload.product_id)
                inventory.quantity += payload.quantity
                await session.flush()

                ledger = InventoryLedger(
                    store_id=payload.store_id,
                    product_id=payload.product_id,
                    change_amount=payload.quantity,
                    reference_type="inbound",
                )
                session.add(ledger)
                session.add(
                    StockTransaction(
                        transaction_date=current_time,
                        store_id=payload.store_id,
                        product_id=payload.product_id,
                        type=TransactionType.INBOUND,
                        quantity=payload.quantity,
                        unit_price=None,
                        handled_by=current_user.id,
                        target=store.name,
                        remark=payload.remark or f"{product.name_cn} 入库",
                    )
                )
                await session.flush()

                return StockInResponse(
                    inventory_id=inventory.id,
                    store_id=inventory.store_id,
                    product_id=inventory.product_id,
                    quantity=inventory.quantity,
                    ledger_id=ledger.id,
                )
        except IntegrityError:
            await session.rollback()
            if attempt == 0:
                continue
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="入库时发生并发写入冲突")
        except HTTPException:
            raise
        except SQLAlchemyError:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="入库时发生数据库错误")

    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="入库失败")


@router.post("/transfer", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    payload: TransferRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> TransferResponse:
    transaction_time = payload.transaction_date or datetime.now(timezone.utc)

    try:
        async with session.begin():
            from_store = await _ensure_store_exists(session, payload.from_store_id, "调出门店不存在")
            to_store = await _ensure_store_exists(session, payload.to_store_id, "调入门店不存在")
            product = await _ensure_product_exists(session, payload.product_id)

            result = await session.execute(
                select(Inventory)
                .where(
                    Inventory.store_id == payload.from_store_id,
                    Inventory.product_id == payload.product_id,
                )
                .with_for_update()
            )
            source_inventory = result.scalar_one_or_none()

            if source_inventory is None or source_inventory.quantity < payload.quantity:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="调出门店库存不足")

            source_inventory.quantity -= payload.quantity
            target_inventory = await _get_or_create_inventory(session, payload.to_store_id, payload.product_id)
            target_inventory.quantity += payload.quantity
            await session.flush()

            transfer = Transfer(
                from_store_id=payload.from_store_id,
                to_store_id=payload.to_store_id,
                product_id=payload.product_id,
                quantity=payload.quantity,
                status=TransferStatus.COMPLETED,
            )
            session.add(transfer)

            ledger = InventoryLedger(
                store_id=payload.from_store_id,
                product_id=payload.product_id,
                change_amount=-payload.quantity,
                reference_type="outbound",
            )
            session.add(ledger)
            session.add(
                InventoryLedger(
                    store_id=payload.to_store_id,
                    product_id=payload.product_id,
                    change_amount=payload.quantity,
                    reference_type="inbound",
                )
            )

            session.add(
                StockTransaction(
                    transaction_date=transaction_time,
                    store_id=payload.from_store_id,
                    product_id=payload.product_id,
                    type=TransactionType.OUTBOUND,
                    quantity=payload.quantity,
                    unit_price=None,
                    handled_by=current_user.id,
                    target=to_store.name,
                    remark=payload.remark or f"{product.name_cn} 调拨出库",
                )
            )
            session.add(
                StockTransaction(
                    transaction_date=transaction_time,
                    store_id=payload.to_store_id,
                    product_id=payload.product_id,
                    type=TransactionType.INBOUND,
                    quantity=payload.quantity,
                    unit_price=None,
                    handled_by=current_user.id,
                    target=from_store.name,
                    remark=payload.remark or f"{product.name_cn} 调拨入库",
                )
            )
            await session.flush()

            return TransferResponse(
                transfer_id=transfer.id,
                from_store_id=transfer.from_store_id,
                to_store_id=transfer.to_store_id,
                product_id=transfer.product_id,
                quantity=transfer.quantity,
                status=transfer.status,
                remaining_stock=source_inventory.quantity,
                ledger_id=ledger.id,
            )
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="调拨时发生数据库错误")


@router.get("/ledger", response_model=list[InventoryLedgerRow], status_code=status.HTTP_200_OK)
async def get_inventory_ledger(
    store_id: uuid.UUID | None = Query(default=None),
    product_name: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> list[InventoryLedgerRow]:
    try:
        stmt = (
            select(Inventory, Store, Product)
            .join(Store, Store.id == Inventory.store_id)
            .join(Product, Product.id == Inventory.product_id)
            .order_by(Store.name.asc(), Product.brand.asc(), Product.category.asc(), Product.product_code.asc())
        )

        if current_user.role != EmployeeRole.ADMIN:
            if current_user.store_id is None:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号未绑定门店")
            stmt = stmt.where(Store.id == current_user.store_id)
        elif store_id is not None:
            stmt = stmt.where(Store.id == store_id)

        normalized_product_name = (product_name or "").strip()
        if normalized_product_name:
            stmt = stmt.where(func.lower(Product.name_cn).like(f"%{normalized_product_name.lower()}%"))

        rows = (await session.execute(stmt)).all()
        store_ids = [store.id for _, store, _ in rows]
        product_ids = [product.id for _, _, product in rows]
        summary_map = await _load_summary_map(session, store_ids, product_ids)

        return [
            InventoryLedgerRow(
                inventory_id=inventory.id,
                store_id=store.id,
                store_name=store.name,
                product_id=product.id,
                product_code=product.product_code,
                category=product.category.name,
                category_display=category_display(product.category),
                brand=product.brand.name,
                brand_display=brand_display(product.brand),
                name_cn=product.name_cn,
                name_en=product.name_en,
                specification=product.specification,
                original_price=product.original_price,
                last_month_stock=summary_map.get((store.id, product.id)).last_month_stock if summary_map.get((store.id, product.id)) else 0,
                in_this_month=summary_map.get((store.id, product.id)).in_this_month if summary_map.get((store.id, product.id)) else 0,
                out_this_month=summary_map.get((store.id, product.id)).out_this_month if summary_map.get((store.id, product.id)) else 0,
                sales_this_month=summary_map.get((store.id, product.id)).sales_this_month if summary_map.get((store.id, product.id)) else 0,
                expected_stock=summary_map.get((store.id, product.id)).expected_stock if summary_map.get((store.id, product.id)) else inventory.quantity,
                actual_stock=summary_map.get((store.id, product.id)).actual_stock if summary_map.get((store.id, product.id)) else inventory.quantity,
                unit=product.unit,
                remark=product.remark,
            )
            for inventory, store, product in rows
        ]
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="加载库存台账时发生数据库错误")


@router.get("", response_model=list[StockSummaryItem], status_code=status.HTTP_200_OK)
@router.get("/stock-summary", response_model=list[StockSummaryItem], status_code=status.HTTP_200_OK)
async def get_stock_summary(
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> list[StockSummaryItem]:
    try:
        stmt = (
            select(Inventory, Store, Product)
            .join(Store, Store.id == Inventory.store_id)
            .join(Product, Product.id == Inventory.product_id)
            .order_by(Store.name.asc(), Product.brand.asc(), Product.category.asc(), Product.product_code.asc())
        )

        if current_user.role != EmployeeRole.ADMIN:
            if current_user.store_id is None:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号未绑定门店")
            stmt = stmt.where(Store.id == current_user.store_id)

        result = await session.execute(stmt)
        return [
            StockSummaryItem(
                inventory_id=inventory.id,
                store_id=store.id,
                store_name=store.name,
                product_id=product.id,
                product_code=product.product_code,
                category=product.category.name,
                category_display=category_display(product.category),
                brand=product.brand.name,
                brand_display=brand_display(product.brand),
                name_cn=product.name_cn,
                name_en=product.name_en,
                specification=product.specification,
                original_price=product.original_price,
                quantity=inventory.quantity,
                unit=product.unit,
            )
            for inventory, store, product in result.all()
        ]
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="加载库存汇总时发生数据库错误")


@router.get("/ledger-history", response_model=list[LedgerHistoryItem], status_code=status.HTTP_200_OK)
async def get_ledger_history(
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> list[LedgerHistoryItem]:
    try:
        stmt = (
            select(InventoryLedger, Store, Product)
            .join(Store, Store.id == InventoryLedger.store_id)
            .join(Product, Product.id == InventoryLedger.product_id)
            .order_by(InventoryLedger.created_at.asc(), InventoryLedger.id.asc())
        )

        if current_user.role != EmployeeRole.ADMIN:
            if current_user.store_id is None:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号未绑定门店")
            stmt = stmt.where(Store.id == current_user.store_id)

        result = await session.execute(stmt)
        running_totals: dict[tuple[uuid.UUID, uuid.UUID], int] = {}
        history: list[LedgerHistoryItem] = []

        for ledger, store, product in result.all():
            key = (ledger.store_id, ledger.product_id)
            quantity_before = running_totals.get(key, 0)
            quantity_after = quantity_before + ledger.change_amount
            running_totals[key] = quantity_after

            history.append(
                LedgerHistoryItem(
                    ledger_id=ledger.id,
                    created_at=ledger.created_at,
                    store_id=store.id,
                    store_name=store.name,
                    product_id=product.id,
                    product_code=product.product_code,
                    product_name=product.name_cn,
                    reference_type=ledger.reference_type,
                    change_amount=ledger.change_amount,
                    quantity_before=quantity_before,
                    quantity_after=quantity_after,
                )
            )

        return list(reversed(history[-20:]))
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="加载库存流水时发生数据库错误")


@router.get("/dashboard-metrics", response_model=DashboardMetrics, status_code=status.HTTP_200_OK)
async def get_dashboard_metrics(
    session: AsyncSession = Depends(get_db),
) -> DashboardMetrics:
    try:
        total_inventory_items = await session.scalar(select(func.count(Inventory.id)))
        today_stock_in_count = await session.scalar(
            select(func.count(InventoryLedger.id)).where(
                InventoryLedger.reference_type == "inbound",
                func.date(InventoryLedger.created_at) == func.current_date(),
            )
        )
        today_transfer_count = await session.scalar(
            select(func.count(Transfer.id)).where(func.date(Transfer.created_at) == func.current_date())
        )
        low_stock_warning_count = await session.scalar(select(func.count(Inventory.id)).where(Inventory.quantity <= 5))

        return DashboardMetrics(
            total_inventory_items=int(total_inventory_items or 0),
            today_stock_in_count=int(today_stock_in_count or 0),
            today_transfer_count=int(today_transfer_count or 0),
            low_stock_warning_count=int(low_stock_warning_count or 0),
        )
    except SQLAlchemyError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="加载库存指标时发生数据库错误")


@router.post("/clear-dirty-data", status_code=status.HTTP_200_OK)
async def clear_dirty_inventory_data(
    payload: ClearDirtyDataRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> dict[str, int]:
    if current_user.role != EmployeeRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可执行脏库存清理")

    try:
        if session.in_transaction():
            await session.rollback()

        async with session.begin():
            inventory_result = await session.execute(
                select(Inventory).where(Inventory.store_id == payload.store_id).with_for_update()
            )
            inventories = inventory_result.scalars().all()
            for inventory in inventories:
                inventory.quantity = 0

            return {"cleared_inventory_rows": len(inventories)}
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="清理脏库存时发生数据库错误")
