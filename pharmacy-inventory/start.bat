@echo off
REM PharmaTrack Startup Script for Windows (Configured for All IP Addresses: 0.0.0.0)

echo Starting PharmaTrack Pharmacy Inventory System...

REM Check if MongoDB is running (Windows)
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo Warning: MongoDB doesn't appear to be running.
    echo Please start MongoDB before running this script.
    echo.
)

REM Start backend (bound to 0.0.0.0:5001)
echo Starting backend server on port 5001 (listening on 0.0.0.0)...
start "PharmaTrack Backend" cmd /k "node server.js"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend (bound to 0.0.0.0:3000)
echo Starting frontend on port 3000 (listening on 0.0.0.0)...
cd frontend
start "PharmaTrack Frontend" cmd /k "npm run dev"

echo.
echo =========================================
echo PharmaTrack is running on ALL IP addresses!
echo =========================================
echo Local Access:   http://localhost:3000
echo Network Access: Available on your LAN IP at port 3000 (run ipconfig to find your IP)
echo Backend API:    http://localhost:5001
echo API Health:     http://localhost:5001/api/health
echo.
echo Close the command windows to stop the servers
echo =========================================

cd ..