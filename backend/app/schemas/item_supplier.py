from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal
import uuid


class ItemSupplierBase(BaseModel):
    agreed_price: Decimal = Field(gt=0)
    is_primary: bool = Field(default=False)
    supplier_sku: Optional[str] = Field(default=None, max_length=50)


class ItemSupplierCreate(ItemSupplierBase):
    supplier_id: uuid.UUID


class ItemSupplierUpdate(BaseModel):
    agreed_price: Optional[Decimal] = Field(default=None, gt=0)
    is_primary: Optional[bool] = None
    supplier_sku: Optional[str] = Field(default=None, max_length=50)


class ItemSupplierResponse(ItemSupplierBase):
    item_id: uuid.UUID
    supplier_id: uuid.UUID
    supplier_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
