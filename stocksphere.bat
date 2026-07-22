@echo off
title Homerex System Startup
color 0A

echo ================================================
echo         HOMEREX INVENTORY MANAGEMENT
echo ================================================
echo.

:: ── STEP 1: Start PostgreSQL ──────────────────────
echo [1/3] Starting PostgreSQL...
net start postgresql-x64-18 >nul 2>&1

if %errorlevel% == 0 (
    echo       PostgreSQL started successfully
) else (
    echo       PostgreSQL already running or service name mismatch
)
echo.

:: ── STEP 2: Start FastAPI Backend ─────────────────
echo [2/3] Starting FastAPI Backend...
cd /d "C:\Musfir_Thahir\Studies\Projects\SS Homerex\backend"
start "Homerex Backend" cmd /k "uv run uvicorn app.app:app --host 127.0.0.1 --port 8000 --reload"
echo       Backend starting at http://localhost:8000
echo       API Docs at http://localhost:8000/docs
echo.

:: ── STEP 3: Start Next.js Frontend ────────────────
echo [3/3] Starting Next.js Frontend...
cd /d "C:\Musfir_Thahir\Studies\Projects\SS Homerex\frontend"
start "Homerex Frontend" cmd /k "npm start"
echo       Frontend starting at http://localhost:3000
echo.

:: ── Wait for servers to boot ──────────────────────
echo Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

:: ── Open browser ──────────────────────────────────
echo Opening Homerex in browser...
start http://localhost:3000
echo.

echo ================================================
echo   Homerex is running
echo   Frontend : http://localhost:3000
echo   Backend  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo ================================================
echo.
echo Press any key to EXIT this window
echo (Backend and Frontend will keep running)
pause >nul