from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract, cast, Date, desc, or_, case
from sqlalchemy.orm import joinedload
from app.schemas.dashboard import MostSoldItem
from app.schemas.transaction import TransactionResponse
from datetime import datetime, timedelta, timezone
from app.models import (
    Item,
    PurchaseOrder,
    POStatus,
    Transaction,
    TransactionType,
)
from decimal import Decimal
from typing import Sequence, Optional
import uuid

local_tz = datetime.now().astimezone().tzinfo

SOLD_TYPES = [TransactionType.SOLD, TransactionType.STOCK_OUT]


# -------------------------- Get Item in stock data -------------------------- #
async def get_item_in_stock_quantity(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.coalesce(func.sum(Item.quantity_in_stock), 0)).where(
            Item.quantity_in_stock > 0, Item.is_active == True
        )
    )
    return result.scalar_one()


async def get_item_in_stock_value(db: AsyncSession) -> Decimal:
    result = await db.execute(
        select(
            func.coalesce(func.sum(Item.quantity_in_stock * Item.cost_price), 0)
        ).where(Item.quantity_in_stock > 0, Item.is_active == True)
    )
    return Decimal(str(result.scalar_one()))


# ------------------------- Get Stockout Items count ------------------------- #
async def get_stockout_items_low_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(Item.item_id)).where(
            Item.is_active == True,
            Item.quantity_in_stock > 0,
            Item.quantity_in_stock <= Item.reorder_level,
        )
    )
    return result.scalar_one()


async def get_stockout_items_critical_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(Item.item_id)).where(
            Item.is_active == True,
            Item.quantity_in_stock <= 0,
        )
    )
    return result.scalar_one()


# -------------------------- Existing Active PO count ------------------------ #
async def get_draft_po_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(PurchaseOrder.po_id)).where(
            PurchaseOrder.status.in_(
                [
                    POStatus.DRAFT,
                    POStatus.PENDING_APPROVAL,
                    POStatus.APPROVED,
                    POStatus.PARTIALLY_RECEIVED,
                ]
            )
        )
    )
    return result.scalar_one()


# --------------------------- This month sold value -------------------------- #
async def get_current_month_sold_value(
    db: AsyncSession, user_id: Optional[uuid.UUID] = None
) -> Decimal:
    now = datetime.now(timezone.utc)
    start_of_month = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)
    if now.month == 12:
        next_month_start = datetime(now.year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    else:
        next_month_start = datetime(now.year, now.month + 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    query = (
        select(
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.unit_price.isnot(None), Transaction.quantity * Transaction.unit_price),
                        else_=Transaction.quantity * Item.selling_price,
                    )
                ),
                0,
            )
        )
        .join(Transaction.item)
        .where(
            Transaction.transaction_type.in_(SOLD_TYPES),
            Transaction.transaction_date >= start_of_month,
            Transaction.transaction_date < next_month_start,
        )
    )

    if user_id is not None:
        query = query.where(Transaction.user_id == user_id)

    result = await db.execute(query)
    return Decimal(str(result.scalar_one() or 0)).quantize(Decimal("0.01"))


# -------------------------------- Sales Trend ------------------------------- #
async def get_last_7_days_sales(
    db: AsyncSession, user_id: Optional[uuid.UUID] = None
) -> Sequence[Decimal]:
    now_utc = datetime.now(timezone.utc)
    today = now_utc.date()
    start_date = today - timedelta(days=6)
    start_dt = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)

    query = (
        select(
            Transaction.transaction_date,
            func.coalesce(
                case(
                    (Transaction.unit_price.isnot(None), Transaction.quantity * Transaction.unit_price),
                    else_=Transaction.quantity * Item.selling_price,
                ),
                0,
            ).label("amount"),
        )
        .join(Transaction.item)
        .where(
            Transaction.transaction_type.in_(SOLD_TYPES),
            Transaction.transaction_date >= start_dt,
            Transaction.transaction_date <= end_dt,
        )
    )

    if user_id is not None:
        query = query.where(Transaction.user_id == user_id)

    result = await db.execute(query)
    rows = result.fetchall()

    daily_map = {start_date + timedelta(days=i): Decimal("0.00") for i in range(7)}
    for row in rows:
        tx_dt = row.transaction_date
        if hasattr(tx_dt, "date"):
            tx_d = tx_dt.date()
        else:
            tx_d = datetime.fromisoformat(str(tx_dt)[:10]).date()
        if tx_d in daily_map:
            daily_map[tx_d] += Decimal(str(row.amount or 0))

    return [daily_map[start_date + timedelta(days=i)].quantize(Decimal("0.01")) for i in range(7)]


# ------------------------ Get Most Sold Items ------------------------------- #
async def get_most_sold_items(
    db: AsyncSession, limit: int = 5, user_id: Optional[uuid.UUID] = None
) -> Sequence[MostSoldItem]:
    query = (
        select(
            Item.item_name.label("name"),
            func.sum(Transaction.quantity).label("quantity_sold"),
        )
        .join(Transaction.item)
        .where(Transaction.transaction_type.in_(SOLD_TYPES))
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
    query = (
        select(Transaction)
        .options(
            joinedload(Transaction.item),
            joinedload(Transaction.user),
            joinedload(Transaction.supplier),
            joinedload(Transaction.batch),
        )
        .order_by(Transaction.transaction_date.desc())
    )

    if user_id is not None:
        query = query.where(Transaction.user_id == user_id)

    query = query.limit(5)
    result = await db.execute(query)
    db_transactions = result.unique().scalars().all()

    return [TransactionResponse.model_validate(tx) for tx in db_transactions]
