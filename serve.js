#!/usr/bin/env node
/**
 * Tiny static file server for the Claude Usage Tracker dashboard.
 * Stdlib-only — no npm install required.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.PORT, 10) || 8765;
// Loopback only, not overridable: this server has unauthenticated control
// endpoints and serves usage data — binding wider would expose both LAN-wide.
const HOST = '127.0.0.1';
const ROOT = __dirname;

// Host-header allowlist. Kills DNS-rebinding: an attacker page whose domain
// resolves to 127.0.0.1 still sends its own domain in Host.
const ALLOWED_HOSTS = new Set([
  `127.0.0.1:${PORT}`, `localhost:${PORT}`, '127.0.0.1', 'localhost',
]);

// Cross-site request check for state-changing endpoints. Browsers send
// Sec-Fetch-Site on all fetches; absent (curl, old clients) or same-origin
// is fine, 'cross-site' is a drive-by webpage — reject.
function isCrossSite(req) {
  const sfs = req.headers['sec-fetch-site'];
  return !!sfs && sfs !== 'same-origin' && sfs !== 'none';
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  if (!ALLOWED_HOSTS.has(req.headers.host || '')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.parse(req.url).pathname);
  } catch {
    // Malformed percent-encoding (e.g. "/%") — without this, the throw
    // would kill the whole server process.
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (pathname === '/') pathname = '/dashboard.html';

  // Trigger a refresh of data.js by re-running the collector.
  if (pathname === '/__refresh') {
    if (isCrossSite(req)) { res.writeHead(403); res.end('Forbidden'); return; }
    const { spawn } = require('child_process');
    const p = spawn(process.execPath, [path.join(ROOT, 'collect-usage.js')], { cwd: ROOT });
    let out = '';
    p.stdout.on('data', d => out += d.toString());
    p.stderr.on('data', d => out += d.toString());
    p.on('close', code => {
      res.writeHead(code === 0 ? 200 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(out);
    });
    return;
  }

  // Autostart control. /__autostart/status returns JSON, install + uninstall
  // run the matching .bat. POST-only for the destructive actions.
  if (pathname.startsWith('/__autostart/')) {
    if (isCrossSite(req)) { res.writeHead(403); res.end('Forbidden'); return; }
    const verb = pathname.split('/')[2];
    if (verb === 'status') {
      // schtasks exits 0 if task exists, nonzero otherwise. Plain argv —
      // no shell quoting nightmare like the equivalent powershell call.
      const { execFile } = require('child_process');
      execFile(
        'schtasks.exe',
        ['/query', '/tn', 'ClaudeUsageTracker-Watcher', '/fo', 'LIST'],
        { cwd: ROOT, windowsHide: true },
        (err, stdout) => {
          const installed = !err;
          let state = null;
          if (installed) {
            const m = (stdout || '').match(/^Status:\s*(.+)$/m);
            if (m) state = m[1].trim();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ installed, state }));
        }
      );
      return;
    }
    if ((verb === 'install' || verb === 'uninstall') && req.method === 'POST') {
      const { spawn } = require('child_process');
      const bat = path.join(ROOT, verb === 'install' ? 'install-autostart.bat' : 'uninstall-autostart.bat');
      // /b runs without a new window; we feed `Y` on stdin so any `pause`
      // at the end of the bat doesn't hang the child.
      const p = spawn('cmd.exe', ['/c', bat], { cwd: ROOT });
      let out = '';
      p.stdout.on('data', d => out += d.toString());
      p.stderr.on('data', d => out += d.toString());
      p.stdin.end('\r\n');
      p.on('close', code => {
        res.writeHead(code === 0 ? 200 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(out);
      });
      return;
    }
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
    return;
  }

  // Path traversal guard. Compare against ROOT + separator so a sibling
  // directory (e.g. "...\Claude_Usage_Tracker_backup") can't slip past a
  // bare prefix match.
  const filePath = path.normalize(path.join(ROOT, pathname));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // Read into a buffer (rather than piping a ReadStream) so the file handle
  // closes immediately. On SMB shares an open ReadStream blocks concurrent
  // rename-over-existing writes by collect-usage.js, which causes silently
  // dropped data.js updates.
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + pathname);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': buf.length,
    });
    res.end(buf);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Claude Usage Dashboard running at http://${HOST}:${PORT}/`);
  console.log(`Press Ctrl+C to stop.`);
});
