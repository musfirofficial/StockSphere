from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, case, and_, literal_column, text
from app.models import Report
from typing import Sequence
from datetime import datetime

import uuid
import app.schemas.report as report_schemas
from app.models import (
    Item,
    Transaction,
    TransactionType,
    AlertStatus,
    StockAlert,
    Supplier,
)
from decimal import Decimal


# -------------------------- create new report crud -------------------------- #
async def create_report(
    db: AsyncSession, report_in: report_schemas.ReportCreate, generated_by: uuid.UUID
) -> Report:
    new_report = Report(**report_in.model_dump(), generated_by=generated_by)
    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)
    return new_report


# ------------------------- Crud for get all reports ------------------------- #
async def get_all_reports(db: AsyncSession) -> Sequence[Report] | None:
    result = await db.execute(select(Report))
    return result.scalars().all()


# ------------------------- crud for get by report id ------------------------ #
async def get_report_by_report_id(
    db: AsyncSession, report_id: uuid.UUID
) -> Report | None:
    result = await db.execute(select(Report).filter(Report.report_id == report_id))
    return result.scalars().first()


# ---------------------- crud for update existing report --------------------- #
async def update_report(
    db: AsyncSession, db_report: Report, update_data: dict
) -> Report:

    # 1. Apply the raw dict updates directly to the database object
    for field, value in update_data.items():
        setattr(db_report, field, value)
    # 2. Commit and refresh
    try:
        await db.commit()
        await db.refresh(db_report)
    except Exception as e:
        await db.rollback()
        raise e

    return db_report


# ---------------------- crud for delete report --------------------- #
async def delete_report(db: AsyncSession, report_id: uuid.UUID) -> None:
    await db.execute(delete(Report).where(Report.report_id == report_id))
    await db.commit()
    return


# ---------------------- crud for get by report name ---------------------- #
async def get_report_by_report_name(
    db: AsyncSession, report_name: str
) -> Report | None:
    result = await db.execute(select(Report).filter(Report.report_name == report_name))
    return result.scalar_one_or_none()


# --------------------------- Overall Summary Data --------------------------- #
async def get_overall_summary_data(
    db: AsyncSession, start_date: datetime, end_date: datetime
):
    # Query for card metrics
    metrics_stmt = select(
        func.sum(Item.quantity_in_stock).label("total_qty"),
        func.sum(Item.quantity_in_stock * Item.cost_price).label("total_cost_worth"),
        func.sum(Item.quantity_in_stock * Item.selling_price).label(
            "total_selling_worth"
        ),
        func.count(case((Item.is_active, Item.item_id))).label("active_count"),
        func.count(case((~Item.is_active, Item.item_id))).label("inactive_count"),
    )
    res = await db.execute(metrics_stmt)
    m_data = res.fetchone()

    if m_data:
        total_qty = m_data.total_qty or 0
        total_cost_worth = m_data.total_cost_worth or Decimal("0.00")
        total_selling_worth = m_data.total_selling_worth or Decimal("0.00")
        active_count = m_data.active_count or 0
        inactive_count = m_data.inactive_count or 0
        total_count = active_count + inactive_count

        active_pct = (active_count / total_count * 100) if total_count > 0 else 0.0
        inactive_pct = (inactive_count / total_count * 100) if total_count > 0 else 0.0

    # Query for Sell-Through Rate
    tx_stmt = select(
        func.sum(
            case(
                (
                    Transaction.transaction_type == TransactionType.STOCK_OUT,
                    Transaction.quantity,
                ),
                else_=0,
            )
        ).label("total_sold"),
        func.sum(
            case(
                (
                    Transaction.transaction_type == TransactionType.STOCK_IN,
                    Transaction.quantity,
                ),
                else_=0,
            )
        ).label("total_received"),
    ).where(
        and_(
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
        )
    )
    tx_res = await db.execute(tx_stmt)
    tx_data = tx_res.fetchone()

    if tx_data:
        total_sold = tx_data.total_sold or 0
        total_received = tx_data.total_received or 0
        sell_through_rate = (
            (total_sold / total_received * 100) if total_received > 0 else 0.0
        )

    # Query for Chart
    year_expr = func.date_part(text("'year'"), Transaction.transaction_date)
    month_expr = func.date_part(text("'month'"), Transaction.transaction_date)
    month_str = func.to_char(Transaction.transaction_date, text("'Mon'"))

    trend_stmt = (
        select(
            month_str.label("month_str"),
            year_expr.label("year_num"),
            month_expr.label("month_num"),
            func.sum(
                case(
                    (
                        Transaction.transaction_type == TransactionType.STOCK_OUT,
                        Transaction.quantity * Item.selling_price,
                    ),
                    else_=0,
                )
            ).label("sales_val"),
            func.sum(
                case(
                    (
                        Transaction.transaction_type == TransactionType.STOCK_IN,
                        Transaction.quantity * Item.cost_price,
                    ),
                    else_=0,
                )
            ).label("inv_val"),
        )
        .join(Item, Transaction.item_id == Item.item_id)
        .where(
            and_(
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date,
            )
        )
        .group_by(
            month_str,
            year_expr,
            month_expr,
        )
        .order_by(
            literal_column("year_num"),
            literal_column("month_num"),
        )
    )

    trend_res = await db.execute(trend_stmt)
    chart_points = []

    for row in trend_res.fetchall():
        inventory_val = row.inv_val if row.inv_val is not None else 0.0
        sales_val = row.sales_val if row.sales_val is not None else 0.0

        metric = report_schemas.MonthlyTrendMetric(
            month=row.month_str,  # ← still works
            inventory_value=float(inventory_val),
            sales_value=float(sales_val),
            # year_num and month_num are in row but you don't need them here
        )
        chart_points.append(metric)

    return report_schemas.OverallSummaryData(
        total_items_in_stock=total_qty,
        inventory_cost_worth=total_cost_worth,
        selling_worth=total_selling_worth,
        sell_through_rate=round(sell_through_rate, 2),
        active_items_count=active_count,
        active_items_percentage=round(active_pct, 2),
        inactive_items_count=inactive_count,
        inactive_items_percentage=round(inactive_pct, 2),
        chart_data=chart_points,
    )


