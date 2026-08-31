from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from sqlalchemy.orm import joinedload
from typing import Sequence
import uuid
from decimal import Decimal

from app.models import ItemSupplier, Supplier, Item
from app.schemas.item_supplier import ItemSupplierCreate, ItemSupplierUpdate


# --------------------- Get all suppliers linked to an item ------------------- #
async def get_item_suppliers(db: AsyncSession, item_id: uuid.UUID) -> Sequence[ItemSupplier]:
    result = await db.execute(
        select(ItemSupplier)
        .options(joinedload(ItemSupplier.supplier))
        .where(ItemSupplier.item_id == item_id)
        .order_by(ItemSupplier.is_primary.desc(), ItemSupplier.created_at.asc())
    )
    return result.unique().scalars().all()


# --------------------- Get single item-supplier relation -------------------- #
async def get_item_supplier(
    db: AsyncSession, item_id: uuid.UUID, supplier_id: uuid.UUID
) -> ItemSupplier | None:
    result = await db.execute(
        select(ItemSupplier)
        .options(joinedload(ItemSupplier.supplier))
        .where(
            ItemSupplier.item_id == item_id,
            ItemSupplier.supplier_id == supplier_id,
        )
    )
    return result.unique().scalar_one_or_none()


# ------------------------ Link a supplier to an item ------------------------ #
async def add_item_supplier(
    db: AsyncSession, item_id: uuid.UUID, supplier_in: ItemSupplierCreate
) -> ItemSupplier:
    # If set as primary, unset other primaries for this item
    if supplier_in.is_primary:
        await db.execute(
            update(ItemSupplier)
            .where(ItemSupplier.item_id == item_id)
            .values(is_primary=False)
        )

    # Check if this is the very first supplier for the item, if so make it primary by default
    existing = await get_item_suppliers(db, item_id)
    is_primary = supplier_in.is_primary or (len(existing) == 0)

    new_rel = ItemSupplier(
        item_id=item_id,
        supplier_id=supplier_in.supplier_id,
        agreed_price=supplier_in.agreed_price,
        is_primary=is_primary,
        supplier_sku=supplier_in.supplier_sku,
    )
    db.add(new_rel)
    await db.commit()
    await db.refresh(new_rel)

    # Return with loaded supplier
    loaded = await get_item_supplier(db, item_id, supplier_in.supplier_id)
    return loaded or new_rel


# ----------------------- Update item-supplier relation ---------------------- #
async def update_item_supplier(
    db: AsyncSession,
    item_id: uuid.UUID,
    supplier_id: uuid.UUID,
    update_in: ItemSupplierUpdate,
) -> ItemSupplier | None:
    rel = await get_item_supplier(db, item_id, supplier_id)
    if not rel:
        return None

    # If setting as primary, unset others
    if update_in.is_primary is True:
        await db.execute(
            update(ItemSupplier)
            .where(ItemSupplier.item_id == item_id)
            .values(is_primary=False)
        )
        rel.is_primary = True
    elif update_in.is_primary is False:
        rel.is_primary = False

    if update_in.agreed_price is not None:
        rel.agreed_price = update_in.agreed_price
    if update_in.supplier_sku is not None:
        rel.supplier_sku = update_in.supplier_sku

    await db.commit()
    await db.refresh(rel)

    loaded = await get_item_supplier(db, item_id, supplier_id)
    return loaded or rel


# ----------------------- Remove supplier link from item --------------------- #
async def delete_item_supplier(
    db: AsyncSession, item_id: uuid.UUID, supplier_id: uuid.UUID
) -> bool:
    rel = await get_item_supplier(db, item_id, supplier_id)
    if not rel:
        return False

    was_primary = rel.is_primary
    await db.execute(
        delete(ItemSupplier).where(
            ItemSupplier.item_id == item_id,
            ItemSupplier.supplier_id == supplier_id,
        )
    )
    await db.commit()

    # If we deleted the primary, assign the first remaining supplier as primary if any exist
    if was_primary:
        remaining = await get_item_suppliers(db, item_id)
        if remaining:
            remaining[0].is_primary = True
            await db.commit()

    return True


# ------------- Get all items linked to a specific supplier (for PO) ---------- #
async def get_items_by_supplier(
    db: AsyncSession, supplier_id: uuid.UUID
) -> Sequence[ItemSupplier]:
    result = await db.execute(
        select(ItemSupplier)
        .options(joinedload(ItemSupplier.item))
        .where(ItemSupplier.supplier_id == supplier_id)
    )
    return result.unique().scalars().all()
