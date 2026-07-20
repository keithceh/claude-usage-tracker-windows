# v1.2.1 — No event left behind 👀

The last event-driven ghost in the watcher is gone.

## Fixed

- 🚀 **The dashboard actually auto-opens when you launch Claude Desktop now.** The launch trigger relied on a WMI event subscription that registered happily and then never delivered a single event in production — the same silent event failure that broke the hourly refresh before v1.1.1, surviving in one last place. Detection is now a simple 60-second poll in the watcher's main loop: launch Claude, and within a minute your dashboard is up. Boring, observable, and it works — the same cure that fixed the refresh.

## Update

Grab the release, re-run `setup.bat` over your install — history preserved. Re-run `install-autostart.bat` once so the polling watcher is registered.

Zero outbound requests. Zero dependencies. As always.
