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
} from "recharts";
import { FileDown, Printer } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useTheme } from "../ThemeContext";
import { apiFetch } from "@/lib/api";

const REPORT_TYPES = [
  { id: "OVERALL_SUMMARY", label: "Overall Summary" },
  { id: "LOW_STOCK", label: "Stock Alert Report" },
  { id: "TRANSACTION", label: "Transaction Report" },
  { id: "STOCK_MOVEMENT", label: "Stock Velocity (ABC)" },
  { id: "CATEGORY_WISE", label: "Category Report" },
  { id: "SUPPLIER", label: "Supplier Report" },
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
    if (dateError) return;
    if (activeTab !== "OVERALL_SUMMARY" && activeTab !== "LOW_STOCK") return;

    setLoading(true);
    setError("");

    try {
      const nowStr = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, "");
      const tabLabel = activeTab === "OVERALL_SUMMARY" ? "OverallSummary" : "StockAlert";
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
    if (!dateError) {
      fetchReport();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, startDate, endDate, dateError]);

  // PDF Generation Handler using html2canvas & jsPDF
  const handleGeneratePDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPDF(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: c.bg || "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`StockSphere_Report_${activeTab}_${startDate}_to_${endDate}.pdf`);
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
        <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1 }}>
          {REPORT_TYPES.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: `1px solid ${isActive ? c.accent : "transparent"}`,
                  background: isActive ? c.accentSoft : "transparent",
                  color: isActive ? c.accent : c.textMuted,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Generate PDF Button */}
        {(activeTab === "OVERALL_SUMMARY" || activeTab === "LOW_STOCK") && (
          <button
            onClick={handleGeneratePDF}
            disabled={isGeneratingPDF || loading || !!dateError}
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

      {/* ── Tabs 3 - 6: Placeholder ── */}
      {activeTab !== "OVERALL_SUMMARY" && activeTab !== "LOW_STOCK" && (
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

      {/* ── Tabs 1 & 2: Dynamic API Report Content ── */}
      {(activeTab === "OVERALL_SUMMARY" || activeTab === "LOW_STOCK") && (
        <div ref={reportRef} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* ── Report Document Header ── */}
          <div
            style={{
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              padding: "20px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderLeft: `5px solid ${c.accent}`,
            }}
          >
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: c.text, margin: 0, letterSpacing: "-0.5px" }}>
                Homerex
              </h1>
              <div style={{ fontSize: 13, color: c.textMuted, marginTop: 4, fontWeight: 500 }}>
                Batticaloa, Sri Lanka
              </div>
              <div style={{ fontSize: 13, color: c.textMuted, marginTop: 2, fontWeight: 500 }}>
                077 777 7777
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.accent }}>
                {REPORT_TYPES.find((t) => t.id === activeTab)?.label || "Report"}
              </div>
              <div style={{ fontSize: 12, color: c.textFaint, marginTop: 4 }}>
                Period: {startDate} to {endDate}
              </div>
            </div>
          </div>

          {/* Date Picker Controls (Super Simple) */}
          <div
            style={{
              background: c.surface,
              border: `1px solid ${c.border}`,
              borderRadius: 14,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
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

            <div style={{ fontSize: 12, color: c.textFaint }}>
              The metrics and charts below are affected only by the selected date range.
            </div>
          </div>

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
          {activeTab === "OVERALL_SUMMARY" && reportData && !loading && !dateError && (
            <>
              {/* Summary Cards */}
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

              {/* Sell-Through Rate Card */}
              <div
                style={{
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 14,
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

              {/* Chart Visualization */}
              <div
                style={{
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 14,
                  padding: 20,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                  Monthly Inventory & Sales Trend
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
                        <Bar dataKey="inventory_value" name="Inventory Value (Rs)" fill={c.accent} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="sales_value" name="Sales Value (Rs)" fill={c.warn || "#e6a23c"} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 2. STOCK ALERT REPORT DATA VIEW */}
          {activeTab === "LOW_STOCK" && reportData && !loading && !dateError && (
            <>
              {/* Summary Cards */}
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

              {/* Additional Stock Metrics */}
              <div
                style={{
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 14,
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

              {/* Alert Trend Chart */}
              <div
                style={{
                  background: c.surface,
                  border: `1px solid ${c.border}`,
                  borderRadius: 14,
                  padding: 20,
                }}
              >
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
