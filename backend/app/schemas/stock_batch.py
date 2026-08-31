from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
import uuid


class StockBatchBase(BaseModel):
    batch_number: str = Field(min_length=1, max_length=100)
    purchase_price: Decimal = Field(gt=0)
    selling_price: Optional[Decimal] = None
    current_quantity: int = Field(ge=0)
    initial_quantity: int = Field(ge=0)
    expiry_date: Optional[date] = None


class StockBatchCreate(StockBatchBase):
    item_id: uuid.UUID
    supplier_id: uuid.UUID
    po_id: Optional[uuid.UUID] = None


class StockBatchUpdate(BaseModel):
    current_quantity: Optional[int] = Field(default=None, ge=0)
    selling_price: Optional[Decimal] = None
    expiry_date: Optional[date] = None


class StockBatchResponse(StockBatchBase):
    batch_id: uuid.UUID
    item_id: uuid.UUID
    item_name: Optional[str] = None
    supplier_id: uuid.UUID
    supplier_name: Optional[str] = None
    po_id: Optional[uuid.UUID] = None
    received_date: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
