"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Package,
  ChevronDown,
  Filter,
  Radio,
  Building2,
  DollarSign,
  AlertCircle,
  Layers,
  ArrowLeft,
  Calendar,
  Tag,
  Boxes,
} from "lucide-react";
import { useTheme } from "../ThemeContext";
import { useData, Item, Category, Supplier } from "../DataContext";
import { isReadOnly, isSalesRole } from "@/lib/roles";
import { apiFetch } from "@/lib/api";
import { Checkbox as Cb, Modal, SearchBar, Pagination, ConfirmDeleteModal } from "@/components/ui";

// ── Types ──────────────────────────────────────────────────
interface UnitOption {
  unit_id: string;
  unit_name: string;
  unit_symbol: string;
}

interface ItemSupplierLink {
  item_id: string;
  supplier_id: string;
  supplier_name: string;
  agreed_price: number;
  is_primary: boolean;
  supplier_sku?: string | null;
  created_at: string;
  updated_at: string;
}

interface StockBatchInfo {
  batch_id: string;
  batch_number: string;
  supplier_id: string;
  supplier_name?: string;
  purchase_price: number;
  selling_price?: number | null;
  current_quantity: number;
  initial_quantity: number;
  expiry_date?: string | null;
  received_date: string;
}

interface FieldProps {
  label: string;
  c: any;
  children: React.ReactNode;
}
function Field({ label, c, children }: FieldProps) {
  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: c.textMuted,
          display: "block",
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inp = (c: any) => ({
  width: "100%",
  padding: "8px 11px",
  borderRadius: 8,
  border: `1px solid ${c.border}`,
  background: c.inputBg,
  color: c.text,
  fontSize: 13.5,
  outline: "none",
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
});

// ── Health Minimal Indicator ───────────────────────────────
function HealthIndicator({ status }: { status?: string }) {
  const s = status?.toUpperCase() || "HEALTHY";
  if (s === "CRITICAL") {
    return (
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#DC2626", display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#DC2626" }} />
        Critical (Out of Stock)
      </span>
    );
  }
  if (s === "LOW_STOCK") {
    return (
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#D97706", display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D97706" }} />
        Low Stock
      </span>
    );
  }
  return (
    <span style={{ fontSize: 12.5, fontWeight: 500, color: "#2E7D32", display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2E7D32" }} />
      Healthy
    </span>
  );
}

// ============================================================================
// Create Item Modal (NO Supplier field at creation time)
// ============================================================================
interface CreateItemModalProps {
  onClose: () => void;
  onSubmit: (item: any) => void;
  categoryList: Category[];
  units: UnitOption[];
  c: any;
}
function CreateItemModal({
  onClose,
  onSubmit,
  categoryList,
  units,
  c,
}: CreateItemModalProps) {
  const [itemName, setItemName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categoryList[0]?.name || "");
  const [unit, setUnit] = useState(units[0]?.unit_symbol || "pcs");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("10");
  const [reorderQuantity, setReorderQuantity] = useState("25");
  const [err, setErr] = useState("");

  const handleSubmit = () => {
    setErr("");
    if (!itemName.trim() || !sku.trim() || !costPrice || !sellingPrice) {
      setErr("Item name, SKU, Cost Price, and Selling Price are required.");
      return;
    }
    const cPrice = parseFloat(costPrice);
    const sPrice = parseFloat(sellingPrice);
    if (isNaN(cPrice) || cPrice <= 0 || isNaN(sPrice) || sPrice <= 0) {
      setErr("Prices must be valid positive numbers.");
      return;
    }
    onSubmit({
      itemName: itemName.trim(),
      sku: sku.trim().toUpperCase(),
      description: description.trim(),
      category,
      unit,
      costPrice: cPrice,
      sellingPrice: sPrice,
      reorderLevel: parseInt(reorderLevel, 10) || 10,
      reorderQuantity: parseInt(reorderQuantity, 10) || 25,
    });
  };

  return (
    <Modal title="Create New Item" onClose={onClose} c={c} width={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && (
          <div
            style={{
              padding: "9px 12px",
              background: c.dangerSoft,
              color: c.danger,
              borderRadius: 8,
              fontSize: 12.5,
            }}
          >
            {err}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Item Name *" c={c}>
            <input
              style={inp(c)}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. White Emulsion Paint 5L"
            />
          </Field>
          <Field label="SKU / Item Code *" c={c}>
            <input
              style={inp(c)}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. PNT-1001"
            />
          </Field>
        </div>

        <Field label="Description" c={c}>
          <textarea
            rows={2}
            style={{ ...inp(c), resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Product details, material, or specifications..."
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Category *" c={c}>
            <select
              style={inp(c)}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categoryList.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Measurement Unit *" c={c}>
            <select
              style={inp(c)}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              {units.map((u) => (
                <option key={u.unit_id} value={u.unit_symbol}>
                  {u.unit_name} ({u.unit_symbol})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Cost Price ($) *" c={c}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              style={inp(c)}
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Default Selling Price ($) *" c={c}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              style={inp(c)}
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Reorder Alert Level" c={c}>
            <input
              type="number"
              min="0"
              style={inp(c)}
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
            />
          </Field>
          <Field label="Default Reorder Qty" c={c}>
            <input
              type="number"
              min="0"
              style={inp(c)}
              value={reorderQuantity}
              onChange={(e) => setReorderQuantity(e.target.value)}
            />
          </Field>
        </div>

        <div
          style={{
            padding: "8px 12px",
            background: c.surfaceMuted,
            borderRadius: 8,
            fontSize: 12,
            color: c.textMuted,
          }}
        >
          💡 Suppliers and agreed purchase prices can be assigned from the Item Details view after creation.
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
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
            type="button"
            onClick={handleSubmit}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: c.accent,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Create Item
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================
export default function ItemsPage() {
  const { c } = useTheme();
  const {
    itemList,
    categoryList,
    supplierList,
    setHeaderActions,
    loggedInUser,
    fetchItems,
    fetchCategories,
    fetchSuppliers,
    refreshItems,
  } = useData();

  const readOnly = isReadOnly(loggedInUser?.role ?? "", "items");
  const isSales = isSalesRole(loggedInUser?.role ?? "");

  const [loadingItems, setLoadingItems] = useState(false);

  // Units list
  const [units, setUnits] = useState<UnitOption[]>([
    { unit_id: "1", unit_name: "Pieces", unit_symbol: "pcs" },
    { unit_id: "2", unit_name: "Kilograms", unit_symbol: "kg" },
    { unit_id: "3", unit_name: "Grams", unit_symbol: "g" },
    { unit_id: "4", unit_name: "Liters", unit_symbol: "L" },
    { unit_id: "5", unit_name: "Meters", unit_symbol: "m" },
    { unit_id: "6", unit_name: "Boxes", unit_symbol: "box" },
  ]);

  // Selected checkboxes
  const [selected, setSelected] = useState<string[]>([]);
  const [itemSearch, setItemSearch] = useState("");

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedHealth, setSelectedHealth] = useState<string | null>(null);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [healthFilterOpen, setHealthFilterOpen] = useState(false);

  // Dedicated Full-Page Item Details State
  const [viewingItem, setViewingItem] = useState<Item | null>(null);
  const [itemSuppliers, setItemSuppliers] = useState<ItemSupplierLink[]>([]);
  const [itemBatches, setItemBatches] = useState<StockBatchInfo[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Add Supplier Link Form
  const [isLinkingSupplier, setIsLinkingSupplier] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState("");
  const [newAgreedPrice, setNewAgreedPrice] = useState("");
  const [newSupplierSku, setNewSupplierSku] = useState("");
  const [newIsPrimary, setNewIsPrimary] = useState(false);
  const [supplierFormError, setSupplierFormError] = useState("");

  // Editing agreed price inline
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editAgreedPrice, setEditAgreedPrice] = useState("");

  // Modals
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editError, setEditError] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setLoadingItems(true);
    fetchItems().finally(() => setLoadingItems(false));
    fetchCategories();
    fetchSuppliers();
    apiFetch<UnitOption[]>("/units/")
      .then((data) => {
        if (data && data.length > 0) setUnits(data);
      })
      .catch(() => {});
  }, [fetchItems, fetchCategories, fetchSuppliers]);

  // Set top header action
  useEffect(() => {
    if (readOnly || viewingItem) {
      setHeaderActions(null);
      return;
    }
    setHeaderActions(
      <button
        onClick={() => setAddItemOpen(true)}
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
        <Plus size={15} /> Add Item
      </button>
    );
    return () => setHeaderActions(null);
  }, [c, setHeaderActions, readOnly, viewingItem]);

  // Load detailed suppliers & batches for viewingItem
  const loadItemDetails = async (itemId: string) => {
    setLoadingDetails(true);
    try {
      const [supData, batchData] = await Promise.all([
        apiFetch<ItemSupplierLink[]>(`/items/${itemId}/suppliers`).catch(() => []),
        apiFetch<StockBatchInfo[]>(`/transaction/batches/${itemId}`).catch(() => []),
      ]);
      setItemSuppliers(supData || []);
      setItemBatches(batchData || []);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (viewingItem) {
      setEditForm(viewingItem);
      setEditError("");
      setIsLinkingSupplier(false);
      setSupplierFormError("");
      setEditingSupplierId(null);
      loadItemDetails(viewingItem.id);
    }
  }, [viewingItem]);

  // Filter main inventory list
  const filteredItems = useMemo(() => {
    return itemList
      .filter((item) => {
        const q = itemSearch.toLowerCase().trim();
        const matchesSearch =
          !q ||
          item.itemName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q));

        const matchesCategory = !selectedCategory || item.category === selectedCategory;
        const matchesHealth = !selectedHealth || item.healthStatus === selectedHealth;

        return matchesSearch && matchesCategory && matchesHealth;
      })
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [itemList, itemSearch, selectedCategory, selectedHealth]);

  const totalCount = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((item) => selected.includes(item.id));

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const toggleAllPage = () => {
    const pageIds = pageItems.map((item) => item.id);
    if (allPageSelected) {
      setSelected((prev) => prev.filter((x) => !pageIds.includes(x)));
    } else {
      setSelected((prev) => {
        const next = [...prev];
        pageIds.forEach((id) => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  // Create Item handler
  const handleCreateItem = async (newItem: any) => {
    const cat = categoryList.find((c) => c.name === newItem.category);
    if (!cat) {
      alert("Selected category is invalid.");
      return;
    }
    const matchingUnit = units.find((u) => u.unit_symbol === newItem.unit);

    try {
      await apiFetch("/items/", {
        method: "POST",
        body: JSON.stringify({
          item_name: newItem.itemName,
          sku: newItem.sku,
          description: newItem.description || null,
          category_id: cat.id,
          unit_id: matchingUnit ? matchingUnit.unit_id : null,
          unit: newItem.unit,
          cost_price: Number(newItem.costPrice),
          selling_price: Number(newItem.sellingPrice),
          reorder_level: Number(newItem.reorderLevel),
          reorder_quantity: Number(newItem.reorderQuantity),
          quantity_in_stock: 0,
        }),
      });
      await refreshItems();
      setAddItemOpen(false);
      setPage(1);
    } catch (err: any) {
      alert(err.message || "Failed to create item.");
    }
  };

  // Save general item edits
  const handleSaveItemEdit = async () => {
    if (!viewingItem) return;
    setEditError("");

    const cat = categoryList.find((c) => c.name === editForm.category);
    const matchingUnit = units.find((u) => u.unit_symbol === editForm.unit);

    try {
      const body: any = {};
      if (editForm.itemName && editForm.itemName !== viewingItem.itemName) {
        body.item_name = editForm.itemName;
      }
      if (editForm.sku && editForm.sku !== viewingItem.sku) {
        body.sku = editForm.sku;
      }
      if (editForm.description !== undefined && editForm.description !== viewingItem.description) {
        body.description = editForm.description || null;
      }
      if (editForm.unit && editForm.unit !== viewingItem.unit) {
        body.unit = editForm.unit;
        if (matchingUnit) body.unit_id = matchingUnit.unit_id;
      }
      if (editForm.sellingPrice !== undefined && Number(editForm.sellingPrice) !== Number(viewingItem.sellingPrice)) {
        body.selling_price = Number(editForm.sellingPrice);
      }
      if (editForm.costPrice !== undefined && Number(editForm.costPrice) !== Number(viewingItem.costPrice)) {
        body.cost_price = Number(editForm.costPrice);
      }
      if (editForm.reorderLevel !== undefined && Number(editForm.reorderLevel) !== Number(viewingItem.reorderLevel)) {
        body.reorder_level = Number(editForm.reorderLevel);
      }
      if (editForm.reorderQuantity !== undefined && Number(editForm.reorderQuantity) !== Number(viewingItem.reorderQuantity)) {
        body.reorder_quantity = Number(editForm.reorderQuantity);
      }
      if (editForm.active !== undefined && editForm.active !== viewingItem.active) {
        body.is_active = editForm.active;
      }
      if (cat && editForm.category !== viewingItem.category) {
        body.category_id = cat.id;
      }

      if (Object.keys(body).length === 0) {
        setIsEditingItem(false);
        return;
      }

      const updated = await apiFetch<any>(`/items/${viewingItem.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      await refreshItems();
      setViewingItem((prev) =>
        prev
          ? {
              ...prev,
              itemName: updated.item_name,
              sku: updated.sku,
              description: updated.description || "",
              category: updated.category_name || prev.category,
              unit: updated.unit,
              costPrice: updated.cost_price,
              sellingPrice: updated.selling_price,
              reorderLevel: updated.reorder_level,
              reorderQuantity: updated.reorder_quantity,
              active: updated.is_active,
            }
          : null
      );
      setIsEditingItem(false);
    } catch (err: any) {
      setEditError(err.message || "Failed to update item.");
    }
  };

  const handleToggleItemActive = async () => {
    if (!viewingItem) return;
    try {
      const nextActive = !viewingItem.active;
      await apiFetch(`/items/${viewingItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: nextActive }),
      });
      await refreshItems();
      setViewingItem((prev) => (prev ? { ...prev, active: nextActive } : null));
    } catch (err: any) {
      alert(err.message || "Failed to update item status.");
    }
  };

  // Delete item
  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await apiFetch(`/items/${itemToDelete.id}`, { method: "DELETE" });
      await refreshItems();
      if (viewingItem?.id === itemToDelete.id) {
        setViewingItem(null);
      }
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete item.");
    }
  };

  const handleBatchDeleteItems = async () => {
    if (selected.length === 0) return;
    setBatchDeleting(true);
    try {
      let successCount = 0;
      const errors: string[] = [];
      for (const id of selected) {
        try {
          await apiFetch(`/items/${id}`, { method: "DELETE" });
          successCount++;
        } catch (err: any) {
          errors.push(err.message || "Failed to delete item");
        }
      }
      setSelected([]);
      setBatchDeleteOpen(false);
      if (viewingItem && selected.includes(viewingItem.id)) {
        setViewingItem(null);
      }
      await refreshItems();
      if (errors.length > 0) {
        alert(`Deleted ${successCount} item(s). Note: ${errors.join(", ")}`);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete selected items.");
    } finally {
      setBatchDeleting(false);
    }
  };

  // Link a supplier to item
  const handleLinkSupplier = async () => {
    if (!viewingItem) return;
    setSupplierFormError("");

    if (!newSupplierId) {
      setSupplierFormError("Please select a supplier.");
      return;
    }
    const price = parseFloat(newAgreedPrice);
    if (isNaN(price) || price <= 0) {
      setSupplierFormError("Agreed purchase price must be a valid positive number.");
      return;
    }

    try {
      await apiFetch(`/items/${viewingItem.id}/suppliers`, {
        method: "POST",
        body: JSON.stringify({
          supplier_id: newSupplierId,
          agreed_price: price,
          is_primary: newIsPrimary,
          supplier_sku: newSupplierSku.trim() || null,
        }),
      });

      await loadItemDetails(viewingItem.id);
      setIsLinkingSupplier(false);
      setNewSupplierId("");
      setNewAgreedPrice("");
      setNewSupplierSku("");
      setNewIsPrimary(false);
    } catch (err: any) {
      setSupplierFormError(err.message || "Failed to link supplier.");
    }
  };

  // Set supplier as primary
  const handleSetPrimary = async (supplierId: string) => {
    if (!viewingItem) return;
    try {
      await apiFetch(`/items/${viewingItem.id}/suppliers/${supplierId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_primary: true }),
      });
      await loadItemDetails(viewingItem.id);
    } catch (err: any) {
      alert(err.message || "Failed to set primary supplier.");
    }
  };

  // Update agreed price inline
  const handleSaveAgreedPrice = async (supplierId: string) => {
    if (!viewingItem) return;
    const price = parseFloat(editAgreedPrice);
    if (isNaN(price) || price <= 0) {
      alert("Please enter a valid positive price.");
      return;
    }

    try {
      await apiFetch(`/items/${viewingItem.id}/suppliers/${supplierId}`, {
        method: "PATCH",
        body: JSON.stringify({ agreed_price: price }),
      });
      setEditingSupplierId(null);
      await loadItemDetails(viewingItem.id);
    } catch (err: any) {
      alert(err.message || "Failed to update agreed price.");
    }
  };

  // Remove supplier link
  const handleUnlinkSupplier = async (supplierId: string) => {
    if (!viewingItem) return;
    if (!confirm("Are you sure you want to remove this supplier link?")) return;

    try {
      await apiFetch(`/items/${viewingItem.id}/suppliers/${supplierId}`, {
        method: "DELETE",
      });
      await loadItemDetails(viewingItem.id);
    } catch (err: any) {
      alert(err.message || "Failed to remove supplier.");
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DEDICATED FULL-PAGE ITEM DETAILS VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (viewingItem) {
    const unlinkedSuppliers = supplierList.filter(
      (s) => s.active && !itemSuppliers.some((link) => link.supplier_id === s.id)
    );

    const marginPct =
      viewingItem.costPrice && viewingItem.sellingPrice && viewingItem.costPrice > 0
        ? Math.round(((viewingItem.sellingPrice - viewingItem.costPrice) / viewingItem.sellingPrice) * 100)
        : null;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Top Navigation & Action Header */}
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
              onClick={() => setViewingItem(null)}
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
              <ArrowLeft size={14} /> Back to Items
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: c.text, margin: 0 }}>
                  {viewingItem.itemName}
                </h1>
                <span style={{ fontSize: 13, color: c.textMuted, fontFamily: "monospace" }}>
                  {viewingItem.sku}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: 12.5, color: c.textMuted }}>
                  Category: <strong style={{ color: c.text }}>{viewingItem.category}</strong>
                </span>
                <span style={{ fontSize: 12.5, color: c.textFaint }}>•</span>
                <HealthIndicator status={viewingItem.healthStatus} />
                <span style={{ fontSize: 12.5, color: c.textFaint }}>•</span>
                <span style={{ fontSize: 12.5, color: viewingItem.active ? "#2E7D32" : c.textFaint }}>
                  {viewingItem.active ? "● Active" : "○ Inactive"}
                </span>
              </div>
            </div>
          </div>

          {!readOnly && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={handleToggleItemActive}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: `1px solid ${viewingItem.active ? c.border : "#BBF7D0"}`,
                  background: viewingItem.active ? c.surface : "#F0FDF4",
                  color: viewingItem.active ? c.textMuted : "#16A34A",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span>{viewingItem.active ? "Deactivate Item" : "Activate Item"}</span>
              </button>
              <button
                onClick={() => {
                  setEditForm(viewingItem);
                  setEditError("");
                  setIsEditingItem(true);
                }}
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
                  fontFamily: "inherit",
                }}
              >
                <Pencil size={13} /> Edit Item
              </button>
              <button
                onClick={() => {
                  setItemToDelete(viewingItem);
                  setDeleteConfirmOpen(true);
                }}
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
                  fontFamily: "inherit",
                }}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>

        {/* Key Metrics Overview Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: c.textMuted }}>Current In Stock</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
              {viewingItem.quantity.toLocaleString()}{" "}
              <span style={{ fontSize: 13, fontWeight: 400, color: c.textMuted }}>{viewingItem.unit}</span>
            </div>
          </div>

          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: c.textMuted }}>Default Cost Price</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
              {viewingItem.costPrice !== null && viewingItem.costPrice !== undefined ? `$${Number(viewingItem.costPrice).toFixed(2)}` : "—"}
            </div>
          </div>

          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: c.textMuted }}>Default Selling Price</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
              ${Number(viewingItem.sellingPrice).toFixed(2)}
            </div>
          </div>

          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: c.textMuted }}>Target Margin</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: marginPct !== null ? "#2E7D32" : c.text, marginTop: 4 }}>
              {marginPct !== null ? `${marginPct}%` : "—"}
            </div>
          </div>

          <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: c.textMuted }}>Reorder Threshold</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
              {viewingItem.reorderLevel}{" "}
              <span style={{ fontSize: 12, fontWeight: 400, color: c.textMuted }}>(Order: {viewingItem.reorderQuantity})</span>
            </div>
          </div>
        </div>

        {viewingItem.description && (
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
            <strong style={{ color: c.text }}>Description: </strong>
            {viewingItem.description}
          </div>
        )}

        {/* Section 1: Linked Suppliers & Fixed Agreed Pricing */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: c.text, margin: 0 }}>
                Suppliers & Agreed Purchase Pricing
              </h2>
              <p style={{ fontSize: 12, color: c.textMuted, margin: "3px 0 0 0" }}>
                Suppliers authorized to provide this item and their locked PO unit price.
              </p>
            </div>
            {!readOnly && unlinkedSuppliers.length > 0 && !isLinkingSupplier && (
              <button
                onClick={() => {
                  setNewSupplierId(unlinkedSuppliers[0]?.id || "");
                  setNewAgreedPrice(viewingItem.costPrice ? String(viewingItem.costPrice) : "");
                  setNewIsPrimary(itemSuppliers.length === 0);
                  setIsLinkingSupplier(true);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 7,
                  border: `1px solid ${c.border}`,
                  background: c.surface,
                  color: c.text,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <Plus size={13} /> Link Supplier
              </button>
            )}
          </div>

          {/* Add Supplier Form */}
          {isLinkingSupplier && (
            <div
              style={{
                background: c.surfaceMuted,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 10 }}>
                Link Sourcing Supplier
              </div>
              {supplierFormError && (
                <div style={{ padding: "7px 10px", background: c.dangerSoft, color: c.danger, borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
                  {supplierFormError}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: c.textMuted, display: "block", marginBottom: 4 }}>
                    Supplier *
                  </label>
                  <select style={inp(c)} value={newSupplierId} onChange={(e) => setNewSupplierId(e.target.value)}>
                    {unlinkedSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplierName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11.5, color: c.textMuted, display: "block", marginBottom: 4 }}>
                    Agreed Purchase Price ($) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    style={inp(c)}
                    value={newAgreedPrice}
                    onChange={(e) => setNewAgreedPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11.5, color: c.textMuted, display: "block", marginBottom: 4 }}>
                    Supplier SKU (Optional)
                  </label>
                  <input
                    style={inp(c)}
                    value={newSupplierSku}
                    onChange={(e) => setNewSupplierSku(e.target.value)}
                    placeholder="e.g. SUP-SKU-99"
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer", color: c.text }}>
                  <input type="checkbox" checked={newIsPrimary} onChange={(e) => setNewIsPrimary(e.target.checked)} />
                  Set as Primary Supplier
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setIsLinkingSupplier(false)}
                    style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${c.border}`, background: c.surface, color: c.text, fontSize: 12, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLinkSupplier}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: c.accent, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Save Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Suppliers Table */}
          {loadingDetails ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: c.textMuted, fontSize: 13 }}>
              Loading suppliers...
            </div>
          ) : itemSuppliers.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: c.textFaint, fontSize: 13 }}>
              No suppliers linked yet. Link a supplier above to enable purchase orders for this item.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: c.textFaint, textAlign: "left", borderBottom: `1px solid ${c.border}` }}>
                    <th style={{ padding: "8px 12px", fontWeight: 500 }}>Supplier</th>
                    <th style={{ padding: "8px 12px", fontWeight: 500 }}>Primary</th>
                    <th style={{ padding: "8px 12px", fontWeight: 500 }}>Agreed Price</th>
                    <th style={{ padding: "8px 12px", fontWeight: 500 }}>Supplier SKU</th>
                    {!readOnly && <th style={{ padding: "8px 12px", fontWeight: 500, textAlign: "right" }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {itemSuppliers.map((link) => (
                    <tr key={link.supplier_id} style={{ borderBottom: `1px solid ${c.border}` }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: c.text }}>
                        {link.supplier_name}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {link.is_primary ? (
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#2E7D32", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            ● Primary
                          </span>
                        ) : !readOnly ? (
                          <button
                            onClick={() => handleSetPrimary(link.supplier_id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: c.textMuted,
                              fontSize: 12,
                              cursor: "pointer",
                              padding: 0,
                              textDecoration: "underline",
                            }}
                          >
                            Set as primary
                          </button>
                        ) : (
                          <span style={{ color: c.textFaint, fontSize: 12 }}>Secondary</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {editingSupplierId === link.supplier_id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={editAgreedPrice}
                              onChange={(e) => setEditAgreedPrice(e.target.value)}
                              style={{ width: 80, padding: "4px 8px", borderRadius: 6, border: `1px solid ${c.border}`, fontSize: 12.5 }}
                            />
                            <button
                              onClick={() => handleSaveAgreedPrice(link.supplier_id)}
                              style={{ background: c.accent, color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingSupplierId(null)}
                              style={{ background: "none", border: "none", color: c.textMuted, fontSize: 11, cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 600, color: c.text }}>
                            ${Number(link.agreed_price).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", color: c.textMuted, fontFamily: "monospace", fontSize: 12 }}>
                        {link.supplier_sku || "—"}
                      </td>
                      {!readOnly && (
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            {editingSupplierId !== link.supplier_id && (
                              <button
                                onClick={() => {
                                  setEditingSupplierId(link.supplier_id);
                                  setEditAgreedPrice(String(link.agreed_price));
                                }}
                                style={{ background: "none", border: "none", color: c.textMuted, cursor: "pointer", padding: 2 }}
                                title="Edit Agreed Price"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleUnlinkSupplier(link.supplier_id)}
                              style={{ background: "none", border: "none", color: c.danger, cursor: "pointer", padding: 2 }}
                              title="Unlink Supplier"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2: Active Batches with Batch Cost & Batch Selling Price */}
        <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: c.text, margin: 0 }}>
              Active Stock Batches & Batch Pricing
            </h2>
            <p style={{ fontSize: 12, color: c.textMuted, margin: "3px 0 0 0" }}>
              Granular inventory tracking per supplier lot with custom batch purchase and selling prices.
            </p>
          </div>

          {loadingDetails ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: c.textMuted, fontSize: 13 }}>
              Loading batches...
            </div>
          ) : itemBatches.length === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: c.textFaint, fontSize: 13 }}>
              No active stock batches found. Receive purchase orders to generate new batches.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: c.textFaint, textAlign: "left", borderBottom: `1px solid ${c.border}` }}>
                    <th style={{ padding: "8px 12px", fontWeight: 500 }}>Batch #</th>
                    <th style={{ padding: "8px 12px", fontWeight: 500 }}>Supplier</th>
                    <th style={{ padding: "8px 12px", fontWeight: 500 }}>Quantity</th>
                    <th style={{ padding: "8px 12px", fontWeight: 500 }}>Expiry Date</th>
                    <th style={{ padding: "8px 12px", fontWeight: 500 }}>Purchase Cost</th>
                    <th style={{ padding: "8px 12px", fontWeight: 500 }}>Batch Selling Price</th>
                  </tr>
                </thead>
                <tbody>
                  {itemBatches.map((b) => (
                    <tr key={b.batch_id} style={{ borderBottom: `1px solid ${c.border}` }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: c.text, fontFamily: "monospace" }}>
                        {b.batch_number}
                      </td>
                      <td style={{ padding: "10px 12px", color: c.text }}>
                        {b.supplier_name || "—"}
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: b.current_quantity <= 0 ? "#DC2626" : c.text }}>
                        {b.current_quantity} <span style={{ fontSize: 11.5, color: c.textMuted }}>/ {b.initial_quantity}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: c.textMuted }}>
                        {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : "No Expiry"}
                      </td>
                      <td style={{ padding: "10px 12px", color: c.textMuted }}>
                        ${Number(b.purchase_price).toFixed(2)}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontWeight: 600, color: "#2E7D32" }}>
                          ${Number(b.selling_price ?? viewingItem.sellingPrice).toFixed(2)}
                        </span>
                        {b.selling_price && Number(b.selling_price) !== Number(viewingItem.sellingPrice) && (
                          <span style={{ fontSize: 10.5, color: "#D97706", marginLeft: 6 }}>
                            (Override)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit General Item Modal */}
        {isEditingItem && (
          <Modal title="Edit Item Details" onClose={() => setIsEditingItem(false)} c={c} width={520}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {editError && (
                <div style={{ padding: "8px 12px", background: c.dangerSoft, color: c.danger, borderRadius: 8, fontSize: 12.5 }}>
                  {editError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Item Name *" c={c}>
                  <input style={inp(c)} value={editForm.itemName || ""} onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })} />
                </Field>
                <Field label="SKU *" c={c}>
                  <input style={inp(c)} value={editForm.sku || ""} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} />
                </Field>
              </div>

              <Field label="Description" c={c}>
                <textarea rows={2} style={{ ...inp(c), resize: "vertical" }} value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Category" c={c}>
                  <select style={inp(c)} value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                    {categoryList.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Unit" c={c}>
                  <select style={inp(c)} value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}>
                    {units.map((u) => (
                      <option key={u.unit_id} value={u.unit_symbol}>{u.unit_name} ({u.unit_symbol})</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Cost Price ($)" c={c}>
                  <input type="number" min="0.01" step="0.01" style={inp(c)} value={editForm.costPrice || ""} onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })} />
                </Field>
                <Field label="Default Selling Price ($)" c={c}>
                  <input type="number" min="0.01" step="0.01" style={inp(c)} value={editForm.sellingPrice || ""} onChange={(e) => setEditForm({ ...editForm, sellingPrice: e.target.value })} />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Reorder Alert Level" c={c}>
                  <input type="number" min="0" style={inp(c)} value={editForm.reorderLevel ?? ""} onChange={(e) => setEditForm({ ...editForm, reorderLevel: e.target.value })} />
                </Field>
                <Field label="Default Reorder Qty" c={c}>
                  <input type="number" min="0" style={inp(c)} value={editForm.reorderQuantity ?? ""} onChange={(e) => setEditForm({ ...editForm, reorderQuantity: e.target.value })} />
                </Field>
              </div>

              <Field label="Item Status" c={c}>
                <select
                  style={inp(c)}
                  value={editForm.active ? "true" : "false"}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.value === "true" })}
                >
                  <option value="true">● Active (Enabled in catalog & stock movements)</option>
                  <option value="false">○ Inactive (Disabled from new sales & orders)</option>
                </select>
              </Field>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button onClick={() => setIsEditingItem(false)} style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.surface, color: c.text, fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={handleSaveItemEdit} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: c.accent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Save Changes
                </button>
              </div>
            </div>
          </Modal>
        )}

        {deleteConfirmOpen && itemToDelete && (
          <ConfirmDeleteModal
            title="Delete Item"
            message={`Are you sure you want to delete ${itemToDelete.itemName} (${itemToDelete.sku})? This action cannot be undone.`}
            onConfirm={handleDeleteItem}
            onClose={() => {
              setDeleteConfirmOpen(false);
              setItemToDelete(null);
            }}
            c={c}
          />
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MAIN INVENTORY TABLE VIEW
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Search & Filter Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240, maxWidth: 360 }}>
          <SearchBar
            value={itemSearch}
            onChange={(val) => {
              setItemSearch(val);
              setPage(1);
            }}
            placeholder="Search item name, SKU..."
            c={c}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {selected.length > 0 && !readOnly && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, color: c.textMuted }}>{selected.length} selected</span>
              <button
                onClick={() => setSelected([])}
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
              <button
                onClick={() => setBatchDeleteOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `1px solid ${c.dangerSoft || "#FEE2E2"}`,
                  background: c.dangerSoft || "#FEF2F2",
                  color: c.danger || "#DC2626",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <Trash2 size={13} />
                <span>Delete Selected ({selected.length})</span>
              </button>
            </div>
          )}

          {/* Category Filter */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => {
                setCategoryFilterOpen(!categoryFilterOpen);
                setHealthFilterOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 8,
                border: `1px solid ${selectedCategory ? c.accent : c.border}`,
                background: selectedCategory ? c.accentSoft : c.surface,
                color: selectedCategory ? c.accent : c.text,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <Filter size={13} />
              {selectedCategory || "All Categories"}
              <ChevronDown size={13} />
            </button>

            {categoryFilterOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 4,
                  width: 200,
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
                    setSelectedCategory(null);
                    setCategoryFilterOpen(false);
                    setPage(1);
                  }}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 6,
                    fontSize: 12.5,
                    cursor: "pointer",
                    background: !selectedCategory ? c.surfaceMuted : "transparent",
                    color: !selectedCategory ? c.accent : c.text,
                  }}
                >
                  All Categories
                </div>
                {categoryList.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.name);
                      setCategoryFilterOpen(false);
                      setPage(1);
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 6,
                      fontSize: 12.5,
                      cursor: "pointer",
                      background: selectedCategory === cat.name ? c.surfaceMuted : "transparent",
                      color: selectedCategory === cat.name ? c.accent : c.text,
                    }}
                  >
                    {cat.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stock Health Filter */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => {
                setHealthFilterOpen(!healthFilterOpen);
                setCategoryFilterOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 8,
                border: `1px solid ${selectedHealth ? c.accent : c.border}`,
                background: selectedHealth ? c.accentSoft : c.surface,
                color: selectedHealth ? c.accent : c.text,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {selectedHealth ? `Health: ${selectedHealth}` : "All Stock Health"}
              <ChevronDown size={13} />
            </button>

            {healthFilterOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 4,
                  width: 170,
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 8,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
                  zIndex: 20,
                  padding: 4,
                }}
              >
                {[
                  { label: "All Health", val: null },
                  { label: "Healthy", val: "HEALTHY" },
                  { label: "Low Stock", val: "LOW_STOCK" },
                  { label: "Critical", val: "CRITICAL" },
                ].map((opt) => (
                  <div
                    key={opt.label}
                    onClick={() => {
                      setSelectedHealth(opt.val);
                      setHealthFilterOpen(false);
                      setPage(1);
                    }}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 6,
                      fontSize: 12.5,
                      cursor: "pointer",
                      background: selectedHealth === opt.val ? c.surfaceMuted : "transparent",
                      color: selectedHealth === opt.val ? c.accent : c.text,
                    }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: c.textFaint, textAlign: "left", background: c.surfaceMuted }}>
                <th style={{ width: 38, padding: "10px 14px" }}>
                  <Cb checked={allPageSelected} onChange={toggleAllPage} c={c} />
                </th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Item Name & SKU</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Category</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>In Stock</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Stock Health</th>
                {!isSales && <th style={{ padding: "10px 14px", fontWeight: 500 }}>Cost Price</th>}
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Selling Price</th>
                <th style={{ padding: "10px 14px", fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingItems && itemList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: "center", color: c.textMuted }}>
                    Loading inventory items...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: "center", color: c.textFaint }}>
                    No items found matching your criteria.
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setViewingItem(item)}
                    style={{
                      borderTop: `1px solid ${c.border}`,
                      cursor: "pointer",
                      background: selected.includes(item.id) ? c.surfaceMuted : "transparent",
                    }}
                  >
                    <td style={{ padding: "12px 14px" }} onClick={(e) => e.stopPropagation()}>
                      <Cb checked={selected.includes(item.id)} onChange={(chk) => toggleOne(item.id, chk)} c={c} />
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, color: c.text }}>{item.itemName}</div>
                      <div style={{ fontSize: 11.5, color: c.textMuted, fontFamily: "monospace", marginTop: 2 }}>
                        {item.sku}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", color: c.textMuted }}>
                      {item.category}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 600, color: item.quantity <= 0 ? "#DC2626" : c.text }}>
                        {item.quantity.toLocaleString()}
                      </span>{" "}
                      <span style={{ fontSize: 11.5, color: c.textFaint }}>{item.unit}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <HealthIndicator status={item.healthStatus} />
                    </td>
                    {!isSales && (
                      <td style={{ padding: "12px 14px", color: c.textMuted }}>
                        {item.costPrice !== null && item.costPrice !== undefined ? `$${Number(item.costPrice).toFixed(2)}` : "—"}
                      </td>
                    )}
                    <td style={{ padding: "12px 14px", fontWeight: 600, color: c.text }}>
                      ${Number(item.sellingPrice).toFixed(2)}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontSize: 12, color: item.active ? "#2E7D32" : c.textFaint }}>
                        {item.active ? "● Active" : "○ Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalCount > PAGE_SIZE && (
          <div style={{ borderTop: `1px solid ${c.border}` }}>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              c={c}
            />
          </div>
        )}
      </div>

      {/* Create Modal */}
      {addItemOpen && (
        <CreateItemModal
          onClose={() => setAddItemOpen(false)}
          onSubmit={handleCreateItem}
          categoryList={categoryList}
          units={units}
          c={c}
        />
      )}

      {/* Batch Delete Confirmation Modal */}
      {batchDeleteOpen && (
        <ConfirmDeleteModal
          title={`Delete ${selected.length} Selected Items`}
          itemName={`${selected.length} items`}
          itemType="items"
          message={`Are you sure you want to permanently delete the ${selected.length} selected inventory item(s)? This action cannot be undone.`}
          onClose={() => setBatchDeleteOpen(false)}
          onConfirm={handleBatchDeleteItems}
          loading={batchDeleting}
          c={c}
        />
      )}
    </div>
  );
}
