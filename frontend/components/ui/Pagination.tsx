"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  c: any;
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  itemLabel = "items",
  onPageChange,
  c,
}: PaginationProps) {
  if (totalCount === 0 && totalPages <= 1) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 20px",
          borderTop: `1px solid ${c.border}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, color: c.textFaint }}>No {itemLabel}</span>
      </div>
    );
  }

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  // Build windowed page list: 1 … [p-1] [p] [p+1] … N (Transaction pagination style)
  const pageNumbers: (number | "…")[] = [];
  const addPage = (n: number) => {
    if (n >= 1 && n <= totalPages && !pageNumbers.includes(n)) {
      pageNumbers.push(n);
    }
  };

  addPage(1);
  if (page > 3) pageNumbers.push("…");
  if (page > 2) addPage(page - 1);
  if (page !== 1 && page !== totalPages) addPage(page);
  if (page < totalPages - 1) addPage(page + 1);
  if (page < totalPages - 2) pageNumbers.push("…");
  addPage(totalPages);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "13px 20px",
        borderTop: `1px solid ${c.border}`,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 12, color: c.textFaint }}>
        Showing {startItem}–{endItem} of {totalCount} {itemLabel}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: `1px solid ${c.border}`,
            background: c.surface,
            color: c.textMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: page <= 1 ? "default" : "pointer",
            opacity: page <= 1 ? 0.4 : 1,
          }}
        >
          <ChevronLeft size={14} />
        </button>

        {pageNumbers.map((n, idx) =>
          n === "…" ? (
            <span
              key={`ellipsis-${idx}`}
              style={{
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                color: c.textFaint,
                userSelect: "none",
              }}
            >
              …
            </span>
          ) : (
            <button
              key={n}
              onClick={() => onPageChange(n as number)}
              style={{
                minWidth: 28,
                height: 28,
                borderRadius: 7,
                padding: "0 6px",
                border: `1px solid ${n === page ? c.accent : c.border}`,
                background: n === page ? c.accentSoft : c.surface,
                color: n === page ? c.accent : c.textMuted,
                fontSize: 12.5,
                fontWeight: n === page ? 600 : 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {n}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: `1px solid ${c.border}`,
            background: c.surface,
            color: c.textMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: page >= totalPages ? "default" : "pointer",
            opacity: page >= totalPages ? 0.4 : 1,
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
