import os
from dotenv import load_dotenv
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import inspect, text

# STEP 1: The Connection String
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in .env")

# STEP 2: The Engine
engine = create_async_engine(DATABASE_URL, echo=False)

# STEP 3: The Session Maker
async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# STEP 4: The Base Class
class Base(DeclarativeBase):
    pass


def _sync_schema_migration(sync_conn):
    # Create any missing tables
    Base.metadata.create_all(sync_conn)

    # Check and add missing columns to existing tables
    inspector = inspect(sync_conn)

    columns_to_ensure = {
        "purchase_orders": [
            ("status", "VARCHAR(50) DEFAULT 'Draft'"),
            ("notes", "TEXT"),
        ],
        "purchase_order_items": [
            ("quantity_received", "INTEGER DEFAULT 0"),
        ],
        "transactions": [
            ("supplier_id", "CHAR(36)"),
            ("batch_id", "CHAR(36)"),
            ("po_id", "CHAR(36)"),
            ("reference_transaction_id", "CHAR(36)"),
            ("unit_price", "NUMERIC(10, 2)"),
            ("reason", "TEXT"),
        ],
        "items": [
            ("unit_id", "CHAR(36)"),
        ],
        "stock_batches": [
            ("selling_price", "NUMERIC(10, 2)"),
        ],
    }

    for table_name, cols in columns_to_ensure.items():
        if inspector.has_table(table_name):
            existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
            for col_name, col_type in cols:
                if col_name not in existing_cols:
                    try:
                        sync_conn.execute(
                            text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}")
                        )
                    except Exception as e:
                        print(f"Migration notice for {table_name}.{col_name}: {e}")


# STEP 5: Create Database Tables & Auto-Migrate Columns
async def create_db_and_tables():
    async with engine.begin() as conn:
        await conn.run_sync(_sync_schema_migration)


# STEP 6: Generating sessions for CRUD operations
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
