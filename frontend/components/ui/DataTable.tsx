"use client";

import React from "react";
import { SearchBar } from "./SearchBar";
import { Pagination } from "./Pagination";
import { Checkbox } from "./Checkbox";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  width?: number | string;
  align?: "left" | "center" | "right";
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  c: any;
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  
  // Selection
  selection?: {
    selectedIds: (string | number)[];
    onToggleAll: () => void;
    onToggleRow: (id: string | number) => void;
    allSelected: boolean;
    onDeselectAll?: () => void;
    label?: string;
  };

  // Search & Controls Header Toolbar
  search?: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    maxWidth?: number;
  };
  filterSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;

  // Row Interactions
  onRowClick?: (item: T) => void;
  selectedRowId?: string | number;
  
  // States
  isLoading?: boolean;
  emptyMessage?: string;
  minWidth?: number;

  // Pagination
  pagination?: {
    page: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    itemLabel?: string;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T>({
  c,
  columns,
  data,
  keyExtractor,
  selection,
  search,
  filterSlot,
  actionSlot,
  onRowClick,
  selectedRowId,
  isLoading = false,
  emptyMessage = "No items found.",
  minWidth = 700,
  pagination,
}: DataTableProps<T>) {
  const hasToolbar = !!(search || filterSlot || actionSlot || selection);
  const totalColCount = columns.length + (selection ? 1 : 0);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        height: "100%",
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Top Toolbar */}
      {hasToolbar && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "13px 20px",
            borderBottom: `1px solid ${c.border}`,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Selection indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {selection && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Checkbox
                  checked={selection.allSelected}
                  onChange={selection.onToggleAll}
                  c={c}
                />
                <span
                  style={{
                    fontSize: 12.5,
                    color: c.textMuted,
                    whiteSpace: "nowrap",
                  }}
                >
                  {selection.selectedIds.length > 0
                    ? `${selection.selectedIds.length} selected`
                    : selection.label || "Select all"}
                </span>
              </div>
            )}
            {selection && selection.selectedIds.length > 0 && selection.onDeselectAll && (
              <button
                type="button"
                onClick={selection.onDeselectAll}
                style={{
                  fontSize: 12.5,
                  color: c.textMuted,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                  fontFamily: "inherit",
                }}
              >
                Deselect all
              </button>
            )}
          </div>

          {/* Filters & Actions & Search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              flex: 1,
              justifyContent: "flex-end",
            }}
          >
            {filterSlot}
            {actionSlot}
            {search && (
              <SearchBar
                value={search.value}
                onChange={search.onChange}
                placeholder={search.placeholder || "Search..."}
                c={c}
                maxWidth={search.maxWidth || 220}
              />
            )}
          </div>
        </div>
      )}

      {/* Table Content */}
      <div style={{ overflowX: "auto", flex: 1 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            minWidth,
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
              {selection && (
                <th
                  style={{
                    width: 48,
                    padding: "10px 20px",
                    fontWeight: 500,
                    fontSize: 11.5,
                  }}
                />
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: "10px 20px",
                    fontWeight: 500,
                    fontSize: 11.5,
                    width: col.width,
                    textAlign: col.align || "left",
                    borderBottom: `1px solid ${c.border}`,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={totalColCount}
                  style={{
                    padding: "32px 20px",
                    textAlign: "center",
                    color: c.textMuted,
                  }}
                >
                  Loading data...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={totalColCount}
                  style={{
                    padding: "32px 20px",
                    textAlign: "center",
                    color: c.textFaint,
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, idx) => {
                const id = keyExtractor(item);
                const isSelected = selectedRowId !== undefined && selectedRowId === id;
                const isChecked = selection?.selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick && onRowClick(item)}
                    style={{
                      borderTop: `1px solid ${c.border}`,
                      background: isSelected ? c.accentSoft : "transparent",
                      cursor: onRowClick ? "pointer" : "default",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = c.surfaceMuted;
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {selection && (
                      <td
                        style={{ padding: "12px 20px" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={!!isChecked}
                          onChange={() => selection.onToggleRow(id)}
                          c={c}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: "12px 20px",
                          textAlign: col.align || "left",
                          color: c.text,
                        }}
                      >
                        {col.render
                          ? col.render(item, idx)
                          : ((item as any)[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          pageSize={pagination.pageSize}
          itemLabel={pagination.itemLabel || "items"}
          onPageChange={pagination.onPageChange}
          c={c}
        />
      )}
    </div>
  );
}
