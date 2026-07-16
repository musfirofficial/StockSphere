# StockSphere

A modern financial data application built with a decoupled architecture, utilizing a Next.js frontend and a FastAPI backend for Small and Medium Business (SMB).

---

## 🛠️ Prerequisites

Before getting started, make sure you have the following installed on your local machine:

- [Python 3.13+](https://www.python.org/)

- [uv](https://github.com/astral-sh/uv) (Fast Python package installer and manager)

- [Node.js (v18+) & npm](https://nodejs.org/)

- [PostgreSQL](https://www.postgresql.org/) (Running locally)

---

## 🚀 Getting Started

Follow these steps sequentially to clone, configure, and boot up the development environment.

### 1. Clone the Repository

```bash
git clone [https://github.com/musfirofficial/StockSphere.git](https://github.com/musfirofficial/StockSphere.git)

cd StockSphere
```

## 🐍 Backend Setup (FastAPI)

1. Navigate into the backend directory:

```Bash
cd backend
```

2. Install dependencies and set up the virtual environment automatically using uv

```Bash
uv sync
```

3. PostgreSQL Local Database Setup:

The backend relies on a local PostgreSQL database server. Follow these steps to provision it using your preferred SQL terminal, pgAdmin, or the `psql` command-line tool:

Step A: Connect to your Postgres Server instance.

Step B: Create the application user.

Run the following command to create a dedicated user account with a secure password (replace placeholders with your desired credentials):

```sql
CREATE USER <YOUR_DB_USER> WITH PASSWORD '<YOUR_DB_PASSWORD>';
```

Step C: Create the project database.

Generate the target database that maps directly to your application's `DATABASE_URL`:

```sql
CREATE DATABASE <YOUR_DB_NAME> OWNER <YOUR_DB_USER>;
```

Step D: Grant full administration privileges.

Ensure the new user has complete read/write access to manage schema migrations:

```sql
GRANT ALL PRIVILEGES ON DATABASE <YOUR_DB_NAME> TO <YOUR_DB_USER>;
```

_Once created, ensure the values you configured above match the `<YOUR_DB_USER>`, `<YOUR_DB_PASSWORD>`, and `<YOUR_DB_NAME>` fields in your backend `.env` file._

4. Create your local environment configuration file:

Create a file named .env inside the backend/ directory and add your local configuration details:

```Bash
# Database & Security
DATABASE_URL="postgresql+asyncpg://<server_name>:<password>@localhost:5432/stocksphere"
SECRET_KEY="09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7" #Change it for ensure seccurity
# System Path (This is where your generated reports will be saved)
REPORT_BASE_PATH="C:\Users\<your_pc>\Documents\Homerexreports" #Or any other location
# Initial Recovery Admin Credentials

# (Used to provision the system's absolute first administrator account)
ADMIN_FULLNAME="<Your Name>"
ADMIN_USERNAME="<Your User Name>"
ADMIN_PASSWORD="<Your Password>"
ADMIN_EMAIL="<Your Email>"
ADMIN_NIC="<Your NIC>" #Currenlty set to suppoert only Srilankan Format (can change it from app/schemas/users)
ADMIN_PHONE="<Your Phone>" #Currenlty set to suppoert only Srilankan Format (can change it from app/schemas/users)
```

4. Run the backend development server:

```Bash
uv run main.py
#or
uv run uvicorn app.main:app --reload
```

The backend API documentation will be available locally at: http://127.0.0.1:8000/docs

5. Running Tests:

To run the backend test suite with verbose reporting:

Run All Tests in the Project:
Executes every single test across all files with verbose layout visibility:

```bash
uv run pytest -v
```

Run a Specific Test File (Module):
Isolates and executes only the tests contained inside the user routes file:

```bash
uv run pytest app/tests/test_user_routes.py -v
```

Run a Single Specific Function:
Targets exactly one test case inside a file by filtering with a keyword (`-k`):

```bash
uv run pytest app/tests/test_user_routes.py -k "test_create_user_success" -v
```

## 🎨 Frontend Setup (Next.js)

1. Open a new terminal window, navigate to the root directory, and go into the frontend folder:

```Bash
cd frontend
```

2. Install the JavaScript dependencies:

```Bash
npm install
```

3. Create your local environment configuration file:

Create a file named `.env.local` inside the frontend/ directory and configure it to point to your local backend API server:

```Plaintext
NEXT_PUBLIC_API_URL=[http://127.0.0.1:8000](http://127.0.0.1:8000)
```

(Note: The `.env.local` file is safely ignored by Git and will never be pushed to version control.)

Run the frontend development server:

```Bash
npm run dev
```

The frontend application will be up and running at: http://localhost:3000

## 📂 Project Architecture Reference

```plaintext
StockSphere/               # Root Monorepo
├── backend/               # FastAPI Application
│   ├── app/               # Main application package
│   │   ├── main.py        # API Entrypoint
│   │   └── tests/         # Test suites
│   ├── .env               # Local Backend Secrets (Git Ignored)
│   └── pyproject.toml     # Python dependencies & configurations
├── frontend/              # Next.js Application
│   ├── src/               # React components and pages
│   ├── .env.local         # Local Frontend Variables (Git Ignored)
│   └── package.json       # JS dependencies & scripts
└── .gitignore             # Global repository filter
```
