from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
import uuid
from app.models import AlertStatus


# -------------------------- Stock alert Response model -------------------------- #
class StockAlertResponse(BaseModel):
    item_id: uuid.UUID
    status: AlertStatus
    supplier_id: uuid.UUID
    alert_id: uuid.UUID
    created_at: datetime
    resolved_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)
