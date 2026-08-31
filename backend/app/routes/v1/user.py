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


# --------------------------- Get all users endpoint -------------------------- #
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

    is_admin = current_user.role == UserRole.ADMIN
    is_self = current_user.user_id == target_user.user_id

    update_data = user_in.model_dump(exclude_unset=True, exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if is_admin:
        # Admin updating self: cannot deactivate own account
        if is_self and user_in.is_active is False:
            raise HTTPException(
                status_code=403, detail="You cannot deactivate your own account."
            )

        # Admin demoting own role or another admin: check if they are the only remaining active admin
        if user_in.role is not None and user_in.role != UserRole.ADMIN and target_user.role == UserRole.ADMIN:
            active_admin_count = await user_crud.get_active_admin_count(db)
            if active_admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot demote the only remaining active Admin account.",
                )

        # Admin deactivating another admin: check if that admin is the only active admin
        if not is_self and target_user.role == UserRole.ADMIN and user_in.is_active is False:
            active_admin_count = await user_crud.get_active_admin_count(db)
            if active_admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot deactivate the only remaining active Admin account.",
                )

    else:
        # Non-admin users: can only update their own profile
        if not is_self:
            raise HTTPException(
                status_code=403, detail="You can only update your own profile"
            )
        # Non-admin users cannot change role or active status
        if "role" in update_data:
            raise HTTPException(
                status_code=403, detail="You cannot change your own role"
            )
        if "is_active" in update_data:
            raise HTTPException(
                status_code=403, detail="You cannot change your own active status"
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
    target_user = await user_crud.get_user_by_user_id(db, user_id=user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    is_admin = current_user.role == UserRole.ADMIN
    is_self = current_user.user_id == user_id

    # Non-admins can only change their own password
    if not is_self and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to change this user's password.",
        )

    # Self password change requires verifying current password
    if is_self:
        if not user_in.current_password:
            raise HTTPException(status_code=400, detail="Current password is required.")

        if user_in.new_password == user_in.current_password:
            raise HTTPException(
                status_code=400,
                detail="New password cannot be the same as the current password.",
            )

        if not verify_password(user_in.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=400, detail="Current password is incorrect."
            )

    target_user.password_hash = hash_password(user_in.new_password)
    target_user.refresh_token = None  # Invalidate active session tokens

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=500, detail="Failed to update password in database"
        )

    await auditlog_crud.changed_password(db, current_user, target_user)
    return {"detail": "Password updated successfully. Please log in again."}


# ------------------------- Endpoint for delete user ------------------------ #
@router.delete("/{user_id}", status_code=204)
async def delete_existing_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(RoleChecker([UserRole.ADMIN])),
):
    target_user = await user_crud.get_user_by_user_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent ANY user from deleting themselves
    if current_user.user_id == target_user.user_id:
        raise HTTPException(
            status_code=403, detail="You cannot delete your own account"
        )

    # Last remaining admin guard
    if target_user.role == UserRole.ADMIN:
        active_admin_count = await user_crud.get_active_admin_count(db)
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the only remaining Admin account in the system.",
            )

    await user_crud.delete_user(db, user_id=user_id)
    await auditlog_crud.log_user_deleted(db, current_user, target_user)
