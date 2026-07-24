from pydantic import BaseModel, ConfigDict
from typing import Optional
import uuid
from app.models import AuditAction
from datetime import datetime


class AuditLogBase(BaseModel):
    user_id: Optional[uuid.UUID] = None
    action: AuditAction
    description: str
    target_table: str
    target_id: Optional[uuid.UUID] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None


class AuditlogCreate(AuditLogBase):
    pass


class AuditLogResponse(BaseModel):
    action: Optional[AuditAction] = None
    description: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
