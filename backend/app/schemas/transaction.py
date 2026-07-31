from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional
from datetime import datetime
import uuid
from app.models import TransactionType


# -------------------------- Transaction base modal -------------------------- #
class TransactionBase(BaseModel):
    item_id: uuid.UUID
    transaction_type: TransactionType
    quantity: int
    note: Optional[str]


class TransactionCreate(TransactionBase):
    pass


class TransactionResponse(TransactionBase):
    previous_quantity: int
    new_quantity: int
    transaction_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_name: str = ""
    item_name: str = ""
    transaction_date: datetime
    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def extract_related_names(cls, data):
        if hasattr(data, "user") and data.user:
            data.user_name = data.user.full_name
        elif hasattr(data, "user_name") and not data.user_name:
            data.user_name = "Unknown"

        if hasattr(data, "item") and data.item:
            data.item_name = data.item.item_name
        elif hasattr(data, "item_name") and not data.item_name:
            data.item_name = "Unknown"
        return data
