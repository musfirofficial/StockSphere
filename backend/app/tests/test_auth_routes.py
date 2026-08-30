import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch
from app.models import User, UserRole, PasswordResetToken, local_tz
from app.services.security import hash_password
from datetime import datetime, timedelta
import uuid


@pytest.mark.asyncio
async def test_forgot_password_unknown_email(client: AsyncClient):
    with patch("app.routes.auth.user_crud.get_user_by_email", new_callable=AsyncMock, return_value=None):
        response = await client.post(
            "/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "detail" in data
    assert "If an account exists" in data["detail"]


@pytest.mark.asyncio
async def test_forgot_password_and_reset_flow(client: AsyncClient):
    mock_user = User(
        user_id=uuid.uuid4(),
        full_name="Password Tester",
        user_name="pw_tester",
        nic="199912345678",
        email="tester@example.com",
        phone="0779998877",
        password_hash=hash_password("OldPassword123"),
        role=UserRole.ADMIN,
        is_active=True,
    )

    mock_token = PasswordResetToken(
        token_id=uuid.uuid4(),
        user_id=mock_user.user_id,
        token_hash="somehash",
        expires_at=datetime.now(local_tz) + timedelta(minutes=15),
        is_used=False,
    )

    # 1. Request forgot password
    with (
        patch("app.routes.auth.user_crud.get_user_by_email", new_callable=AsyncMock, return_value=mock_user),
        patch("app.routes.auth.user_crud.create_password_reset_token", new_callable=AsyncMock),
        patch("app.routes.auth.send_password_reset_email", new_callable=AsyncMock, return_value=True),
    ):
        fp_response = await client.post(
            "/auth/forgot-password",
            json={"email": "tester@example.com"},
        )
    assert fp_response.status_code == 200

    # 2. Reset password using valid token
    with (
        patch("app.routes.auth.user_crud.get_valid_password_reset_token", new_callable=AsyncMock, return_value=mock_token),
        patch("app.routes.auth.user_crud.get_user_by_user_id", new_callable=AsyncMock, return_value=mock_user),
        patch("app.routes.auth.user_crud.reset_user_password", new_callable=AsyncMock),
        patch("app.routes.auth.user_crud.mark_password_reset_token_used", new_callable=AsyncMock),
    ):
        reset_response = await client.post(
            "/auth/reset-password",
            json={
                "token": "valid_token_32chars_test",
                "new_password": "NewBrandPassword123",
            },
        )
    assert reset_response.status_code == 200
    assert "successfully" in reset_response.json()["detail"]


@pytest.mark.asyncio
async def test_reset_password_invalid_token(client: AsyncClient):
    with patch("app.routes.auth.user_crud.get_valid_password_reset_token", new_callable=AsyncMock, return_value=None):
        response = await client.post(
            "/auth/reset-password",
            json={
                "token": "invalid_fake_token_12345",
                "new_password": "NewBrandPassword123",
            },
        )
    assert response.status_code == 400
    assert "Invalid or expired" in response.json()["detail"]
