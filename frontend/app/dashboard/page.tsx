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
import { showDraftPOCard, showActiveAlertsCard } from "@/lib/roles";

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
  const { loggedInUser, dashboardData, dashboardLoading, fetchDashboard } = useData();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Role-based card visibility
  const role = loggedInUser?.role ?? "Admin";
  const showDraftPO = showDraftPOCard(role);
  const showAlerts = showActiveAlertsCard(role);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    // Fetch dashboard data (instant cache load + background API revalidation)
    fetchDashboard(true);
    return () => window.removeEventListener("resize", handleResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Map API response to display values ──────────────────
  const totalStockQty = dashboardData?.items_in_stock ?? 0;
  const totalStockValue = dashboardData?.value_of_item_in_stock ?? "0.00";

  const activeAlertsCount = dashboardData?.active_alerts ?? 0;
  const lowStockCount = dashboardData?.active_low_stock_alerts ?? 0;
  const outOfStockCount = dashboardData?.active_out_of_stock_alerts ?? 0;

  const draftPoCount = dashboardData?.draft_po_count ?? 0;
  const soldValue = dashboardData?.sold_value ?? "0.00";

  // Sales trend: API returns 7 formatted strings (oldest→newest), label with day names
  const salesTrend = React.useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (dashboardData?.sales_trend ?? Array(7).fill("0.00")).map((val, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        day: days[d.getDay()],
        value: parseFloat(val.replace(/,/g, "")),
      };
    });
  }, [dashboardData]);

  // Most sold items: API returns [{ name, quantity_sold }]
  const topItems = React.useMemo(() => {
    return (dashboardData?.most_sold_items ?? []).map((item) => ({
      name: item.name,
      units: item.quantity_sold,
    }));
  }, [dashboardData]);

  // Recent transactions from API
  const recentTxs = dashboardData?.recent_transaction ?? [];

  // ── Loading skeleton helper ──────────────────────────────
  const Skeleton = ({ w = "100%", h = 20 }: { w?: string | number; h?: number }) => (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        background: `linear-gradient(90deg, ${c.border} 25%, ${c.surfaceMuted ?? c.border} 50%, ${c.border} 75%)`,
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );


  return (
    <div>
      {/* Shimmer keyframes injected once */}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* Stat Cards — shown based on role */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "1fr"
            : `repeat(${2 + (showAlerts ? 1 : 0) + (showDraftPO ? 1 : 0)}, 1fr)`,
          gap: 14,
          marginBottom: 22,
        }}
      >
        <StatCard
          c={c}
          label="Items in stock"
          value={dashboardLoading ? "—" : totalStockQty.toLocaleString()}
          sub={dashboardLoading ? "Loading..." : `Rs ${totalStockValue} value`}
          icon={Boxes}
          tone="accent"
        />
        {showAlerts && (
          <StatCard
            c={c}
            label="Active alerts"
            value={dashboardLoading ? "—" : activeAlertsCount.toString()}
            sub={dashboardLoading ? "Loading..." : `${lowStockCount} low stock · ${outOfStockCount} out of stock`}
            icon={AlertTriangle}
            tone="warn"
          />
        )}
        {showDraftPO && (
          <StatCard
            c={c}
            label="Draft POs"
            value={dashboardLoading ? "—" : draftPoCount.toString()}
            sub="Awaiting approval"
            icon={ClipboardList}
            tone="accent"
          />
        )}
        <StatCard
          c={c}
          label="Sold value (This Month)"
          value={dashboardLoading ? "—" : `Rs ${soldValue}`}
          sub={(() => {
            const now = new Date();
            const monthName = now.toLocaleString("en-US", { month: "long" });
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            return `From ${monthName} 1 to ${monthName} ${lastDay}`;
          })()}
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
                    width={52}
                    tickFormatter={(v: number) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1_000
                          ? `${(v / 1_000).toFixed(1)}K`
                          : `${v}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value) => [
                      `Rs ${(+(value ?? 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      "Sales",
                    ]}
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
                  margin={{ left: 4, right: 16, top: 0, bottom: 0 }}
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
                    axisLine={false}
                    tickLine={false}
                    width={140}
                    tick={(props: any) => {
                      const { x, y, payload } = props;
                      const maxChars = 18;
                      const label =
                        payload.value.length > maxChars
                          ? payload.value.slice(0, maxChars - 1) + "…"
                          : payload.value;
                      return (
                        <text
                          x={x}
                          y={y}
                          dy={4}
                          textAnchor="end"
                          fill={c.textMuted}
                          fontSize={11.5}
                        >
                          {label}
                        </text>
                      );
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    cursor={{ fill: c.surfaceMuted }}
                    formatter={(value, _name, props) => [
                      `${+(value ?? 0)} units`,
                      (props as any)?.payload?.name ?? "",
                    ]}
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
                {["Item", "Type", "Qty", "User", "When"].map((h) => (
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
              {dashboardLoading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 20 }}>
                    <Skeleton h={14} />
                  </td>
                </tr>
              ) : recentTxs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
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
                    key={t.transaction_id}
                    style={{ borderTop: `1px solid ${c.border}` }}
                  >
                    <td style={{ padding: "10px 20px", fontWeight: 500 }}>
                      {t.item_name}
                    </td>
                    <td style={{ padding: "10px 20px" }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: "3px 9px",
                          borderRadius: 999,
                          background:
                            t.transaction_type === "STOCK_IN"
                              ? c.accentSoft
                              : c.dangerSoft,
                          color:
                            t.transaction_type === "STOCK_IN"
                              ? c.accent
                              : c.danger,
                        }}
                      >
                        {t.transaction_type === "STOCK_IN" ? "Stock in" : "Stock out"}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 20px",
                        color: t.transaction_type === "STOCK_OUT" ? c.danger : c.accent,
                        fontWeight: 600,
                      }}
                    >
                      {t.transaction_type === "STOCK_IN" ? `+${t.quantity}` : `-${t.quantity}`}
                    </td>
                    <td style={{ padding: "10px 20px", color: c.textMuted }}>
                      {t.user_name}
                    </td>
                    <td style={{ padding: "10px 20px", color: c.textFaint }}>
                      {new Date(t.transaction_date).toLocaleString()}
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
