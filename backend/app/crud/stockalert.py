from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models import AlertStatus, StockAlert, Item
from app.models import local_tz
from datetime import datetime
from typing import Sequence
import uuid


# ------------------------ Create new transaction crud ----------------------- #
async def create_stockalert(
    db: AsyncSession,
    item_id: uuid.UUID,
    supplier_id: uuid.UUID | None,
    status: AlertStatus,
) -> StockAlert:
    stockalert = StockAlert(
        item_id=item_id,
        supplier_id=supplier_id,
        status=status,
    )
    db.add(stockalert)
    await db.flush()
    await db.refresh(stockalert)
    return stockalert


# ------------------------ Get existing active alert crud ------------------- #
async def get_item_alert(db: AsyncSession, item: Item) -> StockAlert | None:
    result = await db.execute(
        select(StockAlert).where(
            StockAlert.item_id == item.item_id,
            StockAlert.status != AlertStatus.RESOLVED,
        )
    )
    return result.scalar_one_or_none()



# ------------------------ Update existing alert crud ------------------------ #
async def update_alert_status(
    db: AsyncSession,
    db_alert: StockAlert,
    new_status: AlertStatus,
) -> StockAlert:
    db_alert.status = new_status
    if new_status == AlertStatus.RESOLVED:
        db_alert.resolved_at = datetime.now(local_tz)
    await db.flush()
    await db.refresh(db_alert)
    return db_alert


# ------------------------ Get all stock alerts crud ------------------------ #
async def get_all_stockalerts(db: AsyncSession) -> Sequence[StockAlert]:
    query = (
        select(StockAlert)
        .options(selectinload(StockAlert.supplier), selectinload(StockAlert.item))
        .order_by(StockAlert.created_at.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()
