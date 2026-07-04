# Troubleshooting

## Dashboard shows $0 / empty panels

1. Run `refresh.bat` (or click the reload button) and watch the console output — each source reports found/not-found.
2. If a tool you use shows "not found", check its path in [ARCHITECTURE.md](ARCHITECTURE.md) exists on your machine.
3. Delete `data\scan-index.json` and refresh to force a full rescan.

## 5-hour / weekly windows show $0 but totals look right

Data is stale — the collector hasn't run recently. The dashboard self-heals (it triggers a refresh when data is > 1 h old), but if the page was closed, just run `refresh.bat`. If it persists, the watcher may be down — see below.

## Autostart doesn't work

```bat
schtasks /query /tn ClaudeUsageTracker-Watcher /fo LIST /v
```

- **Task missing** → re-run `install-autostart.bat`.
- **Last Result: 1** → the task's path is stale (e.g. you moved the install folder). Re-run `install-autostart.bat` from the new location.
- **Status: Running but nothing happens** → read `data\watch-claude.log`; every action is logged.

Common root causes we've hardened against (for the curious): PowerShell 5.1 rejects UNC paths with `-File`; scripts without a BOM must be pure ASCII; `pushd` drive letters must never be persisted into the task definition.

## Port 8765 already in use

Another instance is running — the launcher detects this and just opens the browser. To force a restart: `taskkill /f /im node.exe` (kills ALL node processes) or find the PID with `netstat -ano | findstr :8765`.

## "Windows protected your PC" on setup.bat

SmartScreen flags unsigned scripts downloaded from the internet. Click "More info → Run anyway", or unblock the zip before extracting (right-click → Properties → Unblock). You can read every line of the batch file — it's short.

## A tool's sessions stopped being counted

Tool vendors occasionally change their log format or location. Open an issue with one (redacted) sample line from the tool's `.jsonl` file and its path.
