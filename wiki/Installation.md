# Installation

## Requirements

- Windows 10/11
- [Node.js 16+](https://nodejs.org/) on PATH — check with `node --version`
- Nothing else. No npm packages, ever.

## Standard install

1. Grab the [latest release](https://github.com/keithceh/claude-usage-tracker-windows/releases/latest) or `git clone https://github.com/keithceh/claude-usage-tracker-windows`.
2. Double-click **`setup.bat`**.
3. Pick your install location (Enter = `%LOCALAPPDATA%\ClaudeUsageTracker`; any path you prefer works).
4. Answer Y/N to auto-start with Claude Desktop.
5. Dashboard opens at `http://127.0.0.1:8765/`.

## Install as an app (PWA)

In Chrome or Edge, click the install icon in the address bar (or menu → *Install Claude Usage Tracker*). You get a standalone window, taskbar icon, and Start-menu entry. Fully offline.

## Portable mode

Skip setup entirely — run `start.bat` straight from the cloned folder. Data lands in `data/` beside the scripts.

## Auto-start with Claude Desktop

Enabled during setup, or later via `install-autostart.bat`. Registers a **user-level Scheduled Task** (no admin rights) running a background watcher that:

- opens the dashboard **once** when Claude Desktop launches — no new tab per relaunch
- refreshes usage data hourly in the background
- restarts itself automatically if it crashes

Remove with `uninstall-autostart.bat`. Activity logs to `data\watch-claude.log`.

## Updating

1. **Watch → Custom → Releases** on the repo → GitHub emails you on new versions.
2. Download the release, re-run `setup.bat`, point at the same install directory.
3. Your `data/` history is preserved.

## Uninstall

Run `uninstall-autostart.bat` (if installed), then delete the install folder. No registry entries, no services, nothing else left behind.

Having trouble? See [[Troubleshooting]].
