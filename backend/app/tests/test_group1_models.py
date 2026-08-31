import pytest
from decimal import Decimal
from datetime import date
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.database import Base
from app.models import (
    Category,
    Supplier,
    Unit,
    Item,
    ItemSupplier,
    StockBatch,
    PurchaseOrder,
    PurchaseOrderItem,
    Transaction,
    POStatus,
    TransactionType,
    ItemHealthStatus,
)


@pytest.mark.asyncio
async def test_item_supplier_mm_and_batches():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with async_session() as db_session:
        # 1. Create Category and Unit
        cat = Category(category_name="Electronics")
        unit = Unit(unit_name="Pieces", unit_symbol="pcs")
        db_session.add_all([cat, unit])
        await db_session.commit()
        await db_session.refresh(cat)
        await db_session.refresh(unit)

        # 2. Create Suppliers
        sup1 = Supplier(
            supplier_name="Alpha Tech",
            contact_person="Alice",
            phone="0711111111",
            email="alice@alpha.com",
            address="Colombo 01",
        )
        sup2 = Supplier(
            supplier_name="Beta Logistics",
            contact_person="Bob",
            phone="0722222222",
            email="bob@beta.com",
            address="Colombo 02",
        )
        db_session.add_all([sup1, sup2])
        await db_session.commit()
        await db_session.refresh(sup1)
        await db_session.refresh(sup2)

        # 3. Create Item (no supplier required at creation)
        item = Item(
            item_name="Wireless Keyboard K100",
            sku="KEYB-1001",
            category_id=cat.category_id,
            unit_id=unit.unit_id,
            unit="pcs",
            cost_price=Decimal("45.00"),
            selling_price=Decimal("75.00"),
            reorder_level=10,
            reorder_quantity=20,
            quantity_in_stock=0,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)

        # Health status should be CRITICAL when quantity == 0
        assert item.health_status == ItemHealthStatus.CRITICAL

        # 4. Link Suppliers with Agreed Prices (M:M)
        link1 = ItemSupplier(
            item_id=item.item_id,
            supplier_id=sup1.supplier_id,
            agreed_price=Decimal("42.50"),
            is_primary=True,
            supplier_sku="ALPHA-KB-1",
        )
        link2 = ItemSupplier(
            item_id=item.item_id,
            supplier_id=sup2.supplier_id,
            agreed_price=Decimal("44.00"),
            is_primary=False,
            supplier_sku="BETA-KB-1",
        )
        db_session.add_all([link1, link2])
        await db_session.commit()

        # 5. Create Batch Tracking
        batch1 = StockBatch(
            item_id=item.item_id,
            supplier_id=sup1.supplier_id,
            batch_number="BATCH-2026-001",
            purchase_price=Decimal("42.50"),
            initial_quantity=50,
            current_quantity=50,
            expiry_date=date(2028, 12, 31),
        )
        db_session.add(batch1)
        # Update item quantity
        item.quantity_in_stock = 50
        await db_session.commit()
        await db_session.refresh(item)
        await db_session.refresh(batch1)

        # Health status should be HEALTHY when qty > reorder_level (50 > 10)
        assert item.health_status == ItemHealthStatus.HEALTHY
        assert batch1.current_quantity == 50
        assert batch1.batch_number == "BATCH-2026-001"

        # 6. Test PO with new POStatus Enum
        po = PurchaseOrder(
            supplier_id=sup1.supplier_id,
            status=POStatus.PENDING_APPROVAL,
        )
        db_session.add(po)
        await db_session.commit()
        await db_session.refresh(po)
        assert po.status == POStatus.PENDING_APPROVAL

        # 7. Test Transaction with new TransactionType
        tx = Transaction(
            item_id=item.item_id,
            supplier_id=sup1.supplier_id,
            batch_id=batch1.batch_id,
            transaction_type=TransactionType.SOLD,
            quantity=5,
            previous_quantity=50,
            new_quantity=45,
            unit_price=Decimal("75.00"),
        )
        db_session.add(tx)
        await db_session.commit()
        await db_session.refresh(tx)
        assert tx.transaction_type == TransactionType.SOLD

    await engine.dispose()
