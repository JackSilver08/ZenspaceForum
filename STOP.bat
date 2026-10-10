@echo off
setlocal
cd /d "%~dp0"
title ZenSpace - Stop Docker
where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Chua tim thay Docker.
  pause
  exit /b 1
)
docker compose down
if errorlevel 1 pause
