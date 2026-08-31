# StockSphere: Problem Analysis & Solution Architecture

**Document Version:** 1.0.0  
**Project:** StockSphere Enterprise Inventory & Operations Management Platform  
**Target Audience:** Technical Reviewers, Enterprise Stakeholders, Portfolio Evaluators, Engineering Onboarding  

---

## 1. Introduction

Modern commerce, wholesale distribution, and multi-channel retail operations demand strict synchronization between physical stock movements, procurement pipelines, supplier agreements, and financial valuations. **StockSphere** is an enterprise-grade inventory, procurement, and warehouse operations management platform designed to eliminate operational blind spots, prevent stockouts and dead stock, automate replenishment workflows, and enforce strict role-based audit governance.

This document articulates the industry problem space, analyzes existing supply chain pain points, details the proposed platform solution, defines functional scope, identifies key organizational stakeholders, and documents technical and business operational constraints.

---

## 2. Background & Industry Context

In traditional inventory management environments, organizations often rely on disparate spreadsheets, fragmented billing software, or antiquated desktop databases. As businesses scale their product catalogs into hundreds or thousands of SKUs across multiple suppliers and warehouses, these legacy approaches fail to maintain consistency.

Critical supply chain challenges arise:
- **Batch Non-Traceability:** Inability to track stock batches, lot numbers, purchase prices, and expiration dates leads to inaccurate gross margin calculations and spoilage of perishable goods.
- **Disconnected Procurement:** Purchase orders are negotiated and communicated over email or paper, leading to discrepancies between ordered quantities, agreed supplier rates, and warehouse receipts.
- **Supplier Volatility:** Lack of supplier performance tracking, primary/secondary supplier assignments, and negotiated item-level cost tracking leads to procurement overspending.
- **Stock Inconsistencies & Audit Deficits:** Disorganized stock adjustments and untracked write-offs obscure shrinkage, theft, and warehouse variances.

---

## 3. Problem Statement

Organizations operating without a centralized, transaction-backed inventory ledger suffer from four acute systemic failures:

1. **Stockout Disruption & Capital Over-Allocation:** Without automated health thresholds (Low Stock, Out of Stock), businesses either run out of high-demand items or tie up excessive working capital in slow-moving items.
2. **Untracked Cost Fluctuations:** Product unit costs change across shipments due to supplier price adjustments and inflation. Without lot-based batch tracking and FIFO (First-In, First-Out) cost deduction, profit margins and asset valuations are mathematically distorted.
3. **Operational Disconnect in Purchase Order Fulfillment:** Goods received at the loading dock often differ from purchase orders in quantity, expiration date, or unit cost, leading to invoice disputes and unrecorded surpluses/deficits.
4. **Lack of Operational Accountability:** Multiple operators (sales clerks, warehouse staff, store managers) manipulate stock without immutable audit logs or role-restricted permissions, creating vulnerability to internal shrinkage.

---

## 4. Existing Challenges & Operational Inefficiencies

| Operational Domain | Traditional / Manual Process | Inefficiency / Vulnerability |
| :--- | :--- | :--- |
| **Stock Tracking** | Spreadsheets or disconnected POS terminals | High human error, concurrency conflicts, negative stock errors, lack of historical ledgers. |
| **Procurement** | Ad-hoc phone calls and physical purchase notes | No formal status lifecycle (`Draft` → `Approved` → `Received`), unverified shipments. |
| **Supplier Agreements** | Static price lists in email threads | Missing primary vs. secondary supplier intelligence; inability to compare negotiated supplier rates. |
| **Stock Health Monitoring** | Periodic manual physical audits | Reactive discovery of stockouts after customer orders fail; undetected expiration of goods. |
| **Security & Access** | Shared accounts or unrestricted access | Inability to restrict junior staff from editing costs or approving POs; lack of user attribution. |
| **Business Reporting** | Manual month-end Excel compilation | Time-consuming data aggregation; delayed business intelligence; lack of audit exportability. |

