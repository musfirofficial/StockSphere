import uuid
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.routes.dependencies import RoleChecker
from app.models import User, UserRole, TransactionType, POStatus, Transaction
from app.crud import item as crud_item
from app.crud import transaction as crud_transaction
from app.crud import supplier as crud_supplier
from app.crud import purchaseorder as crud_po
from app.crud import stock_batch as crud_batch
from app.schemas.transaction import (
    TransactionCreate,
    TransactionResponse,
    PurchaseReceivingRequest,
    SoldTransactionRequest,
    CustomerReturnRequest,
    DamagedTransactionRequest,
    ExpiredTransactionRequest,
    AdjustmentTransactionRequest,
)
from app.schemas.stock_batch import StockBatchResponse

router = APIRouter(prefix="/transaction", tags=["transaction"])


# ----------------------- Get all transactions ------------------------------- #
@router.get("/", response_model=list[TransactionResponse])
async def get_all_transactions(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
                UserRole.SALES,
                UserRole.AUDITOR,
            ]
        )
    ),
):
    target_user_id = current_user.user_id if current_user.role == UserRole.SALES else None
    transactions = await crud_transaction.get_transactions(db, target_user_id)
    return [TransactionResponse.model_validate(tx) for tx in transactions]


# ----------------------- Get single transaction by ID ----------------------- #
@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_single_transaction(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
                UserRole.SALES,
                UserRole.AUDITOR,
            ]
        )
    ),
):
    tx = await crud_transaction.get_transaction_by_id(db, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return TransactionResponse.model_validate(tx)


# ----------------------- Get active batches for item ------------------------ #
@router.get("/batches/{item_id}", response_model=list[StockBatchResponse])
async def get_item_active_batches(
    item_id: uuid.UUID,
    supplier_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
                UserRole.SALES,
                UserRole.AUDITOR,
            ]
        )
    ),
):
    batches = await crud_batch.get_batches_for_item(
        db, item_id, supplier_id, active_only=True
    )
    return [StockBatchResponse.model_validate(b) for b in batches]


