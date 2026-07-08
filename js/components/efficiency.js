/**
 * Efficiency Coach panel.
 *
 * Local heuristics only — reads window.__SESSION_METRICS__ (emitted by
 * collect-usage.js) and window.__COST_EVENTS__. No API calls.
 *
 * Live panel: tokens/session vs trailing baseline, $/hr pace, wasted steps
 * today, hygiene + model-fit flags, housekeeping score.
 * Weekly digest: rolling 7 days vs the 7 days before, with deltas.
 *
 * Budgets (max tokens/session, max $/day) come from the customizer's
 * localStorage state; 0 = off. Reuses .limit-bar warn/danger styling.
 */
(function () {
  // ── Heuristic thresholds (tune here) ──────────────────────
  // NOTE: baseline is a 14-day median, not 30-day — the collector's
  // extractor window is 14 days (MSG_WINDOW_MS). Honest label used in UI.
  const LONG_SESSION_MS   = 60 * 60 * 1000;      // "long session" for housekeeping score
  const MARATHON_MS       = 3 * 60 * 60 * 1000;  // hygiene flag: session longer than this
  const CACHE_RATIO_PCTL  = 0.9;                  // hygiene flag: cacheRead/in ratio above this percentile
  const MODELFIT_OUT_TOK  = 2000;                 // premium model with less output than this = overkill
  const PACE_WINDOW_MS    = 2 * 60 * 60 * 1000;  // $/hr pace lookback
  const CUSTOMIZER_KEY    = 'cut-customizer-v1';

  function sessions() { return Array.isArray(window.__SESSION_METRICS__) ? window.__SESSION_METRICS__ : []; }
  function workTokens(s) { return (s.tokens.in || 0) + (s.tokens.out || 0); }
  function wasted(s) { return s.rapidReprompts + s.dupPrompts + s.errorRetries; }
  function median(arr) {
    if (!arr.length) return 0;
    const a = [...arr].sort((x, y) => x - y);
    const mid = a.length >> 1;
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }
  function fmtTok(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(Math.round(n));
  }
  function budgets() {
    try {
      const st = JSON.parse(localStorage.getItem(CUSTOMIZER_KEY) || '{}');
      return { tokPerSession: Number(st.budgetTokensSession) || 0, dailyCost: Number(st.budgetDailyCost) || 0 };
    } catch { return { tokPerSession: 0, dailyCost: 0 }; }
  }

  function ensurePanel() {
    if (document.getElementById('efficiency-section')) return;
    const el = document.createElement('div');
    el.className = 'limits-section efficiency-section';
    el.id = 'efficiency-section';
    el.innerHTML = `
      <div class="limits-header"><h3 class="eff-title">Efficiency Coach</h3>
        <span class="eff-note">local heuristics · 14-day baseline</span></div>
      <div class="eff-grid" id="eff-live"></div>
      <div class="eff-flags" id="eff-flags"></div>
      <div class="eff-digest">
        <div class="eff-digest-title">This week vs last week</div>
        <div class="eff-digest-grid" id="eff-digest"></div>
      </div>`;
    // Dock the coach LEFT of Plan Usage Limits in a shared responsive row —
    // habit feedback should be the first thing the eye lands on.
    const limits = document.getElementById('limits-section');
    if (limits && limits.parentElement) {
      const row = document.createElement('div');
      row.className = 'coach-row';
      limits.parentElement.insertBefore(row, limits);
      row.appendChild(el);      // left column
      row.appendChild(limits);  // right column
      return;
    }
    const anchor = document.querySelector('.container .stats-grid') ||
                   document.querySelector('.container')?.firstElementChild;
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(el, anchor.nextSibling);
  }

  function statCard(label, value, sub, barPct, barState) {
    const bar = barPct === null ? '' :
      `<div class="limit-bar"><div class="limit-bar-fill ${barState || ''}" style="width:${Math.min(100, barPct)}%"></div></div>`;
    return `<div class="eff-card"><div class="eff-label">${label}</div>
      <div class="eff-value">${value}</div>${bar}<div class="eff-sub">${sub}</div></div>`;
  }

  function render() {
    const all = sessions();
    if (!all.length) return;
    const now = Date.now();
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const today = all.filter(s => s.end >= midnight.getTime());
    const b = budgets();

    // Tokens/session: today median vs 14d median
    const medToday = median(today.map(workTokens));
    const medBase  = median(all.map(workTokens));
    const tokState = b.tokPerSession > 0 && medToday > b.tokPerSession ? 'danger'
                   : medBase > 0 && medToday > medBase * 1.5 ? 'warn' : '';
    const tokPct = b.tokPerSession > 0 ? medToday / b.tokPerSession * 100
                 : medBase > 0 ? medToday / (medBase * 2) * 100 : 0;

    // $/hr pace over last 2h of cost events
    const events = window.__COST_EVENTS__ || [];
    let paceCost = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].t < now - PACE_WINDOW_MS) break;
      paceCost += events[i].cost;
    }
    const pace = paceCost / (PACE_WINDOW_MS / 3600000);

    // Daily cost vs budget — from cost events, not session totals: a
    // multi-day session ending today would otherwise dump its whole cost
    // into "today".
    let todayCost = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].t < midnight.getTime()) break;
      todayCost += events[i].cost;
    }
    const costState = b.dailyCost > 0 && todayCost > b.dailyCost ? 'danger'
                    : b.dailyCost > 0 && todayCost > b.dailyCost * 0.7 ? 'warn' : '';

    // Wasted steps today
    const wastedToday = today.reduce((s, x) => s + wasted(x), 0);
    const wastedBase = median(all.map(wasted));

    // Housekeeping score: long sessions today that compacted, resumed, or ended clean
    const longToday = today.filter(s => s.durationMs >= LONG_SESSION_MS);
    const kept = longToday.filter(s => s.compactCount > 0 || s.wasResumed || s.endedClean).length;
    const hkScore = longToday.length ? Math.round(kept / longToday.length * 100) : null;

    document.getElementById('eff-live').innerHTML =
      statCard('Tokens / session', fmtTok(medToday),
        `14-day median: ${fmtTok(medBase)}${b.tokPerSession ? ' · budget ' + fmtTok(b.tokPerSession) : ''}`,
        tokPct, tokState) +
      statCard('Burn rate', '$' + pace.toFixed(2) + '/hr',
        'pace over last 2 hours', null) +
      statCard('Spend today', '$' + todayCost.toFixed(2),
        b.dailyCost ? 'budget $' + b.dailyCost : 'no daily budget set',
        b.dailyCost ? todayCost / b.dailyCost * 100 : null, costState) +
      statCard('Wasted steps today', String(wastedToday),
        `re-prompts + duplicates + error-retries · typical session: ${wastedBase}`,
        null) +
      statCard('Housekeeping', hkScore === null ? '—' : hkScore + '%',
        hkScore === null ? 'no long sessions today' : 'long sessions compacted / resumed / ended clean',
        hkScore, hkScore !== null && hkScore < 50 ? 'warn' : '');

    // Flags
    const ratios = all.map(s => s.tokens.cacheRead / (s.tokens.in + 1)).sort((a, b2) => a - b2);
    const ratioCut = ratios[Math.floor(ratios.length * CACHE_RATIO_PCTL)] || Infinity;
    const DAY_MS = 86400000;
    const flags = [];
    for (const s of today) {
      const name = s.file.split('/')[0];
      // A session file spanning days is a resume-forever habit, not one
      // marathon sitting — different advice.
      if (s.durationMs >= DAY_MS)
        flags.push(`📆 <b>${name}</b> spans ${(s.durationMs / DAY_MS).toFixed(1)} days of resumes — start fresh sessions; resumed context re-reads burn cache tokens`);
      else if (s.durationMs >= MARATHON_MS)
        flags.push(`⏱ <b>${name}</b> ran ${(s.durationMs / 3600000).toFixed(1)}h — consider /compact or a fresh session`);
      else if (s.tokens.cacheRead / (s.tokens.in + 1) >= ratioCut && s.tokens.cacheRead > 1e6)
        flags.push(`♻ <b>${name}</b> cache-read heavy (${fmtTok(s.tokens.cacheRead)}) — long context re-reads; /compact would cut burn`);
      if (/opus|fable/i.test(s.model) && s.tokens.out > 0 && s.tokens.out < MODELFIT_OUT_TOK)
        flags.push(`🎯 <b>${name}</b> used ${s.model.replace('claude-', '')} for only ${fmtTok(s.tokens.out)} output tokens — Sonnet would have done`);
    }
    const MAX_FLAGS = 6;
    const shown = flags.slice(0, MAX_FLAGS);
    if (flags.length > MAX_FLAGS) shown.push(`… and ${flags.length - MAX_FLAGS} more`);
    document.getElementById('eff-flags').innerHTML =
      shown.length ? shown.map(f => `<div class="eff-flag">${f}</div>`).join('') :
      '<div class="eff-flag eff-flag-ok">✓ No inefficiency flags today</div>';

    // Weekly digest: rolling 7d vs prior 7d
    const wk = now - 7 * 86400000, wk2 = now - 14 * 86400000;
    const cur = all.filter(s => s.end >= wk);
    const prev = all.filter(s => s.end >= wk2 && s.end < wk);
    function agg(list) {
      return {
        'Sessions': list.length,
        'Work tokens': list.reduce((s, x) => s + workTokens(x), 0),
        'Cost': list.reduce((s, x) => s + x.cost, 0),
        'Wasted steps': list.reduce((s, x) => s + wasted(x), 0),
        'Compactions': list.reduce((s, x) => s + x.compactCount, 0),
        'Clean endings': list.length ? Math.round(list.filter(x => x.endedClean).length / list.length * 100) : 0,
      };
    }
    const A = agg(cur), B = agg(prev);
    // For these metrics, lower is better except Compactions and Clean endings.
    const higherBetter = new Set(['Compactions', 'Clean endings']);
    document.getElementById('eff-digest').innerHTML = Object.keys(A).map(k => {
      const a = A[k], p = B[k];
      const fmt = k === 'Cost' ? v => '$' + v.toFixed(2)
                : k === 'Work tokens' ? fmtTok
                : k === 'Clean endings' ? v => v + '%' : String;
      let delta = '';
      if (p > 0 || a > 0) {
        const up = a > p, same = a === p;
        const good = same ? null : (higherBetter.has(k) ? up : !up);
        delta = same ? '<span class="eff-delta">＝</span>'
          : `<span class="eff-delta ${good ? 'eff-good' : 'eff-bad'}">${up ? '▲' : '▼'} ${fmt(Math.abs(a - p))}</span>`;
      }
      return `<div class="eff-digest-cell"><div class="eff-label">${k}</div>
        <div class="eff-digest-val">${fmt(a)} ${delta}</div>
        <div class="eff-sub">last week: ${fmt(p)}</div></div>`;
    }).join('');
  }

  function init() {
    ensurePanel();
    render();
    setInterval(render, 60_000);
    window.addEventListener('cut-budgets-changed', render);
    window.cutEfficiency = { rerender: render };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
