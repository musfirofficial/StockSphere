from pydantic import BaseModel, ConfigDict, model_validator, Field
from typing import Optional, Any
from datetime import datetime, date
from decimal import Decimal
import uuid
from app.models import TransactionType


# -------------------------- Transaction base model -------------------------- #
class TransactionBase(BaseModel):
    item_id: uuid.UUID
    transaction_type: TransactionType
    quantity: int = Field(gt=0)
    supplier_id: Optional[uuid.UUID] = None
    batch_id: Optional[uuid.UUID] = None
    po_id: Optional[uuid.UUID] = None
    reference_transaction_id: Optional[uuid.UUID] = None
    unit_price: Optional[Decimal] = None
    reason: Optional[str] = None
    note: Optional[str] = None


class TransactionCreate(TransactionBase):
    pass


# ── Specific Transaction Type Payloads ────────────────────────────────────────

# 1. Purchase Receiving
class PurchaseReceivingItem(BaseModel):
    item_id: uuid.UUID
    quantity: int = Field(gt=0)
    batch_number: str = Field(min_length=1)
    expiry_date: Optional[date] = None
    selling_price: Optional[Decimal] = None


class PurchaseReceivingRequest(BaseModel):
    po_id: uuid.UUID
    items: list[PurchaseReceivingItem]


# 2. Sold Transaction
class SoldTransactionRequest(BaseModel):
    item_id: uuid.UUID
    supplier_id: uuid.UUID
    batch_id: uuid.UUID
    quantity: int = Field(gt=0)
    unit_price: Optional[Decimal] = None
    note: Optional[str] = None


# 3. Customer Return Transaction
class CustomerReturnRequest(BaseModel):
    reference_transaction_id: uuid.UUID
    quantity: int = Field(gt=0)
    reason: Optional[str] = None
    note: Optional[str] = None


# 4. Damaged Transaction
class DamagedTransactionRequest(BaseModel):
    item_id: uuid.UUID
    supplier_id: uuid.UUID
    batch_id: uuid.UUID
    quantity: int = Field(gt=0)
    note: Optional[str] = None


# 5. Expired Transaction
class ExpiredTransactionRequest(BaseModel):
    item_id: uuid.UUID
    supplier_id: uuid.UUID
    batch_id: uuid.UUID
    quantity: int = Field(gt=0)
    note: Optional[str] = None


# 6. Adjustment Transaction
class AdjustmentTransactionRequest(BaseModel):
    item_id: uuid.UUID
    supplier_id: uuid.UUID
    batch_id: uuid.UUID
    transaction_type: TransactionType  # ADJUSTMENT_INCREASE or ADJUSTMENT_DECREASE
    quantity: int = Field(gt=0)
    reason: str = Field(min_length=3, description="Mandatory reason for manual adjustment")
    note: Optional[str] = None


# ── Transaction Response ──────────────────────────────────────────────────────
class TransactionResponse(TransactionBase):
    transaction_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    previous_quantity: int = 0
    new_quantity: int = 0
    user_id: Optional[uuid.UUID] = None
    user_name: str = ""
    user_full_name: Optional[str] = None
    item_name: str = ""
    sku: str = ""
    supplier_name: Optional[str] = None
    batch_number: Optional[str] = None
    batch_selling_price: Optional[Decimal] = None
    transaction_date: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def extract_related_names(cls, data: Any) -> Any:
        if hasattr(data, "user") and data.user:
            username = getattr(data.user, "user_name", "")
            fullname = getattr(data.user, "full_name", "")
            setattr(data, "user_name", username or fullname or "Unknown")
            setattr(data, "user_full_name", fullname or username or "")
        elif hasattr(data, "user_name") and not data.user_name:
            setattr(data, "user_name", "Unknown")

        if hasattr(data, "item") and data.item:
            setattr(data, "item_name", getattr(data.item, "item_name", ""))
            setattr(data, "sku", getattr(data.item, "sku", ""))
        elif hasattr(data, "item_name") and not data.item_name:
            setattr(data, "item_name", "Unknown")

        if hasattr(data, "supplier") and data.supplier:
            setattr(data, "supplier_name", getattr(data.supplier, "supplier_name", ""))

        if hasattr(data, "batch") and data.batch:
            setattr(data, "batch_number", getattr(data.batch, "batch_number", ""))
            setattr(data, "batch_selling_price", getattr(data.batch, "selling_price", None))

        return data
