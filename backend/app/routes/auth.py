from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException
from app.database import get_async_session
from app.routes import dependencies as dependencies
from fastapi.security import OAuth2PasswordRequestForm
from app.crud import user as user_crud
from app.crud import auditlog as auditlog_crud
from app.models import User, UserRole

router = APIRouter(prefix="/auth", tags=["authentication"])


# ------------------------------ login endpoint ------------------------------ #
@router.post("/login", response_model=dependencies.TokenResponse)
async def login(
    # This 'Depends()' tells FastAPI to look for Form data (username/password) so it dosent need a login schema
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_async_session),
):
    # Note: OAuth2PasswordRequestForm uses .username (NOT .user_name)
    user = await dependencies.login_validate_user(
        db, form_data.username, form_data.password
    )
    token_data = await dependencies.create_full_token(user)
    # Save the refresh token in the database
    await dependencies.store_user_refresh_token(
        db, user_id=user.user_id, refresh_token=token_data["refresh_token"]
    )
    await auditlog_crud.log_user_login(db, user)
    return token_data


# --------------------------- Refres token endpoint -------------------------- #
@router.post("/refresh", response_model=dependencies.TokenResponse)
async def refresh_access_token(
    body: dependencies.RefreshRequest,
    db: AsyncSession = Depends(get_async_session),
):
    user_id = dependencies.verify_refresh_token(body.refresh_token)
    user = await user_crud.get_user_by_user_id(db, user_id=user_id)

    if not user or user.refresh_token != body.refresh_token:
        raise HTTPException(status_code=401, detail="Token revoked or session expired")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account has been deactivated.")

    # Rotate: issue new access + new refresh, replace stored refresh token
    token_data = await dependencies.create_full_token(user)
    await dependencies.store_user_refresh_token(
        db, user_id=user.user_id, refresh_token=token_data["refresh_token"]
    )
    return token_data


# ------------------------------ Logout endpoint ----------------------------- #
@router.post("/logout")
async def logout(
    current_user: User = Depends(
        dependencies.RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
                UserRole.SALES,
                UserRole.AUDITOR,
            ]
        )
    ),  # from access token
    db: AsyncSession = Depends(get_async_session),
):
    await dependencies.clear_user_refresh_token(db, user_id=current_user.user_id)
    return {"detail": "Logged out successfully"}
