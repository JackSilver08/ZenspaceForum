@echo off
setlocal
cd /d "%~dp0"
title ZenSpace - Docker launcher

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Chua tim thay Docker. Hay cai Docker Desktop va mo no truoc.
  echo Tai ve: https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)

docker compose version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Docker Compose chua san sang. Hay cap nhat Docker Desktop.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo [INFO] Da tao .env tu cau hinh mac dinh.
  )
)

if not exist "data\uploads" mkdir "data\uploads"
if not exist "data\uploads\posts" mkdir "data\uploads\posts"

echo.
echo ==========================================
echo  ZenSpace - dang khoi dong moi truong Docker
echo ==========================================
echo  Website: http://localhost:8089
echo  API:     http://localhost:8089/hello
echo  MySQL:   localhost:3307
echo.

docker compose up --build -d
if errorlevel 1 goto startup_failed

echo.
echo [INFO] Dang doi backend ket noi database...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddMinutes(3); do { try { $r=Invoke-WebRequest -Uri 'http://localhost:8081/hello' -TimeoutSec 2 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } } catch { }; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 goto readiness_failed

start "" "http://localhost:8088"
echo.
echo [OK] ZenSpace da khoi dong. Dang hien thi log truc tiep.
echo [INFO] Nhan Ctrl+C de dung xem log. Container van chay nen dung STOP.bat hoac lenh: docker compose down.
echo.
docker compose logs -f --tail=100
exit /b %errorlevel%

:readiness_failed
echo.
echo [ERROR] Backend chua san sang sau 3 phut. Log gan nhat:
docker compose logs --tail=150
pause
exit /b 1

:startup_failed
echo.
echo [ERROR] Khong the khoi dong Docker Compose. Kiem tra Docker Desktop va cong 8088/8081/3307.
pause
exit /b 1
