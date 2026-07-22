"use client";

import React, { useState, useMemo } from "react";
import { 
  Plus, Search, ChevronLeft, ChevronRight, X, Check, ArrowLeft, Save, Sparkles, FileText, Trash2
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────
interface Supplier {
  id: string;
  supplierName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  notes: string;
  totalSupplies: number;
}

interface POItem {
  no: number;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  poType: "Draft" | "Generated";
  items: POItem[];
  createdAt: string;
  updatedAt: string;
  netTotal: number;
}

interface PurchaseOrdersProps {
  c: any; // Theme colors
  supplierList: Supplier[];
}

// ── Mock Supplier Items Mapping ──────────────────────────────
const DEFAULT_SUPPLIER_ITEMS: Record<string, { id: string; name: string; defaultPrice: number }[]> = {};

const GENERAL_FALLBACK_ITEMS: { id: string; name: string; defaultPrice: number }[] = [];

export default function PurchaseOrders({ c, supplierList }: PurchaseOrdersProps) {
  // ── States ────────────────────────────────────────────────
  const [poList, setPoList] = useState<PurchaseOrder[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "Draft" | "Generated">("All");
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  
  // Selection / Flow States
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isEditingPO, setIsEditingPO] = useState(false);
  const [supplierSelectOpen, setSupplierSelectOpen] = useState(false);
  const [smartScanLoading, setSmartScanLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  // ── Helpers for Excel Table Adding Items ──────────────────
  const [addItemDropdownOpen, setAddItemDropdownOpen] = useState(false);

  // Trigger Toast Notification
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Filter and Search POs
  const filteredPOList = useMemo(() => {
    return poList.filter(po => {
      const matchesSearch = po.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) || po.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "All" || po.poType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [poList, searchQuery, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPOList.length / PAGE_SIZE));
  const paginatedPOs = useMemo(() => {
    return filteredPOList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredPOList, page]);

  // Handle Smart Scan (Placeholder with no functions)
  const handleSmartScan = () => {
    setSmartScanLoading(true);
    triggerToast("Initiating AI Smart Scan... analyzing inventory levels and demand forecasting.");
    setTimeout(() => {
      setSmartScanLoading(false);
      triggerToast("Smart Scan complete! Recommended suppliers have been analyzed. (Backend integration required to generate automatically)");
    }, 2000);
  };

  // Handle Manual PO - opens supplier picker
  const handleManualPO = () => {
    setSupplierSearchQuery("");
    setSupplierSelectOpen(true);
  };

  // Select Supplier and Create Draft PO
  const selectSupplierForPO = (supplier: Supplier) => {
    const existingDraft = poList.find(po => po.supplierId === supplier.id && po.poType === "Draft");
    if (existingDraft) {
      triggerToast(`An active Draft PO (${existingDraft.id}) already exists for ${supplier.supplierName}.`);
      return;
    }

    setSupplierSelectOpen(false);
    
    // Create new Draft PO
    const newPOId = `PO-${2000 + poList.length + 1}`;
    const dateStr = new Date().toISOString().replace("T", " ").substring(0, 16);
    
    // Pick default items of this supplier, or fallback
    const supplierItems = DEFAULT_SUPPLIER_ITEMS[supplier.id] || GENERAL_FALLBACK_ITEMS;
    
    // Pre-populate with first item if any exist
    const firstItem = supplierItems[0] || GENERAL_FALLBACK_ITEMS[0];
    const initialItems: POItem[] = firstItem ? [
      {
        no: 1,
        itemId: firstItem.id,
        itemName: firstItem.name,
        quantity: 10,
        unitPrice: firstItem.defaultPrice,
        total: 10 * firstItem.defaultPrice
      }
    ] : [];

    const newPO: PurchaseOrder = {
      id: newPOId,
      supplierId: supplier.id,
      supplierName: supplier.supplierName,
      poType: "Draft",
      items: initialItems,
      createdAt: dateStr,
      updatedAt: dateStr,
      netTotal: initialItems.length > 0 ? initialItems[0].total : 0
    };

    setPoList([newPO, ...poList]);
    setSelectedPO(newPO);
    setIsEditingPO(true);
    triggerToast(`Draft ${newPOId} created for ${supplier.supplierName}`);
  };

  // Open PO View/Edit
  const handleOpenPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setIsEditingPO(po.poType === "Draft");
  };

  // Exit PO editor/view
  const handleExitPO = () => {
    setSelectedPO(null);
    setIsEditingPO(false);
  };

  // Update item quantity in Draft PO
  const handleUpdateQty = (itemNo: number, val: string) => {
    if (!selectedPO) return;
    const qty = parseInt(val) || 0;
    const updatedItems = selectedPO.items.map(item => {
      if (item.no === itemNo) {
        return {
          ...item,
          quantity: qty,
          total: qty * item.unitPrice
        };
      }
      return item;
    });

    const net = updatedItems.reduce((acc, curr) => acc + curr.total, 0);
    setSelectedPO({
      ...selectedPO,
      items: updatedItems,
      netTotal: net
    });
  };

  // Update item price in Draft PO
  const handleUpdatePrice = (itemNo: number, val: string) => {
    if (!selectedPO) return;
    const price = parseFloat(val) || 0;
    const updatedItems = selectedPO.items.map(item => {
      if (item.no === itemNo) {
        return {
          ...item,
          unitPrice: price,
          total: item.quantity * price
        };
      }
      return item;
    });

    const net = updatedItems.reduce((acc, curr) => acc + curr.total, 0);
    setSelectedPO({
      ...selectedPO,
      items: updatedItems,
      netTotal: net
    });
  };

  // Add Item to Draft PO
  const handleAddItemToPO = (itemId: string, itemName: string, price: number) => {
    if (!selectedPO) return;
    
    // Check if item already exists
    if (selectedPO.items.find(i => i.itemId === itemId)) {
      triggerToast("Item already exists in the Purchase Order!");
      setAddItemDropdownOpen(false);
      return;
    }

    const nextNo = selectedPO.items.length + 1;
    const newItem: POItem = {
      no: nextNo,
      itemId,
      itemName,
      quantity: 1,
      unitPrice: price,
      total: price
    };

    const updatedItems = [...selectedPO.items, newItem];
    const net = updatedItems.reduce((acc, curr) => acc + curr.total, 0);
    
    setSelectedPO({
      ...selectedPO,
      items: updatedItems,
      netTotal: net
    });
    setAddItemDropdownOpen(false);
  };

  // Remove Item from Draft PO
  const handleRemoveItemFromPO = (itemNo: number) => {
    if (!selectedPO) return;
    if (selectedPO.items.length <= 1) {
      triggerToast("A Purchase Order must contain at least one item.");
      return;
    }
    const filteredItems = selectedPO.items.filter(i => i.no !== itemNo).map((item, idx) => ({
      ...item,
      no: idx + 1
    }));
    const net = filteredItems.reduce((acc, curr) => acc + curr.total, 0);
    setSelectedPO({
      ...selectedPO,
      items: filteredItems,
      netTotal: net
    });
  };

  // Save Draft PO
  const handleSavePO = () => {
    if (!selectedPO) return;
    const dateStr = new Date().toISOString().replace("T", " ").substring(0, 16);
    const updatedPOList = poList.map(po => {
      if (po.id === selectedPO.id) {
        return {
          ...selectedPO,
          updatedAt: dateStr
        };
      }
      return po;
    });
    setPoList(updatedPOList);
    setSelectedPO(null);
    setIsEditingPO(false);
    triggerToast(`Changes to ${selectedPO.id} successfully saved.`);
  };

  // Generate PO (mock action, related to backend)
  const handleGeneratePO = () => {
    if (!selectedPO) return;
    triggerToast(`Generating final PO document for ${selectedPO.id}... (Connecting to backend system)`);
    // Convert status to Generated
    const dateStr = new Date().toISOString().replace("T", " ").substring(0, 16);
    const updatedPOList = poList.map(po => {
      if (po.id === selectedPO.id) {
        return {
          ...selectedPO,
          poType: "Generated" as const,
          updatedAt: dateStr
        };
      }
      return po;
    });
    setPoList(updatedPOList);
    setSelectedPO(null);
    setIsEditingPO(false);
  };

  // Delete PO from list
  const handleDeletePO = (poId: string) => {
    if (confirm(`Are you sure you want to delete ${poId}?`)) {
      setPoList(poList.filter(po => po.id !== poId));
      triggerToast(`Purchase Order ${poId} deleted successfully.`);
    }
  };

  // List of available items to add for the selected PO's supplier
  const availableItemsToAdd = useMemo(() => {
    if (!selectedPO) return [];
    return DEFAULT_SUPPLIER_ITEMS[selectedPO.supplierId] || GENERAL_FALLBACK_ITEMS;
  }, [selectedPO]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          padding: "12px 20px",
          background: c.accent,
          color: "#fff",
          borderRadius: 10,
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 1000,
          animation: "slideIn 0.3s ease-out",
          fontSize: 13.5,
          fontWeight: 500
        }}>
          <Check size={16} strokeWidth={2.5} />
          {toastMessage}
        </div>
      )}

      {selectedPO ? (
        /* ── VIEW / EDIT DRAFT PO SPREADSHEET VIEW ── */
        <div style={{
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 14,
          padding: 24,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          boxShadow: "0 4px 20px rgba(0,0,0,0.02)"
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${c.border}`, paddingBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button 
                onClick={handleExitPO}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${c.border}`,
                  background: c.bg,
                  color: c.textMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = c.surfaceMuted}
                onMouseLeave={e => e.currentTarget.style.background = c.bg}
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{selectedPO.id}</span>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: selectedPO.poType === "Draft" ? c.warnSoft : c.accentSoft,
                    color: selectedPO.poType === "Draft" ? c.warn : c.accent
                  }}>
                    {selectedPO.poType}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: c.textMuted, marginTop: 2 }}>
                  Supplier: <strong style={{ color: c.text }}>{selectedPO.supplierName}</strong>
                </div>
              </div>
            </div>
            
            <div style={{ fontSize: 12.5, color: c.textFaint, textAlign: "right" }}>
              <div>Created: {selectedPO.createdAt}</div>
              <div style={{ marginTop: 2 }}>Last Updated: {selectedPO.updatedAt}</div>
            </div>
          </div>

          {/* Excel spreadsheet container */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 200, border: `1px solid ${c.border}`, borderRadius: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr style={{ background: c.surfaceMuted, borderBottom: `2px solid ${c.border}` }}>
                  <th style={{ padding: "10px 14px", width: 60, fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: "left" }}>No.</th>
                  <th style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: "left" }}>Item Name</th>
                  <th style={{ padding: "10px 14px", width: 140, fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: "right" }}>Quantity</th>
                  <th style={{ padding: "10px 14px", width: 160, fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: "right" }}>Unit Price (Rs)</th>
                  <th style={{ padding: "10px 14px", width: 180, fontSize: 12, fontWeight: 600, color: c.textMuted, textAlign: "right" }}>Total (Rs)</th>
                  {isEditingPO && <th style={{ padding: "10px 14px", width: 50 }} />}
                </tr>
              </thead>
              <tbody>
                {selectedPO.items.map((item) => (
                  <tr key={item.no} style={{ borderBottom: `1px solid ${c.border}`, transition: "background 0.1s" }}>
                    {/* No. (Read-only) */}
                    <td style={{ padding: "10px 14px", fontSize: 13.5, color: c.textFaint, fontWeight: 500 }}>
                      {item.no}
                    </td>
                    
                    {/* Item Name (Read-only) */}
                    <td style={{ padding: "10px 14px", fontSize: 13.5, fontWeight: 500, color: c.text }}>
                      {item.itemName}
                    </td>
                    
                    {/* Quantity (Editable if draft) */}
                    <td style={{ padding: "6px 14px", textAlign: "right" }}>
                      {isEditingPO ? (
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQty(item.no, e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            fontSize: 13.5,
                            border: `1px solid ${c.border}`,
                            background: c.bg,
                            color: c.text,
                            borderRadius: 6,
                            textAlign: "right",
                            outline: "none",
                            fontWeight: 600
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: c.text }}>{item.quantity}</span>
                      )}
                    </td>
                    
                    {/* Unit Price (Editable if draft) */}
                    <td style={{ padding: "6px 14px", textAlign: "right" }}>
                      {isEditingPO ? (
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleUpdatePrice(item.no, e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            fontSize: 13.5,
                            border: `1px solid ${c.border}`,
                            background: c.bg,
                            color: c.text,
                            borderRadius: 6,
                            textAlign: "right",
                            outline: "none",
                            fontWeight: 600
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 13.5, color: c.textMuted }}>Rs {item.unitPrice.toLocaleString()}</span>
                      )}
                    </td>
                    
                    {/* Total (Read-only calculated) */}
                    <td style={{ padding: "10px 14px", fontSize: 13.5, fontWeight: 600, color: c.text, textAlign: "right" }}>
                      Rs {item.total.toLocaleString()}
                    </td>

                    {/* Delete Item (Visible in edit draft mode) */}
                    {isEditingPO && (
                      <td style={{ padding: "6px 10px", textAlign: "center" }}>
                        <button
                          onClick={() => handleRemoveItemFromPO(item.no)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: c.danger,
                            cursor: "pointer",
                            fontSize: 12,
                            padding: 4,
                            opacity: 0.75
                          }}
                          title="Remove item"
                        >
                          <X size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                
                {/* Plus button at the bottom of last item */}
                {isEditingPO && (
                  <tr>
                    <td colSpan={6} style={{ padding: "10px 14px", borderBottom: `1px solid ${c.border}` }}>
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() => {
                            setItemSearchQuery("");
                            setAddItemDropdownOpen(!addItemDropdownOpen);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: `1.5px dashed ${c.border}`,
                            background: "transparent",
                            color: c.accent,
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = c.surfaceMuted}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <Plus size={14} /> Add Item from Supplier
                        </button>

                        {/* Add Item Dropdown Panel */}
                        {addItemDropdownOpen && (
                          <div style={{
                            position: "absolute",
                            top: 36,
                            left: 0,
                            width: 280,
                            background: c.surface,
                            border: `1px solid ${c.border}`,
                            borderRadius: 8,
                            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                            zIndex: 100,
                            padding: 6
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: c.textFaint, padding: "6px 10px", borderBottom: `1px solid ${c.border}`, marginBottom: 4 }}>
                              Select Supplier Product
                            </div>
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: `1px solid ${c.border}`,
                              background: c.bg,
                              margin: "4px 6px 8px 6px"
                            }}>
                              <Search size={12} color={c.textFaint} />
                              <input
                                value={itemSearchQuery}
                                onChange={e => setItemSearchQuery(e.target.value)}
                                placeholder="Search products..."
                                style={{
                                  border: "none",
                                  outline: "none",
                                  background: "transparent",
                                  color: c.text,
                                  fontSize: 12,
                                  width: "100%",
                                  fontFamily: "inherit"
                                }}
                              />
                            </div>
                            <div style={{ maxHeight: 200, overflowY: "auto" }}>
                              {availableItemsToAdd.filter(itm => itm.name.toLowerCase().includes(itemSearchQuery.toLowerCase())).length === 0 ? (
                                <div style={{ fontSize: 12, color: c.textFaint, padding: "10px 10px" }}>No items found</div>
                              ) : availableItemsToAdd.filter(itm => itm.name.toLowerCase().includes(itemSearchQuery.toLowerCase())).map(itm => (
                                <button
                                  key={itm.id}
                                  onClick={() => handleAddItemToPO(itm.id, itm.name, itm.defaultPrice)}
                                  style={{
                                    width: "100%",
                                    padding: "8px 10px",
                                    textAlign: "left",
                                    fontSize: 12.5,
                                    border: "none",
                                    background: "transparent",
                                    color: c.text,
                                    cursor: "pointer",
                                    borderRadius: 4,
                                    display: "flex",
                                    justifyContent: "space-between"
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = c.bg}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                  <span>{itm.name}</span>
                                  <span style={{ color: c.textMuted, fontWeight: 500 }}>Rs {itm.defaultPrice}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                
                {/* Net Total Row */}
                <tr style={{ background: c.surfaceMuted }}>
                  <td colSpan={3} style={{ padding: "14px 14px", fontSize: 13, fontWeight: 600, color: c.textMuted }}>
                    Net Total Order Value
                  </td>
                  <td colSpan={3} style={{ padding: "14px 14px", fontSize: 16, fontWeight: 700, color: c.accent, textAlign: "right" }}>
                    Rs {selectedPO.netTotal.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Action buttons at bottom */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, borderTop: `1px solid ${c.border}`, paddingTop: 16 }}>
            <button
              onClick={handleExitPO}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: "transparent",
                color: c.text,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            {isEditingPO && (
              <button
                onClick={handleSavePO}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: c.accentSoft,
                  color: c.accent,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                <Save size={15} /> Save Draft
              </button>
            )}
            <button
              onClick={handleGeneratePO}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 22px",
                borderRadius: 8,
                border: "none",
                background: c.accent,
                color: "#fff",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <FileText size={15} /> Generate PO
            </button>
          </div>
        </div>
      ) : (
        /* ── MAIN WORKSPACE VIEW (POs LIST) ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
          {/* Action Buttons & Quick Summary */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            padding: 18
          }}>
            {/* Manual PO Button */}
            <button
              onClick={handleManualPO}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
                padding: 18,
                borderRadius: 10,
                border: `1.5px dashed ${c.accent}`,
                background: c.accentSoft,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 15px rgba(59, 110, 94, 0.1)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: c.accent,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Plus size={18} strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.accent }}>Manual PO</div>
                <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Select a supplier and write details manually</div>
              </div>
            </button>

            {/* Smart Scan Button */}
            <button
              onClick={handleSmartScan}
              disabled={smartScanLoading}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
                padding: 18,
                borderRadius: 10,
                border: `1px solid ${c.border}`,
                background: c.bg,
                cursor: smartScanLoading ? "default" : "pointer",
                textAlign: "left",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => {
                if (!smartScanLoading) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.background = c.surfaceMuted;
                }
              }}
              onMouseLeave={e => {
                if (!smartScanLoading) {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.background = c.bg;
                }
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: c.warn,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>Smart Scan</div>
                <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>
                  {smartScanLoading ? "Analyzing..." : "Auto-scan low inventory & generate orders"}
                </div>
              </div>
            </button>
          </div>

          {/* Table Listing & Filtering */}
          <div style={{
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            flex: 1
          }}>
            {/* Toolbar Filters */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              borderBottom: `1px solid ${c.border}`,
              flexWrap: "wrap",
              gap: 12
            }}>
              {/* Type Filter Buttons */}
              <div style={{ display: "flex", gap: 6 }}>
                {(["All", "Draft", "Generated"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTypeFilter(t); setPage(1); }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 7,
                      border: `1px solid ${typeFilter === t ? c.accent : c.border}`,
                      background: typeFilter === t ? c.accentSoft : "transparent",
                      color: typeFilter === t ? c.accent : c.textMuted,
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Search PO */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: c.bg,
                width: "100%",
                maxWidth: 260
              }}>
                <Search size={14} color={c.textFaint} />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Search POs..."
                  style={{
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: c.text,
                    fontSize: 13,
                    width: "100%",
                    fontFamily: "inherit"
                  }}
                />
              </div>
            </div>

            {/* List Table */}
            <div style={{ overflowX: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 500 }}>
                <thead>
                  <tr style={{ color: c.textFaint, textAlign: "left", background: c.surfaceMuted }}>
                    {["PO ID", "Supplier Name", "PO Type", "Net Total", "Last Updated"].map(h => (
                      <th key={h} style={{ padding: "12px 20px", fontWeight: 500, fontSize: 11.5 }}>{h}</th>
                    ))}
                    <th style={{ padding: "12px 20px", width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {paginatedPOs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: c.textFaint }}>
                        No Purchase Orders found.
                      </td>
                    </tr>
                  ) : paginatedPOs.map(po => (
                    <tr
                      key={po.id}
                      onClick={() => handleOpenPO(po)}
                      style={{
                        borderTop: `1px solid ${c.border}`,
                        cursor: "pointer",
                        transition: "background 0.12s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = c.surfaceMuted}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "14px 20px", fontWeight: 600, color: c.text }}>{po.id}</td>
                      <td style={{ padding: "14px 20px", fontWeight: 500 }}>{po.supplierName}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: po.poType === "Draft" ? c.warnSoft : c.accentSoft,
                          color: po.poType === "Draft" ? c.warn : c.accent
                        }}>
                          {po.poType}
                        </span>
                      </td>
                      <td style={{ padding: "14px 20px", fontWeight: 600, color: c.text }}>
                        Rs {po.netTotal.toLocaleString()}
                      </td>
                      <td style={{ padding: "14px 20px", color: c.textMuted }}>{po.updatedAt}</td>
                      <td style={{ padding: "8px 20px", textAlign: "right" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePO(po.id);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: c.error || c.danger || "#B3473C",
                            cursor: "pointer",
                            padding: "6px 8px",
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s"
                          }}
                          onMouseEnter={elm => elm.currentTarget.style.background = c.warnSoft || "#FCECEB"}
                          onMouseLeave={elm => elm.currentTarget.style.background = "transparent"}
                          title="Delete Purchase Order"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 20px",
              borderTop: `1px solid ${c.border}`,
              flexShrink: 0
            }}>
              <span style={{ fontSize: 12, color: c.textFaint }}>
                Showing {filteredPOList.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredPOList.length)} of {filteredPOList.length} orders
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
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
                    opacity: page === 1 ? 0.4 : 1
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
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
                      cursor: "pointer"
                    }}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
                    opacity: page === totalPages ? 0.4 : 1
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Select Modal (for Manual PO selection) */}
      {supplierSelectOpen && (
        <div 
          onClick={() => setSupplierSelectOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,10,8,0.5)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              width: 440,
              maxWidth: "100%",
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              padding: 22,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Select Supplier</span>
              <button 
                onClick={() => setSupplierSelectOpen(false)}
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
                  cursor: "pointer"
                }}
              >
                <X size={15} />
              </button>
            </div>
            
            {/* Search Input */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${c.border}`,
              background: c.bg,
              marginBottom: 14
            }}>
              <Search size={14} color={c.textFaint} />
              <input
                value={supplierSearchQuery}
                onChange={e => setSupplierSearchQuery(e.target.value)}
                placeholder="Search suppliers..."
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: c.text,
                  fontSize: 13.5,
                  width: "100%",
                  fontFamily: "inherit"
                }}
              />
            </div>

            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {supplierList
                .filter(s => s.active && (
                  s.supplierName.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
                  s.contactPerson.toLowerCase().includes(supplierSearchQuery.toLowerCase())
                ))
                .map(s => {
                  const hasDraft = poList.some(po => po.supplierId === s.id && po.poType === "Draft");
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectSupplierForPO(s)}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        textAlign: "left",
                        borderRadius: 8,
                        border: `1px solid ${hasDraft ? c.warn + "33" : c.border}`,
                        background: hasDraft ? c.warnSoft : c.bg,
                        color: c.text,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4
                      }}
                      onMouseEnter={e => {
                        if (!hasDraft) {
                          e.currentTarget.style.borderColor = c.accent;
                          e.currentTarget.style.background = c.surfaceMuted;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!hasDraft) {
                          e.currentTarget.style.borderColor = c.border;
                          e.currentTarget.style.background = c.bg;
                        }
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.supplierName}</span>
                        {hasDraft && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: c.warn, background: c.warnSoft, padding: "2px 6px", borderRadius: 4, border: `1px solid ${c.warn}33` }}>
                            Draft Exists
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11.5, color: c.textMuted }}>Contact: {s.contactPerson}</span>
                    </button>
                  );
                })}
              {supplierList.filter(s => s.active && (
                s.supplierName.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
                s.contactPerson.toLowerCase().includes(supplierSearchQuery.toLowerCase())
              )).length === 0 && (
                <div style={{ textAlign: "center", color: c.textFaint, padding: "20px 0" }}>No active suppliers found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
