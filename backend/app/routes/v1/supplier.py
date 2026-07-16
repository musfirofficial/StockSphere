from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.schemas.supplier import SupplierCreate, SupplierResponse, SupplierUpdate
from app.crud import supplier as supplier_crud
from app.crud import auditlog as auditlog_crud
from app.routes.dependencies import verify_uniqueness
from app.routes.dependencies import RoleChecker
from app.models import Supplier, User, UserRole
import uuid

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

# --------------------------- New supplier endpoint -------------------------- #
@router.post("/", response_model=SupplierResponse, status_code=201)
async def create_new_supplier(
    supplier_in : SupplierCreate, 
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    await verify_uniqueness(db,Supplier, supplier_in)
    supplier =  await supplier_crud.create_supplier(db, supplier_in)
    await auditlog_crud.log_supplier_created(db, current_user, supplier)
    return supplier

# ----------------------------- Get all suppliers endpoint ---------------------------- #
@router.get("/", response_model=list[SupplierResponse])
async def read_all_suppliers(
    db: AsyncSession = Depends(get_async_session), 
    current_user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    return await supplier_crud.get_all_suppliers(db)

# --------------------------- Supplier update endpoint --------------------------- #
@router.patch("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: uuid.UUID,
    supplier_in: SupplierUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(RoleChecker([
        UserRole.ADMIN, 
        UserRole.INVENTORY_MANAGER
    ]))
):
    # Fetch user
    supplier = await supplier_crud.get_supplier_by_supplier_id(db, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=404, detail="Supplier not found")
    # Get only fields that were actually sent
    update_data = supplier_in.model_dump(exclude_unset=True, exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    # Uniqueness check for username, email, nic
    await verify_uniqueness(
        db, 
        Supplier,
        supplier_in, 
        supplier_id
    )
    supplier_update = await supplier_crud.update_supplier(db, supplier, update_data)
    if "is_active" in update_data and update_data["is_active"] is False:
        await auditlog_crud.log_supplier_deactivated(db, current_user, supplier)
    return supplier_update

# ------------------------- Delete supplier endpoint ------------------------- #
@router.delete("/{supplier_id}", status_code=204)
async def delete_existing_supplier(
    supplier_id : uuid.UUID,
    db : AsyncSession = Depends(get_async_session),
    current_user: User = Depends(RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER]))
):
    exist = await supplier_crud.get_supplier_by_supplier_id(db, supplier_id)
    if not exist:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    await supplier_crud.delete_supplier(db, supplier_id = supplier_id)
    await auditlog_crud.log_supplier_deleted(db, current_user, exist)