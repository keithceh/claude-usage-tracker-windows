@echo off
setlocal EnableDelayedExpansion
rem Claude Usage Tracker - Windows installer.
rem Copies the app to a directory of YOUR choice and optionally enables
rem auto-start with Claude Desktop. Everything stays on your machine.

pushd "%~dp0" || (echo [ERROR] Could not enter "%~dp0" & pause & exit /b 1)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js 16+ is required and was not found on PATH.
  echo Install it from https://nodejs.org/ then re-run setup.bat
  pause & popd & exit /b 1
)

echo.
echo === Claude Usage Tracker - Setup ===
echo.
set "DEFAULT_DIR=%LOCALAPPDATA%\ClaudeUsageTracker"
set /p INSTALL_DIR="Install location [%DEFAULT_DIR%]: "
if "!INSTALL_DIR!"=="" set "INSTALL_DIR=%DEFAULT_DIR%"

echo Installing to: !INSTALL_DIR!
robocopy "%CD%" "!INSTALL_DIR!" /E /XD .git .github data node_modules /XF setup.bat .gitignore /NFL /NDL /NJH /NJS >nul
if errorlevel 8 (
  echo [ERROR] Copy failed. Check the path and permissions.
  pause & popd & exit /b 1
)

echo.
choice /C YN /M "Auto-start the tracker when Claude Desktop launches"
if not errorlevel 2 (
  call "!INSTALL_DIR!\install-autostart.bat" <nul
)

echo.
echo Done. Launching the dashboard...
start "" cmd /c "\"!INSTALL_DIR!\start.bat\""
echo.
echo Tip: in your browser, use "Install app" (address-bar icon) to pin the
echo dashboard as a standalone PWA window.
echo To update later: pull the latest release and re-run setup.bat with the
echo same install location. Your data\ directory is preserved.
pause
popd
endlocal
