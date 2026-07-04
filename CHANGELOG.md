# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/); versioning: [SemVer](https://semver.org/).

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
