/**
 * roles.ts — Centralized RBAC permission definitions for StockSphere frontend.
 *
 * All role-based UI logic should reference these helpers rather than
 * scattering raw role-string comparisons across pages.
 */

export type AppRole =
  | "Admin"
  | "Inventory Manager"
  | "Auditor"
  | "Sales"
  | string; // fallback for any unexpected roles

// ── Sidebar tab keys ──────────────────────────────────────────
export type NavKey =
  | "dashboard"
  | "users"
  | "categories"
  | "suppliers"
  | "items"
  | "transactions"
  | "purchase_orders"
  | "reports"
  | "audit_logs";

/** Which sidebar tabs are visible for each role (in display order). */
export const SIDEBAR_TABS_BY_ROLE: Record<string, NavKey[]> = {
  Admin: [
    "dashboard",
    "users",
    "categories",
    "suppliers",
    "items",
    "transactions",
    "purchase_orders",
    "reports",
    "audit_logs",
  ],
  "Inventory Manager": [
    "dashboard",
    "categories",
    "suppliers",
    "items",
    "transactions",
    "purchase_orders",
  ],
  Auditor: [
    "dashboard",
    "categories",
    "suppliers",
    "items",
    "transactions",
    "reports",
  ],
  Sales: [
    "dashboard",
    "categories",
    "items",
    "transactions",
  ],
};

/** Returns the allowed nav keys for a given role. Falls back to Admin (all) for unknown roles. */
export function getAllowedNavKeys(role: AppRole): NavKey[] {
  return SIDEBAR_TABS_BY_ROLE[role] ?? SIDEBAR_TABS_BY_ROLE["Admin"];
}

// ── Read-only page rules ──────────────────────────────────────

/** Pages that are read-only (no create/edit/delete) for a given role. */
const READ_ONLY_PAGES: Record<string, NavKey[]> = {
  Auditor: ["categories", "suppliers", "items", "transactions"],
  Sales: ["categories", "items"],
};

/** Returns true if the given page should be read-only for the given role. */
export function isReadOnly(role: AppRole, page: NavKey): boolean {
  return READ_ONLY_PAGES[role]?.includes(page) ?? false;
}

// ── Dashboard card visibility ─────────────────────────────────

/** Returns true if the Draft PO stat card should be shown for the role. */
export function showDraftPOCard(role: AppRole): boolean {
  // Hidden for Auditor and Sales
  return role !== "Auditor" && role !== "Sales";
}

/** Returns true if the Active Alerts stat card should be shown for the role. */
export function showActiveAlertsCard(role: AppRole): boolean {
  // Hidden for Sales only
  return role !== "Sales";
}

// ── Role helpers ──────────────────────────────────────────────

/** Returns true if the user has the Sales role. */
export function isSalesRole(role: AppRole): boolean {
  return role === "Sales";
}

/** Returns true if the user has the Admin role. */
export function isAdminRole(role: AppRole): boolean {
  return role === "Admin";
}

/** Returns true if the user is Admin or Inventory Manager (full write access). */
export function hasFullWriteAccess(role: AppRole): boolean {
  return role === "Admin" || role === "Inventory Manager";
}
