"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Plus, Search, ChevronLeft, ChevronRight, X, Check, ArrowLeft, Save, Sparkles, FileText, Trash2
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────
interface Supplier {
  id: string;
  supplierName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  notes: string;
  totalSupplies: number;
}

interface POItem {
  poiId: string;
  no: number;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isStaleAlert?: boolean;
}

interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  poType: "Draft" | "Generated";
  createdBy?: string;
  items: POItem[];
  createdAt: string;
  updatedAt: string;
  netTotal: number;
}

interface ItemOption {
  id: string;
  name: string;
  supplierId: string;
  defaultPrice: number;
  isActive: boolean;
}

interface PurchaseOrdersProps {
  c: any; // Theme colors
  supplierList: Supplier[];
}

export default function PurchaseOrders({ c, supplierList }: PurchaseOrdersProps) {
  // ── States ────────────────────────────────────────────────
  const [poList, setPoList] = useState<PurchaseOrder[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "Draft" | "Generated">("All");
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [itemSearchQuery, setItemSearchQuery] = useState("");

  // Active items fetched for current supplier
  const [supplierItems, setSupplierItems] = useState<ItemOption[]>([]);
  const [loadingPOItems, setLoadingPOItems] = useState(false);
  const [savingPO, setSavingPO] = useState(false);
  const [generatingPO, setGeneratingPO] = useState(false);

  // Selection / Flow States
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isEditingPO, setIsEditingPO] = useState(false);
  const [supplierSelectOpen, setSupplierSelectOpen] = useState(false);
  const [smartScanLoading, setSmartScanLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  // ── Helpers for Excel Table Adding Items ──────────────────
  const [addItemDropdownOpen, setAddItemDropdownOpen] = useState(false);

  // Trigger Toast Notification
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Fetch Purchase Orders from backend
  const fetchPurchaseOrders = useCallback(async () => {
    try {
      const data = await apiFetch<any[]>("/purchas-orders/");
      const mapped: PurchaseOrder[] = data.map((po: any) => ({
        id: po.po_id,
        supplierId: po.supplier_id,
        supplierName: po.supplier_name || "Unknown Supplier",
        poType: po.po_type,
        createdBy: po.created_by || "System",
        createdAt: po.created_at ? new Date(po.created_at).toLocaleString() : "",
        updatedAt: po.created_at ? new Date(po.created_at).toLocaleString() : "",
        items: [],
        netTotal: 0
      }));
      setPoList(mapped);
    } catch (err: any) {
      console.error("Failed to fetch purchase orders:", err);
    }
  }, []);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  // Filter and Search POs
  const filteredPOList = useMemo(() => {
    return poList.filter(po => {
      const matchesSearch = po.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) || po.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "All" || po.poType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [poList, searchQuery, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPOList.length / PAGE_SIZE));
  const paginatedPOs = useMemo(() => {
    return filteredPOList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredPOList, page]);

  // Handle Smart Scan
  const handleSmartScan = async () => {
    setSmartScanLoading(true);
    triggerToast("Initiating Smart Scan... analyzing inventory levels and stocks");

    const startTime = Date.now();
    try {
      const resPromise = apiFetch<any>("/purchas-orders/auto-generated", { method: "POST" });
      const [res] = await Promise.all([
        resPromise,
        new Promise((resolve) => setTimeout(resolve, 5000))
      ]);

      setSmartScanLoading(false);
      if (res && res.message) {
        triggerToast(res.message);
        if (typeof res.message === "string" && res.message.startsWith("Successfully")) {
          fetchPurchaseOrders();
        }
      }
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 5000 - elapsed));
      }
      setSmartScanLoading(false);
      triggerToast(err.message || "Failed to run Smart Scan.");
    }
  };

  // Handle Manual PO - opens supplier picker
  const handleManualPO = () => {
    setSupplierSearchQuery("");
    setSupplierSelectOpen(true);
  };

  // Select Supplier and Create Draft PO — then immediately open the new/existing draft
  const selectSupplierForPO = async (supplier: Supplier) => {
    setSupplierSelectOpen(false);
    try {
      const res = await apiFetch<any>("/purchas-orders/manual", {
        method: "POST",
        body: JSON.stringify({ supplier_id: supplier.id }),
      });
      if (res && res.message) {
        triggerToast(res.message);
      }

      // Re-fetch the full list so we have the new PO in state
      const freshData = await apiFetch<any[]>("/purchas-orders/");
      const mapped: PurchaseOrder[] = freshData.map((po: any) => ({
        id: po.po_id,
        supplierId: po.supplier_id,
        supplierName: po.supplier_name || "Unknown Supplier",
        poType: po.po_type,
        createdBy: po.created_by || "System",
        createdAt: po.created_at ? new Date(po.created_at).toLocaleString() : "",
        updatedAt: po.created_at ? new Date(po.created_at).toLocaleString() : "",
        items: [],
        netTotal: 0
      }));
      setPoList(mapped);

      // Open the created/existing draft right away using the po_id from the response
      const targetPo = mapped.find(p => p.id === res.po_id);
      if (targetPo) {
        handleOpenPO(targetPo);
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to create manual purchase order.");
    }
  };

  // Delete Purchase Order
  const handleDeletePO = async (poId: string) => {
    try {
      const res = await apiFetch<any>(`/purchas-orders/${poId}`, { method: "DELETE" });
      if (res && res.message) {
        triggerToast(res.message);
      }
      fetchPurchaseOrders();
    } catch (err: any) {
      triggerToast(err.message || "Failed to delete purchase order.");
    }
  };

  // Open PO View/Edit & Fetch Items from GET /{po_id}/items
  const handleOpenPO = async (po: PurchaseOrder) => {
    setSelectedPO(po);
    setIsEditingPO(po.poType === "Draft");
    setLoadingPOItems(true);

    try {
      // 1. Fetch items for this PO
      const itemsData = await apiFetch<any[]>(`/purchas-orders/${po.id}/items`);
      const mappedItems: POItem[] = itemsData.map((item: any, idx: number) => ({
        poiId: item.poi_id,
        no: idx + 1,
        itemId: item.item_id,
        itemName: item.item_name || "Unknown Item",
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.quantity * item.unit_price,
        isStaleAlert: item.is_stale_alert
      }));

      const netTotal = mappedItems.reduce((sum, item) => sum + item.total, 0);

      setSelectedPO({
        ...po,
        items: mappedItems,
        netTotal
      });

      // 2. Fetch all items for this supplier to populate "Add Item from Supplier" dropdown
      const allItemsData = await apiFetch<any[]>("/items/");
      const filteredSupplierItems: ItemOption[] = allItemsData
        .filter((i: any) => i.supplier_id === po.supplierId && i.is_active)
        .map((i: any) => ({
          id: i.item_id,
          name: i.item_name,
          supplierId: i.supplier_id,
          defaultPrice: i.cost_price || 0,
          isActive: i.is_active
        }));
      setSupplierItems(filteredSupplierItems);

    } catch (err: any) {
      triggerToast(err.message || "Failed to load purchase order items.");
    } finally {
      setLoadingPOItems(false);
    }
  };

  // Exit PO editor/view
  const handleExitPO = () => {
    setSelectedPO(null);
    setIsEditingPO(false);
  };

  // Update item quantity in Draft PO (local state)
  const handleUpdateQty = (itemNo: number, val: string) => {
    if (!selectedPO) return;
    const qty = Math.max(1, parseInt(val) || 1);
    const updatedItems = selectedPO.items.map(item => {
      if (item.no === itemNo) {
        return {
          ...item,
          quantity: qty,
          total: qty * item.unitPrice
        };
      }
      return item;
    });

    const net = updatedItems.reduce((acc, curr) => acc + curr.total, 0);
    setSelectedPO({
      ...selectedPO,
      items: updatedItems,
      netTotal: net
    });
  };

  // Update item price in Draft PO (local state)
  const handleUpdatePrice = (itemNo: number, val: string) => {
    if (!selectedPO) return;
    const price = Math.max(0, parseFloat(val) || 0);
    const updatedItems = selectedPO.items.map(item => {
      if (item.no === itemNo) {
        return {
          ...item,
          unitPrice: price,
          total: item.quantity * price
        };
      }
      return item;
    });

    const net = updatedItems.reduce((acc, curr) => acc + curr.total, 0);
    setSelectedPO({
      ...selectedPO,
      items: updatedItems,
      netTotal: net
    });
  };

  // Add item to Draft PO — LOCAL STATE ONLY. Changes are batched and sent on "Save Draft".
  const handleAddItemToPO = (itemOption: ItemOption) => {
    if (!selectedPO) return;

    if (selectedPO.items.find(i => i.itemId === itemOption.id)) {
      triggerToast("Item already exists in this Purchase Order!");
      setAddItemDropdownOpen(false);
      return;
    }

    const newItem: POItem = {
      poiId: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      no: selectedPO.items.length + 1,
      itemId: itemOption.id,
      itemName: itemOption.name,
      quantity: 1,
      unitPrice: itemOption.defaultPrice,
      total: itemOption.defaultPrice
    };

    const updatedItems = [...selectedPO.items, newItem];
    const net = updatedItems.reduce((acc, curr) => acc + curr.total, 0);
    setSelectedPO({ ...selectedPO, items: updatedItems, netTotal: net });
    setAddItemDropdownOpen(false);
  };

  // Remove item from Draft PO — LOCAL STATE ONLY. Changes are batched and sent on "Save Draft".
  const handleRemoveItemFromPO = (itemToRemove: POItem) => {
    if (!selectedPO) return;

    const filteredItems = selectedPO.items
      .filter(i => i.poiId !== itemToRemove.poiId)
      .map((item, idx) => ({ ...item, no: idx + 1 }));
    const net = filteredItems.reduce((acc, curr) => acc + curr.total, 0);
    setSelectedPO({ ...selectedPO, items: filteredItems, netTotal: net });
  };

  // Save Draft PO — syncs all local changes (adds, removes, edits) to backend in one batch
  const handleSavePO = async () => {
    if (!selectedPO) return;
    setSavingPO(true);

    try {
      // 1. Fetch current backend state to detect which items were removed locally
      const serverItems = await apiFetch<any[]>(`/purchas-orders/${selectedPO.id}/items`);
      const localItemIds = new Set(selectedPO.items.map(i => i.itemId));

      // 2. Delete items that were removed in the UI
      for (const serverItem of serverItems) {
        if (!localItemIds.has(serverItem.item_id)) {
          await apiFetch<any>(`/purchas-orders/items/${serverItem.poi_id}`, { method: "DELETE" });
        }
      }

      // 3. POST newly added items (temp- prefix = not yet on server)
      for (const item of selectedPO.items) {
        if (item.poiId.startsWith("temp-")) {
          await apiFetch<any>(`/purchas-orders/${selectedPO.id}/items`, {
            method: "POST",
            body: JSON.stringify({
              item_id: item.itemId,
              quantity: item.quantity,
              unit_price: item.unitPrice
            })
          });
        }
      }

      // 4. Bulk-update existing items (qty / unit_price changes)
      const existingItems = selectedPO.items.filter(i => !i.poiId.startsWith("temp-"));
      if (existingItems.length > 0) {
        await apiFetch<any>(`/purchas-orders/${selectedPO.id}/items/bulk-update`, {
          method: "PATCH",
          body: JSON.stringify(existingItems.map(i => ({
            poi_id: i.poiId,
            quantity: i.quantity,
            unit_price: i.unitPrice
          })))
        });
      }

      triggerToast(`Draft purchase order saved successfully.`);
      fetchPurchaseOrders();
      setSelectedPO(null);
      setIsEditingPO(false);
    } catch (err: any) {
      triggerToast(err.message || "Failed to save purchase order.");
    } finally {
      setSavingPO(false);
    }
  };

  // Generate PO (Save bulk-update then call POST /{po_id}/generate and download PDF)
  const handleGeneratePO = async () => {
    if (!selectedPO) return;
    if (selectedPO.items.length === 0) {
      triggerToast("Cannot generate a purchase order with zero items.");
      return;
    }
    setGeneratingPO(true);

    try {
      // 1. Sync all local draft changes first (same logic as Save Draft)
      if (isEditingPO) {
        const serverItems = await apiFetch<any[]>(`/purchas-orders/${selectedPO.id}/items`);
        const localItemIds = new Set(selectedPO.items.map(i => i.itemId));

        for (const serverItem of serverItems) {
          if (!localItemIds.has(serverItem.item_id)) {
            await apiFetch<any>(`/purchas-orders/items/${serverItem.poi_id}`, { method: "DELETE" });
          }
        }

        for (const item of selectedPO.items) {
          if (item.poiId.startsWith("temp-")) {
            await apiFetch<any>(`/purchas-orders/${selectedPO.id}/items`, {
              method: "POST",
              body: JSON.stringify({
                item_id: item.itemId,
                quantity: item.quantity,
                unit_price: item.unitPrice
              })
            });
          }
        }

        const existingItems = selectedPO.items.filter(i => !i.poiId.startsWith("temp-"));
        if (existingItems.length > 0) {
          await apiFetch<any>(`/purchas-orders/${selectedPO.id}/items/bulk-update`, {
            method: "PATCH",
            body: JSON.stringify(existingItems.map(i => ({
              poi_id: i.poiId,
              quantity: i.quantity,
              unit_price: i.unitPrice
            })))
          });
        }
      }

      // 2. Call POST /{po_id}/generate for PDF streaming
      const token = sessionStorage.getItem("access_token") || localStorage.getItem("access_token");
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const pdfResponse = await fetch(`${baseUrl}/purchas-orders/${selectedPO.id}/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!pdfResponse.ok) {
        const errJson = await pdfResponse.json().catch(() => null);
        throw new Error(errJson?.detail || "Failed to generate Purchase Order PDF.");
      }

      // 3. Convert response to Blob and trigger browser download
      const blob = await pdfResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Purchase_Order_${selectedPO.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      triggerToast(`PO Generated & downloaded successfully!`);
      fetchPurchaseOrders();
      setSelectedPO(null);
      setIsEditingPO(false);
    } catch (err: any) {
      triggerToast(err.message || "Failed to generate purchase order.");
    } finally {
      setGeneratingPO(false);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          padding: "12px 20px",
          background: c.accent,
          color: "#fff",
          borderRadius: 10,
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 1000,
          animation: "slideIn 0.3s ease-out",
          fontSize: 13.5,
          fontWeight: 500
        }}>
          <Check size={16} strokeWidth={2.5} />
          {toastMessage}
        </div>
      )}

      {selectedPO ? (
        /* ── VIEW / EDIT DRAFT PO SPREADSHEET VIEW ── */
        <div style={{
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 14,
          padding: 24,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          boxShadow: "0 4px 20px rgba(0,0,0,0.02)"
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${c.border}`, paddingBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={handleExitPO}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${c.border}`,
                  background: c.bg,
                  color: c.textMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = c.surfaceMuted}
                onMouseLeave={e => e.currentTarget.style.background = c.bg}
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{selectedPO.id}</span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: selectedPO.poType === "Draft" ? c.warnSoft : c.accentSoft,
                    color: selectedPO.poType === "Draft" ? c.warn : c.accent
                  }}>
                    {selectedPO.poType}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>
                  Supplier: <strong style={{ color: c.text }}>{selectedPO.supplierName}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Excel spreadsheet container */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 200, border: `1px solid ${c.border}`, borderRadius: 10, overflowX: "auto" }}>
            {loadingPOItems ? (
              <div style={{ padding: 40, textAlign: "center", color: c.textMuted, fontSize: 14 }}>
                Loading order line items...
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                <thead>
                  <tr style={{ background: c.surfaceMuted, borderBottom: `2px solid ${c.border}` }}>
                    <th style={{ padding: "10px 14px", width: 60, fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: "left" }}>No.</th>
                    <th style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: "left" }}>Item Name</th>
                    <th style={{ padding: "10px 14px", width: 140, fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: "right" }}>Quantity</th>
                    <th style={{ padding: "10px 14px", width: 160, fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: "right" }}>Unit Price (Rs)</th>
                    <th style={{ padding: "10px 14px", width: 180, fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: "right" }}>Total (Rs)</th>
                    {isEditingPO && <th style={{ padding: "10px 14px", width: 50 }} />}
                  </tr>
                </thead>
                <tbody>
                  {selectedPO.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "30px 14px", textAlign: "center", color: c.textFaint }}>
                        No items in this purchase order yet. Click below to add an active supplier item.
                      </td>
                    </tr>
                  ) : selectedPO.items.map((item) => (
                    <tr key={item.poiId} style={{ borderBottom: `1px solid ${c.border}`, transition: "background 0.1s" }}>
                      {/* No. (Read-only) */}
                      <td style={{ padding: "10px 14px", fontSize: 13.5, color: c.textFaint, fontWeight: 500 }}>
                        {item.no}
                      </td>

                      {/* Item Name */}
                      <td style={{ padding: "10px 14px", fontSize: 13.5, fontWeight: 500, color: c.text }}>
                        {item.itemName}
                        {item.isStaleAlert && (
                          <span style={{ marginLeft: 8, fontSize: 10, color: c.textMuted, background: c.surfaceMuted, padding: "2px 6px", borderRadius: 4 }}>
                            Restocked
                          </span>
                        )}
                      </td>

                      {/* Quantity (Editable if draft) */}
                      <td style={{ padding: "6px 14px", textAlign: "right" }}>
                        {isEditingPO ? (
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQty(item.no, e.target.value)}
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              fontSize: 13.5,
                              border: `1px solid ${c.border}`,
                              background: c.bg,
                              color: c.text,
                              borderRadius: 6,
                              textAlign: "right",
                              outline: "none",
                              fontWeight: 600
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: c.text }}>{item.quantity}</span>
                        )}
                      </td>

                      {/* Unit Price (Editable if draft) */}
                      <td style={{ padding: "6px 14px", textAlign: "right" }}>
                        {isEditingPO ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdatePrice(item.no, e.target.value)}
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              fontSize: 13.5,
                              border: `1px solid ${c.border}`,
                              background: c.bg,
                              color: c.text,
                              borderRadius: 6,
                              textAlign: "right",
                              outline: "none",
                              fontWeight: 600
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 13.5, color: c.textMuted }}>Rs {item.unitPrice.toLocaleString()}</span>
                        )}
                      </td>

                      {/* Total (Read-only calculated) */}
                      <td style={{ padding: "10px 14px", fontSize: 13.5, fontWeight: 600, color: c.text, textAlign: "right" }}>
                        Rs {item.total.toLocaleString()}
                      </td>

                      {/* Delete Item (Visible in edit draft mode) */}
                      {isEditingPO && (
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>
                          <button
                            onClick={() => handleRemoveItemFromPO(item)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: c.danger || "#B3473C",
                              cursor: "pointer",
                              fontSize: 12,
                              padding: 4,
                              opacity: 0.75
                            }}
                            title="Remove item"
                          >
                            <X size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}

                  {/* Plus button at the bottom of last item */}
                  {isEditingPO && (
                    <tr>
                      <td colSpan={6} style={{ padding: "10px 14px", borderBottom: `1px solid ${c.border}` }}>
                        <div style={{ position: "relative" }}>
                          <button
                            onClick={() => {
                              setItemSearchQuery("");
                              setAddItemDropdownOpen(!addItemDropdownOpen);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "6px 12px",
                              borderRadius: 6,
                              border: `1.5px dashed ${c.border}`,
                              background: "transparent",
                              color: c.accent,
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.15s"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = c.surfaceMuted}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <Plus size={14} /> Add Item from Supplier
                          </button>

                          {/* Add Item Dropdown Panel */}
                          {addItemDropdownOpen && (
                            <div style={{
                              position: "absolute",
                              top: 36,
                              left: 0,
                              width: 320,
                              background: c.surface,
                              border: `1px solid ${c.border}`,
                              borderRadius: 8,
                              boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                              zIndex: 100,
                              padding: 6
                            }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: c.textFaint, padding: "6px 10px", borderBottom: `1px solid ${c.border}`, marginBottom: 4 }}>
                                Active Supplier Products ({supplierItems.length})
                              </div>
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 10px",
                                borderRadius: 6,
                                border: `1px solid ${c.border}`,
                                background: c.bg,
                                margin: "4px 6px 8px 6px"
                              }}>
                                <Search size={12} color={c.textFaint} />
                                <input
                                  value={itemSearchQuery}
                                  onChange={e => setItemSearchQuery(e.target.value)}
                                  placeholder="Search supplier items..."
                                  style={{
                                    border: "none",
                                    outline: "none",
                                    background: "transparent",
                                    color: c.text,
                                    fontSize: 12,
                                    width: "100%",
                                    fontFamily: "inherit"
                                  }}
                                />
                              </div>
                              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                                {supplierItems.filter(itm => itm.name.toLowerCase().includes(itemSearchQuery.toLowerCase())).length === 0 ? (
                                  <div style={{ fontSize: 12, color: c.textFaint, padding: "10px 10px" }}>
                                    No active items found for this supplier.
                                  </div>
                                ) : supplierItems.filter(itm => itm.name.toLowerCase().includes(itemSearchQuery.toLowerCase())).map(itm => (
                                  <button
                                    key={itm.id}
                                    onClick={() => handleAddItemToPO(itm)}
                                    style={{
                                      width: "100%",
                                      padding: "8px 10px",
                                      textAlign: "left",
                                      fontSize: 12.5,
                                      border: "none",
                                      background: "transparent",
                                      color: c.text,
                                      cursor: "pointer",
                                      borderRadius: 4,
                                      display: "flex",
                                      justifyContent: "space-between"
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = c.bg}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                  >
                                    <span>{itm.name}</span>
                                    <span style={{ color: c.textMuted, fontWeight: 500 }}>Rs {itm.defaultPrice}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Net Total Row */}
                  <tr style={{ background: c.surfaceMuted }}>
                    <td colSpan={3} style={{ padding: "14px 14px", fontSize: 13, fontWeight: 600, color: c.textMuted }}>
                      Net Total Order Value
                    </td>
                    <td colSpan={3} style={{ padding: "14px 14px", fontSize: 16, fontWeight: 700, color: c.accent, textAlign: "right" }}>
                      Rs {selectedPO.netTotal.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Action buttons at bottom */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, borderTop: `1px solid ${c.border}`, paddingTop: 16 }}>
            <button
              onClick={handleExitPO}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: "transparent",
                color: c.text,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            {isEditingPO && (
              <button
                onClick={handleSavePO}
                disabled={savingPO || loadingPOItems}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: c.accentSoft,
                  color: c.accent,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: savingPO ? "default" : "pointer",
                  opacity: savingPO ? 0.7 : 1
                }}
              >
                <Save size={15} /> {savingPO ? "Saving..." : "Save Draft"}
              </button>
            )}
            <button
              onClick={handleGeneratePO}
              disabled={generatingPO || loadingPOItems}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 22px",
                borderRadius: 8,
                border: "none",
                background: c.accent,
                color: "#fff",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: generatingPO ? "default" : "pointer",
                opacity: generatingPO ? 0.7 : 1
              }}
            >
              <FileText size={15} /> {generatingPO ? "Generating PDF..." : "Generate PO"}
            </button>
          </div>
        </div>
      ) : (
        /* ── MAIN WORKSPACE VIEW (POs LIST) ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
          {/* Action Buttons & Quick Summary */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            padding: 18
          }}>
            {/* Manual PO Button */}
            <button
              onClick={handleManualPO}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
                padding: 18,
                borderRadius: 10,
                border: `1.5px dashed ${c.accent}`,
                background: c.accentSoft,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 15px rgba(59, 110, 94, 0.1)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: c.accent,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Plus size={18} strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.accent }}>Manual PO</div>
                <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Select a supplier and write details manually</div>
              </div>
            </button>

            {/* Smart Scan Button */}
            <button
              onClick={handleSmartScan}
              disabled={smartScanLoading}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
                padding: 18,
                borderRadius: 10,
                border: `1px solid ${c.border}`,
                background: c.bg,
                cursor: smartScanLoading ? "default" : "pointer",
                textAlign: "left",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => {
                if (!smartScanLoading) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.background = c.surfaceMuted;
                }
              }}
              onMouseLeave={e => {
                if (!smartScanLoading) {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.background = c.bg;
                }
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: c.warn,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>Smart Scan</div>
                <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>
                  {smartScanLoading ? "Analyzing..." : "Auto-scan low inventory & generate orders"}
                </div>
              </div>
            </button>
          </div>

          {/* Table Listing & Filtering */}
          <div style={{
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            flex: 1
          }}>
            {/* Toolbar Filters */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: `1px solid ${c.border}`,
              flexWrap: "wrap",
              gap: 12
            }}>
              {/* Type Filter Buttons */}
              <div style={{ display: "flex", gap: 6 }}>
                {(["All", "Draft", "Generated"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTypeFilter(t); setPage(1); }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 7,
                      border: `1px solid ${typeFilter === t ? c.accent : c.border}`,
                      background: typeFilter === t ? c.accentSoft : "transparent",
                      color: typeFilter === t ? c.accent : c.textMuted,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Search PO */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: c.bg,
                width: "100%",
                maxWidth: 260
              }}>
                <Search size={14} color={c.textFaint} />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Search POs..."
                  style={{
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: c.text,
                    fontSize: 13,
                    width: "100%",
                    fontFamily: "inherit"
                  }}
                />
              </div>
            </div>

            {/* List Table */}
            <div style={{ overflowX: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 500 }}>
                <thead>
                  <tr style={{ color: c.textFaint, textAlign: "left", background: c.surfaceMuted }}>
                    {["PO ID", "Supplier Name", "PO Type", "Created By", "Created At"].map(h => (
                      <th key={h} style={{ padding: "12px 20px", fontWeight: 500, fontSize: 11.5 }}>{h}</th>
                    ))}
                    <th style={{ padding: "12px 20px", width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {paginatedPOs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: c.textFaint }}>
                        No Purchase Orders found.
                      </td>
                    </tr>
                  ) : paginatedPOs.map(po => (
                    <tr
                      key={po.id}
                      onClick={() => handleOpenPO(po)}
                      style={{
                        borderTop: `1px solid ${c.border}`,
                        cursor: "pointer",
                        transition: "background 0.12s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = c.surfaceMuted}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "14px 20px", fontWeight: 600, color: c.text }}>{po.id.length > 8 ? `${po.id.slice(0, 8)}...` : po.id}</td>
                      <td style={{ padding: "14px 20px", fontWeight: 500 }}>{po.supplierName}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: po.poType === "Draft" ? c.warnSoft : c.accentSoft,
                          color: po.poType === "Draft" ? c.warn : c.accent
                        }}>
                          {po.poType}
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px", color: c.textMuted }}>{po.createdBy || "System"}</td>
                      <td style={{ padding: "14px 20px", color: c.textMuted }}>{po.createdAt}</td>
                      <td style={{ padding: "8px 20px", textAlign: "right" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePO(po.id);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: c.error || c.danger || "#B3473C",
                            cursor: "pointer",
                            padding: "6px 8px",
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s"
                          }}
                          onMouseEnter={elm => elm.currentTarget.style.background = c.warnSoft || "#FCECEB"}
                          onMouseLeave={elm => elm.currentTarget.style.background = "transparent"}
                          title="Delete Purchase Order"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 20px",
              borderTop: `1px solid ${c.border}`,
              flexShrink: 0
            }}>
              <span style={{ fontSize: 12, color: c.textFaint }}>
                Showing {filteredPOList.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredPOList.length)} of {filteredPOList.length} orders
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
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
                    cursor: page === 1 ? "default" : "pointer",
                    opacity: page === 1 ? 0.4 : 1
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
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
                      cursor: "pointer"
                    }}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
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
                    cursor: page === totalPages ? "default" : "pointer",
                    opacity: page === totalPages ? 0.4 : 1
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Select Modal (for Manual PO selection) */}
      {supplierSelectOpen && (
        <div
          onClick={() => setSupplierSelectOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,10,8,0.5)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 440,
              maxWidth: "100%",
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              padding: 22,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Select Supplier</span>
              <button
                onClick={() => setSupplierSelectOpen(false)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  border: "none",
                  background: c.surfaceMuted,
                  color: c.textMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${c.border}`,
              background: c.bg,
              marginBottom: 14
            }}>
              <Search size={14} color={c.textFaint} />
              <input
                value={supplierSearchQuery}
                onChange={e => setSupplierSearchQuery(e.target.value)}
                placeholder="Search suppliers..."
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: c.text,
                  fontSize: 13.5,
                  width: "100%",
                  fontFamily: "inherit"
                }}
              />
            </div>

            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {supplierList
                .filter(s => (
                  (s.supplierName && s.supplierName.toLowerCase().includes(supplierSearchQuery.toLowerCase())) ||
                  (s.contactPerson && s.contactPerson.toLowerCase().includes(supplierSearchQuery.toLowerCase()))
                ))
                .map(s => {
                  const hasDraft = poList.some(po => po.supplierId === s.id && po.poType === "Draft");
                  const isInactive = !s.active;
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectSupplierForPO(s)}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        textAlign: "left",
                        borderRadius: 8,
                        border: `1px solid ${isInactive ? (c.error || "#B3473C") + "33" : hasDraft ? c.warn + "33" : c.border}`,
                        background: isInactive ? (c.errorSoft || "#FCECEB") : hasDraft ? c.warnSoft : c.bg,
                        color: c.text,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4
                      }}
                      onMouseEnter={e => {
                        if (!hasDraft && !isInactive) {
                          e.currentTarget.style.borderColor = c.accent;
                          e.currentTarget.style.background = c.surfaceMuted;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!hasDraft && !isInactive) {
                          e.currentTarget.style.borderColor = c.border;
                          e.currentTarget.style.background = c.bg;
                        }
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.supplierName}</span>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {isInactive && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: c.error || "#B3473C", background: c.errorSoft || "#FCECEB", padding: "2px 6px", borderRadius: 4, border: `1px solid ${(c.error || "#B3473C")}33` }}>
                              Inactive
                            </span>
                          )}
                          {hasDraft && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: c.warn, background: c.warnSoft, padding: "2px 6px", borderRadius: 4, border: `1px solid ${c.warn}33` }}>
                              Draft Exists
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 11.5, color: c.textMuted }}>Contact: {s.contactPerson}</span>
                    </button>
                  );
                })}
              {supplierList.filter(s => (
                (s.supplierName && s.supplierName.toLowerCase().includes(supplierSearchQuery.toLowerCase())) ||
                (s.contactPerson && s.contactPerson.toLowerCase().includes(supplierSearchQuery.toLowerCase()))
              )).length === 0 && (
                  <div style={{ textAlign: "center", color: c.textFaint, padding: "20px 0" }}>No suppliers found.</div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
