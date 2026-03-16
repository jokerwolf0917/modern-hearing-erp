import uuid
from datetime import datetime, timedelta, timezone
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
    ProductSerial,
    ProductSerialStatus,
    Store,
)
from app.routers.deps import get_current_active_user
from app.schemas.order import OrderCreate, OrderItemRead, OrderListItem, OrderRead


router = APIRouter(prefix="/api/orders", tags=["orders"])


async def _ensure_store_exists(session: AsyncSession, store_id: uuid.UUID) -> None:
    if await session.get(Store, store_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")


async def _ensure_customer_exists(session: AsyncSession, customer_id: uuid.UUID) -> None:
    if await session.get(Customer, customer_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")


@router.get("", response_model=list[OrderListItem], status_code=status.HTTP_200_OK)
async def list_orders(
    customer_name: str | None = Query(default=None),
    order_id_prefix: str | None = Query(default=None),
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

        if current_user.role != EmployeeRole.ADMIN:
            if current_user.store_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Current user is not assigned to a store",
                )
            stmt = stmt.where(Store.id == current_user.store_id)

        order_result = await session.execute(stmt)
        order_rows = order_result.all()
        order_ids = [order.id for order, _, _ in order_rows]

        item_map: dict[uuid.UUID, list[OrderListItem.Item]] = {}
        if order_ids:
            item_result = await session.execute(
                select(OrderItem.id, OrderItem.order_id, Product.name, Product.sku, OrderItem.quantity, OrderItem.unit_price)
                .join(Product, Product.id == OrderItem.product_id)
                .where(OrderItem.order_id.in_(order_ids))
                .order_by(OrderItem.order_id.asc(), OrderItem.id.asc())
            )

            item_rows = item_result.all()
            order_item_ids = [item_id for item_id, _, _, _, _, _ in item_rows]
            serial_map: dict[uuid.UUID, list[OrderListItem.Item.SerialDetail]] = {}

            if order_item_ids:
                serial_result = await session.execute(
                    select(ProductSerial.order_item_id, ProductSerial.sn_code, ProductSerial.warranty_ends_at)
                    .where(ProductSerial.order_item_id.in_(order_item_ids))
                    .order_by(ProductSerial.order_item_id.asc(), ProductSerial.sn_code.asc())
                )
                for order_item_id, sn_code, warranty_ends_at in serial_result.all():
                    if order_item_id is None:
                        continue
                    serial_map.setdefault(order_item_id, []).append(
                        OrderListItem.Item.SerialDetail(
                            sn_code=sn_code,
                            warranty_ends_at=warranty_ends_at,
                        )
                    )

            for item_id, order_id, product_name, sku, quantity, unit_price in item_rows:
                item_map.setdefault(order_id, []).append(
                    OrderListItem.Item(
                        product_name=product_name,
                        sku=sku,
                        quantity=quantity,
                        unit_price=unit_price,
                        serial_details=serial_map.get(item_id, []),
                    )
                )

        return [
            OrderListItem(
                id=order.id,
                customer_id=order.customer_id,
                customer_name=customer_name,
                store_id=order.store_id,
                store_name=store_name,
                total_amount=order.total_amount,
                status=order.status,
                created_at=order.created_at,
                items=item_map.get(order.id, []),
            )
            for order, customer_name, store_name in order_rows
        ]
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading orders.",
        )


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> OrderRead:
    response_items: list[OrderItemRead] = []
    order: Order | None = None
    current_user_role = current_user.role
    current_user_store_id = current_user.store_id

    try:
        if session.in_transaction():
            await session.rollback()
        async with session.begin():
            if current_user_role != EmployeeRole.ADMIN:
                if current_user_store_id is None or current_user_store_id != payload.store_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You can only create orders for your own store.",
                    )

            await _ensure_customer_exists(session, payload.customer_id)
            await _ensure_store_exists(session, payload.store_id)

            order = Order(
                customer_id=payload.customer_id,
                store_id=payload.store_id,
                total_amount=Decimal("0.00"),
                status=OrderStatus.PAID,
            )
            session.add(order)
            await session.flush()

            total_amount = Decimal("0.00")
            warranty_ends_at = datetime.now(timezone.utc) + timedelta(days=365 * 2)

            for item in payload.items:
                product = await session.get(Product, item.product_id)
                if product is None:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Product not found",
                    )

                ordered_serials: list[ProductSerial] = []
                quantity = item.quantity

                if product.has_sn_tracking:
                    if len(item.sn_codes) != item.quantity:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"SN tracked product {product.name} requires quantity to match selected SN count.",
                        )

                    serial_result = await session.execute(
                        select(ProductSerial)
                        .where(
                            ProductSerial.store_id == payload.store_id,
                            ProductSerial.product_id == item.product_id,
                            ProductSerial.sn_code.in_(item.sn_codes),
                        )
                        .with_for_update()
                    )
                    serials = serial_result.scalars().all()

                    if len(serials) != len(item.sn_codes):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Some SN codes are unavailable for product {product.name}.",
                        )

                    serial_map = {serial.sn_code: serial for serial in serials}
                    for sn_code in item.sn_codes:
                        serial = serial_map.get(sn_code)
                        if serial is None or serial.status != ProductSerialStatus.IN_STOCK:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"SN code {sn_code} is no longer in stock.",
                            )
                        ordered_serials.append(serial)
                elif item.sn_codes:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Product {product.name} does not use SN tracking.",
                    )

                inventory_result = await session.execute(
                    select(Inventory)
                    .where(
                        Inventory.store_id == payload.store_id,
                        Inventory.product_id == item.product_id,
                    )
                    .with_for_update()
                )
                inventory = inventory_result.scalar_one_or_none()
                if inventory is None or inventory.quantity < quantity:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Insufficient stock",
                    )

                order_item = OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=product.retail_price,
                )
                session.add(order_item)
                await session.flush()

                if product.has_sn_tracking:
                    for serial in ordered_serials:
                        serial.status = ProductSerialStatus.SOLD
                        serial.order_item_id = order_item.id
                        serial.warranty_ends_at = warranty_ends_at

                inventory.quantity -= quantity
                line_total = product.retail_price * quantity
                total_amount += line_total
                await session.flush()

                session.add(
                    InventoryLedger(
                        store_id=payload.store_id,
                        product_id=product.id,
                        change_amount=-quantity,
                        reference_type="sales_out",
                    )
                )

                response_items.append(
                    OrderItemRead(
                        id=order_item.id,
                        product_id=product.id,
                        product_name=product.name,
                        sku=product.sku,
                        quantity=order_item.quantity,
                        unit_price=order_item.unit_price,
                        line_total=line_total,
                        sn_codes=[serial.sn_code for serial in ordered_serials] if product.has_sn_tracking else [],
                    )
                )

            order.total_amount = total_amount
            await session.flush()
    except HTTPException:
        raise
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while creating order.",
        )

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error occurred while creating order.",
        )

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


