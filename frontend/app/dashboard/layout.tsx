"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  Users,
  Tags,
  Truck,
  Boxes,
  FileBarChart2,
  ClipboardList,
  ShieldCheck,
  UserCircle,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  ArrowLeftRight,
  Bell,
} from "lucide-react";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { DataProvider, useData } from "./DataContext";
import { apiFetch } from "@/lib/api";
import { getAllowedNavKeys } from "@/lib/roles";

const NAV_MAIN = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutGrid,
    path: "/dashboard",
  },
  { key: "users", label: "Users", icon: Users, path: "/dashboard/users" },
  {
    key: "categories",
    label: "Categories & Units",
    icon: Tags,
    path: "/dashboard/categories",
  },
  {
    key: "suppliers",
    label: "Suppliers",
    icon: Truck,
    path: "/dashboard/suppliers",
  },
  { key: "items", label: "Items", icon: Boxes, path: "/dashboard/items" },
  {
    key: "transactions",
    label: "Transactions",
    icon: ArrowLeftRight,
    path: "/dashboard/transactions",
  },
  {
    key: "purchase_orders",
    label: "Purchase orders",
    icon: ClipboardList,
    path: "/dashboard/purchase_orders",
  },
  {
    key: "reports",
    label: "Reports",
    icon: FileBarChart2,
    path: "/dashboard/reports",
  },
  {
    key: "audit_logs",
    label: "Audit logs",
    icon: ShieldCheck,
    path: "/dashboard/audit_logs",
  },
];

const NAV_BOTTOM = [
  {
    key: "profile",
    label: "Profile",
    icon: UserCircle,
    path: "/dashboard/profile",
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <DataProvider>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </DataProvider>
    </ThemeProvider>
  );
}

