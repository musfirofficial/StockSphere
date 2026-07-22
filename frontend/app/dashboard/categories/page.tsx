"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "../ThemeContext";
import { apiFetch } from "@/lib/api";

export interface Category {
  category_id: string;
  category_name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export default function CategoriesPage() {
  const { c } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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

  const openAddModal = () => {
    setEditingCategory(null);
    setCategoryName("");
    setDescription("");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.category_name);
    setDescription(cat.description || "");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      if (editingCategory) {
        // Update
        await apiFetch(`/categories/${editingCategory.category_id}`, {
          method: "PATCH",
          body: JSON.stringify({
            category_name: categoryName,
            description: description || undefined,
          }),
        });
      } else {
        // Create
        await apiFetch("/categories/", {
          method: "POST",
          body: JSON.stringify({
            category_name: categoryName,
            description: description || undefined,
          }),
        });
      }
      setIsModalOpen(false);
      loadCategories();
    } catch (err: any) {
      setFormError(err.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await apiFetch(`/categories/${id}`, { method: "DELETE" });
      loadCategories();
    } catch (err: any) {
      alert(err.message || "Failed to delete category");
    }
  };

  const filteredCategories = categories.filter(
    (cat) =>
      cat.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 40 }}>
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: c.text }}>Category Management</h1>
          <p style={{ fontSize: 13, color: c.textMuted, marginTop: 4 }}>
            Organize inventory items into distinct categories.
          </p>
        </div>
        <button
          onClick={openAddModal}
          style={{
            background: c.accent,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          + Add Category
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ maxWidth: 400 }}>
        <input
          type="text"
          placeholder="Search categories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 14px",
            borderRadius: 8,
            border: `1px solid ${c.border}`,
            background: c.surface,
            color: c.text,
            fontSize: 13.5,
            outline: "none",
          }}
        />
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: c.dangerSoft,
            color: c.danger,
            fontSize: 13.5,
          }}
        >
          {error}
        </div>
      )}

      {/* Categories Table */}
      <div
        style={{
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr
              style={{
                borderBottom: `1px solid ${c.border}`,
                background: c.surfaceMuted,
                fontSize: 12,
                color: c.textMuted,
                textTransform: "uppercase",
              }}
            >
              <th style={{ padding: "12px 16px" }}>Category Name</th>
              <th style={{ padding: "12px 16px" }}>Description</th>
              <th style={{ padding: "12px 16px" }}>Created At</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: 30, textAlign: "center", color: c.textMuted }}>
                  Loading categories...
                </td>
              </tr>
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 30, textAlign: "center", color: c.textMuted }}>
                  No categories found.
                </td>
              </tr>
            ) : (
              filteredCategories.map((cat) => (
                <tr
                  key={cat.category_id}
                  style={{
                    borderBottom: `1px solid ${c.border}`,
                    fontSize: 13.5,
                    color: c.text,
                  }}
                >
                  <td style={{ padding: "14px 16px", fontWeight: 600 }}>{cat.category_name}</td>
                  <td style={{ padding: "14px 16px", color: c.textMuted }}>
                    {cat.description || "-"}
                  </td>
                  <td style={{ padding: "14px 16px", color: c.textMuted }}>
                    {new Date(cat.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => openEditModal(cat)}
                      style={{
                        marginRight: 8,
                        padding: "4px 10px",
                        border: `1px solid ${c.border}`,
                        background: "transparent",
                        color: c.text,
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cat.category_id)}
                      style={{
                        padding: "4px 10px",
                        border: "none",
                        background: "#fee2e2",
                        color: "#991b1b",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              padding: 24,
              width: "100%",
              maxWidth: 450,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: c.text }}>
              {editingCategory ? "Edit Category" : "Add New Category"}
            </h2>

            {formError && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: "#fee2e2",
                  color: "#991b1b",
                  fontSize: 12.5,
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: c.textMuted, display: "block", marginBottom: 4 }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${c.border}`,
                    background: c.surface,
                    color: c.text,
                    fontSize: 13.5,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: c.textMuted, display: "block", marginBottom: 4 }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${c.border}`,
                    background: c.surface,
                    color: c.text,
                    fontSize: 13.5,
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: `1px solid ${c.border}`,
                    background: "transparent",
                    color: c.text,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
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
                  }}
                >
                  {saving ? "Saving..." : editingCategory ? "Save Changes" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
