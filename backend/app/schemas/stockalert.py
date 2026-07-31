from pydantic import BaseModel, ConfigDict, model_validator
from typing import Optional, Any
from datetime import datetime
import uuid
from app.models import AlertStatus


# -------------------------- Stock alert Response model -------------------------- #
class StockAlertResponse(BaseModel):
    item_id: uuid.UUID
    item_name: str = ""
    status: AlertStatus
    supplier_id: Optional[uuid.UUID] = None
    supplier_name: str = ""
    alert_id: uuid.UUID
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def extract_names(cls, data: Any) -> Any:
        # 1. Handle ORM Object / Object attributes
        if not isinstance(data, dict):
            if getattr(data, "supplier", None):
                setattr(
                    data, "supplier_name", getattr(data.supplier, "supplier_name", "")
                )
            if getattr(data, "item", None):
                setattr(data, "item_name", getattr(data.item, "item_name", ""))
            return data

        # 2. Handle Dictionary input
        if supplier := data.get("supplier"):
            data["supplier_name"] = (
                supplier.get("supplier_name", "")
                if isinstance(supplier, dict)
                else getattr(supplier, "supplier_name", "")
            )
        if item := data.get("item"):
            data["item_name"] = (
                item.get("item_name", "")
                if isinstance(item, dict)
                else getattr(item, "item_name", "")
            )

        return data
