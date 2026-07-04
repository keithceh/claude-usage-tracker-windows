# Metrics Explained

## The $ figures

Token counts from your logs × published per-model API prices (input / output / cache write / cache read). On a subscription you don't pay per token — the $ number is a **compute-value proxy**: the closest measurable stand-in for Anthropic's opaque plan-limit metric, and a consistent unit for comparing days, tools, and habits.

Fable 5 pricing is an estimate (flagship tier) until official numbers exist; the constant sits at the top of `collect-usage.js`.

## Plan Usage Limits

Anthropic meters plans by an unpublished compute metric over a rolling **5-hour** window and a rolling **weekly** window. The panel approximates both as $ spent per window against per-plan cap estimates.

**Calibration** makes it *your* meter: read the real percentage from claude.ai → Settings → Usage, type it into the matching "Claude shows __%" box, click calibrate. The panel back-computes your true cap (`cap = spent ÷ pct`) and tracks against that from then on. Calibrate each window independently.

**Opus and Fable sub-meters** are independent: Anthropic applies separate premium-model quotas, and mixing them would let heavy Fable use hide Opus burn. Mythos counts with Fable (same underlying model). Sub-meters appear whenever your plan (or custom calibration) carries a cap for them.

**Resets** show when the oldest event in the window rolls off — the earliest moment your usage meaningfully drops.

## Efficiency Coach

Local heuristics only — zero API calls, thresholds in one commented constants block per file.

| Metric | Definition | Why it matters |
|---|---|---|
| **Tokens / session** | Median (input + output) per session, today vs your 14-day baseline | Rising = tasks are costing more conversation than they used to |
| **Burn rate** | $ over the last 2 hours ÷ 2 | Your live $/hour pace |
| **Wasted steps** | Rapid re-prompts (<60s apart) + near-duplicate prompts (word-set Jaccard >0.6) + retries within 120s of a tool error | Each one is a turn a better prompt or workflow would have avoided |
| **Hygiene flags** | Sessions >3h → `/compact` suggestion; session files spanning >24h of resumes → "start fresh"; top-decile cache-read ratios | Every turn re-reads the whole conversation as cached input — marathon sessions are the biggest silent burner |
| **Model-fit flag** | Opus/Fable session producing <2k output tokens | Premium model, trivial task — a smaller model was enough |
| **Housekeeping score** | % of today's long (>1h) sessions that compacted, resumed cleanly, or ended clean | Measures the habits that keep future sessions cheap and resumable |
| **Weekly digest** | Each metric, rolling 7 days vs the prior 7, ▲▼ colored by direction-of-good | Are the habits actually improving? |

## Budgets

Optional hard lines, set in the customizer: **max tokens/session** and **max $/day**. Bars go amber at 70%, red at 90%. `0` = off. Budgets complement the baseline: the baseline tells you if you're beating yourself, budgets tell you if you're past your own line.
