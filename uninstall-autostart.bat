@echo off
setlocal
set "TASK=ClaudeUsageTracker-Watcher"

rem Remove the scheduled task (no admin needed for user-level tasks).
powershell -NoProfile -Command ^
  "if (Get-ScheduledTask -TaskName '%TASK%' -ErrorAction SilentlyContinue) {" ^
  "  Unregister-ScheduledTask -TaskName '%TASK%' -Confirm:$false;" ^
  "  Write-Host 'Removed scheduled task: %TASK%';" ^
  "} else { Write-Host 'No scheduled task to remove.'; }"

rem Also clean up the legacy Startup folder shortcut, if any.
set "OLDLNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ClaudeUsageTracker-Watcher.lnk"
if exist "%OLDLNK%" (
  del "%OLDLNK%"
  echo Removed legacy Startup-folder shortcut.
)

echo Stopping any running watcher (PowerShell processes running watch-claude.ps1)...
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | " ^
  "Where-Object { $_.CommandLine -like '*watch-claude.ps1*' } | " ^
  "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo.
echo Done. The dashboard server (if running) is left alone — close it
echo from its console window or via Task Manager (node.exe).
pause
endlocal
