from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
from datetime import datetime
from app.models import POType
import uuid


# -------------------------- Purchase order schemas -------------------------- #
class PurchaseOrderCreate(BaseModel):
    supplier_id: uuid.UUID
    po_type: POType = POType.DRAFT


# -------------------------- Purchase order Response ------------------------- #
class PurchaseOrderResponse(BaseModel):
    po_id: uuid.UUID
    supplier_id: uuid.UUID
    supplier_name: str
    po_type: POType
    created_at: datetime
    created_by: str | None

    model_config = ConfigDict(from_attributes=True)


# ------------------------ Purchase order Item schemas ----------------------- #
class PurchaseOrderItemCreate(BaseModel):
    item_id: uuid.UUID
    quantity: int
    unit_price: Decimal


class PurchaseOrderItemUpdate(BaseModel):
    poi_id: uuid.UUID
    quantity: int = Field(gt=0, description="Quantity must be greater than zero")
    unit_price: Decimal = Field(ge=0, description="Unit price cannot be negative")


class PurchaseOrderItemResponse(PurchaseOrderItemCreate):
    poi_id: uuid.UUID
    po_id: uuid.UUID
    item_name: str
    is_stale_alert: bool = False

    model_config = ConfigDict(from_attributes=True)
