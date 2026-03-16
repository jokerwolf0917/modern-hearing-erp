import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    Customer,
    Employee,
    EmployeeRole,
    Inventory,
    InventoryLedger,
    Order,
    OrderItem,
    Product,
    ProductSerial,
    ProductSerialStatus,
    Store,
    Transfer,
    TransferStatus,
)
from app.routers.deps import get_current_active_user
from app.schemas.inventory import SNTraceResult


router = APIRouter(prefix="/api/inventory", tags=["inventory"])


class StockInRequest(BaseModel):
    store_id: uuid.UUID
    product_id: uuid.UUID
    quantity: int = Field(gt=0)


class SerialStockInRequest(BaseModel):
    store_id: uuid.UUID
    product_id: uuid.UUID
    sn_codes: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_sn_codes(self) -> "SerialStockInRequest":
        normalized = [item.strip() for item in self.sn_codes if item.strip()]
        if not normalized:
            raise ValueError("sn_codes cannot be empty")
        if len(normalized) != len(set(normalized)):
            raise ValueError("sn_codes must be unique within the same request")
        self.sn_codes = normalized
        return self


class TransferRequest(BaseModel):
    from_store_id: uuid.UUID
    to_store_id: uuid.UUID
    product_id: uuid.UUID
    quantity: int = Field(gt=0)

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


class SerialStockInResponse(BaseModel):
    store_id: uuid.UUID
    product_id: uuid.UUID
    created_count: int
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
    product_name: str
    sku: str
    retail_price: Decimal
    quantity: int


class InventoryLedgerRow(BaseModel):
    inventory_id: uuid.UUID
    store_id: uuid.UUID
    store_name: str
    product_id: uuid.UUID
    product_name: str
    sku: str
    quantity: int
    cost_price: Decimal
    retail_price: Decimal
    has_sn_tracking: bool


class LedgerHistoryItem(BaseModel):
    ledger_id: uuid.UUID
    created_at: datetime
    store_id: uuid.UUID
    store_name: str
    product_id: uuid.UUID
    product_name: str
    sku: str
    reference_type: str
    change_amount: int
    quantity_before: int
    quantity_after: int


class DashboardMetrics(BaseModel):
    total_inventory_items: int
    today_stock_in_count: int
    today_transfer_count: int
    low_stock_warning_count: int


class AvailableSerialItem(BaseModel):
    id: uuid.UUID
    sn_code: str


class ClearDirtyDataRequest(BaseModel):
    store_id: uuid.UUID


async def _ensure_store_exists(session: AsyncSession, store_id: uuid.UUID, detail: str) -> None:
    store = await session.get(Store, store_id)
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


async def _ensure_product_exists(session: AsyncSession, product_id: uuid.UUID) -> None:
    product = await session.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")


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


@router.post("/stock-in", response_model=StockInResponse, status_code=status.HTTP_201_CREATED)
async def stock_in(
    payload: StockInRequest,
    session: AsyncSession = Depends(get_db),
) -> StockInResponse:
    for attempt in range(2):
        try:
            async with session.begin():
                await _ensure_store_exists(session, payload.store_id, "Store not found")
                await _ensure_product_exists(session, payload.product_id)

                inventory = await _get_or_create_inventory(session, payload.store_id, payload.product_id)
                inventory.quantity += payload.quantity
                await session.flush()

                ledger = InventoryLedger(
                    store_id=payload.store_id,
                    product_id=payload.product_id,
                    change_amount=payload.quantity,
                    reference_type="manual_in",
                )
                session.add(ledger)
                await session.flush()

                response = StockInResponse(
                    inventory_id=inventory.id,
                    store_id=inventory.store_id,
                    product_id=inventory.product_id,
                    quantity=inventory.quantity,
                    ledger_id=ledger.id,
                )
            return response
        except IntegrityError:
            await session.rollback()
            if attempt == 0:
                continue
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to stock in inventory due to a concurrent write conflict.",
            )
        except HTTPException:
            raise
        except SQLAlchemyError:
            await session.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error occurred while stocking in inventory.",
            )

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Unexpected error occurred while stocking in inventory.",
    )


@router.post("/sn-stock-in", response_model=SerialStockInResponse, status_code=status.HTTP_201_CREATED)
async def serial_stock_in(
    payload: SerialStockInRequest,
    session: AsyncSession = Depends(get_db),
) -> SerialStockInResponse:
    try:
        async with session.begin():
            await _ensure_store_exists(session, payload.store_id, "Store not found")
            await _ensure_product_exists(session, payload.product_id)

            inventory = await _get_or_create_inventory(session, payload.store_id, payload.product_id)

            serials = [
                ProductSerial(
                    store_id=payload.store_id,
                    product_id=payload.product_id,
                    sn_code=sn_code,
                    status=ProductSerialStatus.IN_STOCK,
                )
                for sn_code in payload.sn_codes
            ]
            session.add_all(serials)
            inventory.quantity += len(serials)
            await session.flush()

            ledger = InventoryLedger(
                store_id=payload.store_id,
                product_id=payload.product_id,
                change_amount=len(serials),
                reference_type="manual_in",
            )
            session.add(ledger)
            await session.flush()

            return SerialStockInResponse(
                store_id=payload.store_id,
                product_id=payload.product_id,
                created_count=len(serials),
                quantity=inventory.quantity,
                ledger_id=ledger.id,
            )
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more SN codes already exist.",
        )
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while stocking in serial-coded inventory.",
        )


