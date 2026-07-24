"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Tag,
  Truck,
  Package,
  Search,
  RefreshCw,
  Clock,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "../ThemeContext";
import { apiFetch } from "@/lib/api";

export interface AuditLogItem {
  action?: string;
  description: string;
  created_at: string;
}

type CategoryKey = "ALL" | "AUTH_USER" | "CATEGORY" | "SUPPLIER" | "ITEM_PRICE";

const CATEGORIES: Record<
  Exclude<CategoryKey, "ALL">,
  {
    id: CategoryKey;
    label: string;
    icon: React.ElementType;
    actions: string[];
    accentColor: string;
    badgeBgLight: string;
    badgeBgDark: string;
  }
> = {
  AUTH_USER: {
    id: "AUTH_USER",
    label: "Authentication & User Management",
    icon: ShieldCheck,
    actions: [
      "LOGIN_SUCCESS",
      "LOGOUT_SUCCESS",
      "USER_CREATE",
      "USER_DELETE",
      "USER_DEACTIVATE",
      "USER_REACTIVATE",
      "USER_PASSWORD_CHANGE",
    ],
    accentColor: "#3B82F6",
    badgeBgLight: "#EFF6FF",
    badgeBgDark: "#1E293B",
  },
  CATEGORY: {
    id: "CATEGORY",
    label: "Category Management",
    icon: Tag,
    actions: ["CATEGORY_CREATE", "CATEGORY_DELETE"],
    accentColor: "#10B981",
    badgeBgLight: "#ECFDF5",
    badgeBgDark: "#064E3B",
  },
  SUPPLIER: {
    id: "SUPPLIER",
    label: "Supplier Management",
    icon: Truck,
    actions: [
      "SUPPLIER_CREATE",
      "SUPPLIER_DELETE",
      "SUPPLIER_DEACTIVATE",
      "SUPPLIER_REACTIVATE",
    ],
    accentColor: "#F59E0B",
    badgeBgLight: "#FFFBEB",
    badgeBgDark: "#451A03",
  },
  ITEM_PRICE: {
    id: "ITEM_PRICE",
    label: "Item & Price Management",
    icon: Package,
    actions: [
      "ITEM_CREATE",
      "ITEM_DELETE",
      "ITEM_DEACTIVATE",
      "ITEM_REACTIVATE",
      "ITEM_PRICE_UPDATE",
    ],
    accentColor: "#8B5CF6",
    badgeBgLight: "#F5F3FF",
    badgeBgDark: "#2E1065",
  },
};

function getLogCategory(log: AuditLogItem): Exclude<CategoryKey, "ALL"> {
  if (log.action) {
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      if (cat.actions.includes(log.action)) {
        return key as Exclude<CategoryKey, "ALL">;
      }
    }
  }

  // Fallback description analysis
  const desc = (log.description || "").toLowerCase();
  if (
    desc.includes("user") ||
    desc.includes("logged in") ||
    desc.includes("logged out") ||
    desc.includes("password")
  ) {
    return "AUTH_USER";
  }
  if (desc.includes("category")) {
    return "CATEGORY";
  }
  if (desc.includes("supplier")) {
    return "SUPPLIER";
  }
  if (
    desc.includes("item") ||
    desc.includes("price") ||
    desc.includes("cost") ||
    desc.includes("selling")
  ) {
    return "ITEM_PRICE";
  }
  return "AUTH_USER";
}

function formatLogTimestamp(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const dateFormatted = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
    const timeFormatted = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    return `${dateFormatted} • ${timeFormatted}`;
  } catch {
    return dateStr;
  }
}

