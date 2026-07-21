"use client";
import React, { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Treemap, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { FileBarChart2, ChevronDown, Calendar, Clock, Printer, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useTheme } from "../ThemeContext";
import { useData, Item, Category, Supplier, Transaction } from "../DataContext";

const REPORT_TYPES = [
  { id: "summary", label: "Overall Summary" },
  { id: "lowstock", label: "Stock Alert Report" },
  { id: "transactions", label: "Transaction Report" },
  { id: "velocity", label: "Stock Velocity (ABC)" },
  { id: "category", label: "Category Report" },
  { id: "supplier", label: "Supplier Report" },
];

const clsColor: any = { A: "#3B6E5E", B: "#A6792F", C: "#B3473C" };

// ── Shared Helpers ──────────────────────────────────────────
function Card({ c, children, style = {} }: any) {
  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        padding: "18px 20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.02)",
        transition: "transform 0.2s, box-shadow 0.2s",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Sect({ c, title, sub }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: c.textFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Reusable card for high-level stock statistics
function Stat({ c, label, value, sub, color }: any) {
  return (
    <div
      style={{
        background: c.surfaceMuted,
        borderRadius: 10,
        padding: "14px 16px",
        border: `1px solid ${c.border}`,
        transition: "all 0.15s ease",
      }}
    >
      <div style={{ fontSize: 11.5, color: c.textFaint, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || c.text, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Helper to convert date inputs to ISO string
const formatDateToISO = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Helper to parse dates from the transactions list
function parseTxDate(dateStr: string): Date {
  const now = new Date();
  const d = new Date(now);

  if (!dateStr) return d;

  if (dateStr.startsWith("Today")) {
    const time = dateStr.substring(6).trim();
    const [h, m] = time.split(":").map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }

  if (dateStr.startsWith("Yesterday")) {
    d.setDate(d.getDate() - 1);
    const time = dateStr.substring(10).trim();
    const [h, m] = time.split(":").map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }

  // Format: "10 Jul 16:40"
  const parts = dateStr.split(" ");
  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10);
    const monthName = parts[1];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = months.indexOf(monthName);

    if (monthIndex !== -1) {
      d.setMonth(monthIndex);
      d.setDate(day);

      if (parts[2]) {
        const [h, m] = parts[2].split(":").map(Number);
        d.setHours(h || 0, m || 0, 0, 0);
      } else {
        d.setHours(0, 0, 0, 0);
      }
      return d;
    }
  }

  // Format: "YYYY-MM-DD HH:MM" or similar
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return d;
}

// Calculate dynamic trend data by reversing transactions back to historical moments
function getDynamicTrendData(startDate: Date, endDate: Date, transactionList: Transaction[], itemList: Item[]) {
  const data: { label: string; inv: number; sales: number }[] = [];
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const diffDays = Math.ceil(Math.abs(endMs - startMs) / (1000 * 60 * 60 * 24));

  // Determine points based on date range
  let points: Date[] = [];
  if (diffDays <= 15) {
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      points.push(new Date(d));
    }
  } else {
    const step = Math.ceil(diffDays / 8);
    for (let i = 0; i < 8; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i * step);
      if (d <= endDate) points.push(d);
    }
    const lastPoint = points[points.length - 1];
    if (!lastPoint || lastPoint.getTime() < endDate.getTime()) {
      points.push(new Date(endDate));
    }
  }

  points.forEach((pt) => {
    let totalInvVal = 0;

    // Reverse transactions that happened after pt to find the historical quantity
    itemList.forEach((item) => {
      const txsAfterPt = transactionList.filter(
        (t) => t.item === item.itemName && parseTxDate(t.date) > pt
      );
      const changeAfter = txsAfterPt.reduce((sum, t) => sum + t.qty, 0);
      const qtyAtPt = Math.max(0, item.quantity - changeAfter);
      totalInvVal += qtyAtPt * item.costPrice;
    });

    // Sales in the selected range up to pt
    const salesTxs = transactionList.filter((t) => {
      const d = parseTxDate(t.date);
      return t.type === "Stock out" && d <= pt && d >= startDate;
    });
    const totalSalesVal = salesTxs.reduce((sum, t) => {
      const item = itemList.find((i) => i.itemName === t.item);
      const price = item ? item.sellingPrice : 50;
      return sum + Math.abs(t.qty) * price;
    }, 0);

    const label = diffDays <= 30
      ? pt.toLocaleDateString("en-US", { day: "numeric", month: "short" })
      : pt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    data.push({
      label,
      inv: totalInvVal,
      sales: totalSalesVal,
    });
  });

  return data;
}

// Calculate ABC classification dynamically
function calculateABC(itemList: Item[], filteredTransactions: Transaction[]) {
  const itemSales = itemList.map((item) => {
    const outs = filteredTransactions.filter((t) => t.item === item.itemName && t.type === "Stock out");
    const qtyOut = outs.reduce((sum, t) => sum + Math.abs(t.qty), 0);
    const value = qtyOut * item.sellingPrice;
    return {
      name: item.itemName,
      qtyOut,
      value: value || 0,
      item,
    };
  });

  // Sort descending by value
  itemSales.sort((a, b) => b.value - a.value);

  const totalValue = itemSales.reduce((sum, item) => sum + item.value, 0);

  let runningSum = 0;
  const classifiedItems = itemSales.map((item) => {
    if (totalValue > 0) {
      runningSum += item.value;
      const pct = (runningSum / totalValue) * 100;
      let cls: "A" | "B" | "C" = "C";
      if (pct <= 70) cls = "A";
      else if (pct <= 90) cls = "B";

      return {
        ...item,
        cls,
        size: Math.max(1, item.value),
      };
    } else {
      // Fallback: classify based on stock value if there are no sales in the period
      const stockVal = item.item.quantity * item.item.costPrice;
      return {
        ...item,
        cls: "C" as const,
        value: stockVal,
        size: Math.max(1, stockVal),
      };
    }
  });

  if (totalValue === 0) {
    classifiedItems.sort((a, b) => b.value - a.value);
    const totalStockVal = classifiedItems.reduce((sum, item) => sum + item.value, 0);
    let runningStockSum = 0;
    classifiedItems.forEach((item) => {
      if (totalStockVal > 0) {
        runningStockSum += item.value;
        const pct = (runningStockSum / totalStockVal) * 100;
        if (pct <= 70) item.cls = "A";
        else if (pct <= 90) item.cls = "B";
      }
    });
  }

  return classifiedItems;
}

// ── Report 1: Overall Summary ───────────────────────────────
function SummaryReport({ c, itemList, transactionList, filteredTransactions, startDate, endDate, isGeneratingPDF }: any) {
  const totalItemsQty = itemList.reduce((sum: number, i: any) => sum + i.quantity, 0);
  const totalCostWorth = itemList.reduce((sum: number, i: any) => sum + i.quantity * i.costPrice, 0);
  const totalSellingWorth = itemList.reduce((sum: number, i: any) => sum + i.quantity * i.sellingPrice, 0);

  const activeItemsCount = itemList.filter((i: any) => i.active).length;
  const inactiveItemsCount = itemList.length - activeItemsCount;

  const inTx = filteredTransactions.filter((t: any) => t.type === "Stock in").reduce((sum: number, t: any) => sum + Math.abs(t.qty), 0);
  const outTx = filteredTransactions.filter((t: any) => t.type === "Stock out").reduce((sum: number, t: any) => sum + Math.abs(t.qty), 0);
  const sellThru = (inTx + outTx) > 0 ? Math.round((outTx / (inTx + outTx)) * 100) : 0;

  const trendData = getDynamicTrendData(startDate, endDate, transactionList, itemList);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Section 1: Overall Stock Valuation (Static) */}
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <Stat c={c} label="Total Items in Stock" value={totalItemsQty.toLocaleString()} sub="Aggregate warehouse quantity" />
          <Stat c={c} label="Inventory Cost Worth" value={`Rs ${totalCostWorth.toLocaleString()}`} sub="At cost price valuation" color={c.accent} />
          <Stat c={c} label="Selling Value Worth" value={`Rs ${totalSellingWorth.toLocaleString()}`} sub="At retail price valuation" color="#3B6E5E" />
          <Stat c={c} label="Active Items" value={`${activeItemsCount} items`} sub={`${itemList.length ? Math.round((activeItemsCount / itemList.length) * 100) : 0}% of database`} color={c.accent} />
          <Stat c={c} label="Inactive Items" value={`${inactiveItemsCount} items`} sub={`${itemList.length ? Math.round((inactiveItemsCount / itemList.length) * 100) : 0}% of database`} color={c.danger} />
        </div>
      </div>

      {/* Styled divider text indicating range filter boundary */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          margin: "24px 0",
        }}
      >
        <div style={{ flex: 1, height: 1, background: c.border }} />
        <div
          style={{
            background: c.surfaceMuted,
            border: `1px solid ${c.border}`,
            padding: "8px 16px",
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 600,
            color: c.textMuted,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Calendar size={13} style={{ color: c.accent }} />
          <span>The metrics and charts below are affected only by the selected date range</span>
        </div>
        <div style={{ flex: 1, height: 1, background: c.border }} />
      </div>

      {/* Lower Section: Sell-Through KPI and Value Trend Chart */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {/* Separated Sell-Through card styled as a key performance indicator (KPI) */}
        <div style={{ flex: "1 1 280px" }}>
          <div
            style={{
              background: `linear-gradient(135deg, ${c.surface} 0%, ${c.surfaceMuted} 100%)`,
              border: `1px solid ${c.border}`,
              borderRadius: 16,
              padding: "24px 20px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.03)",
              boxSizing: "border-box",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: c.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                Sell-Through Rate
              </div>
              
              {/* Circular progress container */}
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", margin: "16px 0", position: "relative" }}>
                <svg width="110" height="110" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={c.border}
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={c.accent}
                    strokeWidth="8"
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (sellThru / 100) * 251.2}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: c.text, letterSpacing: "-0.02em" }}>{sellThru}%</span>
                  <span style={{ fontSize: 9, color: c.textFaint, fontWeight: 600 }}>SOLD</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderTop: `1px solid ${c.border}`, paddingTop: 14, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: c.textFaint, textTransform: "uppercase", fontWeight: 600 }}>Units In</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{inTx.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: c.textFaint, textTransform: "uppercase", fontWeight: 600 }}>Units Out</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{outTx.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: c.textMuted, lineHeight: 1.4 }}>
                Ratio of received inventory sold within the selected filter window.
              </div>
            </div>
          </div>
        </div>

        {/* Trend Chart (dynamically fits layout) */}
        <div style={{ flex: "3 1 500px" }}>
          <Card c={c} style={{ height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <Sect c={c} title="Inventory Value vs Sales Value — Trend" sub="Dynamic line analysis based on transactions over chosen time window" />
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.textFaint }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: c.textFaint }} tickLine={false} axisLine={false} tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `Rs ${v.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="inv" name="Inventory Worth (Cost)" stroke={c.accent} strokeWidth={2} dot={false} isAnimationActive={!isGeneratingPDF} />
                <Line type="monotone" dataKey="sales" name="Sales Revenue" stroke={c.warn} strokeWidth={2} dot={false} isAnimationActive={!isGeneratingPDF} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Report 2: Stock Alert Report ────────────────────────────
function LowStockReport({ c, itemList, transactionList, filteredTransactions, startDate, endDate, isGeneratingPDF }: any) {
  // Classify each active item by current stock level
  const getLevel = (item: any): "critical" | "low" | "ok" => {
    if (item.quantity === 0) return "critical";
    if (item.quantity <= item.reorderLevel) {
      const ratio = item.quantity / (item.reorderLevel || 1);
      return ratio < 0.25 ? "critical" : "low";
    }
    return "ok";
  };

  const activeItems = itemList.filter((i: any) => i.active);

  // Current alert counts
  const criticalItems = activeItems.filter((i: any) => getLevel(i) === "critical");
  const lowItems = activeItems.filter((i: any) => getLevel(i) === "low");

  // "Resolved" = items that were once below reorderLevel but are now above it.
  // We detect this by checking: did a Stock-in transaction in the range push an item ABOVE its reorder level?
  const resolvedCount = (() => {
    const resolved = new Set<string>();
    filteredTransactions.filter((t: any) => t.type === "Stock in").forEach((t: any) => {
      const item = itemList.find((i: any) => i.itemName === t.item);
      if (!item) return;
      // Before this tx the item was below reorder level
      if (t.prevQty <= item.reorderLevel && t.newQty > item.reorderLevel) {
        resolved.add(item.id);
      }
    });
    return resolved.size;
  })();

  // Estimated restock cost: shortfall × costPrice
  const estCritical = criticalItems.reduce((sum: number, i: any) => {
    const shortfall = Math.max(0, i.reorderQuantity);
    return sum + shortfall * i.costPrice;
  }, 0);
  const estLow = lowItems.reduce((sum: number, i: any) => {
    const shortfall = Math.max(0, i.reorderQuantity);
    return sum + shortfall * i.costPrice;
  }, 0);

  // ── Timeline chart data ──────────────────────────────────
  const diffDays = Math.max(1, Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  let points: Date[] = [];
  if (diffDays <= 15) {
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) points.push(new Date(d));
  } else {
    const step = Math.ceil(diffDays / 8);
    for (let i = 0; i < 8; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i * step);
      if (d <= endDate) points.push(d);
    }
    if (!points.length || points[points.length - 1].getTime() < endDate.getTime()) points.push(new Date(endDate));
  }

  const chartData = points.map((pt) => {
    // Count Stock-in transactions up to pt that resolved an alert (proxy for "alert created" = a stock-out that crossed below reorder)
    const critCount = transactionList.filter((t: any) => {
      const d = parseTxDate(t.date);
      if (d > pt || d < startDate) return false;
      if (t.type !== "Stock out") return false;
      const item = itemList.find((i: any) => i.itemName === t.item);
      if (!item) return false;
      const ratio = t.newQty / (item.reorderLevel || 1);
      return t.newQty === 0 || ratio < 0.25;
    }).length;

    const lowCount = transactionList.filter((t: any) => {
      const d = parseTxDate(t.date);
      if (d > pt || d < startDate) return false;
      if (t.type !== "Stock out") return false;
      const item = itemList.find((i: any) => i.itemName === t.item);
      if (!item) return false;
      const ratio = t.newQty / (item.reorderLevel || 1);
      return t.newQty > 0 && ratio >= 0.25 && t.newQty <= item.reorderLevel;
    }).length;

    const label = diffDays <= 30
      ? pt.toLocaleDateString("en-US", { day: "numeric", month: "short" })
      : pt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    return { label, critical: critCount, low: lowCount };
  });

  // ── Supplier breakdown table ─────────────────────────────
  const supplierMap: Record<string, { critical: number; low: number }> = {};
  activeItems.forEach((item: any) => {
    const lvl = getLevel(item);
    if (lvl === "ok") return;
    if (!supplierMap[item.supplier]) supplierMap[item.supplier] = { critical: 0, low: 0 };
    if (lvl === "critical") supplierMap[item.supplier].critical++;
    else supplierMap[item.supplier].low++;
  });
  const supplierRows = Object.entries(supplierMap)
    .map(([sup, v]) => ({ supplier: sup, critical: v.critical, low: v.low, total: v.critical + v.low }))
    .sort((a, b) => b.total - a.total);

  // ── MTTR approximation ────────────────────────────────────
  // For each stock-out that triggered an alert, find the next stock-in for the same item.
  const mttrData: { type: "critical" | "low"; hoursToResolve: number }[] = [];
  filteredTransactions.filter((t: any) => t.type === "Stock out").forEach((t: any) => {
    const item = itemList.find((i: any) => i.itemName === t.item);
    if (!item) return;
    const ratio = t.newQty / (item.reorderLevel || 1);
    const alertType: "critical" | "low" | null =
      t.newQty === 0 || ratio < 0.25 ? "critical" : t.newQty <= item.reorderLevel ? "low" : null;
    if (!alertType) return;
    const alertTime = parseTxDate(t.date);
    // Find next Stock-in for same item after this point
    const nextIn = transactionList
      .filter((tx: any) => tx.item === t.item && tx.type === "Stock in" && parseTxDate(tx.date) > alertTime)
      .sort((a: any, b: any) => parseTxDate(a.date).getTime() - parseTxDate(b.date).getTime())[0];
    if (nextIn) {
      const resolveTime = parseTxDate(nextIn.date);
      const hrs = (resolveTime.getTime() - alertTime.getTime()) / (1000 * 60 * 60);
      if (hrs > 0 && hrs < 8760) mttrData.push({ type: alertType, hoursToResolve: hrs });
    }
  });

  const critMTTR = mttrData.filter((x) => x.type === "critical");
  const lowMTTR = mttrData.filter((x) => x.type === "low");
  const avgCritHours = critMTTR.length ? critMTTR.reduce((s, x) => s + x.hoursToResolve, 0) / critMTTR.length : null;
  const avgLowHours = lowMTTR.length ? lowMTTR.reduce((s, x) => s + x.hoursToResolve, 0) / lowMTTR.length : null;

  const fmtHours = (h: number | null) => {
    if (h === null) return "N/A";
    if (h < 24) return `${Math.round(h)}h`;
    return `${Math.round(h / 24)}d ${Math.round(h % 24)}h`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── 1. Summary Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <Stat c={c} label="Critical Alerts" value={criticalItems.length} sub="Qty at 0 or below 25% reorder" color={c.danger} />
        <Stat c={c} label="Low Stock Alerts" value={lowItems.length} sub="Qty below reorder level" color={c.warn} />
        <Stat c={c} label="Alerts Resolved" value={resolvedCount} sub={`Stock-ins above reorder in period`} color={c.accent} />
        <Stat c={c} label="Est. Critical Restock" value={`Rs ${estCritical.toLocaleString()}`} sub="Based on reorder qty × cost" color={c.danger} />
        <Stat c={c} label="Est. Low Stock Restock" value={`Rs ${estLow.toLocaleString()}`} sub="Based on reorder qty × cost" color={c.warn} />
      </div>

      {/* ── 2. Date-range divider ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "8px 0" }}>
        <div style={{ flex: 1, height: 1, background: c.border }} />
        <div style={{
          background: c.surfaceMuted,
          border: `1px solid ${c.border}`,
          padding: "8px 16px",
          borderRadius: 99,
          fontSize: 12,
          fontWeight: 600,
          color: c.textMuted,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <Calendar size={13} style={{ color: c.accent }} />
          <span>The metrics and charts below are affected only by the selected date range</span>
        </div>
        <div style={{ flex: 1, height: 1, background: c.border }} />
      </div>

      {/* ── 3. Chart + Supplier Table ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {/* Left: Line Chart */}
        <div style={{ flex: "3 1 380px" }}>
          <Card c={c} style={{ height: "100%", boxSizing: "border-box" }}>
            <Sect c={c} title="Alerts Created Over Time" sub="Stock-out events that triggered Critical or Low alerts in the date range" />
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.textFaint }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: c.textFaint }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="critical" name="Critical Alerts" stroke={c.danger} strokeWidth={2} dot={false} isAnimationActive={!isGeneratingPDF} />
                <Line type="monotone" dataKey="low" name="Low Stock Alerts" stroke={c.warn} strokeWidth={2} dot={false} isAnimationActive={!isGeneratingPDF} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Right: Supplier Breakdown Table */}
        <div style={{ flex: "2 1 260px" }}>
          <Card c={c} style={{ height: "100%", boxSizing: "border-box" }}>
            <Sect c={c} title="Alerts by Supplier" sub="Current alerts grouped by supplier" />
            {supplierRows.length === 0 ? (
              <div style={{ fontSize: 13, color: c.textFaint, padding: "20px 0", textAlign: "center" }}>No active alerts</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: c.surfaceMuted }}>
                      {["Supplier", "Critical", "Low Stock", "Total"].map((h) => (
                        <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontWeight: 500, fontSize: 11, color: c.textFaint }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {supplierRows.map((row) => (
                      <tr key={row.supplier} style={{ borderTop: `1px solid ${c.border}` }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, fontSize: 12 }}>{row.supplier}</td>
                        <td style={{ padding: "8px 10px" }}>
                          {row.critical > 0 ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: c.dangerSoft, color: c.danger }}>{row.critical}</span>
                          ) : <span style={{ color: c.textFaint, fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {row.low > 0 ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: c.warnSoft, color: c.warn }}>{row.low}</span>
                          ) : <span style={{ color: c.textFaint, fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: "8px 10px", fontWeight: 700, color: c.text }}>{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── 4. MTTR Metrics ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 32, padding: "12px 4px" }}>
        {/* Critical MTTR */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, color: c.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Mean Time to Restock — Critical
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: c.danger, letterSpacing: "-0.02em" }}>
            {fmtHours(avgCritHours)}
          </div>
          <div style={{ fontSize: 12, color: c.textMuted }}>
            {critMTTR.length > 0 ? `Avg. across ${critMTTR.length} resolved critical alert${critMTTR.length > 1 ? "s" : ""}` : "No resolved critical alerts in this range"}
          </div>
        </div>

        <div style={{ width: 1, background: c.border, alignSelf: "stretch" }} />

        {/* Low Stock MTTR */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, color: c.textFaint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Mean Time to Restock — Low Stock
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: c.warn, letterSpacing: "-0.02em" }}>
            {fmtHours(avgLowHours)}
          </div>
          <div style={{ fontSize: 12, color: c.textMuted }}>
            {lowMTTR.length > 0 ? `Avg. across ${lowMTTR.length} resolved low stock alert${lowMTTR.length > 1 ? "s" : ""}` : "No resolved low stock alerts in this range"}
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Report 3: Transaction Report ────────────────────────────
function TransactionReport({ c, filteredTransactions, startDate, endDate, isGeneratingPDF }: any) {
  const inCount = filteredTransactions.filter((t: any) => t.type === "Stock in").length;
  const outCount = filteredTransactions.filter((t: any) => t.type === "Stock out").length;
  const total = inCount + outCount;

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const diffDays = Math.ceil(Math.abs(endMs - startMs) / (1000 * 60 * 60 * 24));

  let chartData: { label: string; in: number; out: number }[] = [];

  if (diffDays <= 15) {
    // Group by day
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
      const txsOnDay = filteredTransactions.filter((t: any) => {
        const txD = parseTxDate(t.date);
        return txD.getDate() === d.getDate() && txD.getMonth() === d.getMonth() && txD.getFullYear() === d.getFullYear();
      });
      const ins = txsOnDay.filter((t: any) => t.type === "Stock in").reduce((sum: number, t: any) => sum + Math.abs(t.qty), 0);
      const outs = txsOnDay.filter((t: any) => t.type === "Stock out").reduce((sum: number, t: any) => sum + Math.abs(t.qty), 0);
      chartData.push({ label: dateStr, in: ins, out: outs });
    }
  } else {
    // Group by month
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const d = new Date(startDate);
    d.setDate(1);
    const monthsInRange: { month: number; year: number; label: string }[] = [];
    while (d <= endDate) {
      monthsInRange.push({ month: d.getMonth(), year: d.getFullYear(), label: `${months[d.getMonth()]} ${String(d.getFullYear()).substring(2)}` });
      d.setMonth(d.getMonth() + 1);
    }
    const lastMonth = monthsInRange[monthsInRange.length - 1];
    if (!lastMonth || lastMonth.month !== endDate.getMonth() || lastMonth.year !== endDate.getFullYear()) {
      monthsInRange.push({ month: endDate.getMonth(), year: endDate.getFullYear(), label: `${months[endDate.getMonth()]} ${String(endDate.getFullYear()).substring(2)}` });
    }

    chartData = monthsInRange.map((m) => {
      const txsInMonth = filteredTransactions.filter((t: any) => {
        const txD = parseTxDate(t.date);
        return txD.getMonth() === m.month && txD.getFullYear() === m.year;
      });
      const ins = txsInMonth.filter((t: any) => t.type === "Stock in").reduce((sum: number, t: any) => sum + Math.abs(t.qty), 0);
      const outs = txsInMonth.filter((t: any) => t.type === "Stock out").reduce((sum: number, t: any) => sum + Math.abs(t.qty), 0);
      return { label: m.label, in: ins, out: outs };
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Stat c={c} label="Stock-In Transactions" value={inCount} sub={`${total ? Math.round((inCount / total) * 100) : 0}% of period total`} color={c.accent} />
        <Stat c={c} label="Stock-Out Transactions" value={outCount} sub={`${total ? Math.round((outCount / total) * 100) : 0}% of period total`} color={c.danger} />
        <Stat c={c} label="Total Transactions" value={total} sub="Recorded during filter window" />
      </div>
      <Card c={c}>
        <Sect c={c} title="Stock In vs Out Quantity — Trend" sub="Transacted quantities during period" />
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.textFaint }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: c.textFaint }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="in" name="Units In" fill={c.accent} radius={[4, 4, 0, 0]} barSize={12} isAnimationActive={!isGeneratingPDF} />
            <Bar dataKey="out" name="Units Out" fill={c.danger} radius={[4, 4, 0, 0]} barSize={12} isAnimationActive={!isGeneratingPDF} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ── Report 4: Stock Velocity ────────────────────────────────
function VelocityReport({ c, itemList, filteredTransactions }: any) {
  const abc = calculateABC(itemList, filteredTransactions);
  const classA = abc.filter((i) => i.cls === "A");
  const classB = abc.filter((i) => i.cls === "B");
  const classC = abc.filter((i) => i.cls === "C");

  const deadStockValue = classC.reduce((sum, i) => sum + i.item.quantity * i.item.costPrice, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Stat c={c} label="Class A Items (Fast)" value={classA.length} sub="High sales volume/revenue" color={c.accent} />
        <Stat c={c} label="Class B Items (Medium)" value={classB.length} sub="Moderate transaction levels" color={c.warn} />
        <Stat c={c} label="Class C / Slow Stock" value={classC.length} sub={`Rs ${deadStockValue.toLocaleString()} asset value`} color={c.danger} />
      </div>

      <Card c={c}>
        <Sect c={c} title="ABC Analysis — Treemap representation" sub="Area represents sales volume value (fallback to stock asset value if no sales in window)" />
        <ResponsiveContainer width="100%" height={260}>
          <Treemap data={abc} dataKey="size" aspectRatio={4 / 2} stroke={c.bg}
            content={({ x, y, width, height, name, cls }: any) => (
              <g>
                <rect x={x} y={y} width={width} height={height} fill={clsColor[cls] || c.accent} rx={4} />
                {width > 60 && height > 30 && (
                  <>
                    <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={600}>{name.length > 15 ? name.substring(0, 15) + "..." : name}</text>
                    <text x={x + 8} y={y + 32} fill="rgba(255,255,255,0.7)" fontSize={10}>Class {cls}</text>
                  </>
                )}
              </g>
            )} />
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
          {["A", "B", "C"].map((cls) => (
            <div key={cls} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: clsColor[cls] }} />
              <span style={{ color: c.textMuted }}>Class {cls} — {cls === "A" ? "Fast-moving" : cls === "B" ? "Medium" : "Slow / Dead"}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card c={c}>
        <Sect c={c} title="Slow-Moving & Dead Stock Alert" sub="Class C listings with low velocity in period" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 500 }}>
            <thead>
              <tr style={{ background: c.surfaceMuted }}>
                {["Item Name", "Class", "Current Stock Qty", "Stock Value (Cost)", "Units Sold"].map((h) => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 500, fontSize: 11, color: c.textFaint }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classC.slice(0, 10).map((item) => (
                <tr key={item.name} style={{ borderTop: `1px solid ${c.border}` }}>
                  <td style={{ padding: "9px 14px", fontWeight: 600 }}>{item.name}</td>
                  <td style={{ padding: "9px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: c.dangerSoft, color: c.danger }}>Class C</span>
                  </td>
                  <td style={{ padding: "9px 14px", color: c.text }}>{item.item.quantity} {item.item.unit}</td>
                  <td style={{ padding: "9px 14px", color: c.danger, fontWeight: 600 }}>Rs {(item.item.quantity * item.item.costPrice).toLocaleString()}</td>
                  <td style={{ padding: "9px 14px", color: c.textMuted }}>{item.qtyOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Report 5: Category Report ───────────────────────────────
function CategoryReport({ c, categoryList, itemList, isGeneratingPDF }: any) {
  const catData = categoryList.map((cat: any) => {
    const catItems = itemList.filter((i: any) => i.category === cat.name);
    const value = catItems.reduce((sum: number, i: any) => sum + i.quantity * i.costPrice, 0);

    let totalMargin = 0;
    let itemsWithMargin = 0;
    catItems.forEach((i: any) => {
      if (i.sellingPrice > 0) {
        totalMargin += ((i.sellingPrice - i.costPrice) / i.sellingPrice) * 100;
        itemsWithMargin++;
      }
    });
    const avgMargin = itemsWithMargin > 0 ? Math.round(totalMargin / itemsWithMargin) : 0;

    const totalQty = itemList.reduce((sum: number, i: any) => sum + i.quantity, 0);
    const catQty = catItems.reduce((sum: number, i: any) => sum + i.quantity, 0);
    const spacePct = totalQty > 0 ? Math.round((catQty / totalQty) * 100) : 0;

    return {
      name: cat.name,
      value,
      margin: avgMargin,
      space: spacePct,
    };
  }).filter((cat: any) => cat.value > 0 || cat.space > 0);

  const COLORS = ["#3B6E5E", "#6FAE97", "#A6792F", "#B3473C", "#73705F", "#9A988F", "#4C5B5C", "#8B9D8A", "#D3A297", "#E4C5AF"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <Card c={c}>
          <Sect c={c} title="Contribution Margin by Category" sub="Average markup percentage per category" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={catData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <CartesianGrid stroke={c.border} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: c.textFaint }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: c.textMuted }} axisLine={false} tickLine={false} width={100} />
              <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `${v}%`} />
              <Bar dataKey="margin" name="Margin %" radius={[0, 5, 5, 0]} barSize={14} isAnimationActive={!isGeneratingPDF}>
                {catData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card c={c}>
          <Sect c={c} title="Warehouse Space occupied by Category" sub="Share of items in warehouse inventory" />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={catData} dataKey="space" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ payload }: any) => `${payload?.space}%`} labelLine={false} isAnimationActive={!isGeneratingPDF}>
                {catData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, justifyContent: "center" }}>
            {catData.map((d: any, i: number) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: c.textMuted }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                {d.name} ({d.space}%)
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card c={c}>
        <Sect c={c} title="Category Value Overview" sub="Valuations and asset details" />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: c.surfaceMuted }}>
                {["Category", "Stock Value (Cost)", "Avg Margin %", "Warehouse Share %"].map((h) => (
                  <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 500, fontSize: 11, color: c.textFaint }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catData.map((d: any, i: number) => (
                <tr key={d.name} style={{ borderTop: `1px solid ${c.border}` }}>
                  <td style={{ padding: "9px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                    <span style={{ fontWeight: 600 }}>{d.name}</span>
                  </td>
                  <td style={{ padding: "9px 14px", color: c.accent, fontWeight: 600 }}>Rs {d.value.toLocaleString()}</td>
                  <td style={{ padding: "9px 14px", color: c.textMuted }}>{d.margin}%</td>
                  <td style={{ padding: "9px 14px", color: c.textMuted }}>{d.space}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Report 6: Supplier Report ───────────────────────────────
function SupplierReport({ c, supplierList, itemList, filteredTransactions, isGeneratingPDF }: any) {
  const active = supplierList.filter((s: any) => s.active).length;
  const inactive = supplierList.length - active;

  const supplierSupplies = supplierList.map((sup: any) => {
    const supItems = itemList.filter((i: any) => i.supplier === sup.supplierName).map((i: any) => i.itemName);
    const stockInTxs = filteredTransactions.filter((t: any) => t.type === "Stock in" && supItems.includes(t.item));
    const totalQtyIn = stockInTxs.reduce((sum: number, t: any) => sum + Math.abs(t.qty), 0);

    return {
      ...sup,
      suppliesInPeriod: totalQtyIn,
    };
  });

  const hasSupplies = supplierSupplies.some((s: any) => s.suppliesInPeriod > 0);
  const sortedSuppliers = [...supplierSupplies].sort((a: any, b: any) => {
    if (hasSupplies) {
      return b.suppliesInPeriod - a.suppliesInPeriod;
    }
    return b.totalSupplies - a.totalSupplies;
  });

  const top10 = sortedSuppliers.slice(0, 10);

  const pieData = [
    { name: "Active", value: active, color: c.accent },
    { name: "Inactive", value: inactive, color: c.danger },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <Card c={c}>
          <Sect c={c} title="Top Suppliers Ranks" sub={hasSupplies ? "By supply volume (units received) in chosen range" : "By lifetime historical supplies"} />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: c.surfaceMuted }}>
                  {["#", "Supplier", "Volume (Units)", "Status"].map((h) => (
                    <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontWeight: 500, fontSize: 11, color: c.textFaint }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {top10.map((s: any, i: number) => (
                  <tr key={s.id} style={{ borderTop: `1px solid ${c.border}` }}>
                    <td style={{ padding: "8px 12px", color: c.textFaint, fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>{s.supplierName}</td>
                    <td style={{ padding: "8px 12px", color: c.accent, fontWeight: 600 }}>
                      {hasSupplies ? s.suppliesInPeriod.toLocaleString() : s.totalSupplies.toLocaleString()}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: s.active ? c.accentSoft : c.dangerSoft, color: s.active ? c.accent : c.danger }}>{s.active ? "Active" : "Inactive"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card c={c}>
          <Sect c={c} title="Active vs Inactive Suppliers" sub={`${supplierList.length} total suppliers database`} />
          <div style={{ display: "flex", justifyContent: "center" }}>
            <PieChart width={200} height={200}>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={80} isAnimationActive={!isGeneratingPDF}>
                {pieData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 8 }}>
            {pieData.map((d: any) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color }} />
                <span style={{ color: c.textMuted }}>{d.name}</span>
                <span style={{ fontWeight: 700, color: c.text }}>{d.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function ReportsPage() {
  const { c } = useTheme();
  const { setHeaderActions, transactionList, itemList, categoryList, supplierList } = useData();
  const [activeReport, setActiveReport] = useState("summary");
  const [dropOpen, setDropOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Date picker states
  const [startDateStr, setStartDateStr] = useState<string>("");
  const [endDateStr, setEndDateStr] = useState<string>("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set default range: 30 days ago to today
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    setStartDateStr(formatDateToISO(start));
    setEndDateStr(formatDateToISO(end));
  }, []);

  // Compute startDate & endDate objects
  const startDate = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
  const endDate = endDateStr ? new Date(endDateStr + "T23:59:59") : new Date();
  const diffDays = Math.max(1, Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Filter transactions dynamically
  const filteredTransactions = transactionList.filter((t) => {
    const txDate = parseTxDate(t.date);
    return txDate >= startDate && txDate <= endDate;
  });

  const checkPresetActive = (preset: any) => {
    const todayStr = formatDateToISO(new Date());
    if (preset.days === 7) {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return startDateStr === formatDateToISO(start) && endDateStr === todayStr;
    }
    if (preset.days === 30) {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return startDateStr === formatDateToISO(start) && endDateStr === todayStr;
    }
    if (preset.type === "this-month") {
      const start = new Date();
      start.setDate(1);
      return startDateStr === formatDateToISO(start) && endDateStr === todayStr;
    }
    if (preset.type === "ytd") {
      const start = new Date(new Date().getFullYear(), 0, 1);
      return startDateStr === formatDateToISO(start) && endDateStr === todayStr;
    }
    return false;
  };

  const applyPreset = (preset: any) => {
    const today = new Date();
    if (preset.days) {
      const start = new Date();
      start.setDate(today.getDate() - preset.days);
      setStartDateStr(formatDateToISO(start));
      setEndDateStr(formatDateToISO(today));
    } else if (preset.type === "this-month") {
      const start = new Date();
      start.setDate(1);
      setStartDateStr(formatDateToISO(start));
      setEndDateStr(formatDateToISO(today));
    } else if (preset.type === "ytd") {
      const start = new Date(today.getFullYear(), 0, 1);
      setStartDateStr(formatDateToISO(start));
      setEndDateStr(formatDateToISO(today));
    }
  };

  const handleGenerateReport = useCallback(async () => {
    setIsGeneratingPDF(true);

    // Give React time to render the PDF-specific header
    setTimeout(async () => {
      try {
        const element = document.getElementById("report-capture-area");
        if (!element) {
          alert("Report element not found");
          setIsGeneratingPDF(false);
          return;
        }

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: c.bg,
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "pt", "a4");
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;
        
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        
        const reportTitle = REPORT_TYPES.find((r) => r.id === activeReport)?.label || "Report";
        const filename = `HOMEREX_${reportTitle.replace(/\s+/g, "_")}_${startDateStr}_to_${endDateStr}.pdf`;
        pdf.save(filename);
      } catch (error) {
        console.error("Failed to generate PDF:", error);
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 250);
  }, [activeReport, startDateStr, endDateStr, c]);

  useEffect(() => {
    if (!mounted) return;
    const curr = REPORT_TYPES.find((r) => r.id === activeReport);
    setHeaderActions(
      <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }} className="no-print">
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setDropOpen((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${c.border}`,
              background: c.surface,
              color: c.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {curr?.label} <ChevronDown size={14} />
          </button>
          {dropOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: c.surface,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                minWidth: 200,
                zIndex: 200,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                overflow: "hidden",
              }}
            >
              {REPORT_TYPES.map((r) => (
                <div
                  key={r.id}
                  onClick={() => {
                    setActiveReport(r.id);
                    setDropOpen(false);
                  }}
                  style={{
                    padding: "10px 14px",
                    fontSize: 13,
                    cursor: "pointer",
                    background: r.id === activeReport ? c.accentSoft : "transparent",
                    color: r.id === activeReport ? c.accent : c.text,
                    fontWeight: r.id === activeReport ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (r.id !== activeReport) e.currentTarget.style.background = c.surfaceMuted;
                  }}
                  onMouseLeave={(e) => {
                    if (r.id !== activeReport) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {r.label}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={isGeneratingPDF}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: isGeneratingPDF ? c.surfaceMuted : c.accent,
            color: isGeneratingPDF ? c.textMuted : "#fff",
            border: "none",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: isGeneratingPDF ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            opacity: isGeneratingPDF ? 0.7 : 1,
            transition: "all 0.15s ease",
          }}
        >
          <FileDown size={14} /> {isGeneratingPDF ? "Generating PDF..." : "Generate Report"}
        </button>
      </div>
    );
    return () => setHeaderActions(null);
  }, [c, activeReport, dropOpen, setHeaderActions, mounted, isGeneratingPDF, handleGenerateReport]);

  if (!mounted) return null;

  const exceedsMaxLimit = diffDays > 366;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Dynamic styling for clean print layout and animations */}
      <style>{`
        @media print {
          aside, header, nav, button, input, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          body {
            background: #fff !important;
            color: #000 !important;
          }
        }
        @keyframes slideIn {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Date Range Picker Filter Panel — placed at the top of workspace */}
      <div
        className="no-print"
        style={{
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 14,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          {/* Left Side: Inputs */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: c.textMuted }}>
              <Calendar size={16} style={{ color: c.accent }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Filter Period:</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: `1px solid ${exceedsMaxLimit ? c.danger : c.border}`,
                  background: c.inputBg,
                  color: c.text,
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s ease",
                }}
              />
              <span style={{ color: c.textFaint, fontSize: 12 }}>to</span>
              <input
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: `1px solid ${exceedsMaxLimit ? c.danger : c.border}`,
                  background: c.inputBg,
                  color: c.text,
                  fontSize: 13,
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s ease",
                }}
              />
            </div>
          </div>

          {/* Right Side: Presets */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {[
              { label: "Last 7 Days", days: 7 },
              { label: "Last 30 Days", days: 30 },
              { label: "This Month", type: "this-month" },
              { label: "Year to Date", type: "ytd" },
            ].map((preset) => {
              const isActive = checkPresetActive(preset);
              return (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${isActive ? c.accent : c.border}`,
                    background: isActive ? c.accentSoft : "transparent",
                    color: isActive ? c.accent : c.textMuted,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = c.surfaceMuted;
                      e.currentTarget.style.color = c.text;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = c.textMuted;
                    }
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: c.textMuted, borderTop: `1px solid ${c.border}`, paddingTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={12} style={{ color: c.textFaint }} />
            <span>Showing data for <strong style={{ color: exceedsMaxLimit ? c.danger : "inherit" }}>{diffDays} days</strong></span>
          </div>
          <div>
            {exceedsMaxLimit ? (
              <span style={{ color: c.danger, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                ⚠️ Range exceeds maximum of 12 months (366 days)
              </span>
            ) : (
              <span><strong>{filteredTransactions.length} transactions</strong> filtered</span>
            )}
          </div>
        </div>
      </div>

      {/* Selected Report Workspace Content */}
      <div 
        id="report-capture-area" 
        style={{ 
          flex: 1, 
          padding: isGeneratingPDF ? "32px" : "0", 
          background: isGeneratingPDF ? c.bg : "transparent",
          borderRadius: isGeneratingPDF ? "16px" : "0"
        }}
      >
        {/* PDF Header - Visible only during PDF Generation */}
        {isGeneratingPDF && (
          <div
            style={{
              marginBottom: 28,
              borderBottom: `2px solid ${c.accent}`,
              paddingBottom: 20,
              fontFamily: "inherit",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: c.accent, letterSpacing: "-0.03em" }}>HOMEREX</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: c.textMuted, letterSpacing: "0.1em" }}>INVENTORY REPORT</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: c.textMuted }}>
              <div>
                <strong>Report Type:</strong> {REPORT_TYPES.find((r) => r.id === activeReport)?.label}
              </div>
              <div>
                <strong>Date Range:</strong> {startDate.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' })} to {endDate.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
            <div style={{ fontSize: 11, color: c.textFaint, marginTop: 8 }}>
              Generated on {new Date().toLocaleString()}
            </div>
          </div>
        )}

        {activeReport === "summary" && (
          <SummaryReport
            c={c}
            itemList={itemList}
            transactionList={transactionList}
            filteredTransactions={filteredTransactions}
            startDate={startDate}
            endDate={endDate}
            isGeneratingPDF={isGeneratingPDF}
          />
        )}
        {activeReport === "lowstock" && (
          <LowStockReport
            c={c}
            itemList={itemList}
            transactionList={transactionList}
            filteredTransactions={filteredTransactions}
            startDate={startDate}
            endDate={endDate}
            isGeneratingPDF={isGeneratingPDF}
          />
        )}
        {activeReport === "transactions" && (
          <TransactionReport
            c={c}
            filteredTransactions={filteredTransactions}
            startDate={startDate}
            endDate={endDate}
            isGeneratingPDF={isGeneratingPDF}
          />
        )}
        {activeReport === "velocity" && (
          <VelocityReport
            c={c}
            itemList={itemList}
            filteredTransactions={filteredTransactions}
          />
        )}
        {activeReport === "category" && (
          <CategoryReport
            c={c}
            categoryList={categoryList}
            itemList={itemList}
            isGeneratingPDF={isGeneratingPDF}
          />
        )}
        {activeReport === "supplier" && (
          <SupplierReport
            c={c}
            supplierList={supplierList}
            itemList={itemList}
            filteredTransactions={filteredTransactions}
            isGeneratingPDF={isGeneratingPDF}
          />
        )}
      </div>

      {/* Floating Warning Message at bottom right if date range exceeds 366 days */}
      {exceedsMaxLimit && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: c.danger,
          color: "#fff",
          padding: "14px 20px",
          borderRadius: 12,
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          zIndex: 9999,
          fontSize: 13,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: `1px solid rgba(255,255,255,0.1)`,
          animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>Date range exceeds the maximum limit of 12 months (366 days).</span>
        </div>
      )}
    </div>
  );
}
