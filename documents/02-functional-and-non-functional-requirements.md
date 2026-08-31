# StockSphere: Functional & Non-Functional Requirements Specification

**Document Version:** 1.0.0  
**Project:** StockSphere Enterprise Inventory & Operations Management Platform  
**Target Audience:** System Architects, Developers, QA Engineers, Enterprise Auditors  

---

## 1. Specification Overview

This document specifies the complete set of Functional Requirements (FR) and Non-Functional Requirements (NFR) governing the **StockSphere** platform. All requirements are derived directly from the verified source code, API schemas, database entities, business workflows, and security models.

---

## 2. Requirement Numbering Convention

| Domain Identifier | Functional Area |
| :--- | :--- |
| `FR-AUTH` | Authentication, Session Restoration & Password Recovery |
| `FR-USR` | User Account & Role Administration |
| `FR-ITM` | Items, Master Measurement Units & Categories |
| `FR-SUP` | Supplier Directory & Many-to-Many Sourcing Relationships |
| `FR-PO` | Purchase Order Management & Procurement Lifecycle |
| `FR-BTC` | Stock Batch Lots, Cost Pricing & Expiry Tracking |
| `FR-TX` | Inventory Movement Ledgers & 7 Transaction Workflows |
| `FR-ALT` | Stock Health Monitoring & Automated Replenishment Alerts |
| `FR-REP` | Enterprise Analytical Reporting & Persistence |
| `FR-AUD` | Audit Logging & Compliance Governance |
| `NFR-xxx` | Non-Functional Quality, Security, and Architectural Attributes |

---

## 3. Functional Requirements (FR)

### 3.1 Authentication, Session & Security (`FR-AUTH`)

#### `FR-AUTH-01`: User Login & Credential Verification
- **Actor:** All System Roles (`ADMIN`, `INVENTORY_MANAGER`, `SALES`, `AUDITOR`)
- **Preconditions:** User exists in `users` table, is marked `is_active = True`, and provides matching email/username and password.
- **Main Behavior:** User submits credentials to `POST /auth/login`. System verifies password hash using Passlib/Bcrypt.
- **Expected Result:** On success, returns JSON payload containing user metadata, a cryptographically signed JWT `access_token` (lifetime 15–60 mins), and sets an `HttpOnly`, `SameSite=Lax`, `Secure` cookie containing `refresh_token` (lifetime 7 days).

#### `FR-AUTH-02`: Silent Session Restoration & Token Refresh
- **Actor:** Authenticated Client Application
- **Preconditions:** Client holds a valid `refresh_token` cookie or valid refresh payload.
- **Main Behavior:** Client calls `POST /auth/refresh-token`. Backend validates token signature, checks user active status, and issues a fresh JWT access token.
- **Expected Result:** Seamless user session renewal without requiring re-entry of credentials or workflow interruption.

#### `FR-AUTH-03`: Secure User Logout
- **Actor:** Authenticated User
- **Preconditions:** User is logged in.
- **Main Behavior:** Client triggers `POST /auth/logout`. Backend clears the `refresh_token` cookie and expires the server-side session context.
- **Expected Result:** Client state is purged, local access tokens are removed from memory, and user is redirected to the `/login` route.

#### `FR-AUTH-04`: Password Recovery Request (Forgot Password)
- **Actor:** Any Registered User
- **Preconditions:** User account exists with a verified email address.
- **Main Behavior:** User enters email address at `/forgot-password` triggering `POST /auth/forgot-password`. Backend generates a cryptographically random, time-limited reset token linked to the user account.
- **Expected Result:** Token is generated, expiration timestamp is stored, and recovery instructions/link are generated.

#### `FR-AUTH-05`: Password Reset Execution
- **Actor:** User with Valid Reset Token
- **Preconditions:** Reset token has not expired and has not been previously consumed.
- **Main Behavior:** User navigates to `/reset-password?token=...` and submits new password meeting complexity criteria (minimum 8 characters, letters, numbers, and symbols). System invokes `POST /auth/reset-password`.
- **Expected Result:** New password is hashed using bcrypt, stored in `users.hashed_password`, and reset token is invalidated.

#### `FR-AUTH-06`: Role-Based Route Authorization
- **Actor:** FastAPI Dependency Middleware (`RoleChecker`)
- **Preconditions:** Request carries an `Authorization: Bearer <token>` header.
- **Main Behavior:** Middleware decodes JWT payload, validates signature, extracts `role` and `user_id`, and verifies whether the user's role is in the endpoint's allowed roles list.
- **Expected Result:** Allowed requests proceed; unauthorized requests immediately return HTTP `403 Forbidden` with a structured error payload.

