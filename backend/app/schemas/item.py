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
    unit_id: Optional[uuid.UUID] = None

    quantity_in_stock: int = Field(default=0, ge=0)
    reorder_quantity: int = Field(default=10, ge=0)

    unit: str = Field(default="pcs", min_length=1, max_length=20)

    cost_price: float = Field(gt=0)
    selling_price: float = Field(gt=0)

    reorder_level: int = Field(default=10, ge=0)

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
    unit_id: Optional[uuid.UUID] = None

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
    health_status: Optional[str] = "HEALTHY"

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
            qty = data.get("quantity_in_stock", 0)
            reorder = data.get("reorder_level", 10)
            if "health_status" not in data or not data["health_status"]:
                if qty <= 0:
                    data["health_status"] = "CRITICAL"
                elif qty <= reorder:
                    data["health_status"] = "LOW_STOCK"
                else:
                    data["health_status"] = "HEALTHY"
            return data

        # ORM object
        if hasattr(data, "__dict__"):
            category = getattr(data, "category", None)
            supplier = getattr(data, "supplier", None)
            if category:
                data.__dict__["category_name"] = getattr(category, "category_name", None)
            if supplier:
                data.__dict__["supplier_name"] = getattr(supplier, "supplier_name", None)
            elif hasattr(data, "item_suppliers") and data.item_suppliers:
                primary_link = next((l for l in data.item_suppliers if getattr(l, "is_primary", False)), None)
                chosen_link = primary_link or data.item_suppliers[0]
                if chosen_link and hasattr(chosen_link, "supplier") and chosen_link.supplier:
                    data.__dict__["supplier_name"] = getattr(chosen_link.supplier, "supplier_name", None)

        return data

    @model_validator(mode="after")
    def sanitize_for_sales(self, info):
        if info.context and info.context.get("role") == UserRole.SALES:
            self.supplier_name = None
            self.cost_price = None
        return self
