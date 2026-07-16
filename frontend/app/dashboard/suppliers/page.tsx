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
  Truck
} from "lucide-react";
import { useTheme } from "../ThemeContext";
import { useData, Supplier } from "../DataContext";

// ── Checkbox ───────────────────────────────────────────────
function Cb({
  checked,
  onChange,
  c,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  c: any;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      style={{
        width: 17,
        height: 17,
        borderRadius: 5,
        flexShrink: 0,
        border: `1.5px solid ${checked ? c.accent : c.border}`,
        background: checked ? c.accent : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {checked && <Check size={11} strokeWidth={3} color="#fff" />}
    </button>
  );
}

// ── Status Badge ───────────────────────────────────────────
function StatusBadge({ active, c }: { active: boolean; c: any }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
        background: active ? c.accentSoft : c.surfaceMuted,
        color: active ? c.accent : c.textFaint,
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// ── Modal ──────────────────────────────────────────────────
interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  c: any;
  width?: number;
}
function Modal({ title, onClose, children, c, width = 440 }: ModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,10,8,0.5)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "100%",
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 14,
          padding: 22,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          <button
            onClick={onClose}
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
              cursor: "pointer",
            }}
          >
            <X size={15} />
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
          {children}
        </div>
      </div>
    </div>
  );
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

