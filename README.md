# Claude Usage Tracker — Windows

**Local-only dashboard for your Claude usage: cost, plan limits, and efficiency coaching.**
Windows port of [658jjh/claude-usage-tracker](https://github.com/658jjh/claude-usage-tracker), built in answer to its call for Windows path support.

- 🔒 **100% local.** Zero outbound network requests — not to us, not to CDNs, not to anyone. See [docs/PRIVACY.md](docs/PRIVACY.md).
- 📦 **Zero dependencies.** Node.js standard library only. No `npm install`, ever.
- 📱 **Installable PWA.** Pin the dashboard as a standalone app window from your browser.

![screenshot placeholder](docs/img/dashboard.png)

## What it shows

| Panel | What you learn |
|---|---|
| **Cost overview** | Today / week / month / all-time spend, per source and per model |
| **Plan Usage Limits** | 5-hour and weekly rolling windows vs your plan's estimated caps, with reset countdowns. Separate **Opus** and **Fable** sub-meters so premium-model burn is always visible. Calibrate against claude.ai's own percentages. |
| **Efficiency Coach** | Tokens/session vs your own baseline, $/hr burn rate, wasted steps (rapid re-prompts, duplicate prompts, error-retries), session-hygiene and model-fit flags, week-over-week habit digest |
| **Charts & log** | Daily trend, source/model breakdowns, peak-hours heatmap, expandable session log |

## Supported tools

Claude Code CLI, Claude Desktop (local agent sessions), Cursor, Windsurf, Cline, Roo Code, Aider, Continue.dev, OpenClaw. Missing tools are skipped silently.

## Quick start

Requirements: Windows 10/11, [Node.js 16+](https://nodejs.org/).

```bat
git clone https://github.com/keithceh/claude-usage-tracker-windows
cd claude-usage-tracker-windows
setup.bat
```

`setup.bat` asks where to install (default `%LOCALAPPDATA%\ClaudeUsageTracker` — your choice), then launches the dashboard at `http://127.0.0.1:8765/`. Full instructions: [docs/INSTALL.md](docs/INSTALL.md).

## Get notified of updates

Click **Watch → Custom** on this repo and tick **Releases + Issues**. You'll get:

1. **Release notification** the moment a version ships (GitHub release email)
2. **One-week reminder** — an announcement issue opens 7 days after each release, in case the first email got buried
3. **Monthly digest** — every first Monday, an issue summarizing releases and issue activity since the last digest

All three happen on GitHub's side. The app itself never phones home — updating is always your action: pull the release, re-run `setup.bat`. Your data is preserved.

## Documentation

[Install](docs/INSTALL.md) · [Privacy](docs/PRIVACY.md) · [Architecture](docs/ARCHITECTURE.md) · [Metrics explained](docs/METRICS.md) · [Troubleshooting](docs/TROUBLESHOOTING.md) · [FAQ](docs/FAQ.md) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md)

## Credits & license

Fork/port of [658jjh/claude-usage-tracker](https://github.com/658jjh/claude-usage-tracker) (macOS). MIT — see [LICENSE](LICENSE).
