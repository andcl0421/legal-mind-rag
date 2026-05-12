@echo off
cd /d %~dp0\Frontend

if not exist ".\package.json" (
  echo [ERROR] Frontend package.json not found.
  pause
  exit /b 1
)

echo [INFO] Starting frontend dev server...
npm run dev
