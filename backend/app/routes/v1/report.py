from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.schemas.report import ReportCreate, ReportWithDataResponse
from app.crud import report as report_crud
from app.routes.dependencies import RoleChecker

from datetime import datetime, timezone
import uuid
from app.models import UserRole, User, ReportType

router = APIRouter(prefix="/reports", tags=["reports"])


# ------------------------ New report generation route ----------------------- #
@router.post("/", response_model=ReportWithDataResponse, status_code=201)
async def create_new_report(
    report_in: ReportCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.AUDITOR])),
):
    # 1. Check uniqueness of report name; if duplicate exists, auto-append timestamp/unique tag
    existing = await report_crud.get_report_by_report_name(db, report_in.report_name)
    if existing:
        timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        report_in.report_name = f"{report_in.report_name} {timestamp_str}"
        # Double check in case of rapid creation
        existing_again = await report_crud.get_report_by_report_name(db, report_in.report_name)
        if existing_again:
            report_in.report_name = f"{report_in.report_name} {uuid.uuid4().hex[:6]}"

    # 2. Create Report row in DB
    new_report = await report_crud.create_report(
        db=db, report_in=report_in, generated_by=current_user.user_id
    )

    # 3. Fetch data if it's the Overall Summary type
    if report_in.report_type == ReportType.OVERALL_SUMMARY:
        summary_payload = await report_crud.get_overall_summary_data(
            db=db, start_date=report_in.start_date, end_date=report_in.end_date
        )
        return {"report": new_report, "data": summary_payload}
    elif report_in.report_type == ReportType.LOW_STOCK:
        stock_payload = await report_crud.get_stock_alert_report_data(
            db=db, start_date=report_in.start_date, end_date=report_in.end_date
        )
        return {"report": new_report, "data": stock_payload}
    elif report_in.report_type == ReportType.CATEGORY_WISE:
        category_payload = await report_crud.get_category_report_data(db=db)
        return {"report": new_report, "data": category_payload}
