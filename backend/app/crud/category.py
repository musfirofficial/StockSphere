from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.schemas.category import CategoryCreate
from app.models import Category
from typing import Optional, Sequence
import uuid

# ----------------------- CRUD for create new category ----------------------- #
async def create_category(db : AsyncSession, category_in : CategoryCreate) -> Category:
    new_category = Category(
        **category_in.model_dump()
    )
    db.add(new_category)
    await db.commit()
    await db.refresh(new_category)
    return new_category

# ------------------------ CRUD for read all category ------------------------ #
async def get_all_categories(db : AsyncSession) -> Sequence[Category] | None:
    result = await db.execute(select(Category))
    return result.scalars().all()

# ------------------------ CRUD for get by category id ----------------------- #
async def get_category_by_category_id(db :AsyncSession, category_id : uuid.UUID) -> Category | None:
    result = await db.execute(select(Category).filter(Category.category_id== category_id))
    return result.scalars().first()

# --------------------- CRUD for update existing category -------------------- #
async def update_category(db : AsyncSession, db_category: Category, update_data : dict) -> Category:
    
    # 1. Apply the raw dict updates directly to the database object
    for field, value in update_data.items():
        setattr(db_category, field, value)
    # 2. Commit and refresh
    try:
        await db.commit()
        await db.refresh(db_category)
    except Exception as e:
        await db.rollback()
        raise e
        
    return db_category

# --------------------------- Delete category crud --------------------------- #
async def delete_category(db : AsyncSession, category_id : uuid.UUID) -> None:
    await db.execute(delete(Category).where(Category.category_id == category_id))
    await db.commit()
    return

# --------------------- CRUD for search by category name --------------------- #
async def get_category_by_category_name(db : AsyncSession, category_name: str) -> Optional[Category]:
    category_name = f"%{category_name}%"
    result = await db.execute(select(Category).filter(Category.category_name.ilike(category_name)))
    return result.scalars().first()