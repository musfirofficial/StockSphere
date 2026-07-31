from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, cast, Date, desc
from sqlalchemy.orm import selectinload
from app.schemas.dashboard import MostSoldItem
from app.schemas.transaction import TransactionResponse
from datetime import datetime, timedelta
from app.models import (
    Item,
    StockAlert,
    AlertStatus,
    PurchaseOrder,
    POType,
    Transaction,
    TransactionType,
)
from decimal import Decimal
from typing import Sequence, Optional
import uuid

local_tz = datetime.now().astimezone().tzinfo


# -------------------------- Get Item in stock data -------------------------- #
async def get_item_in_stock_quantity(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(Item.quantity_in_stock), 0)).where(
            Item.quantity_in_stock > 0
        )
    )
    return result.scalar_one()


async def get_item_in_stock_value(db: AsyncSession) -> Decimal:
    # coalesce replaces NULL with 0 if no rows match
    result = await db.execute(
        select(
            func.coalesce(func.sum(Item.quantity_in_stock * Item.cost_price), 0)
        ).where(Item.quantity_in_stock > 0)
    )
    return Decimal(str(result.scalar_one()))


# ------------------------- Get Stockout Items count ------------------------- #
async def get_stockout_items_low_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(func.distinct(StockAlert.item_id))).where(
            StockAlert.status == AlertStatus.LOW_STOCK
        )
    )
    return result.scalar_one()


async def get_stockout_items_critical_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(func.distinct(StockAlert.item_id))).where(
            StockAlert.status == AlertStatus.CRITICAL
        )
    )
    return result.scalar_one()


# -------------------------- Existing Draft PO count ------------------------- #
async def get_draft_po_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(func.distinct(PurchaseOrder.po_id))).where(
            PurchaseOrder.po_type == POType.DRAFT
        )
    )
    return result.scalar_one()


# --------------------------- This month sold value -------------------------- #
async def get_current_month_sold_value(
    db: AsyncSession, user_id: Optional[uuid.UUID] = None
) -> Decimal:
    now = datetime.now(local_tz)
    query = (
        select(
            func.coalesce(
                func.sum(Transaction.quantity * Item.selling_price),
                0,
            )
        )
        .join(Transaction.item)
        .where(
            Transaction.transaction_type == TransactionType.STOCK_OUT,
            extract("year", Transaction.transaction_date) == now.year,
            extract("month", Transaction.transaction_date) == now.month,
        )
    )

    if user_id is not None:
        query = query.where(Transaction.user_id == user_id)

    result = await db.execute(query)
    return Decimal(str(result.scalar_one()))


# -------------------------------- Sales Trend ------------------------------- #
async def get_last_7_days_sales(
    db: AsyncSession, user_id: Optional[uuid.UUID] = None
) -> Sequence[Decimal]:
    # Get current local date (computed dynamically at call time)
    today = datetime.now(local_tz).date()
    start_date = today - timedelta(days=6)

    # Cast timestamp to Date for daily grouping
    date_col = cast(Transaction.transaction_date, Date)

    query = (
        select(
            date_col.label("date"),
            func.sum(Transaction.quantity * Item.selling_price).label("daily_total"),
        )
        .join(Transaction.item)
        .where(
            Transaction.transaction_type == TransactionType.STOCK_OUT,
            date_col >= start_date,
            date_col <= today,
        )
    )

    # Dynamically append user filter if user_id is provided
    if user_id is not None:
        query = query.where(Transaction.user_id == user_id)

    query = query.group_by(date_col)

    result = await db.execute(query)
    sales_by_date = {row.date: row.daily_total for row in result.all()}
    last_7_days_totals: list[Decimal] = []
    for i in range(7):
        current_day = start_date + timedelta(days=i)
        daily_val = sales_by_date.get(current_day, Decimal("0.00"))
        last_7_days_totals.append(daily_val)

    return last_7_days_totals


# ------------------------ Get Most Sold Items ------------------------------- #
async def get_most_sold_items(
    db: AsyncSession, limit: int = 5, user_id: Optional[uuid.UUID] = None
) -> Sequence[MostSoldItem]:
    # Match the column aliases directly to your Pydantic field names
    query = (
        select(
            Item.item_name.label("name"),
            func.sum(Transaction.quantity).label("quantity_sold"),
        )
        .join(Transaction.item)
        .where(Transaction.transaction_type == TransactionType.STOCK_OUT)
    )

    if user_id is not None:
        query = query.where(Transaction.user_id == user_id)

    query = (
        query.group_by(Item.item_id, Item.item_name)
        .order_by(desc("quantity_sold"))
        .limit(limit)
    )

    result = await db.execute(query)
    mappings = result.mappings().all()
    most_sold_list = []
    for row in mappings:
        item_model = MostSoldItem(**row)
        most_sold_list.append(item_model)

    return most_sold_list


# ---------------------------- Last 5 Transactions --------------------------- #
async def get_last_5_transactions(
    db: AsyncSession, user_id: Optional[uuid.UUID] = None
) -> Sequence[TransactionResponse]:
    # Eagerly load .item and .user so Pydantic's model_validator doesn't
    # trigger synchronous lazy-loads inside an async session (MissingGreenlet).
    query = (
        select(Transaction)
        .options(selectinload(Transaction.item), selectinload(Transaction.user))
        .order_by(Transaction.transaction_date.desc())
    )

    if user_id is not None:
        query = query.where(Transaction.user_id == user_id)

    query = query.limit(5)
    result = await db.execute(query)
    db_transactions = result.scalars().all()

    return [TransactionResponse.model_validate(tx) for tx in db_transactions]