@router.post("/transfer", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    payload: TransferRequest,
    session: AsyncSession = Depends(get_db),
) -> TransferResponse:
    try:
        async with session.begin():
            await _ensure_store_exists(session, payload.from_store_id, "Source store not found")
            await _ensure_store_exists(session, payload.to_store_id, "Destination store not found")
            await _ensure_product_exists(session, payload.product_id)
            product = await session.get(Product, payload.product_id)
            if product is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

            result = await session.execute(
                select(Inventory)
                .where(
                    Inventory.store_id == payload.from_store_id,
                    Inventory.product_id == payload.product_id,
                )
                .with_for_update()
            )
            inventory = result.scalar_one_or_none()

            if inventory is None or inventory.quantity < payload.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Insufficient stock",
                )

            if product.has_sn_tracking:
                serial_result = await session.execute(
                    select(ProductSerial)
                    .where(
                        ProductSerial.store_id == payload.from_store_id,
                        ProductSerial.product_id == payload.product_id,
                        ProductSerial.status == ProductSerialStatus.IN_STOCK,
                    )
                    .order_by(ProductSerial.sn_code.asc())
                    .limit(payload.quantity)
                    .with_for_update()
                )
                serials = serial_result.scalars().all()
                if len(serials) < payload.quantity:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Insufficient serial stock",
                    )
                for serial in serials:
                    serial.store_id = payload.to_store_id

            inventory.quantity -= payload.quantity
            target_inventory = await _get_or_create_inventory(session, payload.to_store_id, payload.product_id)
            target_inventory.quantity += payload.quantity
            await session.flush()

            transfer = Transfer(
                from_store_id=payload.from_store_id,
                to_store_id=payload.to_store_id,
                product_id=payload.product_id,
                quantity=payload.quantity,
                status=TransferStatus.IN_TRANSIT,
            )
            session.add(transfer)
            await session.flush()

            ledger = InventoryLedger(
                store_id=payload.from_store_id,
                product_id=payload.product_id,
                change_amount=-payload.quantity,
                reference_type="transfer_out",
            )
            session.add(ledger)
            target_ledger = InventoryLedger(
                store_id=payload.to_store_id,
                product_id=payload.product_id,
                change_amount=payload.quantity,
                reference_type="transfer_in",
            )
            session.add(target_ledger)
            await session.flush()

            response = TransferResponse(
                transfer_id=transfer.id,
                from_store_id=transfer.from_store_id,
                to_store_id=transfer.to_store_id,
                product_id=transfer.product_id,
                quantity=transfer.quantity,
                status=transfer.status,
                remaining_stock=inventory.quantity,
                ledger_id=ledger.id,
            )
        return response
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating transfer.",
        )


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
            .order_by(Store.name.asc(), Product.name.asc())
        )

        if current_user.role != EmployeeRole.ADMIN:
            if current_user.store_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Current user is not assigned to a store",
                )
            stmt = stmt.where(Store.id == current_user.store_id)
        elif store_id is not None:
            stmt = stmt.where(Store.id == store_id)

        normalized_product_name = (product_name or "").strip()
        if normalized_product_name:
            stmt = stmt.where(Product.name.ilike(f"%{normalized_product_name}%"))

        result = await session.execute(stmt)
        return [
            InventoryLedgerRow(
                inventory_id=inventory.id,
                store_id=store.id,
                store_name=store.name,
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                quantity=inventory.quantity,
                cost_price=product.cost_price,
                retail_price=product.retail_price,
                has_sn_tracking=product.has_sn_tracking,
            )
            for inventory, store, product in result.all()
        ]
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading inventory ledger.",
        )


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
            .order_by(Store.name.asc(), Product.name.asc())
        )

        if current_user.role != EmployeeRole.ADMIN:
            if current_user.store_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Current user is not assigned to a store",
                )
            stmt = stmt.where(Store.id == current_user.store_id)

        result = await session.execute(stmt)
        return [
            StockSummaryItem(
                inventory_id=inventory.id,
                store_id=store.id,
                store_name=store.name,
                product_id=product.id,
                product_name=product.name,
                sku=product.sku,
                retail_price=product.retail_price,
                quantity=inventory.quantity,
            )
            for inventory, store, product in result.all()
        ]
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading stock summary.",
        )


