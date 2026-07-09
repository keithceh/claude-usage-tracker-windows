# v1.1.1 — The windows roll again 🔄

Two quiet bugs, both loud in effect: calibration that shrugged at your clicks, and rolling windows frozen in the past. Both dead.

## Fixed

- 🎯 **Calibrate talks back** — every click now answers: your new cap (in green), or exactly why not — bad percentage, or no usage in the window with the data's age and the fix. No more silent shrugs.
- ⏰ **The hourly refresh is real now** — the background refresh moved out of a fragile event timer into the watcher's main loop, with an hourly heartbeat in the log so a dead watcher can never hide again. Your 5-hour and weekly windows track live usage: watcher, browser self-heal, and manual refresh all verified.

## Update

Grab the release, re-run `setup.bat` over your install — history preserved. If you use autostart, re-run `install-autostart.bat` once so the fixed watcher is registered.

Zero outbound requests. Zero dependencies. As always.
