/**
 * Auto-refresh: poll data/data.js every N seconds, reload page when the
 * `generated_at` timestamp differs from what's currently rendered.
 *
 * Pure DOM, deliberately not an ES module so it loads alongside main.js
 * without import-order coupling.
 */
(function () {
  const POLL_MS = 3_600_000; // 1 hour — manual refresh button is always available for sooner updates
  const KEY = 'cut-auto-refresh-v1';

  function getCurrentGeneratedAt() {
    return (window.__SUMMARY__ && window.__SUMMARY__.generated_at) || null;
  }

  function getEnabled() {
    try {
      const v = localStorage.getItem(KEY);
      return v === null ? true : v === '1';
    } catch { return true; }
  }
  function setEnabled(on) {
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
  }

  let refreshInFlight = false;

  async function check() {
    if (!getEnabled()) return;
    try {
      const res = await fetch('data/data.js?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const text = await res.text();
      // Parse just the generated_at out of the JS payload — we don't want
      // to eval the whole file in this scope.
      const m = text.match(/"generated_at"\s*:\s*"([^"]+)"/);
      if (!m) return;
      const remoteGenAt = m[1];
      const localGenAt = getCurrentGeneratedAt();
      if (localGenAt && remoteGenAt !== localGenAt) {
        // New data — quickest path is a full reload so all charts/tables
        // re-render off the new globals.
        location.reload();
        return;
      }
      // Self-heal stale data: if the background watcher is dead and data.js
      // is older than the poll interval, run the collector ourselves via the
      // server's /__refresh endpoint. Next poll sees the new generated_at
      // and reloads.
      if (!refreshInFlight && Date.now() - Date.parse(remoteGenAt) > POLL_MS + 300_000) {
        refreshInFlight = true;
        fetch('/__refresh').finally(() => { refreshInFlight = false; check(); });
      }
    } catch {}
  }

  // Expose a tiny hook so the customizer can offer a toggle if desired.
  window.cutAutoRefresh = { getEnabled, setEnabled, pollMs: POLL_MS };

  // First check after a short delay (let main.js paint), then on interval.
  setTimeout(check, 5000);
  setInterval(check, POLL_MS);
})();
