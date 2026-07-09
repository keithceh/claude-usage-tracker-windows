# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/); versioning: [SemVer](https://semver.org/).

## [1.1.1] — 2026-07-09

### Fixed
- **Calibrate buttons no longer fail silently.** Every outcome now shows in a message line under the calibrate row: invalid percentage, no usage in the window (with data-age hint and what to do), or the computed cap on success. The 5-hour button "doing nothing" was almost always one of these silent cases.
- **Hourly background refresh actually runs.** The periodic refresh moved from a .NET event timer into the watcher's keep-alive loop — production watcher instances could die before their first 60-minute tick, so the event timer never fired outside testing. The loop also writes an hourly heartbeat line to `data\watch-claude.log`, so a silently dead watcher is now diagnosable.
- Rolling 5h/weekly windows track fresh usage again as a result: watcher refresh (hourly), browser self-heal (stale-data trigger), and manual refresh all verified end-to-end.

## [1.1.0] — 2026-07-08

### Changed
- **Efficiency Coach docked left**: coach and Plan Usage Limits now share a responsive two-column row (coach on the left) on screens ≥1100px, so habit feedback is the first thing you see; stacks vertically on narrow screens
- **Readability pass**: raised the smallest font sizes across both panels (labels, sub-text, footers ~15–20% larger)
- Install docs now explain *why* `%LOCALAPPDATA%\ClaudeUsageTracker` is the recommended default (user-owned ACLs, local disk, machine-specific) and warn against shared/network locations

### Added
- Release-reminder workflow: an announcement issue opens one week after each release
- Monthly-digest workflow: first Monday of each month, an issue summarizes releases and issue activity since the previous digest
- Release workflow accepts a hand-written `RELEASE_NOTES.md` (falls back to auto-generated notes)

## [1.0.0] — 2026-07-04

Initial public release. Windows port of [658jjh/claude-usage-tracker](https://github.com/658jjh/claude-usage-tracker).

### Added
- Scanner for 9 tool sources with incremental rescans and atomic writes
- Dashboard: cost overview, daily/source/model charts, peak-hours heatmap, session log
- Plan Usage Limits panel: 5-hour + weekly rolling windows, per-window calibration, independent Opus and Fable premium sub-meters
- Efficiency Coach: tokens/session baseline, burn rate, wasted-step heuristics, hygiene + model-fit flags, housekeeping score, weekly digest, optional budgets
- Installable PWA (manifest + icon), fully offline: vendored Chart.js, no web fonts, zero outbound requests
- `setup.bat` installer with user-chosen install location
- Autostart watcher (Scheduled Task): launch-once-per-Claude-session, hourly background refresh, crash auto-restart
- Hardened loopback server: Host allowlist, cross-site rejection, traversal guard
- Documentation set + CI and release workflows
