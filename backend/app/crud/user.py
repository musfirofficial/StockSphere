from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.schemas.user import UserCreate
from app.models import User, UserRole
from app.services.security import hash_password
from typing import Sequence
import uuid

# --------------------------- Create new user crud --------------------------- #
async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
    # 1. Hash password
    password_hash = hash_password(user_in.password)
    # 2. Add values
    new_user = User(
        **user_in.model_dump(exclude={"password"}), 
        password_hash = password_hash) 
    # 3. Store it in memory
    db.add(new_user)
    # 4. Store it in database
    await db.commit()
    # 5. Refresh the instance to get the generated id and other fields from the database
    await db.refresh(new_user)
    return new_user

# ------------------------- crud for get by full Name ------------------------ #
async def get_user_by_full_name(db: AsyncSession, full_name : str) -> Sequence[User]:
    search = f"%{full_name}%"
    result = await db.execute(
        select(User)
        .where(User.full_name.ilike(search))
        .where(User.role != UserRole.ADMIN)
    )
    return result.scalars().all()

# ------------------------- CRUD for get by user Name ------------------------ #
async def get_user_by_user_name(db: AsyncSession, user_name : str) -> User | None:
    result = await db.execute(select(User).filter(User.user_name == user_name))
    return result.scalar_one_or_none()

# -------------------------- CRUD for get by User ID ------------------------- #
async def get_user_by_user_id(db:AsyncSession, user_id : uuid.UUID) -> User | None:
    result = await db.execute(select(User).filter(User.user_id == user_id))
    return result.scalars().first()

 # -------------------------- CRUD for get all users -------------------------- #
async def get_all_users(db: AsyncSession) -> Sequence[User] | None:
    result = await db.execute(select(User).where(User.role != UserRole.ADMIN))
    return result.scalars().all()

# ----------------------- CRUD for update exising user ----------------------- #
async def update_user(db: AsyncSession, db_user: User, update_data: dict) -> User:
    
    # 1. Apply the raw dict updates directly to the database object
    for field, value in update_data.items():
        setattr(db_user, field, value)
    # 2. Commit and refresh
    try:
        await db.commit()
        await db.refresh(db_user)
    except Exception as e:
        await db.rollback()
        raise e
        
    return db_user
# # ---------------------------------------------------------- CRUD for delete exising user ----------------------------------------------------
async def delete_user(db : AsyncSession, user_id : uuid.UUID) -> None:
    await db.execute(delete(User).where(User.user_id == user_id))
    await db.commit()
    return