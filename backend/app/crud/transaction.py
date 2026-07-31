from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.schemas.transaction import TransactionCreate
from app.models import Transaction
from typing import Sequence, Optional
import uuid


# ------------------------ Create new transaction crud ----------------------- #
async def create_transaction(
    db: AsyncSession,
    transaction_in: TransactionCreate,
    user_id: uuid.UUID,
    previous_quantity: int,
    new_quantity: int,
) -> Transaction:
    transaction = Transaction(
        **transaction_in.model_dump(),
        user_id=user_id,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    # Eagerly load user and item relationships for response fields
    await db.refresh(transaction, attribute_names=["user", "item"])
    return transaction


# ------------------------ Get all transactions crud ----------------------- #
async def get_transactions(
    db: AsyncSession, user_id: Optional[uuid.UUID] = None
) -> Sequence[Transaction]:
    query = (
        select(Transaction)
        .options(selectinload(Transaction.user), selectinload(Transaction.item))
        .order_by(Transaction.transaction_date.desc())
    )

    if user_id is not None:
        query = query.where(Transaction.user_id == user_id)

    result = await db.execute(query)
    return result.scalars().all()
