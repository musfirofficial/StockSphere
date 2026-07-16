from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import date, datetime
import uuid
import re
from app.models import ReportType, FileFormat

# ----------------------------- Report base mdoel ---------------------------- #
class ReportBase(BaseModel):
    report_name: str = Field(min_length=3, max_length=100)
    report_type: ReportType
    file_format: FileFormat
    start_date: date
    end_date: date

    @field_validator('report_name')
    @classmethod
    def clean_input(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[a-zA-Z0-9\s]+$", v):
            raise ValueError("Report name can only contain letters, numbers, and spaces")
        return v

class ReportCreate(ReportBase):
    pass

class ReportResponse(ReportBase):
    report_id: uuid.UUID
    generated_by: uuid.UUID
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)
    