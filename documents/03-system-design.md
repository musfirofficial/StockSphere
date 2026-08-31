# StockSphere: Comprehensive System Design & Architecture Specification

**Document Version:** 1.0.0  
**Project:** StockSphere Enterprise Inventory & Operations Management Platform  
**Target Audience:** Lead Architects, Senior Engineers, Technical Evaluators, DevOps Teams

---

## 1. Executive Architecture Summary

StockSphere is architected as a modern, decoupled, asynchronous client-server platform designed for high-concurrency inventory operations, real-time procurement governance, and multi-role auditability.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               StockSphere Platform                           │
└──────────────────────────────────────────────────────────────────────────────┘
         │                                                            │
         ▼                                                            ▼
┌──────────────────────────────────┐        REST / JSON       ┌──────────────────────────────────┐
│        Frontend Layer            │ ◄──────────────────────► │         Backend Layer            │
│  • Next.js 16 (React 19 App)     │     JWT Auth (Bearer)    │  • FastAPI (Python 3.11+)        │
│  • Custom Design System (CSS)    │     HttpOnly Cookies     │  • Pydantic v2 Validation        │
│  • Theme & DataContext State     │                          │  • SQLAlchemy 2.0 Async ORM      │
│  • Client-side PDF / CSV Engine  │                          │  • Passlib / Bcrypt Encryption   │
└──────────────────────────────────┘                          └──────────────────────────────────┘
                                                                               │
                                                                               ▼
                                                              ┌──────────────────────────────────┐
                                                              │         Database Layer           │
                                                              │  • PostgreSQL (AsyncPG Engine)   │
                                                              │  • SQLite (aiosqlite Dev/Test)   │
                                                              │  • ACID Multi-Table Transactions │
                                                              └──────────────────────────────────┘
```

---

## 2. System Architecture Diagram

```mermaid
graph TB
    subgraph Client_Tier ["Client Presentation Tier"]
        Browser["Modern Web Browser (Desktop / Mobile)"]
        subgraph NextJS_App ["Next.js 16 App Router"]
            AuthCtx["Auth Context (JWT In-Memory)"]
            DataCtx["DataContext (SWR Cache)"]
            ThemeCtx["ThemeContext (Theme Tokens)"]
            Pages["Dashboard Pages (Items, POs, Tx, Reports, Users)"]
        end
    end

    subgraph API_Tier ["Application & Business Logic Tier"]
        FastAPI_Server["FastAPI ASGI Server (Uvicorn)"]
        subgraph Middleware_Pipeline ["Security Middleware"]
            CORS["CORS Middleware"]
            AuthDep["JWT Bearer Authenticator"]
            RBACDep["RoleChecker (RBAC Enforcement)"]
        end
        subgraph Route_Controllers ["API V1 Route Controllers"]
            AuthRoute["/auth"]
            ItemRoute["/items, /categories, /units"]
            SupRoute["/suppliers, /item-suppliers"]
            PORoute["/purchase-orders"]
            BatchRoute["/stock-batches"]
            TxRoute["/transaction"]
            AlertRoute["/stock-alerts"]
            ReportRoute["/reports"]
            AuditRoute["/audit-logs"]
        end
        subgraph Services_Layer ["Core Engine & Business Services"]
            POEngine["PO State Machine & Receiving Engine"]
            TxEngine["Inventory Math & Negative Stock Prevention"]
            AlertEngine["Stock Health & MTTR Calculator"]
            ReportEngine["Financial Valuation & Velocity Engine"]
        end
    end

    subgraph Data_Tier ["Persistence & Storage Tier"]
        AsyncEngine["SQLAlchemy 2.0 AsyncIO Engine"]
        Database[("Relational Database (PostgreSQL / SQLite)")]
    end

    Browser --> Pages
    Pages -->|"HTTP REST API (JSON)"| FastAPI_Server
    FastAPI_Server --> Middleware_Pipeline
    Middleware_Pipeline --> Route_Controllers
    Route_Controllers --> Services_Layer
    Services_Layer --> AsyncEngine
    AsyncEngine --> Database

