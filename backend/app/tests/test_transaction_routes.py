import pytest
from decimal import Decimal
from datetime import datetime, timezone, date
import uuid
from unittest.mock import AsyncMock, patch

from app.models import (
    User,
    UserRole,
    Supplier,
    Item,
    StockBatch,
    PurchaseOrder,
    PurchaseOrderItem,
    Transaction,
    POStatus,
    TransactionType,
)

jwt_decode = "app.routes.dependencies.jwt.decode"
get_user = "app.crud.user.get_user_by_user_id"


def make_mock_setup():
    sup = Supplier()
    sup.supplier_id = uuid.uuid4()
    sup.supplier_name = "Apex Chem Ltd"
    sup.is_active = True

    item = Item()
    item.item_id = uuid.uuid4()
    item.item_name = "Thinner 1L"
    item.sku = "THN-1001"
    item.unit = "L"
    item.quantity_in_stock = 100
    item.selling_price = Decimal("15.00")
    item.cost_price = Decimal("10.00")
    item.is_active = True

    batch = StockBatch()
    batch.batch_id = uuid.uuid4()
    batch.item_id = item.item_id
    batch.supplier_id = sup.supplier_id
    batch.batch_number = "BATCH-THN-01"
    batch.current_quantity = 50
    batch.initial_quantity = 50
    batch.purchase_price = Decimal("10.00")

    return sup, item, batch


@pytest.mark.asyncio
async def test_sold_transaction_route(client, mock_admin):
    sup, item, batch = make_mock_setup()

    sold_tx = Transaction()
    sold_tx.transaction_id = uuid.uuid4()
    sold_tx.item_id = item.item_id
    sold_tx.supplier_id = sup.supplier_id
    sold_tx.batch_id = batch.batch_id
    sold_tx.user_id = mock_admin.user_id
    sold_tx.transaction_type = TransactionType.SOLD
    sold_tx.quantity = 5
    sold_tx.previous_quantity = 100
    sold_tx.new_quantity = 95
    sold_tx.unit_price = Decimal("15.00")
    sold_tx.transaction_date = datetime.now(timezone.utc)
    sold_tx.item = item
    sold_tx.supplier = sup
    sold_tx.batch = batch
    sold_tx.user = mock_admin

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch("app.crud.item.get_item_by_item_id", new_callable=AsyncMock, return_value=item),
        patch("app.crud.stock_batch.get_batch_by_id", new_callable=AsyncMock, return_value=batch),
        patch("app.crud.stock_batch.decrement_batch_stock", new_callable=AsyncMock, return_value=batch),
        patch("app.crud.transaction.get_transaction_by_id", new_callable=AsyncMock, return_value=sold_tx),
    ):
        response = await client.post(
            "/transaction/sold",
            json={
                "item_id": str(item.item_id),
                "supplier_id": str(sup.supplier_id),
                "batch_id": str(batch.batch_id),
                "quantity": 5,
                "note": "Retail sale to walk-in customer",
            },
            headers={"Authorization": "Bearer faketoken"},
        )
    assert response.status_code == 201
    data = response.json()
    assert data["transaction_type"] == "SOLD"
    assert data["quantity"] == 5


@pytest.mark.asyncio
async def test_adjustment_transaction_requires_reason(client, mock_admin):
    sup, item, batch = make_mock_setup()

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch("app.crud.item.get_item_by_item_id", new_callable=AsyncMock, return_value=item),
        patch("app.crud.stock_batch.get_batch_by_id", new_callable=AsyncMock, return_value=batch),
    ):
        response = await client.post(
            "/transaction/adjustment",
            json={
                "item_id": str(item.item_id),
                "supplier_id": str(sup.supplier_id),
                "batch_id": str(batch.batch_id),
                "transaction_type": "ADJUSTMENT_INCREASE",
                "quantity": 3,
                "reason": "  ",  # blank reason
            },
            headers={"Authorization": "Bearer faketoken"},
        )
    assert response.status_code in [400, 422]


