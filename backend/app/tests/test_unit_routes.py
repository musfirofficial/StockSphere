import uuid
import pytest
from unittest.mock import AsyncMock, patch
from app.models import UserRole, Unit
from datetime import datetime, timezone

jwt_decode = "app.routes.dependencies.jwt.decode"
get_user = "app.crud.user.get_user_by_user_id"


def make_mock_unit(name="Kilograms", symbol="kg"):
    u = Unit()
    u.unit_id = uuid.uuid4()
    u.unit_name = name
    u.unit_symbol = symbol
    u.description = "Test unit"
    u.is_active = True
    u.created_at = datetime.now(timezone.utc)
    u.updated_at = datetime.now(timezone.utc)
    return u


@pytest.mark.asyncio
async def test_get_all_units(client, mock_admin):
    mock_units = [make_mock_unit("Pieces", "pcs"), make_mock_unit("Kilograms", "kg")]
    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch("app.crud.unit.get_all_units", new_callable=AsyncMock, return_value=mock_units),
    ):
        response = await client.get(
            "/units/",
            headers={"Authorization": "Bearer faketoken"},
        )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["unit_symbol"] == "pcs"


@pytest.mark.asyncio
async def test_create_unit_admin_success(client, mock_admin):
    mock_unit = make_mock_unit("Meters", "m")
    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch("app.crud.unit.get_unit_by_symbol", new_callable=AsyncMock, return_value=None),
        patch("app.crud.unit.get_unit_by_name", new_callable=AsyncMock, return_value=None),
        patch("app.crud.unit.create_unit", new_callable=AsyncMock, return_value=mock_unit),
    ):
        response = await client.post(
            "/units/",
            json={"unit_name": "Meters", "unit_symbol": "m", "description": "Metric length"},
            headers={"Authorization": "Bearer faketoken"},
        )
    assert response.status_code == 201
    assert response.json()["unit_name"] == "Meters"
