import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch
from contextlib import ExitStack

from app.tests.factories import make_mock_user
from app.models import UserRole, TransactionType

# ---------------------------------------------------------------------------- #
#                              Shared patch targets                            #
# ---------------------------------------------------------------------------- #
jwt_decode = "app.routes.dependencies.jwt.decode"
get_user   = "app.crud.user.get_user_by_user_id"

crud_prefix = "app.routes.v1.dashboard.crud_dashboard"


# ---------------------------------------------------------------------------- #
#                           Shared mock return data                            #
# ---------------------------------------------------------------------------- #
def _make_transaction_response():
    """Return a dict that satisfies TransactionResponse serialisation."""
    import uuid as _uuid
    return {
        "transaction_id"   : _uuid.uuid4(),
        "item_id"          : _uuid.uuid4(),
        "user_id"          : _uuid.uuid4(),
        "transaction_type" : TransactionType.STOCK_OUT,
        "quantity"         : 10,
        "previous_quantity": 100,
        "new_quantity"     : 90,
        "note"             : None,
        "user_name"        : "John Perera",
        "item_name"        : "Widget A",
        "transaction_date" : datetime.now(timezone.utc),
    }


MOCK_ITEM_QTY          = 250
MOCK_ITEM_VALUE        = Decimal("12500.50")
MOCK_SOLD_VALUE        = Decimal("3200.00")
MOCK_SALES_TREND       = [Decimal("0"), Decimal("100"), Decimal("200"),
                          Decimal("150"), Decimal("300"), Decimal("250"), Decimal("400")]
MOCK_MOST_SOLD         = [{"name": "Widget A", "quantity_sold": 120},
                          {"name": "Widget B", "quantity_sold": 80}]
MOCK_LOW_STOCK_COUNT   = 3
MOCK_CRITICAL_COUNT    = 1
MOCK_DRAFT_PO_COUNT    = 5


# ---------------------------------------------------------------------------- #
#                      Shared helper: build CRUD patch set                     #
# ---------------------------------------------------------------------------- #
def _crud_patches(*, sales_role: bool = False, include_draft_po: bool = True,
                  user_id=None):
    """
    Returns a dict of patch() context managers for all crud_dashboard functions.
    Role-restricted metrics are still patched so the route can branch safely.
    """
    patches = {
        f"{crud_prefix}.get_item_in_stock_quantity" : AsyncMock(return_value=MOCK_ITEM_QTY),
        f"{crud_prefix}.get_item_in_stock_value"    : AsyncMock(return_value=MOCK_ITEM_VALUE),
        f"{crud_prefix}.get_current_month_sold_value": AsyncMock(return_value=MOCK_SOLD_VALUE),
        f"{crud_prefix}.get_last_7_days_sales"      : AsyncMock(return_value=MOCK_SALES_TREND),
        f"{crud_prefix}.get_most_sold_items"        : AsyncMock(return_value=MOCK_MOST_SOLD),
        f"{crud_prefix}.get_last_5_transactions"    : AsyncMock(return_value=[]),
    }
    if not sales_role:
        patches[f"{crud_prefix}.get_stockout_items_low_count"]      = AsyncMock(return_value=MOCK_LOW_STOCK_COUNT)
        patches[f"{crud_prefix}.get_stockout_items_critical_count"] = AsyncMock(return_value=MOCK_CRITICAL_COUNT)
    if include_draft_po and not sales_role:
        patches[f"{crud_prefix}.get_draft_po_count"] = AsyncMock(return_value=MOCK_DRAFT_PO_COUNT)
    return patches


# ---------------------------------------------------------------------------- #
#                  Helper: run GET /dashboard/ with given user                 #
# ---------------------------------------------------------------------------- #
async def _get_dashboard(client, user, sales_role=False, include_draft_po=True):
    patches = _crud_patches(sales_role=sales_role, include_draft_po=include_draft_po)
    with ExitStack() as stack:
        stack.enter_context(patch(jwt_decode, return_value={"sub": str(user.user_id)}))
        stack.enter_context(patch(get_user, new_callable=AsyncMock, return_value=user))
        for k, v in patches.items():
            stack.enter_context(patch(k, new=v))
        return await client.get(
            "/dashboard/",
            headers={"Authorization": "Bearer faketoken"},
        )


# ============================================================================ #
#                         Test 1 – Unauthenticated                             #
# ============================================================================ #
@pytest.mark.asyncio
async def test_get_dashboard_unauthorized(client):
    """No token → 401 Unauthorized."""
    response = await client.get("/dashboard/")
    assert response.status_code == 401


