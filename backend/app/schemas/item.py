from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, Any
from datetime import datetime
from app.models import UserRole
import uuid
import re


# ------------------------------ Item Base schema ----------------------------- #
class ItemBase(BaseModel):
    item_name: str = Field(min_length=3, max_length=100)
    sku: str = Field(min_length=5, max_length=20)
    description: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    supplier_id: Optional[uuid.UUID] = None

    quantity_in_stock: int = Field(ge=0)
    reorder_quantity: int = Field(ge=0)

    unit: str = Field(min_length=1, max_length=20)

    cost_price: float = Field(gt=0)
    selling_price: float = Field(gt=0)

    reorder_level: int = Field(ge=0)

    @field_validator("sku")
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

    @field_validator("sku")
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

    category_name: Optional[str] = None
    supplier_name: Optional[str] = None

    cost_price: float | None = Field(default=None, gt=0)

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def extract_names(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if supplier := data.get("supplier"):
                data["supplier_name"] = getattr(supplier, "supplier_name", data.get("supplier_name", ""))
            if category := data.get("category"):
                data["category_name"] = getattr(category, "category_name", data.get("category_name", ""))
            return data

        category = data.__dict__.get("category") if hasattr(data, "__dict__") else None
        supplier = data.__dict__.get("supplier") if hasattr(data, "__dict__") else None

        if category:
            setattr(data, "category_name", category.category_name)
        if supplier:
            setattr(data, "supplier_name", supplier.supplier_name)
        return data

    @model_validator(mode="after")
    def sanitize_for_sales(self, info):
        if info.context and info.context.get("role") == UserRole.SALES:
            self.supplier_name = None
            self.cost_price = None
        return self
