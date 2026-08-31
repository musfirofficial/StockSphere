"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  X,
  Check,
  Building2,
  Package,
  RotateCcw,
  AlertTriangle,
  Clock,
  Sliders,
  Calendar,
  AlertCircle,
  Filter,
  CheckCircle,
  ChevronDown,
  ArrowLeft,
  UserCircle,
  ShoppingCart,
  Truck,
  FileText,
} from "lucide-react";
import { useTheme } from "../ThemeContext";
import { useData, Item } from "../DataContext";
import { isReadOnly } from "@/lib/roles";
import { apiFetch } from "@/lib/api";
import { Pagination } from "@/components/ui";

// ── Transaction Types ──────────────────────────────────────
export type TxType =
  | "PURCHASE"
  | "SOLD"
  | "CUSTOMER_RETURN"
  | "DAMAGED"
  | "EXPIRED"
  | "ADJUSTMENT_INCREASE"
  | "ADJUSTMENT_DECREASE";

interface TransactionRecord {
  transaction_id: string;
  item_id: string;
  item_name: string;
  sku: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  batch_id?: string | null;
  batch_number?: string | null;
  batch_selling_price?: number | null;
  po_id?: string | null;
  reference_transaction_id?: string | null;
  transaction_type: TxType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  unit_price?: number | null;
  reason?: string | null;
  note?: string | null;
  user_id?: string | null;
  user_name: string;
  user_full_name?: string | null;
  transaction_date: string;
}

interface StockBatchOption {
  batch_id: string;
  batch_number: string;
  current_quantity: number;
  purchase_price: number;
  selling_price?: number | null;
  expiry_date?: string | null;
  supplier_id: string;
  supplier_name?: string;
}

interface ApprovedPOOption {
  po_id: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  items: {
    item_id: string;
    item_name: string;
    sku: string;
    unit: string;
    quantity: number;
    quantity_received: number;
    unit_price: number;
  }[];
}

// ── Sleek Minimal Transaction Type Indicator ───────────────
function TransactionTypeIndicator({ type }: { type: TxType }) {
  const map: Record<TxType, { color: string; label: string }> = {
    PURCHASE: { color: "#2E7D32", label: "Purchase Receipt" },
    SOLD: { color: "#1E40AF", label: "Sale" },
    CUSTOMER_RETURN: { color: "#7C3AED", label: "Customer Return" },
    DAMAGED: { color: "#DC2626", label: "Damaged Stock" },
    EXPIRED: { color: "#B78103", label: "Expired Stock" },
    ADJUSTMENT_INCREASE: { color: "#2E7D32", label: "Adjustment (+)" },
    ADJUSTMENT_DECREASE: { color: "#DC2626", label: "Adjustment (-)" },
  };
  const t = map[type] || { color: "#64748B", label: type };

  return (
    <span
      style={{
        fontSize: 12.5,
        fontWeight: 500,
        color: t.color,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.color }} />
      {t.label}
    </span>
  );
}

