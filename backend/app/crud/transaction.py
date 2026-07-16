from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.schemas.transaction import TransactionCreate
from app.models import Transaction
from typing import Sequence
import uuid

# ------------------------ Create new transaction crud ----------------------- #
async def create_transaction(
        db: AsyncSession, 
        transaction_in: TransactionCreate,
        user_id: uuid.UUID,
        previous_quantity: int,
        new_quantity: int
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
    return transaction


# ------------------------ Get all transactions crud ----------------------- #
async def get_transactions(db: AsyncSession) -> Sequence[Transaction] | None:
    result = await db.execute(select(Transaction).order_by(Transaction.transaction_id))
    return result.scalars().all()

