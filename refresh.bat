@echo off
setlocal
pushd "%~dp0" || (echo [ERROR] Could not enter "%~dp0" & pause & exit /b 1)
node collect-usage.js
if errorlevel 1 (
  echo [ERROR] Collector failed.
  pause
)
popd
endlocal
