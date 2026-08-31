from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload, joinedload
from typing import Sequence
import uuid
from decimal import Decimal

from app.models import (
    Supplier,
    PurchaseOrder,
    PurchaseOrderItem,
    POStatus,
    Item,
    ItemSupplier,
)
from app.schemas.purchaseorder import PurchaseOrderCreate, POItemInput


ACTIVE_PO_STATUSES = [
    POStatus.DRAFT,
    POStatus.PENDING_APPROVAL,
    POStatus.APPROVED,
    POStatus.PARTIALLY_RECEIVED,
]


# --------------------- Get active PO for a supplier ------------------------- #
async def get_active_po_for_supplier(
    db: AsyncSession, supplier_id: uuid.UUID, exclude_po_id: uuid.UUID | None = None
) -> PurchaseOrder | None:
    stmt = select(PurchaseOrder).where(
        PurchaseOrder.supplier_id == supplier_id,
        PurchaseOrder.status.in_(ACTIVE_PO_STATUSES),
    )
    if exclude_po_id:
        stmt = stmt.where(PurchaseOrder.po_id != exclude_po_id)

    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# ----------------------- Create new purchase order -------------------------- #
async def create_purchase_order(
    db: AsyncSession,
    po_in: PurchaseOrderCreate,
    created_by: uuid.UUID | None,
    item_prices: dict[uuid.UUID, Decimal],
) -> PurchaseOrder:
    new_po = PurchaseOrder(
        supplier_id=po_in.supplier_id,
        created_by=created_by,
        status=POStatus.DRAFT,
        po_type=POStatus.DRAFT,
        notes=po_in.notes,
    )
    db.add(new_po)
    await db.flush()

    for item_input in po_in.items:
        agreed_price = item_prices.get(item_input.item_id, Decimal("0.00"))
        poi = PurchaseOrderItem(
            po_id=new_po.po_id,
            item_id=item_input.item_id,
            quantity=item_input.quantity,
            quantity_received=0,
            unit_price=agreed_price,
        )
        db.add(poi)

    await db.commit()
    await db.refresh(new_po)

    full_po = await get_purchase_order_by_id(db, new_po.po_id)
    return full_po or new_po


# --------------------- Get purchase order by ID ----------------------------- #
async def get_purchase_order_by_id(
    db: AsyncSession, order_id: uuid.UUID
) -> PurchaseOrder | None:
    result = await db.execute(
        select(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.supplier),
            joinedload(PurchaseOrder.user),
            selectinload(PurchaseOrder.purchaseorderitems).joinedload(PurchaseOrderItem.item),
        )
        .where(PurchaseOrder.po_id == order_id)
    )
    return result.unique().scalar_one_or_none()


# --------------------- Get all purchase orders ------------------------------ #
async def get_all_purchase_orders(db: AsyncSession) -> Sequence[PurchaseOrder]:
    result = await db.execute(
        select(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.supplier),
            joinedload(PurchaseOrder.user),
            selectinload(PurchaseOrder.purchaseorderitems).joinedload(PurchaseOrderItem.item),
        )
        .order_by(PurchaseOrder.created_at.desc())
    )
    return result.unique().scalars().all()


# --------------------- Update PO status ------------------------------------- #
async def update_purchase_order_status(
    db: AsyncSession,
    po: PurchaseOrder,
    new_status: POStatus,
    notes: str | None = None,
) -> PurchaseOrder:
    po.status = new_status
    po.po_type = new_status
    if notes is not None:
        po.notes = notes
    await db.commit()
    await db.refresh(po)
    full = await get_purchase_order_by_id(db, po.po_id)
    return full or po


# --------------------- Delete purchase order -------------------------------- #
async def delete_purchase_order(db: AsyncSession, order_id: uuid.UUID):
    await db.execute(delete(PurchaseOrderItem).where(PurchaseOrderItem.po_id == order_id))
    await db.execute(delete(PurchaseOrder).where(PurchaseOrder.po_id == order_id))
    await db.commit()
