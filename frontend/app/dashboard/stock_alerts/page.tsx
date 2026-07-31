"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AlertCircle, AlertTriangle, Bell, Clock, Search, RefreshCw, CheckCircle2 } from "lucide-react";
import { useTheme } from "../ThemeContext";
import { apiFetch } from "@/lib/api";

export interface StockAlertItem {
  alert_id: string;
  item_id: string;
  item_name: string;
  status: "CRITICAL" | "LOW_STOCK" | "RESOLVED";
  supplier_id: string;
  supplier_name: string;
  created_at: string;
  resolved_at?: string | null;
}

export default function StockAlertsPage() {
  const { c, mode } = useTheme();
  const [alerts, setAlerts] = useState<StockAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"active" | "resolved">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "CRITICAL" | "LOW_STOCK">("all");

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<StockAlertItem[]>("/stock-alerts/");
      if (Array.isArray(data)) {
        setAlerts(data);
      } else {
        setAlerts([]);
      }
    } catch (err: any) {
      console.error("Failed to fetch stock alerts:", err);
      setError(err?.message || "Failed to load stock alerts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Filter items based on tab, search query, and dropdown filter
  const filteredAlerts = useMemo(() => {
    let items = alerts.filter((alert) => {
      if (activeTab === "active") {
        return alert.status !== "RESOLVED";
      } else {
        return alert.status === "RESOLVED";
      }
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (alert) =>
          (alert.item_name || "").toLowerCase().includes(q) ||
          (alert.supplier_name || "").toLowerCase().includes(q)
      );
    }

    if (activeTab === "active" && activeFilter !== "all") {
      items = items.filter((alert) => alert.status === activeFilter);
    }

    if (activeTab === "resolved") {
      items.sort((a, b) => {
        const timeA = a.resolved_at ? new Date(a.resolved_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const timeB = b.resolved_at ? new Date(b.resolved_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
        return timeB - timeA;
      });
    } else {
      items.sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
    }

    return items;
  }, [alerts, activeTab, searchQuery, activeFilter]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return (
        d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }) +
        " • " +
        d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      );
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 24, borderBottom: `1px solid ${c.border}` }}>
        <button
          onClick={() => setActiveTab("active")}
          style={{
            background: "none",
            border: "none",
            padding: "0 4px 12px",
            fontSize: 14,
            fontWeight: 600,
            color: activeTab === "active" ? c.text : c.textMuted,
            borderBottom: activeTab === "active" ? `2px solid ${c.accent}` : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Active Alerts
        </button>
        <button
          onClick={() => setActiveTab("resolved")}
          style={{
            background: "none",
            border: "none",
            padding: "0 4px 12px",
            fontSize: 14,
            fontWeight: 600,
            color: activeTab === "resolved" ? c.text : c.textMuted,
            borderBottom: activeTab === "resolved" ? `2px solid ${c.accent}` : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Resolved Alerts
        </button>
      </div>

      {/* Filter & Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 280, flexShrink: 0 }}>
          <Search size={14} color={c.textFaint} style={{ position: "absolute", left: 10, top: 11 }} />
          <input
            type="text"
            placeholder="Search by item or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px 8px 32px",
              fontSize: 13,
              background: c.inputBg,
              color: c.text,
              border: `1px solid ${c.border}`,
              borderRadius: 8,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        {activeTab === "active" && (
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as any)}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 500,
              background: c.inputBg,
              color: c.text,
              border: `1px solid ${c.border}`,
              borderRadius: 8,
              outline: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <option value="all">All Values</option>
            <option value="CRITICAL">Critical</option>
            <option value="LOW_STOCK">Low Stock</option>
          </select>
        )}
      </div>

      {/* Main List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {error && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 10,
              background: c.dangerSoft,
              border: `1px solid ${c.danger}`,
              color: c.danger,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 40,
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              color: c.textMuted,
              gap: 12,
            }}
          >
            <RefreshCw
              size={24}
              style={{ animation: "spin 1s linear infinite" }}
              color={c.accent}
            />
            <span style={{ fontSize: 14 }}>Loading stock alerts...</span>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 48,
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              color: c.textMuted,
              gap: 10,
              textAlign: "center",
            }}
          >
            <Bell size={32} color={c.textFaint} />
            <span style={{ fontSize: 15, fontWeight: 600, color: c.text }}>
              No {activeTab} alerts found
            </span>
            <span style={{ fontSize: 13, color: c.textFaint }}>
              {activeTab === "active"
                ? "Inventory is healthy."
                : "No alerts have been resolved yet."}
            </span>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCritical = alert.status === "CRITICAL";
            const isResolved = alert.status === "RESOLVED";

            return (
              <div
                key={alert.alert_id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "16px 18px",
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 12,
                  boxShadow: mode === "light" ? "0 1px 3px rgba(0,0,0,0.03)" : "none",
                }}
              >
                {/* Icon */}
                {isResolved ? (
                  <CheckCircle2
                    size={18}
                    color={c.accent}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                ) : isCritical ? (
                  <AlertTriangle
                    size={18}
                    color={c.danger || "#ef4444"}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                ) : (
                  <AlertCircle
                    size={18}
                    color="#f97316"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                )}

                {/* Content */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: c.text }}>
                        {alert.item_name || "Unknown Item"}
                      </span>
                      <span style={{ fontSize: 13, color: c.textMuted }}>•</span>
                      <span style={{ fontSize: 13, color: c.textFaint }}>
                        {alert.supplier_name || "No Supplier"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        color: c.textFaint,
                        fontSize: 12,
                      }}
                    >
                      <Clock size={12} />
                      <span>
                        {isResolved
                          ? formatDate(alert.resolved_at || alert.created_at)
                          : formatDate(alert.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
