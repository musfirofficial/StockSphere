from pydantic import BaseModel, ConfigDict
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
    user_id: uuid.UUID
    transaction_date: datetime
    model_config = ConfigDict(from_attributes=True)