# ============================================================================ #
#                         Test 2 – ADMIN role                                  #
# ============================================================================ #
@pytest.mark.asyncio
async def test_get_dashboard_admin(client):
    """ADMIN receives all metrics including stock alerts and draft PO count."""
    admin = make_mock_user(role=UserRole.ADMIN)
    response = await _get_dashboard(client, admin, include_draft_po=True)

    assert response.status_code == 200, response.json()
    data = response.json()

    # Shared metrics
    assert data["items_in_stock"] == MOCK_ITEM_QTY
    assert data["value_of_item_in_stock"] is not None

    # Alert metrics (ADMIN-visible)
    assert data["active_low_stock_alerts"]    == MOCK_LOW_STOCK_COUNT
    assert data["active_out_of_stock_alerts"] == MOCK_CRITICAL_COUNT
    assert data["active_alerts"]              == MOCK_LOW_STOCK_COUNT + MOCK_CRITICAL_COUNT

    # PO count (ADMIN-visible)
    assert data["draft_po_count"] == MOCK_DRAFT_PO_COUNT

    # Sales metrics
    assert data["sold_value"] is not None
    assert len(data["sales_trend"])    == 7
    assert len(data["most_sold_items"]) == len(MOCK_MOST_SOLD)


# ============================================================================ #
#                    Test 3 – INVENTORY_MANAGER role                           #
# ============================================================================ #
@pytest.mark.asyncio
async def test_get_dashboard_inventory_manager(client):
    """INVENTORY_MANAGER receives full inventory + alert + draft PO metrics."""
    inv_mgr = make_mock_user(role=UserRole.INVENTORY_MANAGER)
    response = await _get_dashboard(client, inv_mgr, include_draft_po=True)

    assert response.status_code == 200, response.json()
    data = response.json()

    assert data["items_in_stock"]             == MOCK_ITEM_QTY
    assert data["active_low_stock_alerts"]    == MOCK_LOW_STOCK_COUNT
    assert data["active_out_of_stock_alerts"] == MOCK_CRITICAL_COUNT
    assert data["active_alerts"]              == MOCK_LOW_STOCK_COUNT + MOCK_CRITICAL_COUNT
    assert data["draft_po_count"]             == MOCK_DRAFT_PO_COUNT


# ============================================================================ #
#                         Test 4 – SALES role                                  #
# ============================================================================ #
@pytest.mark.asyncio
async def test_get_dashboard_sales(client):
    """SALES user receives user-scoped sales data only; alert/PO fields are None."""
    sales_user = make_mock_user(role=UserRole.SALES)
    response = await _get_dashboard(client, sales_user, sales_role=True)

    assert response.status_code == 200, response.json()
    data = response.json()

    # Role-restricted fields must be absent / None
    assert data["active_low_stock_alerts"]    is None
    assert data["active_out_of_stock_alerts"] is None
    assert data["active_alerts"]              is None
    assert data["draft_po_count"]             is None

    # Sales metrics present
    assert data["sold_value"] is not None
    assert len(data["sales_trend"]) == 7


# ============================================================================ #
#                         Test 5 – AUDITOR role                                #
# ============================================================================ #
@pytest.mark.asyncio
async def test_get_dashboard_auditor(client):
    """AUDITOR receives global stock + alert metrics but draft_po_count is None."""
    auditor = make_mock_user(role=UserRole.AUDITOR)

    # AUDITOR hits the non-sales branch but NOT the ADMIN/INV_MGR branch for draft PO
    patches = {
        f"{crud_prefix}.get_item_in_stock_quantity" : AsyncMock(return_value=MOCK_ITEM_QTY),
        f"{crud_prefix}.get_item_in_stock_value"    : AsyncMock(return_value=MOCK_ITEM_VALUE),
        f"{crud_prefix}.get_current_month_sold_value": AsyncMock(return_value=MOCK_SOLD_VALUE),
        f"{crud_prefix}.get_last_7_days_sales"      : AsyncMock(return_value=MOCK_SALES_TREND),
        f"{crud_prefix}.get_most_sold_items"        : AsyncMock(return_value=MOCK_MOST_SOLD),
        f"{crud_prefix}.get_last_5_transactions"    : AsyncMock(return_value=[]),
        f"{crud_prefix}.get_stockout_items_low_count"     : AsyncMock(return_value=MOCK_LOW_STOCK_COUNT),
        f"{crud_prefix}.get_stockout_items_critical_count": AsyncMock(return_value=MOCK_CRITICAL_COUNT),
        # NOTE: get_draft_po_count is intentionally NOT patched for AUDITOR
    }
    with ExitStack() as stack:
        stack.enter_context(patch(jwt_decode, return_value={"sub": str(auditor.user_id)}))
        stack.enter_context(patch(get_user, new_callable=AsyncMock, return_value=auditor))
        for k, v in patches.items():
            stack.enter_context(patch(k, new=v))
        response = await client.get(
            "/dashboard/",
            headers={"Authorization": "Bearer faketoken"},
        )

    assert response.status_code == 200, response.json()
    data = response.json()

    assert data["items_in_stock"]             == MOCK_ITEM_QTY
    assert data["active_low_stock_alerts"]    == MOCK_LOW_STOCK_COUNT
    assert data["active_out_of_stock_alerts"] == MOCK_CRITICAL_COUNT
    assert data["active_alerts"]              == MOCK_LOW_STOCK_COUNT + MOCK_CRITICAL_COUNT
    assert data["draft_po_count"]             is None     # AUDITOR never gets PO count


