from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.schemas.category import CategoryCreate, CategoryResponse, CategoryUpdate
from app.crud import category as crud_category
from app.crud import auditlog as auditlog_crud
from app.routes.dependencies import RoleChecker, verify_uniqueness
from app.models import Category, User, UserRole
import uuid

router = APIRouter(prefix="/categories", tags=["categories"])


# --------------------------------------------------------------- Create a new category endpoint --------------------------------------------------------
@router.post("/", response_model=CategoryResponse, status_code=201)
async def create_new_category(
    catergory_in: CategoryCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    await verify_uniqueness(db, Category, catergory_in)
    catergory = await crud_category.create_category(db, catergory_in)
    await auditlog_crud.log_category_created(db, current_user, catergory)
    return catergory


# --------------------------------------------------------------- Get all category endpoint --------------------------------------------------------
@router.get("/", response_model=list[CategoryResponse])
async def read_all_categories(
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
    return await crud_category.get_all_categories(db)


# --------------------------------------------------------------- Get category by name endpoint --------------------------------------------------------
@router.get("/{category_name}", response_model=CategoryResponse)
async def read_category_by_name(
    category_name: str,
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
    result = await crud_category.get_category_by_category_name(db, category_name)
    if not result:
        raise HTTPException(status_code=404, detail="Category not found")
    return result


# ---------------------------------------------------- Update Category -----------------------------------------------------------
@router.patch("/{category_id}", response_model=CategoryResponse)
async def update_existing_category(
    category_id: uuid.UUID,
    category_in: CategoryUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    category = await crud_category.get_category_by_category_id(
        db, category_id=category_id
    )
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = category_in.model_dump(exclude_none=True, exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    await verify_uniqueness(db, category, category_in, category_id)

    return await crud_category.update_category(db, category, update_data)


# ---------------------------------------------------- Delete Category endpoint -----------------------------------------------------------
@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker([UserRole.ADMIN, UserRole.INVENTORY_MANAGER])
    ),
):
    category = await crud_category.get_category_by_category_id(
        db, category_id=category_id
    )
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    await crud_category.delete_category(db, category_id=category_id)
    await auditlog_crud.log_category_deleted(db, current_user, category)
