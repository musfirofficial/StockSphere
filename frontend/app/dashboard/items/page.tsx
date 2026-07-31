"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Package,
  ChevronDown,
  Filter
} from "lucide-react";
import { useTheme } from "../ThemeContext";
import { useData, Item, Category, Supplier } from "../DataContext";
import { isReadOnly, isSalesRole } from "@/lib/roles";
import { apiFetch } from "@/lib/api";
import { Checkbox as Cb, StatusBadge, Modal, SearchBar, Pagination, ConfirmDeleteModal } from "@/components/ui";

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

// ── Create Item Modal ──────────────────────────────────────
interface CreateItemModalProps {
  onClose: () => void;
  onSave: (item: Partial<Item>) => void;
  categoryList: Category[];
  supplierList: Supplier[];
  c: any;
}
function CreateItemModal({ onClose, onSave, categoryList, supplierList, c }: CreateItemModalProps) {
  const [itemName, setItemName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categoryList[0]?.name || "");
  const [supplier, setSupplier] = useState(supplierList[0]?.supplierName || "");
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState("pcs");
  const [costPrice, setCostPrice] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(0);
  const [reorderQuantity, setReorderQuantity] = useState(0);
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!category && categoryList.length > 0) {
      setCategory(categoryList[0].name);
    }
  }, [categoryList, category]);

  useEffect(() => {
    if (!supplier && supplierList.length > 0) {
      setSupplier(supplierList[0].supplierName);
    }
  }, [supplierList, supplier]);

  const handleSubmit = () => {
    setError("");
    if (!itemName.trim() || !sku.trim() || !unit.trim() || !category || !supplier) {
      setError("Item Name, SKU, Category, Supplier, and Unit are required.");
      return;
    }
    onSave({
      itemName,
      sku,
      description,
      category,
      supplier,
      quantity: Number(quantity) || 0,
      unit,
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      reorderLevel: Number(reorderLevel) || 0,
      reorderQuantity: Number(reorderQuantity) || 0,
      active,
    });
  };

  return (
    <Modal title="Create New Inventory Item" onClose={onClose} c={c} width={500}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: c.dangerSoft,
              color: c.danger,
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Item Name" c={c}>
            <input
              style={inp(c)}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Copper Wire 2.5mm"
            />
          </Field>
          <Field label="SKU" c={c}>
            <input
              style={inp(c)}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. SKU-WR-25"
            />
          </Field>
        </div>

        <Field label="Description" c={c}>
          <textarea
            style={{ ...inp(c), height: 50, resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Product details, measurements, or specs..."
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Category" c={c}>
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
          <Field label="Supplier" c={c}>
            <select
              style={inp(c)}
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            >
              {supplierList.map((supp) => (
                <option key={supp.id} value={supp.supplierName}>
                  {supp.supplierName}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Quantity in Stock" c={c}>
            <input
              type="number"
              min="0"
              style={inp(c)}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            />
          </Field>
          <Field label="Unit" c={c}>
            <input
              style={inp(c)}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. pcs, meters, rolls"
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Cost Price (Rs)" c={c}>
            <input
              type="number"
              min="0"
              step="0.01"
              style={inp(c)}
              value={costPrice}
              onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
            />
          </Field>
          <Field label="Selling Price (Rs)" c={c}>
            <input
              type="number"
              min="0"
              step="0.01"
              style={inp(c)}
              value={sellingPrice}
              onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Reorder Level" c={c}>
            <input
              type="number"
              min="0"
              style={inp(c)}
              value={reorderLevel}
              onChange={(e) => setReorderLevel(parseInt(e.target.value) || 0)}
            />
          </Field>
          <Field label="Reorder Quantity" c={c}>
            <input
              type="number"
              min="0"
              style={inp(c)}
              value={reorderQuantity}
              onChange={(e) => setReorderQuantity(parseInt(e.target.value) || 0)}
            />
          </Field>
        </div>

        <Field label="Is Active" c={c}>
          <select
            style={inp(c)}
            value={active ? "active" : "inactive"}
            onChange={(e) => setActive(e.target.value === "active")}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 12,
          }}
        >
          <button
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
            Add item
          </button>
        </div>
      </div>
    </Modal>
  );
}



// ── Main Page Component ─────────────────────────────────────
export default function ItemsPage() {
  const { mode, c } = useTheme();
  const {
    itemList,
    setItemList,
    categoryList,
    setCategoryList,
    supplierList,
    setSupplierList,
    setHeaderActions,
    loggedInUser,
    addItem,
    saveItemEdit,
    deleteItem,
    fetchCategories,
    fetchSuppliers,
    fetchItems,
    refreshItems,
  } = useData();

  // Derive read-only and sales flags from role
  const readOnly = isReadOnly(loggedInUser?.role ?? "", "items");
  const isSales = isSalesRole(loggedInUser?.role ?? "");

  // Selected checkboxes
  const [selected, setSelected] = useState<string[]>([]);
  // Text search filter
  const [itemSearch, setItemSearch] = useState("");

  // Dropdown states for filters
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [supplierFilterOpen, setSupplierFilterOpen] = useState(false);

  // Selected filter criteria
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  // Search terms inside the dropdown filters
  const [catSearch, setCatSearch] = useState("");
  const [suppSearch, setSuppSearch] = useState("");

  // Detail / Edit slide panel states
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Item>>({});
  const [editError, setEditError] = useState("");

  // Modal open states
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Set page header actions dynamically — hidden for read-only roles
  useEffect(() => {
    if (readOnly) {
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
        <Plus size={15} /> New item
      </button>
    );
    return () => setHeaderActions(null);
  }, [c, setHeaderActions, readOnly]);

  // Sync edit form fields when selecting another item
  useEffect(() => {
    if (selectedItem) {
      setEditForm(selectedItem);
      setEditError("");
    }
  }, [selectedItem]);

  // Filtered lists for dropdown contents
  const filteredCategoriesForDropdown = useMemo(() => {
    return categoryList.filter((cat) =>
      cat.name.toLowerCase().includes(catSearch.toLowerCase())
    );
  }, [categoryList, catSearch]);

  const filteredSuppliersForDropdown = useMemo(() => {
    return supplierList.filter((supp) =>
      supp.supplierName.toLowerCase().includes(suppSearch.toLowerCase())
    );
  }, [supplierList, suppSearch]);

  // Filter main inventory item list based on search and selected category/supplier filters
  const filteredItems = useMemo(() => {
    return itemList
      .filter((item) => {
        const q = itemSearch.toLowerCase();
        const matchesSearch =
          !q ||
          item.itemName.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q));

        const matchesCategory = !selectedCategory || item.category === selectedCategory;
        const matchesSupplier = !selectedSupplier || item.supplier === selectedSupplier;

        return matchesSearch && matchesCategory && matchesSupplier;
      })
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [itemList, itemSearch, selectedCategory, selectedSupplier]);

  const totalCount = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((item) => selected.includes(item.id));

  // Handlers
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
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

  // Load categories, suppliers, and items from backend API
  const loadCategoriesAndSuppliers = async () => {
    try {
      await Promise.all([
        fetchCategories(),
        fetchSuppliers(),
      ]);
    } catch (err: any) {
      console.error("Failed to load categories/suppliers:", err);
    }
  };

  const loadItemsFromBackend = async () => {
    try {
      const data = await apiFetch<any[]>("/items/");
      const mapped: Item[] = data.map((item: any) => ({
        id: item.item_id,
        sku: item.sku,
        itemName: item.item_name,
        description: item.description || "",
        category: item.category_name || (categoryList.find((c) => c.id === item.category_id)?.name) || "",
        supplier: item.supplier_name || (supplierList.find((s) => s.id === item.supplier_id)?.supplierName) || "",
        quantity: item.quantity_in_stock,
        unit: item.unit,
        costPrice: item.cost_price ?? null,
        sellingPrice: item.selling_price,
        reorderLevel: item.reorder_level,
        reorderQuantity: item.reorder_quantity,
        active: item.is_active,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
      setItemList(mapped);
    } catch (err: any) {
      console.error("Failed to load items from backend:", err);
    }
  };

  useEffect(() => {
    loadCategoriesAndSuppliers();
    fetchItems();
  }, []);

  const handleCreateItem = async (newItem: any) => {
    // Find category_id and supplier_id from categoryList and supplierList
    const cat = categoryList.find((c) => c.name === newItem.category);
    const supp = supplierList.find((s) => s.supplierName === newItem.supplier);

    if (!cat) {
      alert("Selected category is invalid.");
      return;
    }
    if (!supp) {
      alert("Selected supplier is invalid.");
      return;
    }

    try {
      await apiFetch("/items/", {
        method: "POST",
        body: JSON.stringify({
          item_name: newItem.itemName,
          sku: newItem.sku,
          description: newItem.description || null,
          category_id: cat.id,
          supplier_id: supp.id,
          quantity_in_stock: Number(newItem.quantity) || 0,
          reorder_quantity: Number(newItem.reorderQuantity) || 0,
          unit: newItem.unit,
          cost_price: Number(newItem.costPrice) || 0.01,
          selling_price: Number(newItem.sellingPrice) || 0.01,
          reorder_level: Number(newItem.reorderLevel) || 0,
        }),
      });
      await refreshItems();
      setAddItemOpen(false);
      setPage(1);
    } catch (err: any) {
      alert(err.message || "Failed to create item.");
    }
  };

  const handleSaveEdit = async (form: Partial<Item>) => {
    setEditError("");
    if (!form.itemName?.trim() || !form.sku?.trim() || !form.unit?.trim() || !form.category) {
      setEditError("Item Name, SKU, Category, and Unit are required.");
      return;
    }

    const cat = categoryList.find((c) => c.name === form.category);
    const supp = supplierList.find((s) => s.supplierName === form.supplier);

    try {
      const body: any = {
        item_name: form.itemName,
        sku: form.sku,
        description: form.description || null,
        unit: form.unit,
        selling_price: Number(form.sellingPrice) || undefined,
        reorder_level: Number(form.reorderLevel) || undefined,
        reorder_quantity: Number(form.reorderQuantity) || undefined,
        is_active: form.active,
      };

      if (form.costPrice !== null && form.costPrice !== undefined) {
        body.cost_price = Number(form.costPrice);
      }
      if (cat) body.category_id = cat.id;
      if (supp) body.supplier_id = supp.id;

      const updated = await apiFetch<any>(`/items/${form.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      await refreshItems();

      const updatedMapped: Item = {
        id: updated.item_id,
        sku: updated.sku,
        itemName: updated.item_name,
        description: updated.description || "",
        category: updated.category_name || form.category || "",
        supplier: updated.supplier_name || form.supplier || "",
        quantity: updated.quantity_in_stock,
        unit: updated.unit,
        costPrice: updated.cost_price ?? null,
        sellingPrice: updated.selling_price,
        reorderLevel: updated.reorder_level,
        reorderQuantity: updated.reorder_quantity,
        active: updated.is_active,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      };

      setSelectedItem(updatedMapped);
      setIsEditing(false);
    } catch (err: any) {
      setEditError(err.message || "Failed to update item.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      await apiFetch(`/items/${itemToDelete.id}`, {
        method: "DELETE",
      });
      await refreshItems();
      setSelected((prev) => prev.filter((x) => x !== itemToDelete.id));
      if (selectedItem?.id === itemToDelete.id) {
        setSelectedItem(null);
      }
      setItemToDelete(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete item.");
    }
  };

  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <div
        style={{
          display: "flex",
          height: "100%",
          gap: 20,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Table List Section */}
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
          {/* Toolbar */}
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
            {/* Selection indicators */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Cb checked={allPageSelected} onChange={toggleAllPage} c={c} />
                <span
                  style={{
                    fontSize: 12.5,
                    color: c.textMuted,
                    whiteSpace: "nowrap",
                  }}
                >
                  {selected.length > 0 ? `${selected.length} selected` : "Select all"}
                </span>
              </div>
              {selected.length > 0 && (
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
              )}
            </div>

            {/* Filter controls and Search */}
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
              {/* Category Filter Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => {
                    setCategoryFilterOpen(!categoryFilterOpen);
                    setSupplierFilterOpen(false);
                    setCatSearch("");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${selectedCategory ? c.accent : c.border}`,
                    background: selectedCategory ? c.accentSoft : c.surface,
                    color: selectedCategory ? c.accent : c.text,
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <Filter size={13} />
                  <span>
                    {selectedCategory ? `Cat: ${selectedCategory}` : "All Categories"}
                  </span>
                  <ChevronDown size={13} />
                </button>

                {categoryFilterOpen && (
                  <>
                    <div
                      onClick={() => setCategoryFilterOpen(false)}
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 100,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        right: 0,
                        width: 220,
                        background: c.surface,
                        border: `1px solid ${c.border}`,
                        borderRadius: 10,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                        zIndex: 101,
                        padding: 6,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: `1px solid ${c.border}`,
                          background: c.inputBg,
                        }}
                      >
                        <Search size={12} color={c.textFaint} />
                        <input
                          value={catSearch}
                          onChange={(e) => setCatSearch(e.target.value)}
                          placeholder="Search categories..."
                          style={{
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            color: c.text,
                            fontSize: 12,
                            width: "100%",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                      <div style={{ maxHeight: 180, overflowY: "auto" }}>
                        <button
                          onClick={() => {
                            setSelectedCategory(null);
                            setCategoryFilterOpen(false);
                            setPage(1);
                          }}
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            textAlign: "left",
                            fontSize: 12.5,
                            border: "none",
                            background: !selectedCategory ? c.accentSoft : "transparent",
                            color: !selectedCategory ? c.accent : c.text,
                            fontWeight: !selectedCategory ? 600 : 400,
                            cursor: "pointer",
                            borderRadius: 4,
                          }}
                        >
                          All Categories
                        </button>
                        {filteredCategoriesForDropdown.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setSelectedCategory(cat.name);
                              setCategoryFilterOpen(false);
                              setPage(1);
                            }}
                            style={{
                              width: "100%",
                              padding: "7px 10px",
                              textAlign: "left",
                              fontSize: 12.5,
                              border: "none",
                              background: selectedCategory === cat.name ? c.accentSoft : "transparent",
                              color: selectedCategory === cat.name ? c.accent : c.text,
                              fontWeight: selectedCategory === cat.name ? 600 : 400,
                              cursor: "pointer",
                              borderRadius: 4,
                            }}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Supplier Filter Dropdown — hidden for Sales (no supplier data) */}
              {!isSales && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => {
                    setSupplierFilterOpen(!supplierFilterOpen);
                    setCategoryFilterOpen(false);
                    setSuppSearch("");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${selectedSupplier ? c.accent : c.border}`,
                    background: selectedSupplier ? c.accentSoft : c.surface,
                    color: selectedSupplier ? c.accent : c.text,
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <Filter size={13} />
                  <span>
                    {selectedSupplier ? `Supplier: ${selectedSupplier.substring(0, 10)}${selectedSupplier.length > 10 ? "..." : ""}` : "All Suppliers"}
                  </span>
                  <ChevronDown size={13} />
                </button>

                {supplierFilterOpen && (
                  <>
                    <div
                      onClick={() => setSupplierFilterOpen(false)}
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 100,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        right: 0,
                        width: 220,
                        background: c.surface,
                        border: `1px solid ${c.border}`,
                        borderRadius: 10,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                        zIndex: 101,
                        padding: 6,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: `1px solid ${c.border}`,
                          background: c.inputBg,
                        }}
                      >
                        <Search size={12} color={c.textFaint} />
                        <input
                          value={suppSearch}
                          onChange={(e) => setSuppSearch(e.target.value)}
                          placeholder="Search suppliers..."
                          style={{
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            color: c.text,
                            fontSize: 12,
                            width: "100%",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                      <div style={{ maxHeight: 180, overflowY: "auto" }}>
                        <button
                          onClick={() => {
                            setSelectedSupplier(null);
                            setSupplierFilterOpen(false);
                            setPage(1);
                          }}
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            textAlign: "left",
                            fontSize: 12.5,
                            border: "none",
                            background: !selectedSupplier ? c.accentSoft : "transparent",
                            color: !selectedSupplier ? c.accent : c.text,
                            fontWeight: !selectedSupplier ? 600 : 400,
                            cursor: "pointer",
                            borderRadius: 4,
                          }}
                        >
                          All Suppliers
                        </button>
                        {filteredSuppliersForDropdown.map((supp) => (
                          <button
                            key={supp.id}
                            onClick={() => {
                              setSelectedSupplier(supp.supplierName);
                              setSupplierFilterOpen(false);
                              setPage(1);
                            }}
                            style={{
                              width: "100%",
                              padding: "7px 10px",
                              textAlign: "left",
                              fontSize: 12.5,
                              border: "none",
                              background: selectedSupplier === supp.supplierName ? c.accentSoft : "transparent",
                              color: selectedSupplier === supp.supplierName ? c.accent : c.text,
                              fontWeight: selectedSupplier === supp.supplierName ? 600 : 400,
                              cursor: "pointer",
                              borderRadius: 4,
                            }}
                          >
                            {supp.supplierName}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              )}

              {/* Text Search Bar */}
              <SearchBar
                value={itemSearch}
                onChange={(val) => {
                  setItemSearch(val);
                  setPage(1);
                }}
                placeholder="Search items..."
                c={c}
                maxWidth={220}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto", flex: 1 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                minWidth: 700,
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
                  <th
                    style={{
                      width: 48,
                      padding: "10px 20px",
                      fontWeight: 500,
                      fontSize: 11.5,
                    }}
                  />
                  {[
                    "SKU",
                    "Item name",
                    "Category",
                    "Supplier",
                    "Stock Qty",
                    "Status",
                    ...(readOnly ? [] : ["Actions"]),
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 20px",
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
                {pageItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: "32px 20px",
                        textAlign: "center",
                        color: c.textFaint,
                      }}
                    >
                      No items found matching filters.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((item) => {
                    const isSelected = item.id === selectedItem?.id;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item);
                          setIsEditing(false);
                        }}
                        style={{
                          borderTop: `1px solid ${c.border}`,
                          background: isSelected ? c.accentSoft : "transparent",
                          cursor: "pointer",
                          transition: "background 0.1s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.background = c.surfaceMuted;
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <td
                          style={{ padding: "11px 20px" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Cb
                            checked={selected.includes(item.id)}
                            onChange={(v) => toggleOne(item.id, v)}
                            c={c}
                          />
                        </td>
                        <td style={{ padding: "11px 20px", color: c.textMuted, fontFamily: "monospace" }}>
                          {item.sku}
                        </td>
                        <td style={{ padding: "11px 20px", fontWeight: 600 }}>
                          {item.itemName}
                        </td>
                        <td style={{ padding: "11px 20px", color: c.textMuted }}>
                          {item.category}
                        </td>
                        <td style={{ padding: "11px 20px" }}>
                          {!item.supplier ? (
                            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: c.surfaceMuted, color: c.textFaint }}>
                              No Access
                            </span>
                          ) : (
                            <span style={{ color: c.textMuted }}>{item.supplier}</span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: "11px 20px",
                            fontWeight: 600,
                          }}
                        >
                          {item.quantity} {item.unit}
                        </td>
                        <td style={{ padding: "11px 20px" }}>
                          <StatusBadge active={item.active} c={c} />
                        </td>
                        <td
                          style={{ padding: "11px 20px" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!readOnly && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => {
                                  setSelectedItem(item);
                                  setIsEditing(true);
                                }}
                                title="Edit item"
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
                                  cursor: "pointer",
                                }}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setItemToDelete(item)}
                                title="Delete item"
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 7,
                                  border: `1px solid ${c.border}`,
                                  background: c.surface,
                                  color: c.danger,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="items"
            onPageChange={setPage}
            c={c}
          />
        </div>

        {/* ── Item Detail Slide Panel ── */}
        {selectedItem && (
          <>
            {isMobile && (
              <div
                onClick={() => setSelectedItem(null)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.4)",
                  zIndex: 290,
                }}
              />
            )}
            <div
              style={{
                position: isMobile ? "fixed" : "relative",
                top: 0,
                right: 0,
                bottom: 0,
                width: isMobile ? "100%" : "380px",
                height: "100%",
                background: c.surface,
                border: isMobile ? "none" : `1px solid ${c.border}`,
                borderLeft: `1px solid ${c.border}`,
                boxShadow: isMobile ? "-4px 0 20px rgba(0,0,0,0.2)" : "none",
                borderRadius: isMobile ? "0" : "14px",
                zIndex: 300,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "18px 20px",
                  borderBottom: `1px solid ${c.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>
                  {isEditing ? "Edit Item Details" : "Item Details"}
                </h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: c.textMuted,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                {editError && (
                  <div
                    style={{
                      padding: "8px 12px",
                      background: c.dangerSoft,
                      color: c.danger,
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 500,
                      marginBottom: 16,
                    }}
                  >
                    {editError}
                  </div>
                )}

                {!isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        paddingBottom: 16,
                        borderBottom: `1px solid ${c.border}`,
                      }}
                    >
                      <div
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 12,
                          background: c.accentSoft,
                          color: c.accent,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Package size={28} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>
                          {selectedItem.itemName}
                        </h4>
                        <p style={{ fontSize: 12, color: c.textFaint, fontFamily: "monospace" }}>
                          SKU: {selectedItem.sku}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <Field label="Description" c={c}>
                        <div style={{ fontSize: 13, color: c.text, lineHeight: 1.5 }}>
                          {selectedItem.description || "No description provided."}
                        </div>
                      </Field>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Category" c={c}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            {selectedItem.category}
                          </div>
                        </Field>
                        <Field label="Supplier" c={c}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            {!selectedItem.supplier ? (
                              <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: c.surfaceMuted, color: c.textFaint }}>
                                No Access
                              </span>
                            ) : selectedItem.supplier}
                          </div>
                        </Field>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Quantity in Stock" c={c}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: selectedItem.quantity <= selectedItem.reorderLevel ? c.danger : c.text,
                            }}
                          >
                            {selectedItem.quantity} {selectedItem.unit}
                          </div>
                        </Field>
                        <Field label="Status" c={c}>
                          <StatusBadge active={selectedItem.active} c={c} />
                        </Field>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Cost Price" c={c}>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                            {selectedItem.costPrice == null ? (
                              <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: c.surfaceMuted, color: c.textFaint }}>
                                No Access
                              </span>
                            ) : (
                              `Rs ${selectedItem.costPrice.toLocaleString()}`
                            )}
                          </div>
                        </Field>
                        <Field label="Selling Price" c={c}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: c.accent }}>
                            Rs {selectedItem.sellingPrice.toLocaleString()}
                          </div>
                        </Field>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Reorder Level" c={c}>
                          <div style={{ fontSize: 13, color: c.textMuted }}>
                            {selectedItem.reorderLevel} {selectedItem.unit}
                          </div>
                        </Field>
                        <Field label="Reorder Quantity" c={c}>
                          <div style={{ fontSize: 13, color: c.textMuted }}>
                            {selectedItem.reorderQuantity} {selectedItem.unit}
                          </div>
                        </Field>
                      </div>

                      <div
                        style={{
                          height: 1,
                          background: c.border,
                          margin: "8px 0",
                        }}
                      />

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Created At" c={c}>
                          <div style={{ fontSize: 12, color: c.textFaint }}>
                            {selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : "—"}
                          </div>
                        </Field>
                        <Field label="Updated At" c={c}>
                          <div style={{ fontSize: 12, color: c.textFaint }}>
                            {selectedItem.updatedAt ? new Date(selectedItem.updatedAt).toLocaleString() : "—"}
                          </div>
                        </Field>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* EDIT MODE */
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Field label="Item Name" c={c}>
                      <input
                        style={inp(c)}
                        value={editForm.itemName || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, itemName: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="SKU" c={c}>
                      <input
                        style={inp(c)}
                        value={editForm.sku || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, sku: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Description" c={c}>
                      <textarea
                        style={{ ...inp(c), height: 60, resize: "vertical" }}
                        value={editForm.description || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, description: e.target.value })
                        }
                      />
                    </Field>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Category" c={c}>
                        <select
                          style={inp(c)}
                          value={editForm.category || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, category: e.target.value })
                          }
                        >
                          {categoryList.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Supplier" c={c}>
                        <select
                          style={inp(c)}
                          value={editForm.supplier || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, supplier: e.target.value })
                          }
                        >
                          {supplierList.map((supp) => (
                            <option key={supp.id} value={supp.supplierName}>
                              {supp.supplierName}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Quantity" c={c}>
                        <input
                          type="number"
                          style={inp(c)}
                          value={editForm.quantity || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              quantity: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                      <Field label="Unit" c={c}>
                        <input
                          style={inp(c)}
                          value={editForm.unit || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, unit: e.target.value })
                          }
                        />
                      </Field>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Cost Price" c={c}>
                        <input
                          type="number"
                          step="0.01"
                          style={inp(c)}
                          value={editForm.costPrice || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              costPrice: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                      <Field label="Selling Price" c={c}>
                        <input
                          type="number"
                          step="0.01"
                          style={inp(c)}
                          value={editForm.sellingPrice || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              sellingPrice: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Reorder Level" c={c}>
                        <input
                          type="number"
                          style={inp(c)}
                          value={editForm.reorderLevel || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              reorderLevel: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                      <Field label="Reorder Quantity" c={c}>
                        <input
                          type="number"
                          style={inp(c)}
                          value={editForm.reorderQuantity || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              reorderQuantity: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                    </div>

                    <Field label="Status" c={c}>
                      <select
                        style={inp(c)}
                        value={editForm.active ? "active" : "inactive"}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            active: e.target.value === "active",
                          })
                        }
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>
                  </div>
                )}
              </div>

              {/* Panel Footer */}
              <div
                style={{
                  padding: "14px 20px",
                  borderTop: `1px solid ${c.border}`,
                  background: c.surfaceMuted,
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  flexShrink: 0,
                }}
              >
                {!isEditing ? (
                  <>
                    {!readOnly && (
                      <button
                        onClick={() => setIsEditing(true)}
                        style={{
                          flex: 1,
                          padding: "9px",
                          borderRadius: 8,
                          border: `1px solid ${c.border}`,
                          background: c.surface,
                          color: c.text,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <Pencil size={13} /> Edit Details
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedItem(null)}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: c.accent,
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      style={{
                        padding: "9px 14px",
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
                      onClick={() => handleSaveEdit(editForm)}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: c.accent,
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Save Changes
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {addItemOpen && (
        <CreateItemModal
          onClose={() => setAddItemOpen(false)}
          onSave={handleCreateItem}
          categoryList={categoryList}
          supplierList={supplierList}
          c={c}
        />
      )}

      {itemToDelete && (
        <ConfirmDeleteModal
          title="Delete Item"
          itemName={itemToDelete.itemName}
          itemType="item"
          message={`Delete ${itemToDelete.itemName} (${itemToDelete.sku})? This will remove the item details. This action cannot be undone.`}
          onClose={() => setItemToDelete(null)}
          onConfirm={handleDeleteConfirm}
          c={c}
        />
      )}
    </div>
  );
}
