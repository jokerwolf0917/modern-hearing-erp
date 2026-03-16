from decimal import Decimal

from pydantic import BaseModel


class RevenueTrendPoint(BaseModel):
    date: str
    revenue: Decimal


class TopProductItem(BaseModel):
    product_name: str
    sales_volume: int


class DashboardSummary(BaseModel):
    total_revenue: Decimal
    total_orders: int
    revenue_trend: list[RevenueTrendPoint]
    top_products: list[TopProductItem]
