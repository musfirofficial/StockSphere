from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload, joinedload
from app.models import (
    Supplier,
    StockAlert,
    AlertStatus,
    PurchaseOrder,
    PurchaseOrderItem,
    POType,
)
from app.schemas.purchaseorder import (
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseOrderItemUpdate,
)
from typing import Sequence
import uuid

# ---------------------------------------------------------------------------- #
#                                Purchase Order                                #
# ---------------------------------------------------------------------------- #


# ---------------------- Create new purchase order crud ---------------------- #
async def create_purchase_order(
    db: AsyncSession, po_in: PurchaseOrderCreate, created_by: uuid.UUID
) -> PurchaseOrder:
    new_po = PurchaseOrder(**po_in.model_dump(), created_by=created_by)

    return new_po


# ----------------------- CRUD for get purchase order by ID ---------------------- #
async def get_purchase_order_by_id(
    db: AsyncSession, order_id: uuid.UUID
) -> PurchaseOrder | None:
    result = await db.execute(
        select(PurchaseOrder).filter(PurchaseOrder.po_id == order_id)
    )
    return result.scalar_one_or_none()


# ----------------------- CRUD for get all purchase orders ---------------------- #
async def get_all_purchase_orders(db: AsyncSession) -> Sequence[PurchaseOrder]:
    result = await db.execute(
        select(PurchaseOrder)
        .options(
            selectinload(PurchaseOrder.supplier),
            selectinload(PurchaseOrder.user),
        )
        .order_by(PurchaseOrder.created_at.desc())
    )
    return result.scalars().all()


# ------------------------ CRUD for delete existing po ----------------------- #
async def delete_purchase_order(db: AsyncSession, order_id: uuid.UUID):
    await db.execute(delete(PurchaseOrder).filter(PurchaseOrder.po_id == order_id))
    await db.commit()


# ---------------------------------------------------------------------------- #
#                              Purchase Order Item                             #
# ---------------------------------------------------------------------------- #


# ------------------------ Create purchase order items ----------------------- #
async def create_purchase_order_items_bulk(
    db: AsyncSession, items_in: list[PurchaseOrderItemCreate], po_id: uuid.UUID
) -> list[PurchaseOrderItem]:
    # 1. Map Pydantic models to SQLALchemy instances entirely in memory
    new_items = []
    for item in items_in:
        new_items.append(PurchaseOrderItem(**item.model_dump(), po_id=po_id))
    # 2. Add all items to the session context at once
    db.add_all(new_items)
    # 3. Commit exactly ONCE for the entire batch
    await db.commit()
    return new_items


# --------------------- Update purchase order items bulk --------------------- #
async def update_purchase_order_items_bulk(
    db: AsyncSession, po_id: uuid.UUID, updates: list[PurchaseOrderItemUpdate]
) -> int:

    # Returns the count of successfully updated rows.

    if not updates:
        return 0

    # 1. Map input payload into a dictionary for quick O(1) memory lookup
    updates_map = {u.poi_id: u for u in updates}

    # 2. Fetch all matching rows tied to this specific PO in a single round-trip
    stmt = select(PurchaseOrderItem).where(
        PurchaseOrderItem.poi_id.in_(list(updates_map.keys())),
        PurchaseOrderItem.po_id == po_id,
    )
    result = await db.execute(stmt)
    db_items = result.scalars().all()

    # 3. Apply changes to the tracked ORM instances in memory
    for db_item in db_items:
        update_data = updates_map[db_item.poi_id]
        db_item.quantity = update_data.quantity
        db_item.unit_price = update_data.unit_price

    # 4. Save all altered records within a single transaction block
    await db.commit()

    return len(db_items)


# ------------------- Delete purchase order items by po_id ------------------- #
async def delete_purchase_order_item(db: AsyncSession, poi_id: uuid.UUID):
    await db.execute(
        delete(PurchaseOrderItem).where(PurchaseOrderItem.poi_id == poi_id)
    )
    await db.commit()


# --------------------- Get purchase order item by poi id -------------------- #
async def get_purchase_order_item_by_poi_id(
    db: AsyncSession, poi_id: uuid.UUID
) -> PurchaseOrderItem | None:
    result = await db.execute(
        select(PurchaseOrderItem).filter(PurchaseOrderItem.poi_id == poi_id)
    )
    return result.scalar_one_or_none()


# --------------------- Get purchase order items by po_id -------------------- #
async def get_purchase_order_items_by_po_id(
    db: AsyncSession, po_id: uuid.UUID
) -> Sequence[PurchaseOrderItem] | None:
    result = await db.execute(
        select(PurchaseOrderItem).filter(PurchaseOrderItem.po_id == po_id)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------- #
#                                   Utilities                                  #
# ---------------------------------------------------------------------------- #


# ------------------------ get suppliers with alerts ----------------------- #
async def get_suppliers_with_alerts(db: AsyncSession) -> Sequence[Supplier]:
    results = await db.execute(
        select(Supplier)
        .join(Supplier.stockalerts)
        .where(StockAlert.status != AlertStatus.RESOLVED)
        .distinct()
    )
    return results.scalars().all()


# -------------- get suppliers with Draft purchase PurchaseOrder ------------- #
async def get_suppliers_with_draft_po(db: AsyncSession, alert_set: set):
    result = await db.execute(
        select(PurchaseOrder.supplier_id).where(
            PurchaseOrder.po_type == POType.DRAFT,
            PurchaseOrder.supplier_id.in_(list(alert_set)),
        )
    )
    return set(result.scalars().all())


# ---------------------- get existing draft for supplier --------------------- #
async def get_existing_draft_po(
    db: AsyncSession, supplier_id: uuid.UUID
) -> PurchaseOrder | None:
    result = await db.execute(
        select(PurchaseOrder).where(
            PurchaseOrder.supplier_id == supplier_id,
            PurchaseOrder.po_type == POType.DRAFT,
        )
    )
    return result.scalar_one_or_none()


# ------------------------ get purchase order and poi ------------------------ #
async def get_purchase_order_with_poi(
    db: AsyncSession, po_id: uuid.UUID
) -> PurchaseOrder | None:
    po_result = await db.execute(
        select(PurchaseOrder)
        .where(PurchaseOrder.po_id == po_id)
        .options(
            selectinload(PurchaseOrder.purchaseorderitems).selectinload(
                PurchaseOrderItem.item
            )
        )
    )
    return po_result.scalar_one_or_none()
