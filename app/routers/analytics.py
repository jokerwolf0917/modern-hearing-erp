from datetime import datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Employee, EmployeeRole, Order, OrderItem, OrderStatus, Product
from app.routers.deps import get_current_active_user
from app.schemas.analytics import DashboardSummary, RevenueTrendPoint, TopProductItem


router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=DashboardSummary, status_code=status.HTTP_200_OK)
async def get_dashboard_summary(
    session: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_active_user),
) -> DashboardSummary:
    try:
        order_filters = [Order.status == OrderStatus.PAID]
        if current_user.role != EmployeeRole.ADMIN:
            if current_user.store_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Current user is not assigned to a store.",
                )
            order_filters.append(Order.store_id == current_user.store_id)

        total_revenue_stmt = select(func.coalesce(func.sum(Order.total_amount), 0)).where(*order_filters)
        total_orders_stmt = select(func.count(Order.id)).where(*order_filters)

        total_revenue = await session.scalar(total_revenue_stmt)
        total_orders = await session.scalar(total_orders_stmt)

        today = datetime.now().date()
        start_date = today - timedelta(days=6)
        start_datetime = datetime.combine(start_date, time.min)

        trend_rows = await session.execute(
            select(
                func.date(Order.created_at).label("order_date"),
                func.coalesce(func.sum(Order.total_amount), 0).label("daily_revenue"),
            )
            .where(*order_filters, Order.created_at >= start_datetime)
            .group_by(func.date(Order.created_at))
            .order_by(func.date(Order.created_at).asc())
        )
        trend_map = {
            str(order_date): Decimal(daily_revenue or 0)
            for order_date, daily_revenue in trend_rows.all()
        }
        revenue_trend = [
            RevenueTrendPoint(
                date=(start_date + timedelta(days=offset)).isoformat(),
                revenue=trend_map.get((start_date + timedelta(days=offset)).isoformat(), Decimal("0")),
            )
            for offset in range(7)
        ]

        top_product_filters = [Order.status == OrderStatus.PAID]
        if current_user.role != EmployeeRole.ADMIN:
            top_product_filters.append(Order.store_id == current_user.store_id)

        top_product_rows = await session.execute(
            select(
                Product.name,
                func.coalesce(func.sum(OrderItem.quantity), 0).label("sales_volume"),
            )
            .join(OrderItem, OrderItem.product_id == Product.id)
            .join(Order, Order.id == OrderItem.order_id)
            .where(*top_product_filters)
            .group_by(Product.id, Product.name)
            .order_by(func.sum(OrderItem.quantity).desc(), Product.name.asc())
            .limit(5)
        )
        top_products = [
            TopProductItem(product_name=product_name, sales_volume=int(sales_volume or 0))
            for product_name, sales_volume in top_product_rows.all()
        ]

        return DashboardSummary(
            total_revenue=Decimal(total_revenue or 0),
            total_orders=int(total_orders or 0),
            revenue_trend=revenue_trend,
            top_products=top_products,
        )
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error occurred while loading analytics summary.",
        )
