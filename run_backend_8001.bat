@echo off
cd /d %~dp0

if not exist ".\.venv\Scripts\python.exe" (
  echo [ERROR] .venv Python not found. Please create your virtual environment first.
  pause
  exit /b 1
)

echo [INFO] Starting Legal-Mind backend on http://127.0.0.1:8001
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001

if errorlevel 1 (
  echo [ERROR] Backend stopped unexpectedly.
  pause
)
