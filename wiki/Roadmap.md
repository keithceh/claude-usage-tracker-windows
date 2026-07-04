# Roadmap

## v1.x — current

- [x] Windows port: 9-source scanner, dashboard, autostart watcher
- [x] Plan limits with calibration + independent Opus/Fable sub-meters
- [x] Efficiency Coach (heuristics, budgets, weekly digest)
- [x] Installable PWA, fully offline
- [ ] Screenshots + demo GIF
- [ ] PNG icon fallbacks for older browsers

## v2 — MCP companion

A small local MCP server over the same `data/` files so Claude itself can answer:

- "How much have I spent today / this week?"
- "How close am I to my 5-hour limit?"
- "What did the Efficiency Coach flag today?"

Same guarantee: loopback only, local reads, no network. Optional `mcp/` directory with its own setup step.

## Help wanted

- Linux launcher + systemd watcher (scanner already cross-platform)
- Self-hosted fonts option
- Per-project cost attribution
- CSV export

Suggest more via issues — see [CONTRIBUTING](https://github.com/keithceh/claude-usage-tracker-windows/blob/main/CONTRIBUTING.md).
