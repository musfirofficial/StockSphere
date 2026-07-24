from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.schemas.auditlog import AuditlogCreate
from app.models import User, Category, Supplier, Item, AuditLog, AuditAction
from decimal import Decimal
from typing import Literal, Sequence


# ----------------------- CRUD for create new auditlog ----------------------- #
async def create_audit_log(db: AsyncSession, auditlog_in: AuditlogCreate) -> AuditLog:
    new_auditlog = AuditLog(**auditlog_in.model_dump())
    db.add(new_auditlog)
    await db.commit()
    await db.refresh(new_auditlog)
    return new_auditlog


# ------------------------ Crud for get all auditlogs ------------------------ #
async def get_audit_logs(
    db: AsyncSession, limit: int = 10, offset: int = 0
) -> Sequence[AuditLog]:
    # It's best practice to order by ID or created timestamp for deterministic pagination
    query = (
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(query)
    return result.scalars().all()


# -------------------------- Crud for login audi log ------------------------- #
async def log_user_login(db: AsyncSession, model: User) -> AuditLog:
    auditlog_login = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.LOGIN_SUCCESS,
        description=f"User {model.full_name} ({model.user_name}) with role {model.role.value} logged in successfully.",
        target_table="users",
    )
    return await create_audit_log(db, auditlog_login)


# ------------------------- Crud for logout audit log ------------------------ #
async def log_user_logout(db: AsyncSession, model: User) -> AuditLog:
    auditlog_login = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.LOGOUT_SUCCESS,
        description=f"User {model.full_name} ({model.user_name}) with role {model.role.value} logged out successfully.",
        target_table="users",
    )
    return await create_audit_log(db, auditlog_login)


# ------------------- Crud for user created audit AuditLog ------------------- #
async def log_user_created(db: AsyncSession, model: User, new_user: User) -> AuditLog:
    auditlog_in = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.USER_CREATE,
        description=f"{model.full_name} ({model.user_name}) Created a new user {new_user.full_name} ({new_user.user_name}) with role {new_user.role.value}.",
        target_table="users",
        target_id=new_user.user_id,
    )
    return await create_audit_log(db, auditlog_in)


# ---------------------- Crud fo user deleted audit log ---------------------- #
async def log_user_deleted(
    db: AsyncSession, model: User, deleted_user: User
) -> AuditLog:
    auditlog_delete = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.USER_DELETE,
        description=f"{model.full_name} ({model.user_name}) deleted user {deleted_user.full_name} ({deleted_user.user_name}) with role {deleted_user.role.value}.",
        target_table="users",
        target_id=deleted_user.user_id,
    )
    return await create_audit_log(db, auditlog_delete)


# -------------------- Crud for deactivated user audit log ------------------- #
async def log_user_deactivated(
    db: AsyncSession, model: User, deactivated_user: User
) -> AuditLog:
    auditlog_deactivate = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.USER_DEACTIVATE,
        description=f"{model.full_name} ({model.user_name}) deactivated user {deactivated_user.full_name} ({deactivated_user.user_name}) with role {deactivated_user.role.value}.",
        target_table="users",
        target_id=deactivated_user.user_id,
    )
    return await create_audit_log(db, auditlog_deactivate)


# -------------------- Crud for reactivated user audit log ------------------- #
async def log_user_reactivated(
    db: AsyncSession, model: User, reactivated: User
) -> AuditLog:
    auditlog_deactivate = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.USER_REACTIVATE,
        description=f"{model.full_name} ({model.user_name}) reactivated user {reactivated.full_name} ({reactivated.user_name}) with role {reactivated.role.value}.",
        target_table="users",
        target_id=reactivated.user_id,
    )
    return await create_audit_log(db, auditlog_deactivate)


# ------------------------- Crud for change password ------------------------- #
async def changed_password(
    db: AsyncSession, model: User, changed_user: User
) -> AuditLog:
    auditlog_change_password = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.USER_PASSWORD_CHANGE,
        description=f"{model.full_name} ({model.user_name}) changed password for user {changed_user.full_name} ({changed_user.user_name}) with role {changed_user.role.value}.",
        target_table="users",
        target_id=changed_user.user_id,
    )
    return await create_audit_log(db, auditlog_change_password)


# ------------------ crud for log category created audit log ----------------- #
async def log_category_created(
    db: AsyncSession, model: User, new_category: Category
) -> AuditLog:
    auditlog_in = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.CATEGORY_CREATE,
        description=f"{model.full_name} ({model.user_name}) Created a new category '{new_category.category_name}'.",
        target_table="categories",
        target_id=new_category.category_id,
    )
    return await create_audit_log(db, auditlog_in)


# ------------------ crud for log category deleted audit log ----------------- #
async def log_category_deleted(
    db: AsyncSession, model: User, deleted_category: Category
) -> AuditLog:
    auditlog_delete = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.CATEGORY_DELETE,
        description=f"{model.full_name} ({model.user_name}) Deleted category '{deleted_category.category_name}'.",
        target_table="categories",
        target_id=deleted_category.category_id,
    )
    return await create_audit_log(db, auditlog_delete)


