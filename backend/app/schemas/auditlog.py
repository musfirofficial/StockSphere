from pydantic import BaseModel, ConfigDict
from typing import Optional
import uuid
from app.models import AuditAction

class AuditLogBase(BaseModel):
    user_id: Optional[uuid.UUID] =  None
    action: AuditAction
    description: str
    target_table: str
    target_id: uuid.UUID
    old_value: Optional[str] =  None
    new_value: Optional [str] = None

class AuditlogCreate(AuditLogBase):
    pass

class AuditLogResponse(AuditLogBase):
    log_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
