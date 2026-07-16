from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.schemas.report import ReportCreate
from app.models import Report
from typing import Sequence
import uuid

# -------------------------- create new report crud -------------------------- #
async def create_report(
        db: AsyncSession, 
        report_in: ReportCreate,
        generated_by: uuid.UUID,
        file_path: str
) -> Report:
    new_report = Report(
        **report_in.model_dump(),
        generated_by=generated_by,
        file_path=file_path 
    )
    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)
    return new_report

# ------------------------- Crud for get all reports ------------------------- #
async def get_all_reports(db: AsyncSession) -> Sequence[Report] | None:
    result = await db.execute(select(Report))
    return result.scalars().all()

# ------------------------- crud for get by report id ------------------------ #
async def get_report_by_report_id(db: AsyncSession, report_id: uuid.UUID) -> Report | None:
    result = await db.execute(select(Report).filter(Report.report_id == report_id))
    return result.scalars().first()

# ---------------------- crud for update existing report --------------------- #
async def update_report(db : AsyncSession, db_report: Report, update_data : dict) -> Report:
    
    # 1. Apply the raw dict updates directly to the database object
    for field, value in update_data.items():
        setattr(db_report, field, value)
    # 2. Commit and refresh
    try:
        await db.commit()
        await db.refresh(db_report)
    except Exception as e:
        await db.rollback()
        raise e
        
    return db_report

# ---------------------- crud for delete report --------------------- #
async def delete_report(db : AsyncSession, report_id : uuid.UUID) -> None:
    await db.execute(delete(Report).where(Report.report_id == report_id))
    await db.commit()
    return

# ---------------------- crud for get by report name ---------------------- #
async def get_report_by_report_name(db: AsyncSession, report_name: str) -> Report | None:
    result = await db.execute(select(Report).filter(Report.report_name == report_name))
    return result.scalar_one_or_none()

