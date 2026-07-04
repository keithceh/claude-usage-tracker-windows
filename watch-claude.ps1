# Background watcher for Claude Usage Tracker.
#
# Triggers a refresh in two ways:
#   1. WMI process-creation event when claude.exe starts (Claude Desktop).
#   2. Periodic timer every $IntervalMinutes (default 60) - catches Claude
#      Code / other CLI activity that doesn't launch Claude Desktop.
#
# Started by Task Scheduler (see install-autostart.bat). Survives crashes
# via the task's RestartCount setting. The script logs everything it does
# to data\watch-claude.log so failures are diagnosable after the fact.
#
# IMPORTANT: ASCII only. PowerShell 5.1 reads scripts without a BOM as
# Windows-1252, so UTF-8 multi-byte chars (em dashes, smart quotes, etc.)
# inside strings break the parser. Keep this file ASCII.

param(
  [int]$IntervalMinutes = 60
)

# Track whether we've already launched the dashboard this watcher session.
# Once true, future claude.exe events only refresh data - they do NOT open
# a new browser tab. This respects "launch once per Claude session, stay
# on unless closed by user". Reset on watcher restart (i.e. next logon).
$script:launchedThisSession = $false

$ErrorActionPreference = 'Continue'

# $PSScriptRoot is the directory the script file lives in - always set when
# running as a script, regardless of how it was invoked (-File, -Command,
# dot-source). Previously used $MyInvocation.MyCommand.Path which can return
# $null under "powershell -Command '& path'", silently breaking the log path.
$here = $PSScriptRoot
if (-not $here -or $here -eq '') {
  $here = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$bat        = Join-Path $here 'start.bat'
$collector  = Join-Path $here 'collect-usage.js'
$logFile    = Join-Path $here 'data\watch-claude.log'

# Make sure data\ exists for the log file.
$dataDir = Join-Path $here 'data'
if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }

function Log($msg) {
  try {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -Path $logFile -Value "[$ts] $msg" -ErrorAction SilentlyContinue
  } catch {}
}

# Just refresh data.js - no server, no browser. Used on the timer tick and
# on repeat claude.exe events when the dashboard is already up.
function Refresh-Data {
  try {
    $proc = Start-Process -FilePath 'node.exe' `
                          -ArgumentList "`"$collector`"" `
                          -WorkingDirectory $here `
                          -WindowStyle Hidden `
                          -PassThru -Wait
    Log "Periodic refresh ran (exit=$($proc.ExitCode))"
  } catch {
    Log "Periodic refresh failed: $_"
  }
}

# Launch the dashboard (collector + server). Used on Claude Desktop start.
# Only opens a browser tab on the FIRST call per watcher session - repeat
# claude.exe launches just refresh data so the user isn't spammed with
# new tabs every time they reopen Claude Desktop.
function Launch-Tracker {
  if ($script:launchedThisSession) {
    Log "claude.exe detected - dashboard already launched this session, refreshing data only"
    Refresh-Data
    return
  }
  Log "claude.exe detected, launching dashboard (first time this session)"
  try {
    Start-Process -FilePath 'cmd.exe' `
                  -ArgumentList '/c', "`"$bat`"" `
                  -WorkingDirectory $here `
                  -WindowStyle Hidden
    $script:launchedThisSession = $true
  } catch {
    Log "Launch failed: $_"
  }
}

Log "watch-claude started (PID=$PID, interval=${IntervalMinutes}m)"

# If Claude Desktop is already running when we start, fire once so the
# dashboard comes up at login.
try {
  if (Get-Process -Name 'claude' -ErrorAction SilentlyContinue) {
    Launch-Tracker
  }
} catch { Log "Initial check error: $_" }

# WMI subscription for claude.exe process-creation. Wrapped in try/catch
# so a transient WMI failure doesn't kill the whole script - the periodic
# timer will keep running data fresh as a fallback.
try {
  $query = "SELECT * FROM __InstanceCreationEvent WITHIN 5 " +
           "WHERE TargetInstance ISA 'Win32_Process' " +
           "AND TargetInstance.Name = 'claude.exe'"
  Register-WmiEvent -Query $query -SourceIdentifier 'ClaudeDesktopStart' `
    -Action { Launch-Tracker } | Out-Null
  Log "WMI subscription registered"
} catch {
  Log "WMI subscription failed: $_"
}

# Periodic data refresh on a separate .NET timer.
try {
  $timer = New-Object System.Timers.Timer
  $timer.Interval = $IntervalMinutes * 60 * 1000
  $timer.AutoReset = $true
  Register-ObjectEvent -InputObject $timer -EventName Elapsed `
    -SourceIdentifier 'PeriodicRefresh' -Action { Refresh-Data } | Out-Null
  $timer.Start()
  Log "Periodic timer started"
} catch {
  Log "Periodic timer setup failed: $_"
}

# Keep the script alive so registered events keep firing. If we ever fall
# out of this loop, log it - Task Scheduler will restart us.
try {
  while ($true) { Start-Sleep -Seconds 60 }
} finally {
  Log "watch-claude exiting (PID=$PID)"
}
