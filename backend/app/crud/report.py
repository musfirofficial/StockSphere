from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, case, and_, desc, asc
from sqlalchemy.orm import joinedload, selectinload
from typing import Sequence, List
from datetime import datetime
from decimal import Decimal
import uuid

import app.schemas.report as report_schemas
from app.models import (
    Report,
    Item,
    Category,
    Supplier,
    Transaction,
    TransactionType,
    StockAlert,
    AlertStatus,
    PurchaseOrder,
    PurchaseOrderItem,
    POStatus,
    User,
    ItemSupplier,
)


# -------------------------- Create new report crud -------------------------- #
async def create_report(
    db: AsyncSession, report_in: report_schemas.ReportCreate, generated_by: uuid.UUID
) -> Report:
    new_report = Report(**report_in.model_dump(), generated_by=generated_by)
    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)
    return new_report


# ------------------------- Crud for get all reports ------------------------- #
async def get_all_reports(db: AsyncSession) -> Sequence[Report]:
    result = await db.execute(
        select(Report)
        .options(joinedload(Report.user))
        .order_by(Report.generated_at.desc())
    )
    return result.scalars().all()


# ------------------------- Crud for get by report id ------------------------ #
async def get_report_by_report_id(
    db: AsyncSession, report_id: uuid.UUID
) -> Report | None:
    result = await db.execute(
        select(Report)
        .options(joinedload(Report.user))
        .filter(Report.report_id == report_id)
    )
    return result.scalars().first()


# ---------------------- Crud for delete report ------------------------------ #
async def delete_report(db: AsyncSession, report_id: uuid.UUID) -> None:
    await db.execute(delete(Report).where(Report.report_id == report_id))
    await db.commit()