```

---

## 3. Entity-Relationship (ER) Diagram

The StockSphere database comprises 13 interconnected relational entities enforcing foreign key constraints, composite unique indexes, and audit timestamps.

```mermaid
erDiagram
    USERS ||--o{ PURCHASE_ORDERS : "creates"
    USERS ||--o{ TRANSACTIONS : "operates"
    USERS ||--o{ AUDIT_LOGS : "triggers"
    USERS ||--o{ REPORTS : "generates"

    CATEGORIES ||--o{ ITEMS : "classifies"
    UNITS ||--o{ ITEMS : "measures"

    ITEMS ||--o{ ITEM_SUPPLIERS : "sourced_via"
    SUPPLIERS ||--o{ ITEM_SUPPLIERS : "supplies"

    SUPPLIERS ||--o{ PURCHASE_ORDERS : "receives"
    PURCHASE_ORDERS ||--o{ PURCHASE_ORDER_ITEMS : "contains"
    ITEMS ||--o{ PURCHASE_ORDER_ITEMS : "ordered_in"

    ITEMS ||--o{ STOCK_BATCHES : "tracked_in"
    SUPPLIERS ||--o{ STOCK_BATCHES : "delivers"

    ITEMS ||--o{ TRANSACTIONS : "moved_in"
    STOCK_BATCHES ||--o{ TRANSACTIONS : "deducted_from"
    SUPPLIERS ||--o{ TRANSACTIONS : "associated_with"

    ITEMS ||--o{ STOCK_ALERTS : "triggers"

    USERS {
        uuid user_id PK
        string user_name UK
        string email UK
        string full_name
        string role
        string nic
        string phone
        string hashed_password
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    CATEGORIES {
        uuid category_id PK
        string category_name UK
        string description
        datetime created_at
        datetime updated_at
    }

    UNITS {
        uuid unit_id PK
        string unit_name
        string unit_symbol UK
        int decimal_precision
        datetime created_at
        datetime updated_at
    }

    ITEMS {
        uuid item_id PK
        string sku UK
        string item_name UK
        string description
        uuid category_id FK
        uuid unit_id FK
        string unit
        decimal cost_price
        decimal selling_price
        int quantity_in_stock
        int reorder_level
        int reorder_quantity
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    SUPPLIERS {
        uuid supplier_id PK
        string supplier_name UK
        string contact_person
        string phone
        string email UK
        string address
        string notes
        string status
        datetime created_at
        datetime updated_at
    }

    ITEM_SUPPLIERS {
        uuid id PK
        uuid item_id FK
        uuid supplier_id FK
        decimal agreed_price
        string supplier_sku
        boolean is_primary
        datetime created_at
        datetime updated_at
    }

    PURCHASE_ORDERS {
        uuid po_id PK
        uuid supplier_id FK
        string status
        string po_type
        decimal total_cost
        string notes
        uuid created_by FK
        datetime created_at
        datetime updated_at
    }

    PURCHASE_ORDER_ITEMS {
        uuid poi_id PK
        uuid po_id FK
        uuid item_id FK
        int quantity
        decimal unit_cost
        int quantity_received
        datetime created_at
        datetime updated_at
    }

    STOCK_BATCHES {
        uuid batch_id PK
        uuid item_id FK
        uuid supplier_id FK
        string batch_number UK
        int initial_quantity
        int current_quantity
        decimal purchase_price
        decimal selling_price
        datetime arrival_date
        datetime expiry_date
        datetime created_at
        datetime updated_at
    }

    TRANSACTIONS {
        uuid transaction_id PK
        uuid item_id FK
        uuid user_id FK
        uuid supplier_id FK
        uuid batch_id FK
        uuid po_id FK
        uuid reference_transaction_id FK
        string transaction_type
        int quantity
        int previous_quantity
        int new_quantity
        decimal unit_price
        string reason
        string note
        datetime transaction_date
    }

    STOCK_ALERTS {
        uuid alert_id PK
        uuid item_id FK
        string alert_level
        int current_quantity
        int threshold_quantity
        string status
        datetime created_at
        datetime resolved_at
    }

    AUDIT_LOGS {
        uuid log_id PK
        uuid user_id FK
        string action
        string entity_type
        string entity_id
        string ip_address
        string details
        datetime created_at
    }

    REPORTS {
        uuid report_id PK
        string report_name
        string report_type
        uuid generated_by FK
        datetime generated_at
        datetime start_date
        datetime end_date
        string file_format
    }
```

---

## 4. Use Case Diagram

```mermaid
graph LR
    subgraph Actors ["System Actors"]
        Admin["System Administrator"]
        Manager["Inventory Manager"]
        Sales["Sales Representative"]
        Auditor["Compliance Auditor"]
    end

    subgraph Authentication_Module ["Authentication and Profile"]
        UC_Login["Login and Silent Session Refresh"]
        UC_Profile["Manage User Profile"]
        UC_PWRecover["Password Recovery"]
    end

    subgraph User_Module ["User Administration"]
        UC_UserCRUD["Manage Users and Roles"]
        UC_UserBatch["Batch Delete Users"]
    end

    subgraph Master_Data_Module ["Catalog and Sourcing"]
        UC_ItemCRUD["Manage Item Catalog"]
        UC_CategoryCRUD["Manage Categories and Units"]
        UC_SupCRUD["Manage Suppliers Directory"]
        UC_SupLink["Link Many-to-Many Sourcing"]
    end

    subgraph Procurement_Module ["Purchase Orders"]
        UC_POCreate["Create Draft PO"]
        UC_POSubmit["Submit PO for Approval"]
        UC_POApprove["Approve or Cancel PO"]
        UC_POReceive["Receive Goods and Create Batches"]
    end

    subgraph Inventory_Module ["Transactions and Stock"]
        UC_TxSale["Record Customer Sale"]
        UC_TxReturn["Process Customer Return"]
        UC_TxAdjust["Stock Adjustments and Write-Offs"]
        UC_TxAudit["View Transaction Ledgers"]
    end

    subgraph Alerts_Reports_Module ["Monitoring and Business Intelligence"]
        UC_Alerts["View Alerts and Restock Capital"]
        UC_Reports["Generate 6 Enterprise Reports"]
        UC_Export["Export PDF and CSV Ledgers"]
        UC_AuditLogs["Inspect Audit Logs"]
    end

    Admin --> UC_Login
    Admin --> UC_UserCRUD
    Admin --> UC_UserBatch
    Admin --> UC_ItemCRUD
    Admin --> UC_CategoryCRUD
    Admin --> UC_SupCRUD
    Admin --> UC_SupLink
    Admin --> UC_POApprove
    Admin --> UC_POReceive
    Admin --> UC_TxAdjust
    Admin --> UC_TxAudit
    Admin --> UC_Alerts
    Admin --> UC_Reports
    Admin --> UC_Export
    Admin --> UC_AuditLogs

    Manager --> UC_Login
    Manager --> UC_ItemCRUD
    Manager --> UC_CategoryCRUD
    Manager --> UC_SupCRUD
    Manager --> UC_SupLink
    Manager --> UC_POCreate
    Manager --> UC_POSubmit
    Manager --> UC_POReceive
    Manager --> UC_TxAdjust
    Manager --> UC_TxAudit
    Manager --> UC_Alerts
    Manager --> UC_Reports
    Manager --> UC_Export

    Sales --> UC_Login
    Sales --> UC_Profile
    Sales --> UC_TxSale
    Sales --> UC_TxReturn
    Sales --> UC_TxAudit

    Auditor --> UC_Login
    Auditor --> UC_Profile
    Auditor --> UC_TxAudit
    Auditor --> UC_Alerts
    Auditor --> UC_Reports
    Auditor --> UC_Export
    Auditor --> UC_AuditLogs
```

---

## 5. Sequence Diagrams

### 5.1 Login, Credential Verification & Dual-Token Issuance

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant AuthRoute as FastAPI /auth/login
    participant AuthCRUD as User Data Access
    participant Crypt as Passlib / Bcrypt
    participant JWTEngine as JWT Manager
    participant DB as Relational DB

    User->>AuthRoute: POST /auth/login with credentials
    AuthRoute->>AuthCRUD: get_user_by_username(username)
    AuthCRUD->>DB: Query user by username
    DB-->>AuthCRUD: User record with password hash
    AuthCRUD-->>AuthRoute: User entity

    AuthRoute->>Crypt: verify_password(password, hashed_password)
    Crypt-->>AuthRoute: True (Password Valid)

    AuthRoute->>JWTEngine: create_access_token(user_id, role)
    JWTEngine-->>AuthRoute: access_token_jwt

    AuthRoute->>JWTEngine: create_refresh_token(user_id)
    JWTEngine-->>AuthRoute: refresh_token_jwt

    AuthRoute-->>User: HTTP 200 OK with Refresh Cookie and Access Token
```

---

### 5.2 Silent Authentication & Session Restoration

```mermaid
sequenceDiagram
    autonumber
    actor App as Next.js Client
    participant AuthDep as API Interceptor
    participant RefreshRoute as FastAPI /auth/refresh-token
    participant JWTEngine as JWT Validator
    participant DB as Relational DB

    App->>AuthDep: App initialization or API returns 401 Unauthorized
    AuthDep->>RefreshRoute: POST /auth/refresh-token with HttpOnly Cookie
    RefreshRoute->>JWTEngine: decode_token(refresh_token)
    JWTEngine-->>RefreshRoute: token payload with user_id

    RefreshRoute->>DB: Query active user by user_id
    DB-->>RefreshRoute: Active User record

    RefreshRoute->>JWTEngine: create_access_token(user_id, role)
    JWTEngine-->>RefreshRoute: fresh_access_token

    RefreshRoute-->>AuthDep: HTTP 200 OK with fresh_access_token
    AuthDep->>App: In-memory token renewed and retry original query

```

---

### 5.3 Purchase Order Goods Receipt & Batch Generation

```mermaid
sequenceDiagram
    autonumber
    actor Mgr as Inventory Manager
    participant TxPage as Frontend Transactions Page
    participant TxRoute as FastAPI /transaction/
    participant TxCRUD as Transaction CRUD Service
    participant DB as Relational DB
    participant AlertSvc as Stock Alert Manager

    Mgr->>TxPage: Selects Approved PO and enters received quantities with batch lots
    TxPage->>TxRoute: POST /transaction/batch-receive with po_id and received items

    TxRoute->>TxCRUD: execute_po_receipt_transaction(session, po_id, items)
    activate TxCRUD
    TxCRUD->>DB: BEGIN TRANSACTION

    loop For each received item
        TxCRUD->>DB: Insert stock_batches record
        TxCRUD->>DB: Increment items.quantity_in_stock
        TxCRUD->>DB: Insert PURCHASE transaction record
        TxCRUD->>DB: Increment purchase_order_items.quantity_received
    end

    TxCRUD->>DB: Update purchase_orders status to Received
    TxCRUD->>AlertSvc: evaluate_and_resolve_alerts(session, item_ids)
    AlertSvc->>DB: Update active stock_alerts to RESOLVED

    TxCRUD->>DB: COMMIT TRANSACTION
    deactivate TxCRUD

    TxRoute-->>TxPage: HTTP 201 Created with batch confirmation
    TxPage-->>Mgr: Display success banner and updated stock levels
```

---

### 5.4 Customer Sale (`SOLD`) with FIFO Batch Deduction

```mermaid
sequenceDiagram
    autonumber
    actor Sales as Sales Representative
    participant TxPage as Transactions Screen
    participant TxRoute as FastAPI /transaction/
    participant TxCRUD as Transaction Engine
    participant DB as Relational DB

    Sales->>TxPage: Selects Item, Batch Lot and enters quantity
    TxPage->>TxRoute: POST /transaction/ with item_id, batch_id, SOLD, quantity

    TxRoute->>TxCRUD: record_sale_transaction(session, payload, user_id)
    activate TxCRUD
    TxCRUD->>DB: BEGIN TRANSACTION
    TxCRUD->>DB: Query item stock for update

    alt Insufficient stock in inventory
        TxCRUD->>DB: ROLLBACK
        TxCRUD-->>TxRoute: Return HTTP 400 Insufficient Stock
        TxRoute-->>TxPage: HTTP 400 Bad Request
    else Stock sufficient
        TxCRUD->>DB: Deduct quantity from stock_batches
        TxCRUD->>DB: Decrement items.quantity_in_stock
        TxCRUD->>DB: Insert SOLD record in transactions table
        TxCRUD->>DB: COMMIT TRANSACTION
        deactivate TxCRUD
        TxRoute-->>TxPage: HTTP 201 Created with updated quantity
        TxPage-->>Sales: Stock impact confirmed and sale recorded
    end
```

---

## 6. Activity & Workflow State Machines

### 6.1 Purchase Order Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Draft : Inventory Manager drafts PO
    Draft --> Submitted : Manager submits for review
    Draft --> Cancelled : Manager discards draft

    Submitted --> Approved : Administrator reviews and approves
    Submitted --> Cancelled : Administrator rejects PO

    Approved --> Ordered : Purchase order sent to supplier
    Approved --> Cancelled : Procurement cancelled

    Ordered --> Received : Warehouse receives goods and creates batches
    Received --> Completed : All quantities verified and settled
    Received --> Cancelled : Undelivered balance cancelled

    Completed --> [*]
    Cancelled --> [*]
```

---

### 6.2 Stock Movement & Integrity Validation Flow

```mermaid
flowchart TD
    Start([User Initiates Transaction]) --> ValidateAuth{Is User Authorized for Transaction Type?}
    ValidateAuth -- No --> ErrAuth[HTTP 403 Forbidden]
    ValidateAuth -- Yes --> CheckType{Transaction Type}

    CheckType -- Outward Movement --> CheckStock{Is Item Active and Stock Sufficient?}
    CheckStock -- No --> ErrStock[HTTP 400 Insufficient Stock]
    CheckStock -- Yes --> DeductBatch[Deduct Quantity from Stock Batch]
    DeductBatch --> DecrementStock[Decrement items.quantity_in_stock]

    CheckType -- Inward Movement --> IncrementStock[Increment items.quantity_in_stock]
    IncrementStock --> CreateOrRestoreBatch[Create New Batch or Restore Existing Batch]

    DecrementStock --> RecordTx[Insert Immutable Record in transactions Table]
    CreateOrRestoreBatch --> RecordTx

    RecordTx --> CheckHealth{Evaluate New Stock Level}
    CheckHealth -- Stock <= 0 --> CreateCritAlert[Generate CRITICAL Stock Alert]
    CheckHealth -- Stock <= ReorderLevel --> CreateLowAlert[Generate LOW_STOCK Alert]
    CheckHealth -- Stock > ReorderLevel --> ResolveAlerts[Auto-Resolve Existing Active Alerts]

    CreateCritAlert --> CommitDB[(Commit ACID Transaction)]
    CreateLowAlert --> CommitDB
    ResolveAlerts --> CommitDB

    CommitDB --> Success([Return Success Payload and Update UI State])
```

---

## 7. Component & Module Interaction

```mermaid
graph TD
    subgraph Frontend_App ["Next.js Client Application"]
        UI_Components["Reusable Design System (Table, Modal, Button, Field, Card)"]
        DataContext_State["DataContext (SWR Caching, Global Invalidation, Mutation)"]
        Theme_Tokens["ThemeContext (Minimal Dark / Light Tokens)"]
        PDF_Engine["Client PDF & CSV Compiler (html2canvas / jsPDF)"]
    end

    subgraph Backend_App ["FastAPI Core Application"]
        Router_Module["FastAPI APIRouter Modules (/v1/*)"]
        Validation_Schemas["Pydantic v2 Models & Sanitizers"]
        CRUD_Services["Asynchronous SQLAlchemy Data Services"]
        Security_Module["JWT Dual-Token & Passlib Encryption"]
    end

    subgraph Database_Module ["Data Storage"]
        PostgreSQL_DB[("PostgreSQL Production / SQLite Local")]
    end

    UI_Components --> DataContext_State
    DataContext_State --> Theme_Tokens
    DataContext_State -->|"JSON API Calls"| Router_Module
    Router_Module --> Security_Module
    Router_Module --> Validation_Schemas
    Validation_Schemas --> CRUD_Services
    CRUD_Services --> Database_Module
    DataContext_State --> PDF_Engine
```

---

## 8. Database Design Considerations

### 8.1 Foreign Key Referential Integrity

All relational links are strictly enforced with SQL constraints:

- `items.category_id` $\rightarrow$ `categories.category_id` (`ON DELETE RESTRICT`)
- `items.unit_id` $\rightarrow$ `units.unit_id` (`ON DELETE SET NULL`)
- `item_suppliers.item_id` $\rightarrow$ `items.item_id` (`ON DELETE CASCADE`)
- `item_suppliers.supplier_id` $\rightarrow$ `suppliers.supplier_id` (`ON DELETE CASCADE`)
- `purchase_order_items.po_id` $\rightarrow$ `purchase_orders.po_id` (`ON DELETE CASCADE`)
- `transactions.item_id` $\rightarrow$ `items.item_id` (`ON DELETE RESTRICT`)
- `transactions.user_id` $\rightarrow$ `users.user_id` (`ON DELETE RESTRICT`)

### 8.2 Database Indexing Strategy

To guarantee fast lookups and high transaction throughput across 100,000+ rows:

1. **Primary Key Clustered B-Trees:** Standard on all UUID PK columns.
2. **Unique Composite Indexes:**
   - `users(user_name)` & `users(email)`
   - `items(sku)` & `items(item_name)`
   - `suppliers(supplier_name)` & `suppliers(email)`
   - `stock_batches(batch_number)`
3. **Foreign Key Search Indexes:**
   - `transactions(item_id, transaction_date)`
   - `transactions(user_id, transaction_date)`
   - `stock_batches(item_id, current_quantity)`
   - `purchase_orders(supplier_id, status)`
   - `stock_alerts(item_id, status)`
