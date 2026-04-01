from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, select
from sqlalchemy.exc import SQLAlchemyError
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
    OrderStatus,
    Product,
    StockTransaction,
    Store,
    TransactionType,
)
from app.routers.deps import get_current_active_user
from app.schemas.order import OrderCreate, OrderItemRead, OrderListItem, OrderRead

router = APIRouter(prefix="/api/orders", tags=["orders"])


async def _ensure_store_exists(session: AsyncSession, store_id: uuid.UUID) -> None:
    if await session.get(Store, store_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="门店不存在")


async def _get_customer(session: AsyncSession, customer_id: uuid.UUID) -> Customer:
    customer = await session.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="客户不存在")
    return customer


@router.get("", response_model=list[OrderListItem], status_code=status.HTTP_200_OK)
async def list_orders(
    customer_name: str | None = Query(default=None),
    order_id_prefix: str | None = Query(default=None),
    store_id: uuid.UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> list[OrderListItem]:
    try:
        stmt = (
            select(Order, Customer.name, Store.name)
            .join(Customer, Customer.id == Order.customer_id)
            .join(Store, Store.id == Order.store_id)
            .order_by(Order.created_at.desc(), Order.id.desc())
        )

        if customer_name:
            stmt = stmt.where(Customer.name.ilike(f"%{customer_name.strip()}%"))

        if order_id_prefix:
            stmt = stmt.where(cast(Order.id, String).ilike(f"{order_id_prefix.strip()}%"))

        if current_user.role == EmployeeRole.ADMIN:
            if store_id is not None:
                stmt = stmt.where(Store.id == store_id)
        else:
            if current_user.store_id is None:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号未绑定门店")
            if store_id is not None and store_id != current_user.store_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能查看当前门店的订单")
            stmt = stmt.where(Store.id == current_user.store_id)

        order_rows = (await session.execute(stmt)).all()
        order_ids = [order.id for order, _, _ in order_rows]

        item_map: dict[uuid.UUID, list[OrderListItem.Item]] = {}
        if order_ids:
            item_result = await session.execute(
                select(OrderItem, Product)
                .join(Product, Product.id == OrderItem.product_id)
                .where(OrderItem.order_id.in_(order_ids))
                .order_by(OrderItem.order_id.asc(), OrderItem.id.asc())
            )

            for order_item, product in item_result.all():
                item_map.setdefault(order_item.order_id, []).append(
                    OrderListItem.Item(
                        product_name=product.name_cn,
                        sku=product.product_code,
                        quantity=order_item.quantity,
                        unit_price=order_item.unit_price,
                        serial_details=[],
                    )
                )

        return [
            OrderListItem(
                id=order.id,
                customer_id=order.customer_id,
                customer_name=customer_name_value,
                store_id=order.store_id,
                store_name=store_name,
                total_amount=order.total_amount,
                status=order.status,
                created_at=order.created_at,
                items=item_map.get(order.id, []),
            )
            for order, customer_name_value, store_name in order_rows
        ]
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="加载订单时发生数据库错误") from exc


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> OrderRead:
    response_items: list[OrderItemRead] = []
    order: Order | None = None

    try:
        if session.in_transaction():
            await session.rollback()

        async with session.begin():
            if current_user.role != EmployeeRole.ADMIN:
                if current_user.store_id is None or current_user.store_id != payload.store_id:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能为当前门店创建销售单")

            customer = await _get_customer(session, payload.customer_id)
            await _ensure_store_exists(session, payload.store_id)
            transaction_time = datetime.now(timezone.utc)

            order = Order(
                customer_id=payload.customer_id,
                store_id=payload.store_id,
                total_amount=Decimal("0.00"),
                status=OrderStatus.PAID,
            )
            session.add(order)
            await session.flush()

            total_amount = Decimal("0.00")

            for item in payload.items:
                product = await session.get(Product, item.product_id)
                if product is None:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="商品不存在")

                inventory_result = await session.execute(
                    select(Inventory)
                    .where(Inventory.store_id == payload.store_id, Inventory.product_id == item.product_id)
                    .with_for_update()
                )
                inventory = inventory_result.scalar_one_or_none()
                if inventory is None or inventory.quantity < item.quantity:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="库存不足")

                order_item = OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=item.quantity,
                    unit_price=product.original_price,
                )
                session.add(order_item)

                inventory.quantity -= item.quantity
                line_total = product.original_price * item.quantity
                total_amount += line_total

                session.add(
                    InventoryLedger(
                        store_id=payload.store_id,
                        product_id=product.id,
                        change_amount=-item.quantity,
                        reference_type="sale",
                    )
                )
                session.add(
                    StockTransaction(
                        transaction_date=transaction_time,
                        store_id=payload.store_id,
                        product_id=product.id,
                        customer_id=payload.customer_id,
                        type=TransactionType.SALE,
                        quantity=item.quantity,
                        unit_price=product.original_price,
                        handled_by=current_user.id,
                        target=customer.name,
                        remark=f"{product.name_cn} 销售出库",
                    )
                )

                await session.flush()

                response_items.append(
                    OrderItemRead(
                        id=order_item.id,
                        product_id=product.id,
                        product_name=product.name_cn,
                        sku=product.product_code,
                        quantity=order_item.quantity,
                        unit_price=order_item.unit_price,
                        line_total=line_total,
                        sn_codes=[],
                    )
                )

            order.total_amount = total_amount
            await session.flush()

        await session.refresh(order)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建订单时发生数据库错误") from exc

    if order is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建订单失败")

    return OrderRead(
        id=order.id,
        customer_id=order.customer_id,
        store_id=order.store_id,
        total_amount=order.total_amount,
        status=order.status,
        created_at=order.created_at,
        items=response_items,
    )


