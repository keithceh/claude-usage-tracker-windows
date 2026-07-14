# FAQ

**Does this send my conversations anywhere?**
No. Zero outbound requests, verifiable in the source — see [[Privacy and Security]].

**I'm on a subscription — why show dollars?**
It's a compute-value proxy: what your usage *would* cost at API prices. It's the most consistent stand-in for Anthropic's hidden plan metric and makes trends comparable. Details in [[Metrics Explained]].

**My percentages don't match claude.ai exactly.**
Expected — the caps are estimates until you calibrate. Read the real % from claude.ai → Settings → Usage and use the calibrate buttons; the panel then tracks your true cap.

**Why separate Opus and Fable meters?**
Separate quotas upstream, so merged meters would let one family's burn hide the other's. Independent meters keep both visible. Mythos counts with Fable. Since July 7, 2026, Fable on subscriptions is metered as usage credits with unpublished per-plan allotments, so the tracker defaults Fable's cap to 50% of the plan's weekly limit — calibrate via Custom for your real number.

**How do updates work?**
**Watch → Custom → Releases** on GitHub — you get an email per release. The app never phones home; updating is always your action (`setup.bat` over the same location, data preserved).

**Can I get the original fonts back?**
Yes — add the Google Fonts `<link>` back to `dashboard.html` (snippet in `docs/FAQ.md`), accepting that your browser will then contact Google. Or self-host the fonts in `assets/fonts/`.

**Does it need Claude Desktop?**
No — every source scans independently. Autostart-on-Claude-launch is optional.

**Mac? Linux?**
Mac: use the [upstream project](https://github.com/658jjh/claude-usage-tracker). Linux: the scanner is cross-platform Node already; launchers/watcher are Windows-specific — PRs welcome.

**Will Claude itself be able to tell me my usage?**
Planned — a local MCP companion server is the v2 milestone on the [[Roadmap]].
