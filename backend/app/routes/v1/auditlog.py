from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.schemas.auditlog import AuditLogResponse
from app.crud import auditlog as auditlog_crud
from app.models import User, UserRole
from app.routes.dependencies import RoleChecker

router = APIRouter(prefix="/auditlogs", tags=["auditlogs"])


# ---------------------------- Get all audit logs ---------------------------- #
@router.get("/", response_model=list[AuditLogResponse])
async def get_audit_logs(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(RoleChecker([UserRole.ADMIN])),
    page: int = 1,
    limit: int = 10,
):
    offset = (page - 1) * limit
    audit_logs = await auditlog_crud.get_audit_logs(db, limit=limit, offset=offset)
    if audit_logs is None:
        return []
    return audit_logs