#### `FR-AUTH-07`: User Profile Management
- **Actor:** Authenticated User
- **Preconditions:** Valid access token.
- **Main Behavior:** User views and updates full name, phone number, and password via `GET /users/me` and `PATCH /users/me`.
- **Expected Result:** Profile changes persist to database with immediate update in frontend session context.

---

### 3.2 User & Role Administration (`FR-USR`)

#### `FR-USR-01`: User Directory Listing
- **Actor:** `ADMIN`
- **Preconditions:** Administrator authentication.
- **Main Behavior:** Administrator queries `GET /users/` with optional search parameters for name, username, email, NIC, and role filters.
- **Expected Result:** Returns array of user objects including ID, username, full name, role, NIC, phone number, active status, and creation date.

#### `FR-USR-02`: Create New System User
- **Actor:** `ADMIN`
- **Preconditions:** Administrator supplies unique username, valid email, Sri Lankan NIC (9 digits + V/X or 12 digits), 10-digit phone (`0XXXXXXXXX`), and password.
- **Main Behavior:** System executes `POST /users/`, hashes password, and creates record in `users` table with specified role.
- **Expected Result:** New user account created and immediately capable of logging in.

#### `FR-USR-03`: Update User Account Details & Role
- **Actor:** `ADMIN`
- **Preconditions:** Target user ID exists.
- **Main Behavior:** Administrator modifies role, full name, phone, or active status via `PATCH /users/{user_id}`.
- **Expected Result:** User attributes updated; role adjustments take effect on next token generation.

#### `FR-USR-04`: Toggle User Active/Inactive Status
- **Actor:** `ADMIN`
- **Preconditions:** Target user is not the primary super-admin account.
- **Main Behavior:** Administrator toggles `is_active` boolean via `PATCH /users/{user_id}`.
- **Expected Result:** Inactive users are immediately blocked from logging in or refreshing tokens (HTTP `403 Account Disabled`).

#### `FR-USR-05`: Single & Batch User Deletion
- **Actor:** `ADMIN`
- **Preconditions:** Administrator confirms action in confirmation modal.
- **Main Behavior:** Administrator deletes single user (`DELETE /users/{id}`) or selects multiple user checkboxes and triggers batch deletion.
- **Expected Result:** Target user records removed or deactivated without violating foreign key dependencies.

---

### 3.3 Product, Category & Unit Management (`FR-ITM`)

