# Metrics explained

## Cost

Computed from token counts in the JSONL logs × published API prices per model (input, output, cache write, cache read). Subscription users don't pay per token — the $ figure is a *compute-value proxy* that tracks how hard you're driving your plan.

Fable 5 pricing is an estimate (flagship tier) until Anthropic publishes numbers — see the constant block in `collect-usage.js`.

## Plan Usage Limits

Anthropic's real limits are an opaque compute metric. The panel approximates them as **$ spent per rolling window** (5-hour and 7-day). Caps per plan are public estimates; the **calibrate buttons** back-compute your true cap from a percentage you read off claude.ai → Settings → Usage (`cap = spent / pct`).

**Opus and Fable sub-meters** track each premium family independently, so heavy use of one never hides the other. Mythos counts with Fable (same underlying model).

## Efficiency Coach

All heuristics are local; thresholds live in one constants block per file.

| Metric | Definition |
|---|---|
| Tokens / session | Median of (input + output) tokens per session, today vs 14-day baseline |
| Burn rate | $ from cost events in the last 2 hours ÷ 2 |
| Wasted steps | rapid re-prompts (2 user prompts < 60 s apart) + near-duplicate prompts (word-set Jaccard > 0.6) + error-retries (prompt < 120 s after a tool error) |
| Session hygiene flags | Sessions > 3 h → suggest `/compact`; session files spanning > 24 h of resumes → suggest fresh sessions; cache-read-heavy sessions (top decile ratio) |
| Model-fit flag | Premium model (Opus/Fable) session with < 2 k output tokens — a smaller model would have done |
| Housekeeping score | % of today's long (> 1 h) sessions that compacted, resumed cleanly, or ended clean |
| Weekly digest | Each metric, rolling 7 days vs the 7 days before, ▲▼ colored by whether higher is better |

**Why cache reads matter:** every extra turn in a long session re-reads the entire conversation as cached input tokens. Marathon sessions are the single biggest silent burner — that's why the coach nags about `/compact` and fresh sessions.

## Budgets

Optional, set in the customizer (gear button): max tokens/session and max $/day. Bars turn amber at 70 %, red at 90 %. `0` disables a budget.
