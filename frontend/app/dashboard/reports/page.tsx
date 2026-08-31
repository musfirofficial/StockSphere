"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FileDown,
  Printer,
  History,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpDown,
  Download,
  Trash2,
  X,
  FileSpreadsheet,
  Building2,
  Package,
  Layers,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useTheme } from "../ThemeContext";
import { apiFetch } from "@/lib/api";
import { Pagination } from "@/components/ui";

const REPORT_TYPES = [
  { id: "OVERALL_SUMMARY", label: "Overall Inventory Summary", icon: Package, desc: "Executive stock levels, valuations, and top assets" },
  { id: "LOW_STOCK", label: "Stock Alert & Replenishment", icon: AlertTriangle, desc: "Urgent reorder items, shortages, and supplier impact" },
  { id: "CATEGORY_WISE", label: "Category Valuation & Margins", icon: Layers, desc: "Inventory capital distribution and margin analysis" },
  { id: "TRANSACTION", label: "Transaction Audit Ledger", icon: ArrowUpDown, desc: "Detailed chronological ledger of all stock movements" },
  { id: "STOCK_MOVEMENT", label: "Stock Movement & Velocity (ABC)", icon: Clock, desc: "Inventory turnover rates and velocity classification" },
  { id: "SUPPLIER", label: "Supplier Spend & Fulfillment", icon: Building2, desc: "Supplier procurement spend and PO completion scorecard" },
];

