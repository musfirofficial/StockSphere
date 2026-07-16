from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional
from datetime import datetime
import uuid
import re

# ------------------------------ Item Base schema ----------------------------- #
class ItemBase(BaseModel):
    item_name: str = Field(min_length=3, max_length=100)
    sku: str = Field(min_length=5, max_length=20)
    description: Optional[str] = None
    category_id: uuid.UUID
    supplier_id: uuid.UUID

    quantity_in_stock: int = Field(ge=0)
    reorder_quantity: int = Field(ge=0)

    unit: str = Field(min_length=1, max_length=20)

    cost_price: float = Field(gt=0)
    selling_price: float = Field(gt=0)

    reorder_level: int = Field(ge=0)

    @field_validator('sku')
    @classmethod
    def sku_input(cls, v: str):
        if not re.match(r"^[A-Z0-9-]+-\d+$", v):
            raise ValueError("SKU must be in the format ABCD-1234")
        return v

# ----------------------------- Item create schema ---------------------------- #
class ItemCreate(ItemBase):
    pass

# ---------------------------- Item update schema ---------------------------- #
class ItemUpdate(BaseModel):
    item_name: Optional[str] = Field(None, min_length=3, max_length=100)

    sku: Optional[str] = Field(None, min_length=5, max_length=20)

    description: Optional[str] = None

    category_id: Optional[uuid.UUID] = None
    supplier_id: Optional[uuid.UUID] = None

    unit: Optional[str] = Field(None, min_length=1, max_length=20)

    cost_price: Optional[float] = Field(None, gt=0)
    selling_price: Optional[float] = Field(None, gt=0)

    reorder_level: Optional[int] = Field(None, ge=0)
    reorder_quantity: Optional[int] = Field(None, ge=0)

    is_active: Optional[bool] = None

    @field_validator('sku')
    @classmethod
    def sku_input(cls, v):
        if v is not None and not re.match(r"^[A-Z0-9-]+-\d+$", v):
            raise ValueError("SKU must be in the format ABCD-1234")
        return v

# --------------------------- Item response schema --------------------------- #
class ItemResponse(ItemBase):
    item_id: uuid.UUID
    quantity_in_stock: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