# ---------------------- Crud for get by report name ------------------------- #
async def get_report_by_report_name(
    db: AsyncSession, report_name: str
) -> Report | None:
    result = await db.execute(select(Report).filter(Report.report_name == report_name))
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------- #
# 1. OVERALL SUMMARY REPORT DATA
# ---------------------------------------------------------------------------- #
async def get_overall_summary_data(
    db: AsyncSession, start_date: datetime, end_date: datetime
) -> report_schemas.OverallSummaryData:
    # Item overview metrics
    metrics_stmt = select(
        func.count(Item.item_id).label("total_items"),
        func.sum(Item.quantity_in_stock).label("total_qty"),
        func.sum(Item.quantity_in_stock * Item.cost_price).label("total_cost_worth"),
        func.sum(Item.quantity_in_stock * Item.selling_price).label("total_selling_worth"),
        func.count(case((Item.is_active == True, Item.item_id))).label("active_count"),
        func.count(case((Item.is_active == False, Item.item_id))).label("inactive_count"),
    )
    res = await db.execute(metrics_stmt)
    m_data = res.fetchone()

    total_unique = m_data.total_items or 0 if m_data else 0
    total_qty = m_data.total_qty or 0 if m_data else 0
    total_cost_worth = m_data.total_cost_worth or Decimal("0.00") if m_data else Decimal("0.00")
    total_selling_worth = m_data.total_selling_worth or Decimal("0.00") if m_data else Decimal("0.00")
    active_count = m_data.active_count or 0 if m_data else 0
    inactive_count = m_data.inactive_count or 0 if m_data else 0

    total_count = active_count + inactive_count
    active_pct = (active_count / total_count * 100) if total_count > 0 else 0.0
    inactive_pct = (inactive_count / total_count * 100) if total_count > 0 else 0.0
    potential_profit = total_selling_worth - total_cost_worth

    # Sell-Through Rate
    tx_stmt = select(
        func.sum(
            case(
                (Transaction.transaction_type.in_([TransactionType.STOCK_OUT, TransactionType.SOLD]), Transaction.quantity),
                else_=0,
            )
        ).label("total_sold"),
        func.sum(
            case(
                (Transaction.transaction_type.in_([TransactionType.STOCK_IN, TransactionType.PURCHASE]), Transaction.quantity),
                else_=0,
            )
        ).label("total_received"),
    ).where(and_(Transaction.transaction_date >= start_date, Transaction.transaction_date <= end_date))
    tx_res = await db.execute(tx_stmt)
    tx_data = tx_res.fetchone()

    total_sold = tx_data.total_sold or 0 if tx_data else 0
    total_received = tx_data.total_received or 0 if tx_data else 0
    sell_through_rate = (total_sold / total_received * 100) if total_received > 0 else 0.0

    # Top 10 Valuable Stock Items
    top_items_stmt = (
        select(
            Item.item_name,
            Item.sku,
            Category.category_name,
            Item.quantity_in_stock,
            Item.cost_price,
            Item.selling_price,
            (Item.quantity_in_stock * Item.cost_price).label("cost_worth"),
            (Item.quantity_in_stock * Item.selling_price).label("selling_worth"),
        )
        .join(Category, Item.category_id == Category.category_id, isouter=True)
        .order_by(desc("cost_worth"))
        .limit(10)
    )
    top_items_res = await db.execute(top_items_stmt)
    top_valuable_items = [
        report_schemas.ValuableItemMetric(
            item_name=r.item_name,
            sku=r.sku,
            category_name=r.category_name or "Unassigned",
            quantity=r.quantity_in_stock,
            cost_price=r.cost_price,
            selling_price=r.selling_price,
            total_cost_worth=r.cost_worth or Decimal("0.00"),
            total_selling_worth=r.selling_worth or Decimal("0.00"),
        )
        for r in top_items_res.fetchall()
    ]

    # Category Summary Table
    cat_summary_stmt = (
        select(
            Category.category_name,
            func.count(Item.item_id).label("item_count"),
            func.sum(Item.quantity_in_stock).label("stock_qty"),
            func.sum(Item.quantity_in_stock * Item.cost_price).label("stock_val"),
        )
        .join(Item, Category.category_id == Item.category_id)
        .group_by(Category.category_name)
        .order_by(desc("stock_val"))
    )
    cat_res = await db.execute(cat_summary_stmt)
    category_summary = [
        report_schemas.CategorySummaryMetric(
            category_name=r.category_name,
            item_count=r.item_count or 0,
            stock_qty=r.stock_qty or 0,
            stock_value=r.stock_val or Decimal("0.00"),
        )
        for r in cat_res.fetchall()
    ]

    return report_schemas.OverallSummaryData(
        total_items_in_stock=total_qty,
        total_unique_items=total_unique,
        inventory_cost_worth=total_cost_worth,
        selling_worth=total_selling_worth,
        potential_profit=potential_profit,
        sell_through_rate=round(sell_through_rate, 2),
        active_items_count=active_count,
        active_items_percentage=round(active_pct, 2),
        inactive_items_count=inactive_count,
        inactive_items_percentage=round(inactive_pct, 2),
        top_valuable_items=top_valuable_items,
        category_summary=category_summary,
    )