@router.post("/{order_id}/return", response_model=OrderRead, status_code=status.HTTP_200_OK)
async def return_order(
    order_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> OrderRead:
    response_items: list[OrderItemRead] = []

    try:
        if session.in_transaction():
            await session.rollback()

        async with session.begin():
            order_result = await session.execute(select(Order).where(Order.id == order_id).with_for_update())
            order = order_result.scalar_one_or_none()
            if order is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="订单不存在")

            if current_user.role != EmployeeRole.ADMIN:
                if current_user.store_id is None or current_user.store_id != order.store_id:
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只能退回当前门店订单")

            if order.status == OrderStatus.RETURNED:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="订单已退货")

            customer = await _get_customer(session, order.customer_id)
            item_result = await session.execute(
                select(OrderItem, Product)
                .join(Product, Product.id == OrderItem.product_id)
                .where(OrderItem.order_id == order_id)
                .order_by(OrderItem.id.asc())
            )
            items = item_result.all()

            for order_item, product in items:
                inventory_result = await session.execute(
                    select(Inventory)
                    .where(Inventory.store_id == order.store_id, Inventory.product_id == order_item.product_id)
                    .with_for_update()
                )
                inventory = inventory_result.scalar_one_or_none()
                if inventory is None:
                    inventory = Inventory(store_id=order.store_id, product_id=order_item.product_id, quantity=0)
                    session.add(inventory)
                    await session.flush()

                inventory.quantity += order_item.quantity

                session.add(
                    InventoryLedger(
                        store_id=order.store_id,
                        product_id=order_item.product_id,
                        change_amount=order_item.quantity,
                        reference_type="return",
                    )
                )
                session.add(
                    StockTransaction(
                        transaction_date=datetime.now(timezone.utc),
                        store_id=order.store_id,
                        product_id=order_item.product_id,
                        customer_id=order.customer_id,
                        type=TransactionType.INBOUND,
                        quantity=order_item.quantity,
                        unit_price=order_item.unit_price,
                        handled_by=current_user.id,
                        target=customer.name,
                        remark=f"{product.name_cn} 销售退回",
                    )
                )

                response_items.append(
                    OrderItemRead(
                        id=order_item.id,
                        product_id=product.id,
                        product_name=product.name_cn,
                        sku=product.product_code,
                        quantity=order_item.quantity,
                        unit_price=order_item.unit_price,
                        line_total=order_item.unit_price * order_item.quantity,
                        sn_codes=[],
                    )
                )

            order.status = OrderStatus.RETURNED
            await session.flush()
            await session.refresh(order)

            return OrderRead(
                id=order.id,
                customer_id=order.customer_id,
                store_id=order.store_id,
                total_amount=order.total_amount,
                status=order.status,
                created_at=order.created_at,
                items=response_items,
            )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="退货时发生数据库错误") from exc
