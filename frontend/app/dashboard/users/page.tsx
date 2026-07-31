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
  Lock,
  ShieldCheck,
  Check,
  UserCircle
} from "lucide-react";
import { useTheme } from "../ThemeContext";
import { useData, User } from "../DataContext";
import { apiFetch } from "@/lib/api";
import { ConfirmDeleteModal } from "@/components/ui";

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

// ── Badges ─────────────────────────────────────────────────
function RoleBadge({ role, c }: { role: string; c: any }) {
  const map: Record<string, { bg: string; fg: string }> = {
    Admin: { bg: c.dangerSoft, fg: c.danger },
    Manager: { bg: c.warnSoft, fg: c.warn },
    Staff: { bg: c.accentSoft, fg: c.accent },
    Auditor: { bg: c.surfaceMuted, fg: c.textMuted },
  };
  const s = map[role] || map.Staff;
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
      }}
    >
      {role}
    </span>
  );
}

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
  closeOnOverlayClick?: boolean;
}
function Modal({ title, onClose, children, c, width = 440, closeOnOverlayClick = true }: ModalProps) {
  return (
    <div
      onClick={closeOnOverlayClick ? onClose : undefined}
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

// ── Create Modal ───────────────────────────────────────────
interface CreateModalProps {
  onClose: () => void;
  onSave: (u: Partial<User>) => Promise<void> | void;
  c: any;
}
function CreateModal({ onClose, onSave, c }: CreateModalProps) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [nic, setNic] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Staff");
  const [error, setError] = useState("");

  const ROLES = ["Admin", "Manager", "Staff", "Auditor"];

  const handleSubmit = async () => {
    setError("");
    if (
      !fullName.trim() ||
      !username.trim() ||
      !nic.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password.trim()
    ) {
      setError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await onSave({
        fullName,
        username,
        nic,
        email,
        phone,
        password,
        role,
        active: true
      });
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    }
  };

  return (
    <Modal title="Create New User" onClose={onClose} c={c} width={460} closeOnOverlayClick={false}>
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
          <Field label="Full Name" c={c}>
            <input
              style={inp(c)}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
            />
          </Field>
          <Field label="Username" c={c}>
            <input
              style={inp(c)}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
            />
          </Field>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Field label="NIC Number" c={c}>
            <input
              style={inp(c)}
              value={nic}
              onChange={(e) => setNic(e.target.value)}
              placeholder="Sri Lankan NIC"
            />
          </Field>
          <Field label="Phone Number" c={c}>
            <input
              style={inp(c)}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+94 77 123 4567"
            />
          </Field>
        </div>
        <Field label="Email Address" c={c}>
          <input
            type="email"
            style={inp(c)}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
          />
        </Field>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          <Field label="Password" c={c}>
            <input
              type="password"
              style={inp(c)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </Field>
          <Field label="Confirm Password" c={c}>
            <input
              type="password"
              style={inp(c)}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm"
            />
          </Field>
        </div>
        <Field label="Role" c={c}>
          <select
            style={inp(c)}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
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
            Add user
          </button>
        </div>
      </div>
    </Modal>
  );
}



// ── Main Page Component ─────────────────────────────────────
export default function UsersPage() {
  const { mode, c } = useTheme();
  const { userList, setUserList, setHeaderActions, loggedInUser, addUser, saveUserEdit, deleteUser } = useData();

  // Selected for checkbox bulk actions
  const [selected, setSelected] = useState<string[]>([]);
  // Search state
  const [userSearch, setUserSearch] = useState("");

  // Side Panel state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [editError, setEditError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Modals state
  const [addOpen, setAddOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  // Responsive / Mobile detector
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Dynamically set header button in shared layout
  useEffect(() => {
    setHeaderActions(
      <button
        onClick={() => setAddOpen(true)}
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
        <Plus size={15} /> New user
      </button>
    );
    return () => setHeaderActions(null);
  }, [c, setHeaderActions]);

  // Sync editForm when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      setEditForm(selectedUser);
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      setEditError("");
      setProfileSuccess("");
      setPasswordSuccess("");
      setPasswordError("");
    }
  }, [selectedUser]);

  // Current logged in username
  const currentUsername = useMemo(() => {
    if (loggedInUser?.username) return loggedInUser.username.toLowerCase();
    if (typeof window !== "undefined") {
      const userStr = sessionStorage.getItem("user");
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          return (u.username || u.user_name || "").toLowerCase();
        } catch (e) { }
      }
    }
    return "";
  }, [loggedInUser]);

  // Filtering users
  const filteredUsers = useMemo(() => {
    return userList.filter((u) => {
      const uname = u.username ? u.username.toLowerCase() : "";

      // 1. Hide adminhomerex
      if (uname === "adminhomerex" || uname === "admin_homerex" || uname.includes("adminhomerex")) {
        return false;
      }

      // 2. Hide current user (yourself)
      if (currentUsername && uname === currentUsername) {
        return false;
      }
      const currentUserId = loggedInUser?.id || (loggedInUser as any)?.userId;
      if (currentUserId && u.id === currentUserId) {
        return false;
      }

      const q = userSearch.toLowerCase();
      return (
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.nic.toLowerCase().includes(q)
      );
    }).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [userList, userSearch, currentUsername, loggedInUser]);

  const totalCount = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  const allPageSelected =
    pageUsers.length > 0 && pageUsers.every((u) => selected.includes(u.id));

  // Handlers
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const toggleAllPage = () => {
    const pageIds = pageUsers.map((u) => u.id);
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

  // Fetch real users from backend
  const loadUsersFromBackend = async () => {
    try {
      const data = await apiFetch<any[]>("/users/");
      const mapped: User[] = data.map((u: any) => ({
        id: u.user_id,
        fullName: u.full_name,
        username: u.user_name,
        nic: u.nic,
        email: u.email,
        phone: u.phone,
        password: "",
        role: u.role === "Inventory Manager" ? "Manager" : u.role === "Sales" ? "Staff" : u.role,
        active: u.is_active,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));
      setUserList(mapped);
    } catch (err: any) {
      console.error("Failed to load users from backend:", err);
    }
  };

  useEffect(() => {
    loadUsersFromBackend();
  }, []);

  const handleCreateUser = async (u: Partial<User>) => {
    const roleMap: Record<string, string> = {
      Admin: "Admin",
      Manager: "Inventory Manager",
      Staff: "Sales",
      Auditor: "Auditor",
    };

    await apiFetch("/users/", {
      method: "POST",
      body: JSON.stringify({
        full_name: u.fullName,
        user_name: u.username,
        nic: u.nic,
        email: u.email,
        phone: u.phone,
        password: u.password,
        role: roleMap[u.role || "Staff"] || "Sales",
      }),
    });

    setAddOpen(false);
    loadUsersFromBackend();
  };

  const handleSaveProfileDetails = async () => {
    setEditError("");
    setProfileSuccess("");
    if (!selectedUser) return;
    setSavingProfile(true);

    // Map frontend role labels → backend UserRole enum values
    const roleMap: Record<string, string> = {
      Admin: "Admin",
      Manager: "Inventory Manager",
      Staff: "Sales",
      Auditor: "Auditor",
    };

    try {
      await apiFetch(`/users/${selectedUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          full_name: editForm.fullName || undefined,
          user_name: editForm.username || undefined,
          nic: editForm.nic || undefined,
          email: editForm.email || undefined,
          phone: editForm.phone || undefined,
          role: editForm.role ? roleMap[editForm.role] : undefined,
          is_active: editForm.active,
        }),
      });

      setProfileSuccess("Profile details saved successfully!");
      loadUsersFromBackend();
    } catch (err: any) {
      setEditError(err.message || "Failed to update profile details");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");
    if (!selectedUser) return;

    if (!passwordForm.newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    setSavingPassword(true);
    try {
      await apiFetch(`/users/${selectedUser.id}/password`, {
        method: "PUT",
        body: JSON.stringify({
          // Admin changing someone else's password: no current_password needed
          // Backend skips current_password check when caller is admin changing others
          new_password: passwordForm.newPassword,
        }),
      });

      setPasswordSuccess("Password updated successfully!");
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await apiFetch(`/users/${userToDelete.id}`, { method: "DELETE" });
      setSelected((prev) => prev.filter((x) => x !== userToDelete.id));
      if (selectedUser?.id === userToDelete.id) {
        setSelectedUser(null);
      }
      setUserToDelete(null);
      loadUsersFromBackend();
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    }
  };

  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1);
  const ROLES = ["Admin", "Manager", "Staff", "Auditor"];

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
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search users..."
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
                  {["Full name", "Username", "Role", "Status", "Actions"].map(
                    (h) => (
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
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {pageUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: "32px 20px",
                        textAlign: "center",
                        color: c.textFaint,
                      }}
                    >
                      No users found matching filters.
                    </td>
                  </tr>
                ) : (
                  pageUsers.map((u) => {
                    const isSelected = u.id === selectedUser?.id;
                    return (
                      <tr
                        key={u.id}
                        onClick={() => {
                          setSelectedUser(u);
                          setIsEditingUser(false);
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
                            checked={selected.includes(u.id)}
                            onChange={(v) => toggleOne(u.id, v)}
                            c={c}
                          />
                        </td>
                        <td style={{ padding: "11px 20px", fontWeight: 600 }}>
                          {u.fullName}
                        </td>
                        <td style={{ padding: "11px 20px", color: c.textMuted }}>
                          {u.username}
                        </td>
                        <td style={{ padding: "11px 20px" }}>
                          <RoleBadge role={u.role} c={c} />
                        </td>
                        <td style={{ padding: "11px 20px" }}>
                          <StatusBadge active={u.active} c={c} />
                        </td>
                        <td
                          style={{ padding: "11px 20px" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setIsEditingUser(true);
                              }}
                              title="Edit user"
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
                              onClick={() => setUserToDelete(u)}
                              title="Delete user"
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
              {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} users
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

        {/* ── User Detail Slide Panel ── */}
        {selectedUser && (
          <>
            {isMobile && (
              <div
                onClick={() => setSelectedUser(null)}
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
                  {isEditingUser ? "Edit User Profile" : "User Details"}
                </h3>
                <button
                  onClick={() => setSelectedUser(null)}
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

                {!isEditingUser ? (
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
                        <UserCircle size={32} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 3 }}>
                          {selectedUser.fullName}
                        </h4>
                        <p style={{ fontSize: 12, color: c.textFaint }}>
                          ID: {selectedUser.id}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                      <Field label="Username" c={c}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                          {selectedUser.username}
                        </div>
                      </Field>
                      <Field label="NIC Number" c={c}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                          {selectedUser.nic}
                        </div>
                      </Field>
                      <Field label="Email Address" c={c}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                          {selectedUser.email}
                        </div>
                      </Field>
                      <Field label="Phone Number" c={c}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                          {selectedUser.phone}
                        </div>
                      </Field>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Role" c={c}>
                          <RoleBadge role={selectedUser.role} c={c} />
                        </Field>
                        <Field label="Active Status" c={c}>
                          <StatusBadge active={selectedUser.active} c={c} />
                        </Field>
                      </div>
                      <Field label="Created At" c={c}>
                        <div style={{ fontSize: 12.5, color: c.textMuted }}>
                          {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : "—"}
                        </div>
                      </Field>
                      <Field label="Updated At" c={c}>
                        <div style={{ fontSize: 12.5, color: c.textMuted }}>
                          {selectedUser.updatedAt ? new Date(selectedUser.updatedAt).toLocaleString() : "—"}
                        </div>
                      </Field>
                    </div>
                  </div>
                ) : (
                  /* EDIT MODE */
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {/* Section 1: User Profile Details */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
                        Profile Details
                      </span>

                      {profileSuccess && (
                        <div
                          style={{
                            padding: "8px 12px",
                            background: c.accentSoft,
                            color: c.accent,
                            borderRadius: 8,
                            fontSize: 12.5,
                            fontWeight: 500,
                          }}
                        >
                          {profileSuccess}
                        </div>
                      )}

                      <Field label="Full Name" c={c}>
                        <input
                          style={inp(c)}
                          value={editForm.fullName || ""}
                          onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                        />
                      </Field>
                      <Field label="Username" c={c}>
                        <input
                          style={inp(c)}
                          value={editForm.username || ""}
                          onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        />
                      </Field>
                      <Field label="NIC Number" c={c}>
                        <input
                          style={inp(c)}
                          value={editForm.nic || ""}
                          onChange={(e) => setEditForm({ ...editForm, nic: e.target.value })}
                        />
                      </Field>
                      <Field label="Email Address" c={c}>
                        <input
                          style={inp(c)}
                          value={editForm.email || ""}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                      </Field>
                      <Field label="Phone Number" c={c}>
                        <input
                          style={inp(c)}
                          value={editForm.phone || ""}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        />
                      </Field>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Role" c={c}>
                          <select
                            style={inp(c)}
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Active Status" c={c}>
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

                      <button
                        onClick={handleSaveProfileDetails}
                        disabled={savingProfile}
                        style={{
                          marginTop: 6,
                          padding: "9px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: c.accent,
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          alignSelf: "flex-end",
                        }}
                      >
                        {savingProfile ? "Saving Details..." : "Save Profile Details"}
                      </button>
                    </div>

                    {/* Section 2: Password Change */}
                    <div
                      style={{
                        paddingTop: 18,
                        borderTop: `1px solid ${c.border}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: c.accent,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Lock size={14} /> Password Change
                      </span>

                      {passwordError && (
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
                          {passwordError}
                        </div>
                      )}

                      {passwordSuccess && (
                        <div
                          style={{
                            padding: "8px 12px",
                            background: c.accentSoft,
                            color: c.accent,
                            borderRadius: 8,
                            fontSize: 12.5,
                            fontWeight: 500,
                          }}
                        >
                          {passwordSuccess}
                        </div>
                      )}

                      <Field label="New Password" c={c}>
                        <input
                          type="password"
                          style={inp(c)}
                          value={passwordForm.newPassword}
                          onChange={(e) =>
                            setPasswordForm({
                              ...passwordForm,
                              newPassword: e.target.value,
                            })
                          }
                          placeholder="Enter new password (min 8 characters)"
                        />
                      </Field>
                      <Field label="Confirm Password" c={c}>
                        <input
                          type="password"
                          style={{
                            ...inp(c),
                            borderColor:
                              passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword
                                ? c.danger
                                : undefined,
                          }}
                          value={passwordForm.confirmPassword}
                          onChange={(e) =>
                            setPasswordForm({
                              ...passwordForm,
                              confirmPassword: e.target.value,
                            })
                          }
                          placeholder="Confirm new password"
                        />
                        {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                          <span style={{ fontSize: 11.5, color: c.danger, marginTop: 3, display: "block" }}>
                            Passwords do not match
                          </span>
                        )}
                      </Field>

                      <button
                        onClick={handleSavePassword}
                        disabled={savingPassword}
                        style={{
                          marginTop: 6,
                          padding: "9px 16px",
                          borderRadius: 8,
                          border: `1px solid ${c.border}`,
                          background: c.surfaceMuted,
                          color: c.text,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          alignSelf: "flex-end",
                        }}
                      >
                        {savingPassword ? "Updating Password..." : "Update Password"}
                      </button>
                    </div>
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
                {!isEditingUser ? (
                  <>
                    <button
                      onClick={() => setIsEditingUser(true)}
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
                      onClick={() => setSelectedUser(null)}
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
                  <button
                    onClick={() => setIsEditingUser(false)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: `1px solid ${c.border}`,
                      background: c.surface,
                      color: c.text,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {addOpen && (
        <CreateModal
          onClose={() => setAddOpen(false)}
          onSave={handleCreateUser}
          c={c}
        />
      )}

      {userToDelete && (
        <ConfirmDeleteModal
          title="Delete user"
          itemName={userToDelete.fullName}
          itemType="user"
          message={`Delete ${userToDelete.fullName}? This removes their access immediately and cannot be undone.`}
          onClose={() => setUserToDelete(null)}
          onConfirm={handleDeleteConfirm}
          c={c}
        />
      )}
    </div>
  );
}
