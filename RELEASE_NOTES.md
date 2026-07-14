# v1.2.0 — The watcher wakes up, the numbers get honest 💵

One recoverability fix and two pricing corrections that make your Fable totals more truthful — and bigger.

## Fixed

- 🩺 **A dead dashboard server no longer stays dead.** The watcher used to check "did I already launch this session?" — so a server that crashed mid-session sat dead until you logged out and back in. Now it port-checks the dashboard server on *every* Claude Desktop launch and relaunches it if it's not answering. Restart Claude Desktop, get your dashboard back.

## Changed

- 💰 **Fable 5 pricing corrected to Anthropic's official July 2026 rates** — $10/M input, $50/M output, $1/M cache read, $12.50/M cache write. The old numbers were a $5/$25 placeholder from before Anthropic published real prices. Heads up: **your Fable costs were under-reported by roughly half** — the same usage will now show a noticeably bigger number. The data didn't change. The price did.
- 📊 **Fable plan sub-caps now follow Anthropic's July 7 policy.** Fable on subscriptions is metered as usage credits now, not a fixed quota, and per-plan allotments aren't published. We default Fable sub-caps to 50% of each plan's window caps (the last published pre-switch guidance) — calibrate via **Custom** for your real number.

## Update

Grab the release, re-run `setup.bat` over your install — history preserved. Re-run `install-autostart.bat` once so the fixed watcher is registered.

Zero outbound requests. Zero dependencies. As always.
