# Troubleshooting

## Dashboard shows $0 / empty panels

1. Run `refresh.bat` and read the console — every source reports found/not-found.
2. A tool you use shows "not found"? Check its path exists (table in [[Architecture]]).
3. Force a full rescan: delete `data\scan-index.json`, refresh again.

## 5-hour / weekly windows empty but totals fine

Stale data — the collector hasn't run recently. The dashboard self-heals when open (auto-refresh triggers a collect when data is >1h old); if it was closed, run `refresh.bat`. Persisting? Check the watcher below.

## Autostart doesn't run

```bat
schtasks /query /tn ClaudeUsageTracker-Watcher /fo LIST /v
```

| Symptom | Fix |
|---|---|
| Task not found | Re-run `install-autostart.bat` |
| `Last Result: 1` | Task points at a stale path (folder moved?) — re-run `install-autostart.bat` from the current install |
| Running but silent | Read `data\watch-claude.log` — every action is logged, and a healthy watcher writes an hourly `heartbeat` line |

## Port 8765 in use

An instance is already running; launchers detect this and just open the browser. Force-restart: find the PID with `netstat -ano | findstr :8765`, then `taskkill /f /pid <PID>`.

## SmartScreen blocks setup.bat

Unsigned script from the internet. *More info → Run anyway*, or unblock the downloaded zip first (right-click → Properties → Unblock). The batch file is short — read it.

## A tool stopped being counted

Vendors change log formats/locations without notice. Open an issue with the tool name, its log path, and **one redacted sample line** from its `.jsonl`.

Still stuck? Check the [[FAQ]] or open an issue.
