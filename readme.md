# StockSphere

> **Enterprise Inventory, Procurement & Supply Chain Operations Platform**

StockSphere is a modern, transaction-backed inventory, procurement, and warehouse operations management platform designed to eliminate operational blind spots, automate replenishment workflows, prevent stockouts, and enforce strict role-based audit governance. Built with **Next.js 16 (React 19)** and **FastAPI (Python 3.11+)** with asynchronous **SQLAlchemy 2.0**, StockSphere delivers high-density enterprise data visibility, batch lot tracking, multi-tier supplier sourcing, and chart-free decision-ready reporting.


---

## 1. Quick Introduction

### What is StockSphere?

StockSphere is a centralized operations platform that synchronizes physical inventory movements with supplier agreements, procurement pipelines, and accounting valuations. Rather than serving as a basic CRUD tracker, the system operates on an immutable, transaction-driven ledger where all stock alterations are linked to operators, batches, and business events.

### What Problem Does It Solve?

- **Prevents Stockouts & Capital Over-allocation:** Replaces reactive audits with real-time health monitoring (`CRITICAL`, `LOW_STOCK`, `HEALTHY`) and automated replenishment calculations.
- **Ensures True FIFO Batch Valuation:** Granularly tracks stock lots with arrival dates, unit acquisition costs, custom selling prices, and expiration dates.
- **Governs Procurement Lifecycles:** Enforces separation of duties across purchase order creation, multi-level review, approval, and itemized goods receipt.
- **Guarantees Complete Accountability:** Immutably attributes all actions to authenticated users with timestamps, client IP addresses, and audit justification logs.

### Who Uses It?

- **System Administrators (`ADMIN`):** Manage user accounts, assign roles, configure master data, and grant final PO approvals.
- **Inventory Managers (`INVENTORY_MANAGER`):** Maintain product catalogs, manage supplier contracts, draft/submit POs, receive goods, and reconcile warehouse stock.
- **Sales Clerks (`SALES`):** Record customer sales (`SOLD`), process customer returns, and check real-time item availability.
- **Compliance Auditors (`AUDITOR`):** Inspect transaction ledgers, evaluate stock health MTTR, analyze audit trails, and export financial reports.

### High-Level Architecture

```
┌─────────────────────────┐          RESTful API / JSON          ┌─────────────────────────┐
│   Next.js 16 Client     │ ◄──────────────────────────────────► │     FastAPI Backend     │
│ (React 19, TypeScript)  │        JWT Bearer + HttpOnly         │   (Python 3.11, ASGI)   │
└─────────────────────────┘                                      └─────────────────────────┘
                                                                               │
                                                                               ▼
                                                                 ┌─────────────────────────┐
                                                                 │   Relational Database   │
                                                                 │ (PostgreSQL / SQLite)   │
                                                                 └─────────────────────────┘
```

---

## 2. Screenshot & Visual Overview

![alt text](image.png)

![StockSphere Dashboard Screenshot](docs/screenshot.png)

_The user interface employs a minimal, high-density design system built with CSS variables, fast responsive tables, and dedicated full-page transaction recording workflows._

---

## 3. Technology Stack

### Frontend

