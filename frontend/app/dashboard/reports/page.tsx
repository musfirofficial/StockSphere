"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { FileDown, Printer } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useTheme } from "../ThemeContext";
import { apiFetch } from "@/lib/api";

const REPORT_TYPES = [
  { id: "OVERALL_SUMMARY", label: "Overall Summary", isEnabled: true },
  { id: "LOW_STOCK", label: "Stock Alert Report", isEnabled: true },
  { id: "CATEGORY_WISE", label: "Category Report", isEnabled: true },
  { id: "TRANSACTION", label: "Transaction Report", isEnabled: false },
  { id: "STOCK_MOVEMENT", label: "Stock Velocity (ABC)", isEnabled: false },
  { id: "SUPPLIER", label: "Supplier Report", isEnabled: false },
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

  // API Data State
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);

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

  // Fetch Report Data from POST /reports/
  const fetchReport = async () => {
    const isCategory = activeTab === "CATEGORY_WISE";
    if (!isCategory && dateError) return;
    if (
      activeTab !== "OVERALL_SUMMARY" &&
      activeTab !== "LOW_STOCK" &&
      activeTab !== "CATEGORY_WISE"
    )
      return;

    setLoading(true);
    setError("");

    try {
      const nowStr = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, "");
      const tabLabel =
        activeTab === "OVERALL_SUMMARY"
          ? "OverallSummary"
          : activeTab === "LOW_STOCK"
            ? "StockAlert"
            : "CategoryReport";
      const reportName = `${tabLabel}${nowStr.slice(0, 14)}`;

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

      if (res && res.data) {
        setReportData(res.data);
      } else {
        setReportData(null);
      }
    } catch (err: any) {
      console.error("Failed to fetch report:", err);
      setError(err.message || "Failed to load report data from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, startDate, endDate]);

  // PDF Generation Handler using html2canvas & jsPDF
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

      // ── Simple Text Header (PDF Only) ──
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(20, 20, 20);
      pdf.text("Homerex", margin, 16);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Batticaloa, Sri Lanka  |  077 777 7777", margin, 22);

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
          ? "Overall Inventory Snapshot"
          : `Period: ${startDate} to ${endDate}`;
      pdf.text(periodText, pageWidth - margin, 22, { align: "right" });

      // Horizontal Divider
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.4);
      pdf.line(margin, 26, pageWidth - margin, 26);

      // ── Content Image Placement ──
      const startY = 30;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = (canvas.height * contentWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", margin, startY, contentWidth, contentHeight);

      // ── Footer ──
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        "Homerex Inventory Management System — Page 1 of 1",
        pageWidth / 2,
        pageHeight - 6,
        { align: "center" }
      );

      const reportTitle = activeReportLabel.replace(/\s+/g, "_");
      pdf.save(`Homerex_${reportTitle}_${startDate}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ── Top Header Navigation & Generate PDF Button ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          borderBottom: `1px solid ${c.border}`,
          paddingBottom: 12,
        }}
      >
        {/* Dropdown Menu for Report Selection */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: c.textMuted }}>
            Report Type:
          </span>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${c.border}`,
              background: c.surface,
              color: c.text,
              fontSize: 13.5,
              fontWeight: 600,
              outline: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              minWidth: 220,
            }}
          >
            {REPORT_TYPES.map((t) => (
              <option
                key={t.id}
                value={t.id}
                disabled={!t.isEnabled}
                style={{
                  color: t.isEnabled ? c.text : c.textFaint,
                  background: c.surface,
                }}
              >
                {t.label} {!t.isEnabled ? "(Under Development)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Generate PDF Button */}
        {(activeTab === "OVERALL_SUMMARY" ||
          activeTab === "LOW_STOCK" ||
          activeTab === "CATEGORY_WISE") && (
            <button
              onClick={handleGeneratePDF}
              disabled={
                isGeneratingPDF ||
                loading ||
                (activeTab !== "CATEGORY_WISE" && !!dateError)
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: c.accent,
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: isGeneratingPDF || loading ? "default" : "pointer",
                opacity: isGeneratingPDF || loading ? 0.6 : 1,
                fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              <FileDown size={15} />
              {isGeneratingPDF ? "Generating PDF..." : "Generate PDF"}
            </button>
          )}
      </div>

      {/* ── Disabled / Under Development Placeholder ── */}
      {activeTab !== "OVERALL_SUMMARY" &&
        activeTab !== "LOW_STOCK" &&
        activeTab !== "CATEGORY_WISE" && (
          <div
            style={{
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              padding: "50px 20px",
              textAlign: "center",
              color: c.textMuted,
              fontSize: 14,
            }}
          >
            Under development
          </div>
        )}

      {/* ── Tabs 1, 2, 3: Dynamic API Report Content ── */}
      {(activeTab === "OVERALL_SUMMARY" ||
        activeTab === "LOW_STOCK" ||
        activeTab === "CATEGORY_WISE") && (
          <div ref={reportRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Loading / Error Indicators */}
            {loading && (
              <div style={{ textAlign: "center", padding: "30px 0", color: c.textMuted, fontSize: 13 }}>
                Loading report data...
              </div>
            )}

            {error && (
              <div style={{ padding: 14, borderRadius: 8, background: c.dangerSoft, color: c.danger, fontSize: 13 }}>
                {error}
              </div>
            )}

            {/* 1. OVERALL SUMMARY DATA VIEW */}
            {activeTab === "OVERALL_SUMMARY" && reportData && !loading && (
              <>
                {/* First: 3 Cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 18,
                    }}
                  >
                    <div style={{ fontSize: 12, color: c.textFaint, marginBottom: 6 }}>
                      Total Items in Stock
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text }}>
                      {reportData.total_items_in_stock ?? 0}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>
                      Active: {reportData.active_items_count ?? 0} ({reportData.active_items_percentage ?? 0}%)
                    </div>
                  </div>

                  <div
                    style={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 18,
                    }}
                  >
                    <div style={{ fontSize: 12, color: c.textFaint, marginBottom: 6 }}>
                      Inventory Cost Worth
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text }}>
                      Rs {Number(reportData.inventory_cost_worth ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>
                      Total cost evaluation
                    </div>
                  </div>

                  <div
                    style={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 18,
                    }}
                  >
                    <div style={{ fontSize: 12, color: c.textFaint, marginBottom: 6 }}>
                      Selling Worth
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text }}>
                      Rs {Number(reportData.selling_worth ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>
                      Total selling valuation
                    </div>
                  </div>
                </div>

                {/* Next: Container holding date picker, graph, and sell-through rate */}
                <div
                  style={{
                    background: c.surface,
                    border: `1px solid ${c.border}`,
                    borderRadius: 14,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  {/* Date Picker Controls */}
                  <div
                    data-html2canvas-ignore="true"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      borderBottom: `1px solid ${c.border}`,
                      paddingBottom: 16,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: c.textMuted, fontWeight: 500 }}>
                          Start Date:
                        </span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          style={{
                            padding: "7px 10px",
                            borderRadius: 8,
                            border: `1px solid ${c.border}`,
                            background: c.surfaceMuted,
                            color: c.text,
                            fontSize: 13,
                            outline: "none",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: c.textMuted, fontWeight: 500 }}>
                          End Date:
                        </span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{
                            padding: "7px 10px",
                            borderRadius: 8,
                            border: `1px solid ${c.border}`,
                            background: c.surfaceMuted,
                            color: c.text,
                            fontSize: 13,
                            outline: "none",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                    </div>

                    {dateError && (
                      <div
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: c.dangerSoft,
                          color: c.danger,
                          fontSize: 12.5,
                          fontWeight: 500,
                        }}
                      >
                        {dateError}
                      </div>
                    )}
                  </div>

                  {/* Graph Visualization */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                      Monthly Stock In & Out Trend
                    </div>

                    {(!reportData.chart_data || reportData.chart_data.length === 0) ? (
                      <div style={{ padding: "30px 0", textAlign: "center", color: c.textFaint, fontSize: 13 }}>
                        No chart data returned for this period.
                      </div>
                    ) : (
                      <div style={{ width: "100%", height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reportData.chart_data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={c.border} opacity={0.5} />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: c.textMuted }} />
                            <YAxis tick={{ fontSize: 11, fill: c.textMuted }} />
                            <Tooltip
                              contentStyle={{
                                background: c.surface,
                                borderColor: c.border,
                                borderRadius: 8,
                                fontSize: 12,
                                color: c.text,
                              }}
                            />
                            <Legend />
                            <Bar dataKey="inventory_value" name="Stock In Value (Rs)" fill={c.accent} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="sales_value" name="Stock Out Value (Rs)" fill={c.warn || "#e6a23c"} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Sell-Through Rate Card */}
                  <div
                    style={{
                      background: c.surfaceMuted,
                      border: `1px solid ${c.border}`,
                      borderRadius: 12,
                      padding: "16px 20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: c.textMuted }}>
                      Sell-Through Rate:
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: c.text }}>
                      {reportData.sell_through_rate ?? 0}%
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* 2. STOCK ALERT REPORT DATA VIEW */}
            {activeTab === "LOW_STOCK" && reportData && !loading && (
              <>
                {/* First: 3 Global Cards (Critical, Low Stock, Est Restock Cost) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 18,
                    }}
                  >
                    <div style={{ fontSize: 12, color: c.textFaint, marginBottom: 6 }}>
                      Global Critical Alerts
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.danger || c.text }}>
                      {reportData.global_critical_alerts ?? 0}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>
                      Out of stock items
                    </div>
                  </div>

                  <div
                    style={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 18,
                    }}
                  >
                    <div style={{ fontSize: 12, color: c.textFaint, marginBottom: 6 }}>
                      Global Low Stock Alerts
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.warn || c.text }}>
                      {reportData.global_low_stock_alerts ?? 0}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>
                      Below reorder threshold
                    </div>
                  </div>

                  <div
                    style={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 18,
                    }}
                  >
                    <div style={{ fontSize: 12, color: c.textFaint, marginBottom: 6 }}>
                      Est. Restock Cost
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: c.text }}>
                      Rs {Number(reportData.estimated_restock_cost ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 11.5, color: c.textMuted, marginTop: 4 }}>
                      Cost to reach reorder level
                    </div>
                  </div>
                </div>

                {/* Next: Container holding date picker, next card, and graph */}
                <div
                  style={{
                    background: c.surface,
                    border: `1px solid ${c.border}`,
                    borderRadius: 14,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  {/* Date Picker Controls */}
                  <div
                    data-html2canvas-ignore="true"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      borderBottom: `1px solid ${c.border}`,
                      paddingBottom: 16,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: c.textMuted, fontWeight: 500 }}>
                          Start Date:
                        </span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          style={{
                            padding: "7px 10px",
                            borderRadius: 8,
                            border: `1px solid ${c.border}`,
                            background: c.surfaceMuted,
                            color: c.text,
                            fontSize: 13,
                            outline: "none",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, color: c.textMuted, fontWeight: 500 }}>
                          End Date:
                        </span>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          style={{
                            padding: "7px 10px",
                            borderRadius: 8,
                            border: `1px solid ${c.border}`,
                            background: c.surfaceMuted,
                            color: c.text,
                            fontSize: 13,
                            outline: "none",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>
                    </div>

                    {dateError && (
                      <div
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: c.dangerSoft,
                          color: c.danger,
                          fontSize: 12.5,
                          fontWeight: 500,
                        }}
                      >
                        {dateError}
                      </div>
                    )}
                  </div>

                  {/* Next Card: Stock Metrics (Resolution Rate & MTTR) */}
                  <div
                    style={{
                      background: c.surfaceMuted,
                      border: `1px solid ${c.border}`,
                      borderRadius: 12,
                      padding: "16px 20px",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11.5, color: c.textFaint }}>Resolution Rate</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginTop: 2 }}>
                        {reportData.period_resolution_rate ?? 0}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: c.textFaint }}>Avg MTTR (Critical)</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginTop: 2 }}>
                        {reportData.avg_mttr_critical_hours ?? 0} hrs
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: c.textFaint }}>Avg MTTR (Low Stock)</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginTop: 2 }}>
                        {reportData.avg_mttr_low_stock_hours ?? 0} hrs
                      </div>
                    </div>
                  </div>

                  {/* Graph Visualization */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                      Stock Alert Trends
                    </div>

                    {(!reportData.chart_data || reportData.chart_data.length === 0) ? (
                      <div style={{ padding: "30px 0", textAlign: "center", color: c.textFaint, fontSize: 13 }}>
                        No chart data returned for this period.
                      </div>
                    ) : (
                      <div style={{ width: "100%", height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reportData.chart_data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={c.border} opacity={0.5} />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: c.textMuted }} />
                            <YAxis tick={{ fontSize: 11, fill: c.textMuted }} />
                            <Tooltip
                              contentStyle={{
                                background: c.surface,
                                borderColor: c.border,
                                borderRadius: 8,
                                fontSize: 12,
                                color: c.text,
                              }}
                            />
                            <Legend />
                            <Bar dataKey="critical_count" name="Critical Alerts" fill={c.danger || "#B3473C"} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="low_stock_count" name="Low Stock Alerts" fill={c.warn || "#e6a23c"} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 3. CATEGORY REPORT DATA VIEW */}
            {activeTab === "CATEGORY_WISE" && reportData && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Top Section: Side-by-side Bar & Pie Charts */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                    gap: 16,
                  }}
                >
                  {/* Chart 1: Contribution Margin by Category */}
                  <div
                    style={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 20,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>
                      Contribution Margin by Category
                    </div>
                    <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2, marginBottom: 16 }}>
                      Profit margin %
                    </div>

                    {(!reportData.categories || reportData.categories.length === 0) ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: c.textFaint, fontSize: 13 }}>
                        No category data available.
                      </div>
                    ) : (
                      <div style={{ width: "100%", height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            layout="vertical"
                            data={reportData.categories}
                            margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={c.border} horizontal={false} />
                            <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: c.textMuted }} />
                            <YAxis dataKey="category_name" type="category" tick={{ fontSize: 11, fill: c.textMuted }} width={90} />
                            <Tooltip
                              formatter={(value: any) => [`${value}%`, "Margin"]}
                              contentStyle={{
                                background: c.surface,
                                borderColor: c.border,
                                borderRadius: 8,
                                fontSize: 12,
                                color: c.text,
                              }}
                            />
                            <Bar dataKey="margin_percentage" radius={[0, 4, 4, 0]}>
                              {reportData.categories.map((entry: any, index: number) => {
                                const colors = [
                                  "#2d6a4f",
                                  "#52b788",
                                  "#b5838d",
                                  "#d90429",
                                  "#6c757d",
                                  "#a5a58d",
                                ];
                                return (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={colors[index % colors.length]}
                                  />
                                );
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Chart 2: Warehouse Space by Category */}
                  <div
                    style={{
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      borderRadius: 14,
                      padding: 20,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>
                      Warehouse Space by Category
                    </div>
                    <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2, marginBottom: 16 }}>
                      % of physical space occupied
                    </div>

                    {(!reportData.categories || reportData.categories.length === 0) ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: c.textFaint, fontSize: 13 }}>
                        No category data available.
                      </div>
                    ) : (
                      <div style={{ width: "100%", height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                            <Pie
                              data={reportData.categories}
                              dataKey="space_used_percentage"
                              nameKey="category_name"
                              cx="50%"
                              cy="42%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                              label={(entry: any) => `${entry.space_used_percentage}%`}
                            >
                              {reportData.categories.map((entry: any, index: number) => {
                                const colors = [
                                  "#2d6a4f",
                                  "#52b788",
                                  "#b5838d",
                                  "#d90429",
                                  "#6c757d",
                                  "#a5a58d",
                                ];
                                return (
                                  <Cell
                                    key={`pie-cell-${index}`}
                                    fill={colors[index % colors.length]}
                                  />
                                );
                              })}
                            </Pie>
                            <Tooltip
                              formatter={(value: any) => [`${value}%`, "Space Used"]}
                              contentStyle={{
                                background: c.surface,
                                borderColor: c.border,
                                borderRadius: 8,
                                fontSize: 12,
                                color: c.text,
                              }}
                            />
                            <Legend
                              verticalAlign="bottom"
                              align="center"
                              iconType="circle"
                              wrapperStyle={{
                                fontSize: 11,
                                color: c.textMuted,
                                paddingTop: 12,
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Section: Category Value Overview Table */}
                <div
                  style={{
                    background: c.surface,
                    border: `1px solid ${c.border}`,
                    borderRadius: 14,
                    padding: 20,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginBottom: 16 }}>
                    Category Value Overview
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr
                          style={{
                            borderBottom: `1px solid ${c.border}`,
                            color: c.textMuted,
                            fontSize: 12,
                            fontWeight: 600,
                            background: c.surfaceMuted,
                          }}
                        >
                          <th style={{ padding: "10px 14px" }}>Category</th>
                          <th style={{ padding: "10px 14px" }}>Stock Value</th>
                          <th style={{ padding: "10px 14px" }}>Margin %</th>
                          <th style={{ padding: "10px 14px" }}>Space Used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.categories && reportData.categories.length > 0 ? (
                          reportData.categories.map((cat: any, idx: number) => {
                            const colors = [
                              "#2d6a4f",
                              "#52b788",
                              "#b5838d",
                              "#d90429",
                              "#6c757d",
                              "#a5a58d",
                            ];
                            const color = colors[idx % colors.length];

                            return (
                              <tr
                                key={cat.category_id || idx}
                                style={{
                                  borderBottom: `1px solid ${c.border}`,
                                  fontSize: 13,
                                  color: c.text,
                                }}
                              >
                                <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      width: 10,
                                      height: 10,
                                      borderRadius: 2,
                                      background: color,
                                      marginRight: 8,
                                    }}
                                  />
                                  {cat.category_name}
                                </td>
                                <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                                  Rs {Number(cat.stock_value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: "12px 14px" }}>
                                  {cat.margin_percentage}%
                                </td>
                                <td style={{ padding: "12px 14px" }}>
                                  {cat.space_used_percentage}%
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              style={{ padding: "20px", textAlign: "center", color: c.textFaint, fontSize: 13 }}
                            >
                              No category overview metrics found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
