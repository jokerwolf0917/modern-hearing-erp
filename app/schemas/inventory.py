from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models import ProductSerialStatus


class SNTraceResult(BaseModel):
    sn_code: str
    status: ProductSerialStatus
    product_name: str
    store_name: str
    customer_name: str | None = None
    order_id: UUID | None = None
    stocked_in_at: datetime
    sold_at: datetime | None = None
    warranty_ends_at: datetime | None = None
    is_warranty_valid: bool
