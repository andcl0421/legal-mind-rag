@echo off
cd /d %~dp0

start "Legal-Mind Backend (8001)" cmd /k run_backend_8001.bat
start "Legal-Mind Frontend" cmd /k run_frontend.bat

echo [INFO] Started backend and frontend in separate windows.
