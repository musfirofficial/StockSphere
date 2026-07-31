from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.schemas.stockalert import StockAlertResponse
from app.crud import stockalert as crud_stockalert
from app.routes.dependencies import RoleChecker
from app.models import User, UserRole

router = APIRouter(prefix="/stock-alerts", tags=["stock-alerts"])


# ----------------------- Get all stock alerts endpoint ----------------------- #
@router.get("/", response_model=list[StockAlertResponse])
async def get_all_stock_alerts(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
                UserRole.AUDITOR,
            ]
        )
    ),
):
    alerts = await crud_stockalert.get_all_stockalerts(db)
    return alerts
