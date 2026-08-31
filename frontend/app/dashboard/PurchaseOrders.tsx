"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  X,
  Check,
  Building2,
  FileText,
  Trash2,
  Filter,
  Download,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Package,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Pagination } from "@/components/ui";

// ── Types ──────────────────────────────────────────────────
export type POStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Partially Received"
  | "Completed"
  | "Cancelled";

interface Supplier {
  id: string;
  supplierName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
}

interface POItemResponse {
  poi_id: string;
  po_id: string;
  item_id: string;
  item_name: string;
  sku: string;
  unit: string;
  quantity: number;
  quantity_received: number;
  unit_price: number;
  total_price: number;
}

interface PurchaseOrder {
  po_id: string;
  supplier_id: string;
  supplier_name: string;
  status: POStatus;
  notes?: string | null;
  created_at: string;
  created_by?: string | null;
  total_items: number;
  total_amount: number;
  items: POItemResponse[];
}

interface SupplierItemOption {
  item_id: string;
  item_name: string;
  sku: string;
  unit: string;
  agreed_price: number;
  is_primary: boolean;
}

interface PurchaseOrdersProps {
  c: any;
  supplierList: Supplier[];
}

// ── Minimal Status Indicator ───────────────────────────────
function POStatusIndicator({ status }: { status: POStatus }) {
  const map: Record<POStatus, { color: string; label: string }> = {
    Draft: { color: "#64748B", label: "Draft" },
    "Pending Approval": { color: "#D97706", label: "Pending Approval" },
    Approved: { color: "#2563EB", label: "Approved" },
    "Partially Received": { color: "#7C3AED", label: "Partially Received" },
    Completed: { color: "#2E7D32", label: "Completed" },
    Cancelled: { color: "#DC2626", label: "Cancelled" },
  };
  const s = map[status] || { color: "#64748B", label: status };

  return (
    <span
      style={{
        fontSize: 12.5,
        fontWeight: 500,
        color: s.color,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
      {s.label}
    </span>
  );
}

// ============================================================================
// Main Purchase Orders Component
// ============================================================================
export default function PurchaseOrders({ c, supplierList }: PurchaseOrdersProps) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [supplierMenuOpen, setSupplierMenuOpen] = useState(false);

  // Dedicated Full-Page PO View
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Create PO Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [availableItems, setAvailableItems] = useState<SupplierItemOption[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [orderItems, setOrderItems] = useState<{ [itemId: string]: { selected: boolean; quantity: number } }>({});
  const [poNotes, setPoNotes] = useState("");
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Fetch all purchase orders
  const loadPurchaseOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<PurchaseOrder[]>("/purchas-orders/");
      setOrders(data || []);
    } catch (err) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPurchaseOrders();
  }, [loadPurchaseOrders]);

  // Load items linked to the selected supplier (with agreed prices)
  useEffect(() => {
    if (!selectedSupplierId) {
      setAvailableItems([]);
      setOrderItems({});
      return;
    }
    setLoadingItems(true);
    setCreateError("");
    apiFetch<SupplierItemOption[]>(`/suppliers/${selectedSupplierId}/items`)
      .then((data) => {
        setAvailableItems(data || []);
        const init: { [itemId: string]: { selected: boolean; quantity: number } } = {};
        (data || []).forEach((item) => {
          init[item.item_id] = { selected: false, quantity: 10 };
        });
        setOrderItems(init);
      })
      .catch((err) => {
        setAvailableItems([]);
        setCreateError(err.message || "Failed to load supplier items.");
      })
      .finally(() => {
        setLoadingItems(false);
      });
  }, [selectedSupplierId]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((po) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        po.po_id.toLowerCase().includes(q) ||
        po.supplier_name.toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || po.status === statusFilter;
      const matchSupplier = supplierFilter === "ALL" || po.supplier_id === supplierFilter;
      return matchSearch && matchStatus && matchSupplier;
    });
  }, [orders, search, statusFilter, supplierFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pageOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, page]);

  // Total amount calculated in create modal
  const createModalTotal = useMemo(() => {
    let total = 0;
    availableItems.forEach((item) => {
      const entry = orderItems[item.item_id];
      if (entry?.selected && entry.quantity > 0) {
        total += item.agreed_price * entry.quantity;
      }
    });
    return total;
  }, [availableItems, orderItems]);

  // Create Purchase Order Submit
  const handleCreatePO = async () => {
    setCreateError("");
    if (!selectedSupplierId) {
      setCreateError("Please select a vendor supplier.");
      return;
    }

    const selectedLines = availableItems
      .filter((item) => orderItems[item.item_id]?.selected && orderItems[item.item_id].quantity > 0)
      .map((item) => ({
        item_id: item.item_id,
        quantity: orderItems[item.item_id].quantity,
      }));

    if (selectedLines.length === 0) {
      setCreateError("Please select at least one item to include in this purchase order.");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/purchas-orders/", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: selectedSupplierId,
          notes: poNotes.trim() || null,
          items: selectedLines,
        }),
      });

      await loadPurchaseOrders();
      setCreateModalOpen(false);
      setSelectedSupplierId("");
      setPoNotes("");
      setOrderItems({});
    } catch (err: any) {
      setCreateError(err.message || "Failed to create purchase order.");
    } finally {
      setSubmitting(false);
    }
  };

  // State machine transition actions
  const handleUpdateStatus = async (poId: string, newStatus: POStatus) => {
    try {
      const updated = await apiFetch<PurchaseOrder>(`/purchas-orders/${poId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await loadPurchaseOrders();
      if (selectedPO && selectedPO.po_id === poId) {
        setSelectedPO(updated);
      }
    } catch (err: any) {
      alert(err.message || `Failed to update status to ${newStatus}.`);
    }
  };

  // Download PDF
  const handleDownloadPDF = async (poId: string) => {
    try {
      const res = await fetch(`/api/v1/purchas-orders/${poId}/pdf`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PurchaseOrder-${poId.slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download PO PDF.");
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DEDICATED FULL-PAGE PURCHASE ORDER DETAILS VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (selectedPO) {
    const activeSupplier = supplierList.find((s) => s.id === selectedPO.supplier_id);
    const isCompleted = selectedPO.status === "Completed";
    const isCancelled = selectedPO.status === "Cancelled";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Top Header & Actions Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            borderBottom: `1px solid ${c.border}`,
            paddingBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => setSelectedPO(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
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
              <ArrowLeft size={14} /> Back to Orders
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: c.text, margin: 0 }}>
                  PO-{selectedPO.po_id.slice(0, 8).toUpperCase()}
                </h1>
                <POStatusIndicator status={selectedPO.status} />
              </div>
              <div style={{ fontSize: 12.5, color: c.textMuted, marginTop: 4 }}>
                Created on {new Date(selectedPO.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {selectedPO.status === "Draft" && (
              <button
                onClick={() => handleUpdateStatus(selectedPO.po_id, "Pending Approval")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: c.accent,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Submit for Approval
              </button>
            )}

            {selectedPO.status === "Pending Approval" && (
              <button
                onClick={() => handleUpdateStatus(selectedPO.po_id, "Approved")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "#2E7D32",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <CheckCircle size={14} /> Approve Order
              </button>
            )}

            {!isCompleted && !isCancelled && (
              <button
                onClick={() => handleUpdateStatus(selectedPO.po_id, "Cancelled")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: `1px solid #F8D7DA`,
                  background: "#FDF2F2",
                  color: "#DC2626",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <XCircle size={14} /> Cancel Order
              </button>
            )}

            <button
              onClick={() => handleDownloadPDF(selectedPO.po_id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: c.surface,
                color: c.text,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Download size={14} /> Download PDF
            </button>
          </div>
        </div>

        {/* Summary Overview Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {/* Supplier Info Card */}
          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Vendor Supplier</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.text, marginTop: 4 }}>
              {selectedPO.supplier_name}
            </div>
            {activeSupplier && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: c.textMuted, display: "flex", flexDirection: "column", gap: 3 }}>
                <div>Contact: <strong style={{ color: c.text }}>{activeSupplier.contactPerson}</strong></div>
                <div>Phone: {activeSupplier.phone} · {activeSupplier.email}</div>
                <div>Address: {activeSupplier.address}</div>
              </div>
            )}
          </div>

          {/* Financial Summary Card */}
          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Total Order Value</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#2E7D32", marginTop: 4 }}>
              ${Number(selectedPO.total_amount).toFixed(2)}
            </div>
            <div style={{ fontSize: 12.5, color: c.textMuted, marginTop: 6 }}>
              {selectedPO.items?.length || 0} line items ordered
            </div>
          </div>
        </div>

        {selectedPO.notes && (
          <div
            style={{
              background: c.surfaceMuted,
              border: `1px solid ${c.border}`,
              borderRadius: 10,
              padding: "12px 16px",
              fontSize: 13,
              color: c.textMuted,
            }}
          >
            <strong style={{ color: c.text }}>Order Notes: </strong>
            {selectedPO.notes}
          </div>
        )}

        {/* Line Items Table with Receiving Progress */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: c.text, margin: 0 }}>
              Order Line Items & Delivery Status
            </h2>
            <p style={{ fontSize: 12, color: c.textMuted, margin: "3px 0 0 0" }}>
              Fixed agreed pricing locked from supplier sourcing agreement.
            </p>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: c.textFaint, textAlign: "left", borderBottom: `1px solid ${c.border}` }}>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Item & SKU</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Agreed Unit Price</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Ordered</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Received</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500 }}>Delivery Progress</th>
                  <th style={{ padding: "8px 12px", fontWeight: 500, textAlign: "right" }}>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedPO.items?.map((item) => {
                  const progressPct = item.quantity > 0 ? Math.min(100, Math.round((item.quantity_received / item.quantity) * 100)) : 0;
                  return (
                    <tr key={item.poi_id} style={{ borderBottom: `1px solid ${c.border}` }}>
                      <td style={{ padding: "12px 12px" }}>
                        <div style={{ fontWeight: 600, color: c.text }}>{item.item_name}</div>
                        <div style={{ fontSize: 11.5, color: c.textMuted, fontFamily: "monospace" }}>
                          {item.sku}
                        </div>
                      </td>
                      <td style={{ padding: "12px 12px", color: c.text }}>
                        ${Number(item.unit_price).toFixed(2)}
                      </td>
                      <td style={{ padding: "12px 12px", fontWeight: 600, color: c.text }}>
                        {item.quantity} <span style={{ fontSize: 11.5, color: c.textMuted }}>{item.unit}</span>
                      </td>
                      <td style={{ padding: "12px 12px", fontWeight: 600, color: item.quantity_received >= item.quantity ? "#2E7D32" : "#D97706" }}>
                        {item.quantity_received} <span style={{ fontSize: 11.5, color: c.textMuted }}>{item.unit}</span>
                      </td>
                      <td style={{ padding: "12px 12px", width: 180 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: c.surfaceMuted, borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${progressPct}%`, height: "100%", background: progressPct >= 100 ? "#2E7D32" : c.accent }} />
                          </div>
                          <span style={{ fontSize: 11.5, color: c.textMuted, width: 34 }}>{progressPct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 600, color: c.text }}>
                        ${Number(item.total_price).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MAIN PURCHASE ORDERS TABLE VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240, maxWidth: 400 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 8,
              padding: "7px 12px",
              width: "100%",
            }}
          >
            <Search size={14} color={c.textMuted} />
            <input
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 13,
                color: c.text,
                width: "100%",
                fontFamily: "inherit",
              }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search PO ID, Supplier..."
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Status Filter */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => {
                setStatusMenuOpen(!statusMenuOpen);
                setSupplierMenuOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 8,
                border: `1px solid ${statusFilter !== "ALL" ? c.accent : c.border}`,
                background: statusFilter !== "ALL" ? c.accentSoft : c.surface,
                color: statusFilter !== "ALL" ? c.accent : c.text,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <Filter size={13} />
              {statusFilter === "ALL" ? "All Statuses" : statusFilter}
            </button>

            {statusMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 4,
                  width: 180,
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 8,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
                  zIndex: 20,
                  padding: 4,
                }}
              >
                {["ALL", "Draft", "Pending Approval", "Approved", "Partially Received", "Completed", "Cancelled"].map((st) => (
                  <div
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setStatusMenuOpen(false);
                      setPage(1);
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 6,
                      fontSize: 12.5,
                      cursor: "pointer",
                      background: statusFilter === st ? c.surfaceMuted : "transparent",
                      color: statusFilter === st ? c.accent : c.text,
                    }}
                  >
                    {st === "ALL" ? "All Statuses" : st}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supplier Filter */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => {
                setSupplierMenuOpen(!supplierMenuOpen);
                setStatusMenuOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 8,
                border: `1px solid ${supplierFilter !== "ALL" ? c.accent : c.border}`,
                background: supplierFilter !== "ALL" ? c.accentSoft : c.surface,
                color: supplierFilter !== "ALL" ? c.accent : c.text,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <Building2 size={13} />
              {supplierFilter === "ALL" ? "All Suppliers" : supplierList.find((s) => s.id === supplierFilter)?.supplierName || "Supplier"}
            </button>

            {supplierMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 4,
                  width: 220,
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 8,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
                  zIndex: 20,
                  padding: 4,
                }}
              >
                <div
                  onClick={() => {
                    setSupplierFilter("ALL");
                    setSupplierMenuOpen(false);
                    setPage(1);
                  }}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 6,
                    fontSize: 12.5,
                    cursor: "pointer",
                    background: supplierFilter === "ALL" ? c.surfaceMuted : "transparent",
                    color: supplierFilter === "ALL" ? c.accent : c.text,
                  }}
                >
                  All Suppliers
                </div>
                {supplierList.map((sup) => (
                  <div
                    key={sup.id}
                    onClick={() => {
                      setSupplierFilter(sup.id);
                      setSupplierMenuOpen(false);
                      setPage(1);
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 6,
                      fontSize: 12.5,
                      cursor: "pointer",
                      background: supplierFilter === sup.id ? c.surfaceMuted : "transparent",
                      color: supplierFilter === sup.id ? c.accent : c.text,
                    }}
                  >
                    {sup.supplierName}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setCreateModalOpen(true)}
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
            <Plus size={15} /> Create PO
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: c.textFaint, textAlign: "left", background: c.surfaceMuted }}>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>PO Number</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Supplier</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Items</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Total Value</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Status</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Date Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: c.textMuted }}>
                    Loading purchase orders...
                  </td>
                </tr>
              ) : pageOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: c.textFaint }}>
                    No purchase orders found.
                  </td>
                </tr>
              ) : (
                pageOrders.map((po) => (
                  <tr
                    key={po.po_id}
                    onClick={() => setSelectedPO(po)}
                    style={{
                      borderTop: `1px solid ${c.border}`,
                      cursor: "pointer",
                    }}
                  >
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: c.text, fontFamily: "monospace" }}>
                      PO-{po.po_id.slice(0, 8).toUpperCase()}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 500, color: c.text }}>
                      {po.supplier_name}
                    </td>
                    <td style={{ padding: "12px 14px", color: c.textMuted }}>
                      {po.items?.length || po.total_items || 0} items
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: c.text }}>
                      ${Number(po.total_amount).toFixed(2)}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <POStatusIndicator status={po.status} />
                    </td>
                    <td style={{ padding: "12px 14px", color: c.textFaint }}>
                      {new Date(po.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredOrders.length > PAGE_SIZE && (
          <div style={{ borderTop: `1px solid ${c.border}` }}>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={filteredOrders.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              c={c}
            />
          </div>
        )}
      </div>

      {/* Create Purchase Order Modal */}
      {createModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: c.surface,
              borderRadius: 14,
              border: `1px solid ${c.border}`,
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
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
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 700, color: c.text, margin: 0 }}>
                Create Purchase Order
              </h2>
              <button
                onClick={() => setCreateModalOpen(false)}
                style={{ background: "none", border: "none", color: c.textMuted, cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "18px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              {createError && (
                <div style={{ padding: "9px 12px", background: c.dangerSoft, color: c.danger, borderRadius: 8, fontSize: 12.5 }}>
                  {createError}
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: c.textMuted, display: "block", marginBottom: 5 }}>
                  Select Vendor Supplier *
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 11px",
                    borderRadius: 8,
                    border: `1px solid ${c.border}`,
                    background: c.inputBg,
                    color: c.text,
                    fontSize: 13.5,
                    outline: "none",
                  }}
                >
                  <option value="">-- Choose Supplier --</option>
                  {supplierList.filter((s) => s.active).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplierName}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11.5, color: c.textFaint, marginTop: 4 }}>
                  Rule: Only 1 active purchase order is permitted per vendor.
                </div>
              </div>

              {selectedSupplierId && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: c.textMuted, display: "block", marginBottom: 8 }}>
                    Select Items to Order (Agreed Prices Locked)
                  </label>

                  {loadingItems ? (
                    <div style={{ padding: "16px 0", textAlign: "center", color: c.textMuted, fontSize: 13 }}>
                      Loading supplier catalog...
                    </div>
                  ) : availableItems.length === 0 ? (
                    <div style={{ padding: "16px 0", textAlign: "center", color: c.textFaint, fontSize: 13 }}>
                      No items linked to this supplier. Link items from the Items page first.
                    </div>
                  ) : (
                    <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: c.surfaceMuted, color: c.textFaint, textAlign: "left" }}>
                            <th style={{ padding: "7px 10px", width: 30 }}></th>
                            <th style={{ padding: "7px 10px" }}>Item & SKU</th>
                            <th style={{ padding: "7px 10px" }}>Agreed Unit Price</th>
                            <th style={{ padding: "7px 10px", width: 110 }}>Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availableItems.map((item) => {
                            const isSelected = orderItems[item.item_id]?.selected || false;
                            const qty = orderItems[item.item_id]?.quantity || 10;
                            return (
                              <tr key={item.item_id} style={{ borderTop: `1px solid ${c.border}`, background: isSelected ? c.surfaceMuted : "transparent" }}>
                                <td style={{ padding: "8px 10px" }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) =>
                                      setOrderItems((prev) => ({
                                        ...prev,
                                        [item.item_id]: { ...prev[item.item_id], selected: e.target.checked },
                                      }))
                                    }
                                  />
                                </td>
                                <td style={{ padding: "8px 10px" }}>
                                  <div style={{ fontWeight: 600, color: c.text }}>{item.item_name}</div>
                                  <div style={{ fontSize: 11, color: c.textMuted, fontFamily: "monospace" }}>{item.sku}</div>
                                </td>
                                <td style={{ padding: "8px 10px", fontWeight: 600, color: c.text }}>
                                  ${Number(item.agreed_price).toFixed(2)}
                                </td>
                                <td style={{ padding: "8px 10px" }}>
                                  <input
                                    type="number"
                                    min="1"
                                    disabled={!isSelected}
                                    value={qty}
                                    onChange={(e) =>
                                      setOrderItems((prev) => ({
                                        ...prev,
                                        [item.item_id]: { ...prev[item.item_id], quantity: Math.max(1, parseInt(e.target.value, 10) || 1) },
                                      }))
                                    }
                                    style={{
                                      width: 70,
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      border: `1px solid ${c.border}`,
                                      fontSize: 12,
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: c.textMuted, display: "block", marginBottom: 5 }}>
                  Order Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Delivery terms, special instructions..."
                  style={{
                    width: "100%",
                    padding: "8px 11px",
                    borderRadius: 8,
                    border: `1px solid ${c.border}`,
                    background: c.inputBg,
                    color: c.text,
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              {createModalTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: c.surfaceMuted, borderRadius: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: c.textMuted }}>Total Estimated Order Value:</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#2E7D32" }}>${createModalTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ padding: "14px 20px", borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: `1px solid ${c.border}`,
                  background: c.surface,
                  color: c.text,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !selectedSupplierId}
                onClick={handleCreatePO}
                style={{
                  padding: "8px 16px",
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
                {submitting ? "Creating..." : "Save Purchase Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