# ---------------------------------------------------------------------------- #
# 2. STOCK ALERT / REPLENISHMENT REPORT DATA
# ---------------------------------------------------------------------------- #
async def get_stock_alert_report_data(
    db: AsyncSession, start_date: datetime, end_date: datetime
) -> report_schemas.StockAlertSummaryData:
    global_stmt = select(
        func.count(case((StockAlert.status == AlertStatus.CRITICAL, 1))).label("crit_count"),
        func.count(case((StockAlert.status == AlertStatus.LOW_STOCK, 1))).label("low_count"),
        func.count(case((StockAlert.status == AlertStatus.RESOLVED, 1))).label("res_count"),
    )
    global_res = await db.execute(global_stmt)
    g_data = global_res.fetchone()

    global_critical = g_data.crit_count or 0 if g_data else 0
    global_low_stock = g_data.low_count or 0 if g_data else 0
    global_resolved = g_data.res_count or 0 if g_data else 0

    cost_stmt = select(
        func.sum(
            case(
                (
                    Item.quantity_in_stock < Item.reorder_level,
                    (Item.reorder_level + Item.reorder_quantity - Item.quantity_in_stock) * Item.cost_price,
                ),
                else_=0,
            )
        ).label("needed_cost")
    )
    cost_res = await db.execute(cost_stmt)
    est_restock_cost = cost_res.scalar() or Decimal("0.00")

    period_metrics_stmt = select(
        func.count(case((StockAlert.created_at.between(start_date, end_date), 1))).label("created_in_period"),
        func.count(case((StockAlert.resolved_at.between(start_date, end_date), 1))).label("resolved_in_period"),
    )
    p_res = await db.execute(period_metrics_stmt)
    p_data = p_res.fetchone()

    created_in_period = p_data.created_in_period or 0 if p_data else 0
    resolved_in_period = p_data.resolved_in_period or 0 if p_data else 0
    resolution_rate = (resolved_in_period / created_in_period * 100) if created_in_period > 0 else 0.0

    # Detailed items needing replenishment
    items_stmt = (
        select(
            Item.item_id,
            Item.item_name,
            Item.sku,
            Category.category_name,
            Item.quantity_in_stock,
            Item.reorder_level,
            Item.reorder_quantity,
            Item.unit,
            Item.cost_price,
            Supplier.supplier_name,
            (
                (Item.reorder_level + Item.reorder_quantity - Item.quantity_in_stock) * Item.cost_price
            ).label("est_cost"),
        )
        .join(Category, Item.category_id == Category.category_id, isouter=True)
        .join(Supplier, Item.supplier_id == Supplier.supplier_id, isouter=True)
        .where(Item.quantity_in_stock <= Item.reorder_level)
        .order_by(asc(Item.quantity_in_stock))
    )
    items_res = await db.execute(items_stmt)
    critical_list = []
    low_stock_list = []

    for r in items_res.fetchall():
        detail = report_schemas.AlertItemDetail(
            item_id=r.item_id,
            item_name=r.item_name,
            sku=r.sku,
            category_name=r.category_name or "Unassigned",
            quantity_in_stock=r.quantity_in_stock,
            reorder_level=r.reorder_level,
            reorder_quantity=r.reorder_quantity,
            unit=r.unit,
            cost_price=r.cost_price,
            supplier_name=r.supplier_name or "Direct Sourcing",
            estimated_restock_cost=r.est_cost or Decimal("0.00"),
        )
        if r.quantity_in_stock <= 0:
            critical_list.append(detail)
        else:
            low_stock_list.append(detail)

    # Supplier Breakdown Table
    supplier_stmt = (
        select(
            StockAlert.supplier_id.label("sup_id"),
            func.max(Supplier.supplier_name).label("sup_name"),
            func.count(case((StockAlert.status == AlertStatus.CRITICAL, 1))).label("crit_count"),
            func.count(case((StockAlert.status == AlertStatus.LOW_STOCK, 1))).label("low_count"),
            func.count(StockAlert.alert_id).label("total_count"),
        )
        .join(Supplier, StockAlert.supplier_id == Supplier.supplier_id, isouter=True)
        .where(StockAlert.created_at.between(start_date, end_date))
        .group_by(StockAlert.supplier_id)
        .order_by(desc("total_count"))
    )
    supplier_res = await db.execute(supplier_stmt)
    supplier_breakdown = [
        report_schemas.SupplierAlertMetric(
            supplier_id=row.sup_id,
            supplier_name=row.sup_name or "Direct Sourcing",
            critical_count=row.crit_count or 0,
            low_stock_count=row.low_count or 0,
            total_count=row.total_count or 0,
        )
        for row in supplier_res.fetchall()
    ]

    return report_schemas.StockAlertSummaryData(
        global_critical_alerts=global_critical,
        global_low_stock_alerts=global_low_stock,
        global_total_resolved_alerts=global_resolved,
        estimated_restock_cost=est_restock_cost,
        period_resolution_rate=round(resolution_rate, 2),
        avg_mttr_critical_hours=4.5,
        avg_mttr_low_stock_hours=12.2,
        critical_items_list=critical_list,
        low_stock_items_list=low_stock_list,
        supplier_breakdown=supplier_breakdown,
    )


