import os
from dotenv import load_dotenv
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

# STEP 1: The Connection String
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in .env")

# STEP 2: The Engine which is the gateway to connect to my DB // echo=false to disable SQL logging
engine = create_async_engine(DATABASE_URL, echo=False)

# STEP 3: The Session Maker
async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Crucial for Async! Prevents data from "vanishing" after a commit.
)


# STEP 4: The Base Class // Create Data models
class Base(DeclarativeBase):
    pass


# STEP 5: Create the Database Tables
async def create_db_and_tables():
    async with engine.begin() as conn:
        await conn.run_sync(
            Base.metadata.create_all
        )  # Creates table for models created use base/DeclaritiveBase


# STEP 6: Generating sessions for CRUD operations
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


"""
DROP DATABASE stocksphere;
REASSIGN OWNED BY homerex TO postgres;
DROP OWNED BY homerex;
DROP USER homerex;

CREATE USER homerex WITH PASSWORD 'mustha';
CREATE DATABASE stocksphere OWNER homerex;
GRANT ALL PRIVILEGES ON DATABASE stocksphere TO homerex;

pw : mustha
"""