# ---------------------------------------------------------------------------- #
# 1. PURCHASE RECEIVING TRANSACTION                                            #
# ---------------------------------------------------------------------------- #
@router.post("/purchase", response_model=list[TransactionResponse], status_code=201)
async def record_purchase_receiving(
    payload: PurchaseReceivingRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    # 1. Verify PO exists and is approved or partially received
    po = await crud_po.get_purchase_order_by_id(db, payload.po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if po.status not in [POStatus.APPROVED, POStatus.PARTIALLY_RECEIVED]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot receive items for purchase order in '{po.status.value}' status. Must be Approved.",
        )

    if not payload.items:
        raise HTTPException(status_code=400, detail="No items to receive")

    recorded_txs = []
    pois_by_item = {poi.item_id: poi for poi in po.purchaseorderitems}

    # 2. Process each received item
    for r_item in payload.items:
        poi = pois_by_item.get(r_item.item_id)
        if not poi:
            raise HTTPException(
                status_code=400,
                detail=f"Item {r_item.item_id} is not part of this purchase order",
            )

        remaining_qty = poi.quantity - poi.quantity_received
        if r_item.quantity > remaining_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Received quantity ({r_item.quantity}) exceeds remaining order quantity ({remaining_qty}) for item",
            )

        item = await crud_item.get_item_by_item_id(db, r_item.item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        # 3. Create or increment the stock batch
        batch_sell_price = r_item.selling_price if r_item.selling_price is not None else Decimal(str(item.selling_price))
        batch = await crud_batch.create_or_increment_batch(
            db=db,
            item_id=r_item.item_id,
            supplier_id=po.supplier_id,
            batch_number=r_item.batch_number.strip(),
            purchase_price=poi.unit_price,
            selling_price=batch_sell_price,
            quantity=r_item.quantity,
            expiry_date=r_item.expiry_date,
            po_id=po.po_id,
        )

        # 4. Update item total inventory stock
        prev_qty = item.quantity_in_stock
        item.quantity_in_stock += r_item.quantity
        new_qty = item.quantity_in_stock

        # 5. Update PO Item received count
        poi.quantity_received += r_item.quantity

        # 6. Record transaction
        tx = Transaction(
            item_id=item.item_id,
            supplier_id=po.supplier_id,
            batch_id=batch.batch_id,
            po_id=po.po_id,
            user_id=current_user.user_id,
            transaction_type=TransactionType.PURCHASE,
            quantity=r_item.quantity,
            previous_quantity=prev_qty,
            new_quantity=new_qty,
            unit_price=poi.unit_price,
            note=f"Received against PO-{str(po.po_id)[:8].upper()} (Batch: {batch.batch_number})",
        )
        db.add(tx)
        await db.commit()
        await db.refresh(tx)

        full_tx = await crud_transaction.get_transaction_by_id(db, tx.transaction_id)
        if full_tx:
            recorded_txs.append(TransactionResponse.model_validate(full_tx))

    # 7. Check if entire PO is now completed or partially received
    all_completed = all(poi.quantity_received >= poi.quantity for poi in po.purchaseorderitems)
    if all_completed:
        await crud_po.update_purchase_order_status(db, po, POStatus.COMPLETED)
    else:
        await crud_po.update_purchase_order_status(db, po, POStatus.PARTIALLY_RECEIVED)

    return recorded_txs


# ---------------------------------------------------------------------------- #
# 2. SOLD TRANSACTION                                                          #
# ---------------------------------------------------------------------------- #
@router.post("/sold", response_model=TransactionResponse, status_code=201)
async def record_sold_transaction(
    payload: SoldTransactionRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER, UserRole.SALES])
    ),
):
    item = await crud_item.get_item_by_item_id(db, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not item.is_active:
        raise HTTPException(status_code=400, detail="Item is deactivated")

    batch = await crud_batch.get_batch_by_id(db, payload.batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Stock batch not found")
    if batch.current_quantity < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient batch quantity: batch has {batch.current_quantity} {item.unit}, requested {payload.quantity}",
        )

    # Deduct batch stock
    await crud_batch.decrement_batch_stock(db, batch.batch_id, payload.quantity)

    # Deduct item stock
    prev_qty = item.quantity_in_stock
    item.quantity_in_stock = max(0, item.quantity_in_stock - payload.quantity)
    new_qty = item.quantity_in_stock

    effective_unit_price = (
        payload.unit_price
        if payload.unit_price is not None
        else (batch.selling_price if batch.selling_price is not None else item.selling_price)
    )

    tx = Transaction(
        transaction_id=uuid.uuid4(),
        item_id=item.item_id,
        supplier_id=payload.supplier_id,
        batch_id=batch.batch_id,
        user_id=current_user.user_id,
        transaction_type=TransactionType.SOLD,
        quantity=payload.quantity,
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        unit_price=effective_unit_price,
        note=payload.note or f"Sale from batch {batch.batch_number}",
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)

    full_tx = await crud_transaction.get_transaction_by_id(db, tx.transaction_id)
    return TransactionResponse.model_validate(full_tx or tx)


# ---------------------------------------------------------------------------- #
# 3. CUSTOMER RETURN TRANSACTION                                               #
# ---------------------------------------------------------------------------- #
@router.post("/customer-return", response_model=TransactionResponse, status_code=201)
async def record_customer_return(
    payload: CustomerReturnRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER, UserRole.SALES])
    ),
):
    # Lookup the original sold transaction
    sold_tx = await crud_transaction.get_transaction_by_id(db, payload.reference_transaction_id)
    if not sold_tx:
        raise HTTPException(status_code=404, detail="Sold transaction not found")

    if sold_tx.transaction_type != TransactionType.SOLD:
        raise HTTPException(
            status_code=400,
            detail="Customer returns can only be processed against a 'Sold' transaction.",
        )

    if payload.quantity > sold_tx.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Return quantity ({payload.quantity}) exceeds original sold quantity ({sold_tx.quantity})",
        )

    item = await crud_item.get_item_by_item_id(db, sold_tx.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Increment batch stock if batch exists
    if sold_tx.batch_id:
        try:
            await crud_batch.increment_batch_stock(db, sold_tx.batch_id, payload.quantity)
        except Exception:
            pass

    # Increment item stock
    prev_qty = item.quantity_in_stock
    item.quantity_in_stock += payload.quantity
    new_qty = item.quantity_in_stock

    tx = Transaction(
        item_id=item.item_id,
        supplier_id=sold_tx.supplier_id,
        batch_id=sold_tx.batch_id,
        reference_transaction_id=sold_tx.transaction_id,
        user_id=current_user.user_id,
        transaction_type=TransactionType.CUSTOMER_RETURN,
        quantity=payload.quantity,
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        unit_price=sold_tx.unit_price,
        reason=payload.reason,
        note=payload.note or f"Return for sale TX-{str(sold_tx.transaction_id)[:8].upper()}",
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)

    full_tx = await crud_transaction.get_transaction_by_id(db, tx.transaction_id)
    return TransactionResponse.model_validate(full_tx or tx)


# ---------------------------------------------------------------------------- #
# 4. DAMAGED STOCK TRANSACTION                                                 #
# ---------------------------------------------------------------------------- #
@router.post("/damaged", response_model=TransactionResponse, status_code=201)
async def record_damaged_transaction(
    payload: DamagedTransactionRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    item = await crud_item.get_item_by_item_id(db, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    batch = await crud_batch.get_batch_by_id(db, payload.batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Stock batch not found")
    if batch.current_quantity < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient batch quantity: batch has {batch.current_quantity}, requested {payload.quantity}",
        )

    await crud_batch.decrement_batch_stock(db, batch.batch_id, payload.quantity)

    prev_qty = item.quantity_in_stock
    item.quantity_in_stock = max(0, item.quantity_in_stock - payload.quantity)
    new_qty = item.quantity_in_stock

    tx = Transaction(
        item_id=item.item_id,
        supplier_id=payload.supplier_id,
        batch_id=batch.batch_id,
        user_id=current_user.user_id,
        transaction_type=TransactionType.DAMAGED,
        quantity=payload.quantity,
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        note=payload.note or f"Damaged stock write-off (Batch: {batch.batch_number})",
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)

    full_tx = await crud_transaction.get_transaction_by_id(db, tx.transaction_id)
    return TransactionResponse.model_validate(full_tx or tx)


# ---------------------------------------------------------------------------- #
# 5. EXPIRED STOCK TRANSACTION                                                 #
# ---------------------------------------------------------------------------- #
@router.post("/expired", response_model=TransactionResponse, status_code=201)
async def record_expired_transaction(
    payload: ExpiredTransactionRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    item = await crud_item.get_item_by_item_id(db, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    batch = await crud_batch.get_batch_by_id(db, payload.batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Stock batch not found")
    if batch.current_quantity < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient batch quantity: batch has {batch.current_quantity}, requested {payload.quantity}",
        )

    await crud_batch.decrement_batch_stock(db, batch.batch_id, payload.quantity)

    prev_qty = item.quantity_in_stock
    item.quantity_in_stock = max(0, item.quantity_in_stock - payload.quantity)
    new_qty = item.quantity_in_stock

    tx = Transaction(
        item_id=item.item_id,
        supplier_id=payload.supplier_id,
        batch_id=batch.batch_id,
        user_id=current_user.user_id,
        transaction_type=TransactionType.EXPIRED,
        quantity=payload.quantity,
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        note=payload.note or f"Expired stock disposal (Batch: {batch.batch_number})",
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)

    full_tx = await crud_transaction.get_transaction_by_id(db, tx.transaction_id)
    return TransactionResponse.model_validate(full_tx or tx)


# ---------------------------------------------------------------------------- #
# 6. ADJUSTMENT (INCREASE / DECREASE) TRANSACTION                               #
# ---------------------------------------------------------------------------- #
@router.post("/adjustment", response_model=TransactionResponse, status_code=201)
async def record_adjustment_transaction(
    payload: AdjustmentTransactionRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    if not payload.reason.strip():
        raise HTTPException(
            status_code=400,
            detail="A specific reason is mandatory for manual stock adjustments.",
        )

    if payload.transaction_type not in [
        TransactionType.ADJUSTMENT_INCREASE,
        TransactionType.ADJUSTMENT_DECREASE,
    ]:
        raise HTTPException(
            status_code=400,
            detail="Adjustment type must be ADJUSTMENT_INCREASE or ADJUSTMENT_DECREASE",
        )

    item = await crud_item.get_item_by_item_id(db, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    batch = await crud_batch.get_batch_by_id(db, payload.batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Stock batch not found")

    prev_qty = item.quantity_in_stock

    if payload.transaction_type == TransactionType.ADJUSTMENT_INCREASE:
        await crud_batch.increment_batch_stock(db, batch.batch_id, payload.quantity)
        item.quantity_in_stock += payload.quantity
    else:
        if batch.current_quantity < payload.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot reduce: batch only has {batch.current_quantity} in stock",
            )
        await crud_batch.decrement_batch_stock(db, batch.batch_id, payload.quantity)
        item.quantity_in_stock = max(0, item.quantity_in_stock - payload.quantity)

    new_qty = item.quantity_in_stock

    tx = Transaction(
        item_id=item.item_id,
        supplier_id=payload.supplier_id,
        batch_id=batch.batch_id,
        user_id=current_user.user_id,
        transaction_type=payload.transaction_type,
        quantity=payload.quantity,
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        reason=payload.reason.strip(),
        note=payload.note,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)

    full_tx = await crud_transaction.get_transaction_by_id(db, tx.transaction_id)
    return TransactionResponse.model_validate(full_tx or tx)
