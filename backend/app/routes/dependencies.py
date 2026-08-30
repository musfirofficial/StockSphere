import os
import uuid
from dotenv import load_dotenv
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, inspect
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.services.security import verify_password
from app.crud import user as user_crud
from app.database import get_async_session
from app.models import User, UserRole


# --------------------------------------------------------------- Schemas --------------------------------------------------------
# Token response — what backend returns after successful login
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # always "bearer" for JWT


class RefreshRequest(BaseModel):
    refresh_token: str


# --------------------------------------------------------------- Crud for login validate user --------------------------------------------------------
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)  # This where users get token if they dont have one


async def login_validate_user(db: AsyncSession, identifier: str, password: str) -> User:
    result = await user_crud.get_user_by_email_or_username(db, identifier=identifier)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(password, result.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not result.is_active:
        raise HTTPException(
            status_code=403,
            detail="Your account has been deactivated. Please contact support.",
        )
    return result


# --------------------------------------------------------------- Crud for store user refresh token --------------------------------------------------------
async def store_user_refresh_token(
    db: AsyncSession, user_id: uuid.UUID, refresh_token: str
):
    result = await db.execute(select(User).filter(User.user_id == user_id))
    user = result.scalars().first()
    if user:
        user.refresh_token = refresh_token
        await db.commit()
        await db.refresh(user)
    return user


# ---------------------------------------------------------------------------- #
#                         Crud for delete refresh token                        #
# ---------------------------------------------------------------------------- #
async def clear_user_refresh_token(db: AsyncSession, user_id: uuid.UUID):
    result = await db.execute(select(User).filter(User.user_id == user_id))
    user = result.scalars().first()
    if user:
        user.refresh_token = None
        await db.commit()
    return user


# --------------------------------------------------------------- Service for create token --------------------------------------------------------
# Create Access Token only
async def create_access_token(user: User) -> str:
    access_expire_time = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode_access = {
        "sub": str(user.user_id),
        "full_name": user.full_name,
        "role": user.role.value,
        "exp": access_expire_time,
        "type": "access",
    }
    if SECRET_KEY is None:
        raise ValueError("SECRET_KEY not found")
    encoded_jwt_access = jwt.encode(to_encode_access, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt_access


# Create Access Token and Refresh Token
async def create_full_token(user: User) -> dict:
    # Create Access Token
    encoded_jwt_access = await create_access_token(user)
    # Create Refresh Token
    refresh_expire_time = datetime.now(timezone.utc) + timedelta(
        days=REFRESH_TOKEN_EXPIRE_DAYS
    )
    to_encode_refres = {
        "sub": str(user.user_id),
        "exp": refresh_expire_time,
        "type": "refresh",
    }
    if SECRET_KEY is None:
        raise ValueError("SECRET_KEY not found")
    encoded_jwt_refresh = jwt.encode(to_encode_refres, SECRET_KEY, algorithm=ALGORITHM)
    # Check refresh token exist in db or not
    return {
        "access_token": encoded_jwt_access,
        "refresh_token": encoded_jwt_refresh,
        "token_type": "bearer",
    }


def verify_refresh_token(token: str) -> uuid.UUID:
    if SECRET_KEY is None:
        raise ValueError("SECRET_KEY not found")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")

        if not user_id or token_type != "refresh":
            raise HTTPException(
                status_code=401, detail="Invalid token type or missing subject"
            )

    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token expired or invalid")

    try:
        return uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID format in token")


# ------------------ Verify uniquenss for create, and update ----------------- #
async def verify_uniqueness(db, model, schema_in, exclude_id=None):

    # 1. Get all column names that have unique=True or are part of UniqueConstraints
    mapper = inspect(model)  # Allow to inspect DB Model
    unique_columns = [
        col.key
        for col in mapper.attrs
        if hasattr(col, "columns") and col.columns[0].unique
    ]
    # hasattr(col, 'columns'): Filter only coloumn mapped attribute, ignore relationship
    # co.coloums[0] In sqlachemy an attribute can be mapped to multiple columns as foreign key. all this mapping stor in a list, first elemt is the origin [0]

    error_list = []

    # 2. Loop through the unique columns of this model
    for col_name in unique_columns:
        # Check each col_name is present in schema_in, if it is return the value of that col_name, if not return None
        value = getattr(schema_in, col_name, None)
        if value is None:
            continue  # SKIP the rest of the function

        # Build dynamic query: SELECT * FROM table WHERE column = value
        # Case-insensitive match for strings, exact match for everything else
        if isinstance(value, str):
            condition = getattr(model, col_name).ilike(value)
        else:
            condition = getattr(model, col_name) == value

        query = select(model).where(condition)

        # Exclude current record if updating
        if exclude_id is not None:
            # Get the actual PK column name (e.g., 'user_id', 'category_id', etc.)
            pk_col = mapper.mapper.primary_key[0]
            query = query.where(pk_col != exclude_id)

        result = await db.execute(query)
        conflict = result.scalar_one_or_none()

        if conflict:
            # e.g., "Email is already taken."
            readable_name = col_name.replace("_", " ").capitalize()
            error_list.append(f"{readable_name} is already taken.")

    if error_list:
        raise HTTPException(status_code=400, detail=", ".join(error_list))


# ----------------- Class for role based return current user ----------------- #
class RoleChecker:
    def __init__(self, role: list[UserRole]):
        self.allowed_roles = role

    async def __call__(
        self,
        token: str = Depends(oauth2_scheme),
        db: AsyncSession = Depends(get_async_session),
    ) -> User:
        # Decode Token
        try:
            if SECRET_KEY is None:
                raise ValueError("SECRET_KEY not found")
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if user_id is None:
                raise HTTPException(status_code=401, detail="Invalid token payload")
        except JWTError:
            raise HTTPException(
                status_code=401, detail="Invalid authentication credentials"
            )

        # Check User is exist and active, and has enough permission
        user = await user_crud.get_user_by_user_id(db, user_id=uuid.UUID(user_id))

        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="User account is deactivated")
        if user.role not in self.allowed_roles:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        return user


# In router we need to use Depends. Depends only allow funtinons not function calls. The depends call the function. Other than functions depends also allow callable classes. With callable class FastAPI read token automatically.

# When in routes create new user the flow is
"""
1. FastAPI sees Depends(RoleChecker([UserRole.ADMIN]))
2. Calls RoleChecker.__call__()
3. __call__ has token: str = Depends(oauth2_scheme)
4. oauth2_scheme automatically reads the Authorization header
5. Extracts the token from "Bearer eyJhbG..."
6. Passes raw token string to __call__
7. __call__ decodes it, fetches user, checks role
8. Returns user object to current_user
"""
