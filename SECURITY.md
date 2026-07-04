# Security

## Model

- The dashboard server binds **127.0.0.1 only** (hardcoded, not configurable).
- `Host`-header allowlist defeats DNS rebinding; `Sec-Fetch-Site` checks defeat cross-site requests to the control endpoints; path traversal is guarded with a separator-anchored prefix check.
- The app reads local session logs and writes only inside its own `data/` directory.
- No secrets are stored or transmitted. Usage data never leaves the machine.

## Scope note

If you install to a location other users can write to (e.g. a network share), anyone with write access there can modify code that runs under your account. Install to a user-owned local path (the default) unless you control the share's ACLs.

## Reporting

Open a GitHub issue for non-sensitive reports. For anything sensitive, use GitHub's **private vulnerability reporting** on this repository (Security tab → Report a vulnerability).