// ============================================================================
// Main Transactions Page
// ============================================================================
export default function TransactionsPage() {
  const { c } = useTheme();
  const { itemList, supplierList, loggedInUser, refreshItems, fetchItems } = useData();
  const readOnly = isReadOnly(loggedInUser?.role ?? "", "transactions");

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);

  // Dedicated Full-Page Transaction Details State
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);

  // Dedicated Full-Page Create Transaction View State
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<TxType>("SOLD");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemBatches, setItemBatches] = useState<StockBatchOption[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [txQuantity, setTxQuantity] = useState("1");
  const [customUnitPrice, setCustomUnitPrice] = useState("");
  const [txReason, setTxReason] = useState("");
  const [txNote, setTxNote] = useState("");

  // Purchase Specific (Approved POs)
  const [approvedPOs, setApprovedPOs] = useState<ApprovedPOOption[]>([]);
  const [selectedPOId, setSelectedPOId] = useState("");
  const [poReceiveItems, setPoReceiveItems] = useState<{
    [itemId: string]: { quantity: number; batchNumber: string; expiryDate: string; sellingPrice: string };
  }>({});

  // Customer Return Specific
  const [soldTransactions, setSoldTransactions] = useState<TransactionRecord[]>([]);
  const [selectedSoldTxId, setSelectedSoldTxId] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  // Load all transactions and items
  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<TransactionRecord[]>("/transaction/");
      setTransactions(data || []);
    } catch (err) {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    if (itemList.length === 0) {
      setLoadingItems(true);
      fetchItems().finally(() => setLoadingItems(false));
    }
  }, [fetchItems, itemList.length]);

  useEffect(() => {
    if (isCreating && itemList.length === 0) {
      setLoadingItems(true);
      fetchItems().finally(() => setLoadingItems(false));
    }
  }, [isCreating, fetchItems, itemList.length]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        t.item_name.toLowerCase().includes(q) ||
        t.sku.toLowerCase().includes(q) ||
        t.user_name.toLowerCase().includes(q) ||
        (t.batch_number && t.batch_number.toLowerCase().includes(q)) ||
        (t.supplier_name && t.supplier_name.toLowerCase().includes(q));

      const matchType = typeFilter === "ALL" || t.transaction_type === typeFilter;
      return matchSearch && matchType;
    });
  }, [transactions, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const pageTransactions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, page]);

  // Load batches when item is selected in form
  useEffect(() => {
    if (!selectedItemId || activeTab === "PURCHASE" || activeTab === "CUSTOMER_RETURN") {
      setItemBatches([]);
      setSelectedBatchId("");
      return;
    }
    setLoadingBatches(true);
    apiFetch<StockBatchOption[]>(`/transaction/batches/${selectedItemId}`)
      .then((data) => {
        setItemBatches(data || []);
        if (data && data.length > 0) {
          setSelectedBatchId(data[0].batch_id);
          const chosenItem = itemList.find((i) => i.id === selectedItemId);
          const price = data[0].selling_price ?? chosenItem?.sellingPrice ?? "";
          setCustomUnitPrice(price ? String(price) : "");
        } else {
          setSelectedBatchId("");
          setCustomUnitPrice("");
        }
      })
      .catch(() => {
        setItemBatches([]);
        setSelectedBatchId("");
      })
      .finally(() => {
        setLoadingBatches(false);
      });
  }, [selectedItemId, activeTab, itemList]);

  // When selected batch changes in SOLD tab, update customUnitPrice
  const handleBatchChange = (batchId: string) => {
    setSelectedBatchId(batchId);
    const chosenBatch = itemBatches.find((b) => b.batch_id === batchId);
    const chosenItem = itemList.find((i) => i.id === selectedItemId);
    const price = chosenBatch?.selling_price ?? chosenItem?.sellingPrice ?? "";
    setCustomUnitPrice(price ? String(price) : "");
  };

  // Load approved POs when tab is PURCHASE
  useEffect(() => {
    if (isCreating && activeTab === "PURCHASE") {
      apiFetch<ApprovedPOOption[]>("/purchas-orders/")
        .then((data) => {
          const approved = (data || []).filter(
            (po) => po.status === "Approved" || po.status === "Partially Received"
          );
          setApprovedPOs(approved);
          if (approved.length > 0) {
            setSelectedPOId(approved[0].po_id);
          }
        })
        .catch(() => setApprovedPOs([]));
    }
  }, [isCreating, activeTab]);

  // Initialize PO Receive Items
  useEffect(() => {
    if (!selectedPOId) {
      setPoReceiveItems({});
      return;
    }
    const po = approvedPOs.find((p) => p.po_id === selectedPOId);
    if (!po) return;

    const init: any = {};
    po.items.forEach((item) => {
      const remaining = Math.max(0, item.quantity - item.quantity_received);
      const matchedItem = itemList.find((i) => i.id === item.item_id);
      init[item.item_id] = {
        quantity: remaining,
        batchNumber: `BATCH-${item.sku}-${new Date().getFullYear()}`,
        expiryDate: "",
        sellingPrice: matchedItem?.sellingPrice ? String(matchedItem.sellingPrice) : "",
      };
    });
    setPoReceiveItems(init);
  }, [selectedPOId, approvedPOs, itemList]);

  // Load SOLD transactions when tab is CUSTOMER_RETURN
  useEffect(() => {
    if (isCreating && activeTab === "CUSTOMER_RETURN") {
      apiFetch<TransactionRecord[]>("/transaction/")
        .then((data) => {
          const sold = (data || []).filter((t) => t.transaction_type === "SOLD");
          setSoldTransactions(sold);
          if (sold.length > 0) {
            setSelectedSoldTxId(sold[0].transaction_id);
          }
        })
        .catch(() => setSoldTransactions([]));
    }
  }, [isCreating, activeTab]);

  // Handle Submit Transaction
  const handleSubmitTransaction = async () => {
    setFormError("");
    setSubmitting(true);

    try {
      if (activeTab === "PURCHASE") {
        if (!selectedPOId) throw new Error("Please select an approved purchase order.");
        const po = approvedPOs.find((p) => p.po_id === selectedPOId);
        if (!po) throw new Error("Invalid purchase order.");

        const linesToReceive = Object.entries(poReceiveItems)
          .filter(([_, v]) => v.quantity > 0 && v.batchNumber.trim().length > 0)
          .map(([itemId, v]) => ({
            item_id: itemId,
            quantity: Number(v.quantity),
            batch_number: v.batchNumber.trim(),
            expiry_date: v.expiryDate || null,
            selling_price: v.sellingPrice ? Number(v.sellingPrice) : null,
          }));

        if (linesToReceive.length === 0) {
          throw new Error("Please specify quantity and batch number for at least one item line.");
        }

        await apiFetch(`/purchas-orders/${selectedPOId}/receive`, {
          method: "POST",
          body: JSON.stringify({
            items: linesToReceive,
            note: txNote || "Goods received against PO",
          }),
        });
      } else if (activeTab === "SOLD") {
        if (!selectedItemId) throw new Error("Please select an item to sell.");
        const qty = parseInt(txQuantity, 10);
        if (isNaN(qty) || qty <= 0) throw new Error("Quantity must be at least 1.");
        const unitPrice = customUnitPrice ? parseFloat(customUnitPrice) : null;

        await apiFetch("/transaction/sell", {
          method: "POST",
          body: JSON.stringify({
            item_id: selectedItemId,
            batch_id: selectedBatchId || null,
            quantity: qty,
            unit_price: unitPrice,
            note: txNote || null,
          }),
        });
      } else if (activeTab === "CUSTOMER_RETURN") {
        if (!selectedSoldTxId) throw new Error("Please select the original sale transaction.");
        const qty = parseInt(txQuantity, 10);
        if (isNaN(qty) || qty <= 0) throw new Error("Return quantity must be at least 1.");

        await apiFetch("/transaction/customer-return", {
          method: "POST",
          body: JSON.stringify({
            sold_transaction_id: selectedSoldTxId,
            quantity: qty,
            reason: txReason || "Customer return",
            note: txNote || null,
          }),
        });
      } else if (activeTab === "DAMAGED") {
        if (!selectedItemId) throw new Error("Please select an item.");
        const qty = parseInt(txQuantity, 10);
        if (isNaN(qty) || qty <= 0) throw new Error("Quantity must be at least 1.");

        await apiFetch("/transaction/damaged", {
          method: "POST",
          body: JSON.stringify({
            item_id: selectedItemId,
            batch_id: selectedBatchId || null,
            quantity: qty,
            reason: txReason || "Damaged stock write-off",
            note: txNote || null,
          }),
        });
      } else if (activeTab === "EXPIRED") {
        if (!selectedItemId) throw new Error("Please select an item.");
        const qty = parseInt(txQuantity, 10);
        if (isNaN(qty) || qty <= 0) throw new Error("Quantity must be at least 1.");

        await apiFetch("/transaction/expired", {
          method: "POST",
          body: JSON.stringify({
            item_id: selectedItemId,
            batch_id: selectedBatchId || null,
            quantity: qty,
            reason: txReason || "Expired stock disposal",
            note: txNote || null,
          }),
        });
      } else if (activeTab === "ADJUSTMENT_INCREASE" || activeTab === "ADJUSTMENT_DECREASE") {
        if (!selectedItemId) throw new Error("Please select an item.");
        const qty = parseInt(txQuantity, 10);
        if (isNaN(qty) || qty <= 0) throw new Error("Adjustment quantity must be at least 1.");
        if (!txReason.trim()) throw new Error("Reason is mandatory for stock adjustments.");

        await apiFetch("/transaction/adjust", {
          method: "POST",
          body: JSON.stringify({
            item_id: selectedItemId,
            batch_id: selectedBatchId || null,
            transaction_type: activeTab,
            quantity: qty,
            reason: txReason.trim(),
            note: txNote || null,
          }),
        });
      }

      // Success Reset
      setIsCreating(false);
      setSelectedItemId("");
      setSelectedBatchId("");
      setTxQuantity("1");
      setCustomUnitPrice("");
      setTxReason("");
      setTxNote("");
      setSelectedPOId("");
      setSelectedSoldTxId("");

      await refreshItems();
      await loadTransactions();
    } catch (err: any) {
      setFormError(err.message || "Failed to record transaction.");
    } finally {
      setSubmitting(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 1. DEDICATED FULL-PAGE CREATE TRANSACTION VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (isCreating) {
    const selectedItemObj = itemList.find((i) => i.id === selectedItemId);
    const selectedBatchObj = itemBatches.find((b) => b.batch_id === selectedBatchId);
    const currentStock = selectedItemObj?.quantity ?? 0;
    const qtyNum = parseInt(txQuantity, 10) || 0;

    let projectedStock = currentStock;
    if (activeTab === "PURCHASE" || activeTab === "CUSTOMER_RETURN" || activeTab === "ADJUSTMENT_INCREASE") {
      projectedStock = currentStock + qtyNum;
    } else {
      projectedStock = Math.max(0, currentStock - qtyNum);
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        {/* Top Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => setIsCreating(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
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
              <ArrowLeft size={14} /> Back to Transactions
            </button>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: c.text, margin: 0 }}>
                Record Inventory Transaction
              </h1>
              <p style={{ fontSize: 12.5, color: c.textMuted, margin: "2px 0 0" }}>
                Select movement classification, configure item batch details, and post the entry to the ledger.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setIsCreating(false)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: c.surface,
                color: c.text,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitTransaction}
              disabled={submitting}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                background: c.accent,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Processing..." : "Submit Transaction"}
            </button>
          </div>
        </div>

        {formError && (
          <div
            style={{
              padding: "11px 16px",
              background: c.dangerSoft || "#FEF2F2",
              color: c.danger || "#DC2626",
              borderRadius: 8,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: `1px solid ${c.dangerSoft || "#FEE2E2"}`,
            }}
          >
            <AlertCircle size={15} />
            <span>{formError}</span>
          </div>
        )}

        {/* Transaction Type Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 8,
            background: c.surfaceMuted,
            padding: 6,
            borderRadius: 10,
            border: `1px solid ${c.border}`,
          }}
        >
          {[
            { id: "SOLD", label: "Customer Sale", icon: ShoppingCart },
            { id: "PURCHASE", label: "Receive PO", icon: Truck },
            { id: "CUSTOMER_RETURN", label: "Customer Return", icon: RotateCcw },
            { id: "DAMAGED", label: "Damaged Stock", icon: AlertTriangle },
            { id: "EXPIRED", label: "Expired Stock", icon: Clock },
            { id: "ADJUSTMENT_INCREASE", label: "Adjustment (+)", icon: Plus },
            { id: "ADJUSTMENT_DECREASE", label: "Adjustment (-)", icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as TxType);
                  setFormError("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "8px 10px",
                  borderRadius: 7,
                  border: isSelected ? `1px solid ${c.accent}` : "1px solid transparent",
                  background: isSelected ? c.surface : "transparent",
                  color: isSelected ? c.accent : c.textMuted,
                  fontSize: 12.5,
                  fontWeight: isSelected ? 600 : 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          {/* 1. PURCHASE RECEIVING WORKFLOW */}
          {activeTab === "PURCHASE" && (
            <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "20px" }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: c.text, display: "block", marginBottom: 6 }}>
                  Select Approved Purchase Order *
                </label>
                <select
                  value={selectedPOId}
                  onChange={(e) => setSelectedPOId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${c.border}`,
                    background: c.inputBg,
                    color: c.text,
                    fontSize: 13.5,
                    outline: "none",
                  }}
                >
                  <option value="">-- Choose Approved PO --</option>
                  {approvedPOs.map((po) => (
                    <option key={po.po_id} value={po.po_id}>
                      PO-{po.po_id.slice(0, 8).toUpperCase()} ({po.supplier_name}) — Status: {po.status}
                    </option>
                  ))}
                </select>
                {approvedPOs.length === 0 && (
                  <div style={{ fontSize: 12, color: c.textMuted, marginTop: 6 }}>
                    No approved purchase orders awaiting receipt. Approve a PO first in the Purchase Orders module.
                  </div>
                )}
              </div>

              {selectedPOId && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 8 }}>
                    PO Line Items & Batch Assignment
                  </div>
                  <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: c.surfaceMuted, color: c.textFaint, textAlign: "left" }}>
                          <th style={{ padding: "9px 12px" }}>Item & SKU</th>
                          <th style={{ padding: "9px 12px", width: 90 }}>Order Qty</th>
                          <th style={{ padding: "9px 12px", width: 100 }}>Receive Now</th>
                          <th style={{ padding: "9px 12px", width: 160 }}>Batch Lot # *</th>
                          <th style={{ padding: "9px 12px", width: 140 }}>Expiry Date</th>
                          <th style={{ padding: "9px 12px", width: 130 }}>Batch Sell Price ($)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {approvedPOs
                          .find((p) => p.po_id === selectedPOId)
                          ?.items.map((item) => {
                            const entry = poReceiveItems[item.item_id] || {
                              quantity: 0,
                              batchNumber: "",
                              expiryDate: "",
                              sellingPrice: "",
                            };
                            return (
                              <tr key={item.item_id} style={{ borderTop: `1px solid ${c.border}` }}>
                                <td style={{ padding: "10px 12px" }}>
                                  <div style={{ fontWeight: 600, color: c.text }}>{item.item_name}</div>
                                  <div style={{ fontSize: 11.5, color: c.textMuted, fontFamily: "monospace" }}>{item.sku}</div>
                                </td>
                                <td style={{ padding: "10px 12px", color: c.textMuted }}>
                                  {item.quantity} {item.unit}
                                </td>
                                <td style={{ padding: "10px 12px" }}>
                                  <input
                                    type="number"
                                    min="0"
                                    value={entry.quantity}
                                    onChange={(e) =>
                                      setPoReceiveItems({
                                        ...poReceiveItems,
                                        [item.item_id]: { ...entry, quantity: parseInt(e.target.value, 10) || 0 },
                                      })
                                    }
                                    style={{
                                      width: 75,
                                      padding: "6px 8px",
                                      borderRadius: 6,
                                      border: `1px solid ${c.border}`,
                                      fontSize: 12.5,
                                      background: c.inputBg,
                                      color: c.text,
                                    }}
                                  />
                                </td>
                                <td style={{ padding: "10px 12px" }}>
                                  <input
                                    value={entry.batchNumber}
                                    onChange={(e) =>
                                      setPoReceiveItems({
                                        ...poReceiveItems,
                                        [item.item_id]: { ...entry, batchNumber: e.target.value },
                                      })
                                    }
                                    placeholder="Batch Lot #"
                                    style={{
                                      width: "100%",
                                      padding: "6px 8px",
                                      borderRadius: 6,
                                      border: `1px solid ${c.border}`,
                                      fontSize: 12.5,
                                      background: c.inputBg,
                                      color: c.text,
                                      fontFamily: "monospace",
                                    }}
                                  />
                                </td>
                                <td style={{ padding: "10px 12px" }}>
                                  <input
                                    type="date"
                                    value={entry.expiryDate}
                                    onChange={(e) =>
                                      setPoReceiveItems({
                                        ...poReceiveItems,
                                        [item.item_id]: { ...entry, expiryDate: e.target.value },
                                      })
                                    }
                                    style={{
                                      width: "100%",
                                      padding: "5px 8px",
                                      borderRadius: 6,
                                      border: `1px solid ${c.border}`,
                                      fontSize: 12,
                                      background: c.inputBg,
                                      color: c.text,
                                    }}
                                  />
                                </td>
                                <td style={{ padding: "10px 12px" }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={entry.sellingPrice}
                                    onChange={(e) =>
                                      setPoReceiveItems({
                                        ...poReceiveItems,
                                        [item.item_id]: { ...entry, sellingPrice: e.target.value },
                                      })
                                    }
                                    style={{
                                      width: 95,
                                      padding: "6px 8px",
                                      borderRadius: 6,
                                      border: `1px solid ${c.border}`,
                                      fontSize: 12.5,
                                      background: c.inputBg,
                                      color: c.text,
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 500, color: c.textMuted, display: "block", marginBottom: 5 }}>
                      Receiving Audit Notes
                    </label>
                    <input
                      value={txNote}
                      onChange={(e) => setTxNote(e.target.value)}
                      placeholder="e.g., Goods received inspected and verified in warehouse."
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px solid ${c.border}`,
                        background: c.inputBg,
                        color: c.text,
                        fontSize: 13,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. CUSTOMER RETURN WORKFLOW */}
          {activeTab === "CUSTOMER_RETURN" && (
            <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: c.text, display: "block", marginBottom: 6 }}>
                  Select Original Sale Transaction *
                </label>
                <select
                  value={selectedSoldTxId}
                  onChange={(e) => setSelectedSoldTxId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: `1px solid ${c.border}`,
                    background: c.inputBg,
                    color: c.text,
                    fontSize: 13.5,
                    outline: "none",
                  }}
                >
                  <option value="">-- Choose Sale Transaction --</option>
                  {soldTransactions.map((tx) => (
                    <option key={tx.transaction_id} value={tx.transaction_id}>
                      {tx.item_name} ({tx.sku}) · Qty Sold: {tx.quantity} · ${Number(tx.unit_price || 0).toFixed(2)} · {new Date(tx.transaction_date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: c.textMuted, display: "block", marginBottom: 5 }}>
                    Return Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={txQuantity}
                    onChange={(e) => setTxQuantity(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${c.border}`,
                      background: c.inputBg,
                      color: c.text,
                      fontSize: 13.5,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 500, color: c.textMuted, display: "block", marginBottom: 5 }}>
                    Return Reason
                  </label>
                  <input
                    value={txReason}
                    onChange={(e) => setTxReason(e.target.value)}
                    placeholder="e.g., Wrong size / Customer changed mind"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${c.border}`,
                      background: c.inputBg,
                      color: c.text,
                      fontSize: 13.5,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: c.textMuted, display: "block", marginBottom: 5 }}>
                  Inspection / Additional Notes
                </label>
                <input
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder="e.g., Item verified intact in unopened packaging, returned to stock."
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${c.border}`,
                    background: c.inputBg,
                    color: c.text,
                    fontSize: 13,
                  }}
                />
              </div>
            </div>
          )}

          {/* 3. ITEM & BATCH WORKFLOW (SALE, DAMAGE, EXPIRED, ADJUSTMENTS) */}
          {activeTab !== "PURCHASE" && activeTab !== "CUSTOMER_RETURN" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
              {/* Left Column: Form Fields */}
              <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: c.text, display: "block", marginBottom: 6 }}>
                    Select Inventory Item *
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: `1px solid ${c.border}`,
                      background: c.inputBg,
                      color: c.text,
                      fontSize: 13.5,
                      outline: "none",
                    }}
                  >
                    <option value="">
                      {loadingItems ? "-- Loading inventory items... --" : "-- Choose Item --"}
                    </option>
                    {itemList.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.itemName} ({i.sku}) — In Stock: {i.quantity} {i.unit}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedItemId && (
                  <>
                    <div>
                      <label style={{ fontSize: 12.5, fontWeight: 600, color: c.text, display: "block", marginBottom: 6 }}>
                        Stock Batch / Lot {activeTab === "SOLD" ? "(FIFO Selection)" : ""}
                      </label>
                      {loadingBatches ? (
                        <div style={{ fontSize: 12, color: c.textMuted }}>Loading batches...</div>
                      ) : (
                        <select
                          value={selectedBatchId}
                          onChange={(e) => handleBatchChange(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            borderRadius: 8,
                            border: `1px solid ${c.border}`,
                            background: c.inputBg,
                            color: c.text,
                            fontSize: 13,
                            outline: "none",
                          }}
                        >
                          {itemBatches.length === 0 ? (
                            <option value="">-- No specific batch (General Stock) --</option>
                          ) : (
                            itemBatches.map((b) => (
                              <option key={b.batch_id} value={b.batch_id}>
                                Batch: {b.batch_number} (Qty: {b.current_quantity} | Cost: ${Number(b.purchase_price).toFixed(2)} | Sell: ${Number(b.selling_price || selectedItemObj?.sellingPrice || 0).toFixed(2)})
                              </option>
                            ))
                          )}
                        </select>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: activeTab === "SOLD" ? "1fr 1fr" : "1fr", gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 12.5, fontWeight: 500, color: c.textMuted, display: "block", marginBottom: 5 }}>
                          Quantity ({selectedItemObj?.unit || "units"}) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={activeTab === "SOLD" || activeTab === "DAMAGED" || activeTab === "EXPIRED" ? currentStock : undefined}
                          value={txQuantity}
                          onChange={(e) => setTxQuantity(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: `1px solid ${c.border}`,
                            background: c.inputBg,
                            color: c.text,
                            fontSize: 13.5,
                          }}
                        />
                      </div>

                      {activeTab === "SOLD" && (
                        <div>
                          <label style={{ fontSize: 12.5, fontWeight: 500, color: c.textMuted, display: "block", marginBottom: 5 }}>
                            Selling Price / Unit ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={customUnitPrice}
                            onChange={(e) => setCustomUnitPrice(e.target.value)}
                            placeholder={selectedItemObj ? String(selectedItemObj.sellingPrice) : "0.00"}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: `1px solid ${c.border}`,
                              background: c.inputBg,
                              color: c.text,
                              fontSize: 13.5,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {(activeTab === "DAMAGED" ||
                      activeTab === "EXPIRED" ||
                      activeTab === "ADJUSTMENT_INCREASE" ||
                      activeTab === "ADJUSTMENT_DECREASE") && (
                      <div>
                        <label style={{ fontSize: 12.5, fontWeight: 500, color: c.textMuted, display: "block", marginBottom: 5 }}>
                          Reason / Audit Justification *
                        </label>
                        <input
                          value={txReason}
                          onChange={(e) => setTxReason(e.target.value)}
                          placeholder={
                            activeTab.includes("ADJUSTMENT")
                              ? "e.g., Annual physical stock count reconciliation variance"
                              : "e.g., Water damage during storage"
                          }
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: `1px solid ${c.border}`,
                            background: c.inputBg,
                            color: c.text,
                            fontSize: 13.5,
                          }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: 12.5, fontWeight: 500, color: c.textMuted, display: "block", marginBottom: 5 }}>
                        Additional Notes / Reference
                      </label>
                      <input
                        value={txNote}
                        onChange={(e) => setTxNote(e.target.value)}
                        placeholder="e.g., Invoice #INV-8891 or Warehouse Bay #3"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: `1px solid ${c.border}`,
                          background: c.inputBg,
                          color: c.text,
                          fontSize: 13,
                        }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Right Column: Live Summary Preview */}
              <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.text, borderBottom: `1px solid ${c.border}`, paddingBottom: 8 }}>
                  Transaction Impact Preview
                </div>

                {selectedItemObj ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: c.textMuted }}>Target Item</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{selectedItemObj.itemName}</div>
                      <div style={{ fontSize: 12, color: c.textMuted, fontFamily: "monospace" }}>{selectedItemObj.sku}</div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: c.surfaceMuted, padding: 12, borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 11.5, color: c.textMuted }}>Current Stock</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>
                          {currentStock} {selectedItemObj.unit}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11.5, color: c.textMuted }}>Post-Movement</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: projectedStock <= 0 ? "#DC2626" : "#2E7D32" }}>
                          {projectedStock} {selectedItemObj.unit}
                        </div>
                      </div>
                    </div>

                    {activeTab === "SOLD" && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${c.border}`, paddingTop: 10 }}>
                        <span style={{ fontSize: 12.5, color: c.textMuted }}>Total Sale Value:</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: c.text }}>
                          ${(qtyNum * (customUnitPrice ? parseFloat(customUnitPrice) : Number(selectedItemObj.sellingPrice || 0))).toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>
                      Operator: <strong style={{ color: "#2563EB" }}>@{loggedInUser?.username || "admin"}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "30px 10px", textAlign: "center", color: c.textFaint, fontSize: 13 }}>
                    Select an item to view live stock impact and verification metrics.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. DEDICATED FULL-PAGE TRANSACTION DETAILS VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (selectedTx) {
    const isPositive =
      selectedTx.transaction_type === "PURCHASE" ||
      selectedTx.transaction_type === "CUSTOMER_RETURN" ||
      selectedTx.transaction_type === "ADJUSTMENT_INCREASE";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Top Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => setSelectedTx(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
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
              <ArrowLeft size={14} /> Back to Transactions
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: c.text, margin: 0 }}>
                  TX-{selectedTx.transaction_id.slice(0, 8).toUpperCase()}
                </h1>
                <TransactionTypeIndicator type={selectedTx.transaction_type} />
              </div>
              <div style={{ fontSize: 12.5, color: c.textMuted, marginTop: 4 }}>
                Recorded on {new Date(selectedTx.transaction_date).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Overview Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {/* Item & Batch Card */}
          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Item & Sourcing</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.text, marginTop: 4 }}>
              {selectedTx.item_name}
            </div>
            <div style={{ fontSize: 12, color: c.textMuted, fontFamily: "monospace", marginTop: 2 }}>
              {selectedTx.sku}
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: c.textMuted, display: "flex", flexDirection: "column", gap: 3 }}>
              <div>Supplier: <strong style={{ color: c.text }}>{selectedTx.supplier_name || "—"}</strong></div>
              <div>Batch Lot: <strong style={{ color: c.text, fontFamily: "monospace" }}>{selectedTx.batch_number || "—"}</strong></div>
            </div>
          </div>

          {/* Stock Quantity Movement Card */}
          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Quantity Movement</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: isPositive ? "#2E7D32" : "#DC2626", marginTop: 4 }}>
              {isPositive ? `+${selectedTx.quantity}` : `-${selectedTx.quantity}`} units
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: c.textMuted }}>
              Before: <strong style={{ color: c.text }}>{selectedTx.previous_quantity}</strong> → After: <strong style={{ color: c.text }}>{selectedTx.new_quantity}</strong>
            </div>
          </div>

          {/* Price & Financials Card */}
          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Pricing & Valuation</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.text, marginTop: 4 }}>
              {selectedTx.unit_price ? `$${Number(selectedTx.unit_price).toFixed(2)}` : "—"}
            </div>
            <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>Unit Price</div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: c.textMuted }}>
              Total Value: <strong style={{ color: c.text }}>
                {selectedTx.unit_price ? `$${(selectedTx.quantity * Number(selectedTx.unit_price)).toFixed(2)}` : "—"}
              </strong>
            </div>
          </div>

          {/* Operator Audit Card */}
          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Operator & Audit</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#2563EB", marginTop: 4 }}>
              @{selectedTx.user_name}
            </div>
            <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>
              {selectedTx.user_full_name || "System Operator"}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: c.textMuted }}>
              ID: <span style={{ fontFamily: "monospace" }}>{selectedTx.user_id ? selectedTx.user_id.slice(0, 8) : "SYSTEM"}</span>
            </div>
          </div>
        </div>

        {/* Detailed Remarks Card */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "20px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 12 }}>
            Transaction Remarks & References
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: c.textMuted }}>Reason</div>
              <div style={{ fontSize: 13.5, color: c.text, marginTop: 4 }}>
                {selectedTx.reason || "Standard inventory stock movement."}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: c.textMuted }}>Notes / Memo</div>
              <div style={{ fontSize: 13.5, color: c.text, marginTop: 4 }}>
                {selectedTx.note || "No additional notes recorded."}
              </div>
            </div>
            {selectedTx.po_id && (
              <div>
                <div style={{ fontSize: 12, color: c.textMuted }}>Linked Purchase Order</div>
                <div style={{ fontSize: 13.5, color: c.accent, fontFamily: "monospace", marginTop: 4 }}>
                  PO-{selectedTx.po_id.slice(0, 8).toUpperCase()}
                </div>
              </div>
            )}
            {selectedTx.reference_transaction_id && (
              <div>
                <div style={{ fontSize: 12, color: c.textMuted }}>Reference Sale Transaction</div>
                <div style={{ fontSize: 13.5, color: c.accent, fontFamily: "monospace", marginTop: 4 }}>
                  TX-{selectedTx.reference_transaction_id.slice(0, 8).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. MAIN TRANSACTIONS TABLE VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Search & Filter Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260, maxWidth: 360 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderRadius: 8,
              border: `1px solid ${c.border}`,
              background: c.inputBg,
              width: "100%",
            }}
          >
            <Search size={14} color={c.textFaint} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search item, SKU, operator, batch..."
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                color: c.text,
                fontSize: 13,
                width: "100%",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Type Filter */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setTypeMenuOpen(!typeMenuOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 8,
                border: `1px solid ${typeFilter !== "ALL" ? c.accent : c.border}`,
                background: typeFilter !== "ALL" ? c.accentSoft : c.surface,
                color: typeFilter !== "ALL" ? c.accent : c.text,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <Filter size={13} />
              {typeFilter === "ALL" ? "All Types" : typeFilter}
              <ChevronDown size={13} />
            </button>

            {typeMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 4,
                  width: 190,
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 8,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
                  zIndex: 20,
                  padding: 4,
                }}
              >
                {[
                  { id: "ALL", label: "All Types" },
                  { id: "SOLD", label: "Sale" },
                  { id: "PURCHASE", label: "Purchase Receipt" },
                  { id: "CUSTOMER_RETURN", label: "Customer Return" },
                  { id: "DAMAGED", label: "Damaged Stock" },
                  { id: "EXPIRED", label: "Expired Stock" },
                  { id: "ADJUSTMENT_INCREASE", label: "Adjustment (+)" },
                  { id: "ADJUSTMENT_DECREASE", label: "Adjustment (-)" },
                ].map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => {
                      setTypeFilter(opt.id);
                      setTypeMenuOpen(false);
                      setPage(1);
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 6,
                      fontSize: 12.5,
                      cursor: "pointer",
                      background: typeFilter === opt.id ? c.surfaceMuted : "transparent",
                      color: typeFilter === opt.id ? c.accent : c.text,
                    }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* New Transaction Button */}
          {!readOnly && (
            <button
              onClick={() => setIsCreating(true)}
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
              <Plus size={15} /> New Transaction
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: c.textFaint, textAlign: "left", background: c.surfaceMuted }}>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Type</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Item & SKU</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Batch #</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Qty Change</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Operator</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: c.textMuted }}>
                    Loading transaction logs...
                  </td>
                </tr>
              ) : pageTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: c.textFaint }}>
                    No transactions found.
                  </td>
                </tr>
              ) : (
                pageTransactions.map((t) => {
                  const isPositive =
                    t.transaction_type === "PURCHASE" ||
                    t.transaction_type === "CUSTOMER_RETURN" ||
                    t.transaction_type === "ADJUSTMENT_INCREASE";

                  return (
                    <tr
                      key={t.transaction_id}
                      onClick={() => setSelectedTx(t)}
                      style={{
                        borderTop: `1px solid ${c.border}`,
                        cursor: "pointer",
                      }}
                    >
                      <td style={{ padding: "12px 14px" }}>
                        <TransactionTypeIndicator type={t.transaction_type} />
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 600, color: c.text }}>{t.item_name}</div>
                        <div style={{ fontSize: 11.5, color: c.textMuted, fontFamily: "monospace" }}>{t.sku}</div>
                      </td>
                      <td style={{ padding: "12px 14px", color: c.textMuted, fontFamily: "monospace" }}>
                        {t.batch_number || "—"}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: isPositive ? "#2E7D32" : "#DC2626" }}>
                        {isPositive ? `+${t.quantity}` : `-${t.quantity}`}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontWeight: 600, color: "#2563EB", fontSize: 12.5 }}>
                          @{t.user_name}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", color: c.textFaint }}>
                        {new Date(t.transaction_date).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length > PAGE_SIZE && (
          <div style={{ borderTop: `1px solid ${c.border}` }}>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={filteredTransactions.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              c={c}
            />
          </div>
        )}
      </div>
    </div>
  );
}