#### `FR-ITM-01`: Inventory Item Master Catalog
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`, `SALES`, `AUDITOR`
- **Preconditions:** Valid authenticated session.
- **Main Behavior:** Retrieves full item catalog via `GET /items/` with real-time stock levels, category relations, primary supplier data, cost price, selling price, and health status indicators.
- **Expected Result:** Complete list of SKUs with pagination, search, category filtering, and status pills.

#### `FR-ITM-02`: Create New Inventory Item
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Unique SKU, unique item name, valid category ID, valid unit symbol/ID, cost price $\ge 0$, selling price $> 0$, reorder level $\ge 0$, and default reorder quantity $\ge 0$.
- **Main Behavior:** System executes `POST /items/`, initializes `quantity_in_stock = 0`, and calculates health status.
- **Expected Result:** New item recorded in `items` table; visible across catalog and transaction pickers.

#### `FR-ITM-03`: Item Details & Batch Overview
- **Actor:** All Roles
- **Preconditions:** Item ID exists.
- **Main Behavior:** System navigates to `/dashboard/items?view={id}` or fetches `GET /items/{id}` and `GET /stock-batches/item/{id}`.
- **Expected Result:** Full-page view displaying SKU, stock count, valuation metrics, linked suppliers list with agreed prices, and active lot batches table (batch number, current qty, initial qty, expiry date, purchase cost, and selling price).

#### `FR-ITM-04`: Edit Item Master Data & Status Toggle
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Target item exists.
- **Main Behavior:** Updates item attributes (name, description, category, unit, cost price, selling price, reorder thresholds) and toggles `is_active` (`Active` vs. `Inactive`).
- **Expected Result:** Updated values saved via `PATCH /items/{id}`; inactive items are excluded from sales and purchase workflows.

#### `FR-ITM-05`: Measurement Unit Management
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Valid unit definition (unit name, symbol e.g., `kg`, `pcs`, `ltr`, `box`, decimal precision).
- **Main Behavior:** Master unit CRUD via `GET /units/`, `POST /units/`, `PATCH /units/{id}`, and `DELETE /units/{id}`.
- **Expected Result:** Units populate dropdown selectors across item creation, purchase ordering, and transaction recording.

#### `FR-ITM-06`: Category Master Management
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Unique category name.
- **Main Behavior:** Full CRUD via `GET /categories/`, `POST /categories/`, `PATCH /categories/{id}`, and `DELETE /categories/{id}`.
- **Expected Result:** Categories organize item catalogs and drive category-level valuation and margin reporting.

---

### 3.4 Supplier Directory & Sourcing Relationships (`FR-SUP`)

#### `FR-SUP-01`: Supplier Directory Management
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Valid supplier information (supplier name, contact person, 10-digit Sri Lankan phone, email, address, notes).
- **Main Behavior:** Full CRUD operations via `GET /suppliers/`, `POST /suppliers/`, `PATCH /suppliers/{id}`, and `DELETE /suppliers/{id}`.
- **Expected Result:** Suppliers available for purchase order assignment and item sourcing contracts.

#### `FR-SUP-02`: Many-to-Many Item-Supplier Linkage
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Valid `item_id` and `supplier_id`.
- **Main Behavior:** Links supplier to item via `POST /item-suppliers/` specifying agreed purchase price, supplier-specific SKU, and primary supplier designation.
- **Expected Result:** Creates record in `item_suppliers` junction table; multiple suppliers can supply one item at varying rates.

#### `FR-SUP-03`: Primary Supplier Designation
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Existing item-supplier relationship.
- **Main Behavior:** Sets `is_primary = True` for a chosen supplier link via `PATCH /item-suppliers/{link_id}`.
- **Expected Result:** Automatically unsets `is_primary` on all other suppliers for that item, ensuring a single primary sourcing partner per SKU.

#### `FR-SUP-04`: Negotiated Price & Supplier SKU Update
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Existing link in `item_suppliers`.
- **Main Behavior:** Adjusts `agreed_price` or `supplier_sku` via `PATCH /item-suppliers/{link_id}`.
- **Expected Result:** Updated price automatically pre-fills subsequent Purchase Orders generated for that supplier.

#### `FR-SUP-05`: Unlink Supplier from Item
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Existing relationship.
- **Main Behavior:** Removes link via `DELETE /item-suppliers/{link_id}`.
- **Expected Result:** Sourcing link removed without deleting the item or supplier master records.

---

### 3.5 Purchase Orders & Procurement Lifecycle (`FR-PO`)

#### `FR-PO-01`: Create Draft Purchase Order
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Selected supplier is active; at least one item is added with ordered quantity $> 0$ and unit cost $> 0$.
- **Main Behavior:** User builds multi-item PO in UI and posts to `POST /purchase-orders/`.
- **Expected Result:** PO created with status `Draft`, total cost calculated, and items recorded in `purchase_order_items`.

#### `FR-PO-02`: Submit Purchase Order for Approval
- **Actor:** `INVENTORY_MANAGER`
- **Preconditions:** PO is in `Draft` state.
- **Main Behavior:** Manager clicks "Submit for Approval" triggering `PATCH /purchase-orders/{id}/status` with `status: "Submitted"`.
- **Expected Result:** Status transitions to `Submitted`; PO becomes locked for editing by non-admin staff.

#### `FR-PO-03`: Approve / Reject Purchase Order
- **Actor:** `ADMIN`
- **Preconditions:** PO is in `Submitted` state.
- **Main Behavior:** Admin reviews PO line items and selects "Approve" (`Approved`) or "Cancel" (`Cancelled`).
- **Expected Result:** Approved POs become eligible for supplier ordering (`Ordered`) and warehouse receiving (`Received`).

#### `FR-PO-04`: Mark PO as Ordered
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** PO is in `Approved` state.
- **Main Behavior:** Transition status to `Ordered` when the purchase contract is dispatched to the supplier.
- **Expected Result:** Expected delivery tracking is active; PO is visible in warehouse receiving queue.

#### `FR-PO-05`: Warehouse Goods Receipt & Batch Generation
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** PO is in `Approved` or `Ordered` state.
- **Main Behavior:** Warehouse operator enters actual received quantities, assigns batch lot numbers, records expiry dates, and sets batch selling prices in the Receiving interface.
- **Expected Result:** System generates `stock_batches` records, creates `PURCHASE` inventory transaction records, increments `items.quantity_in_stock`, marks PO items received, and updates PO status to `Received` or `Completed`.

#### `FR-PO-06`: Purchase Order Cancellation
- **Actor:** `ADMIN`
- **Preconditions:** PO is in `Draft`, `Submitted`, or `Approved` state (prior to receipt).
- **Main Behavior:** Admin cancels PO with an audit note.
- **Expected Result:** PO status set to `Cancelled`; no inventory changes occur.

---

### 3.6 Stock Batches & Cost Tracking (`FR-BTC`)

#### `FR-BTC-01`: Automated Stock Batch Creation
- **Actor:** System / Receiving Operator
- **Preconditions:** Stock receipt via PO or direct purchase transaction.
- **Main Behavior:** System creates record in `stock_batches` containing `batch_number`, `initial_quantity`, `current_quantity`, `purchase_price`, `selling_price`, `expiry_date`, and supplier reference.
- **Expected Result:** Discrete stock lot established for precise inventory valuation and FIFO deduction.

#### `FR-BTC-02`: Batch Selling Price Override
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Active stock batch exists.
- **Main Behavior:** Sets custom selling price on a specific batch (e.g. promotional pricing or premium batch rate).
- **Expected Result:** Batch selling price overrides default item selling price when selected during customer sales.

#### `FR-BTC-03`: Batch Depletion & FIFO Tracking
- **Actor:** Transaction Engine
- **Preconditions:** Customer sale (`SOLD`) or outward movement is recorded.
- **Main Behavior:** System deducts quantity from the selected batch (`stock_batches.current_quantity -= qty`).
- **Expected Result:** Batch quantity tracks depletion; empty batches (`current_quantity = 0`) remain archived for audit history.

#### `FR-BTC-04`: Expiry Date Monitoring
- **Actor:** System / Warehouse Manager
- **Preconditions:** Batches recorded with `expiry_date`.
- **Main Behavior:** System surfaces upcoming and expired batches in item overviews and reports.
- **Expected Result:** Enables warehouse staff to prioritize near-expiry lots and write off spoiled goods via `EXPIRED` transactions.

---

### 3.7 Inventory Transactions & Stock Ledgers (`FR-TX`)

#### `FR-TX-01`: Dedicated Full-Page Transaction Workflow
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`, `SALES` (Sale only)
- **Preconditions:** Authenticated user navigates to `/dashboard/transactions` and initiates "Record Transaction".
- **Main Behavior:** Opens full-page recording screen featuring a 7-tab transaction type selector, item/batch selection, real-time stock impact previews, and justification notes.
- **Expected Result:** Seamless, distraction-free transaction recording replacing cramped modal overlays.

