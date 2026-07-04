# Claude Usage Tracker — Windows

**A local-only dashboard that turns your Claude tool logs into cost visibility, plan-limit awareness, and better usage habits.**

## What it is

Every Claude-family tool on your machine — Claude Code CLI, Claude Desktop, Cursor, Windsurf, Cline, Roo Code, Aider, Continue.dev, OpenClaw — writes session logs as JSONL files. This tool scans those logs, prices every token at published API rates, and renders the result as an interactive dashboard at `http://127.0.0.1:8765/`.

No account, no signup, no cloud. The dashboard is an installable PWA served from a loopback-only Node server, and the entire app makes **zero outbound network requests** — see [[Privacy and Security]].

## Why it exists

Subscription plans hide the meter. You get a 5-hour window and a weekly window of an opaque "compute" budget, and the first time you learn you're near the edge is a warning banner mid-task. This tool answers, at a glance:

- **How much am I burning?** Today / this week / this month / all-time, per tool and per model, in $-equivalent API spend.
- **How close am I to my plan limits?** Rolling 5-hour and weekly windows with reset countdowns, calibratable against claude.ai's own percentages — with **independent Opus and Fable sub-meters** so premium-model burn is always visible.
- **Am I using Claude well?** An Efficiency Coach measures tokens per session against your own baseline, spots wasted steps (rapid re-prompts, near-duplicate prompts, error-retry loops), flags marathon sessions and model overkill, and scores your session-hygiene habits week over week.

## The panels

| Panel | What you learn |
|---|---|
| **Cost overview** | Spend by day/week/month/all-time, session counts, per-source and per-model splits |
| **Plan Usage Limits** | 5h + weekly windows vs plan caps, reset timers, Opus/Fable sub-meters, calibration — see [[Metrics Explained]] |
| **Efficiency Coach** | Burn rate, wasted steps, hygiene and model-fit flags, housekeeping score, weekly digest, optional budgets |
| **Charts** | Daily trend, source/model breakdowns, peak-hours heatmap |
| **Session log** | Expandable per-day, per-source detail down to individual sessions |

Every section can be toggled and resized from the customizer (gear button), and the whole dashboard installs as a standalone app window from your browser.

## Design principles

1. **Local means local.** Nothing leaves your machine — no CDNs, no fonts, no telemetry, no update pings. Verifiable in the source.
2. **Zero dependencies.** Node standard library only. `git clone` → `setup.bat` → running. Nothing to `npm install`, nothing to audit but our own small codebase.
3. **Your data stays yours.** Everything generated lives in one `data/` folder you can delete at any time.

## Get started

Head to [[Installation]] — it's a two-minute setup. For updates, click **Watch → Custom → Releases** on the repo; GitHub notifies you when a new version ships.

## Credits

Windows port of [658jjh/claude-usage-tracker](https://github.com/658jjh/claude-usage-tracker) (macOS, MIT), built in answer to its README's call for Windows path support.
