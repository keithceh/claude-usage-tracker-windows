# Contributing

Bug fixes, new tool integrations, and design improvements are welcome — same spirit as the [upstream project](https://github.com/658jjh/claude-usage-tracker).

## Ground rules

1. **Zero dependencies.** Node stdlib only. PRs adding npm packages will be asked to justify hard or be closed.
2. **Zero outbound requests.** The privacy guarantee in [docs/PRIVACY.md](docs/PRIVACY.md) is non-negotiable. No CDNs, no telemetry, no update pings.
3. **Windows quirks are load-bearing.** Read the "Engineering notes" in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before touching the `.bat` / `.ps1` files — several odd-looking choices (ASCII-only PowerShell, `pushd`, `-Command` vs `-File`) fix real breakage.
4. **Heuristic thresholds** live in one commented constants block per file. Tune there, don't scatter magic numbers.

## Workflow

1. Fork → feature branch (`feat/...`, `fix/...`)
2. Commit with conventional messages: `feat:`, `fix:`, `docs:`, `chore:`
3. Make sure `node --check` passes on changed JS and `node collect-usage.js` runs clean
4. Open a PR describing what changed and why

## Adding a new tool integration

1. Add its log path(s) to a new `collect<Tool>()` in `collect-usage.js` and register it in the `sources` array.
2. Add the path to the table in `docs/ARCHITECTURE.md`.
3. If its JSONL shape differs, extend the parser with a fallback — include one *redacted* sample line in your PR description.