#### `FR-TX-02`: Customer Sale Transaction (`SOLD`)
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`, `SALES`
- **Preconditions:** Item is active; `quantity_in_stock >= requested_quantity`; valid batch selected.
- **Main Behavior:** System records `SOLD` transaction, decrements `items.quantity_in_stock`, decrements `stock_batches.current_quantity`, records unit price, and calculates sales revenue.
- **Expected Result:** Stock reduced; transaction ledger updated; sales metrics reflected on dashboard.

#### `FR-TX-03`: Goods Receipt Transaction (`PURCHASE`)
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Valid approved PO or supplier purchase details.
- **Main Behavior:** Records inbound stock movement, increments item stock, and creates batch lots.
- **Expected Result:** Stock increased; inventory asset valuation updated.

#### `FR-TX-04`: Customer Return Transaction (`CUSTOMER_RETURN`)
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`, `SALES`
- **Preconditions:** Reference sale transaction ID identified; return condition inspected.
- **Main Behavior:** System records `CUSTOMER_RETURN` transaction and restores quantity to item stock and original batch.
- **Expected Result:** Stock restored; return reason documented in audit trail.

#### `FR-TX-05`: Damaged & Expired Stock Write-Offs (`DAMAGED` / `EXPIRED`)
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Defective or expired batch identified; `batch.current_quantity >= write_off_quantity`.
- **Main Behavior:** Deducts quantity from stock and batch; records mandatory disposal reason.
- **Expected Result:** Stock written off from active inventory; financial cost loss recorded in reports.

