from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.schemas.item import ItemCreate, ItemResponse, ItemUpdate
from app.schemas.item_supplier import (
    ItemSupplierCreate,
    ItemSupplierUpdate,
    ItemSupplierResponse,
)
from app.crud import item as crud_item
from app.crud import item_supplier as crud_item_supplier
from app.crud import auditlog as crud_auditlog
from app.routes.dependencies import RoleChecker, verify_uniqueness
from app.models import Item, User, UserRole
from app.services.stockalert import create_item_alert, sync_item_update_alert
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


# ----------------------------------------------------------- Get single Item by ID -------------------------------------------------------------
@router.get("/{item_id}", response_model=ItemResponse)
async def read_single_item(
    item_id: uuid.UUID,
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
    item = await crud_item.get_item_by_item_id(db, item_id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return ItemResponse.model_validate(item, context={"role": current_user.role})


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

    # Re-evaluate stock alert state if reorder_level or quantity_in_stock changed
    if "reorder_level" in update_data or "quantity_in_stock" in update_data:
        await sync_item_update_alert(db, updated_item)

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


# ---------------------------------------------------------------------------------------------------------------------------------
# --------------------------------------------- ITEM-SUPPLIER M:M RELATION ENDPOINTS ----------------------------------------------
# ---------------------------------------------------------------------------------------------------------------------------------

# ----------------------------------------------- Get all suppliers linked to item ------------------------------------------------
@router.get("/{item_id}/suppliers", response_model=list[ItemSupplierResponse])
async def get_item_suppliers_list(
    item_id: uuid.UUID,
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
    item = await crud_item.get_item_by_item_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    rels = await crud_item_supplier.get_item_suppliers(db, item_id)
    return [
        ItemSupplierResponse(
            item_id=rel.item_id,
            supplier_id=rel.supplier_id,
            supplier_name=rel.supplier.supplier_name if rel.supplier else "Unknown",
            agreed_price=rel.agreed_price,
            is_primary=rel.is_primary,
            supplier_sku=rel.supplier_sku,
            created_at=rel.created_at,
            updated_at=rel.updated_at,
        )
        for rel in rels
    ]


# ------------------------------------------------- Link a new supplier to item ---------------------------------------------------
@router.post("/{item_id}/suppliers", response_model=ItemSupplierResponse, status_code=201)
async def link_supplier_to_item(
    item_id: uuid.UUID,
    supplier_in: ItemSupplierCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    item = await crud_item.get_item_by_item_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    existing = await crud_item_supplier.get_item_supplier(
        db, item_id, supplier_in.supplier_id
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Supplier is already linked to this item"
        )

    new_rel = await crud_item_supplier.add_item_supplier(db, item_id, supplier_in)
    return ItemSupplierResponse(
        item_id=new_rel.item_id,
        supplier_id=new_rel.supplier_id,
        supplier_name=new_rel.supplier.supplier_name if new_rel.supplier else "Unknown",
        agreed_price=new_rel.agreed_price,
        is_primary=new_rel.is_primary,
        supplier_sku=new_rel.supplier_sku,
        created_at=new_rel.created_at,
        updated_at=new_rel.updated_at,
    )


# -------------------------------------------- Update supplier link (agreed price / primary) --------------------------------------
@router.patch("/{item_id}/suppliers/{supplier_id}", response_model=ItemSupplierResponse)
async def update_item_supplier_link(
    item_id: uuid.UUID,
    supplier_id: uuid.UUID,
    update_in: ItemSupplierUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    updated = await crud_item_supplier.update_item_supplier(
        db, item_id, supplier_id, update_in
    )
    if not updated:
        raise HTTPException(
            status_code=404, detail="Supplier link not found for this item"
        )

    return ItemSupplierResponse(
        item_id=updated.item_id,
        supplier_id=updated.supplier_id,
        supplier_name=updated.supplier.supplier_name if updated.supplier else "Unknown",
        agreed_price=updated.agreed_price,
        is_primary=updated.is_primary,
        supplier_sku=updated.supplier_sku,
        created_at=updated.created_at,
        updated_at=updated.updated_at,
    )


# ------------------------------------------------- Unlink supplier from item ----------------------------------------------------
@router.delete("/{item_id}/suppliers/{supplier_id}", status_code=204)
async def unlink_supplier_from_item(
    item_id: uuid.UUID,
    supplier_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    success = await crud_item_supplier.delete_item_supplier(db, item_id, supplier_id)
    if not success:
        raise HTTPException(
            status_code=404, detail="Supplier link not found for this item"
        )
