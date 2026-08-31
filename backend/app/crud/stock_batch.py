from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload
from typing import Sequence, Optional
from datetime import date, timedelta
from decimal import Decimal
import uuid

from app.models import StockBatch, Item, Supplier


# --------------------- Get batches for an item ------------------------------ #
async def get_batches_for_item(
    db: AsyncSession,
    item_id: uuid.UUID,
    supplier_id: Optional[uuid.UUID] = None,
    active_only: bool = True,
) -> Sequence[StockBatch]:
    stmt = (
        select(StockBatch)
        .options(joinedload(StockBatch.supplier), joinedload(StockBatch.item))
        .where(StockBatch.item_id == item_id)
    )
    if supplier_id:
        stmt = stmt.where(StockBatch.supplier_id == supplier_id)
    if active_only:
        stmt = stmt.where(StockBatch.current_quantity > 0)

    stmt = stmt.order_by(StockBatch.expiry_date.asc().nullslast(), StockBatch.created_at.asc())
    result = await db.execute(stmt)
    return result.unique().scalars().all()


# --------------------- Get batch by ID -------------------------------------- #
async def get_batch_by_id(db: AsyncSession, batch_id: uuid.UUID) -> StockBatch | None:
    result = await db.execute(
        select(StockBatch)
        .options(joinedload(StockBatch.supplier), joinedload(StockBatch.item))
        .where(StockBatch.batch_id == batch_id)
    )
    return result.unique().scalar_one_or_none()


# --------------------- Create or increment batch ---------------------------- #
async def create_or_increment_batch(
    db: AsyncSession,
    item_id: uuid.UUID,
    supplier_id: uuid.UUID,
    batch_number: str,
    purchase_price: Decimal,
    quantity: int,
    expiry_date: Optional[date] = None,
    po_id: Optional[uuid.UUID] = None,
    selling_price: Optional[Decimal] = None,
) -> StockBatch:
    # Check if a matching batch exists
    stmt = select(StockBatch).where(
        StockBatch.item_id == item_id,
        StockBatch.supplier_id == supplier_id,
        StockBatch.batch_number == batch_number,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.current_quantity += quantity
        existing.initial_quantity += quantity
        if expiry_date:
            existing.expiry_date = expiry_date
        if selling_price is not None:
            existing.selling_price = selling_price
        await db.commit()
        await db.refresh(existing)
        return existing

    # Create new batch
    new_batch = StockBatch(
        item_id=item_id,
        supplier_id=supplier_id,
        po_id=po_id,
        batch_number=batch_number,
        purchase_price=purchase_price,
        selling_price=selling_price,
        initial_quantity=quantity,
        current_quantity=quantity,
        expiry_date=expiry_date,
    )
    db.add(new_batch)
    await db.commit()
    await db.refresh(new_batch)
    return new_batch


# --------------------- Decrement batch stock -------------------------------- #
async def decrement_batch_stock(
    db: AsyncSession, batch_id: uuid.UUID, quantity: int
) -> StockBatch:
    batch = await get_batch_by_id(db, batch_id)
    if not batch:
        raise ValueError("Stock batch not found")
    if batch.current_quantity < quantity:
        raise ValueError(
            f"Insufficient batch quantity: batch has {batch.current_quantity}, requested {quantity}"
        )

    batch.current_quantity -= quantity
    await db.commit()
    await db.refresh(batch)
    return batch


# --------------------- Increment batch stock -------------------------------- #
async def increment_batch_stock(
    db: AsyncSession, batch_id: uuid.UUID, quantity: int
) -> StockBatch:
    batch = await get_batch_by_id(db, batch_id)
    if not batch:
        raise ValueError("Stock batch not found")

    batch.current_quantity += quantity
    await db.commit()
    await db.refresh(batch)
    return batch


# --------------------- Get expiring batches --------------------------------- #
async def get_expiring_batches(
    db: AsyncSession, within_days: int = 30
) -> Sequence[StockBatch]:
    today = date.today()
    limit_date = today + timedelta(days=within_days)

    stmt = (
        select(StockBatch)
        .options(joinedload(StockBatch.item), joinedload(StockBatch.supplier))
        .where(
            StockBatch.expiry_date.isnot(None),
            StockBatch.expiry_date <= limit_date,
            StockBatch.current_quantity > 0,
        )
        .order_by(StockBatch.expiry_date.asc())
    )
    result = await db.execute(stmt)
    return result.unique().scalars().all()
