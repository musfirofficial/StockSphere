from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.schemas.transaction import TransactionCreate
from app.models import Transaction
from typing import Sequence, Optional
import uuid


# ------------------------ Create new transaction crud ----------------------- #
async def create_transaction(
    db: AsyncSession,
    transaction_in: TransactionCreate,
    user_id: uuid.UUID | None,
    previous_quantity: int,
    new_quantity: int,
) -> Transaction:
    transaction = Transaction(
        **transaction_in.model_dump(),
        user_id=user_id,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)

    full = await get_transaction_by_id(db, transaction.transaction_id)
    return full or transaction


# ------------------------ Get transaction by ID ---------------------------- #
async def get_transaction_by_id(
    db: AsyncSession, transaction_id: uuid.UUID
) -> Transaction | None:
    query = (
        select(Transaction)
        .options(
            joinedload(Transaction.user),
            joinedload(Transaction.item),
            joinedload(Transaction.supplier),
            joinedload(Transaction.batch),
        )
        .where(Transaction.transaction_id == transaction_id)
    )
    result = await db.execute(query)
    return result.unique().scalar_one_or_none()


# ------------------------ Get all transactions crud ------------------------- #
async def get_transactions(
    db: AsyncSession, user_id: Optional[uuid.UUID] = None
) -> Sequence[Transaction]:
    query = (
        select(Transaction)
        .options(
            joinedload(Transaction.user),
            joinedload(Transaction.item),
            joinedload(Transaction.supplier),
            joinedload(Transaction.batch),
        )
        .order_by(Transaction.transaction_date.desc())
    )

    if user_id is not None:
        query = query.where(Transaction.user_id == user_id)

    result = await db.execute(query)
    return result.unique().scalars().all()
