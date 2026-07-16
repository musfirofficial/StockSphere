from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, distinct
from app.schemas.supplier import SupplierCreate
from app.models import Supplier, StockAlert, AlertStatus
from typing import Sequence
import uuid


# ---------------------------- create new supplier --------------------------- #
async def create_supplier(db: AsyncSession, supplier_in: SupplierCreate) -> Supplier:
    new_supplier = Supplier(**supplier_in.model_dump())

    db.add(new_supplier)
    await db.commit()
    await db.refresh(new_supplier)
    return new_supplier


# ------------------------ Crud for get all suppliers ------------------------ #
async def get_all_suppliers(db: AsyncSession) -> Sequence[Supplier] | None:
    result = await db.execute(select(Supplier))
    return result.scalars().all()


# --------------------- Crud for update existing supplier -------------------- #
async def update_supplier(
    db: AsyncSession, db_supplier: Supplier, update_data: dict
) -> Supplier:

    # 1. Apply the raw dict updates directly to the database object
    for field, value in update_data.items():
        setattr(db_supplier, field, value)
    # 2. Commit and refresh
    try:
        await db.commit()
        await db.refresh(db_supplier)
    except Exception as e:
        await db.rollback()
        raise e

    return db_supplier


# ------------------------ crud for Get supplier by supplier ID ----------------------- #
async def get_supplier_by_supplier_id(
    db: AsyncSession, supplier_id: uuid.UUID
) -> Supplier | None:
    result = await db.execute(
        select(Supplier).where(Supplier.supplier_id == supplier_id)
    )
    return result.scalar_one_or_none()


# ------------------------- crud for delete supplier ------------------------- #
async def delete_supplier(db: AsyncSession, supplier_id: uuid.UUID) -> None:
    await db.execute(delete(Supplier).where(Supplier.supplier_id == supplier_id))
    await db.commit()
    return
