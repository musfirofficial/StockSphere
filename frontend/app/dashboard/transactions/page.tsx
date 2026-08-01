"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  ArrowLeft,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  TrendingUp,
  History,
} from "lucide-react";
import { useTheme } from "../ThemeContext";
import {
  useData,
  Transaction,
  getItemCurrentQty,
} from "../DataContext";
import { isReadOnly } from "@/lib/roles";
import { Pagination, SearchBar, DataTable, DataTableColumn } from "@/components/ui";


type BulkRow = { item: string; type: "Stock in" | "Stock out"; qty: number };

export default function TransactionsPage() {
  const { c } = useTheme();
  const { transactionList, itemList, loggedInUser, recordTransactions, setHeaderActions, fetchTransactions, fetchItems, refreshTransactions, refreshItems } = useData();

  useEffect(() => {
    fetchTransactions();
    fetchItems();
  }, []);

  // Derive read-only mode from role (Auditor & Sales cannot create transactions)
  const readOnly = isReadOnly(loggedInUser?.role ?? "", "transactions");

  // ── Read view state ──
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const PAGE = 8;

  // ── Add view state ──
  const [isAdding, setIsAdding] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  // recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const ddRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    // Read-only roles never see the New transaction button
    if (readOnly) {
      setHeaderActions(null);
      return;
    }
    if (isAdding) {
      setHeaderActions(null);
      return;
    }
    setHeaderActions(
      <button
        onClick={() => setIsAdding(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: c.accent,
          color: "#fff",
          border: "none",
          padding: "8px 14px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <Plus size={15} /> New transaction
      </button>
    );
    return () => setHeaderActions(null);
  }, [isAdding, c, setHeaderActions, readOnly]);

  // ── Filtered list (no Adjustment) ──
  const filtered = useMemo(
    () =>
      transactionList.filter((t) => {
        if (t.type !== "Stock in" && t.type !== "Stock out") return false;
        const q = search.toLowerCase();
        return (
          !q ||
          t.item.toLowerCase().includes(q) ||
          t.user.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
        );
      }),
    [transactionList, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);

  // Active items from real itemList for suggestions
  const suggestions = useMemo(() => {
    const q = itemSearch.toLowerCase();
    if (!q) return [];
    return itemList
      .filter((i) => i.active && i.itemName.toLowerCase().includes(q))
      .slice(0, 20);
  }, [itemSearch, itemList]);

  const addRow = (item: string) => {
    if (!bulkRows.find((r) => r.item === item))
      setBulkRows((p) => [...p, { item, type: "Stock in", qty: 1 }]);
    setItemSearch("");
    setShowSuggestions(false);
  };
  const removeRow = (i: number) =>
    setBulkRows((p) => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, f: Partial<BulkRow>) =>
    setBulkRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...f } : r)));

  const handleRecord = async () => {
    if (!bulkRows.length) return;
    if (bulkRows.some((r) => r.qty <= 0)) {
      setRecordError("All quantities must be greater than zero.");
      return;
    }
    setIsRecording(true);
    setRecordProgress(0);
    setRecordError(null);

    // Patch recordTransactions to update progress
    // We call it and then handle the result
    const result = await recordTransactions(bulkRows);

    setIsRecording(false);
    if (result.success) {
      setBulkRows([]);
      setIsAdding(false);
      setPage(1);
      // Refresh transaction list and item stock from backend
      refreshTransactions();
      refreshItems();
    } else {
      setRecordError(
        result.completed > 0
          ? `Recorded ${result.completed} of ${bulkRows.length}. Failed on: ${result.error}`
          : `Failed: ${result.error}`
      );
    }
  };

  const typeBadge = (type: string) => ({
    bg: type === "Stock in" ? c.accentSoft : c.dangerSoft,
    fg: type === "Stock in" ? c.accent : c.danger,
  });

  // ─────────────────────────────────────────────────────────────
  // READ VIEW
  // ─────────────────────────────────────────────────────────────
  if (!isAdding)
    return (
      <div
        style={{ display: "flex", height: "100%", gap: 20, overflow: "hidden" }}
      >
        {/* Table */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            height: "100%",
          }}
        >
          <DataTable
            c={c}
            columns={[
              {
                key: "item",
                header: "Item",
                render: (t) => <span style={{ fontWeight: 600 }}>{t.item}</span>,
              },
              {
                key: "type",
                header: "Type",
                render: (t) => {
                  const { bg, fg } = typeBadge(t.type);
                  return (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: bg,
                        color: fg,
                      }}
                    >
                      {t.type}
                    </span>
                  );
                },
              },
              {
                key: "qty",
                header: "Quantity",
                render: (t) => (
                  <span
                    style={{
                      fontWeight: 600,
                      color: t.qty >= 0 ? c.accent : c.danger,
                    }}
                  >
                    {t.qty > 0 ? `+${t.qty}` : t.qty}
                  </span>
                ),
              },
              {
                key: "user",
                header: "User",
                render: (t) => <span style={{ color: c.textMuted }}>{t.user}</span>,
              },
              {
                key: "date",
                header: "Date",
                render: (t) => <span style={{ color: c.textFaint }}>{t.date}</span>,
              },
            ]}
            data={pageRows}
            keyExtractor={(t) => t.id}
            selectedRowId={selectedTx?.id}
            onRowClick={(t) => setSelectedTx(t)}
            emptyMessage="No transactions found."
            search={{
              value: search,
              onChange: (val) => {
                setSearch(val);
                setPage(1);
              },
              placeholder: "Search by item, user or ID…",
              maxWidth: 280,
            }}
            pagination={{
              page,
              totalPages,
              totalCount: filtered.length,
              pageSize: PAGE,
              itemLabel: "transactions",
              onPageChange: setPage,
            }}
          />
        </div>

        {/* Detail panel */}
        {selectedTx && (
          <div
            style={{
              width: 340,
              flexShrink: 0,
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid ${c.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <History size={15} color={c.accent} /> Transaction Detail
              </span>
              <button
                onClick={() => setSelectedTx(null)}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: c.textMuted,
                  display: "flex",
                }}
              >
                <X size={17} />
              </button>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {[
                { label: "ID", value: selectedTx.id },
                { label: "Item", value: selectedTx.item },
                { label: "User", value: selectedTx.user },
                { label: "Date", value: selectedTx.date },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: c.textFaint,
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      marginBottom: 3,
                    }}
                  >
                    {label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
              <div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: c.textFaint,
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                    marginBottom: 3,
                  }}
                >
                  TYPE
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: typeBadge(selectedTx.type).bg,
                    color: typeBadge(selectedTx.type).fg,
                  }}
                >
                  {selectedTx.type}
                </span>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: c.textFaint,
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                    marginBottom: 3,
                  }}
                >
                  QUANTITY CHANGED
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: selectedTx.qty >= 0 ? c.accent : c.danger,
                  }}
                >
                  {selectedTx.qty > 0 ? `+${selectedTx.qty}` : selectedTx.qty}{" "}
                  units
                </div>
              </div>

              {/* Audit block */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: c.surfaceMuted,
                  border: `1px solid ${c.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: c.textMuted,
                    letterSpacing: "0.04em",
                  }}
                >
                  INVENTORY AUDIT
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ fontSize: 12.5, color: c.textMuted }}>
                    Previous Quantity
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {selectedTx.prevQty ?? "—"}
                  </span>
                </div>
                <div style={{ height: 1, background: c.border }} />
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ fontSize: 12.5, color: c.textMuted }}>
                    New Quantity
                  </span>
                  <span
                    style={{ fontSize: 13.5, fontWeight: 700, color: c.accent }}
                  >
                    {selectedTx.newQty ?? "—"}
                  </span>
                </div>
              </div>
            </div>
            <div
              style={{
                padding: "12px 18px",
                borderTop: `1px solid ${c.border}`,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setSelectedTx(null)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 7,
                  border: `1px solid ${c.border}`,
                  background: c.surface,
                  color: c.text,
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );

  // ─────────────────────────────────────────────────────────────
  // ADD / BATCH ENTRY VIEW
  // ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.border}`,
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${c.border}`,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => {
            setIsAdding(false);
            setBulkRows([]);
          }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: `1px solid ${c.border}`,
            background: c.surface,
            color: c.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            New Batch Transaction
          </div>
          <div style={{ fontSize: 11.5, color: c.textFaint, marginTop: 1 }}>
            Operator:{" "}
            <strong style={{ color: c.textMuted }}>{loggedInUser?.fullName ?? "You"}</strong>
          </div>
        </div>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11.5,
            color: c.textMuted,
            padding: "3px 10px",
            borderRadius: 6,
            background: c.surfaceMuted,
            border: `1px solid ${c.border}`,
          }}
        >
          {bulkRows.length} items
        </span>
      </div>

      {/* Item search bar */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: `1px solid ${c.border}`,
          background: c.surfaceMuted,
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: 480, position: "relative" }} ref={ddRef}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 13px",
              borderRadius: 9,
              border: `1px solid ${c.border}`,
              background: c.surface,
            }}
          >
            <Search size={14} color={c.textFaint} />
            <input
              value={itemSearch}
              onChange={(e) => {
                setItemSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search and add inventory items…"
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                color: c.text,
                fontSize: 13,
                fontFamily: "inherit",
                width: "100%",
              }}
            />
            {itemSearch && (
              <button
                onClick={() => setItemSearch("")}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: c.textFaint,
                  display: "flex",
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                background: c.surface,
                border: `1px solid ${c.border}`,
                borderRadius: 9,
                maxHeight: 200,
                overflowY: "auto",
                zIndex: 100,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              }}
            >
              {suggestions.map((item) => {
                const added = bulkRows.some((r) => r.item === item.itemName);
                const stockQty = getItemCurrentQty(item.itemName, transactionList, itemList);
                return (
                  <div
                    key={item.id}
                    onClick={() => !added && addRow(item.itemName)}
                    style={{
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: `1px solid ${c.border}`,
                      cursor: added ? "default" : "pointer",
                      opacity: added ? 0.45 : 1,
                      fontSize: 12.5,
                    }}
                    onMouseEnter={(e) => {
                      if (!added)
                        e.currentTarget.style.background = c.surfaceMuted;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{item.itemName}</span>
                    <div
                      style={{ display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <span style={{ fontSize: 11, color: c.textFaint }}>
                        Stock: {stockQty} {item.unit}
                      </span>
                      {added && (
                        <span
                          style={{
                            fontSize: 11,
                            color: c.accent,
                            fontWeight: 600,
                          }}
                        >
                          Added
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Rows table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {bulkRows.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: 220,
              gap: 10,
              color: c.textFaint,
            }}
          >
            <Search size={28} strokeWidth={1.5} />
            <span style={{ fontSize: 13.5, fontWeight: 500 }}>
              No items added yet
            </span>
            <span style={{ fontSize: 12, color: c.textFaint }}>
              Use the search bar above to add items to this batch.
            </span>
          </div>
        ) : (
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
          >
            <thead>
              <tr
                style={{
                  color: c.textFaint,
                  textAlign: "left",
                  background: c.surfaceMuted,
                  borderBottom: `1px solid ${c.border}`,
                }}
              >
                {[
                  "Item",
                  "Transaction Type",
                  "Quantity",
                  "Current Stock",
                  "Projected",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 20px",
                      fontWeight: 500,
                      fontSize: 11,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bulkRows.map((row, i) => {
                const current = getItemCurrentQty(row.item, transactionList, itemList);
                const qty = Number(row.qty) || 0;
                const projected =
                  row.type === "Stock in" ? current + qty : current - qty;
                return (
                  <tr
                    key={row.item}
                    style={{
                      borderBottom: `1px solid ${c.border}`,
                      background: c.surface,
                    }}
                  >
                    <td style={{ padding: "12px 20px", fontWeight: 600 }}>
                      {row.item}
                    </td>
                    <td style={{ padding: "12px 20px" }}>
                      <div
                        style={{
                          display: "flex",
                          borderRadius: 7,
                          border: `1px solid ${c.border}`,
                          background: c.inputBg,
                          padding: 2,
                          width: "fit-content",
                        }}
                      >
                        {(["Stock in", "Stock out"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => updateRow(i, { type: t })}
                            style={{
                              border: "none",
                              padding: "5px 12px",
                              borderRadius: 5,
                              background:
                                row.type === t
                                  ? t === "Stock in"
                                    ? c.accent
                                    : c.danger
                                  : "transparent",
                              color: row.type === t ? "#fff" : c.textMuted,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            {t === "Stock in" ? "In" : "Out"}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "12px 20px" }}>
                      <input
                        type="number"
                        min="1"
                        value={row.qty || ""}
                        onChange={(e) =>
                          updateRow(i, { qty: parseInt(e.target.value) || 0 })
                        }
                        style={{
                          width: 90,
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: `1px solid ${c.border}`,
                          background: c.inputBg,
                          color: c.text,
                          fontSize: 13,
                          fontWeight: 600,
                          outline: "none",
                          fontFamily: "inherit",
                        }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "12px 20px",
                        color: c.textMuted,
                        fontSize: 12.5,
                      }}
                    >
                      {current}
                    </td>
                    <td
                      style={{
                        padding: "12px 20px",
                        fontWeight: 600,
                        fontSize: 12.5,
                        color: projected < 0 ? c.danger : c.accent,
                      }}
                    >
                      {projected}
                    </td>
                    <td style={{ padding: "12px 20px" }}>
                      <button
                        onClick={() => removeRow(i)}
                        style={{
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: c.textFaint,
                          display: "flex",
                          padding: 4,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = c.danger)
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = c.textFaint)
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Error Banner */}
      {recordError && (
        <div
          style={{
            margin: "0 20px",
            padding: "10px 14px",
            borderRadius: 8,
            background: c.dangerSoft,
            border: `1px solid ${c.danger}`,
            color: c.danger,
            fontSize: 12.5,
            fontWeight: 500,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span>{recordError}</span>
          <button
            onClick={() => setRecordError(null)}
            style={{ border: "none", background: "none", cursor: "pointer", color: c.danger, display: "flex" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: `1px solid ${c.border}`,
          background: c.surface,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12.5, color: c.textMuted }}>
          {bulkRows.length > 0 && (
            <>
              {bulkRows.length} items ·{" "}
              {bulkRows.reduce((a, r) => a + (Number(r.qty) || 0), 0)} total
              units
            </>
          )}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              setIsAdding(false);
              setBulkRows([]);
            }}
            style={{
              padding: "9px 16px",
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
            Cancel
          </button>
          <button
            onClick={handleRecord}
            disabled={bulkRows.length === 0 || isRecording}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              background: c.accent,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: bulkRows.length === 0 || isRecording ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: bulkRows.length === 0 || isRecording ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 160,
              justifyContent: "center",
            }}
          >
            <TrendingUp size={14} />
            {isRecording
              ? `Recording ${recordProgress}/${bulkRows.length}…`
              : "Record Transactions"}
          </button>
        </div>
      </div>
    </div>
  );
}
