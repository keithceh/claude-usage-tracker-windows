# FAQ

**Does this send my conversations anywhere?**
No. Zero outbound requests, by design. See [PRIVACY.md](PRIVACY.md) and verify in the source — it's small.

**Why do the $ numbers exist if I'm on a subscription?**
They're a compute-value proxy: what your usage *would* cost at API prices. It's the closest measurable stand-in for Anthropic's opaque plan-limit metric, and it makes efficiency trends comparable over time.

**Why don't my plan-limit percentages match claude.ai exactly?**
The caps are public estimates. Read the real percentage from claude.ai → Settings → Usage and use the **calibrate** buttons — the panel then back-computes your true cap and tracks against it.

**Why are Opus and Fable metered separately?**
Anthropic applies separate premium-model quotas. Keeping the meters independent means heavy Fable use never hides Opus burn (and vice versa). Both stay visible whenever your plan carries a cap for them. Since July 7, 2026, Fable on subscriptions is metered as usage credits rather than a fixed quota, and per-plan allotments aren't published; the tracker defaults Fable's sub-cap to the pre-switch guidance of 50% of your plan's weekly limit — calibrate via Custom for your real number.

**How do I get update notifications?**
GitHub → **Watch → Custom → Releases**. GitHub emails you; the app itself never checks for updates (that would be an outbound call).

**Can I restore the original web fonts (JetBrains Mono / Outfit)?**
Yes — add this to `dashboard.html`'s `<head>`, accepting that your browser will then contact Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300..700&family=Outfit:wght@300..900&display=swap" rel="stylesheet">
```

Or download the fonts and serve them from `assets/fonts/` for offline typography.

**Does it work without Claude Desktop?**
Yes. Claude Code CLI, Cursor, Windsurf, etc. are all scanned independently. Autostart-on-Claude-launch is optional.

**Where's the Mac/Linux version?**
Mac: use the [original project](https://github.com/658jjh/claude-usage-tracker). Linux: the scanner is cross-platform Node, but the launchers/watcher are Windows-specific — PRs welcome.

**Is there an MCP server so Claude itself can tell me my usage?**
Planned — see [ROADMAP.md](../ROADMAP.md).
