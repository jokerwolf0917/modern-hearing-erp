from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class InventoryListItem(BaseModel):
    inventory_id: UUID
    store_id: UUID
    store_name: str
    product_id: UUID
    product_name: str
    sku: str
    quantity: int
    cost_price: Decimal
    retail_price: Decimal
    has_sn_tracking: bool


class LedgerHistoryItem(BaseModel):
    ledger_id: UUID
    created_at: datetime
    store_id: UUID
    store_name: str
    product_id: UUID
    product_name: str
    sku: str
    reference_type: str
    change_amount: int
    quantity_before: int
    quantity_after: int
