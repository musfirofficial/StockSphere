from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.schemas.user import UserCreate
from app.models import User, PasswordResetToken, local_tz
from app.services.security import hash_password
from typing import Sequence
from datetime import datetime
import uuid


# --------------------------- Create new user crud --------------------------- #
async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
    # 1. Hash password
    password_hash = hash_password(user_in.password)
    # 2. Add values
    new_user = User(
        **user_in.model_dump(exclude={"password"}), password_hash=password_hash
    )
    # 3. Store it in memory
    db.add(new_user)
    # 4. Store it in database
    await db.commit()
    # 5. Refresh the instance to get the generated id and other fields from the database
    await db.refresh(new_user)
    return new_user


# ------------------------- CRUD for get by user Name ------------------------ #
async def get_user_by_user_name(db: AsyncSession, user_name: str) -> User | None:
    result = await db.execute(select(User).filter(User.user_name == user_name))
    return result.scalar_one_or_none()


# ------------------------- CRUD for get by Email ---------------------------- #
async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(
        select(User).filter(func.lower(User.email) == email.strip().lower())
    )
    return result.scalar_one_or_none()


# ------------------ CRUD for get by Email or Username ----------------------- #
async def get_user_by_email_or_username(
    db: AsyncSession, identifier: str
) -> User | None:
    clean_id = identifier.strip().lower()
    result = await db.execute(
        select(User).where(
            (func.lower(User.email) == clean_id) | (func.lower(User.user_name) == clean_id)
        )
    )
    return result.scalar_one_or_none()


# -------------------------- CRUD for get by User ID ------------------------- #
async def get_user_by_user_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).filter(User.user_id == user_id))
    return result.scalars().first()


# -------------------------- CRUD for get all users -------------------------- #
async def get_all_users(db: AsyncSession) -> Sequence[User] | None:
    result = await db.execute(select(User))
    return result.scalars().all()


# ----------------------- CRUD for update existing user ----------------------- #
async def update_user(db: AsyncSession, db_user: User, update_data: dict) -> User:
    for field, value in update_data.items():
        setattr(db_user, field, value)
    try:
        await db.commit()
        await db.refresh(db_user)
    except Exception as e:
        await db.rollback()
        raise e
    return db_user


# ------------------------ CRUD for delete user ------------------------------ #
async def delete_user(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(delete(User).where(User.user_id == user_id))
    await db.commit()
    return


# -------------------- CRUD for Password Reset Tokens ------------------------ #
async def create_password_reset_token(
    db: AsyncSession, user_id: uuid.UUID, token_hash: str, expires_at: datetime
) -> PasswordResetToken:
    reset_record = PasswordResetToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(reset_record)
    await db.commit()
    await db.refresh(reset_record)
    return reset_record


async def get_valid_password_reset_token(
    db: AsyncSession, token_hash: str
) -> PasswordResetToken | None:
    now = datetime.now(local_tz)
    result = await db.execute(
        select(PasswordResetToken).where(
            (PasswordResetToken.token_hash == token_hash)
            & (PasswordResetToken.is_used == False)
            & (PasswordResetToken.expires_at > now)
        )
    )
    return result.scalar_one_or_none()


async def mark_password_reset_token_used(
    db: AsyncSession, token: PasswordResetToken
) -> None:
    token.is_used = True
    await db.commit()


async def reset_user_password(
    db: AsyncSession, user: User, new_password_hash: str
) -> User:
    user.password_hash = new_password_hash
    user.refresh_token = None  # Invalidate all active sessions
    await db.commit()
    await db.refresh(user)
    return user
