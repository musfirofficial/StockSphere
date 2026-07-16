from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import StockAlert, Item, TransactionType, AlertStatus
from app.crud import stockalert as crud_stockalert


async def sync_stock_alert(
    db: AsyncSession,
    item: Item,
    trans_quantity: int,  # always positive — direction comes from trans_type
    trans_type: TransactionType,
) -> StockAlert | None:

    if trans_quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    current_stock = item.quantity_in_stock
    active = await crud_stockalert.get_item_alert(db, item)

    if trans_type == TransactionType.STOCK_OUT:
        # ── Block if CRITICAL ────────────────────────────────────────────────
        if active and active.status == AlertStatus.CRITICAL:
            raise HTTPException(status_code=400, detail="Insufficient stock")

        new_stock = current_stock - trans_quantity

        if new_stock < 0:
            raise HTTPException(status_code=400, detail="Insufficient stock")

        # ── Derive target and apply ──────────────────────────────────────────
        if new_stock == 0:
            target = AlertStatus.CRITICAL
        elif new_stock < item.reorder_level:
            target = AlertStatus.LOW_STOCK
        else:
            return None  # healthy, no alert needed

        if active:
            return await crud_stockalert.update_alert_status(db, active, target)
        return await crud_stockalert.create_stockalert(
            db, item.item_id, item.supplier_id, target
        )

    elif trans_type == TransactionType.STOCK_IN:
        if not active:
            return None  # already healthy, stock-in keeps it healthy

        new_stock = current_stock + trans_quantity

        if new_stock >= item.reorder_level:
            target = AlertStatus.RESOLVED
        else:
            target = AlertStatus.LOW_STOCK

        return await crud_stockalert.update_alert_status(db, active, target)


async def create_item_alert(db: AsyncSession, item: Item):
    if item.quantity_in_stock == 0:
        return await crud_stockalert.create_stockalert(
            db, item.item_id, item.supplier_id, AlertStatus.CRITICAL
        )
    if item.quantity_in_stock < item.reorder_level:
        return await crud_stockalert.create_stockalert(
            db, item.item_id, item.supplier_id, AlertStatus.LOW_STOCK
        )
