from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.schemas.report import ReportCreate, ReportWithDataResponse, ReportResponse
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
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER, UserRole.AUDITOR])
    ),
):
    # 1. Check uniqueness of report name; if duplicate exists, auto-append timestamp/unique tag
    existing = await report_crud.get_report_by_report_name(db, report_in.report_name)
    if existing:
        timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        report_in.report_name = f"{report_in.report_name} {timestamp_str}"
        existing_again = await report_crud.get_report_by_report_name(db, report_in.report_name)
        if existing_again:
            report_in.report_name = f"{report_in.report_name} {uuid.uuid4().hex[:6]}"

    # 2. Create Report row in DB
    new_report = await report_crud.create_report(
        db=db, report_in=report_in, generated_by=current_user.user_id
    )

    # 3. Generate data payload based on ReportType
    payload = None
    if report_in.report_type == ReportType.OVERALL_SUMMARY:
        payload = await report_crud.get_overall_summary_data(
            db=db, start_date=report_in.start_date, end_date=report_in.end_date
        )
    elif report_in.report_type == ReportType.LOW_STOCK:
        payload = await report_crud.get_stock_alert_report_data(
            db=db, start_date=report_in.start_date, end_date=report_in.end_date
        )
    elif report_in.report_type == ReportType.CATEGORY_WISE:
        payload = await report_crud.get_category_report_data(db=db)
    elif report_in.report_type == ReportType.TRANSACTION:
        payload = await report_crud.get_transaction_report_data(
            db=db, start_date=report_in.start_date, end_date=report_in.end_date
        )
    elif report_in.report_type == ReportType.STOCK_MOVEMENT:
        payload = await report_crud.get_stock_movement_report_data(
            db=db, start_date=report_in.start_date, end_date=report_in.end_date
        )
    elif report_in.report_type == ReportType.SUPPLIER:
        payload = await report_crud.get_supplier_report_data(
            db=db, start_date=report_in.start_date, end_date=report_in.end_date
        )

    # Build response model with operator name
    report_dict = {
        "report_id": new_report.report_id,
        "report_name": new_report.report_name,
        "report_type": new_report.report_type,
        "file_format": new_report.file_format,
        "start_date": new_report.start_date,
        "end_date": new_report.end_date,
        "generated_by": new_report.generated_by,
        "generated_at": new_report.generated_at,
        "operator_name": current_user.user_name,
    }

    return {"report": report_dict, "data": payload}


# ----------------------- List all generated reports ------------------------ #
@router.get("/", response_model=list[ReportResponse])
async def list_reports(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER, UserRole.AUDITOR])
    ),
):
    reports = await report_crud.get_all_reports(db)
    resp = []
    for r in reports:
        resp.append(
            ReportResponse(
                report_id=r.report_id,
                report_name=r.report_name,
                report_type=r.report_type,
                file_format=r.file_format,
                start_date=r.start_date,
                end_date=r.end_date,
                generated_by=r.generated_by,
                generated_at=r.generated_at,
                operator_name=r.user.user_name if r.user else "System",
            )
        )
    return resp


# ----------------------- Get single report with data ----------------------- #
@router.get("/{report_id}", response_model=ReportWithDataResponse)
async def get_report_details(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER, UserRole.AUDITOR])
    ),
):
    r = await report_crud.get_report_by_report_id(db, report_id)
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")

    payload = None
    start_dt = datetime.combine(r.start_date, datetime.min.time()) if hasattr(r.start_date, "strftime") and not isinstance(r.start_date, datetime) else r.start_date
    end_dt = datetime.combine(r.end_date, datetime.max.time()) if hasattr(r.end_date, "strftime") and not isinstance(r.end_date, datetime) else r.end_date

    if r.report_type == ReportType.OVERALL_SUMMARY:
        payload = await report_crud.get_overall_summary_data(db=db, start_date=start_dt, end_date=end_dt)
    elif r.report_type == ReportType.LOW_STOCK:
        payload = await report_crud.get_stock_alert_report_data(db=db, start_date=start_dt, end_date=end_dt)
    elif r.report_type == ReportType.CATEGORY_WISE:
        payload = await report_crud.get_category_report_data(db=db)
    elif r.report_type == ReportType.TRANSACTION:
        payload = await report_crud.get_transaction_report_data(db=db, start_date=start_dt, end_date=end_dt)
    elif r.report_type == ReportType.STOCK_MOVEMENT:
        payload = await report_crud.get_stock_movement_report_data(db=db, start_date=start_dt, end_date=end_dt)
    elif r.report_type == ReportType.SUPPLIER:
        payload = await report_crud.get_supplier_report_data(db=db, start_date=start_dt, end_date=end_dt)

    report_dict = {
        "report_id": r.report_id,
        "report_name": r.report_name,
        "report_type": r.report_type,
        "file_format": r.file_format,
        "start_date": r.start_date,
        "end_date": r.end_date,
        "generated_by": r.generated_by,
        "generated_at": r.generated_at,
        "operator_name": r.user.user_name if r.user else "System",
    }

    return {"report": report_dict, "data": payload}


# --------------------------- Delete a report -------------------------------- #
@router.delete("/{report_id}", status_code=204)
async def delete_report_endpoint(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(RoleChecker([UserRole.ADMIN])),
):
    r = await report_crud.get_report_by_report_id(db, report_id)
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    await report_crud.delete_report(db, report_id)
