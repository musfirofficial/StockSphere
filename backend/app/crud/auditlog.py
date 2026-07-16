from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.auditlog import AuditlogCreate
from app.models import User, Category, Supplier, Item, AuditLog, AuditAction
from decimal import Decimal
from typing import Literal


# ----------------------- CRUD for create new auditlog ----------------------- #
async def create_audit_log(db: AsyncSession, auditlog_in: AuditlogCreate) -> AuditLog:
    new_auditlog = AuditLog(**auditlog_in.model_dump())
    db.add(new_auditlog)
    await db.commit()
    await db.refresh(new_auditlog)
    return new_auditlog

# -------------------------- Crud for login audi log ------------------------- #
async def log_user_login(db : AsyncSession, model: User) -> AuditLog:
    auditlog_login = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.LOGIN_SUCCESS,
        description="Logged in successfully.",
        target_table="users",
        target_id=model.user_id,
    )
    return await create_audit_log(db, auditlog_login)

# ------------------- Crud for user created audit AuditLog ------------------- #
async def log_user_created(db: AsyncSession, model: User, new_user: User) -> AuditLog:
    auditlog_in = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.USER_CREATE,
        description=f"Created a new user '{new_user.user_name}' with role '{new_user.role.value}'.",
        target_table="users",
        target_id=new_user.user_id,
    )
    return await create_audit_log(db, auditlog_in)

# ---------------------- Crud fo user deleted audit log ---------------------- #
async def log_user_deleted(db : AsyncSession, model: User, deleted_user: User) -> AuditLog:
    auditlog_delete = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.USER_DELETE,
        description=f"Deleted user '{deleted_user.user_name}' with role '{deleted_user.role.value}'.",
        target_table="users",
        target_id=deleted_user.user_id,
    )
    return await create_audit_log(db, auditlog_delete)

# -------------------- Crud for deactivated user audit log ------------------- #
async def log_user_deactivated(db : AsyncSession, model: User, deactivated_user: User) -> AuditLog:
    auditlog_deactivate = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.USER_DEACTIVATE,
        description=f"Deactivated user '{deactivated_user.user_name}' with role '{deactivated_user.role.value}'.",
        target_table="users",
        target_id=deactivated_user.user_id,
    )
    return await create_audit_log(db, auditlog_deactivate)

# ------------------------- Crud for change password ------------------------- #
async def changed_password(db : AsyncSession, model: User, changed_user: User) -> AuditLog:
    auditlog_change_password = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.USER_PASSWORD_CHANGE,
        description=f"Changed password for user '{changed_user.user_name}' with role '{changed_user.role.value}'.",
        target_table="users",
        target_id=changed_user.user_id,
    )
    return await create_audit_log(db, auditlog_change_password)

 # ------------------ crud for log category created audit log ----------------- #
async def log_category_created(db : AsyncSession, model: User, new_category: Category) -> AuditLog:
    auditlog_in = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.CATEGORY_CREATE,
        description=f"Created a new category '{new_category.category_name}'.",
        target_table="categories",
        target_id=new_category.category_id,
    )
    return await create_audit_log(db, auditlog_in)

# ------------------ crud for log category deleted audit log ----------------- #
async def log_category_deleted(db : AsyncSession, model: User, deleted_category: Category) -> AuditLog:
    auditlog_delete = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.CATEGORY_DELETE,
        description=f"Deleted category '{deleted_category.category_name}'.",
        target_table="categories",
        target_id=deleted_category.category_id,
    )
    return await create_audit_log(db, auditlog_delete)

# ------------------ Crud for log supllier created audit log ----------------- #
async def log_supplier_created(db : AsyncSession, model: User, new_supplier: Supplier) -> AuditLog:
    auditlog_in = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.SUPPLIER_CREATE,
        description=f"Created a new supplier '{new_supplier.supplier_name}'.",
        target_table="suppliers",
        target_id=new_supplier.supplier_id,
    )
    return await create_audit_log(db, auditlog_in)

# ------------------ Crud for log deleted supplier audit log ----------------- #
async def log_supplier_deleted(db : AsyncSession, model: User, deleted_supplier: Supplier) -> AuditLog:
    auditlog_delete = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.SUPPLIER_DELETE,
        description=f"Deleted supplier '{deleted_supplier.supplier_name}'.",
        target_table="suppliers",
        target_id=deleted_supplier.supplier_id,
    )
    return await create_audit_log(db, auditlog_delete)

# ---------------- Crud for log deactivated supplier audit log --------------- #
async def log_supplier_deactivated(db : AsyncSession, model: User, deactivated_supplier: Supplier) -> AuditLog:
    auditlog_deactivate = AuditlogCreate(
        user_id=model.user_id,
        action=AuditAction.SUPPLIER_DEACTIVATE,
        description=f"Deactivated supplier '{deactivated_supplier.supplier_name}'.",
        target_table="suppliers",
        target_id=deactivated_supplier.supplier_id,
    )
    return await create_audit_log(db, auditlog_deactivate)

# -------------------- Crud for log Item create audit log -------------------- #
async def log_item_created(db:AsyncSession, modal: User, new_item: Item):
    auditlog_in = AuditlogCreate(
        user_id=modal.user_id,
        action=AuditAction.ITEM_CREATE,
        description=f"Created a new item '{new_item.item_name}'.",
        target_table="items",
        target_id=new_item.item_id,
    )
    return await create_audit_log(db, auditlog_in)

# --------------------- Crud for log delete Item audi log -------------------- #
async def log_item_deleted(db:AsyncSession, modal: User, deleted_item: Item):
    auditlog_delete = AuditlogCreate(
        user_id=modal.user_id,
        action=AuditAction.ITEM_DELETE,
        description=f"Deleted item '{deleted_item.item_name}'.",
        target_table="items",
        target_id=deleted_item.item_id,
    )
    return await create_audit_log(db, auditlog_delete)

# --------------------- Crud for log deactivate Item audi log -------------------- #
async def log_item_deactivated(db:AsyncSession, modal: User, deactivated_item: Item):
    auditlog_deactivate = AuditlogCreate(
        user_id=modal.user_id,
        action=AuditAction.ITEM_DEACTIVATE,
        description=f"Deactivated item '{deactivated_item.item_name}'.",
        target_table="items",
        target_id=deactivated_item.item_id,
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
        description=f"Updated {label} price of item '{item.item_name}' from {old_value} to {new_value}.",
        target_table="items",
        target_id=item.item_id,
        old_value=str(old_value),
        new_value=str(new_value),
    )
    return await create_audit_log(db, auditlog_in)