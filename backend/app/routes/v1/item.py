from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.schemas.item import ItemCreate, ItemResponse, ItemUpdate
from app.crud import item as crud_item
from app.crud import auditlog as crud_auditlog
from app.routes.dependencies import RoleChecker, verify_uniqueness
from app.models import Item, User, UserRole
from app.services.stockalert import create_item_alert
import uuid

router = APIRouter(prefix="/items", tags=["items"])


# --------------------------------------------------------------- Create a new item endpoint --------------------------------------------------------
@router.post("/", response_model=ItemResponse, status_code=201)
async def create_new_item(
    item_in: ItemCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    await verify_uniqueness(db, Item, item_in)
    item = await crud_item.create_item(db, item_in)
    await create_item_alert(db, item)
    await crud_auditlog.log_item_created(db, current_user, item)
    return item


# --------------------------------------------------------------- Get all Item endpoint --------------------------------------------------------
@router.get("/", response_model=list[ItemResponse])
async def read_all_item(
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
    items = await crud_item.get_all_items(db)

    # Pass role context during validation to trigger sanitization
    return [
        ItemResponse.model_validate(item, context={"role": current_user.role})
        for item in items
    ]


# ---------------------------------------------------- Update Item endpoint -----------------------------------------------------------
@router.patch("/{item_id}", response_model=ItemResponse)
async def update_existing_item(
    item_id: uuid.UUID,
    item_in: ItemUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    item = await crud_item.get_item_by_item_id(db, item_id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = item_in.model_dump(exclude_none=True, exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await verify_uniqueness(db, item, item_in, item_id)
    # Capture old prices before update overwrites them
    old_cost_price = item.cost_price
    old_selling_price = item.selling_price

    updated_item = await crud_item.update_item(db, item, update_data)

    # Deactivation log
    if "is_active" in update_data and item_in.is_active is False:
        await crud_auditlog.log_item_deactivated(db, current_user, updated_item)

    # Reactivation log
    if "is_active" in update_data and item_in.is_active is True:
        await crud_auditlog.log_item_reactivated(db, current_user, updated_item)

    # Price logs
    if "cost_price" in update_data:
        await crud_auditlog.log_item_price_updated(
            db,
            current_user,
            updated_item,
            "cost_price",
            old_cost_price,
            updated_item.cost_price,
        )

    if "selling_price" in update_data:
        await crud_auditlog.log_item_price_updated(
            db,
            current_user,
            updated_item,
            "selling_price",
            old_selling_price,
            updated_item.selling_price,
        )

    return await crud_item.get_item_by_item_id(db, updated_item.item_id)


# ---------------------------------------------------- Delete item endpoint -----------------------------------------------------------
@router.delete("/{item_id}", status_code=204)
async def delete_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    item = await crud_item.get_item_by_item_id(db, item_id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="item not found")
    await crud_item.delete_item(db, item_id=item_id)
    await crud_auditlog.log_item_deleted(db, current_user, item)
