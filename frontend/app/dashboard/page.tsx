"use client";

import React, { useState, useEffect } from "react";
import {
  Boxes,
  AlertTriangle,
  ClipboardList,
  Wallet
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTheme } from "./ThemeContext";
import { useData } from "./DataContext";

// ── Stat card ──────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  tone?: string;
  c: any;
}
function StatCard({ label, value, sub, icon: Icon, tone, c }: StatCardProps) {
  const bg =
    tone === "danger"
      ? c.dangerSoft
      : tone === "warn"
        ? c.warnSoft
        : c.accentSoft;
  const fg = tone === "danger" ? c.danger : tone === "warn" ? c.warn : c.accent;
  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 13, color: c.textMuted, fontWeight: 500 }}>
          {label}
        </span>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: bg,
            color: fg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: c.text,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12.5, color: c.textFaint }}>{sub}</div>}
    </div>
  );
}

function parseTxDate(dateStr: string): Date {
  const now = new Date();
  const d = new Date(now);

  if (!dateStr) return d;

  if (dateStr.startsWith("Today")) {
    return d;
  }

  if (dateStr.startsWith("Yesterday")) {
    d.setDate(d.getDate() - 1);
    return d;
  }

  const parts = dateStr.split(" ");
  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10);
    const monthName = parts[1];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = months.indexOf(monthName);

    if (monthIndex !== -1) {
      d.setMonth(monthIndex);
      d.setDate(day);
      return d;
    }
  }

  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return d;
}

export default function DashboardOverview() {
  const { c } = useTheme();
  const { transactionList, userList, supplierList, itemList } = useData();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const recentTxs = transactionList.slice(0, 5);

  // Dynamic calculations for StatCards
  const totalStockQty = itemList.reduce((acc, item) => acc + item.quantity, 0);
  const totalStockValue = itemList.reduce((acc, item) => acc + item.quantity * item.costPrice, 0);

  const activeAlertsCount = itemList.filter(item => item.active && item.quantity <= item.reorderLevel).length;
  const outOfStockCount = itemList.filter(item => item.active && item.quantity === 0).length;
  const lowStockCount = activeAlertsCount - outOfStockCount;

  const stockOuts = transactionList.filter(t => t.type === "Stock out" || t.qty < 0);
  const totalSoldUnits = stockOuts.reduce((acc, t) => acc + Math.abs(t.qty), 0);
  const distinctSKUs = new Set(stockOuts.map(t => t.item)).size;
  const totalSoldValue = stockOuts.reduce((acc, t) => {
    const item = itemList.find(i => i.itemName === t.item);
    const price = item ? item.sellingPrice : 0;
    return acc + Math.abs(t.qty) * price;
  }, 0);

  // Dynamically calculate top items from transactionList (Stock out)
  const topItems = React.useMemo(() => {
    const counts: Record<string, number> = {};
    transactionList.forEach((t) => {
      if (t.type === "Stock out" || t.qty < 0) {
        const qty = Math.abs(t.qty);
        counts[t.item] = (counts[t.item] || 0) + qty;
      }
    });
    return Object.entries(counts)
      .map(([name, units]) => ({ name, units }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);
  }, [transactionList]);

  // Dynamically calculate sales trend for last 7 days
  const salesTrend = React.useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        day: days[d.getDay()],
        dateStr: d.toDateString(),
        value: 0,
      };
    });

    transactionList.forEach((t) => {
      if (t.type === "Stock out" || t.qty < 0) {
        const txDate = parseTxDate(t.date);
        const item = itemList.find((i) => i.itemName === t.item);
        const price = item ? item.sellingPrice : 0;
        const val = Math.abs(t.qty) * price;

        const match = result.find((r) => new Date(r.dateStr).toDateString() === txDate.toDateString());
        if (match) {
          match.value += val;
        }
      }
    });

    return result.map(({ day, value }) => ({ day, value }));
  }, [transactionList, itemList]);

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "1fr"
            : "repeat(2, 1fr) 1.2fr 1.2fr",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <StatCard
          c={c}
          label="Items in stock"
          value={totalStockQty.toLocaleString()}
          sub={`Rs ${totalStockValue.toLocaleString()} value`}
          icon={Boxes}
          tone="accent"
        />
        <StatCard
          c={c}
          label="Active alerts"
          value={activeAlertsCount.toString()}
          sub={`${lowStockCount} low stock · ${outOfStockCount} out of stock`}
          icon={AlertTriangle}
          tone="warn"
        />
        <StatCard
          c={c}
          label="Draft POs"
          value="0"
          sub="Awaiting approval"
          icon={ClipboardList}
          tone="accent"
        />
        <StatCard
          c={c}
          label="Sold value (month)"
          value={`Rs ${totalSoldValue.toLocaleString()}`}
          sub={`${totalSoldUnits} units across ${distinctSKUs} items`}
          icon={Wallet}
          tone="accent"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Sales trend</span>
            <span style={{ fontSize: 12, color: c.textFaint }}>Last 7 days</span>
          </div>
          <div style={{ height: 200 }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={salesTrend}
                  margin={{ left: -18, right: 8, top: 6, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="sf" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={c.accent}
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="100%"
                        stopColor={c.accent}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke={c.border}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: c.textFaint }}
                    axisLine={{ stroke: c.border }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: c.textFaint }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip
                    contentStyle={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={c.accent}
                    strokeWidth={2}
                    fill="url(#sf)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div
          style={{
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            Most sold items
          </div>
          <div style={{ height: 200 }}>
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topItems}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke={c.border}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: c.textFaint }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11.5, fill: c.textMuted }}
                    axisLine={false}
                    tickLine={false}
                    width={92}
                  />
                  <Tooltip
                    contentStyle={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    cursor={{ fill: c.surfaceMuted }}
                  />
                  <Bar
                    dataKey="units"
                    fill={c.accent}
                    radius={[0, 5, 5, 0]}
                    barSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px 10px",
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          Last 5 transactions
        </div>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              minWidth: 500,
            }}
          >
            <thead>
              <tr
                style={{
                  color: c.textFaint,
                  textAlign: "left",
                  background: c.surfaceMuted,
                }}
              >
                {["ID", "Item", "Type", "Qty", "User", "When"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 20px",
                      fontWeight: 500,
                      fontSize: 11.5,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentTxs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: c.textFaint,
                    }}
                  >
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : (
                recentTxs.map((t) => (
                  <tr
                    key={t.id}
                    style={{ borderTop: `1px solid ${c.border}` }}
                  >
                    <td
                      style={{
                        padding: "10px 20px",
                        color: c.textFaint,
                      }}
                    >
                      {t.id}
                    </td>
                    <td style={{ padding: "10px 20px", fontWeight: 500 }}>
                      {t.item}
                    </td>
                    <td style={{ padding: "10px 20px" }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: "3px 9px",
                          borderRadius: 999,
                          background:
                            t.type === "Stock in"
                              ? c.accentSoft
                              : c.dangerSoft,
                          color:
                            t.type === "Stock in"
                              ? c.accent
                              : c.danger,
                        }}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 20px",
                        color: t.qty < 0 ? c.danger : c.accent,
                        fontWeight: 600,
                      }}
                    >
                      {t.qty > 0 ? `+${t.qty}` : t.qty}
                    </td>
                    <td
                      style={{
                        padding: "10px 20px",
                        color: c.textMuted,
                      }}
                    >
                      {t.user}
                    </td>
                    <td
                      style={{
                        padding: "10px 20px",
                        color: c.textFaint,
                      }}
                    >
                      {t.date}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
