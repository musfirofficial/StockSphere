import os

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_async_session
from app.schemas.user import UserCreate, UserResponse, UserUpdate, ChangePasswordRequest
from app.crud import user as user_crud
from app.crud import auditlog as auditlog_crud
from app.routes.dependencies import RoleChecker, verify_uniqueness
from app.services.security import hash_password, verify_password
from app.models import User, UserRole
import uuid

router = APIRouter(prefix="/users", tags=["users"])

load_dotenv()
RECOVARY_ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "adminhomerex")


# -------------------- New user create endpoint (Admin Only) -------------------- #
@router.post("/", response_model=UserResponse, status_code=201)
async def create_new_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(RoleChecker([UserRole.ADMIN])),
):
    await verify_uniqueness(db, User, user_in)
    new_user = await user_crud.create_user(db, user_in)
    await auditlog_crud.log_user_created(db, current_user, new_user)
    return new_user


# --------------------------- Get all user endpoint -------------------------- #
@router.get("/", response_model=list[UserResponse])
async def read_all_users(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(RoleChecker([UserRole.ADMIN])),
):
    return await user_crud.get_all_users(db)


# -------------------- Endpoint for get user by user name -------------------- #
@router.get("/{user_name}", response_model=list[UserResponse])
async def read_user_by_username(
    user_name: str,
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
    result = await user_crud.get_user_by_user_name(db, user_name)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    return [result]


# ------------------------- Endpoint for update user ------------------------- #
@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    user_in: UserUpdate,
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
    target_user = await user_crud.get_user_by_user_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Guard: super admin account is immutable — no one can update it, not even itself
    if target_user.user_name == RECOVARY_ADMIN_USERNAME:
        raise HTTPException(
            status_code=403, detail="Super admin account cannot be modified"
        )

    is_super_admin = current_user.user_name == RECOVARY_ADMIN_USERNAME
    is_admin = current_user.role == UserRole.ADMIN
    is_self = current_user.user_id == target_user.user_id

    update_data = user_in.model_dump(exclude_unset=True, exclude_none=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if is_super_admin:
        # Super admin: can update anyone with full schema (including is_active)
        pass

    elif is_admin:
        # Regular admin: self-only, cannot deactivate own account
        if is_self:
            if user_in.is_active is False:
                raise HTTPException(
                    status_code=403, detail="Admin cannot deactivate their own account"
                )
        else:
            # Regular admin updating someone else:
            # Prevent updating other admins
            if target_user.role == UserRole.ADMIN:
                raise HTTPException(
                    status_code=403,
                    detail="Regular administrators cannot update other administrators",
                )

    else:
        # Other roles: self-only, no is_active field
        if not is_self:
            raise HTTPException(
                status_code=403, detail="You can only update your own profile"
            )
        # Prevent other roles from updating is_active
        if "is_active" in update_data:
            raise HTTPException(
                status_code=403, detail="You cannot deactivate your self"
            )

    await verify_uniqueness(db, User, user_in, target_user.user_id)
    updated_user = await user_crud.update_user(db, target_user, update_data)
    if "is_active" in update_data and update_data["is_active"] is False:
        await auditlog_crud.log_user_deactivated(db, current_user, target_user)
    if "is_active" in update_data and update_data["is_active"] is True:
        await auditlog_crud.log_user_reactivated(db, current_user, target_user)
    return updated_user


# ---------- Endpoint for change user password with admin user check --------- #
@router.put("/{user_id}/password", status_code=200)
async def change_user_password(
    user_id: uuid.UUID,
    user_in: ChangePasswordRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(
        RoleChecker(
            [
                UserRole.ADMIN,
                UserRole.INVENTORY_MANAGER,
                UserRole.AUDITOR,
                UserRole.SALES,
            ]
        )
    ),
):
    # variables
    is_super_admin = current_user.user_name == RECOVARY_ADMIN_USERNAME
    is_admin = current_user.role == UserRole.ADMIN and not is_super_admin
    is_self = current_user.user_id == user_id

    # target_user
    target_user = await user_crud.get_user_by_user_id(db, user_id=user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Chnage own password
    if is_self:
        if is_super_admin:
            raise HTTPException(
                status_code=403, detail="Super admin account cannot be modified"
            )
    # Change other's password
    else:
        if is_super_admin:
            pass  # Super admin can change anyone's password
        elif is_admin:
            if target_user.role == UserRole.ADMIN:
                raise HTTPException(
                    status_code=403,
                    detail="Admins cannot change another admin's password.",
                )
        else:
            raise HTTPException(
                status_code=403,
                detail="You are not authorized to change this user's password.",
            )

    # require current password
    requires_current_password = is_self and not is_super_admin

    if requires_current_password:
        # Ensure current password was actually sent
        if not user_in.current_password:
            raise HTTPException(status_code=400, detail="Current password is required.")

        # Prevent setting the exact same password
        if user_in.new_password == user_in.current_password:
            raise HTTPException(
                status_code=400,
                detail="New password cannot be the same as the current password.",
            )

        # Verify authenticity against current user's actual hash
        if not verify_password(user_in.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=400, detail="Current password is incorrect."
            )

    target_user.password_hash = hash_password(user_in.new_password)
    target_user.refresh_token = None

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=500, detail="Failed to update password in database"
        )

    # --- Database Commit & Token Invalidation ---
    await auditlog_crud.changed_password(db, current_user, target_user)
    return {"detail": "Password updated successfully. Please log in again."}


# ------------------------- Enddpoint for delete user ------------------------ #
@router.delete("/{user_id}", status_code=204)
async def delete_existing_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(RoleChecker([UserRole.ADMIN])),
):
    # 1. Fetch the user to be deleted
    target_user = await user_crud.get_user_by_user_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Prevent ANY user from deleting themselves
    if current_user.user_id == target_user.user_id:
        raise HTTPException(
            status_code=403, detail="You cannot delete your own account"
        )

    # 3. Prevent ANYONE from deleting the hardcoded admin
    if target_user.user_name == RECOVARY_ADMIN_USERNAME:
        raise HTTPException(
            status_code=403,
            detail="The system recovery admin account cannot be deleted",
        )

    # 4. Enforce role restrictions for regular administrators
    if current_user.user_name != RECOVARY_ADMIN_USERNAME:
        # Regular admins cannot delete other admins
        if target_user.role == UserRole.ADMIN:
            raise HTTPException(
                status_code=403,
                detail="Regular administrators cannot delete other administrators",
            )

    # 5. If all checks pass, proceed with deletion
    await user_crud.delete_user(db, user_id=user_id)
    await auditlog_crud.log_user_deleted(db, current_user, target_user)
