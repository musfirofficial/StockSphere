from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime, timedelta
import uuid
import re
from app.models import ReportType, FileFormat
from typing import List, Any, Optional
from decimal import Decimal


# ----------------------------- Report base model ---------------------------- #
class ReportBase(BaseModel):
    report_name: str = Field(min_length=3, max_length=100)
    report_type: ReportType
    file_format: FileFormat = FileFormat.PDF
    start_date: datetime
    end_date: datetime

    @field_validator("report_name")
    @classmethod
    def clean_input(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[a-zA-Z0-9\s]+$", v):
            raise ValueError(
                "Report name can only contain letters, numbers, and spaces"
            )
        return v

    @field_validator("end_date")
    @classmethod
    def validate_date_range(cls, v: datetime, info):
        start_date = info.data.get("start_date")
        if start_date and v < start_date:
            raise ValueError("end_date cannot be earlier than start_date")
        if start_date and (v - start_date) > timedelta(days=366):
            raise ValueError("Date range cannot exceed a maximum of 12 months")
        return v


class ReportCreate(ReportBase):
    pass


class ReportResponse(ReportBase):
    report_id: uuid.UUID
    generated_by: Optional[uuid.UUID] = None
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReportWithDataResponse(BaseModel):
    report: ReportResponse
    data: Any | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------- #
#                           Schmeas for reportt types                          #
# ---------------------------------------------------------------------------- #


# ------------------------------ Overall Summary ----------------------------- #
class MonthlyTrendMetric(BaseModel):
    month: str  # e.g., "Jan", "Feb"
    inventory_value: float = Field(
        ..., description="Calculated worth of inventory during that month"
    )
    sales_value: float = Field(
        ..., description="Total sales income generated during that month"
    )


class OverallSummaryData(BaseModel):
    total_items_in_stock: int
    inventory_cost_worth: Decimal
    selling_worth: Decimal
    sell_through_rate: float
    active_items_count: int
    active_items_percentage: float
    inactive_items_count: int
    inactive_items_percentage: float
    chart_data: List[MonthlyTrendMetric]


# ---------------------------------------------------------------------------- #
#                            Schemas for Stock Alert                           #
# ---------------------------------------------------------------------------- #
class AlertTrendPoint(BaseModel):
    month: str
    critical_count: int
    low_stock_count: int


class SupplierAlertMetric(BaseModel):
    supplier_id: Optional[uuid.UUID]
    supplier_name: Optional[str]
    critical_count: int
    low_stock_count: int
    total_count: int


class StockAlertSummaryData(BaseModel):
    # Core Global Metrics (Not bound by date range)
    global_critical_alerts: int
    global_low_stock_alerts: int
    global_total_resolved_alerts: int
    estimated_restock_cost: Decimal = Field(
        ..., description="Cost required to bring items back to reorder levels"
    )

    # Date Range Specific Metrics
    period_resolution_rate: float = Field(
        ..., description="Resolved in Period / Created in Period"
    )
    avg_mttr_critical_hours: float = Field(
        ..., description="Mean Time To Resolution for Critical Alerts in hours"
    )
    avg_mttr_low_stock_hours: float = Field(
        ..., description="Mean Time To Resolution for Low Stock Alerts in hours"
    )

    # Visualizations / Breakdown sets
    chart_data: List[AlertTrendPoint]
    supplier_breakdown: List[SupplierAlertMetric]
