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
} from "lucide-react";
import { useTheme } from "../ThemeContext";
import { useData } from "../DataContext";
import { apiFetch } from "@/lib/api";
import { Checkbox as Cb, Modal, SearchBar, Pagination, ConfirmDeleteModal } from "@/components/ui";
import { isReadOnly } from "@/lib/roles";

export interface Category {
  category_id: string;
  category_name: string;
  description?: string;
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

// ── Category Modal (Create / Edit) ──────────────────────────────────
interface CategoryModalProps {
  initialData?: Category | null;
  onClose: () => void;
  onSave: (data: { category_name: string; description: string }) => Promise<void> | void;
  c: any;
}
function CategoryModal({ initialData, onClose, onSave, c }: CategoryModalProps) {
  const [categoryName, setCategoryName] = useState(initialData?.category_name || "");
  const [description, setDescription] = useState(initialData?.description || "");
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
      await onSave({ category_name: categoryName, description });
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
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}
        <Field label="Category Name *" c={c}>
          <input
            style={inp(c)}
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="e.g. Tools & Hardware"
            autoFocus
          />
        </Field>
        <Field label="Description" c={c}>
          <textarea
            style={{ ...inp(c), height: 80, resize: "vertical" }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of category..."
          />
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
            disabled={saving}
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
            {saving ? "Saving..." : initialData ? "Save changes" : "Add category"}
          </button>
        </div>
      </div>
    </Modal>
  );
}



// ── Main Page Component ─────────────────────────────────────
export default function CategoriesPage() {
  const { c } = useTheme();
  const { setHeaderActions, loggedInUser, refreshCategories } = useData();

  // Derive read-only mode from role
  const readOnly = isReadOnly(loggedInUser?.role ?? "", "categories");

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  // Header button — hidden for read-only roles
  useEffect(() => {
    if (readOnly) {
      setHeaderActions(null);
      return;
    }
    setHeaderActions(
      <button
        onClick={() => setIsAddModalOpen(true)}
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
        <Plus size={15} /> New category
      </button>
    );
    return () => setHeaderActions(null);
  }, [c, setHeaderActions, readOnly]);

  // Fetch categories from backend
  const loadCategories = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<Category[]>("/categories/");
      setCategories(data);
    } catch (err: any) {
      setError(err.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSaveCategory = async (data: { category_name: string; description: string }) => {
    if (editingCategory) {
      await apiFetch(`/categories/${editingCategory.category_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          category_name: data.category_name,
          description: data.description || undefined,
        }),
      });
    } else {
      await apiFetch("/categories/", {
        method: "POST",
        body: JSON.stringify({
          category_name: data.category_name,
          description: data.description || undefined,
        }),
      });
    }
    await loadCategories();
    refreshCategories();
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    try {
      await apiFetch(`/categories/${categoryToDelete.category_id}`, { method: "DELETE" });
      setSelected((prev) => prev.filter((x) => x !== categoryToDelete.category_id));
      setCategoryToDelete(null);
      await loadCategories();
      refreshCategories();
    } catch (err: any) {
      alert(err.message || "Failed to delete category");
    }
  };

  // Filter categories
  const filteredCategories = useMemo(() => {
    const q = categorySearch.toLowerCase().trim();
    const list = !q
      ? categories
      : categories.filter(
        (cat) =>
          cat.category_name.toLowerCase().includes(q) ||
          (cat.description && cat.description.toLowerCase().includes(q))
      );
    return [...list].sort((a, b) => a.category_name.localeCompare(b.category_name));
  }, [categories, categorySearch]);

  const totalCount = filteredCategories.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageCategories = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredCategories.slice(start, start + PAGE_SIZE);
  }, [filteredCategories, page]);

  const allPageSelected =
    pageCategories.length > 0 &&
    pageCategories.every((cat) => selected.includes(cat.category_id));

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const toggleAllPage = () => {
    const pageIds = pageCategories.map((cat) => cat.category_id);
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
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                flex: 1,
                minWidth: 250,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Cb checked={allPageSelected} onChange={toggleAllPage} c={c} />
                <span
                  style={{
                    fontSize: 12.5,
                    color: c.textMuted,
                    whiteSpace: "nowrap",
                  }}
                >
                  {selected.length > 0
                    ? `${selected.length} selected`
                    : "Select all"}
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
              {/* Search bar */}
              <SearchBar
                value={categorySearch}
                onChange={(val) => {
                  setCategorySearch(val);
                  setPage(1);
                }}
                placeholder="Search categories..."
                c={c}
                maxWidth={260}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                margin: 16,
                padding: 12,
                borderRadius: 8,
                background: c.dangerSoft,
                color: c.danger,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Table */}
          <div style={{ overflowX: "auto", flex: 1 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                minWidth: 500,
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
                  {["Category", "Description", ...(readOnly ? [] : ["Actions"])].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 20px",
                        fontWeight: 500,
                        fontSize: 11.5,
                        textAlign: h === "Actions" ? "right" : "left",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: "32px 20px",
                        textAlign: "center",
                        color: c.textFaint,
                      }}
                    >
                      Loading categories...
                    </td>
                  </tr>
                ) : pageCategories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: "32px 20px",
                        textAlign: "center",
                        color: c.textFaint,
                      }}
                    >
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  pageCategories.map((cat) => (
                    <tr
                      key={cat.category_id}
                      style={{
                        borderTop: `1px solid ${c.border}`,
                        transition: "background 0.1s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = c.surfaceMuted;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td
                        style={{ padding: "11px 20px" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Cb
                          checked={selected.includes(cat.category_id)}
                          onChange={(v) => toggleOne(cat.category_id, v)}
                          c={c}
                        />
                      </td>
                      <td style={{ padding: "11px 20px", fontWeight: 600 }}>
                        {cat.category_name}
                      </td>
                      <td style={{ padding: "11px 20px", color: c.textMuted }}>
                        {cat.description || "-"}
                      </td>
                      <td
                        style={{ padding: "11px 20px", textAlign: "right" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!readOnly && (
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              onClick={() => setEditingCategory(cat)}
                              title="Edit category"
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
                              onClick={() => setCategoryToDelete(cat)}
                              title="Delete category"
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="categories"
            onPageChange={setPage}
            c={c}
          />
        </div>
      </div>

      {/* Add Category Modal */}
      {isAddModalOpen && (
        <CategoryModal
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleSaveCategory}
          c={c}
        />
      )}

      {/* Edit Category Modal */}
      {editingCategory && (
        <CategoryModal
          initialData={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={handleSaveCategory}
          c={c}
        />
      )}

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <ConfirmDeleteModal
          title="Delete category"
          itemName={categoryToDelete.category_name}
          itemType="category"
          onClose={() => setCategoryToDelete(null)}
          onConfirm={handleDeleteConfirm}
          c={c}
        />
      )}
    </div>
  );
}