@pytest.mark.asyncio
async def test_customer_return_route(client, mock_admin):
    sup, item, batch = make_mock_setup()

    sold_tx = Transaction()
    sold_tx.transaction_id = uuid.uuid4()
    sold_tx.item_id = item.item_id
    sold_tx.supplier_id = sup.supplier_id
    sold_tx.batch_id = batch.batch_id
    sold_tx.transaction_type = TransactionType.SOLD
    sold_tx.quantity = 10
    sold_tx.previous_quantity = 100
    sold_tx.new_quantity = 90
    sold_tx.unit_price = Decimal("15.00")
    sold_tx.transaction_date = datetime.now(timezone.utc)
    sold_tx.item = item
    sold_tx.supplier = sup
    sold_tx.batch = batch
    sold_tx.user = mock_admin

    return_tx = Transaction()
    return_tx.transaction_id = uuid.uuid4()
    return_tx.item_id = item.item_id
    return_tx.supplier_id = sup.supplier_id
    return_tx.batch_id = batch.batch_id
    return_tx.transaction_type = TransactionType.CUSTOMER_RETURN
    return_tx.quantity = 2
    return_tx.previous_quantity = 90
    return_tx.new_quantity = 92
    return_tx.unit_price = Decimal("15.00")
    return_tx.transaction_date = datetime.now(timezone.utc)
    return_tx.item = item
    return_tx.supplier = sup
    return_tx.batch = batch
    return_tx.user = mock_admin

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch("app.crud.transaction.get_transaction_by_id", new_callable=AsyncMock, side_effect=[sold_tx, return_tx]),
        patch("app.crud.item.get_item_by_item_id", new_callable=AsyncMock, return_value=item),
        patch("app.crud.stock_batch.increment_batch_stock", new_callable=AsyncMock, return_value=batch),
    ):
        response = await client.post(
            "/transaction/customer-return",
            json={
                "reference_transaction_id": str(sold_tx.transaction_id),
                "quantity": 2,
                "reason": "Wrong item ordered by client",
            },
            headers={"Authorization": "Bearer faketoken"},
        )
    assert response.status_code == 201
    data = response.json()
    assert data["transaction_type"] == "CUSTOMER_RETURN"
    assert data["quantity"] == 2


@pytest.mark.asyncio
async def test_sold_transaction_uses_batch_selling_price(client, mock_admin):
    sup, item, batch = make_mock_setup()
    batch.selling_price = Decimal("18.50")  # Override batch selling price

    sold_tx = Transaction()
    sold_tx.transaction_id = uuid.uuid4()
    sold_tx.item_id = item.item_id
    sold_tx.supplier_id = sup.supplier_id
    sold_tx.batch_id = batch.batch_id
    sold_tx.user_id = mock_admin.user_id
    sold_tx.transaction_type = TransactionType.SOLD
    sold_tx.quantity = 2
    sold_tx.previous_quantity = 50
    sold_tx.new_quantity = 48
    sold_tx.unit_price = Decimal("18.50")
    sold_tx.transaction_date = datetime.now(timezone.utc)
    sold_tx.item = item
    sold_tx.supplier = sup
    sold_tx.batch = batch
    sold_tx.user = mock_admin

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch("app.crud.item.get_item_by_item_id", new_callable=AsyncMock, return_value=item),
        patch("app.crud.stock_batch.get_batch_by_id", new_callable=AsyncMock, return_value=batch),
        patch("app.crud.stock_batch.decrement_batch_stock", new_callable=AsyncMock, return_value=batch),
        patch("app.crud.transaction.get_transaction_by_id", new_callable=AsyncMock, return_value=sold_tx),
    ):
        response = await client.post(
            "/transaction/sold",
            json={
                "item_id": str(item.item_id),
                "supplier_id": str(sup.supplier_id),
                "batch_id": str(batch.batch_id),
                "quantity": 2,
            },
            headers={"Authorization": "Bearer faketoken"},
        )
    assert response.status_code == 201
    data = response.json()
    assert data["unit_price"] == "18.50"