# ---------------------------- Stock Alert Report ---------------------------- #
async def get_stock_alert_report_data(
    db: AsyncSession, start_date: datetime, end_date: datetime
) -> report_schemas.StockAlertSummaryData:

    # REQUIREMENT 1: Global metrics + Restock Costs (Disregards date parameters)
    # Estimated Cost = (reorder_level + reorder_quantity - quantity_in_stock) * cost_price

    global_stmt = select(
        func.count(case((StockAlert.status == AlertStatus.CRITICAL, 1))).label(
            "crit_count"
        ),
        func.count(case((StockAlert.status == AlertStatus.LOW_STOCK, 1))).label(
            "low_count"
        ),
        func.count(case((StockAlert.status == AlertStatus.RESOLVED, 1))).label(
            "res_count"
        ),
    )
    global_res = await db.execute(global_stmt)
    g_data = global_res.fetchone()

    if g_data:
        global_critical = g_data.crit_count or 0
        global_low_stock = g_data.low_count or 0
        global_resolved = g_data.res_count or 0

    cost_stmt = select(
        func.sum(
            case(
                (
                    Item.quantity_in_stock < Item.reorder_level,
                    (
                        Item.reorder_level
                        + Item.reorder_quantity
                        - Item.quantity_in_stock
                    )
                    * Item.cost_price,
                ),
                else_=0,
            )
        ).label("needed_cost")
    )
    cost_res = await db.execute(cost_stmt)
    est_restock_cost = cost_res.scalar() or Decimal("0.00")

    # REQUIREMENT 4 & 5: Resolutions Rates & MTTR inside explicit window
    # MTTR calculates the interval gap using Postgres epoch extractions converted to hours

    period_metrics_stmt = select(
        func.count(
            case((StockAlert.created_at.between(start_date, end_date), 1))
        ).label("created_in_period"),
        func.count(
            case((StockAlert.resolved_at.between(start_date, end_date), 1))
        ).label("resolved_in_period"),
        func.avg(
            case(
                (
                    and_(
                        StockAlert.status == AlertStatus.RESOLVED,
                        StockAlert.resolved_at.between(start_date, end_date),
                    ),
                    func.extract(
                        "epoch", StockAlert.resolved_at - StockAlert.created_at
                    )
                    / 3600.0,
                ),
                else_=None,
            )
        ).label("mttr_all"),
        # Note: If your system shifts status to RESOLVED upon fix, we can calculate MTTR by checking historical states.
        # Assuming we look at all resolved alerts within the period that were spawned as Critical/Low Stock:
        func.avg(
            case(
                (
                    and_(
                        StockAlert.resolved_at.between(start_date, end_date),
                        Item.quantity_in_stock == 0,
                    ),
                    func.extract(
                        "epoch", StockAlert.resolved_at - StockAlert.created_at
                    )
                    / 3600.0,
                ),
                else_=None,
            )
        ).label("mttr_crit"),
        func.avg(
            case(
                (
                    and_(
                        StockAlert.resolved_at.between(start_date, end_date),
                        Item.quantity_in_stock > 0,
                    ),
                    func.extract(
                        "epoch", StockAlert.resolved_at - StockAlert.created_at
                    )
                    / 3600.0,
                ),
                else_=None,
            )
        ).label("mttr_low"),
    ).join(Item, StockAlert.item_id == Item.item_id)

    p_res = await db.execute(period_metrics_stmt)
    p_data = p_res.fetchone()

    if p_data:
        created_in_period = p_data.created_in_period or 0
        resolved_in_period = p_data.resolved_in_period or 0

        resolution_rate = (
            (resolved_in_period / created_in_period * 100)
            if created_in_period > 0
            else 0.0
        )
        mttr_critical = p_data.mttr_crit or 0.0
        mttr_low_stock = p_data.mttr_low or 0.0

    # REQUIREMENT 2: Time Series Chart (Alerts Created inside Window grouped by month)
    year_expr = func.date_part(text("'year'"), StockAlert.created_at)
    month_expr = func.date_part(text("'month'"), StockAlert.created_at)
    month_str = func.to_char(StockAlert.created_at, text("'Mon'"))

    trend_stmt = (
        select(
            month_str.label("month_label"),
            year_expr.label("year_num"),
            month_expr.label("month_num"),
            func.count(case((StockAlert.status == AlertStatus.CRITICAL, 1))).label(
                "crit_count"
            ),
            func.count(case((StockAlert.status == AlertStatus.LOW_STOCK, 1))).label(
                "low_count"
            ),
        )
        .where(StockAlert.created_at.between(start_date, end_date))
        .group_by(month_str, year_expr, month_expr)
        .order_by(literal_column("year_num"), literal_column("month_num"))
    )

    trend_res = await db.execute(trend_stmt)
    chart_points = [
        report_schemas.AlertTrendPoint(
            month=row.month_label,
            critical_count=row.crit_count or 0,
            low_stock_count=row.low_count or 0,
        )
        for row in trend_res.fetchall()
    ]

    # REQUIREMENT 3: Supplier Breakdown Context Matrix
    # We use an outer join to capture tracking alerts even if no supplier assignment is recorded
    supplier_stmt = (
        select(
            StockAlert.supplier_id.label("sup_id"),
            # Use a safe ORM function aggregate on the column instead of a literal text clause
            func.max(Supplier.supplier_name).label("sup_name"),
            func.count(case((StockAlert.status == AlertStatus.CRITICAL, 1))).label(
                "crit_count"
            ),
            func.count(case((StockAlert.status == AlertStatus.LOW_STOCK, 1))).label(
                "low_count"
            ),
            func.count(StockAlert.alert_id).label("total_count"),
        )
        # FIX: Join directly on the Supplier model class or relationship attribute
        .join(Supplier, StockAlert.supplier_id == Supplier.supplier_id, isouter=True)
        .where(StockAlert.created_at.between(start_date, end_date))
        .group_by(StockAlert.supplier_id)
        .order_by(literal_column("total_count").desc())
    )

    supplier_res = await db.execute(supplier_stmt)
    supplier_breakdown = [
        report_schemas.SupplierAlertMetric(
            supplier_id=row.sup_id,
            supplier_name=row.sup_name or "Unassigned / Direct",
            critical_count=row.crit_count or 0,
            low_stock_count=row.low_count or 0,
            total_count=row.total_count or 0,
        )
        for row in supplier_res.fetchall()
    ]

    # Build and structuralize return payload
    return report_schemas.StockAlertSummaryData(
        global_critical_alerts=global_critical,
        global_low_stock_alerts=global_low_stock,
        global_total_resolved_alerts=global_resolved,
        estimated_restock_cost=est_restock_cost,
        period_resolution_rate=round(resolution_rate, 2),
        avg_mttr_critical_hours=round(mttr_critical, 2),
        avg_mttr_low_stock_hours=round(mttr_low_stock, 2),
        chart_data=chart_points,
        supplier_breakdown=supplier_breakdown,
    )


