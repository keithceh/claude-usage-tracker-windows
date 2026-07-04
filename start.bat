@echo off
setlocal
rem `pushd` handles UNC paths (\\server\share\...) by mapping them to a
rem temporary drive letter; `cd /d` does not.
pushd "%~dp0" || (echo [ERROR] Could not enter "%~dp0" & pause & exit /b 1)

rem If the dashboard server is already up (e.g. another start triggered),
rem just open the browser to it and exit instead of double-launching.
netstat -ano | findstr /R /C:":8765 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo Dashboard already running on http://127.0.0.1:8765/
  start "" "http://127.0.0.1:8765/dashboard.html"
  popd
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Install Node 16+ from https://nodejs.org/ then re-run this script.
  pause
  popd
  exit /b 1
)

echo === Collecting Claude usage data ===
node collect-usage.js
if errorlevel 1 (
  echo [ERROR] Collector failed.
  pause
  popd
  exit /b 1
)

echo.
echo === Starting dashboard server on http://127.0.0.1:8765/ ===
start "" "http://127.0.0.1:8765/dashboard.html"
node serve.js

popd
endlocal
