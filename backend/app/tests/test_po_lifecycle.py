import pytest
from decimal import Decimal
from datetime import datetime, timezone
import uuid
from unittest.mock import AsyncMock, patch

from app.models import User, UserRole, Supplier, Item, ItemSupplier, PurchaseOrder, PurchaseOrderItem, POStatus

jwt_decode = "app.routes.dependencies.jwt.decode"
get_user = "app.crud.user.get_user_by_user_id"


def make_mock_supplier():
    s = Supplier()
    s.supplier_id = uuid.uuid4()
    s.supplier_name = "Global Paints Ltd"
    s.is_active = True
    return s


def make_mock_item(supplier_id):
    item = Item()
    item.item_id = uuid.uuid4()
    item.item_name = "Acrylic Paint 5L"
    item.sku = "PNT-5001"
    item.unit = "L"
    item.is_active = True

    rel = ItemSupplier()
    rel.item_id = item.item_id
    rel.supplier_id = supplier_id
    rel.agreed_price = Decimal("32.50")
    rel.is_primary = True
    return item, rel


def make_mock_po(supplier, items):
    po = PurchaseOrder()
    po.po_id = uuid.uuid4()
    po.supplier_id = supplier.supplier_id
    po.supplier = supplier
    po.status = POStatus.DRAFT
    po.po_type = POStatus.DRAFT
    po.created_at = datetime.now(timezone.utc)
    po.created_by = None
    po.notes = "Test PO"

    pois = []
    for item, rel in items:
        poi = PurchaseOrderItem()
        poi.poi_id = uuid.uuid4()
        poi.po_id = po.po_id
        poi.item_id = item.item_id
        poi.item = item
        poi.quantity = 10
        poi.quantity_received = 0
        poi.unit_price = rel.agreed_price
        pois.append(poi)
    po.purchaseorderitems = pois
    return po


@pytest.mark.asyncio
async def test_create_po_with_agreed_price(client, mock_admin):
    sup = make_mock_supplier()
    item, rel = make_mock_item(sup.supplier_id)
    po = make_mock_po(sup, [(item, rel)])

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch("app.crud.supplier.get_supplier_by_supplier_id", new_callable=AsyncMock, return_value=sup),
        patch("app.crud.purchaseorder.get_active_po_for_supplier", new_callable=AsyncMock, return_value=None),
        patch("app.crud.item_supplier.get_item_supplier", new_callable=AsyncMock, return_value=rel),
        patch("app.crud.purchaseorder.create_purchase_order", new_callable=AsyncMock, return_value=po),
    ):
        response = await client.post(
            "/purchas-orders/",
            json={
                "supplier_id": str(sup.supplier_id),
                "notes": "Urgent stock replenish",
                "items": [{"item_id": str(item.item_id), "quantity": 10}],
            },
            headers={"Authorization": "Bearer faketoken"},
        )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "Draft"
    assert len(data["items"]) == 1
    assert float(data["items"][0]["unit_price"]) == 32.50
    assert float(data["total_amount"]) == 325.00


@pytest.mark.asyncio
async def test_create_po_blocks_duplicate_active_po(client, mock_admin):
    sup = make_mock_supplier()
    existing_po = make_mock_po(sup, [])

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch("app.crud.supplier.get_supplier_by_supplier_id", new_callable=AsyncMock, return_value=sup),
        patch("app.crud.purchaseorder.get_active_po_for_supplier", new_callable=AsyncMock, return_value=existing_po),
    ):
        response = await client.post(
            "/purchas-orders/",
            json={
                "supplier_id": str(sup.supplier_id),
                "items": [{"item_id": str(uuid.uuid4()), "quantity": 5}],
            },
            headers={"Authorization": "Bearer faketoken"},
        )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_po_status_lifecycle(client, mock_admin):
    sup = make_mock_supplier()
    item, rel = make_mock_item(sup.supplier_id)
    po = make_mock_po(sup, [(item, rel)])

    updated_po = make_mock_po(sup, [(item, rel)])
    updated_po.status = POStatus.PENDING_APPROVAL

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch("app.crud.purchaseorder.get_purchase_order_by_id", new_callable=AsyncMock, return_value=po),
        patch("app.crud.purchaseorder.update_purchase_order_status", new_callable=AsyncMock, return_value=updated_po),
    ):
        response = await client.patch(
            f"/purchas-orders/{po.po_id}/status",
            json={"status": "Pending Approval"},
            headers={"Authorization": "Bearer faketoken"},
        )
    assert response.status_code == 200
    assert response.json()["status"] == "Pending Approval"
