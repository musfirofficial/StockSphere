from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload, selectinload
from typing import Sequence
from app.schemas.item import ItemCreate
from app.models import Item, ItemSupplier, StockBatch, StockAlert, AlertStatus
import uuid


# --------------------------- create new item crud --------------------------- #
async def create_item(db: AsyncSession, item_in: ItemCreate) -> Item:
    new_item = Item(**item_in.model_dump())
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    created = await get_item_by_item_id(db, new_item.item_id)
    return created or new_item


# -------------------------- crud for get all items -------------------------- #
async def get_all_items(db: AsyncSession) -> Sequence[Item]:
    result = await db.execute(
        select(Item)
        .options(
            joinedload(Item.category),
            joinedload(Item.unit_rel),
            selectinload(Item.item_suppliers).joinedload(ItemSupplier.supplier),
            selectinload(Item.stock_batches),
        )
        .order_by(Item.item_name.asc())
    )
    return result.unique().scalars().all()


# ----------------------- crud for update existing item ---------------------- #
async def update_item(db: AsyncSession, db_item: Item, update_data: dict):
    # 1. Apply the raw dict updates directly to the database object
    for field, value in update_data.items():
        setattr(db_item, field, value)
    # 2. Commit and refresh
    try:
        await db.commit()
        await db.refresh(db_item)
        updated = await get_item_by_item_id(db, db_item.item_id)
        return updated or db_item
    except Exception as e:
        await db.rollback()
        raise e


# ----------------------------- Delete Item crud ----------------------------- #
async def delete_item(db: AsyncSession, item_id: uuid.UUID) -> None:
    await db.execute(delete(Item).where(Item.item_id == item_id))
    await db.commit()
    return


# -------------------------- Crud for get Item by ID ------------------------- #
async def get_item_by_item_id(db: AsyncSession, item_id: uuid.UUID) -> Item | None:
    result = await db.execute(
        select(Item)
        .options(
            joinedload(Item.category),
            joinedload(Item.unit_rel),
            selectinload(Item.item_suppliers).joinedload(ItemSupplier.supplier),
            selectinload(Item.stock_batches),
        )
        .where(Item.item_id == item_id)
    )
    return result.unique().scalar_one_or_none()


# ------------------- Get items with low stock alert for PO ------------------ #
async def get_items_with_active_stock_alerts(
    db: AsyncSession, po_supplier_id: uuid.UUID
) -> Sequence[Item] | None:
    alert_items_result = await db.execute(
        select(Item)
        .join(StockAlert, StockAlert.item_id == Item.item_id)
        .where(
            StockAlert.supplier_id == po_supplier_id,
            StockAlert.status != AlertStatus.RESOLVED,
        )
    )
    return alert_items_result.scalars().all()
