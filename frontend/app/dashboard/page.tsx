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

const topItems = [
  { name: "Steel Hex Bolts", units: 1240 },
  { name: "Copper Wire", units: 980 },
  { name: "LED Panel 18W", units: 760 },
  { name: "PVC Conduit", units: 640 },
  { name: "Industrial Gloves", units: 510 },
];

const salesTrend = [
  { day: "Mon", value: 4200 },
  { day: "Tue", value: 3800 },
  { day: "Wed", value: 5100 },
  { day: "Thu", value: 4700 },
  { day: "Fri", value: 6200 },
  { day: "Sat", value: 5400 },
  { day: "Sun", value: 3300 },
];

export default function DashboardOverview() {
  const { c } = useTheme();
  const { transactionList, userList, supplierList } = useData();
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
          value="8,420"
          sub="Rs 184,250 value"
          icon={Boxes}
          tone="accent"
        />
        <StatCard
          c={c}
          label="Active alerts"
          value="12"
          sub="9 low stock · 3 expiring"
          icon={AlertTriangle}
          tone="warn"
        />
        <StatCard
          c={c}
          label="Draft POs"
          value="6"
          sub="Awaiting approval"
          icon={ClipboardList}
          tone="accent"
        />
        <StatCard
          c={c}
          label="Sold value (month)"
          value="Rs 96,400"
          sub="312 units across 48 SKUs"
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
