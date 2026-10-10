@echo off
setlocal
cd /d "%~dp0"
title ZenSpace - Docker launcher

if not exist "scripts\Start-ZenSpace.ps1" (
  echo [ERROR] Missing scripts\Start-ZenSpace.ps1. Please pull the latest main branch.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-ZenSpace.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] ZenSpace did not start successfully. Read the message above.
  pause
)
exit /b %EXIT_CODE%