// ── Create Supplier Modal ──────────────────────────────────
interface CreateSupplierModalProps {
  onClose: () => void;
  onSave: (s: Partial<Supplier>) => void;
  c: any;
}
function CreateSupplierModal({ onClose, onSave, c }: CreateSupplierModalProps) {
  const [supplierName, setSupplierName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [totalSupplies, setTotalSupplies] = useState(0);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    setError("");
    if (
      !supplierName.trim() ||
      !contactPerson.trim() ||
      !phone.trim() ||
      !email.trim() ||
      !address.trim()
    ) {
      setError("Name, contact person, phone, email, and address are required.");
      return;
    }
    onSave({
      supplierName,
      contactPerson,
      phone,
      email,
      address,
      active,
      notes,
      totalSupplies: Number(totalSupplies) || 0,
    });
  };

  return (
    <Modal title="Create New Supplier" onClose={onClose} c={c} width={480}>
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
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Field label="Supplier Name" c={c}>
            <input
              style={inp(c)}
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. Lanka Steel Supplies"
            />
          </Field>
          <Field label="Contact Person" c={c}>
            <input
              style={inp(c)}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. Amal Silva"
            />
          </Field>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Field label="Phone Number" c={c}>
            <input
              style={inp(c)}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+94 71 234 5678"
            />
          </Field>
          <Field label="Email Address" c={c}>
            <input
              type="email"
              style={inp(c)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@supplier.com"
            />
          </Field>
        </div>
        <Field label="Address" c={c}>
          <input
            style={inp(c)}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123, Galle Road, Colombo"
          />
        </Field>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Field label="Status" c={c}>
            <select
              style={inp(c)}
              value={active ? "active" : "inactive"}
              onChange={(e) => setActive(e.target.value === "active")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <Field label="Total Supplies" c={c}>
            <input
              type="number"
              min="0"
              style={inp(c)}
              value={totalSupplies}
              onChange={(e) => setTotalSupplies(parseInt(e.target.value) || 0)}
            />
          </Field>
        </div>
        <Field label="Notes" c={c}>
          <textarea
            style={{ ...inp(c), height: 70, resize: "vertical" }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special delivery instructions, key supplies, etc."
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
            Add supplier
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Delete Supplier Confirmation Modal ──────────────────────
interface DeleteSupplierModalProps {
  supplier: Supplier;
  onClose: () => void;
  onConfirm: () => void;
  c: any;
}
function DeleteSupplierModal({
  supplier,
  onClose,
  onConfirm,
  c,
}: DeleteSupplierModalProps) {
  return (
    <Modal title="Delete supplier" onClose={onClose} c={c} width={380}>
      <p
        style={{
          fontSize: 13.5,
          color: c.textMuted,
          lineHeight: 1.6,
          marginBottom: 20,
        }}
      >
        Delete{" "}
        <span style={{ color: c.text, fontWeight: 600 }}>
          {supplier.supplierName}
        </span>
        ? This will remove the supplier details. This action cannot be undone.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
          onClick={onConfirm}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: c.danger,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Delete supplier
        </button>
      </div>
    </Modal>
  );
}

// ── Main Page Component ─────────────────────────────────────
export default function SuppliersPage() {
  const { mode, c } = useTheme();
  const { supplierList, setHeaderActions, addSupplier, saveSupplierEdit, deleteSupplier } = useData();

  // Selected checkbox rows
  const [selected, setSelected] = useState<string[]>([]);
  // Search filter
  const [supplierSearch, setSupplierSearch] = useState("");

  // Slide panels states
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [supplierEditForm, setSupplierEditForm] = useState<Partial<Supplier>>({});
  const [supplierEditError, setSupplierEditError] = useState("");

  // Modal open states
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  // Responsive / Mobile state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Dynamically set header buttons in shared layout
  useEffect(() => {
    setHeaderActions(
      <button
        onClick={() => setAddSupplierOpen(true)}
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
        <Plus size={15} /> New supplier
      </button>
    );
    return () => setHeaderActions(null);
  }, [c, setHeaderActions]);

  // Sync details panel state
  useEffect(() => {
    if (selectedSupplier) {
      setSupplierEditForm(selectedSupplier);
      setSupplierEditError("");
    }
  }, [selectedSupplier]);

  // Filter supplier list
  const filteredSuppliers = useMemo(() => {
    return supplierList.filter((s) => {
      const q = supplierSearch.toLowerCase();
      return (
        !q ||
        s.supplierName.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q)
      );
    });
  }, [supplierList, supplierSearch]);

  const totalCount = filteredSuppliers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageSuppliers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredSuppliers.slice(start, start + PAGE_SIZE);
  }, [filteredSuppliers, page]);

  const allPageSelected =
    pageSuppliers.length > 0 && pageSuppliers.every((s) => selected.includes(s.id));

  // Handlers
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const toggleAllPage = () => {
    const pageIds = pageSuppliers.map((s) => s.id);
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

  const handleSaveEdit = (form: Partial<Supplier>) => {
    setSupplierEditError("");
    if (
      !form.supplierName?.trim() ||
      !form.contactPerson?.trim() ||
      !form.phone?.trim() ||
      !form.email?.trim() ||
      !form.address?.trim()
    ) {
      setSupplierEditError("Supplier name, contact person, phone, email, and address are required.");
      return;
    }

    saveSupplierEdit(form);
    setSelectedSupplier(form as Supplier);
    setIsEditingSupplier(false);
  };

  const handleDeleteConfirm = () => {
    if (!supplierToDelete) return;
    deleteSupplier(supplierToDelete.id);
    setSelected((prev) => prev.filter((x) => x !== supplierToDelete.id));
    if (selectedSupplier?.id === supplierToDelete.id) {
      setSelectedSupplier(null);
    }
    setSupplierToDelete(null);
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
          {/* toolbar */}
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `1px solid ${c.border}`,
                  background: c.inputBg,
                  maxWidth: 260,
                  width: "100%",
                  marginLeft: "auto",
                }}
              >
                <Search size={14} color={c.textFaint} />
                <input
                  value={supplierSearch}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search suppliers..."
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
          </div>

          {/* table */}
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
                  {[
                    "Supplier name",
                    "Contact person",
                    "Email",
                    "Status",
                    "Actions",
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
                {pageSuppliers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: "32px 20px",
                        textAlign: "center",
                        color: c.textFaint,
                      }}
                    >
                      No suppliers found matching filters.
                    </td>
                  </tr>
                ) : (
                  pageSuppliers.map((s) => {
                    const isSelected = s.id === selectedSupplier?.id;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => {
                          setSelectedSupplier(s);
                          setIsEditingSupplier(false);
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
                            checked={selected.includes(s.id)}
                            onChange={(v) => toggleOne(s.id, v)}
                            c={c}
                          />
                        </td>
                        <td style={{ padding: "11px 20px", fontWeight: 600 }}>
                          {s.supplierName}
                        </td>
                        <td style={{ padding: "11px 20px", color: c.textMuted }}>
                          {s.contactPerson}
                        </td>
                        <td style={{ padding: "11px 20px", color: c.textMuted }}>
                          {s.email}
                        </td>
                        <td style={{ padding: "11px 20px" }}>
                          <StatusBadge active={s.active} c={c} />
                        </td>
                        <td
                          style={{ padding: "11px 20px" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => {
                                setSelectedSupplier(s);
                                setIsEditingSupplier(true);
                              }}
                              title="Edit supplier"
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
                              onClick={() => setSupplierToDelete(s)}
                              title="Delete supplier"
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
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 20px",
              borderTop: `1px solid ${c.border}`,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12, color: c.textFaint }}>
              Showing {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} suppliers
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                  opacity: page === 1 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={14} />
              </button>
              {pageNums.map((n) => (
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
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
                  opacity: page === totalPages ? 0.4 : 1,
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Supplier Detail Slide Panel ── */}
        {selectedSupplier && (
          <>
            {isMobile && (
              <div
                onClick={() => setSelectedSupplier(null)}
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
                  {isEditingSupplier ? "Edit Supplier" : "Supplier Details"}
                </h3>
                <button
                  onClick={() => setSelectedSupplier(null)}
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
                {supplierEditError && (
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
                    {supplierEditError}
                  </div>
                )}

                {!isEditingSupplier ? (
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
                        <Truck size={28} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 3 }}>
                          {selectedSupplier.supplierName}
                        </h4>
                        <p style={{ fontSize: 12, color: c.textFaint }}>
                          ID: {selectedSupplier.id}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
                      <Field label="Contact Person" c={c}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                          {selectedSupplier.contactPerson}
                        </div>
                      </Field>
                      <Field label="Email Address" c={c}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                          {selectedSupplier.email}
                        </div>
                      </Field>
                      <Field label="Phone Number" c={c}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                          {selectedSupplier.phone}
                        </div>
                      </Field>
                      <Field label="Address" c={c}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                          {selectedSupplier.address}
                        </div>
                      </Field>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Status" c={c}>
                          <StatusBadge active={selectedSupplier.active} c={c} />
                        </Field>
                        <Field label="Total Supplies" c={c}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: c.accent }}>
                            {selectedSupplier.totalSupplies}
                          </div>
                        </Field>
                      </div>
                      {selectedSupplier.notes && (
                        <Field label="Notes" c={c}>
                          <div style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.5 }}>
                            {selectedSupplier.notes}
                          </div>
                        </Field>
                      )}
                      <Field label="Created At" c={c}>
                        <div style={{ fontSize: 12.5, color: c.textMuted }}>
                          {selectedSupplier.createdAt}
                        </div>
                      </Field>
                      <Field label="Updated At" c={c}>
                        <div style={{ fontSize: 12.5, color: c.textMuted }}>
                          {selectedSupplier.updatedAt}
                        </div>
                      </Field>
                    </div>
                  </div>
                ) : (
                  /* EDIT MODE */
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Field label="Supplier Name" c={c}>
                      <input
                        style={inp(c)}
                        value={supplierEditForm.supplierName || ""}
                        onChange={(e) =>
                          setSupplierEditForm({
                            ...supplierEditForm,
                            supplierName: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Contact Person" c={c}>
                      <input
                        style={inp(c)}
                        value={supplierEditForm.contactPerson || ""}
                        onChange={(e) =>
                          setSupplierEditForm({
                            ...supplierEditForm,
                            contactPerson: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Phone" c={c}>
                      <input
                        style={inp(c)}
                        value={supplierEditForm.phone || ""}
                        onChange={(e) =>
                          setSupplierEditForm({
                            ...supplierEditForm,
                            phone: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Email" c={c}>
                      <input
                        style={inp(c)}
                        value={supplierEditForm.email || ""}
                        onChange={(e) =>
                          setSupplierEditForm({
                            ...supplierEditForm,
                            email: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Address" c={c}>
                      <input
                        style={inp(c)}
                        value={supplierEditForm.address || ""}
                        onChange={(e) =>
                          setSupplierEditForm({
                            ...supplierEditForm,
                            address: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Status" c={c}>
                        <select
                          style={inp(c)}
                          value={supplierEditForm.active ? "active" : "inactive"}
                          onChange={(e) =>
                            setSupplierEditForm({
                              ...supplierEditForm,
                              active: e.target.value === "active",
                            })
                          }
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </Field>
                      <Field label="Total Supplies" c={c}>
                        <input
                          type="number"
                          min="0"
                          style={inp(c)}
                          value={supplierEditForm.totalSupplies || 0}
                          onChange={(e) =>
                            setSupplierEditForm({
                              ...supplierEditForm,
                              totalSupplies: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Notes" c={c}>
                      <textarea
                        style={{ ...inp(c), height: 70, resize: "vertical" }}
                        value={supplierEditForm.notes || ""}
                        onChange={(e) =>
                          setSupplierEditForm({
                            ...supplierEditForm,
                            notes: e.target.value,
                          })
                        }
                      />
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
                {!isEditingSupplier ? (
                  <>
                    <button
                      onClick={() => setIsEditingSupplier(true)}
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
                    <button
                      onClick={() => setSelectedSupplier(null)}
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
                      onClick={() => setIsEditingSupplier(false)}
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
                      onClick={() => handleSaveEdit(supplierEditForm)}
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
      {addSupplierOpen && (
        <CreateSupplierModal
          onClose={() => setAddSupplierOpen(false)}
          onSave={(s) => {
            addSupplier(s);
            setAddSupplierOpen(false);
            setPage(1);
          }}
          c={c}
        />
      )}

      {supplierToDelete && (
        <DeleteSupplierModal
          supplier={supplierToDelete}
          onClose={() => setSupplierToDelete(null)}
          onConfirm={handleDeleteConfirm}
          c={c}
        />
      )}
    </div>
  );
}
