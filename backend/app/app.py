from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import create_db_and_tables, engine, async_session_maker
from app.crud import unit as unit_crud

# Route imports
from app.routes.v1.user import router as user_router
from app.routes.auth import router as auth_router
from app.routes.v1.category import router as category_router
from app.routes.v1.supplier import router as supplier_router
from app.routes.v1.report import router as report_router
from app.routes.v1.item import router as item_router
from app.routes.v1.transaction import router as transaction_router
from app.routes.v1.purchaseorder import router as purchaseorder_router
from app.routes.v1.auditlog import router as auditlog_router
from app.routes.v1.dashboard import router as dashboard_router
from app.routes.v1.stockalert import router as stockalert_router
from app.routes.v1.unit import router as unit_router


# Function for when server starts, it creates the database and seeds defaults
@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup
    await create_db_and_tables()
    try:
        async with async_session_maker() as session:
            await unit_crud.seed_default_units(session)
    except Exception:
        pass
    yield
    # Shutdown
    await engine.dispose()


# Disable online docs routes
app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)

# CORS — allow the Next.js dev server to talk to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(category_router)
app.include_router(auth_router)
app.include_router(supplier_router)
app.include_router(report_router)
app.include_router(item_router)
app.include_router(transaction_router)
app.include_router(purchaseorder_router)
app.include_router(auditlog_router)
app.include_router(dashboard_router)
app.include_router(stockalert_router)
app.include_router(unit_router)
