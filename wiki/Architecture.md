# Architecture

Three moving parts, Node standard library only:

```
tool JSONL logs ──► collect-usage.js ──► data/data.js ──► dashboard (browser/PWA)
                         ▲                                     │
   watch-claude.ps1 ─────┘ hourly / on Claude launch           │
   serve.js /__refresh ◄────────── manual refresh button ──────┘
```

| Piece | Role |
|---|---|
| `collect-usage.js` | Scans 9 tool sources, prices tokens, computes session metrics, writes `data/data.js` atomically |
| `serve.js` | Hardened loopback HTTP server for the dashboard + control endpoints |
| `watch-claude.ps1` | Background watcher (Scheduled Task): launch-once-per-Claude-session, hourly refresh, crash restart |
| `dashboard.html` + `js/`, `css/` | Vanilla-JS frontend, vendored Chart.js, installable PWA |

`data.js` exposes five globals to the frontend: summary, sessions, per-message timestamps, cost events, and per-session efficiency metrics.

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

Rescans are incremental (mtime+size fingerprints in `data/scan-index.json`); a lockfile serializes concurrent collector runs.

## Windows engineering notes

These oddities are load-bearing — they each fix real breakage:

- **Atomic writes**: `.tmp` → rename, never unlink-then-rename. An open reader plus unlink can destroy the destination on some filesystems.
- **ASCII-only PowerShell**: scripts without a BOM parse as Windows-1252 under PowerShell 5.1 — one UTF-8 em dash is a parser error.
- **`-Command "& '...'"` not `-File`** in the Scheduled Task: `-File` rejects UNC paths.
- **`pushd` not `cd /d`** in batch files (UNC support), and never persist `%CD%` into a task — pushd's mapped drive letters are ephemeral; use `%~dp0`.
- **Session files append forever** across resumes, so cost is attributed by event timestamp, never by session end.