- **Framework:** [Next.js 16.3.0](https://nextjs.org/) (App Router, Server & Client Components)
- **Library:** [React 19.0.0](https://react.dev/)
- **Language:** TypeScript 5.x
- **Icons:** [Lucide React](https://lucide.dev/)
- **Styling:** Curated CSS Variable Tokens (Glassmorphic dark/light mode system)
- **Document Export:** `html2canvas` & `jsPDF` for client-side PDF rendering

### Backend

- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
- **Server:** [Uvicorn](https://www.uvicorn.org/) (High-performance ASGI server)
- **Data Validation:** [Pydantic v2](https://docs.pydantic.dev/)
- **ORM:** [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (AsyncIO engine & declarative models)
- **Security:** PyJWT, Passlib (Bcrypt hashing), HTTP-only Cookie Handler

### Database & Storage

- **Production Database:** [PostgreSQL](https://www.postgresql.org/) with `asyncpg` driver
- **Development / Local Database:** SQLite with `aiosqlite` async driver

### Testing & Tooling

- **Testing Engine:** [Pytest](https://docs.pytest.org/) & `pytest-asyncio`
- **Package Managers:** `uv` (Ultra-fast Python package manager) & `npm`

---

## 4. Prerequisites

Before installing and running StockSphere, ensure your environment meets the following requirements:

- **Node.js:** `v18.18.0` or higher (Node 20 LTS recommended)
- **Python:** `v3.11` or higher (Python 3.12/3.13 supported)
- **Python Package Manager:** `uv` (Recommended: `curl -LsSf https://astral.sh/uv/install.ps1 | iex` or `pip install uv`)
- **Database:** PostgreSQL 14+ (for production) or built-in SQLite (for local evaluation)

---

## 5. Installation & Setup

### 5.1 Development Setup (Quick Start)

#### 1. Clone Repository

```bash
git clone https://github.com/your-org/stocksphere.git
cd stocksphere
```

#### 2. Backend Setup

```bash
cd backend

# Create virtual environment and install dependencies via uv
uv sync

# Configure environment variables
# Copy or create .env file:
# DATABASE_URL="sqlite+aiosqlite:///./stocksphere.db"
# SECRET_KEY="your-secure-random-secret-key"

# Seed development database with 400 items, 120 suppliers, and realistic transactions
uv run python seed_data.py

# Start backend development server (with hot reload)
uv run python -m uvicorn app.app:app --host 127.0.0.1 --port 8000 --reload
```

_Backend will be running at `http://127.0.0.1:8000` (Interactive Swagger Docs at `http://127.0.0.1:8000/docs`)._

#### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```

_Frontend will be running at `http://localhost:3000`._

---

### 5.2 Production Setup

#### 1. Configure Production PostgreSQL Database

In `backend/.env`:

```env
DATABASE_URL="postgresql+asyncpg://db_user:db_password@localhost:5432/stocksphere"
SECRET_KEY="generate-a-strong-256-bit-secret-key"
```

#### 2. Build & Start Backend Workers

```bash
cd backend
uv sync --frozen
uv run python -m uvicorn app.app:app --host 0.0.0.0 --port 8000 --workers 4 --log-level info
```

#### 3. Build & Start Frontend Production Server

```bash
cd frontend
npm run build
npm start
```

---

## 6. Default Demo Credentials

The database seeder provisions pre-configured user accounts for all four system roles:

| Role                     | Username  | Password      | Access Privileges                                     |
| :----------------------- | :-------- | :------------ | :---------------------------------------------------- |
| **System Administrator** | `admin`   | `Admin@123`   | Full access, user CRUD, role management, PO approvals |
| **Inventory Manager**    | `manager` | `Manager@123` | Master items, suppliers, PO creation, goods receipt   |
| **Sales Clerk**          | `sales`   | `Sales@123`   | Customer sales recording, customer returns            |
| **Compliance Auditor**   | `auditor` | `Auditor@123` | Read-only ledgers, audit logs, 6 report generators    |

---

## 7. Testing

StockSphere includes an automated test suite verifying route authorization, role permissions, inventory mathematics, purchase order lifecycles, and user operations.

### 7.1 Run Complete Test Suite

```bash
cd backend
uv run python -m pytest
```

\*Result: **40 passed in ~1.00s\***

### 7.2 Run Specific Test Suites

```bash
# Test Purchase Order Lifecycle
uv run python -m pytest app/tests/test_po_lifecycle.py

# Test Transaction Execution & FIFO Math
uv run python -m pytest app/tests/test_transaction_routes.py

# Test Role-Based Access Control (RBAC) & User Management
uv run python -m pytest app/tests/test_user_routes.py

# Test Authentication & Password Recovery
uv run python -m pytest app/tests/test_auth_routes.py
```

### 7.3 Test Coverage Execution

```bash
uv run python -m pytest --cov=app --cov-report=term-missing
```

---

## 8. Database Seeding

The platform includes a database seeder ([backend/seed_data.py](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/backend/seed_data.py)) that populates realistic operational data:

- **4 System User Accounts** (`admin`, `manager`, `sales`, `auditor`)
- **10 Master Categories** & **10 Measurement Units**
- **400 Inventory Items** across electronics, consumables, and hardware
- **120 Sourcing Suppliers** with Sri Lankan addresses and contact numbers
- **Many-to-Many Sourcing Links** with negotiated prices and primary supplier flags
- **Stock Batches** with arrival dates, lot numbers, costs, and expiration dates
- **Purchase Orders** across all lifecycle states (`Draft`, `Submitted`, `Approved`, `Ordered`, `Received`)
- **1,200+ Realistic Transactions** across 7 movement types

### How to Run:

```bash
cd backend
uv run python seed_data.py
```

> [!WARNING]  
> **Data Reset Warning:** Running `seed_data.py` truncates and recreates the database tables to establish a clean, mathematically consistent baseline. Do not run this script against a live production database.

---

## 9. Folder Structure

```text
StockSphere/
├── backend/
│   ├── app/
│   │   ├── crud/              # Asynchronous database services (SQLAlchemy 2.0)
│   │   ├── routes/v1/         # RESTful API route controllers
│   │   ├── schemas/           # Pydantic v2 request/response schemas
│   │   ├── tests/             # Pytest automated test suite (40 test cases)
│   │   ├── app.py             # FastAPI application factory
│   │   ├── database.py        # Database engine & session configuration
│   │   └── models.py          # Relational database entities
│   ├── seed_data.py           # Enterprise database seeder
│   └── pyproject.toml         # Backend dependencies & metadata
├── frontend/
│   ├── app/
│   │   ├── dashboard/         # Next.js 16 dashboard routes & views
│   │   │   ├── items/         # Items catalog, batch & supplier view
│   │   │   ├── purchase_orders/# Purchase order lifecycle management
│   │   │   ├── reports/       # 6-type chart-free reports engine
│   │   │   ├── stock_alerts/  # Stock health monitoring & MTTR
│   │   │   ├── transactions/  # Dedicated full-page 7-tab transaction view
│   │   │   ├── users/         # User administration & role provisioning
│   │   │   ├── DataContext.tsx# Centralized SWR state & cache
│   │   │   └── ThemeContext.tsx# Color tokens & theme provider
│   │   ├── login/             # Authentication screen
│   │   └── layout.tsx         # Root application layout
│   └── lib/                   # API clients, roles, and types
├── document/                  # Comprehensive system documentation
│   ├── 01-problem-and-solution.md
│   ├── 02-functional-and-non-functional-requirements.md
│   ├── 03-system-design.md
│   ├── 04-business-logic.md
│   └── 05-implementation.md
├── prompt.md                  # Project evaluation specification
└── README.md                  # Main project documentation
```

---

## 10. Phone Number & NIC Formatting

### Phone Number Format

By default, user and supplier phone numbers are validated against the **Sri Lankan 10-digit telecommunications standard**:

- **Format:** Exactly 10 digits starting with `0` (e.g., `0771234567`, `0712345678`, `0112345678`).
- **Validation Regex:** `^0\d{9}$` (automatically strips leading/trailing spaces and hyphens).
- **Implementation Locations:**
  - [backend/app/schemas/user.py](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/backend/app/schemas/user.py) (Lines 35–39)
  - [backend/app/schemas/supplier.py](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/backend/app/schemas/supplier.py) (Lines 28–32)
  - [frontend/app/dashboard/users/page.tsx](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/frontend/app/dashboard/users/page.tsx) & [suppliers/page.tsx](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/frontend/app/dashboard/suppliers/page.tsx)

_To adapt the system for international phone numbers (e.g. E.164 `+14155552671`), update the regex validator in `user.py` and `supplier.py` to `^\+?[1-9]\d{1,14}$`._

### Sri Lankan NIC Format

User identity cards are validated against both old and new Sri Lankan formats:

- **Old Format:** 9 digits followed by `'V'` or `'X'` (e.g. `981234567V`).
- **New Format:** 12 digits (e.g. `199812345678`).
- **Validation Regex:** `^(\d{9}[VvXx]|\d{12})$` in [backend/app/schemas/user.py](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/backend/app/schemas/user.py).

---

## 11. Environment Variables

| Variable              | Scope    | Description                           | Example / Default                                                                                     |
| :-------------------- | :------- | :------------------------------------ | :---------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Backend  | Relational database connection string | `sqlite+aiosqlite:///./stocksphere.db`<br/>`postgresql+asyncpg://user:pwd@localhost:5432/stocksphere` |
| `SECRET_KEY`          | Backend  | Cryptographic secret for signing JWTs | `09d25e094faa6ca2556c818166b7a95...`                                                                  |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend API base URL                  | `http://127.0.0.1:8000/api/v1`                                                                        |

---

## 12. Security Architecture

1. **Password Hashing:** Passwords hashed using `bcrypt` via Passlib with automatic salt generation.
2. **Dual-Token JWT Authentication:** Short-lived access tokens (stored in memory) paired with long-lived refresh tokens in `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
3. **Role-Based Access Control (RBAC):** Every endpoint protected via FastAPI dependency injection (`RoleChecker`).
4. **SQL Injection Protection:** Complete ORM parameterization via SQLAlchemy 2.0; zero raw string interpolation.
5. **ACID Transaction Isolation:** Multi-table operations (such as receiving POs and creating stock batches) executed inside atomic transactions with automatic rollback on error.
6. **Immutable Audit Trails:** User ID, client IP, action, and timestamp logged to `audit_logs` for sensitive events.

---

## 13. Comprehensive Documentation

Detailed documentation is available in the `document/` folder:

1. [01-problem-and-solution.md](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/document/01-problem-and-solution.md): Business domain problem analysis, existing supply chain challenges, and proposed architecture.
2. [02-functional-and-non-functional-requirements.md](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/document/02-functional-and-non-functional-requirements.md): 35+ formal functional requirements (`FR-xxx`) and 12 non-functional quality attributes (`NFR-xxx`).
3. [03-system-design.md](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/document/03-system-design.md): System architecture, complete 13-entity ER diagram, use case diagrams, sequence diagrams, and state machines in Mermaid.
4. [04-business-logic.md](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/document/04-business-logic.md): Stock health math, 7-type transaction logic, PO state machine, and 6-report calculation formulas.
5. [05-implementation.md](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/document/05-implementation.md): Component architecture, traceability matrix, indexing strategy, and testing evidence.

---

## 14. Realistic Future Improvements

The following capabilities represent planned architectural enhancements for future releases:

- **Barcode & QR Scanner Hardware Integration:** Native support for Bluetooth/USB barcode scanners to streamline point-of-sale lookup.
- **Multi-Warehouse Cross-Docking:** Routing stock across multiple physical warehouse facilities and tracking inter-store transit.
- **Automated Reorder PO Dispatch:** Webhook integration with vendor EDI/API systems to trigger supplier purchase orders automatically when stock hits critical thresholds.
- **Advanced Automated Email Alerts:** SMTP notification dispatcher for low stock warnings and PO status updates.

---

## 15. License

This project is licensed under the MIT License — see the [LICENSE](file:///c:/Musfir_Thahir/Studies/Projects/StockSphere/LICENSE) file for details.