function NavItem({
  item,
  collapsed,
  c,
}: {
  item: any;
  collapsed: boolean;
  c: any;
}) {
  const pathname = usePathname();
  const active = pathname === item.path;
  const Icon = item.icon;

  return (
    <Link
      href={item.path}
      title={collapsed ? item.label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "100%",
        padding: collapsed ? "9px 0" : "9px 12px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 9,
        border: "none",
        cursor: "pointer",
        textDecoration: "none",
        background: active ? c.accentSoft : "transparent",
        color: active ? c.accent : c.textMuted,
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        transition: "background .12s,color .12s",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = c.surfaceMuted;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { mode, c, toggleTheme } = useTheme();
  const {
    userList,
    supplierList,
    transactionList,
    headerActions,
    loggedInUser,
    setLoggedInUser,
  } = useData();

  const [collapsed, setCollapsed] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Responsive / Mobile sidebar states
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Auth check — runs once on mount only
    const logged = sessionStorage.getItem("isLoggedIn");
    if (logged !== "true") {
      router.push("/");
    } else {
      setIsLoggedIn(true);
      const userStr = sessionStorage.getItem("user");
      if (userStr) {
        setLoggedInUser(JSON.parse(userStr));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Responsive setup
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      // Tell the backend to null out the refresh token in the DB
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (err) {
      // Even if the API call fails (e.g. token already expired),
      // we still proceed with local cleanup so the user is never stuck
      console.warn("Logout API call failed, proceeding with local cleanup:", err);
    } finally {
      sessionStorage.removeItem("isLoggedIn");
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("access_token");
      localStorage.removeItem("access_token");
      router.push("/");
    }
  };

  if (!isLoggedIn) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#FAFAF8",
          color: "#6B6A63",
        }}
      >
        Loading portal dashboard...
      </div>
    );
  }

  // Find active item configuration
  const activeItem = [...NAV_MAIN, ...NAV_BOTTOM].find(
    (item) => item.path === pathname
  ) || {
    key: "dashboard",
    label: "Dashboard",
  };

  return (
    <div
      style={{
        background: c.bg,
        color: c.text,
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        transition: "background .15s,color .15s",
        overflow: "hidden",
      }}
    >
      {/* ── Mobile Header Bar ── */}
      {isMobile && (
        <div
          style={{
            height: 56,
            background: c.surface,
            borderBottom: `1px solid ${c.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            flexShrink: 0,
            zIndex: 100,
          }}
        >
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{
              background: "none",
              border: "none",
              color: c.text,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Menu size={20} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 15 }}>StockSphere</span>
          <div style={{ width: 32 }} />
        </div>
      )}

      <div
        style={{
          display: "flex",
          flex: 1,
          height: isMobile ? "calc(100% - 56px)" : "100%",
          minHeight: 0,
          position: "relative",
        }}
      >
        {/* Backdrop for mobile drawer sidebar */}
        {isMobile && mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.4)",
              zIndex: 199,
            }}
          />
        )}

        {/* ── Sidebar (Always fits 100% height, non-scrollable) ── */}
        <aside
          style={{
            width: collapsed ? 68 : 230,
            flexShrink: 0,
            borderRight: `1px solid ${c.border}`,
            display: "flex",
            flexDirection: "column",
            padding: "16px 12px",
            gap: 4,
            background: c.surface,
            transition: "width .15s, left .15s ease",
            zIndex: 200,
            height: isMobile ? "100vh" : "100%",
            position: isMobile ? "fixed" : "relative",
            top: 0,
            left: isMobile ? (mobileMenuOpen ? 0 : -240) : 0,
            overflowY: "hidden", // Non-scrollable requirement
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "4px 8px 18px 8px",
              justifyContent: collapsed && !isMobile ? "center" : "flex-start",
            }}
          >
            <img
              src="/stocksphere_logo.svg"
              alt="StockSphere Logo"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                objectFit: "contain",
                flexShrink: 0,
              }}
            />
            {(!collapsed || isMobile) && (
              <span style={{ fontSize: 15, fontWeight: 600 }}>StockSphere</span>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              overflowY: "auto",
              flex: 1,
              paddingRight: 2,
            }}
          >
            {NAV_MAIN
              .filter((item) => getAllowedNavKeys(loggedInUser?.role ?? "Admin").includes(item.key as any))
              .map((item) => (
                <NavItem
                  key={item.key}
                  item={item}
                  collapsed={collapsed && !isMobile}
                  c={c}
                />
              ))}
          </div>

          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              flexShrink: 0,
            }}
          >
            <div
              style={{ height: 1, background: c.border, margin: "8px 4px" }}
            />
            {NAV_BOTTOM.map((item) => (
              <NavItem
                key={item.key}
                item={item}
                collapsed={collapsed && !isMobile}
                c={c}
              />
            ))}
            <button
              onClick={handleLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                padding: collapsed && !isMobile ? "9px 0" : "9px 12px",
                justifyContent:
                  collapsed && !isMobile ? "center" : "flex-start",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                background: "transparent",
                color: c.danger,
                fontSize: 13.5,
                fontWeight: 500,
                fontFamily: "inherit",
              }}
            >
              <LogOut size={17} strokeWidth={2} />
              {(!collapsed || isMobile) && <span>Log out</span>}
            </button>
            {!isMobile && (
              <button
                onClick={() => setCollapsed((v) => !v)}
                style={{
                  marginTop: 6,
                  fontSize: 11.5,
                  color: c.textFaint,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: collapsed ? "center" : "left",
                  padding: "4px 8px",
                  fontFamily: "inherit",
                }}
              >
                {collapsed ? <ChevronRight size={14} /> : "Collapse"}
              </button>
            )}
          </div>
        </aside>

        {/* ── Main View Panel ── */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* Top Bar for Desktop */}
          {!isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "26px 32px 0 32px",
                gap: 16,
                flexWrap: "wrap",
                flexShrink: 0,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {activeItem.key === "users"
                    ? "Users"
                    : activeItem.key === "suppliers"
                      ? "Suppliers"
                      : activeItem.key === "transactions"
                        ? "Transactions"
                        : activeItem.key === "stock_alerts"
                          ? "Stock Alerts"
                          : activeItem.key === "purchase_orders"
                            ? "Purchase Orders"
                            : activeItem.key === "items"
                              ? "Items"
                              : activeItem.key === "categories"
                                ? "Categories & Units"
                                : activeItem.key === "reports"
                                  ? "Reports"
                                  : activeItem.key === "audit_logs"
                                    ? "Audit Logs"
                                    : activeItem.key === "profile"
                                      ? "Profile"
                                      : "Welcome back, " +
                                      (loggedInUser?.fullName?.split(" ")[0] || "Musfir")}
                </div>
                <div style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>
                  {activeItem.key === "users"
                    ? "Manage Homerex staff accounts"
                    : activeItem.key === "suppliers"
                      ? "Manage supplier accounts"
                      : activeItem.key === "transactions"
                        ? "Manage and track inventory transactions"
                        : activeItem.key === "stock_alerts"
                          ? "Monitor items below safety stock levels"
                          : activeItem.key === "purchase_orders"
                            ? "Manage and generate supplier purchase orders"
                            : activeItem.key === "categories"
                              ? "Manage product classifications and standardized measurement units"
                              : activeItem.key === "items"
                                ? "Manage and track warehouse stocks"
                                : activeItem.key === "reports"
                                  ? "Manage and generate inventory metrics"
                                  : "Here's what's happening with your inventory today."}
                </div>
              </div>
              {/* Page-specific action buttons injected by individual pages */}
              {headerActions && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {headerActions}
                </div>
              )}
            </div>
          )}

          {/* Mobile page title banner */}
          {isMobile && (
            <div
              style={{
                padding: "16px 16px 0 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  {activeItem.key === "users"
                    ? "Users"
                    : activeItem.key === "suppliers"
                      ? "Suppliers"
                      : activeItem.key === "transactions"
                        ? "Transactions"
                        : activeItem.key === "stock_alerts"
                          ? "Stock Alerts"
                          : activeItem.key === "purchase_orders"
                            ? "Purchase Orders"
                            : activeItem.key === "items"
                              ? "Inventory"
                              : activeItem.key === "categories"
                                ? "Categories & Units"
                                : activeItem.key === "reports"
                                  ? "Reports"
                                  : activeItem.key === "audit_logs"
                                    ? "Audit Logs"
                                    : activeItem.key === "profile"
                                      ? "Profile"
                                      : "Welcome back"}
                </h2>
                <p style={{ fontSize: 12, color: c.textMuted }}>
                  {activeItem.key === "users" && "Manage Users"}
                  {activeItem.key === "suppliers" &&
                    "Manage suppliers"}
                  {activeItem.key === "transactions" &&
                    "Manage inventory transactions"}
                  {activeItem.key === "stock_alerts" &&
                    `Monitor items below safety stock levels`}
                  {activeItem.key === "purchase_orders" &&
                    `Purchase Orders Management`}
                  {activeItem.key === "items" &&
                    `Manage warehouse stocks`}
                  {activeItem.key === "categories" &&
                    `Manage Inventory categories`}
                </p>
              </div>
              {headerActions && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {headerActions}
                </div>
              )}
            </div>
          )}

          {/* Scrollable page body */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: isMobile ? "12px 16px 24px 16px" : "20px 32px 32px 32px",
              minHeight: 0,
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
