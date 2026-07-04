# Privacy

**Design guarantee: this app makes zero outbound network requests.**

## What it reads

Session log files (`.jsonl`) written by Claude tools on **your** machine:
`%USERPROFILE%\.claude\projects\`, `%APPDATA%\Claude\local-agent-mode-sessions\`, and equivalents for Cursor, Windsurf, Cline, Roo Code, Aider, Continue.dev, OpenClaw. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full path table.

## What it writes

`data/` inside your install directory only: `data.js` (the dashboard's data), scan caches, and a watcher log. Delete `data/` at any time — it regenerates on the next scan.

## What leaves your machine

Nothing.

- The dashboard server binds to `127.0.0.1` only and rejects requests with a foreign `Host` header (DNS-rebinding protection) and cross-site requests (CSRF protection).
- Chart.js is vendored into the repo (`js/vendor/`) — no CDN fetch.
- No web fonts, no analytics, no telemetry, no update checks. Update notifications happen entirely on GitHub's side via **Watch → Releases**; the app never contacts GitHub.

## Verify it yourself

The codebase is small, dependency-free, and readable in one sitting:

```
findstr /s /i "http https fetch XMLHttpRequest" *.js js\*.js js\components\*.js
```

The only network code you'll find is the loopback-bound local server (`serve.js`) and same-origin fetches to it.
