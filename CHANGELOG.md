# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/); versioning: [SemVer](https://semver.org/).

## [1.2.0] — 2026-07-14

### Fixed
- **Dead dashboard server now self-heals on every Claude Desktop launch.** The watcher previously used a once-per-session flag to decide whether to launch the dashboard server, so a server that died mid-session stayed dead until next logon. It now port-checks the dashboard server on every Claude Desktop launch and relaunches it if it's not responding.

### Changed
- **Fable 5 pricing corrected to Anthropic's official July 2026 API rates**: $10/M input, $50/M output, $1/M cache read, $12.50/M cache write (was a $5/$25 placeholder estimate). Fable costs now roughly double what was previously reported — the usage didn't change, the price did.
- **Fable plan sub-caps follow Anthropic's July 7, 2026 policy**: Fable on subscriptions is now metered as usage credits, with per-plan allotments unpublished. Following the pre-switch guidance ("up to 50% of weekly usage limits"), the tracker now defaults Fable sub-caps to 50% of each plan's window caps; calibrate via Custom for your real number.
- localStorage key bumped to `cut-limits-v5` (new Fable defaults require a clean slate).

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