@router.post("/{order_id}/return", response_model=OrderRead, status_code=status.HTTP_200_OK)
async def return_order(
    order_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> OrderRead:
    response_items: list[OrderItemRead] = []
    current_user_role = current_user.role
    current_user_store_id = current_user.store_id

    try:
        if session.in_transaction():
            await session.rollback()
        async with session.begin():
            order_result = await session.execute(select(Order).where(Order.id == order_id).with_for_update())
            order = order_result.scalar_one_or_none()

            if order is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

            if current_user_role != EmployeeRole.ADMIN:
                if current_user_store_id is None or current_user_store_id != order.store_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="You can only return orders for your own store.",
                    )

            if order.status == OrderStatus.RETURNED:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order already returned")

            item_result = await session.execute(
                select(OrderItem, Product)
                .join(Product, Product.id == OrderItem.product_id)
                .where(OrderItem.order_id == order_id)
                .order_by(OrderItem.id.asc())
            )
            items = item_result.all()

            for order_item, product in items:
                serial_result = await session.execute(
                    select(ProductSerial)
                    .where(ProductSerial.order_item_id == order_item.id)
                    .with_for_update()
                )
                serials = serial_result.scalars().all()

                for serial in serials:
                    if serial.status == ProductSerialStatus.SOLD:
                        serial.status = ProductSerialStatus.IN_STOCK
                    else:
                        serial.status = ProductSerialStatus.RETURNED
                    serial.order_item_id = None
                    serial.warranty_ends_at = None

                inventory_result = await session.execute(
                    select(Inventory).where(
                        Inventory.store_id == order.store_id,
                        Inventory.product_id == order_item.product_id,
                    )
                )
                inventory = inventory_result.scalar_one_or_none()
                if inventory is None:
                    inventory = Inventory(
                        store_id=order.store_id,
                        product_id=order_item.product_id,
                        quantity=0,
                    )
                    session.add(inventory)
                    await session.flush()

                inventory.quantity += order_item.quantity
                await session.flush()

                session.add(
                    InventoryLedger(
                        store_id=order.store_id,
                        product_id=order_item.product_id,
                        change_amount=order_item.quantity,
                        reference_type="return_in",
                    )
                )

                response_items.append(
                    OrderItemRead(
                        id=order_item.id,
                        product_id=product.id,
                        product_name=product.name,
                        sku=product.sku,
                        quantity=order_item.quantity,
                        unit_price=order_item.unit_price,
                        line_total=order_item.unit_price * order_item.quantity,
                        sn_codes=[serial.sn_code for serial in serials],
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
    except SQLAlchemyError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while returning order.",
        )
