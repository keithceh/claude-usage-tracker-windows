@echo off
rem Installs autostart via Task Scheduler. The task:
rem   * Runs at every user logon (no admin needed for user-level tasks)
rem   * Auto-restarts the watcher if it crashes (up to 999 times, 1 min apart)
rem   * Runs hidden — no console window
rem
rem The watcher (watch-claude.ps1) then handles:
rem   * Detecting claude.exe launch (Claude Desktop) -> opens dashboard ONCE
rem     per watcher session; later Claude launches refresh data silently
rem   * Periodic 1-hour refresh of usage data
setlocal
pushd "%~dp0" || (echo [ERROR] Could not enter "%~dp0" & pause & exit /b 1)

set "TASK=ClaudeUsageTracker-Watcher"
rem Use the original path from %~dp0 (UNC-stable) rather than %CD% (which is
rem an ephemeral pushd-mapped drive letter like Y: that disappears next session
rem and breaks the scheduled task with "Last Result: 1").
set "HERE=%~dp0"
if "%HERE:~-1%"=="\" set "HERE=%HERE:~0,-1%"

rem Clean up the legacy Startup-folder shortcut from the previous version
rem so the watcher doesn't get launched twice.
set "OLDLNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ClaudeUsageTracker-Watcher.lnk"
if exist "%OLDLNK%" (
  del "%OLDLNK%"
  echo Removed legacy Startup-folder shortcut.
)

rem Stop any old watcher PowerShell processes from previous installs.
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | " ^
  "Where-Object { $_.CommandLine -like '*watch-claude.ps1*' } | " ^
  "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

rem Register the scheduled task. Using PowerShell's ScheduledTasks module
rem because schtasks.exe can't express RestartCount/RestartInterval cleanly.
rem Notes on the action shape (these matter on UNC shares):
rem   * Use -Command "& 'PATH'" not -File PATH. PowerShell 5.1's -File arg
rem     refuses UNC paths and the task silently exits 1.
rem   * Use a LOCAL working directory (USERPROFILE), not the UNC root. Some
rem     UNC working directories also cause task exit 1.
rem   * Quoting: the inner single quotes survive intact through the bat
rem     escape and into the registered task action.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$here = '%HERE%';" ^
  "$arg = ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command \"& ''' + $here + '\watch-claude.ps1''\"');" ^
  "$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg -WorkingDirectory $env:USERPROFILE;" ^
  "$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME;" ^
  "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -Hidden;" ^
  "$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited;" ^
  "Register-ScheduledTask -TaskName '%TASK%' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null;" ^
  "Write-Host 'Registered scheduled task: %TASK%';"

if errorlevel 1 (
  echo [ERROR] Failed to register scheduled task.
  echo If you got an Access Denied error, try right-clicking this file
  echo and choosing 'Run as administrator'.
  pause
  popd
  exit /b 1
)

echo.
echo Starting the watcher now (so you don't have to log out/in)...
powershell -NoProfile -Command "Start-ScheduledTask -TaskName '%TASK%'"

echo.
echo Done. The dashboard will:
echo   * auto-launch ONCE when Claude Desktop opens (no spam on relaunch)
echo   * stay running until you close it
echo   * refresh data every 1 hour (manual refresh button always available)
echo   * relaunch automatically if the watcher ever crashes
echo.
echo Logs:    %HERE%\data\watch-claude.log
echo Remove:  uninstall-autostart.bat
pause
popd
endlocal
