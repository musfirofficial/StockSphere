"use client";

import React, { useMemo } from "react";
import { AlertTriangle, Bell, Check, Phone, Mail, FileText, ArrowRight } from "lucide-react";
import { useTheme } from "../ThemeContext";
import { useData } from "../DataContext";
import Link from "next/link";

export default function StockAlertsPage() {
  const { c } = useTheme();
  const { itemList, supplierList } = useData();

  // Find items where quantity is <= reorderLevel
  const lowStockItems = useMemo(() => {
    return itemList.filter(
      (item) => item.active && item.quantity <= item.reorderLevel
    );
  }, [itemList]);

  // Helper to find supplier details for contact info
  const getSupplierContact = (supplierName: string) => {
    const supp = supplierList.find(
      (s) => s.supplierName.toLowerCase() === supplierName.toLowerCase()
    );
    return supp
      ? { phone: supp.phone, email: supp.email }
      : { phone: "N/A", email: "N/A" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%" }}>
      {/* Summary Header Card */}
      <div
        style={{
          background: lowStockItems.length > 0 ? c.warnSoft : c.accentSoft,
          border: `1px solid ${lowStockItems.length > 0 ? c.warn : c.accent}`,
          borderRadius: 14,
          padding: 20,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: lowStockItems.length > 0 ? c.warn : c.accent,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {lowStockItems.length > 0 ? (
            <AlertTriangle size={22} />
          ) : (
            <Check size={22} strokeWidth={3} />
          )}
        </div>
        <div>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: lowStockItems.length > 0 ? c.warn : c.accent,
              marginBottom: 4,
            }}
          >
            {lowStockItems.length > 0
              ? `${lowStockItems.length} Stock Alert${lowStockItems.length > 1 ? "s" : ""} Active`
              : "Inventory Healthy"}
          </h3>
          <p
            style={{
              fontSize: 13,
              color: c.textMuted,
              lineHeight: 1.4,
            }}
          >
            {lowStockItems.length > 0
              ? "The items listed below have dropped below their defined safety reorder thresholds. Please initiate purchase orders soon to restock."
              : "All active inventory items are currently stocked above their minimum safety reorder levels."}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      {lowStockItems.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: 300,
            gap: 12,
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            padding: 40,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: c.accentSoft,
              color: c.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 20px ${c.accentSoft}`,
            }}
          >
            <Bell size={24} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600 }}>All Systems Normal</span>
          <span style={{ fontSize: 13, color: c.textFaint, maxWidth: 300 }}>
            No stock levels are critical. Check back later or adjust reorder thresholds in the Items panel.
          </span>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {lowStockItems.map((item) => {
            const contact = getSupplierContact(item.supplier);
            const percentage = Math.min(100, Math.round((item.quantity / item.reorderLevel) * 100)) || 0;
            return (
              <div
                key={item.id}
                style={{
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 14,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 16,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.01)",
                  transition: "transform 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = c.warn;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = c.border;
                }}
              >
                <div>
                  {/* Item Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          fontSize: 14.5,
                          fontWeight: 600,
                          color: c.text,
                          marginBottom: 3,
                        }}
                      >
                        {item.itemName}
                      </h4>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11.5,
                            color: c.textFaint,
                            fontFamily: "monospace",
                          }}
                        >
                          {item.sku}
                        </span>
                        <span style={{ fontSize: 11.5, color: c.textFaint }}>•</span>
                        <span
                          style={{
                            fontSize: 11.5,
                            color: c.textMuted,
                            fontWeight: 500,
                          }}
                        >
                          {item.category}
                        </span>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: c.dangerSoft,
                        color: c.danger,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.quantity === 0 ? "Out of Stock" : "Low Stock"}
                    </span>
                  </div>

                  {/* Stock Progress Indicators */}
                  <div style={{ marginTop: 14 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ color: c.textMuted }}>Current Stock:</span>
                      <strong style={{ color: c.danger }}>
                        {item.quantity} / {item.reorderLevel} {item.unit}
                      </strong>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: 7,
                        borderRadius: 99,
                        background: c.border,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: "100%",
                          borderRadius: 99,
                          background: item.quantity === 0 ? c.danger : c.warn,
                          transition: "width 0.4s ease-out",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: c.textFaint,
                        marginTop: 4,
                      }}
                    >
                      <span>{percentage}% of Safety Level</span>
                      <span>Restock qty: {item.reorderQuantity}</span>
                    </div>
                  </div>
                </div>

                {/* Supplier contact & action */}
                <div
                  style={{
                    borderTop: `1px solid ${c.border}`,
                    paddingTop: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 11.5, color: c.textMuted }}>
                    Supplier: <strong style={{ color: c.text }}>{item.supplier}</strong>
                  </div>

                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: c.textFaint }}>
                    <a
                      href={`tel:${contact.phone}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        color: "inherit",
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = c.accent)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "inherit")}
                    >
                      <Phone size={12} /> {contact.phone}
                    </a>
                    <a
                      href={`mailto:${contact.email}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        color: "inherit",
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = c.accent)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "inherit")}
                    >
                      <Mail size={12} /> {contact.email}
                    </a>
                  </div>

                  <Link
                    href="/dashboard/purchase_orders"
                    style={{
                      marginTop: 6,
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: c.surfaceMuted,
                      color: c.accent,
                      fontSize: 12.5,
                      fontWeight: 600,
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      border: `1px solid ${c.border}`,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = c.accentSoft;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = c.surfaceMuted;
                    }}
                  >
                    <FileText size={13} />
                    <span>Create Purchase Order</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