---

## 5. Proposed Solution: StockSphere Platform

StockSphere provides a centralized, cloud-native web platform that automates the entire inventory and procurement lifecycle through a resilient, transaction-backed architecture.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           StockSphere Solution Core                         │
└─────────────────────────────────────────────────────────────────────────────┘
          │                                 │                               │
          ▼                                 ▼                               ▼
┌──────────────────┐             ┌─────────────────────┐         ┌─────────────────────┐
│ Multi-Role RBAC  │             │   Batch-Aware FIFO  │         │ Automated Workflow  │
│ & Audit Logging  │             │   Inventory Ledger  │         │ Engine & Analytics  │
├──────────────────┤             ├─────────────────────┤         ├─────────────────────┤
│ • Admin          │             │ • 7 Transaction Typ │         │ • Health Monitoring │
│ • Manager        │             │ • Lot & Expiry Date │         │ • PO Lifecycle      │
│ • Sales          │             │ • Primary Suppliers │         │ • 6 Business Reports│
│ • Auditor        │             │ • Unit & Categories │         │ • CSV / PDF Export  │
└──────────────────┘             └─────────────────────┘         └─────────────────────┘
```

### Core Solution Capabilities:
- **Transaction-Driven Stock Ledger:** All stock modifications are recorded as discrete, immutable transactions (`PURCHASE`, `SOLD`, `CUSTOMER_RETURN`, `DAMAGED`, `EXPIRED`, `ADJUSTMENT_INCREASE`, `ADJUSTMENT_DECREASE`) linked to operators, items, and batches.
- **Batch & Expiry Management:** Granular tracking of distinct stock lots with unique batch numbers, arrival timestamps, unit purchase costs, selling prices, and expiration dates.
- **Many-to-Many Supplier-Item Sourcing:** Flexible supplier catalog linking each item to multiple suppliers with negotiated purchase prices, supplier-specific SKUs, and designated primary supplier status.
- **Complete Purchase Order Lifecycle:** Controlled state machine governing procurement (`Draft` → `Submitted` → `Approved` → `Ordered` → `Received` → `Completed` / `Cancelled`) with itemized warehouse receiving workflows.
- **Automated Health & Replenishment Monitoring:** Real-time evaluation of stock levels against dynamic reorder thresholds, generating actionable alerts (`CRITICAL`, `LOW_STOCK`, `HEALTHY`) and calculating replenishment capital requirements.
- **Analytical Reporting Engine:** Chart-free, high-density enterprise ledger reports covering Overall Summary, Low Stock Replenishment, Category Margins, Transaction Audits, Stock Velocity (ABC Turnover Analysis), and Supplier Performance Scorecards.

---

## 6. Project Objectives

1. **Ensure Mathematical Inventory Integrity:** Prevent negative inventory states and guarantee that all stock changes correspond to verified operational events.
2. **Streamline Procurement Governance:** Enforce segregation of duties between PO creation (`Inventory Manager`) and PO approval/cancellation (`Admin`).
3. **Minimize Holding & Stockout Costs:** Provide automated stock alerts and actionable replenishment calculations.
4. **Deliver Complete Operational Traceability:** Record operator username, timestamp, and audit notes on all transactions, purchase receipts, and entity modifications.
5. **Optimize Sourcing Costs:** Enable dynamic supplier rate comparison and enforce preferred supplier rules during replenishment.
6. **Provide Immediate Decision-Ready Intelligence:** Generate instant PDF and CSV reports for executive, accounting, and warehouse management needs.

---

## 7. System Scope

### 7.1 In-Scope Functionality
- **Authentication & Security:** Secure JWT dual-token architecture (Access Token + HttpOnly Refresh Token), password recovery tokens, and role-based access control (RBAC).
- **User Management:** Full CRUD management of system users, role assignment (`ADMIN`, `INVENTORY_MANAGER`, `SALES`, `AUDITOR`), profile management, and account status toggling.
- **Master Data Management:** Comprehensive management of item catalogs, custom measurement units (symbol, precision, measurement type), and hierarchical categories.
- **Supplier & Sourcing Management:** Supplier directory, contact information, status, and many-to-many item sourcing relationships with agreed prices.
- **Purchase Order Engine:** Multi-item purchase order generation, status transitions, supplier linking, and warehouse receiving.
- **Stock Batch & Inventory Ledger:** Multi-type inventory transactions, lot number allocation, stock adjustments with audit justifications, and sales deductions.
- **Stock Alert Engine:** Automated alert generation, Mean Time to Resolve (MTTR) calculation, restock cost projections, and status resolution.
- **Reporting Engine:** 6 industry-standard reports with date range filtering, persistent report history in database, and direct PDF/CSV exports.
- **Audit Logging:** System-wide recording of critical actions with client IP, endpoint, and user attribution.

### 7.2 Out-of-Scope (Current Release)
- Direct hardware integration with physical POS thermal receipt printers and barcode laser scanners (supported via standard manual input and web UI).
- Real-time payment gateway processing for retail card transactions (in-scope handles inventory depletion and invoice records).
- Automated multi-currency exchange rate conversion (system standardizes on configured base fiat currency).
- Multi-warehouse cross-docking and inter-facility transit routing.

---

## 8. Target Users & Stakeholders

| Stakeholder Role | Responsibilities in StockSphere |
| :--- | :--- |
| **System Administrator (`ADMIN`)** | Full system control; user management; role provisioning; final approval/cancellation of Purchase Orders; system configuration; master data deletion. |
| **Inventory Manager (`INVENTORY_MANAGER`)** | Item catalog management; supplier relationship configuration; draft and submission of Purchase Orders; warehouse goods receipt and batch creation; stock reconciliation. |
| **Sales Representative (`SALES`)** | Recording customer sales transactions (`SOLD`); processing customer returns (`CUSTOMER_RETURN`); viewing available stock and retail pricing. |
| **Auditor (`AUDITOR`)** | Read-only compliance inspection; transaction ledger verification; audit log analysis; generation and export of financial and stock movement reports. |

---

## 9. Business & Operational Benefits

- **99.9% Stock Accuracy:** Elimination of unrecorded stock discrepancies through mandatory transaction attribution and lot assignment.
- **30% Reduction in Procurement Overhead:** Structured PO lifecycle eliminates manual paper trails and streamlines goods receiving.
- **Prevention of Spoilage & Expiry Losses:** Expiration date tracking enables First-Expired, First-Out (FEFO) warehouse rotation.
- **Optimized Supplier Spending:** Immediate visibility into negotiated supplier prices prevents overpaying during replenishment.
- **Audit Readiness:** Comprehensive historical transaction records and immutable audit logs ensure instant compliance verification.

---

## 10. Assumptions and Technical Constraints

### 10.1 Operational Assumptions
1. Authorized users access the application via modern standards-compliant web browsers (Chrome, Firefox, Safari, Edge).
2. Business operations operate in a localized single-currency environment with standardized metric/custom unit definitions.
3. Phone numbers for users and suppliers adhere to standard 10-digit formats (configured by default for Sri Lankan telecommunications format `0XXXXXXXXX`).

### 10.2 Technical Constraints
1. **Asynchronous Architecture:** Backend requires Python 3.11+ with ASGI asynchronous execution (FastAPI, Uvicorn, SQLAlchemy AsyncIO).
2. **Database Engine:** Database must support ACID transactions and relational foreign key constraints (PostgreSQL in production; SQLite/aiosqlite for lightweight local deployment).
3. **Stateless Authentication:** API servers remain stateless through cryptographically signed JWT access tokens with server-verified refresh tokens.
