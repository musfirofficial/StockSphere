from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from contextlib import asynccontextmanager
from app.database import create_db_and_tables, engine, async_session_maker
from app.init_admin import AdminService
from app.seed import seed_database

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


# Function for when server starts, it creates the database
@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Startup
    await create_db_and_tables()

    # Create default admin if not exists
    async with async_session_maker() as session:
        created = await AdminService.create_admin(session)
        if created == "created":
            print("[OK] Default admin created")
        elif created == "updated":
            print("[OK] Admin Reset Password")
        else:
            print("[OK] Admin already exists")

    await seed_database()
    yield
    # Shutdown
    await engine.dispose()
    # await Post.metadata.drop_all(bind=engine) #!DANGER! This will delete the entire database on shutdown, use with caution!


# 1. Disable the online docs routes by setting them to None
app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)

# CORS — allow the Next.js dev server to talk to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 2. Create a custom offline route for your docs
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        # Adding 'or ""' ensures Pylance always sees a string, fixing the error
        openapi_url=app.openapi_url or "",
        title=app.title + " - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url="/static/swagger-ui-bundle.js",
        swagger_css_url="/static/swagger-ui.css",
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
