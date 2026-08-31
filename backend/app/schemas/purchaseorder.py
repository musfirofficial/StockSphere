from pydantic import BaseModel, ConfigDict, Field, model_validator
from decimal import Decimal
from datetime import datetime
from typing import Optional, Any
from app.models import POStatus, POType
import uuid


# ------------------------ Item input for PO Creation ----------------------- #
class POItemInput(BaseModel):
    item_id: uuid.UUID
    quantity: int = Field(gt=0)


# -------------------------- Purchase order schemas -------------------------- #
class PurchaseOrderCreate(BaseModel):
    supplier_id: uuid.UUID
    notes: Optional[str] = None
    items: list[POItemInput] = Field(default_factory=list)


class PurchaseOrderStatusUpdate(BaseModel):
    status: POStatus
    notes: Optional[str] = None


# ------------------------ Purchase order Item response ---------------------- #
class PurchaseOrderItemResponse(BaseModel):
    poi_id: uuid.UUID
    po_id: uuid.UUID
    item_id: uuid.UUID
    item_name: str = ""
    sku: Optional[str] = ""
    unit: Optional[str] = "pcs"
    quantity: int
    quantity_received: int = 0
    unit_price: Decimal
    total_price: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def extract_item_details(cls, data: Any) -> Any:
        if hasattr(data, "item") and data.item:
            setattr(data, "item_name", getattr(data.item, "item_name", ""))
            setattr(data, "sku", getattr(data.item, "sku", ""))
            setattr(data, "unit", getattr(data.item, "unit", "pcs"))
        qty = getattr(data, "quantity", 0)
        price = getattr(data, "unit_price", Decimal("0"))
        if qty is not None and price is not None:
            setattr(data, "total_price", Decimal(str(qty)) * Decimal(str(price)))
        return data


# -------------------------- Purchase order Response ------------------------- #
class PurchaseOrderResponse(BaseModel):
    po_id: uuid.UUID
    supplier_id: uuid.UUID
    supplier_name: str = ""
    status: POStatus = POStatus.DRAFT
    po_type: POStatus = POStatus.DRAFT
    notes: Optional[str] = None
    created_at: datetime
    created_by: Optional[str] = None
    total_items: int = 0
    total_amount: Decimal = Decimal("0.00")
    items: list[PurchaseOrderItemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def compute_aggregates(cls, data: Any) -> Any:
        if hasattr(data, "supplier") and data.supplier:
            setattr(data, "supplier_name", getattr(data.supplier, "supplier_name", ""))
        if hasattr(data, "user") and data.user:
            setattr(data, "created_by", getattr(data.user, "full_name", None))

        pois = getattr(data, "purchaseorderitems", []) or []
        tot_items = 0
        tot_amount = Decimal("0.00")
        for poi in pois:
            tot_items += getattr(poi, "quantity", 0)
            price = getattr(poi, "unit_price", Decimal("0"))
            qty = getattr(poi, "quantity", 0)
            tot_amount += Decimal(str(qty)) * Decimal(str(price))

        setattr(data, "total_items", tot_items)
        setattr(data, "total_amount", tot_amount)
        setattr(data, "items", pois)
        return data
