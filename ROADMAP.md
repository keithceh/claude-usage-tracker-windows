# Roadmap

## v1.x — current line

- [x] Windows port: scanner, dashboard, autostart watcher
- [x] Plan Usage Limits with per-window calibration
- [x] Independent Opus / Fable premium sub-meters
- [x] Efficiency Coach (local heuristics, budgets, weekly digest)
- [x] Installable PWA, fully offline (vendored Chart.js, no web fonts)
- [ ] Screenshots + demo GIF in docs
- [ ] Icon PNG fallbacks for older browsers

## v2 — MCP companion

A small local MCP server exposing read-only tools over the same `data/` files, so Claude itself can answer:

- "How much have I spent today / this week?"
- "How close am I to my 5-hour limit?"
- "What did the Efficiency Coach flag today?"

Same privacy guarantee: loopback only, reads local data, no network. Ships as an optional `mcp/` directory with its own setup step.

## Maybe / help wanted

- Linux launcher + systemd watcher (scanner already cross-platform)
- Self-hosted fonts option (`assets/fonts/`)
- Per-project cost attribution views
- Export to CSV
