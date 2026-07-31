from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.routes.dependencies import RoleChecker
from app.models import User, UserRole, TransactionType
from app.crud import item as crud_item
from app.crud import transaction as crud_transaction
from app.crud import supplier as crud_supplier
from app.schemas.transaction import TransactionCreate, TransactionResponse
from app.services.stockalert import sync_stock_alert
import uuid

router = APIRouter(prefix="/transaction", tags=["transaction"])


# ---------------------- New transaction create endpoint --------------------- #
@router.post("/", response_model=TransactionResponse, status_code=201)
async def create_new_transaction(
    transaction_in: TransactionCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER, UserRole.SALES])
    ),
):
    item = await crud_item.get_item_by_item_id(db, transaction_in.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not item.is_active:
        raise HTTPException(status_code=400, detail="Item was deactivated")

    await sync_stock_alert(
        db, item, int(transaction_in.quantity), transaction_in.transaction_type
    )

    # ----------------------- Update supplier total supply ----------------------- #
    if item.supplier_id is None:
        raise HTTPException(status_code=400, detail="Item is missing a supplier ID")

    supplier = await crud_supplier.get_supplier_by_supplier_id(db, item.supplier_id)
    if supplier:
        if supplier.is_active is False:
            raise HTTPException(status_code=400, detail="Supplier was deactivated")
        if transaction_in.transaction_type == TransactionType.STOCK_IN:
            supplier.total_supplies += transaction_in.quantity

    # ------------------------- Update Item current stock ------------------------ #
    previous_quantity = item.quantity_in_stock

    if transaction_in.transaction_type == TransactionType.STOCK_IN:
        item.quantity_in_stock += transaction_in.quantity

    elif transaction_in.transaction_type == TransactionType.STOCK_OUT:
        if transaction_in.quantity > item.quantity_in_stock:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock: requested {transaction_in.quantity}, available {item.quantity_in_stock}",
            )
        item.quantity_in_stock -= transaction_in.quantity

    new_quantity = item.quantity_in_stock

    new_transaction = await crud_transaction.create_transaction(
        db, transaction_in, current_user.user_id, previous_quantity, new_quantity
    )
    return new_transaction


# ----------------------- Get all transaction endpoint ----------------------- #
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
    if current_user.role == UserRole.SALES:
        target_user_id = current_user.user_id
    else:
        target_user_id = None
    transactions = await crud_transaction.get_transactions(db, target_user_id)
    return transactions
