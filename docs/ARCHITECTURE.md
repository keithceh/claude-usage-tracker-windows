# Architecture

Three small pieces, Node stdlib only:

```
collect-usage.js   scanner: reads tool JSONL logs → writes data/data.js
serve.js           loopback HTTP server for the dashboard (+ control endpoints)
watch-claude.ps1   background watcher: launch-on-Claude + hourly refresh
dashboard.html     frontend (vanilla JS + vendored Chart.js)
```

## Data flow

```
tool JSONL logs ──> collect-usage.js ──> data/data.js ──> dashboard (browser)
                         ▲                                      │
   watch-claude.ps1 ─────┘ (hourly / on Claude launch)          │
   serve.js /__refresh  ◄───────────── manual refresh button ───┘
```

`data.js` carries five globals: `__SUMMARY__`, `__CLAUDE_SESSIONS__`, `__USER_MSG_TIMES__`, `__COST_EVENTS__`, `__SESSION_METRICS__`.

## Scanned paths

| Tool | Path |
|---|---|
| Claude Code CLI | `%USERPROFILE%\.claude\projects\` |
| Claude Desktop | `%APPDATA%\Claude\local-agent-mode-sessions\` |
| Cursor | `%APPDATA%\Cursor\User\workspaceStorage`, `%USERPROFILE%\.cursor\` |
| Windsurf | `%APPDATA%\Windsurf\User\workspaceStorage`, `%USERPROFILE%\.windsurf` |
| Cline | `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev` (and `cline.cline`) |
| Roo Code | `%APPDATA%\Code\User\globalStorage\rooveterinaryinc.roo-cline` |
| OpenClaw | `%USERPROFILE%\.openclaw\agents\main\sessions\` |
| Aider | `%USERPROFILE%\.aider\` |
| Continue.dev | `%USERPROFILE%\.continue\sessions\` |

Re-scans are incremental: unchanged files are skipped via an mtime+size fingerprint (`data/scan-index.json`). A lockfile prevents concurrent collector runs.

## Server security model

`serve.js` binds `127.0.0.1` (not configurable), validates the `Host` header (anti DNS-rebinding), rejects cross-site requests to state-changing endpoints (`Sec-Fetch-Site`), and guards path traversal with a `ROOT + separator` prefix check. Malformed URLs return 400 instead of crashing the process.

## Engineering notes (learned the hard way)

- **Atomic writes**: `data.js` is written `.tmp` → rename, never unlink-then-rename — an open reader plus unlink can destroy the file on some filesystems.
- **PowerShell 5.1 quirks**: `watch-claude.ps1` is deliberately ASCII-only (scripts without a BOM parse as Windows-1252 — a UTF-8 em dash breaks the parser), and the Scheduled Task invokes it via `-Command "& '...'"` because `-File` rejects UNC paths.
- **Batch on UNC/network paths**: use `pushd` (maps a temp drive), never `cd /d`. Never bake `%CD%` into a persistent task — pushd drive letters are ephemeral; use `%~dp0`.
- **Session files are append-forever**: a "session" JSONL can span days of resumes. Metrics attribute cost by event timestamp, not by session end.