const formatDateInput = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function ReportsPage() {
  const { c } = useTheme();
  const reportRef = useRef<HTMLDivElement>(null);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<string>("OVERALL_SUMMARY");

  // Date Range State (Default: 30 days)
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateInput(d);
  });

  const [endDate, setEndDate] = useState<string>(() => {
    return formatDateInput(new Date());
  });

  // Current Generated Report & Payload
  const [currentReportRecord, setCurrentReportRecord] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);

  // Historical Reports Drawer State
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [historyReports, setHistoryReports] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Table filtering & pagination inside report views
  const [tableSearch, setTableSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 12;

  // Validation: Date Range <= 365 Days
  const dateError = useMemo(() => {
    if (!startDate || !endDate) return "";
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return "Start date cannot be earlier than end date.";
    }
    const diffDays = Math.ceil(
      Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays > 365) {
      return "Date range cannot exceed 1 year (365 days).";
    }
    return "";
  }, [startDate, endDate]);

  // Load Historical Reports from backend
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await apiFetch<any[]>("/reports/");
      setHistoryReports(data || []);
    } catch (err) {
      console.error("Failed to load reports history:", err);
      setHistoryReports([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Set Preset Date Ranges
  const setPresetRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(formatDateInput(start));
    setEndDate(formatDateInput(end));
  };

  // Generate / Fetch Report from Backend
  const handleGenerateReport = async () => {
    if (activeTab !== "CATEGORY_WISE" && dateError) return;

    setLoading(true);
    setError("");
    setTableSearch("");
    setPage(1);

    try {
      const nowStr = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, "");
      const tabLabel =
        REPORT_TYPES.find((t) => t.id === activeTab)?.label.replace(/\s+/g, "_") ||
        "Report";
      const reportName = `${tabLabel}_${nowStr.slice(0, 14)}`;

      const payload = {
        report_name: reportName,
        report_type: activeTab,
        file_format: "PDF",
        start_date: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
        end_date: new Date(`${endDate}T23:59:59.000Z`).toISOString(),
      };

      const res = await apiFetch<any>("/reports/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res) {
        setCurrentReportRecord(res.report);
        setReportData(res.data);
        loadHistory();
      }
    } catch (err: any) {
      console.error("Failed to generate report:", err);
      setError(err.message || "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  // Auto generate on initial mount or tab change
  useEffect(() => {
    handleGenerateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Load a historical report
  const handleViewHistoricalReport = async (repId: string) => {
    setLoading(true);
    setError("");
    setTableSearch("");
    setPage(1);
    try {
      const res = await apiFetch<any>(`/reports/${repId}`);
      if (res) {
        setCurrentReportRecord(res.report);
        setReportData(res.data);
        setActiveTab(res.report.report_type);
        setHistoryOpen(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load historical report.");
    } finally {
      setLoading(false);
    }
  };

  // Delete a historical report
  const handleDeleteReport = async (repId: string) => {
    if (!confirm("Are you sure you want to delete this historical report record?")) return;
    try {
      await apiFetch(`/reports/${repId}`, { method: "DELETE" });
      loadHistory();
      if (currentReportRecord?.report_id === repId) {
        setCurrentReportRecord(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete report.");
    }
  };

  // PDF Export
  const handleGeneratePDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPDF(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: c.bg || "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(20, 20, 20);
      pdf.text("StockSphere Enterprise Inventory", margin, 16);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, 22);

      const activeReportLabel =
        REPORT_TYPES.find((t) => t.id === activeTab)?.label || "Report";
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(20, 20, 20);
      pdf.text(activeReportLabel, pageWidth - margin, 16, { align: "right" });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(120, 120, 120);
      const periodText =
        activeTab === "CATEGORY_WISE"
          ? "Complete Category Snapshot"
          : `Date Range: ${startDate} to ${endDate}`;
      pdf.text(periodText, pageWidth - margin, 22, { align: "right" });

      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.4);
      pdf.line(margin, 26, pageWidth - margin, 26);

      const startY = 30;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", margin, startY, contentWidth, contentHeight);

      const reportTitle = activeReportLabel.replace(/\s+/g, "_");
      pdf.save(`StockSphere_${reportTitle}_${startDate}.pdf`);
    } catch (err) {
      console.error("Failed to export PDF:", err);
      alert("Failed to export PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!reportData) return;
    let csvRows: string[] = [];
    const title = REPORT_TYPES.find((t) => t.id === activeTab)?.label || "Report";

    if (activeTab === "OVERALL_SUMMARY") {
      csvRows.push(`"StockSphere - ${title}"`);
      csvRows.push(`"Total In Stock Units","${reportData.total_items_in_stock}"`);
      csvRows.push(`"Total Unique Items","${reportData.total_unique_items}"`);
      csvRows.push(`"Inventory Cost Worth ($)","${reportData.inventory_cost_worth}"`);
      csvRows.push(`"Selling Worth ($)","${reportData.selling_worth}"`);
      csvRows.push(`"Potential Gross Profit ($)","${reportData.potential_profit}"`);
      csvRows.push(`"Sell-Through Rate (%)","${reportData.sell_through_rate}%"`);
      csvRows.push("");
      csvRows.push(`"Top Valuable Stock Items"`);
      csvRows.push(`"Item Name","SKU","Category","Quantity","Unit Cost","Selling Price","Total Cost Worth","Total Selling Worth"`);
      (reportData.top_valuable_items || []).forEach((i: any) => {
        csvRows.push(`"${i.item_name}","${i.sku}","${i.category_name}","${i.quantity}","${i.cost_price}","${i.selling_price}","${i.total_cost_worth}","${i.total_selling_worth}"`);
      });
    } else if (activeTab === "LOW_STOCK") {
      csvRows.push(`"StockSphere - ${title}"`);
      csvRows.push(`"Global Critical Alerts","${reportData.global_critical_alerts}"`);
      csvRows.push(`"Global Low Stock Alerts","${reportData.global_low_stock_alerts}"`);
      csvRows.push(`"Estimated Restock Cost ($)","${reportData.estimated_restock_cost}"`);
      csvRows.push("");
      csvRows.push(`"Replenishment Action List"`);
      csvRows.push(`"Item Name","SKU","Category","In Stock","Reorder Level","Suggested Order","Unit Cost","Est Restock Cost","Supplier"`);
      [...(reportData.critical_items_list || []), ...(reportData.low_stock_items_list || [])].forEach((i: any) => {
        csvRows.push(`"${i.item_name}","${i.sku}","${i.category_name}","${i.quantity_in_stock}","${i.reorder_level}","${i.reorder_quantity}","${i.cost_price}","${i.estimated_restock_cost}","${i.supplier_name}"`);
      });
    } else if (activeTab === "CATEGORY_WISE") {
      csvRows.push(`"StockSphere - ${title}"`);
      csvRows.push(`"Category Name","Item Count","Total Stock Units","Cost Valuation ($)","Retail Valuation ($)","Gross Margin (%)","Share of Stock (%)"`);
      (reportData.categories || []).forEach((c: any) => {
        csvRows.push(`"${c.category_name}","${c.item_count}","${c.total_units}","${c.cost_value}","${c.stock_value}","${c.margin_percentage}%","${c.space_used_percentage}%"`);
      });
    } else if (activeTab === "TRANSACTION") {
      csvRows.push(`"StockSphere - ${title}"`);
      csvRows.push(`"Date","Transaction ID","Item Name","SKU","Type","Quantity","Unit Price","Total Value","Operator","Reason / Notes"`);
      (reportData.transactions || []).forEach((t: any) => {
        csvRows.push(`"${new Date(t.transaction_date).toLocaleString()}","${t.transaction_id}","${t.item_name}","${t.sku}","${t.transaction_type}","${t.quantity}","${t.unit_price}","${t.total_amount}","${t.operator_name}","${t.reason || t.note || ''}"`);
      });
    } else if (activeTab === "STOCK_MOVEMENT") {
      csvRows.push(`"StockSphere - ${title}"`);
      csvRows.push(`"Item Name","SKU","Category","Opening Stock","Total Inward","Total Outward","Closing Stock","Net Change","Turnover Rate (%)","Velocity Class"`);
      (reportData.items || []).forEach((i: any) => {
        csvRows.push(`"${i.item_name}","${i.sku}","${i.category_name}","${i.opening_stock}","${i.total_inflow}","${i.total_outflow}","${i.closing_stock}","${i.net_change}","${i.turnover_rate}%","${i.velocity_tier}"`);
      });
    } else if (activeTab === "SUPPLIER") {
      csvRows.push(`"StockSphere - ${title}"`);
      csvRows.push(`"Supplier Name","Contact Person","Phone","Email","Active","Products Sourced","Total Spend ($)","Completed POs","Pending POs","Fulfillment Rate (%)"`);
      (reportData.suppliers || []).forEach((s: any) => {
        csvRows.push(`"${s.supplier_name}","${s.contact_person}","${s.phone}","${s.email}","${s.is_active ? 'Active' : 'Inactive'}","${s.total_items_supplied}","${s.total_purchase_spend}","${s.completed_pos}","${s.pending_pos}","${s.fulfillment_rate}%"`);
      });
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `StockSphere_${title.replace(/\s+/g, "_")}_${startDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%" }}>
      {/* ── Top Bar: Selection, Date Range & Actions ── */}
      <div
        style={{
          background: c.surface,
          border: `1px solid ${c.border}`,
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          {/* Report Type Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 280 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: c.textMuted }}>Report:</span>
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: c.inputBg,
                color: c.text,
                fontSize: 13.5,
                fontWeight: 600,
                outline: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                flex: 1,
                maxWidth: 340,
              }}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 13px",
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: c.surface,
                color: c.text,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <History size={14} />
              <span>Report History ({historyReports.length})</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={loading || !reportData}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 13px",
                borderRadius: 8,
                border: `1px solid ${c.border}`,
                background: c.surface,
                color: c.text,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: loading || !reportData ? "default" : "pointer",
                opacity: loading || !reportData ? 0.6 : 1,
                fontFamily: "inherit",
              }}
            >
              <FileSpreadsheet size={14} />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleGeneratePDF}
              disabled={isGeneratingPDF || loading || !reportData}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: c.accent,
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: isGeneratingPDF || loading ? "default" : "pointer",
                opacity: isGeneratingPDF || loading ? 0.6 : 1,
                fontFamily: "inherit",
              }}
            >
              <FileDown size={14} />
              <span>{isGeneratingPDF ? "Exporting..." : "Download PDF"}</span>
            </button>
          </div>
        </div>

        {/* Date Range Selector & Presets */}
        {activeTab !== "CATEGORY_WISE" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              borderTop: `1px solid ${c.border}`,
              paddingTop: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: c.textMuted, fontWeight: 500 }}>Date Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: "5px 9px",
                  borderRadius: 6,
                  border: `1px solid ${c.border}`,
                  background: c.inputBg,
                  color: c.text,
                  fontSize: 12.5,
                }}
              />
              <span style={{ fontSize: 12, color: c.textMuted }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: "5px 9px",
                  borderRadius: 6,
                  border: `1px solid ${c.border}`,
                  background: c.inputBg,
                  color: c.text,
                  fontSize: 12.5,
                }}
              />

              <button
                onClick={handleGenerateReport}
                disabled={loading || !!dateError}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: c.accent,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: loading || !!dateError ? "default" : "pointer",
                  opacity: loading || !!dateError ? 0.6 : 1,
                  marginLeft: 6,
                }}
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                <span>Update Report</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {[
                { label: "7 Days", days: 7 },
                { label: "30 Days", days: 30 },
                { label: "90 Days", days: 90 },
                { label: "1 Year", days: 365 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPresetRange(p.days)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: `1px solid ${c.border}`,
                    background: c.surfaceMuted,
                    color: c.textMuted,
                    fontSize: 11.5,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {dateError && (
          <div style={{ fontSize: 12, color: c.danger, fontWeight: 500 }}>
            {dateError}
          </div>
        )}
      </div>

      {/* ── Historical Reports Drawer ── */}
      {historyOpen && (
        <div
          style={{
            background: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: 12,
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: c.text, margin: 0 }}>
              Generated Reports Audit Log
            </h3>
            <button
              onClick={() => setHistoryOpen(false)}
              style={{ background: "none", border: "none", color: c.textMuted, cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: c.surfaceMuted, color: c.textFaint, textAlign: "left" }}>
                  <th style={{ padding: "8px 12px" }}>Report Name</th>
                  <th style={{ padding: "8px 12px" }}>Type</th>
                  <th style={{ padding: "8px 12px" }}>Date Window</th>
                  <th style={{ padding: "8px 12px" }}>Generated By</th>
                  <th style={{ padding: "8px 12px" }}>Timestamp</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 20, textAlign: "center", color: c.textMuted }}>
                      Loading report history...
                    </td>
                  </tr>
                ) : historyReports.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 20, textAlign: "center", color: c.textFaint }}>
                      No reports generated yet.
                    </td>
                  </tr>
                ) : (
                  historyReports.map((rep) => (
                    <tr key={rep.report_id} style={{ borderTop: `1px solid ${c.border}` }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600, color: c.text }}>
                        {rep.report_name}
                      </td>
                      <td style={{ padding: "9px 12px", color: c.textMuted }}>
                        {REPORT_TYPES.find((t) => t.id === rep.report_type)?.label || rep.report_type}
                      </td>
                      <td style={{ padding: "9px 12px", color: c.textMuted, fontSize: 11.5 }}>
                        {new Date(rep.start_date).toLocaleDateString()} – {new Date(rep.end_date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ color: "#2563EB", fontWeight: 600 }}>
                          @{rep.operator_name || "System"}
                        </span>
                      </td>
                      <td style={{ padding: "9px 12px", color: c.textFaint }}>
                        {new Date(rep.generated_at).toLocaleString()}
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <button
                            onClick={() => handleViewHistoricalReport(rep.report_id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: `1px solid ${c.border}`,
                              background: c.surfaceMuted,
                              color: c.accent,
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDeleteReport(rep.report_id)}
                            style={{
                              padding: "4px",
                              border: "none",
                              background: "none",
                              color: c.danger || "#DC2626",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Printable / Screen Report Content ── */}
      <div ref={reportRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {loading ? (
          <div
            style={{
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 12,
              padding: "48px 20px",
              textAlign: "center",
              color: c.textMuted,
            }}
          >
            Generating report data...
          </div>
        ) : error ? (
          <div
            style={{
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 12,
              padding: "32px 20px",
              textAlign: "center",
              color: c.danger,
            }}
          >
            {error}
          </div>
        ) : !reportData ? (
          <div
            style={{
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 12,
              padding: "48px 20px",
              textAlign: "center",
              color: c.textFaint,
            }}
          >
            No report data available.
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════ */}
            {/* 1. OVERALL INVENTORY SUMMARY REPORT VIEW                      */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "OVERALL_SUMMARY" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Metric Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Total Stock Units</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
                      {Number(reportData.total_items_in_stock || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>
                      {reportData.total_unique_items} Unique SKUs ({reportData.active_items_count} Active)
                    </div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Inventory Cost Worth</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
                      ${Number(reportData.inventory_cost_worth || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Asset investment valuation</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Estimated Retail Worth</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
                      ${Number(reportData.selling_worth || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#2E7D32", marginTop: 4 }}>
                      +${Number(reportData.potential_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} potential margin
                    </div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Sell-Through Velocity</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.accent, marginTop: 4 }}>
                      {reportData.sell_through_rate}%
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>
                      Period Sales vs Receipts
                    </div>
                  </div>
                </div>

                {/* Top Valuable Items Table */}
                <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.border}`, fontWeight: 700, fontSize: 13.5, color: c.text }}>
                    Top High-Value Stock Assets
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: c.surfaceMuted, color: c.textFaint, textAlign: "left" }}>
                          <th style={{ padding: "8px 12px" }}>Item Name</th>
                          <th style={{ padding: "8px 12px" }}>SKU</th>
                          <th style={{ padding: "8px 12px" }}>Category</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>In Stock</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Cost Price</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Selling Price</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Total Cost Worth</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Total Retail Worth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.top_valuable_items || []).map((item: any, idx: number) => (
                          <tr key={idx} style={{ borderTop: `1px solid ${c.border}` }}>
                            <td style={{ padding: "9px 12px", fontWeight: 600, color: c.text }}>{item.item_name}</td>
                            <td style={{ padding: "9px 12px", fontFamily: "monospace", color: c.textMuted }}>{item.sku}</td>
                            <td style={{ padding: "9px 12px", color: c.textMuted }}>{item.category_name}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>{item.quantity}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: c.textMuted }}>${Number(item.cost_price).toFixed(2)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 500 }}>${Number(item.selling_price).toFixed(2)}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: c.text }}>${Number(item.total_cost_worth).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: "#2E7D32" }}>${Number(item.total_selling_worth).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Category Summary Breakdown */}
                <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.border}`, fontWeight: 700, fontSize: 13.5, color: c.text }}>
                    Category Valuation Distribution
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: c.surfaceMuted, color: c.textFaint, textAlign: "left" }}>
                          <th style={{ padding: "8px 12px" }}>Category Name</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Unique Items</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Total Units in Stock</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Total Category Worth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.category_summary || []).map((cat: any, idx: number) => (
                          <tr key={idx} style={{ borderTop: `1px solid ${c.border}` }}>
                            <td style={{ padding: "9px 12px", fontWeight: 600, color: c.text }}>{cat.category_name}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: c.textMuted }}>{cat.item_count}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>{Number(cat.stock_qty).toLocaleString()}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: c.text }}>${Number(cat.stock_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* 2. STOCK ALERT & REPLENISHMENT REPORT VIEW                   */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "LOW_STOCK" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Metric Summary Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Out of Stock (Critical)</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#DC2626", marginTop: 4 }}>
                      {reportData.global_critical_alerts}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Immediate restock required</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Low Stock Alerts</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#EA580C", marginTop: 4 }}>
                      {reportData.global_low_stock_alerts}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Below safety reorder threshold</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Estimated Restock Capital</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
                      ${Number(reportData.estimated_restock_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Funds needed for target reorder levels</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Period Resolution Rate</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#2E7D32", marginTop: 4 }}>
                      {reportData.period_resolution_rate}%
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>
                      Avg MTTR: {reportData.avg_mttr_critical_hours}h (Critical)
                    </div>
                  </div>
                </div>

                {/* Replenishment Action Items Table */}
                <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.border}`, fontWeight: 700, fontSize: 13.5, color: c.text }}>
                    Items Awaiting Replenishment & Purchase Orders
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: c.surfaceMuted, color: c.textFaint, textAlign: "left" }}>
                          <th style={{ padding: "8px 12px" }}>Status</th>
                          <th style={{ padding: "8px 12px" }}>Item Name</th>
                          <th style={{ padding: "8px 12px" }}>SKU</th>
                          <th style={{ padding: "8px 12px" }}>Category</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Current Stock</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Reorder Level</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Suggested Order</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Est. Cost</th>
                          <th style={{ padding: "8px 12px" }}>Assigned Supplier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...(reportData.critical_items_list || []), ...(reportData.low_stock_items_list || [])].map((item: any, idx: number) => {
                          const isCritical = item.quantity_in_stock <= 0;
                          return (
                            <tr key={idx} style={{ borderTop: `1px solid ${c.border}` }}>
                              <td style={{ padding: "9px 12px" }}>
                                <span
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    color: isCritical ? "#DC2626" : "#EA580C",
                                    background: isCritical ? "#FEE2E2" : "#FFEDD5",
                                    padding: "2px 8px",
                                    borderRadius: 5,
                                  }}
                                >
                                  {isCritical ? "CRITICAL (0)" : "LOW STOCK"}
                                </span>
                              </td>
                              <td style={{ padding: "9px 12px", fontWeight: 600, color: c.text }}>{item.item_name}</td>
                              <td style={{ padding: "9px 12px", fontFamily: "monospace", color: c.textMuted }}>{item.sku}</td>
                              <td style={{ padding: "9px 12px", color: c.textMuted }}>{item.category_name}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: isCritical ? "#DC2626" : c.text }}>
                                {item.quantity_in_stock} {item.unit}
                              </td>
                              <td style={{ padding: "9px 12px", textAlign: "right", color: c.textMuted }}>{item.reorder_level}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: c.accent }}>
                                +{item.reorder_quantity} {item.unit}
                              </td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: c.text }}>
                                ${Number(item.estimated_restock_cost).toFixed(2)}
                              </td>
                              <td style={{ padding: "9px 12px", color: c.textMuted }}>{item.supplier_name}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* 3. CATEGORY VALUATION & MARGINS REPORT VIEW                   */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "CATEGORY_WISE" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Active Categories</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
                      {reportData.total_categories}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>{reportData.total_catalog_items} Active Catalog Items</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Total Inventory Cost</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
                      ${Number(reportData.total_inventory_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Total capital locked in inventory</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Total Retail Value</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
                      ${Number(reportData.total_inventory_retail || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#2E7D32", marginTop: 4 }}>Expected sales realization</div>
                  </div>
                </div>

                <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.border}`, fontWeight: 700, fontSize: 13.5, color: c.text }}>
                    Category Margin & Capital Breakdown
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: c.surfaceMuted, color: c.textFaint, textAlign: "left" }}>
                          <th style={{ padding: "8px 12px" }}>Category Name</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Items Count</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Stock Units</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Cost Valuation</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Retail Valuation</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Gross Margin (%)</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Share of Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.categories || []).map((cat: any, idx: number) => (
                          <tr key={idx} style={{ borderTop: `1px solid ${c.border}` }}>
                            <td style={{ padding: "9px 12px", fontWeight: 600, color: c.text }}>{cat.category_name}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: c.textMuted }}>{cat.item_count}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>{Number(cat.total_units).toLocaleString()}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: c.textMuted }}>${Number(cat.cost_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: c.text }}>${Number(cat.stock_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: cat.margin_percentage >= 30 ? "#2E7D32" : c.text }}>
                              {cat.margin_percentage}%
                            </td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: c.textMuted }}>{cat.space_used_percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* 4. TRANSACTION AUDIT LEDGER REPORT VIEW                       */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "TRANSACTION" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Total Transactions</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
                      {reportData.total_transactions}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>In Selected Window</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Total Inflow Units</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#2E7D32", marginTop: 4 }}>
                      +{Number(reportData.total_units_inflow || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Purchases & returns received</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Total Outflow Units</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#DC2626", marginTop: 4 }}>
                      -{Number(reportData.total_units_outflow || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Sales, damages & expirations</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Net Sales Revenue</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.accent, marginTop: 4 }}>
                      ${Number(reportData.total_sales_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>From customer sales</div>
                  </div>
                </div>

                {/* Ledger Breakdown by Type */}
                <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.border}`, fontWeight: 700, fontSize: 13.5, color: c.text }}>
                    Transaction Volume by Classification
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: c.surfaceMuted, color: c.textFaint, textAlign: "left" }}>
                          <th style={{ padding: "8px 12px" }}>Classification Type</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Record Count</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Total Units Moved</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Total Gross Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.type_breakdown || []).map((t: any, idx: number) => (
                          <tr key={idx} style={{ borderTop: `1px solid ${c.border}` }}>
                            <td style={{ padding: "9px 12px", fontWeight: 600, color: c.text }}>{t.transaction_type}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: c.textMuted }}>{t.count}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>{Number(t.total_quantity).toLocaleString()}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: c.text }}>${Number(t.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Detailed Chronological Ledger */}
                <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: c.text }}>Itemized Transaction Ledger Rows</span>
                    <input
                      value={tableSearch}
                      onChange={(e) => {
                        setTableSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Filter ledger rows..."
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: `1px solid ${c.border}`,
                        background: c.inputBg,
                        color: c.text,
                        fontSize: 12,
                        maxWidth: 220,
                      }}
                    />
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: c.surfaceMuted, color: c.textFaint, textAlign: "left" }}>
                          <th style={{ padding: "8px 12px" }}>Date & Time</th>
                          <th style={{ padding: "8px 12px" }}>Item & SKU</th>
                          <th style={{ padding: "8px 12px" }}>Type</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Qty</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Unit Price</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Total Amount</th>
                          <th style={{ padding: "8px 12px" }}>Operator</th>
                          <th style={{ padding: "8px 12px" }}>Reason / Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const allRows = (reportData.transactions || []).filter((r: any) => {
                            if (!tableSearch) return true;
                            const q = tableSearch.toLowerCase();
                            return (
                              r.item_name.toLowerCase().includes(q) ||
                              r.sku.toLowerCase().includes(q) ||
                              r.operator_name.toLowerCase().includes(q) ||
                              r.transaction_type.toLowerCase().includes(q)
                            );
                          });

                          const start = (page - 1) * PAGE_SIZE;
                          const paginated = allRows.slice(start, start + PAGE_SIZE);

                          if (paginated.length === 0) {
                            return (
                              <tr>
                                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: c.textFaint }}>
                                  No transaction records match the filter.
                                </td>
                              </tr>
                            );
                          }

                          return paginated.map((r: any) => (
                            <tr key={r.transaction_id} style={{ borderTop: `1px solid ${c.border}` }}>
                              <td style={{ padding: "9px 12px", color: c.textFaint, fontSize: 11.5 }}>
                                {new Date(r.transaction_date).toLocaleString()}
                              </td>
                              <td style={{ padding: "9px 12px" }}>
                                <div style={{ fontWeight: 600, color: c.text }}>{r.item_name}</div>
                                <div style={{ fontSize: 11, color: c.textMuted, fontFamily: "monospace" }}>{r.sku}</div>
                              </td>
                              <td style={{ padding: "9px 12px", color: c.textMuted }}>{r.transaction_type}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>{r.quantity}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", color: c.textMuted }}>${Number(r.unit_price).toFixed(2)}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: c.text }}>${Number(r.total_amount).toFixed(2)}</td>
                              <td style={{ padding: "9px 12px" }}>
                                <span style={{ color: "#2563EB", fontWeight: 600 }}>@{r.operator_name}</span>
                              </td>
                              <td style={{ padding: "9px 12px", color: c.textMuted, fontSize: 11.5 }}>
                                {r.reason || r.note || "—"}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* 5. STOCK MOVEMENT & VELOCITY (ABC) REPORT VIEW                */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "STOCK_MOVEMENT" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Tracked Items</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
                      {reportData.total_tracked_items}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Active SKU movement tracked</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Fast-Moving (Class A)</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#2E7D32", marginTop: 4 }}>
                      {reportData.fast_moving_count}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>High inventory velocity & sales</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Steady-Moving (Class B)</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#2563EB", marginTop: 4 }}>
                      {reportData.steady_moving_count}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Consistent baseline consumption</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Slow / Non-Moving (Class C)</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#EA580C", marginTop: 4 }}>
                      {(reportData.slow_moving_count || 0) + (reportData.non_moving_count || 0)}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Risk of dead stock accumulation</div>
                  </div>
                </div>

                <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: c.text }}>Inventory Velocity & Turnover Ledger</span>
                    <input
                      value={tableSearch}
                      onChange={(e) => {
                        setTableSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Filter items..."
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: `1px solid ${c.border}`,
                        background: c.inputBg,
                        color: c.text,
                        fontSize: 12,
                        maxWidth: 220,
                      }}
                    />
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: c.surfaceMuted, color: c.textFaint, textAlign: "left" }}>
                          <th style={{ padding: "8px 12px" }}>Item Name & SKU</th>
                          <th style={{ padding: "8px 12px" }}>Category</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Opening Stock</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Inflow (+)</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Outflow (-)</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Closing Stock</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Net Change</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Turnover Rate</th>
                          <th style={{ padding: "8px 12px" }}>Velocity Classification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const allRows = (reportData.items || []).filter((r: any) => {
                            if (!tableSearch) return true;
                            const q = tableSearch.toLowerCase();
                            return (
                              r.item_name.toLowerCase().includes(q) ||
                              r.sku.toLowerCase().includes(q) ||
                              r.category_name.toLowerCase().includes(q)
                            );
                          });

                          const start = (page - 1) * PAGE_SIZE;
                          const paginated = allRows.slice(start, start + PAGE_SIZE);

                          return paginated.map((item: any) => {
                            const isFast = item.velocity_tier.startsWith("Fast");
                            const isSteady = item.velocity_tier.startsWith("Steady");
                            return (
                              <tr key={item.item_id} style={{ borderTop: `1px solid ${c.border}` }}>
                                <td style={{ padding: "9px 12px" }}>
                                  <div style={{ fontWeight: 600, color: c.text }}>{item.item_name}</div>
                                  <div style={{ fontSize: 11, color: c.textMuted, fontFamily: "monospace" }}>{item.sku}</div>
                                </td>
                                <td style={{ padding: "9px 12px", color: c.textMuted }}>{item.category_name}</td>
                                <td style={{ padding: "9px 12px", textAlign: "right", color: c.textMuted }}>{item.opening_stock} {item.unit}</td>
                                <td style={{ padding: "9px 12px", textAlign: "right", color: "#2E7D32", fontWeight: 600 }}>+{item.total_inflow}</td>
                                <td style={{ padding: "9px 12px", textAlign: "right", color: "#DC2626", fontWeight: 600 }}>-{item.total_outflow}</td>
                                <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>{item.closing_stock} {item.unit}</td>
                                <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: item.net_change >= 0 ? "#2E7D32" : "#DC2626" }}>
                                  {item.net_change >= 0 ? `+${item.net_change}` : item.net_change}
                                </td>
                                <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>{item.turnover_rate}%</td>
                                <td style={{ padding: "9px 12px" }}>
                                  <span
                                    style={{
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      color: isFast ? "#2E7D32" : isSteady ? "#2563EB" : "#B45309",
                                      background: isFast ? "#DCFCE7" : isSteady ? "#DBEAFE" : "#FEF3C7",
                                      padding: "2px 8px",
                                      borderRadius: 5,
                                    }}
                                  >
                                    {item.velocity_tier}
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* 6. SUPPLIER PERFORMANCE & SPEND REPORT VIEW                   */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeTab === "SUPPLIER" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Active Suppliers</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
                      {reportData.active_suppliers}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Out of {reportData.total_suppliers} total suppliers</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Period Purchase Spend</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text, marginTop: 4 }}>
                      ${Number(reportData.total_purchase_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Total procurement disbursements</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Completed Purchase Orders</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#2E7D32", marginTop: 4 }}>
                      {reportData.completed_orders_count}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Fully fulfilled and received</div>
                  </div>

                  <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>Pending Purchase Orders</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#EA580C", marginTop: 4 }}>
                      {reportData.pending_orders_count}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>Awaiting fulfillment / delivery</div>
                  </div>
                </div>

                <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: c.text }}>Supplier Fulfillment & Spend Scorecard</span>
                    <input
                      value={tableSearch}
                      onChange={(e) => {
                        setTableSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Filter suppliers..."
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: `1px solid ${c.border}`,
                        background: c.inputBg,
                        color: c.text,
                        fontSize: 12,
                        maxWidth: 220,
                      }}
                    />
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: c.surfaceMuted, color: c.textFaint, textAlign: "left" }}>
                          <th style={{ padding: "8px 12px" }}>Supplier Name</th>
                          <th style={{ padding: "8px 12px" }}>Contact Person</th>
                          <th style={{ padding: "8px 12px" }}>Phone</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Sourced Items</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Total Spend</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Completed POs</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Pending POs</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Fulfillment Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const allRows = (reportData.suppliers || []).filter((s: any) => {
                            if (!tableSearch) return true;
                            const q = tableSearch.toLowerCase();
                            return (
                              s.supplier_name.toLowerCase().includes(q) ||
                              s.contact_person.toLowerCase().includes(q) ||
                              s.phone.toLowerCase().includes(q)
                            );
                          });

                          const start = (page - 1) * PAGE_SIZE;
                          const paginated = allRows.slice(start, start + PAGE_SIZE);

                          return paginated.map((sup: any) => (
                            <tr key={sup.supplier_id} style={{ borderTop: `1px solid ${c.border}` }}>
                              <td style={{ padding: "9px 12px", fontWeight: 600, color: c.text }}>
                                {sup.supplier_name}
                              </td>
                              <td style={{ padding: "9px 12px", color: c.textMuted }}>{sup.contact_person}</td>
                              <td style={{ padding: "9px 12px", color: c.textMuted, fontFamily: "monospace" }}>{sup.phone}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600 }}>{sup.total_items_supplied}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: c.text }}>
                                ${Number(sup.total_purchase_spend).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: "9px 12px", textAlign: "right", color: "#2E7D32", fontWeight: 600 }}>{sup.completed_pos}</td>
                              <td style={{ padding: "9px 12px", textAlign: "right", color: sup.pending_pos > 0 ? "#EA580C" : c.textMuted, fontWeight: 500 }}>
                                {sup.pending_pos}
                              </td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: sup.fulfillment_rate >= 80 ? "#2E7D32" : c.text }}>
                                {sup.fulfillment_rate}%
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