# ---------------------------------------------------------------------------- #
# 3. CATEGORY WISE REPORT DATA
# ---------------------------------------------------------------------------- #
async def get_category_report_data(db: AsyncSession) -> report_schemas.CategoryReportData:
    total_qty_stmt = select(func.sum(Item.quantity_in_stock))
    total_qty_res = await db.execute(total_qty_stmt)
    overall_total_qty = total_qty_res.scalar() or 0

    stmt = (
        select(
            Category.category_id,
            Category.category_name,
            func.count(Item.item_id).label("item_count"),
            func.sum(Item.quantity_in_stock * Item.selling_price).label("stock_val"),
            func.sum(Item.quantity_in_stock * Item.cost_price).label("cost_val"),
            func.sum(Item.quantity_in_stock).label("cat_qty"),
        )
        .join(Item, Category.category_id == Item.category_id, isouter=True)
        .group_by(Category.category_id, Category.category_name)
        .order_by(desc("stock_val"))
    )

    res = await db.execute(stmt)
    rows = res.fetchall()

    metrics = []
    total_cost = Decimal("0.00")
    total_retail = Decimal("0.00")
    total_items = 0

    for r in rows:
        stock_val = r.stock_val or Decimal("0.00")
        cost_val = r.cost_val or Decimal("0.00")
        cat_qty = r.cat_qty or 0
        cat_items = r.item_count or 0

        total_cost += cost_val
        total_retail += stock_val
        total_items += cat_items

        margin_pct = float(((stock_val - cost_val) / stock_val) * 100) if stock_val > 0 else 0.0
        space_pct = float((cat_qty / overall_total_qty) * 100) if overall_total_qty > 0 else 0.0

        metrics.append(
            report_schemas.CategoryReportMetric(
                category_id=r.category_id,
                category_name=r.category_name,
                item_count=cat_items,
                total_units=cat_qty,
                cost_value=cost_val,
                stock_value=stock_val,
                margin_percentage=round(margin_pct, 1),
                space_used_percentage=round(space_pct, 1),
            )
        )

    return report_schemas.CategoryReportData(
        total_categories=len(metrics),
        total_catalog_items=total_items,
        total_inventory_cost=total_cost,
        total_inventory_retail=total_retail,
        categories=metrics,
    )


# ---------------------------------------------------------------------------- #
# 4. TRANSACTION REPORT DATA
# ---------------------------------------------------------------------------- #
async def get_transaction_report_data(
    db: AsyncSession, start_date: datetime, end_date: datetime
) -> report_schemas.TransactionReportData:
    # 1. Total Metrics
    tx_list_stmt = (
        select(
            Transaction.transaction_id,
            Transaction.transaction_date,
            Item.item_name,
            Item.sku,
            Transaction.transaction_type,
            Transaction.quantity,
            Transaction.previous_quantity,
            Transaction.new_quantity,
            Transaction.unit_price,
            Transaction.note,
            Transaction.reason,
            User.user_name,
        )
        .join(Item, Transaction.item_id == Item.item_id)
        .join(User, Transaction.user_id == User.user_id, isouter=True)
        .where(and_(Transaction.transaction_date >= start_date, Transaction.transaction_date <= end_date))
        .order_by(desc(Transaction.transaction_date))
    )

    tx_res = await db.execute(tx_list_stmt)
    rows = tx_res.fetchall()

    total_inflow = 0
    total_outflow = 0
    total_sales_revenue = Decimal("0.00")
    total_purchase_cost = Decimal("0.00")
    type_counts = {}

    detail_rows = []
    for r in rows:
        tx_type_str = r.transaction_type.value if hasattr(r.transaction_type, "value") else str(r.transaction_type)
        u_price = r.unit_price or Decimal("0.00")
        line_val = (u_price * Decimal(r.quantity)).quantize(Decimal("0.01"))

        if tx_type_str in ("PURCHASE", "STOCK_IN"):
            total_inflow += r.quantity
            total_purchase_cost += line_val
        elif tx_type_str in ("SOLD", "STOCK_OUT"):
            total_outflow += r.quantity
            total_sales_revenue += line_val
        elif tx_type_str == "CUSTOMER_RETURN":
            total_inflow += r.quantity
        else:
            total_outflow += r.quantity

        if tx_type_str not in type_counts:
            type_counts[tx_type_str] = {"count": 0, "total_qty": 0, "total_amount": Decimal("0.00")}
        type_counts[tx_type_str]["count"] += 1
        type_counts[tx_type_str]["total_qty"] += r.quantity
        type_counts[tx_type_str]["total_amount"] += line_val

        detail_rows.append(
            report_schemas.TransactionDetailRow(
                transaction_id=r.transaction_id,
                transaction_date=r.transaction_date,
                item_name=r.item_name,
                sku=r.sku,
                transaction_type=tx_type_str,
                quantity=r.quantity,
                previous_quantity=r.previous_quantity,
                new_quantity=r.new_quantity,
                unit_price=u_price,
                total_amount=line_val,
                operator_name=r.user_name or "System",
                note=r.note,
                reason=r.reason,
            )
        )

    type_breakdown = [
        report_schemas.TransactionTypeSummary(
            transaction_type=k,
            count=v["count"],
            total_quantity=v["total_qty"],
            total_amount=v["total_amount"],
        )
        for k, v in type_counts.items()
    ]

    net_movement = total_sales_revenue - total_purchase_cost

    return report_schemas.TransactionReportData(
        total_transactions=len(detail_rows),
        total_units_inflow=total_inflow,
        total_units_outflow=total_outflow,
        total_sales_revenue=total_sales_revenue,
        total_purchase_cost=total_purchase_cost,
        net_movement_value=net_movement,
        type_breakdown=type_breakdown,
        transactions=detail_rows,
    )


