from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, Request
from app.database import get_async_session
from app.routes import dependencies as dependencies
from fastapi.security import OAuth2PasswordRequestForm
from app.schemas.user import ForgotPasswordRequest, ResetPasswordConfirm, LoginRequest
from app.crud import user as user_crud
from app.crud import auditlog as auditlog_crud
from app.models import User, UserRole, local_tz
from app.services.security import hash_password
from app.services.email import send_password_reset_email
from datetime import datetime, timedelta
import secrets
import hashlib

router = APIRouter(prefix="/auth", tags=["authentication"])


# ------------------------------ login endpoint ------------------------------ #
@router.post("/login", response_model=dependencies.TokenResponse)
async def login(
    request: Request,
    db: AsyncSession = Depends(get_async_session),
):
    identifier = ""
    password = ""

    # Support both JSON payload and x-www-form-urlencoded
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        body = await request.json()
        identifier = body.get("identifier") or body.get("username", "")
        password = body.get("password", "")
    else:
        form = await request.form()
        identifier = str(form.get("username") or form.get("identifier") or "")
        password = str(form.get("password") or "")

    if not identifier or not password:
        raise HTTPException(status_code=400, detail="Identifier and password are required")

    user = await dependencies.login_validate_user(db, identifier=identifier, password=password)
    token_data = await dependencies.create_full_token(user)

    # Save refresh token in DB
    await dependencies.store_user_refresh_token(
        db, user_id=user.user_id, refresh_token=token_data["refresh_token"]
    )
    await auditlog_crud.log_user_login(db, user)
    return token_data


# --------------------------- Refresh token endpoint -------------------------- #
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

    token_data = await dependencies.create_full_token(user)
    await dependencies.store_user_refresh_token(
        db, user_id=user.user_id, refresh_token=token_data["refresh_token"]
    )
    return token_data


# --------------------------- Forgot Password endpoint ------------------------ #
@router.post("/forgot-password", status_code=200)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_async_session),
):
    user = await user_crud.get_user_by_email(db, email=body.email)
    generic_msg = "If an account exists with this email address, a password reset link has been sent."

    if not user or not user.is_active:
        return {"detail": generic_msg}

    # Generate 32-byte secure random token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(local_tz) + timedelta(minutes=15)

    await user_crud.create_password_reset_token(
        db=db,
        user_id=user.user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )

    await send_password_reset_email(
        to_email=user.email,
        recipient_name=user.full_name,
        reset_token=raw_token,
    )

    return {"detail": generic_msg}


# --------------------------- Reset Password endpoint ------------------------- #
@router.post("/reset-password", status_code=200)
async def reset_password(
    body: ResetPasswordConfirm,
    db: AsyncSession = Depends(get_async_session),
):
    token_hash = hashlib.sha256(body.token.encode("utf-8")).hexdigest()
    reset_record = await user_crud.get_valid_password_reset_token(db, token_hash=token_hash)

    if not reset_record:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired password reset link. Please request a new one.",
        )

    user = await user_crud.get_user_by_user_id(db, user_id=reset_record.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=400,
            detail="User account associated with this token is invalid or inactive.",
        )

    new_hash = hash_password(body.new_password)
    await user_crud.reset_user_password(db, user=user, new_password_hash=new_hash)
    await user_crud.mark_password_reset_token_used(db, token=reset_record)

    return {"detail": "Your password has been reset successfully. Please log in with your new password."}


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
    ),
    db: AsyncSession = Depends(get_async_session),
):
    await dependencies.clear_user_refresh_token(db, user_id=current_user.user_id)
    await auditlog_crud.log_user_logout(db, current_user)
    return {"detail": "Logged out successfully"}
