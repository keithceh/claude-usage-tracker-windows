# Install

## Requirements

- Windows 10/11
- [Node.js 16+](https://nodejs.org/) on PATH (`node --version` should print a version)
- No npm packages — the app is Node standard-library only

## Recommended: setup.bat

1. Download the [latest release](../../releases/latest) (or `git clone` the repo).
2. Double-click **`setup.bat`**.
3. Choose your install location when prompted — pressing Enter accepts **`%LOCALAPPDATA%\ClaudeUsageTracker`**, the recommended default: it's user-owned (no other account can modify code that runs at your logon), on fast local disk, and machine-specific by Windows convention. Any custom path works, but avoid shared or network locations — see [SECURITY.md](../SECURITY.md).
4. Choose whether to auto-start with Claude Desktop.
5. The dashboard opens at `http://127.0.0.1:8765/`.

### Install as an app (PWA)

In Chrome/Edge, click the **install icon** in the address bar (or menu → "Install Claude Usage Tracker"). The dashboard gets its own window, taskbar icon, and appears in the Start menu. Works fully offline.

## Portable mode (no install)

Run **`start.bat`** directly from the repo folder. Everything works the same; data lands in `data/` beside the scripts.

## Auto-start with Claude Desktop

`install-autostart.bat` (also offered during setup) registers a user-level Scheduled Task — no admin rights needed. A background watcher then:

- opens the dashboard **once** when Claude Desktop launches (no tab spam on relaunches),
- refreshes data hourly in the background,
- restarts itself automatically if it crashes.

Remove with `uninstall-autostart.bat`. Watcher activity logs to `data\watch-claude.log`.

## Updating

1. Watch → Custom → Releases on GitHub to get notified.
2. Download the new release.
3. Re-run `setup.bat`, point it at the same install location.

Your `data/` directory (history, caches) is preserved across updates.

## Uninstall

1. Run `uninstall-autostart.bat` (if you enabled autostart).
2. Delete the install directory.

That's everything — no registry entries, no services, no leftovers besides the Scheduled Task the uninstaller removes.
