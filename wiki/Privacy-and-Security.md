# Privacy and Security

## The guarantee

**Zero outbound network requests.** Not to analytics, not to CDNs, not to font servers, not to GitHub. The only network socket the app opens is a local HTTP server bound to `127.0.0.1`.

## What it reads

Session JSONL files written by Claude tools on your machine (paths in [[Architecture]]). Conversation *content* is parsed only to count messages and detect efficiency patterns — nothing is stored beyond aggregate numbers and timestamps.

## What it writes

One folder: `data/` inside your install directory — the dashboard's data file, scan caches, and a watcher log. Delete it any time; it regenerates.

## What leaves your machine

Nothing. Even update notifications happen entirely on GitHub's side (**Watch → Releases** emails you); the app never checks for updates.

## Server hardening

Small as it is, the loopback server is defended like it faces the internet:

- **Loopback only** — binds `127.0.0.1`, not configurable.
- **Host-header allowlist** — defeats DNS-rebinding attacks where a malicious page's domain resolves to your loopback.
- **Cross-site rejection** — state-changing endpoints reject requests whose `Sec-Fetch-Site` marks them cross-site, so a drive-by webpage can't trigger the collector or the autostart installer.
- **Path-traversal guard** — separator-anchored prefix check.
- **Crash-proof URL parsing** — malformed percent-encoding gets a 400, not a dead server.

## One deployment caveat

Install to a **user-owned local path** (the default). If you install to a location other users can write to — a network share, a shared folder — anyone with write access there can modify code that runs under your account at logon.

## Verify, don't trust

```
findstr /s /i "http https fetch XMLHttpRequest" *.js js\*.js js\components\*.js
```

The codebase is stdlib-only and small enough to read in a sitting. Reports: GitHub issues, or the Security tab → *Report a vulnerability* for anything sensitive.
