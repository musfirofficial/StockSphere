import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.app import app
from app.database import get_async_session

import uuid
from datetime import datetime, timezone
from app.models import User, UserRole 

# ─────────────────────────────────────────────
@pytest_asyncio.fixture
def mock_session():
    session = AsyncMock()

    # These are the SQLAlchemy AsyncSession methods your CRUD layer calls
    session.execute = AsyncMock()
    session.commit  = AsyncMock()
    session.refresh = AsyncMock()
    session.flush   = AsyncMock()
    session.rollback= AsyncMock()
    session.delete  = AsyncMock()
    session.add     = MagicMock()   # add() is sync in SQLAlchemy, not async

    return session


# ─────────────────────────────────────────────
@pytest_asyncio.fixture
async def client(mock_session):

    # 1. Override FastAPI's get_async_session dependency
    async def _override_session():
        yield mock_session

    app.dependency_overrides[get_async_session] = _override_session

    # 2. Patch lifespan internals so startup doesn't need a real DB
    with (
        patch("app.app.create_db_and_tables",          new_callable=AsyncMock),
        patch("app.app.AdminService.create_admin",     new_callable=AsyncMock, return_value="exists"),
        patch("app.app.async_session_maker") as mock_maker,
    ):
        # The lifespan does `async with async_session_maker() as session:`
        # so we need to mock the context manager it returns
        mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_maker.return_value.__aexit__  = AsyncMock(return_value=False)

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as ac:
            yield ac

    # 3. Always clean up overrides after each test
    app.dependency_overrides.clear()


# ─────────────────────────────────────────────
@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer <test_token>"}

@pytest.fixture
def mock_admin():
    return User(
        user_id=uuid.uuid4(),
        full_name="Admin User",
        user_name="admin.user",
        nic="987654321V",
        email="admin@stocksphere.com",
        phone="077 000 0000",
        role=UserRole.ADMIN,
        is_active=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def assert_error_detail(response, expected_detail: str):
    assert response.json()["detail"] == expected_detail