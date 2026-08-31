from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.models import Unit, Item
from app.schemas.unit import UnitCreate, UnitUpdate
from typing import Sequence
import uuid


DEFAULT_UNITS = [
    {"unit_name": "Pieces", "unit_symbol": "pcs", "description": "Individual items or countable units"},
    {"unit_name": "Kilograms", "unit_symbol": "kg", "description": "Weight in metric kilograms"},
    {"unit_name": "Grams", "unit_symbol": "g", "description": "Weight in metric grams"},
    {"unit_name": "Milligrams", "unit_symbol": "mg", "description": "Weight in milligrams"},
    {"unit_name": "Liters", "unit_symbol": "L", "description": "Liquid volume in liters"},
    {"unit_name": "Milliliters", "unit_symbol": "ml", "description": "Liquid volume in milliliters"},
    {"unit_name": "Meters", "unit_symbol": "m", "description": "Length in metric meters"},
    {"unit_name": "Centimeters", "unit_symbol": "cm", "description": "Length in metric centimeters"},
    {"unit_name": "Millimeters", "unit_symbol": "mm", "description": "Length in metric millimeters"},
    {"unit_name": "Boxes", "unit_symbol": "box", "description": "Standard packaged box"},
    {"unit_name": "Packs", "unit_symbol": "pack", "description": "Packaged bundles"},
    {"unit_name": "Dozens", "unit_symbol": "dz", "description": "Set of 12 units"},
    {"unit_name": "Pairs", "unit_symbol": "pair", "description": "Pair of 2 items"},
    {"unit_name": "Sets", "unit_symbol": "set", "description": "Multi-item assembled set"},
    {"unit_name": "Rolls", "unit_symbol": "roll", "description": "Rolled materials or tape"},
    {"unit_name": "Bags", "unit_symbol": "bag", "description": "Bagged or sacked goods"},
    {"unit_name": "Bottles", "unit_symbol": "btl", "description": "Bottled fluids or liquids"},
    {"unit_name": "Cans", "unit_symbol": "can", "description": "Canned items or lubricants"},
]


async def seed_default_units(db: AsyncSession) -> None:
    """Ensure standard metric and countable units exist in DB on startup."""
    for u_data in DEFAULT_UNITS:
        existing = await get_unit_by_symbol(db, u_data["unit_symbol"])
        if not existing:
            unit = Unit(
                unit_name=u_data["unit_name"],
                unit_symbol=u_data["unit_symbol"],
                description=u_data["description"],
                is_active=True,
            )
            db.add(unit)
    await db.commit()


async def get_all_units(db: AsyncSession, active_only: bool = True) -> Sequence[Unit]:
    query = select(Unit)
    if active_only:
        query = query.where(Unit.is_active == True)
    query = query.order_by(Unit.unit_name.asc())
    result = await db.execute(query)
    return result.scalars().all()


async def get_unit_by_id(db: AsyncSession, unit_id: uuid.UUID) -> Unit | None:
    result = await db.execute(select(Unit).where(Unit.unit_id == unit_id))
    return result.scalar_one_or_none()


async def get_unit_by_symbol(db: AsyncSession, unit_symbol: str) -> Unit | None:
    clean_symbol = unit_symbol.strip().lower()
    result = await db.execute(
        select(Unit).where(func.lower(Unit.unit_symbol) == clean_symbol)
    )
    return result.scalar_one_or_none()


async def get_unit_by_name(db: AsyncSession, unit_name: str) -> Unit | None:
    clean_name = unit_name.strip().lower()
    result = await db.execute(
        select(Unit).where(func.lower(Unit.unit_name) == clean_name)
    )
    return result.scalar_one_or_none()


async def create_unit(db: AsyncSession, unit_in: UnitCreate) -> Unit:
    new_unit = Unit(
        unit_name=unit_in.unit_name.strip(),
        unit_symbol=unit_in.unit_symbol.strip().lower(),
        description=unit_in.description.strip() if unit_in.description else None,
        is_active=True,
    )
    db.add(new_unit)
    await db.commit()
    await db.refresh(new_unit)
    return new_unit


async def update_unit(db: AsyncSession, db_unit: Unit, update_data: dict) -> Unit:
    for field, val in update_data.items():
        if field == "unit_symbol" and val:
            setattr(db_unit, field, val.strip().lower())
        else:
            setattr(db_unit, field, val)
    await db.commit()
    await db.refresh(db_unit)
    return db_unit


async def count_items_using_unit(db: AsyncSession, unit_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(Item).where(Item.unit_id == unit_id)
    )
    return result.scalar() or 0


async def delete_unit(db: AsyncSession, unit_id: uuid.UUID) -> None:
    await db.execute(delete(Unit).where(Unit.unit_id == unit_id))
    await db.commit()
