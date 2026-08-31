from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime, timedelta, date
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
        if not v:
            raise ValueError("Report name cannot be empty")
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
    operator_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ReportWithDataResponse(BaseModel):
    report: ReportResponse
    data: Any | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------- #
#                           Schemas for 6 Report Types                         #
# ---------------------------------------------------------------------------- #

# 1. Overall Summary
class ValuableItemMetric(BaseModel):
    item_name: str
    sku: str
    category_name: str
    quantity: int
    cost_price: Decimal
    selling_price: Decimal
    total_cost_worth: Decimal
    total_selling_worth: Decimal


class CategorySummaryMetric(BaseModel):
    category_name: str
    item_count: int
    stock_qty: int
    stock_value: Decimal


class OverallSummaryData(BaseModel):
    total_items_in_stock: int
    total_unique_items: int
    inventory_cost_worth: Decimal
    selling_worth: Decimal
    potential_profit: Decimal
    sell_through_rate: float
    active_items_count: int
    active_items_percentage: float
    inactive_items_count: int
    inactive_items_percentage: float
    top_valuable_items: List[ValuableItemMetric] = []
    category_summary: List[CategorySummaryMetric] = []


# 2. Stock Alert / Replenishment
class AlertItemDetail(BaseModel):
    item_id: uuid.UUID
    item_name: str
    sku: str
    category_name: str
    quantity_in_stock: int
    reorder_level: int
    reorder_quantity: int
    unit: str
    cost_price: Decimal
    supplier_name: Optional[str] = None
    estimated_restock_cost: Decimal


class SupplierAlertMetric(BaseModel):
    supplier_id: Optional[uuid.UUID]
    supplier_name: Optional[str]
    critical_count: int
    low_stock_count: int
    total_count: int


class StockAlertSummaryData(BaseModel):
    global_critical_alerts: int
    global_low_stock_alerts: int
    global_total_resolved_alerts: int
    estimated_restock_cost: Decimal
    period_resolution_rate: float
    avg_mttr_critical_hours: float
    avg_mttr_low_stock_hours: float
    critical_items_list: List[AlertItemDetail] = []
    low_stock_items_list: List[AlertItemDetail] = []
    supplier_breakdown: List[SupplierAlertMetric] = []


# 3. Category Wise
class CategoryReportMetric(BaseModel):
    category_id: Optional[uuid.UUID]
    category_name: str
    item_count: int
    total_units: int
    cost_value: Decimal
    stock_value: Decimal
    margin_percentage: float
    space_used_percentage: float


class CategoryReportData(BaseModel):
    total_categories: int
    total_catalog_items: int
    total_inventory_cost: Decimal
    total_inventory_retail: Decimal
    categories: List[CategoryReportMetric] = []


# 4. Transaction Ledger
class TransactionTypeSummary(BaseModel):
    transaction_type: str
    count: int
    total_quantity: int
    total_amount: Decimal


class TransactionDetailRow(BaseModel):
    transaction_id: uuid.UUID
    transaction_date: datetime
    item_name: str
    sku: str
    transaction_type: str
    quantity: int
    previous_quantity: int
    new_quantity: int
    unit_price: Decimal
    total_amount: Decimal
    operator_name: str
    note: Optional[str] = None
    reason: Optional[str] = None


class TransactionReportData(BaseModel):
    total_transactions: int
    total_units_inflow: int
    total_units_outflow: int
    total_sales_revenue: Decimal
    total_purchase_cost: Decimal
    net_movement_value: Decimal
    type_breakdown: List[TransactionTypeSummary] = []
    transactions: List[TransactionDetailRow] = []


# 5. Stock Movement / Velocity (ABC)
class StockMovementItemRow(BaseModel):
    item_id: uuid.UUID
    item_name: str
    sku: str
    category_name: str
    unit: str
    opening_stock: int
    total_inflow: int
    total_outflow: int
    closing_stock: int
    net_change: int
    turnover_rate: float
    velocity_tier: str  # Fast, Steady, Slow, Non-Moving


class StockMovementReportData(BaseModel):
    total_tracked_items: int
    fast_moving_count: int
    steady_moving_count: int
    slow_moving_count: int
    non_moving_count: int
    items: List[StockMovementItemRow] = []


# 6. Supplier Performance & Spend
class SupplierPerformanceRow(BaseModel):
    supplier_id: uuid.UUID
    supplier_name: str
    contact_person: str
    phone: str
    email: str
    is_active: bool
    total_items_supplied: int
    total_purchase_spend: Decimal
    completed_pos: int
    pending_pos: int
    fulfillment_rate: float


class SupplierReportData(BaseModel):
    total_suppliers: int
    active_suppliers: int
    inactive_suppliers: int
    total_purchase_orders: int
    total_purchase_spend: Decimal
    completed_orders_count: int
    pending_orders_count: int
    suppliers: List[SupplierPerformanceRow] = []