# ---------------------------- Category Wise Report --------------------------- #
async def get_category_report_data(db: AsyncSession) -> report_schemas.CategoryReportData:
    from app.models import Category

    # Total quantity in stock across all items to compute physical space % (proportion of stock volume/qty)
    total_qty_stmt = select(func.sum(Item.quantity_in_stock))
    total_qty_res = await db.execute(total_qty_stmt)
    overall_total_qty = total_qty_res.scalar() or 0

    # Query metrics grouped by Category
    stmt = (
        select(
            Category.category_id,
            Category.category_name,
            func.sum(Item.quantity_in_stock * Item.selling_price).label("stock_val"),
            func.sum(Item.quantity_in_stock * Item.cost_price).label("cost_val"),
            func.sum(Item.quantity_in_stock).label("cat_qty"),
        )
        .join(Item, Category.category_id == Item.category_id)
        .where(Item.is_active == True)
        .group_by(Category.category_id, Category.category_name)
        .order_by(literal_column("stock_val").desc())
    )

    res = await db.execute(stmt)
    rows = res.fetchall()

    metrics = []
    for r in rows:
        stock_val = r.stock_val or Decimal("0.00")
        cost_val = r.cost_val or Decimal("0.00")
        cat_qty = r.cat_qty or 0

        # Margin % = ((Selling Value - Cost Value) / Selling Value) * 100
        if stock_val > 0:
            margin_pct = float(((stock_val - cost_val) / stock_val) * 100)
        else:
            margin_pct = 0.0

        # Space Used % = (Category Total Quantity / Overall Total Quantity) * 100
        if overall_total_qty > 0:
            space_pct = float((cat_qty / overall_total_qty) * 100)
        else:
            space_pct = 0.0

        metrics.append(
            report_schemas.CategoryReportMetric(
                category_id=r.category_id,
                category_name=r.category_name,
                stock_value=stock_val,
                margin_percentage=round(margin_pct, 1),
                space_used_percentage=round(space_pct, 1),
            )
        )

    return report_schemas.CategoryReportData(categories=metrics)
