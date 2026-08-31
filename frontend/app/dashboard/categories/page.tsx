"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Folder,
  Scale,
  Tags,
  CheckCircle2,
  AlertCircle,
  Filter,
} from "lucide-react";
import { useTheme } from "../ThemeContext";
import { apiFetch } from "@/lib/api";
import {
  Checkbox as Cb,
  StatusBadge,
  Modal,
  SearchBar,
  Pagination,
  ConfirmDeleteModal,
} from "@/components/ui";
import { isReadOnly } from "@/lib/roles";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface Category {
  category_id: string;
  category_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  unit_id: string;
  unit_name: string;
  unit_symbol: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

// ============================================================================
// Sub-Modals
// ============================================================================

// ── Category Modal (Create / Edit) ──────────────────────────────────
interface CategoryModalProps {
  initialData?: Category | null;
  onClose: () => void;
  onSave: (data: {
    category_name: string;
    description: string;
  }) => Promise<void> | void;
  c: any;
}
function CategoryModal({
  initialData,
  onClose,
  onSave,
  c,
}: CategoryModalProps) {
  const [categoryName, setCategoryName] = useState(
    initialData?.category_name || "",
  );
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!categoryName.trim()) {
      setError("Category name is required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        category_name: categoryName.trim(),
        description: description.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initialData ? "Edit Category" : "Create New Category"}
      onClose={onClose}
      c={c}
      width={440}
      closeOnOverlayClick={false}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: c.dangerSoft,
              color: c.danger,
              borderRadius: 8,
              fontSize: 12.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <Field label="Category Name *" c={c}>
          <input
            style={inp(c)}
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="e.g. Electrical Components, Raw Materials"
            autoFocus
          />
        </Field>

        <Field label="Description (Optional)" c={c}>
          <textarea
            style={{ ...inp(c), height: 75, resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief overview or scope of products in this category..."
          />
        </Field>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 14px",
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
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: "none",
              background: c.accent,
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving
              ? "Saving..."
              : initialData
                ? "Update Category"
                : "Create Category"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Unit Modal (Create / Edit) ──────────────────────────────────────
interface UnitModalProps {
  initialData?: Unit | null;
  onClose: () => void;
  onSave: (data: {
    unit_name: string;
    unit_symbol: string;
    description: string;
    is_active?: boolean;
  }) => Promise<void> | void;
  c: any;
}
function UnitModal({ initialData, onClose, onSave, c }: UnitModalProps) {
  const [unitName, setUnitName] = useState(initialData?.unit_name || "");
  const [unitSymbol, setUnitSymbol] = useState(initialData?.unit_symbol || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [isActive, setIsActive] = useState(
    initialData ? initialData.is_active : true,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!unitName.trim()) {
      setError("Unit name is required (e.g. Kilograms, Pieces).");
      return;
    }
    if (!unitSymbol.trim()) {
      setError("Unit symbol is required (e.g. kg, pcs, m).");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        unit_name: unitName.trim(),
        unit_symbol: unitSymbol.trim().toLowerCase(),
        description: description.trim(),
        is_active: isActive,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save unit of measure");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        initialData ? "Edit Unit of Measure" : "Create New Unit of Measure"
      }
      onClose={onClose}
      c={c}
      width={440}
      closeOnOverlayClick={false}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: c.dangerSoft,
              color: c.danger,
              borderRadius: 8,
              fontSize: 12.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div
          style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12 }}
        >
          <Field label="Unit Name *" c={c}>
            <input
              style={inp(c)}
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="e.g. Kilograms, Pieces, Liters"
              autoFocus
            />
          </Field>

          <Field label="Symbol / Abbr *" c={c}>
            <input
              style={inp(c)}
              value={unitSymbol}
              onChange={(e) => setUnitSymbol(e.target.value)}
              placeholder="e.g. kg, pcs, L, m"
            />
          </Field>
        </div>

        <Field label="Description (Optional)" c={c}>
          <textarea
            style={{ ...inp(c), height: 65, resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Metric weight, packaging unit, etc."
          />
        </Field>

        {initialData && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 2,
            }}
          >
            <Cb checked={isActive} onChange={setIsActive} c={c} />
            <label
              style={{ fontSize: 13, color: c.text, cursor: "pointer" }}
              onClick={() => setIsActive(!isActive)}
            >
              Active unit (available for inventory items)
            </label>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 14px",
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
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: "none",
              background: c.accent,
              color: "#fff",
              fontSize: 13,
              fontWeight: 500,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : initialData ? "Update Unit" : "Create Unit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function CategoriesAndUnitsPage() {
  const { c } = useTheme();
  const [userRole, setUserRole] = useState<string>("Admin");

  useEffect(() => {
    const r =
      localStorage.getItem("user_role") ||
      sessionStorage.getItem("user_role") ||
      "Admin";
    setUserRole(r);
  }, []);

  const readOnly = isReadOnly(userRole, "categories");

  // Tab State: "categories" | "units"
  const [activeTab, setActiveTab] = useState<"categories" | "units">(
    "categories",
  );

  // ── Categories State ──────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [catSearch, setCatSearch] = useState("");
  const [catSelectedIds, setCatSelectedIds] = useState<string[]>([]);
  const [catPage, setCatPage] = useState(1);
  const catLimit = 10;

  // Modals for Categories
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catToEdit, setCatToEdit] = useState<Category | null>(null);
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);
  const [isCatBatchDeleteOpen, setIsCatBatchDeleteOpen] = useState(false);

  // ── Units State ───────────────────────────────────────────
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [unitSearch, setUnitSearch] = useState("");
  const [unitStatusFilter, setUnitStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");
  const [unitSelectedIds, setUnitSelectedIds] = useState<string[]>([]);
  const [unitPage, setUnitPage] = useState(1);
  const unitLimit = 10;

  // Modals for Units
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<Unit | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [isUnitBatchDeleteOpen, setIsUnitBatchDeleteOpen] = useState(false);

  // ── Bottom Toast Notification State ───────────────────────
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // ── Fetch Data Functions ──────────────────────────────────
  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const data = await apiFetch<Category[]>("/categories/");
      setCategories(data || []);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load categories");
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchUnits = async () => {
    setLoadingUnits(true);
    try {
      const data = await apiFetch<Unit[]>("/units/");
      setUnits(data || []);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load measurement units");
    } finally {
      setLoadingUnits(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchUnits();
  }, []);

  // ── Category Handlers ─────────────────────────────────────
  const handleSaveCategory = async (data: {
    category_name: string;
    description: string;
  }) => {
    try {
      if (catToEdit) {
        await apiFetch(`/categories/${catToEdit.category_id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        showToast(
          "success",
          `Category "${data.category_name}" updated successfully.`,
        );
      } else {
        await apiFetch("/categories/", {
          method: "POST",
          body: JSON.stringify(data),
        });
        showToast(
          "success",
          `Category "${data.category_name}" created successfully.`,
        );
      }
      await fetchCategories();
    } catch (err: any) {
      showToast("error", err.message || "Failed to save category");
      throw err;
    }
  };

  const handleDeleteCategory = async () => {
    if (!catToDelete) return;
    try {
      await apiFetch(`/categories/${catToDelete.category_id}`, {
        method: "DELETE",
      });
      showToast("success", `Category "${catToDelete.category_name}" deleted.`);
      setCatToDelete(null);
      setCatSelectedIds((prev) =>
        prev.filter((id) => id !== catToDelete.category_id),
      );
      await fetchCategories();
    } catch (err: any) {
      showToast("error", err.message || "Failed to delete category");
    }
  };

  const handleBatchDeleteCategories = async () => {
    if (catSelectedIds.length === 0) return;
    try {
      let successCount = 0;
      for (const id of catSelectedIds) {
        try {
          await apiFetch(`/categories/${id}`, { method: "DELETE" });
          successCount++;
        } catch {
          // Skip if locked
        }
      }
      showToast(
        "success",
        `Successfully deleted ${successCount} category(ies).`,
      );
      setCatSelectedIds([]);
      setIsCatBatchDeleteOpen(false);
      await fetchCategories();
    } catch (err: any) {
      showToast("error", err.message || "Batch delete encountered errors.");
    }
  };

  // ── Unit Handlers ─────────────────────────────────────────
  const handleSaveUnit = async (data: {
    unit_name: string;
    unit_symbol: string;
    description: string;
    is_active?: boolean;
  }) => {
    try {
      if (unitToEdit) {
        await apiFetch(`/units/${unitToEdit.unit_id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        showToast(
          "success",
          `Unit "${data.unit_name}" (${data.unit_symbol}) updated successfully.`,
        );
      } else {
        await apiFetch("/units/", {
          method: "POST",
          body: JSON.stringify({
            unit_name: data.unit_name,
            unit_symbol: data.unit_symbol,
            description: data.description,
          }),
        });
        showToast(
          "success",
          `Unit "${data.unit_name}" (${data.unit_symbol}) created successfully.`,
        );
      }
      await fetchUnits();
    } catch (err: any) {
      showToast("error", err.message || "Failed to save unit");
      throw err;
    }
  };

  const handleDeleteUnit = async () => {
    if (!unitToDelete) return;
    try {
      await apiFetch(`/units/${unitToDelete.unit_id}`, {
        method: "DELETE",
      });
      showToast(
        "success",
        `Unit "${unitToDelete.unit_name}" (${unitToDelete.unit_symbol}) deleted.`,
      );
      setUnitToDelete(null);
      setUnitSelectedIds((prev) =>
        prev.filter((id) => id !== unitToDelete.unit_id),
      );
      await fetchUnits();
    } catch (err: any) {
      showToast("error", err.message || "Failed to delete unit");
    }
  };

  const handleBatchDeleteUnits = async () => {
    if (unitSelectedIds.length === 0) return;
    try {
      let successCount = 0;
      for (const id of unitSelectedIds) {
        try {
          await apiFetch(`/units/${id}`, { method: "DELETE" });
          successCount++;
        } catch {
          // Skip if locked
        }
      }
      showToast("success", `Successfully deleted ${successCount} unit(s).`);
      setUnitSelectedIds([]);
      setIsUnitBatchDeleteOpen(false);
      await fetchUnits();
    } catch (err: any) {
      showToast("error", err.message || "Batch delete encountered errors.");
    }
  };

  // ── Filtered & Paginated Categories ───────────────────────
  const filteredCategories = useMemo(() => {
    const q = catSearch.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter(
      (cat) =>
        cat.category_name.toLowerCase().includes(q) ||
        (cat.description && cat.description.toLowerCase().includes(q)),
    );
  }, [categories, catSearch]);

  const paginatedCategories = useMemo(() => {
    const start = (catPage - 1) * catLimit;
    return filteredCategories.slice(start, start + catLimit);
  }, [filteredCategories, catPage]);

  const catTotalPages = Math.ceil(filteredCategories.length / catLimit) || 1;

  // ── Filtered & Paginated Units ────────────────────────────
  const filteredUnits = useMemo(() => {
    let list = units;
    if (unitStatusFilter === "ACTIVE") {
      list = list.filter((u) => u.is_active);
    } else if (unitStatusFilter === "INACTIVE") {
      list = list.filter((u) => !u.is_active);
    }
    const q = unitSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.unit_name.toLowerCase().includes(q) ||
        u.unit_symbol.toLowerCase().includes(q) ||
        (u.description && u.description.toLowerCase().includes(q)),
    );
  }, [units, unitSearch, unitStatusFilter]);

  const paginatedUnits = useMemo(() => {
    const start = (unitPage - 1) * unitLimit;
    return filteredUnits.slice(start, start + unitLimit);
  }, [filteredUnits, unitPage]);

  const unitTotalPages = Math.ceil(filteredUnits.length / unitLimit) || 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        paddingBottom: 60,
      }}
    >
      {/* ── Top Bar: Segmented Tabs & Action Button ─────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Segmented Navigation Tabs */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 4,
            background: c.surfaceMuted,
            borderRadius: 10,
            border: `1px solid ${c.border}`,
            width: "fit-content",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 16px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeTab === "categories" ? 600 : 500,
              fontFamily: "inherit",
              background:
                activeTab === "categories" ? c.surface : "transparent",
              color: activeTab === "categories" ? c.text : c.textMuted,
              boxShadow:
                activeTab === "categories"
                  ? "0 1px 3px rgba(0,0,0,0.06)"
                  : "none",
              transition: "all .15s ease",
            }}
          >
            <Folder
              size={15}
              color={activeTab === "categories" ? c.accent : c.textMuted}
            />
            <span>Product Categories</span>
            <span
              style={{
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 99,
                background:
                  activeTab === "categories" ? c.accentSoft : c.border,
                color: activeTab === "categories" ? c.accent : c.textMuted,
                fontWeight: 600,
              }}
            >
              {categories.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("units")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 16px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: activeTab === "units" ? 600 : 500,
              fontFamily: "inherit",
              background: activeTab === "units" ? c.surface : "transparent",
              color: activeTab === "units" ? c.text : c.textMuted,
              boxShadow:
                activeTab === "units" ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all .15s ease",
            }}
          >
            <Scale
              size={15}
              color={activeTab === "units" ? c.accent : c.textMuted}
            />
            <span>Measurement Units</span>
            <span
              style={{
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 99,
                background: activeTab === "units" ? c.accentSoft : c.border,
                color: activeTab === "units" ? c.accent : c.textMuted,
                fontWeight: 600,
              }}
            >
              {units.length}
            </span>
          </button>
        </div>

        {/* Primary Action Button */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => {
              if (activeTab === "categories") {
                setCatToEdit(null);
                setIsCatModalOpen(true);
              } else {
                setUnitToEdit(null);
                setIsUnitModalOpen(true);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 16px",
              borderRadius: 9,
              border: "none",
              background: c.accent,
              color: "#FFFFFF",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 2px 8px -2px rgba(59,110,94,0.3)",
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>
              {activeTab === "categories" ? "Add Category" : "Add Unit"}
            </span>
          </button>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────── */}
      {/* TAB 1: PRODUCT CATEGORIES                                */}
      {/* ───────────────────────────────────────────────────────── */}
      {activeTab === "categories" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filter Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ width: 300 }}>
              <SearchBar
                value={catSearch}
                onChange={(v) => {
                  setCatSearch(v);
                  setCatPage(1);
                }}
                placeholder="Search categories..."
                c={c}
              />
            </div>

            {catSelectedIds.length > 0 && !readOnly && (
              <button
                type="button"
                onClick={() => setIsCatBatchDeleteOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `1px solid ${c.dangerSoft}`,
                  background: c.dangerSoft,
                  color: c.danger,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={14} />
                <span>Delete Selected ({catSelectedIds.length})</span>
              </button>
            )}
          </div>

          {/* Categories Table Card */}
          <div
            style={{
              background: c.surface,
              borderRadius: 12,
              border: `1px solid ${c.border}`,
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: `1px solid ${c.border}`,
                      background: c.surfaceMuted,
                      color: c.textMuted,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {!readOnly && (
                      <th style={{ padding: "11px 14px", width: 36 }}>
                        <Cb
                          checked={
                            paginatedCategories.length > 0 &&
                            paginatedCategories.every((cat) =>
                              catSelectedIds.includes(cat.category_id),
                            )
                          }
                          onChange={(checked) => {
                            if (checked) {
                              const newIds = Array.from(
                                new Set([
                                  ...catSelectedIds,
                                  ...paginatedCategories.map(
                                    (i) => i.category_id,
                                  ),
                                ]),
                              );
                              setCatSelectedIds(newIds);
                            } else {
                              const pageIds = paginatedCategories.map(
                                (i) => i.category_id,
                              );
                              setCatSelectedIds(
                                catSelectedIds.filter(
                                  (id) => !pageIds.includes(id),
                                ),
                              );
                            }
                          }}
                          c={c}
                        />
                      </th>
                    )}
                    <th style={{ padding: "11px 16px" }}>Category Name</th>
                    <th style={{ padding: "11px 16px" }}>Description</th>
                    <th style={{ padding: "11px 16px", width: 140 }}>
                      Created Date
                    </th>
                    {!readOnly && (
                      <th
                        style={{
                          padding: "11px 16px",
                          width: 90,
                          textAlign: "right",
                        }}
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loadingCategories ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "32px 16px",
                          textAlign: "center",
                          color: c.textMuted,
                        }}
                      >
                        Loading categories...
                      </td>
                    </tr>
                  ) : paginatedCategories.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "32px 16px",
                          textAlign: "center",
                          color: c.textMuted,
                        }}
                      >
                        {catSearch
                          ? "No matching categories found."
                          : "No categories defined yet."}
                      </td>
                    </tr>
                  ) : (
                    paginatedCategories.map((cat) => {
                      const isSelected = catSelectedIds.includes(
                        cat.category_id,
                      );
                      return (
                        <tr
                          key={cat.category_id}
                          style={{
                            borderBottom: `1px solid ${c.border}`,
                            background: isSelected
                              ? `${c.accentSoft}44`
                              : "transparent",
                          }}
                        >
                          {!readOnly && (
                            <td style={{ padding: "12px 14px" }}>
                              <Cb
                                checked={isSelected}
                                onChange={(checked) => {
                                  if (checked) {
                                    setCatSelectedIds([
                                      ...catSelectedIds,
                                      cat.category_id,
                                    ]);
                                  } else {
                                    setCatSelectedIds(
                                      catSelectedIds.filter(
                                        (id) => id !== cat.category_id,
                                      ),
                                    );
                                  }
                                }}
                                c={c}
                              />
                            </td>
                          )}
                          <td
                            style={{
                              padding: "12px 16px",
                              fontWeight: 600,
                              color: c.text,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <Folder size={16} color={c.accent} />
                              <span>{cat.category_name}</span>
                            </div>
                          </td>
                          <td
                            style={{ padding: "12px 16px", color: c.textMuted }}
                          >
                            {cat.description || "—"}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              color: c.textFaint,
                              fontSize: 12,
                            }}
                          >
                            {new Date(cat.created_at).toLocaleDateString()}
                          </td>
                          {!readOnly && (
                            <td
                              style={{
                                padding: "12px 16px",
                                textAlign: "right",
                              }}
                            >
                              <div style={{ display: "inline-flex", gap: 4 }}>
                                <button
                                  type="button"
                                  title="Edit category"
                                  onClick={() => {
                                    setCatToEdit(cat);
                                    setIsCatModalOpen(true);
                                  }}
                                  style={{
                                    padding: 6,
                                    borderRadius: 6,
                                    border: "none",
                                    background: "transparent",
                                    color: c.textMuted,
                                    cursor: "pointer",
                                  }}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  title="Delete category"
                                  onClick={() => setCatToDelete(cat)}
                                  style={{
                                    padding: 6,
                                    borderRadius: 6,
                                    border: "none",
                                    background: "transparent",
                                    color: c.danger,
                                    cursor: "pointer",
                                  }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredCategories.length > catLimit && (
              <div style={{ borderTop: `1px solid ${c.border}` }}>
                <Pagination
                  page={catPage}
                  totalPages={catTotalPages}
                  totalCount={filteredCategories.length}
                  pageSize={catLimit}
                  itemLabel="categories"
                  onPageChange={setCatPage}
                  c={c}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── */}
      {/* TAB 2: MEASUREMENT UNITS                                  */}
      {/* ───────────────────────────────────────────────────────── */}
      {activeTab === "units" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filter Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flex: 1,
                minWidth: 260,
              }}
            >
              <div style={{ width: 280 }}>
                <SearchBar
                  value={unitSearch}
                  onChange={(v) => {
                    setUnitSearch(v);
                    setUnitPage(1);
                  }}
                  placeholder="Search units (e.g. kg, pcs, liters)..."
                  c={c}
                />
              </div>

              {/* Status Filter */}
              <select
                value={unitStatusFilter}
                onChange={(e) => {
                  setUnitStatusFilter(e.target.value as any);
                  setUnitPage(1);
                }}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: `1px solid ${c.border}`,
                  background: c.surface,
                  color: c.text,
                  fontSize: 12.5,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>

            {unitSelectedIds.length > 0 && !readOnly && (
              <button
                type="button"
                onClick={() => setIsUnitBatchDeleteOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `1px solid ${c.dangerSoft}`,
                  background: c.dangerSoft,
                  color: c.danger,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={14} />
                <span>Delete Selected ({unitSelectedIds.length})</span>
              </button>
            )}
          </div>

          {/* Units Table Card */}
          <div
            style={{
              background: c.surface,
              borderRadius: 12,
              border: `1px solid ${c.border}`,
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: `1px solid ${c.border}`,
                      background: c.surfaceMuted,
                      color: c.textMuted,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {!readOnly && (
                      <th style={{ padding: "11px 14px", width: 36 }}>
                        <Cb
                          checked={
                            paginatedUnits.length > 0 &&
                            paginatedUnits.every((u) =>
                              unitSelectedIds.includes(u.unit_id),
                            )
                          }
                          onChange={(checked) => {
                            if (checked) {
                              const newIds = Array.from(
                                new Set([
                                  ...unitSelectedIds,
                                  ...paginatedUnits.map((i) => i.unit_id),
                                ]),
                              );
                              setUnitSelectedIds(newIds);
                            } else {
                              const pageIds = paginatedUnits.map(
                                (i) => i.unit_id,
                              );
                              setUnitSelectedIds(
                                unitSelectedIds.filter(
                                  (id) => !pageIds.includes(id),
                                ),
                              );
                            }
                          }}
                          c={c}
                        />
                      </th>
                    )}
                    <th style={{ padding: "11px 16px" }}>Unit Name</th>
                    <th style={{ padding: "11px 16px", width: 120 }}>Symbol</th>
                    <th style={{ padding: "11px 16px" }}>Description</th>
                    <th style={{ padding: "11px 16px", width: 110 }}>Status</th>
                    {!readOnly && (
                      <th
                        style={{
                          padding: "11px 16px",
                          width: 90,
                          textAlign: "right",
                        }}
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loadingUnits ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: "32px 16px",
                          textAlign: "center",
                          color: c.textMuted,
                        }}
                      >
                        Loading measurement units...
                      </td>
                    </tr>
                  ) : paginatedUnits.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: "32px 16px",
                          textAlign: "center",
                          color: c.textMuted,
                        }}
                      >
                        {unitSearch
                          ? "No matching units found."
                          : "No measurement units defined yet."}
                      </td>
                    </tr>
                  ) : (
                    paginatedUnits.map((u) => {
                      const isSelected = unitSelectedIds.includes(u.unit_id);
                      return (
                        <tr
                          key={u.unit_id}
                          style={{
                            borderBottom: `1px solid ${c.border}`,
                            background: isSelected
                              ? `${c.accentSoft}44`
                              : "transparent",
                          }}
                        >
                          {!readOnly && (
                            <td style={{ padding: "12px 14px" }}>
                              <Cb
                                checked={isSelected}
                                onChange={(checked) => {
                                  if (checked) {
                                    setUnitSelectedIds([
                                      ...unitSelectedIds,
                                      u.unit_id,
                                    ]);
                                  } else {
                                    setUnitSelectedIds(
                                      unitSelectedIds.filter(
                                        (id) => id !== u.unit_id,
                                      ),
                                    );
                                  }
                                }}
                                c={c}
                              />
                            </td>
                          )}
                          <td
                            style={{
                              padding: "12px 16px",
                              fontWeight: 600,
                              color: c.text,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <span>{u.unit_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: c.surfaceMuted,
                                border: `1px solid ${c.border}`,
                                color: c.text,
                                fontFamily: "monospace",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {u.unit_symbol}
                            </span>
                          </td>
                          <td
                            style={{ padding: "12px 16px", color: c.textMuted }}
                          >
                            {u.description || "—"}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <StatusBadge active={u.is_active} c={c} />
                          </td>
                          {!readOnly && (
                            <td
                              style={{
                                padding: "12px 16px",
                                textAlign: "right",
                              }}
                            >
                              <div style={{ display: "inline-flex", gap: 4 }}>
                                <button
                                  type="button"
                                  title="Edit unit"
                                  onClick={() => {
                                    setUnitToEdit(u);
                                    setIsUnitModalOpen(true);
                                  }}
                                  style={{
                                    padding: 6,
                                    borderRadius: 6,
                                    border: "none",
                                    background: "transparent",
                                    color: c.textMuted,
                                    cursor: "pointer",
                                  }}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  title="Delete unit"
                                  onClick={() => setUnitToDelete(u)}
                                  style={{
                                    padding: 6,
                                    borderRadius: 6,
                                    border: "none",
                                    background: "transparent",
                                    color: c.danger,
                                    cursor: "pointer",
                                  }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredUnits.length > unitLimit && (
              <div style={{ borderTop: `1px solid ${c.border}` }}>
                <Pagination
                  page={unitPage}
                  totalPages={unitTotalPages}
                  totalCount={filteredUnits.length}
                  pageSize={unitLimit}
                  itemLabel="units"
                  onPageChange={setUnitPage}
                  c={c}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Category Create / Edit Modal ────────────────────── */}
      {isCatModalOpen && (
        <CategoryModal
          initialData={catToEdit}
          onClose={() => {
            setIsCatModalOpen(false);
            setCatToEdit(null);
          }}
          onSave={handleSaveCategory}
          c={c}
        />
      )}

      {/* ── Category Delete Modal ───────────────────────────── */}
      {catToDelete && (
        <ConfirmDeleteModal
          title="Delete Category"
          itemName={catToDelete.category_name}
          itemType="category"
          message={`Are you sure you want to delete the category "${catToDelete.category_name}"?`}
          onConfirm={handleDeleteCategory}
          onClose={() => setCatToDelete(null)}
          c={c}
        />
      )}

      {/* ── Category Batch Delete Modal ─────────────────────── */}
      {isCatBatchDeleteOpen && (
        <ConfirmDeleteModal
          title="Delete Selected Categories"
          itemName={`${catSelectedIds.length} categories`}
          itemType="categories"
          message={`Are you sure you want to delete ${catSelectedIds.length} selected categories?`}
          onConfirm={handleBatchDeleteCategories}
          onClose={() => setIsCatBatchDeleteOpen(false)}
          c={c}
        />
      )}

      {/* ── Unit Create / Edit Modal ────────────────────────── */}
      {isUnitModalOpen && (
        <UnitModal
          initialData={unitToEdit}
          onClose={() => {
            setIsUnitModalOpen(false);
            setUnitToEdit(null);
          }}
          onSave={handleSaveUnit}
          c={c}
        />
      )}

      {/* ── Unit Delete Modal ───────────────────────────────── */}
      {unitToDelete && (
        <ConfirmDeleteModal
          title="Delete Measurement Unit"
          itemName={`${unitToDelete.unit_name} (${unitToDelete.unit_symbol})`}
          itemType="unit"
          message={`Are you sure you want to delete the unit "${unitToDelete.unit_name}" (${unitToDelete.unit_symbol})? It cannot be deleted if assigned to existing items.`}
          onConfirm={handleDeleteUnit}
          onClose={() => setUnitToDelete(null)}
          c={c}
        />
      )}

      {/* ── Unit Batch Delete Modal ─────────────────────────── */}
      {isUnitBatchDeleteOpen && (
        <ConfirmDeleteModal
          title="Delete Selected Units"
          itemName={`${unitSelectedIds.length} measurement units`}
          itemType="units"
          message={`Are you sure you want to delete ${unitSelectedIds.length} selected measurement units?`}
          onConfirm={handleBatchDeleteUnits}
          onClose={() => setIsUnitBatchDeleteOpen(false)}
          c={c}
        />
      )}

      {/* ── Bottom Toast / Popup Notification ───────────────── */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 18px",
            borderRadius: 10,
            background: toast.type === "success" ? "#EBF7F2" : "#FCECEB",
            color: toast.type === "success" ? "#2E574A" : c.danger,
            border: `1px solid ${toast.type === "success" ? "#3B6E5E44" : "#B3473C44"}`,
            boxShadow: "0 8px 24px -4px rgba(0,0,0,0.12)",
            fontSize: 13.5,
            fontWeight: 500,
            animation: "fadeIn .2s ease",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={18} color="#3B6E5E" />
          ) : (
            <AlertCircle size={18} color={c.danger} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
