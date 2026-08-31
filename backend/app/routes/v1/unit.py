from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.schemas.unit import UnitCreate, UnitUpdate, UnitResponse
from app.crud import unit as unit_crud
from app.routes.dependencies import RoleChecker
from app.models import User, UserRole
import uuid

router = APIRouter(prefix="/units", tags=["units"])


# --------------------------- Get all units endpoint ------------------------- #
@router.get("/", response_model=list[UnitResponse])
async def read_all_units(
    active_only: bool = False,
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
    return await unit_crud.get_all_units(db, active_only=active_only)


# --------------------------- Get unit by ID endpoint ------------------------ #
@router.get("/{unit_id}", response_model=UnitResponse)
async def read_unit_by_id(
    unit_id: uuid.UUID,
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
    unit = await unit_crud.get_unit_by_id(db, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Measurement unit not found")
    return unit


# --------------------------- Create unit endpoint --------------------------- #
@router.post("/", response_model=UnitResponse, status_code=201)
async def create_new_unit(
    unit_in: UnitCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    # Check symbol uniqueness
    existing_symbol = await unit_crud.get_unit_by_symbol(db, unit_in.unit_symbol)
    if existing_symbol:
        raise HTTPException(
            status_code=400,
            detail=f"Unit with symbol '{unit_in.unit_symbol.lower()}' already exists ({existing_symbol.unit_name}).",
        )

    # Check name uniqueness
    existing_name = await unit_crud.get_unit_by_name(db, unit_in.unit_name)
    if existing_name:
        raise HTTPException(
            status_code=400,
            detail=f"Unit named '{unit_in.unit_name}' already exists with symbol '{existing_name.unit_symbol}'.",
        )

    return await unit_crud.create_unit(db, unit_in)


# --------------------------- Update unit endpoint --------------------------- #
@router.patch("/{unit_id}", response_model=UnitResponse)
async def update_unit(
    unit_id: uuid.UUID,
    unit_in: UnitUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    target_unit = await unit_crud.get_unit_by_id(db, unit_id)
    if not target_unit:
        raise HTTPException(status_code=404, detail="Measurement unit not found")

    update_data = unit_in.model_dump(exclude_unset=True, exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # If updating symbol, ensure uniqueness
    if "unit_symbol" in update_data:
        found_symbol = await unit_crud.get_unit_by_symbol(db, update_data["unit_symbol"])
        if found_symbol and found_symbol.unit_id != unit_id:
            raise HTTPException(
                status_code=400,
                detail=f"Unit symbol '{update_data['unit_symbol']}' is already in use by {found_symbol.unit_name}.",
            )

    # If updating name, ensure uniqueness
    if "unit_name" in update_data:
        found_name = await unit_crud.get_unit_by_name(db, update_data["unit_name"])
        if found_name and found_name.unit_id != unit_id:
            raise HTTPException(
                status_code=400,
                detail=f"Unit name '{update_data['unit_name']}' is already in use.",
            )

    return await unit_crud.update_unit(db, target_unit, update_data)


# --------------------------- Delete unit endpoint --------------------------- #
@router.delete("/{unit_id}", status_code=204)
async def delete_unit(
    unit_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(RoleChecker([UserRole.ADMIN])),
):
    target_unit = await unit_crud.get_unit_by_id(db, unit_id)
    if not target_unit:
        raise HTTPException(status_code=404, detail="Measurement unit not found")

    # Check if items are currently assigned to this unit
    usage_count = await unit_crud.count_items_using_unit(db, unit_id)
    if usage_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete unit '{target_unit.unit_name}' ({target_unit.unit_symbol}) because it is assigned to {usage_count} inventory item(s). Reassign or deactivate it instead.",
        )

    await unit_crud.delete_unit(db, unit_id)