export default function AuditLogsPage() {
  const { c, mode } = useTheme();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fetchLogs = useCallback(
    async (pageNum: number, isInitial: boolean = false) => {
      if (isInitial) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const data = await apiFetch<AuditLogItem[]>(
          `/auditlogs/?page=${pageNum}&limit=10`
        );
        if (Array.isArray(data)) {
          if (data.length < 10) {
            setHasMore(false);
          } else {
            setHasMore(true);
          }

          if (isInitial) {
            setLogs(data);
          } else {
            setLogs((prev) => [...prev, ...data]);
          }
        } else {
          setHasMore(false);
          if (isInitial) setLogs([]);
        }
      } catch (err: any) {
        console.error("Failed to fetch audit logs:", err);
        setError(
          err?.message || "Failed to load audit logs. Please check authorization."
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchLogs(1, true);
  }, [fetchLogs]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage, false);
  };

  // Filter among received logs only
  const filteredLogs = logs.filter((log) => {
    if (selectedCategory !== "ALL") {
      const logCat = getLogCategory(log);
      if (logCat !== selectedCategory) return false;
    }
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const matchDesc = log.description.toLowerCase().includes(q);
      const matchAction = (log.action || "").toLowerCase().includes(q);
      if (!matchDesc && !matchAction) return false;
    }
    return true;
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
      }}
    >
      {/* Top Filter & Search Controls Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Simple Category Dropdown at Left */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as CategoryKey)}
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
            minWidth: 240,
            fontFamily: "inherit",
          }}
        >
          <option value="ALL">All Categories</option>
          <option value="AUTH_USER">Authentication & User Management</option>
          <option value="CATEGORY">Category Management</option>
          <option value="SUPPLIER">Supplier Management</option>
          <option value="ITEM_PRICE">Item & Price Management</option>
        </select>

        {/* Search Description Input at Right */}
        <div style={{ position: "relative", width: 280 }}>
          <Search
            size={14}
            color={c.textFaint}
            style={{ position: "absolute", left: 10, top: 11 }}
          />
          <input
            type="text"
            placeholder="Search description..."
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
      </div>

      {/* Main Notification Feed List */}
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

        {loading && logs.length === 0 ? (
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
            <span style={{ fontSize: 14 }}>Loading audit logs...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
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
            <Clock size={32} color={c.textFaint} />
            <span style={{ fontSize: 15, fontWeight: 600, color: c.text }}>
              No Audit Logs Found
            </span>
            <span style={{ fontSize: 13, color: c.textFaint }}>
              {searchQuery || selectedCategory !== "ALL"
                ? "No received logs match your selected filter criteria."
                : "There are currently no activity logs recorded."}
            </span>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const catKey = getLogCategory(log);
            const cat = CATEGORIES[catKey];
            const Icon = cat.icon;
            const formattedTime = formatLogTimestamp(log.created_at);

            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "16px 18px",
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 12,
                  boxShadow:
                    mode === "light" ? "0 1px 3px rgba(0,0,0,0.03)" : "none",
                }}
              >
                {/* Category Icon Badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background:
                      mode === "light" ? cat.badgeBgLight : cat.badgeBgDark,
                    border: `1px solid ${cat.accentColor}33`,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} color={cat.accentColor} />
                </div>

                {/* Content */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: cat.accentColor,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        background:
                          mode === "light" ? cat.badgeBgLight : cat.badgeBgDark,
                        padding: "2px 8px",
                        borderRadius: 6,
                        border: `1px solid ${cat.accentColor}22`,
                      }}
                    >
                      {cat.label}
                    </span>

                    {/* Timestamp with explicit Year */}
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
                      <span>{formattedTime}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      color: c.text,
                      margin: 0,
                      fontWeight: 400,
                      wordBreak: "break-word",
                    }}
                  >
                    {log.description}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Load More Button */}
      {!loading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            marginTop: 10,
            marginBottom: 20,
          }}
        >
          {hasMore ? (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 24px",
                background: c.surface,
                color: c.text,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: loadingMore ? "not-allowed" : "pointer",
                boxShadow:
                  mode === "light" ? "0 2px 4px rgba(0,0,0,0.04)" : "none",
                fontFamily: "inherit",
              }}
            >
              {loadingMore ? (
                <>
                  <RefreshCw
                    size={14}
                    style={{ animation: "spin 1s linear infinite" }}
                    color={c.accent}
                  />
                  <span>Loading next 10 logs...</span>
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  <span>Load More Logs</span>
                </>
              )}
            </button>
          ) : (
            logs.length > 0 && (
              <span
                style={{
                  fontSize: 12.5,
                  color: c.textFaint,
                  fontStyle: "italic",
                }}
              >
                No more logs available
              </span>
            )
          )}
        </div>
      )}

      {/* Keyframe animation for spin icon */}
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
