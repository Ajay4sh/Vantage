@echo off
REM Starts the Vantage production server on http://localhost:3100.
REM Builds first only if there's no existing production build.
cd /d "C:\Users\Lenovo\Downloads\Screener\vantage"
if not exist "apps\web\.next\BUILD_ID" call npm run build
call npm run start