# ============================================================================ #
#              Test 6 – Forbidden role (e.g. a non-dashboard role)             #
# ============================================================================ #
@pytest.mark.asyncio
async def test_get_dashboard_forbidden_role(client):
    """A role not in the allowed list receives 403 Forbidden."""
    # Use a role the dashboard explicitly excludes — mock a user whose role
    # the RoleChecker will reject (simulate via mocked user_id lookup).
    # The RoleChecker rejects by raising 403 before calling any CRUD.
    from app.models import UserRole as UR

    # Patch get_user to return a user whose role is NOT in the dashboard allow-list.
    # We'll piggyback on UserRole.SALES but change role to something invalid via
    # a simple object; easier to just confirm the route handles 403.
    class _FakeUser:
        user_id  = uuid.uuid4()
        is_active = True
        role      = "UNKNOWN_ROLE"     # not a valid UserRole enum member

    with (
        patch(jwt_decode, return_value={"sub": str(_FakeUser.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=_FakeUser),
    ):
        response = await client.get(
            "/dashboard/",
            headers={"Authorization": "Bearer faketoken"},
        )

    assert response.status_code == 403


# ============================================================================ #
#            Test 7 – Response structure and decimal formatting                #
# ============================================================================ #
@pytest.mark.asyncio
async def test_dashboard_decimal_formatting_and_structure(client):
    """Verify decimal fields are serialized as formatted strings and arrays."""
    admin = make_mock_user(role=UserRole.ADMIN)
    response = await _get_dashboard(client, admin, include_draft_po=True)

    assert response.status_code == 200, response.json()
    data = response.json()

    # value_of_item_in_stock: Decimal("12500.50") → "12,500.50"
    assert data["value_of_item_in_stock"] == "12,500.50"

    # sold_value: Decimal("3200.00") → "3,200.00"
    assert data["sold_value"] == "3,200.00"

    # sales_trend is a list of formatted strings
    assert isinstance(data["sales_trend"], list)
    assert len(data["sales_trend"]) == 7
    # Each entry is a decimal-formatted string
    for entry in data["sales_trend"]:
        assert isinstance(entry, str)
        assert "." in entry   # e.g. "0.00", "100.00"

    # most_sold_items structure
    for item in data["most_sold_items"]:
        assert "name" in item
        assert "quantity_sold" in item


# ============================================================================ #
#              Test 8 – Zero-sales scenario (empty sales data)                 #
# ============================================================================ #
@pytest.mark.asyncio
async def test_dashboard_zero_sales_fallback(client):
    """When no sales exist, sold_value = '0.00' and sales_trend is all zeros."""
    admin = make_mock_user(role=UserRole.ADMIN)

    zero_trend = [Decimal("0.00")] * 7

    patches = {
        f"{crud_prefix}.get_item_in_stock_quantity" : AsyncMock(return_value=0),
        f"{crud_prefix}.get_item_in_stock_value"    : AsyncMock(return_value=Decimal("0")),
        f"{crud_prefix}.get_current_month_sold_value": AsyncMock(return_value=Decimal("0")),
        f"{crud_prefix}.get_last_7_days_sales"      : AsyncMock(return_value=zero_trend),
        f"{crud_prefix}.get_most_sold_items"        : AsyncMock(return_value=[]),
        f"{crud_prefix}.get_last_5_transactions"    : AsyncMock(return_value=[]),
        f"{crud_prefix}.get_stockout_items_low_count"     : AsyncMock(return_value=0),
        f"{crud_prefix}.get_stockout_items_critical_count": AsyncMock(return_value=0),
        f"{crud_prefix}.get_draft_po_count"         : AsyncMock(return_value=0),
    }

    with ExitStack() as stack:
        stack.enter_context(patch(jwt_decode, return_value={"sub": str(admin.user_id)}))
        stack.enter_context(patch(get_user, new_callable=AsyncMock, return_value=admin))
        for k, v in patches.items():
            stack.enter_context(patch(k, new=v))

        response = await client.get(
            "/dashboard/",
            headers={"Authorization": "Bearer faketoken"},
        )

    assert response.status_code == 200, response.json()
    data = response.json()

    assert data["items_in_stock"]  == 0
    assert data["sold_value"]      == "0.00"
    assert data["draft_po_count"]  == 0
    assert data["active_alerts"]   == 0
    assert data["most_sold_items"] == []
    assert all(v == "0.00" for v in data["sales_trend"])
