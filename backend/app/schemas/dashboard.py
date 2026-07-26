from pydantic import BaseModel, ConfigDict, field_serializer

from typing import Optional
from decimal import Decimal
from app.schemas.transaction import TransactionResponse


# ------------------------- Dashboard Response Schema ------------------------ #
class MostSoldItem(BaseModel):
    name: str
    quantity_sold: int


class DashboardResponse(BaseModel):
    items_in_stock: Optional[int] = None
    value_of_item_in_stock: Optional[Decimal] = None
    active_low_stock_alerts: Optional[int] = None
    active_out_of_stock_alerts: Optional[int] = None
    active_alerts: Optional[int] = None
    draft_po_count: Optional[int] = None
    sold_value: Optional[Decimal] = None
    sales_trend: list[Decimal] = []
    most_sold_items: list[MostSoldItem] = []
    recent_transaction: Optional[list[TransactionResponse]] = None

    model_config = ConfigDict(from_attributes=True)

    # Formats target Decimal fields into '123,456.78' format during JSON serialization
    @field_serializer("value_of_item_in_stock", "sold_value", mode="plain")
    def format_currency(self, value: Optional[Decimal]) -> Optional[str]:
        if value is None:
            return None
        return f"{value:,.2f}"

    @field_serializer("sales_trend", mode="plain")
    def format_sales_trend(self, values: list[Decimal]) -> list[str]:
        return [f"{v:,.2f}" for v in values]