@router.get("/available-sns", response_model=list[AvailableSerialItem], status_code=status.HTTP_200_OK)
async def get_available_serials(
    store_id: uuid.UUID = Query(...),
    product_id: uuid.UUID = Query(...),
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> list[AvailableSerialItem]:
    try:
        if current_user.role != EmployeeRole.ADMIN:
            if current_user.store_id is None or current_user.store_id != store_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view serials for your own store.",
                )

        result = await session.execute(
            select(ProductSerial)
            .where(
                ProductSerial.store_id == store_id,
                ProductSerial.product_id == product_id,
                ProductSerial.status == ProductSerialStatus.IN_STOCK,
            )
            .order_by(ProductSerial.sn_code.asc())
        )
        serials = result.scalars().all()
        return [AvailableSerialItem(id=item.id, sn_code=item.sn_code) for item in serials]
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading available serial numbers.",
        )


@router.get("/trace-sn/{sn_code}", response_model=SNTraceResult, status_code=status.HTTP_200_OK)
async def trace_serial_number(
    sn_code: str,
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> SNTraceResult:
    normalized_sn = sn_code.strip()
    if not normalized_sn:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SN code cannot be empty")

    try:
        result = await session.execute(
            select(
                ProductSerial,
                Product.name,
                Store.name,
                Customer.name,
                Order.id,
                Order.created_at,
            )
            .join(Product, Product.id == ProductSerial.product_id)
            .join(Store, Store.id == ProductSerial.store_id)
            .outerjoin(OrderItem, OrderItem.id == ProductSerial.order_item_id)
            .outerjoin(Order, Order.id == OrderItem.order_id)
            .outerjoin(Customer, Customer.id == Order.customer_id)
            .where(ProductSerial.sn_code == normalized_sn)
        )
        row = result.one_or_none()

        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SN code not found")

        serial, product_name, store_name, customer_name, order_id, sold_at = row

        if current_user.role != EmployeeRole.ADMIN:
            if current_user.store_id is None or current_user.store_id != serial.store_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only trace serial numbers for your own store.",
                )

        if serial.warranty_ends_at is not None and serial.warranty_ends_at.tzinfo is not None:
            now = datetime.now(serial.warranty_ends_at.tzinfo)
        else:
            now = datetime.utcnow()

        return SNTraceResult(
            sn_code=serial.sn_code,
            status=serial.status,
            product_name=product_name,
            store_name=store_name,
            customer_name=customer_name,
            order_id=order_id,
            stocked_in_at=serial.created_at,
            sold_at=sold_at,
            warranty_ends_at=serial.warranty_ends_at,
            is_warranty_valid=bool(serial.warranty_ends_at and serial.warranty_ends_at >= now),
        )
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while tracing serial number.",
        )


@router.post("/clear-dirty-data", status_code=status.HTTP_200_OK)
async def clear_dirty_inventory_data(
    payload: ClearDirtyDataRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> dict[str, int]:
    current_user_role = current_user.role

    if current_user_role != EmployeeRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can clear dirty inventory data.",
        )

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

            serial_result = await session.execute(
                select(ProductSerial)
                .where(
                    ProductSerial.store_id == payload.store_id,
                    ProductSerial.status == ProductSerialStatus.IN_STOCK,
                )
                .with_for_update()
            )
            serials = serial_result.scalars().all()
            deleted_count = len(serials)
            for serial in serials:
                await session.delete(serial)

            return {
                "cleared_inventory_rows": len(inventories),
                "deleted_serial_rows": deleted_count,
            }
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while clearing dirty inventory data.",
        )


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
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Current user is not assigned to a store",
                )
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
                    product_name=product.name,
                    sku=product.sku,
                    reference_type=ledger.reference_type,
                    change_amount=ledger.change_amount,
                    quantity_before=quantity_before,
                    quantity_after=quantity_after,
                )
            )

        return list(reversed(history[-15:]))
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading ledger history.",
        )


@router.get("/dashboard-metrics", response_model=DashboardMetrics, status_code=status.HTTP_200_OK)
async def get_dashboard_metrics(
    session: AsyncSession = Depends(get_db),
) -> DashboardMetrics:
    try:
        total_inventory_items = await session.scalar(select(func.count(Inventory.id)))
        today_stock_in_count = await session.scalar(
            select(func.count(InventoryLedger.id)).where(
                InventoryLedger.reference_type == "manual_in",
                func.date(InventoryLedger.created_at) == func.current_date(),
            )
        )
        today_transfer_count = await session.scalar(
            select(func.count(Transfer.id)).where(func.date(Transfer.created_at) == func.current_date())
        )
        low_stock_warning_count = await session.scalar(
            select(func.count(Inventory.id)).where(Inventory.quantity <= 5)
        )

        return DashboardMetrics(
            total_inventory_items=total_inventory_items or 0,
            today_stock_in_count=today_stock_in_count or 0,
            today_transfer_count=today_transfer_count or 0,
            low_stock_warning_count=low_stock_warning_count or 0,
        )
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading dashboard metrics.",
        )
