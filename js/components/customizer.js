/**
 * Layout & size customizer.
 *
 * Persists user choices in localStorage and applies them by setting CSS
 * custom properties on :root and data-* attributes on <body>. Pure DOM,
 * no framework, deliberately not an ES module so it loads before main.js
 * and the chart components can pick up the chart-height variable.
 */
(function () {
  const KEY = 'cut-customizer-v1';
  const DEFAULTS = {
    scale: 1,            // font-size scale 0.85 — 1.3
    density: 1,          // padding multiplier 0.6 — 1.6
    width: 'standard',   // narrow | standard | wide | full
    chartHeight: 320,    // px
    show: {
      stats: true,
      limits: true,
      efficiency: true,
      dailyChart: true,
      chartsHalf: true,
      heatmap: true,
      expensive: true,
      sessions: true,
    },
    autoRefresh: true,
    budgetTokensSession: 0, // 0 = no budget
    budgetDailyCost: 0,     // $, 0 = no budget
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULTS,
        ...parsed,
        show: { ...DEFAULTS.show, ...(parsed.show || {}) },
      };
    } catch { return structuredClone(DEFAULTS); }
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }

  function apply(state) {
    const root = document.documentElement;
    root.style.setProperty('--cust-scale', state.scale);
    root.style.setProperty('--cust-density', state.density);
    root.style.setProperty('--cust-chart-h', state.chartHeight + 'px');

    const container = document.querySelector('.container');
    if (container) container.dataset.width = state.width;

    const body = document.body;
    body.dataset.showStats      = String(state.show.stats);
    body.dataset.showLimits     = String(state.show.limits);
    body.dataset.showEfficiency = String(state.show.efficiency);
    body.dataset.showDailyChart = String(state.show.dailyChart);
    body.dataset.showChartsHalf = String(state.show.chartsHalf);
    body.dataset.showHeatmap    = String(state.show.heatmap);
    body.dataset.showExpensive  = String(state.show.expensive);
    body.dataset.showSessions   = String(state.show.sessions);

    // Auto-refresh toggle bridges to auto-refresh.js's exposed API.
    if (window.cutAutoRefresh && typeof window.cutAutoRefresh.setEnabled === 'function') {
      window.cutAutoRefresh.setEnabled(state.autoRefresh);
    }

    // Nudge chart.js to redraw at the new size, if it's already rendered.
    setTimeout(() => {
      try {
        if (window.Chart && window.Chart.instances) {
          Object.values(window.Chart.instances).forEach(c => c.resize());
        }
      } catch {}
    }, 50);
  }

  function buildPanel(state, onChange) {
    const panel = document.createElement('div');
    panel.className = 'cust-panel';
    panel.innerHTML = `
      <h2>Customize <button class="cust-close" type="button" aria-label="Close">×</button></h2>

      <div class="cust-section">
        <div class="cust-section-title">Layout</div>
        <div class="cust-row">
          <label>Width</label>
          <div class="cust-seg" data-prop="width">
            <button data-val="narrow">Narrow</button>
            <button data-val="standard">Standard</button>
            <button data-val="wide">Wide</button>
            <button data-val="full">Full</button>
          </div>
        </div>
      </div>

      <div class="cust-section">
        <div class="cust-section-title">Size</div>
        <div class="cust-row">
          <label>Font scale <span class="cust-val" data-show="scale"></span></label>
          <input type="range" class="cust-range" data-prop="scale" min="0.85" max="1.3" step="0.05" />
        </div>
        <div class="cust-row">
          <label>Density <span class="cust-val" data-show="density"></span></label>
          <input type="range" class="cust-range" data-prop="density" min="0.6" max="1.6" step="0.1" />
        </div>
        <div class="cust-row">
          <label>Chart height <span class="cust-val" data-show="chartHeight"></span></label>
          <input type="range" class="cust-range" data-prop="chartHeight" min="200" max="600" step="20" />
        </div>
      </div>

      <div class="cust-section">
        <div class="cust-section-title">Sections</div>
        <div class="cust-row"><label>Stat cards</label><div class="cust-toggle" data-show="stats"></div></div>
        <div class="cust-row"><label>Plan usage limits</label><div class="cust-toggle" data-show="limits"></div></div>
        <div class="cust-row"><label>Efficiency coach</label><div class="cust-toggle" data-show="efficiency"></div></div>
        <div class="cust-row"><label>Daily chart</label><div class="cust-toggle" data-show="dailyChart"></div></div>
        <div class="cust-row"><label>Source / Model charts</label><div class="cust-toggle" data-show="chartsHalf"></div></div>
        <div class="cust-row"><label>Peak hours heatmap</label><div class="cust-toggle" data-show="heatmap"></div></div>
        <div class="cust-row"><label>Most expensive callout</label><div class="cust-toggle" data-show="expensive"></div></div>
        <div class="cust-row"><label>Session log</label><div class="cust-toggle" data-show="sessions"></div></div>
      </div>

      <div class="cust-section">
        <div class="cust-section-title">Behavior</div>
        <div class="cust-row"><label>Auto-refresh data (hourly)</label><div class="cust-toggle" data-bool="autoRefresh"></div></div>
      </div>

      <div class="cust-section">
        <div class="cust-section-title">Efficiency budgets (0 = off)</div>
        <div class="cust-row"><label>Max tokens / session</label>
          <input type="number" class="cust-num" data-num="budgetTokensSession" min="0" step="1000" /></div>
        <div class="cust-row"><label>Max $ / day</label>
          <input type="number" class="cust-num" data-num="budgetDailyCost" min="0" step="5" /></div>
      </div>

      <div class="cust-section" id="cust-autostart-section">
        <div class="cust-section-title">Auto-start with Claude</div>
        <div class="cust-row">
          <label>Status: <span id="cust-autostart-status">checking…</span></label>
        </div>
        <button class="cust-action" id="cust-autostart-install" type="button">Install autostart</button>
        <button class="cust-action cust-action-warn" id="cust-autostart-uninstall" type="button">Remove autostart</button>
        <div class="cust-hint" id="cust-autostart-msg"></div>
      </div>

      <button class="cust-reset" type="button">Reset to defaults</button>
    `;

    function refresh() {
      // Segmented controls
      panel.querySelectorAll('.cust-seg').forEach(seg => {
        const prop = seg.dataset.prop;
        seg.querySelectorAll('button').forEach(b => {
          b.classList.toggle('active', b.dataset.val === String(state[prop]));
        });
      });
      // Ranges
      panel.querySelectorAll('input[type=range]').forEach(r => {
        const prop = r.dataset.prop;
        r.value = state[prop];
      });
      panel.querySelectorAll('.cust-val').forEach(span => {
        const k = span.dataset.show;
        if (k === 'chartHeight') span.textContent = state[k] + 'px';
        else span.textContent = Number(state[k]).toFixed(2);
      });
      // Toggles
      panel.querySelectorAll('.cust-toggle[data-show]').forEach(t => {
        t.classList.toggle('on', !!state.show[t.dataset.show]);
      });
      panel.querySelectorAll('.cust-toggle[data-bool]').forEach(t => {
        t.classList.toggle('on', !!state[t.dataset.bool]);
      });
      // Budget number inputs
      panel.querySelectorAll('input.cust-num[data-num]').forEach(inp => {
        inp.value = state[inp.dataset.num] || 0;
      });
    }

    // Budget inputs persist on change and nudge the efficiency panel.
    panel.addEventListener('input', e => {
      const num = e.target.closest('input.cust-num[data-num]');
      if (!num) return;
      state[num.dataset.num] = Math.max(0, Number(num.value) || 0);
      onChange();
      window.dispatchEvent(new Event('cut-budgets-changed'));
    });

    panel.addEventListener('click', e => {
      const segBtn = e.target.closest('.cust-seg button');
      if (segBtn) {
        const prop = segBtn.parentElement.dataset.prop;
        state[prop] = segBtn.dataset.val;
        onChange(); refresh();
        return;
      }
      const tog = e.target.closest('.cust-toggle[data-show]');
      if (tog) {
        const k = tog.dataset.show;
        state.show[k] = !state.show[k];
        onChange(); refresh();
        return;
      }
      const togBool = e.target.closest('.cust-toggle[data-bool]');
      if (togBool) {
        const k = togBool.dataset.bool;
        state[k] = !state[k];
        onChange(); refresh();
        return;
      }
      if (e.target.id === 'cust-autostart-install') {
        autostartAction('install');
        return;
      }
      if (e.target.id === 'cust-autostart-uninstall') {
        autostartAction('uninstall');
        return;
      }
      if (e.target.classList.contains('cust-reset')) {
        Object.assign(state, structuredClone(DEFAULTS));
        onChange(); refresh();
        return;
      }
      if (e.target.classList.contains('cust-close')) {
        panel.classList.remove('open');
        document.querySelector('.cust-backdrop')?.classList.remove('open');
      }
    });

    panel.addEventListener('input', e => {
      if (e.target.matches('input[type=range]')) {
        const prop = e.target.dataset.prop;
        const v = e.target.valueAsNumber;
        state[prop] = (prop === 'chartHeight') ? Math.round(v) : v;
        onChange(); refresh();
      }
    });

    refresh();
    return panel;
  }

  async function autostartStatus() {
    const statusEl = document.getElementById('cust-autostart-status');
    if (!statusEl) return;
    try {
      const res = await fetch('/__autostart/status', { cache: 'no-store' });
      if (!res.ok) throw 0;
      const j = await res.json();
      statusEl.textContent = j.installed ? `installed (${j.state || 'active'})` : 'not installed';
      statusEl.style.color = j.installed ? '#34d399' : '#94a3b8';
    } catch {
      statusEl.textContent = 'unknown';
      statusEl.style.color = '#fb7185';
    }
  }

  async function autostartAction(verb) {
    const msgEl = document.getElementById('cust-autostart-msg');
    if (msgEl) msgEl.textContent = verb === 'install' ? 'Installing…' : 'Removing…';
    try {
      const res = await fetch('/__autostart/' + verb, { method: 'POST' });
      const text = await res.text();
      if (msgEl) msgEl.textContent = res.ok ? 'Done. ' + text.split('\n').slice(-3).join(' ') : 'Failed: ' + text;
    } catch (e) {
      if (msgEl) msgEl.textContent = 'Error: ' + e.message;
    }
    autostartStatus();
  }

  function init() {
    const state = load();
    apply(state);

    const fab = document.createElement('button');
    fab.className = 'cust-fab';
    fab.type = 'button';
    fab.title = 'Customize layout & size';
    fab.setAttribute('aria-label', 'Customize layout');
    fab.innerHTML = `
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    `;

    const backdrop = document.createElement('div');
    backdrop.className = 'cust-backdrop';

    const panel = buildPanel(state, () => { save(state); apply(state); });

    fab.addEventListener('click', () => {
      panel.classList.add('open');
      backdrop.classList.add('open');
    });
    backdrop.addEventListener('click', () => {
      panel.classList.remove('open');
      backdrop.classList.remove('open');
    });

    document.body.appendChild(fab);
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    // Initial autostart status fetch (and refresh whenever the panel opens).
    autostartStatus();
    fab.addEventListener('click', autostartStatus);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
