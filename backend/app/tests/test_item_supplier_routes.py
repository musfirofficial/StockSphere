import uuid
from decimal import Decimal
from datetime import datetime, timezone
import pytest
from unittest.mock import AsyncMock, patch
from app.models import Item, ItemSupplier, Supplier, UserRole

jwt_decode = "app.routes.dependencies.jwt.decode"
get_user = "app.crud.user.get_user_by_user_id"


def make_mock_item():
    item = Item()
    item.item_id = uuid.uuid4()
    item.item_name = "Test Item"
    item.sku = "TEST-1001"
    item.quantity_in_stock = 25
    item.reorder_level = 10
    item.reorder_quantity = 20
    item.unit = "pcs"
    item.cost_price = Decimal("50.00")
    item.selling_price = Decimal("80.00")
    item.is_active = True
    item.created_at = datetime.now(timezone.utc)
    item.updated_at = datetime.now(timezone.utc)
    return item


def make_mock_item_supplier(item_id, supplier_id):
    sup = Supplier()
    sup.supplier_id = supplier_id
    sup.supplier_name = "Test Supplier"

    rel = ItemSupplier()
    rel.item_id = item_id
    rel.supplier_id = supplier_id
    rel.agreed_price = Decimal("48.00")
    rel.is_primary = True
    rel.supplier_sku = "SUP-SKU-01"
    rel.created_at = datetime.now(timezone.utc)
    rel.updated_at = datetime.now(timezone.utc)
    rel.supplier = sup
    return rel


@pytest.mark.asyncio
async def test_get_item_suppliers_route(client, mock_admin):
    item = make_mock_item()
    supplier_id = uuid.uuid4()
    rel = make_mock_item_supplier(item.item_id, supplier_id)

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch("app.crud.item.get_item_by_item_id", new_callable=AsyncMock, return_value=item),
        patch("app.crud.item_supplier.get_item_suppliers", new_callable=AsyncMock, return_value=[rel]),
    ):
        response = await client.get(
            f"/items/{item.item_id}/suppliers",
            headers={"Authorization": "Bearer faketoken"},
        )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["supplier_name"] == "Test Supplier"
    assert float(data[0]["agreed_price"]) == 48.00
    assert data[0]["is_primary"] is True


@pytest.mark.asyncio
async def test_link_item_supplier_route(client, mock_admin):
    item = make_mock_item()
    supplier_id = uuid.uuid4()
    rel = make_mock_item_supplier(item.item_id, supplier_id)

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch("app.crud.item.get_item_by_item_id", new_callable=AsyncMock, return_value=item),
        patch("app.crud.item_supplier.get_item_supplier", new_callable=AsyncMock, return_value=None),
        patch("app.crud.item_supplier.add_item_supplier", new_callable=AsyncMock, return_value=rel),
    ):
        response = await client.post(
            f"/items/{item.item_id}/suppliers",
            json={
                "supplier_id": str(supplier_id),
                "agreed_price": 48.00,
                "is_primary": True,
                "supplier_sku": "SUP-SKU-01",
            },
            headers={"Authorization": "Bearer faketoken"},
        )
    assert response.status_code == 201
    data = response.json()
    assert data["supplier_id"] == str(supplier_id)
    assert float(data["agreed_price"]) == 48.00