#### `FR-TX-06`: Stock Variance Adjustments (`ADJUSTMENT_INCREASE` / `ADJUSTMENT_DECREASE`)
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`
- **Preconditions:** Physical warehouse count discrepancy identified; audit reason provided.
- **Main Behavior:** Adjusts inventory up or down to reconcile physical stock with system count.
- **Expected Result:** Stock corrected; audit trail maintains exact before/after variance with operator ID.

#### `FR-TX-07`: Transaction Audit Ledger & Search
- **Actor:** All System Roles
- **Preconditions:** Authenticated session.
- **Main Behavior:** Queries `GET /transaction/` with search by SKU, item name, reference ID, operator username, and type filters.
- **Expected Result:** Chronological ledger displaying timestamp, operator `@username`, item name, type badge, quantity, previous vs. new balance, and notes.

---

### 3.8 Stock Health Monitoring & Alerts (`FR-ALT`)

#### `FR-ALT-01`: Automated Stock Health Classification
- **Actor:** Background Logic / Data Engine
- **Preconditions:** Item stock updated via any transaction.
- **Main Behavior:** Evaluates `quantity_in_stock`:
  - `quantity_in_stock <= 0` $\rightarrow$ **`CRITICAL`** (Out of Stock)
  - `0 < quantity_in_stock <= reorder_level` $\rightarrow$ **`LOW_STOCK`**
  - `quantity_in_stock > reorder_level` $\rightarrow$ **`HEALTHY`**
- **Expected Result:** Immediate health indicator updates across item catalog and dashboard.

#### `FR-ALT-02`: Automated Alert Generation & De-duplication
- **Actor:** System Alert Manager
- **Preconditions:** Item transitions into `CRITICAL` or `LOW_STOCK` status.
- **Main Behavior:** Checks `stock_alerts` table for existing unresolved alert for that item; if none exists, creates a new alert record with alert level, current quantity, and threshold.
- **Expected Result:** Alert recorded without redundant duplicate rows.

#### `FR-ALT-03`: Automated Alert Resolution on Restock
- **Actor:** System Alert Manager
- **Preconditions:** Inbound stock transaction elevates `quantity_in_stock > reorder_level`.
- **Main Behavior:** System automatically updates existing active alerts for that item to `RESOLVED` and sets `resolved_at = NOW()`.
- **Expected Result:** Alert cleared; Mean Time to Resolve (MTTR) metric updated.

#### `FR-ALT-04`: Stock Health Dashboard & Restock Estimator
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`, `AUDITOR`
- **Preconditions:** Active alerts exist.
- **Main Behavior:** Displays active alerts list, calculates total restock capital required (`(reorder_quantity or (reorder_level * 2)) * cost_price`), and identifies primary supplier for one-click PO drafting.
- **Expected Result:** Actionable replenishment overview preventing extended stockouts.

---

### 3.9 Enterprise Reporting Engine (`FR-REP`)

#### `FR-REP-01`: 6 Standardized Enterprise Reports
- **Actor:** `ADMIN`, `INVENTORY_MANAGER`, `AUDITOR`
- **Preconditions:** Report type selected (`OVERALL_SUMMARY`, `LOW_STOCK`, `CATEGORY_WISE`, `TRANSACTION`, `STOCK_MOVEMENT`, `SUPPLIER`) with valid date range.
- **Main Behavior:** System queries transactional database, computes KPI summaries and detailed tabular ledgers, and displays chart-free ERP tables.
- **Expected Result:** Instant screen presentation of complete business metrics.

#### `FR-REP-02`: Database Persistence of Generated Reports
- **Actor:** Reporting Service
- **Preconditions:** Report generation requested.
- **Main Behavior:** System creates a persistent record in `reports` table storing `report_name`, `report_type`, `generated_by`, `generated_at`, `start_date`, `end_date`, and `file_format`.
- **Expected Result:** Report execution logged and reviewable in the "Report History" drawer.

#### `FR-REP-03`: Report History Drawer & Inspection
- **Actor:** All Authorized Roles
- **Preconditions:** Historical reports exist in database.
- **Main Behavior:** User opens History Drawer to browse previous reports, filter by type/date, and re-load complete data payloads.
- **Expected Result:** Instant recall of previously computed business reports.

#### `FR-REP-04`: Direct PDF Report Generation & Export
- **Actor:** User in Reports Screen
- **Preconditions:** Active report loaded on screen.
- **Main Behavior:** User clicks "Download PDF". Frontend utilizes `html2canvas` and `jsPDF` to compile a professional, multi-page branded PDF document with headers, KPIs, and tables.
- **Expected Result:** Downloadable PDF saved directly to client machine.