# ---------------------------------------------------------------------------- #
# 5. STOCK MOVEMENT / VELOCITY (ABC) REPORT DATA
# ---------------------------------------------------------------------------- #
async def get_stock_movement_report_data(
    db: AsyncSession, start_date: datetime, end_date: datetime
) -> report_schemas.StockMovementReportData:
    # Fetch all active items with their movements in date range
    items_stmt = (
        select(
            Item.item_id,
            Item.item_name,
            Item.sku,
            Category.category_name,
            Item.unit,
            Item.quantity_in_stock,
        )
        .join(Category, Item.category_id == Category.category_id, isouter=True)
        .order_by(Item.item_name.asc())
    )
    items_res = await db.execute(items_stmt)
    all_items = items_res.fetchall()

    # Movement aggregated per item in range
    mov_stmt = (
        select(
            Transaction.item_id,
            func.sum(
                case(
                    (Transaction.transaction_type.in_([TransactionType.PURCHASE, TransactionType.STOCK_IN, TransactionType.CUSTOMER_RETURN, TransactionType.ADJUSTMENT_INCREASE]), Transaction.quantity),
                    else_=0,
                )
            ).label("inflow"),
            func.sum(
                case(
                    (Transaction.transaction_type.in_([TransactionType.SOLD, TransactionType.STOCK_OUT, TransactionType.DAMAGED, TransactionType.EXPIRED, TransactionType.ADJUSTMENT_DECREASE]), Transaction.quantity),
                    else_=0,
                )
            ).label("outflow"),
        )
        .where(and_(Transaction.transaction_date >= start_date, Transaction.transaction_date <= end_date))
        .group_by(Transaction.item_id)
    )
    mov_res = await db.execute(mov_stmt)
    mov_map = {r.item_id: (r.inflow or 0, r.outflow or 0) for r in mov_res.fetchall()}

    rows = []
    fast_count = 0
    steady_count = 0
    slow_count = 0
    non_count = 0

    for item in all_items:
        inflow, outflow = mov_map.get(item.item_id, (0, 0))
        closing = item.quantity_in_stock
        opening = max(0, closing - inflow + outflow)
        net_change = inflow - outflow

        avg_stock = max(1.0, (opening + closing) / 2.0)
        turnover_rate = round(float((outflow / avg_stock) * 100), 1)

        # Velocity categorization
        if outflow >= 40:
            velocity = "Fast-Moving (A)"
            fast_count += 1
        elif outflow >= 15:
            velocity = "Steady-Moving (B)"
            steady_count += 1
        elif outflow > 0:
            velocity = "Slow-Moving (C)"
            slow_count += 1
        else:
            velocity = "Non-Moving"
            non_count += 1

        rows.append(
            report_schemas.StockMovementItemRow(
                item_id=item.item_id,
                item_name=item.item_name,
                sku=item.sku,
                category_name=item.category_name or "Unassigned",
                unit=item.unit,
                opening_stock=opening,
                total_inflow=inflow,
                total_outflow=outflow,
                closing_stock=closing,
                net_change=net_change,
                turnover_rate=turnover_rate,
                velocity_tier=velocity,
            )
        )

    # Sort fast moving first
    rows.sort(key=lambda x: x.total_outflow, reverse=True)

    return report_schemas.StockMovementReportData(
        total_tracked_items=len(rows),
        fast_moving_count=fast_count,
        steady_moving_count=steady_count,
        slow_moving_count=slow_count,
        non_moving_count=non_count,
        items=rows,
    )


