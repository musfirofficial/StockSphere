from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.schemas.report import ReportCreate, ReportResponse
from app.crud import report as report_crud
from app.routes.dependencies import RoleChecker
from app.services.report_generator import generate, build_file_path
from app.models import UserRole, User

router = APIRouter(prefix="/reports", tags=["reports"])

# ------------------------ New report generation route ----------------------- #
@router.post("/",response_model=ReportResponse, status_code=201)
async def create_new_report(
    report_in: ReportCreate,
    db : AsyncSession = Depends(get_async_session),
    current_user: User  = Depends(RoleChecker([
        UserRole.ADMIN,
        UserRole.AUDITOR
    ]))
):
    # 1. Check uniqueness of report
    existing = await report_crud.get_report_by_report_name(db, report_in.report_name)
    if existing:
        raise HTTPException(status_code=400, detail="Report name is already taken")
    
    # 2. Build File Path
    relative_path, full_path = build_file_path(
    report_in.report_name, 
    report_in.file_format)

    #3. Generate PDF or CSV
    await generate(report_in, full_path, report_type=None)

    #4. Store in DB
    result  = await report_crud.create_report(
        db = db,
        report_in=report_in,
        generated_by=current_user.user_id,
        file_path=relative_path
    )
    return result