# ------------------ Crud for log supllier created audit log ----------------- #
async def log_supplier_created(
    db: AsyncSession, model: User, new_supplier: Supplier
) -> AuditLog:
    auditlog_in = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.SUPPLIER_CREATE,
        description=f"{model.full_name} ({model.user_name}) Created a new supplier '{new_supplier.supplier_name}'.",
        target_table="suppliers",
        target_id=new_supplier.supplier_id,
    )
    return await create_audit_log(db, auditlog_in)


# ------------------ Crud for log deleted supplier audit log ----------------- #
async def log_supplier_deleted(
    db: AsyncSession, model: User, deleted_supplier: Supplier
) -> AuditLog:
    auditlog_delete = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.SUPPLIER_DELETE,
        description=f"{model.full_name} ({model.user_name}) Deleted supplier '{deleted_supplier.supplier_name}'.",
        target_table="suppliers",
        target_id=deleted_supplier.supplier_id,
    )
    return await create_audit_log(db, auditlog_delete)


# ---------------- Crud for log deactivated supplier audit log --------------- #
async def log_supplier_deactivated(
    db: AsyncSession, model: User, deactivated_supplier: Supplier
) -> AuditLog:
    auditlog_deactivate = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.SUPPLIER_DEACTIVATE,
        description=f"{model.full_name} ({model.user_name}) Deactivated supplier '{deactivated_supplier.supplier_name}'.",
        target_table="suppliers",
        target_id=deactivated_supplier.supplier_id,
    )
    return await create_audit_log(db, auditlog_deactivate)


# ---------------- Crud for log reactivated supplier audit log --------------- #
async def log_supplier_reactivated(
    db: AsyncSession, model: User, reactivated_supplier: Supplier
) -> AuditLog:
    auditlog_deactivate = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.SUPPLIER_REACTIVATE,
        description=f"{model.full_name} ({model.user_name}) Reactivated supplier '{reactivated_supplier.supplier_name}'.",
        target_table="suppliers",
        target_id=reactivated_supplier.supplier_id,
    )
    return await create_audit_log(db, auditlog_deactivate)


# -------------------- Crud for log Item create audit log -------------------- #
async def log_item_created(db: AsyncSession, model: User, new_item: Item):
    auditlog_in = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.ITEM_CREATE,
        description=f"{model.full_name} ({model.user_name}) Created a new item '{new_item.item_name}'.",
        target_table="items",
        target_id=new_item.item_id,
    )
    return await create_audit_log(db, auditlog_in)


# --------------------- Crud for log delete Item audi log -------------------- #
async def log_item_deleted(db: AsyncSession, model: User, deleted_item: Item):
    auditlog_delete = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.ITEM_DELETE,
        description=f"{model.full_name} ({model.user_name}) Deleted item '{deleted_item.item_name}'.",
        target_table="items",
        target_id=deleted_item.item_id,
    )
    return await create_audit_log(db, auditlog_delete)


# --------------------- Crud for log deactivate Item audi log -------------------- #
async def log_item_deactivated(db: AsyncSession, model: User, deactivated_item: Item):
    auditlog_deactivate = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.ITEM_DEACTIVATE,
        description=f"{model.full_name} ({model.user_name}) Deactivated item '{deactivated_item.item_name}'.",
        target_table="items",
        target_id=deactivated_item.item_id,
    )
    return await create_audit_log(db, auditlog_deactivate)


# ------------------ Crud for log reactivated Item audi log ------------------ #
async def log_item_reactivated(db: AsyncSession, model: User, reactivated_item: Item):
    auditlog_deactivate = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.ITEM_DEACTIVATE,
        description=f"{model.full_name} ({model.user_name}) Reactivated item '{reactivated_item.item_name}'.",
        target_table="items",
        target_id=reactivated_item.item_id,
    )
    return await create_audit_log(db, auditlog_deactivate)


# ------------------- Crud for Itme price change audit log ------------------- #
async def log_item_price_updated(
    db: AsyncSession,
    actor: User,
    item: Item,
    price_type: Literal["cost_price", "selling_price"],
    old_value: Decimal,
    new_value: Decimal,
) -> AuditLog:
    label = "cost" if price_type == "cost_price" else "selling"
    auditlog_in = AuditlogCreate(
        user_id=actor.user_id,
        action=AuditAction.ITEM_PRICE_UPDATE,
        description=f"{actor.full_name} ({actor.user_name}) Updated {label} price of item '{item.item_name}' from {old_value} to {new_value}.",
        target_table="items",
        target_id=item.item_id,
        old_value=str(old_value),
        new_value=str(new_value),
    )
    return await create_audit_log(db, auditlog_in)
