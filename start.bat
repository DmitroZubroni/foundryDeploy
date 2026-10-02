@echo off
setlocal enabledelayedexpansion
title Start Protocol Full Stack

echo ===================================================
echo [1/4] Starting Local Geth Private Network...
echo ===================================================

cd /d "%~dp0"

:: Start Geth in a separate console window
start "Geth Private Node" cmd /k "geth --datadir "%~dp0network" --dev --http --http.addr 127.0.0.1 --http.port 8545 --http.corsdomain * --http.api eth,web3,net,personal,miner"

echo Waiting for Geth RPC to start on port 8545...
powershell -NoProfile -Command "$ready = $false; for ($i=0; $i -lt 30; $i++) { try { $tcp = New-Object Net.Sockets.TcpClient('127.0.0.1', 8545); if ($tcp.Connected) { $tcp.Close(); $ready = $true; break } } catch {} Start-Sleep -Seconds 1 }; if (-not $ready) { exit 1 }"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Geth failed to start on port 8545 within 30 seconds!
    pause
    exit /b 1
)
echo [OK] Geth node is running on http://127.0.0.1:8545

echo.
echo ===================================================
echo [2/4] Compiling and Deploying Contracts via Hardhat...
echo ===================================================

cd /d "%~dp0hardhat"

if not exist "node_modules\" (
    echo Installing Hardhat dependencies...
    call npm install
)

:: Clear previous deployment journal for chain-1337 if exists
if exist "ignition\deployments\chain-1337\" (
    echo Cleaning previous deployment journal...
    rd /s /q "ignition\deployments\chain-1337"
)

echo Deploying contracts and auto-syncing to frontend...
echo yes | call npx hardhat ignition deploy ignition/modules/Protocol.ts --network localhost

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Contract deployment failed!
    pause
    exit /b 1
)

echo.
echo ===================================================
echo [3/4] Verifying Frontend Sync...
echo ===================================================
call npx hardhat run scripts/sync-frontend.ts

echo.
echo ===================================================
echo [4/4] Starting Frontend Dev Server...
echo ===================================================

set FRONT_DIR=front
if not exist "%~dp0front\" if exist "%~dp0frontend\" set FRONT_DIR=frontend

cd /d "%~dp0%FRONT_DIR%"

if not exist "node_modules\" (
    echo Installing Frontend dependencies...
    call npm install
)

start "Frontend Dev Server" cmd /k "npm run dev"

:: Wait 3 seconds and open in default browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ===================================================
echo [SUCCESS] Everything is up and running!
echo - Geth:     http://127.0.0.1:8545
echo - Frontend: http://localhost:5173
echo ===================================================
pause