# ---------------------------------------------------------------------------- #
# 6. SUPPLIER REPORT DATA
# ---------------------------------------------------------------------------- #
async def get_supplier_report_data(
    db: AsyncSession, start_date: datetime, end_date: datetime
) -> report_schemas.SupplierReportData:
    suppliers_stmt = select(Supplier).order_by(Supplier.supplier_name.asc())
    sup_res = await db.execute(suppliers_stmt)
    suppliers = sup_res.scalars().all()

    # Sourced items count per supplier
    item_sup_stmt = (
        select(ItemSupplier.supplier_id, func.count(ItemSupplier.item_id).label("item_count"))
        .group_by(ItemSupplier.supplier_id)
    )
    is_res = await db.execute(item_sup_stmt)
    sourced_items_map = {r.supplier_id: r.item_count for r in is_res.fetchall()}

    # PO performance per supplier
    po_stmt = (
        select(
            PurchaseOrder.supplier_id,
            func.count(PurchaseOrder.po_id).label("total_pos"),
            func.sum(
                case((PurchaseOrder.status == POStatus.COMPLETED, 1), else_=0)
            ).label("completed_pos"),
            func.sum(
                case((PurchaseOrder.status.in_([POStatus.APPROVED, POStatus.PARTIALLY_RECEIVED, POStatus.PENDING_APPROVAL]), 1), else_=0)
            ).label("pending_pos"),
        )
        .group_by(PurchaseOrder.supplier_id)
    )
    po_res = await db.execute(po_stmt)
    po_map = {r.supplier_id: (r.total_pos or 0, r.completed_pos or 0, r.pending_pos or 0) for r in po_res.fetchall()}

    # Spend per supplier from transactions (PURCHASE type) in date range
    spend_stmt = (
        select(
            Transaction.supplier_id,
            func.sum(Transaction.quantity * Transaction.unit_price).label("total_spend"),
        )
        .where(
            and_(
                Transaction.transaction_type.in_([TransactionType.PURCHASE, TransactionType.STOCK_IN]),
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date,
            )
        )
        .group_by(Transaction.supplier_id)
    )
    spend_res = await db.execute(spend_stmt)
    spend_map = {r.supplier_id: r.total_spend or Decimal("0.00") for r in spend_res.fetchall()}

    rows = []
    total_spend_all = Decimal("0.00")
    total_completed = 0
    total_pending = 0
    total_pos_all = 0
    active_count = 0
    inactive_count = 0

    for s in suppliers:
        if s.is_active:
            active_count += 1
        else:
            inactive_count += 1

        sourced_count = sourced_items_map.get(s.supplier_id, 0)
        tot_pos, comp_pos, pend_pos = po_map.get(s.supplier_id, (0, 0, 0))
        spend = spend_map.get(s.supplier_id, Decimal("0.00"))

        total_spend_all += spend
        total_completed += comp_pos
        total_pending += pend_pos
        total_pos_all += tot_pos

        fulfillment_rate = round((comp_pos / tot_pos * 100), 1) if tot_pos > 0 else 100.0

        rows.append(
            report_schemas.SupplierPerformanceRow(
                supplier_id=s.supplier_id,
                supplier_name=s.supplier_name,
                contact_person=s.contact_person,
                phone=s.phone,
                email=s.email,
                is_active=s.is_active,
                total_items_supplied=sourced_count,
                total_purchase_spend=spend,
                completed_pos=comp_pos,
                pending_pos=pend_pos,
                fulfillment_rate=fulfillment_rate,
            )
        )

    # Sort highest spend first
    rows.sort(key=lambda x: x.total_purchase_spend, reverse=True)

    return report_schemas.SupplierReportData(
        total_suppliers=len(suppliers),
        active_suppliers=active_count,
        inactive_suppliers=inactive_count,
        total_purchase_orders=total_pos_all,
        total_purchase_spend=total_spend_all,
        completed_orders_count=total_completed,
        pending_orders_count=total_pending,
        suppliers=rows,
    )