#### `FR-REP-05`: Direct CSV Data Export
- **Actor:** User in Reports Screen
- **Preconditions:** Active report loaded on screen.
- **Main Behavior:** User clicks "Export CSV". System formats tabular data into standard RFC 4180 CSV format.
- **Expected Result:** Downloadable CSV file generated for spreadsheet and external accounting software ingestion.

#### `FR-REP-06`: Flexible Report Naming
- **Actor:** User Generating Report
- **Preconditions:** User enters custom report title.
- **Main Behavior:** Backend schema accepts custom naming strings (letters, numbers, spaces, punctuation) without artificial regex restrictions.
- **Expected Result:** Customized report titles displayed on PDF exports and database history.

---

### 3.10 Audit Logging & Compliance (`FR-AUD`)

#### `FR-AUD-01`: System Action Recording
- **Actor:** Audit Interceptor / Backend Services
- **Preconditions:** User performs critical action (login, create user, modify item, approve PO, record transaction).
- **Main Behavior:** Records entry in `audit_logs` table containing `user_id`, `action`, `entity_type`, `entity_id`, `ip_address`, `details`, and timestamp.
- **Expected Result:** Immutable operational audit log created.

#### `FR-AUD-02`: Audit Log Inspection & Search
- **Actor:** `ADMIN`, `AUDITOR`
- **Preconditions:** Administrator or Auditor authentication.
- **Main Behavior:** Queries `GET /audit-logs/` with filtering by action type, user, date range, and search terms.
- **Expected Result:** Complete audit history reviewable in high-density compliance ledger.

---

## 4. Non-Functional Requirements (NFR)

| ID | Quality Attribute | Requirement Specification & Acceptance Criteria |
| :--- | :--- | :--- |
| **`NFR-001`** | **Performance** | API responses for single-entity CRUD operations shall complete in $< 100\text{ms}$ under normal load. Complex aggregate dashboard and report queries shall execute in $< 500\text{ms}$ over 50,000+ transaction records. |
| **`NFR-002`** | **Scalability** | Asynchronous non-blocking I/O architecture (FastAPI + AsyncPG/aiosqlite) supporting concurrent connections with connection pooling (`pool_size=20`, `max_overflow=10`). |
| **`NFR-003`** | **Security: Encryption & Hashing** | All passwords stored using bcrypt with adaptive salt rounds ($\ge 12$). All JWT access tokens signed using HMAC-SHA256 with 256-bit secret keys. Refresh tokens stored in `HttpOnly`, `SameSite=Lax` cookies. |
| **`NFR-004`** | **Security: Role-Based Access Control (RBAC)** | Strict endpoint protection using FastAPI dependencies. Unauthorized role access attempts must be rejected with HTTP `403 Forbidden` and logged. |
| **`NFR-005`** | **Data Integrity & ACID Compliance** | All multi-table stock movements (e.g., PO receiving, batch deduction, inventory updates) executed within atomic database transactions with automatic rollback on exception. Zero tolerance for negative stock. |
| **`NFR-006`** | **Auditability & Traceability** | Every inventory balance alteration, PO state transition, and user permission modification must be traceable to a specific `user_id`, timestamp, and client IP address. |
| **`NFR-007`** | **Maintainability & Clean Architecture** | Strict separation of concerns: Pydantic schemas (Validation), SQLAlchemy models (Entities), CRUD layer (Data Access), and Route controllers (HTTP Presentation). Zero business logic in presentation components. |
| **`NFR-008`** | **Usability & Aesthetic Excellence** | Professional, high-density minimal design system built on CSS variables, custom typography (Inter/Geist), glassmorphism accents, seamless dark/light mode toggling, and zero dependency on heavy external chart bloat. |
| **`NFR-009`** | **Accessibility & Responsive Layout** | Fully responsive layout adapting from mobile devices ($< 768\text{px}$) to wide desktop displays ($> 1440\text{px}$) with standard semantic HTML5 elements. |
| **`NFR-010`** | **Reliability & Error Handling** | Global exception handlers intercepting unhandled errors and returning RFC 7807 compliant JSON error structures (`detail`, `status_code`). Client application handles network interruptions gracefully with user feedback. |
| **`NFR-011`** | **Testability & Test Coverage** | Complete Pytest automated test suite covering authentication, role authorization, inventory math, PO state transitions, and reports. All test suites pass with 100% success rate prior to production build. |
| **`NFR-012`** | **Cross-Database Compatibility** | SQLAlchemy 2.0 Async ORM abstraction enabling frictionless operation across PostgreSQL (production) and SQLite (development/testing) without proprietary SQL syntax dependencies. |
