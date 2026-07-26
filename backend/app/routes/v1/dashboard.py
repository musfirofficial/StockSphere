from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.models import User, UserRole
from app.routes.dependencies import RoleChecker
from app.schemas.dashboard import DashboardResponse
from app.crud import dashboard as crud_dashboard

from typing import Optional

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# ---------------- Get the dashboard data for the current user --------------- #


@router.get("/", response_model=DashboardResponse)
async def read_dashboard_data(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
                UserRole.SALES,
                UserRole.AUDITOR,
            ]
        )
    ),
):
    # 1. Initialize ALL role-optional variables with defaults to avoid scope errors
    stockout_items_low_count: Optional[int] = None
    stockout_items_critical_count: Optional[int] = None
    draft_po_count: Optional[int] = None

    # 2. Fetch shared metrics (All Roles)
    item_in_stock_quantity = await crud_dashboard.get_item_in_stock_quantity(db)
    item_in_stock_value = await crud_dashboard.get_item_in_stock_value(db)

    # 3. Branch by Role
    if current_user.role == UserRole.SALES:
        # Sales Role Specific
        current_month_sold_value = await crud_dashboard.get_current_month_sold_value(
            db, user_id=current_user.user_id
        )
        last_7_days_sales = await crud_dashboard.get_last_7_days_sales(
            db, user_id=current_user.user_id
        )
        most_sold_item = await crud_dashboard.get_most_sold_items(
            db, limit=5, user_id=current_user.user_id
        )
        last_5_transaction = await crud_dashboard.get_last_5_transactions(
            db, user_id=current_user.user_id
        )
    else:
        # Non-Sales Roles (ADMIN, INVENTORY_MANAGER, AUDITOR)
        stockout_items_low_count = await crud_dashboard.get_stockout_items_low_count(db)
        stockout_items_critical_count = (
            await crud_dashboard.get_stockout_items_critical_count(db)
        )

        current_month_sold_value = await crud_dashboard.get_current_month_sold_value(db)
        last_7_days_sales = await crud_dashboard.get_last_7_days_sales(db)
        most_sold_item = await crud_dashboard.get_most_sold_items(db, limit=5)
        last_5_transaction = await crud_dashboard.get_last_5_transactions(db)

        # ADMIN and INVENTORY_MANAGER specific
        if current_user.role in (UserRole.ADMIN, UserRole.INVENTORY_MANAGER):
            draft_po_count = await crud_dashboard.get_draft_po_count(db)

    # 4. Safely calculate total active alerts if counts exist
    active_alerts = None
    if (
        stockout_items_low_count is not None
        or stockout_items_critical_count is not None
    ):
        active_alerts = (stockout_items_low_count or 0) + (
            stockout_items_critical_count or 0
        )

    # 5. Return complete payload safely
    return {
        "items_in_stock": item_in_stock_quantity,
        "value_of_item_in_stock": item_in_stock_value,
        "active_low_stock_alerts": stockout_items_low_count,
        "active_out_of_stock_alerts": stockout_items_critical_count,
        "active_alerts": active_alerts,
        "draft_po_count": draft_po_count,
        "sold_value": current_month_sold_value,
        "sales_trend": last_7_days_sales,
        "most_sold_items": most_sold_item,
        "recent_transaction": last_5_transaction,
    }
