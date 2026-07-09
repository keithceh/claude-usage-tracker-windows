/**
 * Usage Limits panel.
 *
 * Anthropic's per-plan limits on Claude.ai are an opaque compute / cost-
 * time metric — NOT a raw message count. So this panel measures cost ($)
 * per rolling window as a proxy that's much closer to what Claude's
 * settings page shows. Message count is shown as a secondary stat for
 * context.
 *
 * Plans also enforce separate top-tier sub-caps on top of the overall cap.
 * Opus and Fable are tracked as INDEPENDENT sub-meters — both visible when
 * the plan carries a cap for them — so heavy Fable use never hides Opus
 * burn and vice versa.
 *
 * Data sources:
 *   window.__COST_EVENTS__   — [{t, source, model, cost}]
 *   window.__USER_MSG_TIMES__ — [{t, source, model}]
 *
 * Plan caps are public estimates, configurable per-user via the dropdown
 * (or "Custom"). Persisted in localStorage.
 */
(function () {
  const KEY = 'cut-limits-v4';

  // Plan caps tuned to Anthropic's published weekly-hours guidance,
  // translated to API-spend-equivalent dollars. Fable sub-caps default to
  // the same values as Opus (Anthropic has not published separate Fable
  // metering; calibrate via Custom if your account behaves differently).
  const PLANS = {
    free:   { label: 'Free',         per5h: 0.5, perWeek: 2,   opusPer5h: 0,  opusPerWeek: 0,   fablePer5h: 0,  fablePerWeek: 0   },
    pro:    { label: 'Pro',          per5h: 8,   perWeek: 40,  opusPer5h: 0,  opusPerWeek: 0,   fablePer5h: 0,  fablePerWeek: 0   },
    max5:   { label: 'Max 5×',       per5h: 40,  perWeek: 200, opusPer5h: 8,  opusPerWeek: 40,  fablePer5h: 8,  fablePerWeek: 40  },
    max20:  { label: 'Max 20×',      per5h: 160, perWeek: 800, opusPer5h: 32, opusPerWeek: 160, fablePer5h: 32, fablePerWeek: 160 },
    api:    { label: 'API (no cap)', per5h: 0,   perWeek: 0,   opusPer5h: 0,  opusPerWeek: 0,   fablePer5h: 0,  fablePerWeek: 0   },
    custom: { label: 'Custom',       per5h: 40,  perWeek: 200, opusPer5h: 8,  opusPerWeek: 40,  fablePer5h: 8,  fablePerWeek: 40  },
  };

  const DEFAULT_STATE = {
    plan: 'pro',
    custom5h: 40, customWeek: 200,
    customOpus5h: 8, customOpusWeek: 40,
    customFable5h: 8, customFableWeek: 40,
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULT_STATE };
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch { return { ...DEFAULT_STATE }; }
  }
  function saveState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }

  function effectiveCaps(state) {
    if (state.plan === 'custom') {
      return {
        per5h:        Number(state.custom5h)        || 0,
        perWeek:      Number(state.customWeek)      || 0,
        opusPer5h:    Number(state.customOpus5h)    || 0,
        opusPerWeek:  Number(state.customOpusWeek)  || 0,
        fablePer5h:   Number(state.customFable5h)   || 0,
        fablePerWeek: Number(state.customFableWeek) || 0,
      };
    }
    return PLANS[state.plan] || PLANS.pro;
  }

  // Independent premium-model matchers. Opus and Fable are metered on
  // separate sub-meters; Mythos counts with Fable (same underlying model).
  function isOpus(model)  { return typeof model === 'string' && /opus/i.test(model); }
  function isFable(model) { return typeof model === 'string' && /fable|mythos/i.test(model); }

  function formatDuration(ms) {
    if (ms <= 0) return 'now';
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    const remM = m % 60;
    if (h < 24) return remM ? `${h}h ${remM}m` : `${h}h`;
    const d = Math.floor(h / 24);
    const remH = h % 24;
    return remH ? `${d}d ${remH}h` : `${d}d`;
  }

  function fmtMoney(v) {
    if (v >= 100) return '$' + v.toFixed(0);
    if (v >= 10)  return '$' + v.toFixed(1);
    return '$' + v.toFixed(2);
  }

  function subMeterHTML(kind, label) {
    return `
      <div class="limit-sub limit-sub-${kind}" style="display:none">
        <div class="limit-sub-head">
          <span class="limit-sub-label">${label}</span>
          <span class="limit-sub-count"><span class="limit-sub-used">$0</span><span class="limit-of"> / <span class="limit-sub-cap">—</span></span></span>
        </div>
        <div class="limit-bar limit-bar-sub"><div class="limit-bar-fill" style="width:0%"></div></div>
      </div>`;
  }

  function cardHTML(id, title) {
    return `
      <div class="limit-card" id="${id}">
        <div class="limit-card-head">
          <span class="limit-label">${title}</span>
          <span class="limit-count"><span class="limit-used">$0</span><span class="limit-of"> / <span class="limit-cap">—</span></span></span>
        </div>
        <div class="limit-bar limit-bar-main"><div class="limit-bar-fill" style="width:0%"></div></div>
        <div class="limit-meta">
          <span><strong class="limit-pct">0%</strong> used</span>
          <span>Resets in <strong class="limit-reset">—</strong></span>
        </div>
        ${subMeterHTML('opus', 'Opus')}
        ${subMeterHTML('fable', 'Fable')}
        <div class="limit-secondary"><span class="limit-msgs">0</span> messages</div>
      </div>`;
  }

  function ensurePlaceholder() {
    if (document.getElementById('limits-section')) return;
    const section = document.createElement('div');
    section.className = 'limits-section';
    section.id = 'limits-section';
    section.innerHTML = `
      <div class="limits-header">
        <h3>Plan Usage Limits</h3>
        <div class="limits-plan">
          <label for="limits-plan-sel">Plan</label>
          <select id="limits-plan-sel"></select>
        </div>
      </div>
      <div class="limits-custom" id="limits-custom" style="display:none">
        <label>5h cap $ <input type="number" id="limits-custom-5h" min="0" step="1" /></label>
        <label>Weekly cap $ <input type="number" id="limits-custom-week" min="0" step="1" /></label>
        <label>Opus 5h $ <input type="number" id="limits-custom-opus-5h" min="0" step="1" /></label>
        <label>Opus weekly $ <input type="number" id="limits-custom-opus-week" min="0" step="1" /></label>
        <label>Fable 5h $ <input type="number" id="limits-custom-fable-5h" min="0" step="1" /></label>
        <label>Fable weekly $ <input type="number" id="limits-custom-fable-week" min="0" step="1" /></label>
      </div>
      <div class="limits-grid">
        ${cardHTML('limit-5h', '5-hour window')}
        ${cardHTML('limit-week', 'Weekly (rolling 7 days)')}
      </div>
      <div class="limits-calibrate">
        <div class="limits-calibrate-row">
          <label>Claude shows
            <input type="number" id="limits-calibrate-5h-pct" min="1" max="100" step="1" placeholder="—" />%
            for 5-hour →
          </label>
          <button type="button" id="limits-calibrate-5h-btn">calibrate 5h</button>
        </div>
        <div class="limits-calibrate-row">
          <label>Claude shows
            <input type="number" id="limits-calibrate-week-pct" min="1" max="100" step="1" placeholder="—" />%
            for weekly →
          </label>
          <button type="button" id="limits-calibrate-week-btn">calibrate weekly</button>
        </div>
        <div class="limits-calibrate-msg" id="limits-calibrate-msg"></div>
      </div>
      <div class="limits-footer">
        Caps are public estimates of compute budget in $-equivalent API spend,
        based on Anthropic's published per-plan hours guidance. For exact
        remaining capacity, check Anthropic's settings page on claude.ai and
        use the calibrate buttons to lock in your real cap.
      </div>
    `;
    const container = document.querySelector('.container');
    const anchor = container?.querySelector('.stats-grid') || container?.firstElementChild;
    if (anchor && anchor.parentElement) {
      anchor.parentElement.insertBefore(section, anchor.nextSibling);
    } else if (container) {
      container.appendChild(section);
    }
  }

  function populatePlanDropdown(state) {
    const sel = document.getElementById('limits-plan-sel');
    if (!sel || sel.dataset.populated) return;
    sel.dataset.populated = '1';
    for (const [key, p] of Object.entries(PLANS)) {
      const o = document.createElement('option');
      o.value = key;
      o.textContent = p.label;
      sel.appendChild(o);
    }
    sel.value = state.plan;
    sel.addEventListener('change', () => {
      state.plan = sel.value;
      saveState(state);
      render(state);
    });

    // Custom-cap inputs
    [
      ['limits-custom-5h',         'custom5h'],
      ['limits-custom-week',       'customWeek'],
      ['limits-custom-opus-5h',    'customOpus5h'],
      ['limits-custom-opus-week',  'customOpusWeek'],
      ['limits-custom-fable-5h',   'customFable5h'],
      ['limits-custom-fable-week', 'customFableWeek'],
    ].forEach(([id, field]) => {
      const inp = document.getElementById(id);
      inp.value = state[field];
      inp.addEventListener('input', () => {
        state[field] = Number(inp.value) || 0;
        saveState(state);
        render(state);
      });
    });

    // Calibrate buttons — back-compute the implied cap from a user-entered
    // "Claude.ai shows X% used" reading. Math: cap = used / (pct / 100).
    // Every outcome (success or why-not) is reported in the message line —
    // silent no-ops made this feature look broken.
    function say(msg, ok) {
      const el = document.getElementById('limits-calibrate-msg');
      if (!el) return;
      el.textContent = msg;
      el.classList.toggle('ok', !!ok);
    }
    function calibrate(windowMs, pctInputId, field, inputId, label) {
      const pctEl = document.getElementById(pctInputId);
      const pct = Number(pctEl.value);
      if (!pct || pct <= 0 || pct > 100) {
        say(`Enter the ${label} percentage from claude.ai (1–100) first.`);
        return;
      }
      const events = window.__COST_EVENTS__ || [];
      const since = Date.now() - windowMs;
      const cost = sumCostInWindow(events, since);
      if (cost <= 0) {
        const newest = events.length ? events[events.length - 1].t : 0;
        const ageMin = newest ? Math.round((Date.now() - newest) / 60000) : null;
        say(ageMin !== null && ageMin > windowMs / 60000
          ? `No usage inside the ${label} window — newest data is ${ageMin} min old. Hit refresh, then calibrate.`
          : `No usage recorded in the ${label} window yet — use Claude a bit, refresh, then calibrate.`);
        return;
      }
      const impliedCap = cost / (pct / 100);
      state.plan = 'custom';
      state[field] = Math.round(impliedCap * 100) / 100;
      saveState(state);
      document.getElementById('limits-plan-sel').value = 'custom';
      const inp = document.getElementById(inputId);
      if (inp) inp.value = state[field];
      render(state);
      say(`${label} cap calibrated: ${fmtMoney(state[field])} (from ${fmtMoney(cost)} at ${pct}%). Plan switched to Custom.`, true);
    }
    document.getElementById('limits-calibrate-5h-btn').addEventListener('click',
      () => calibrate(5 * 3600 * 1000, 'limits-calibrate-5h-pct', 'custom5h', 'limits-custom-5h', '5-hour'));
    document.getElementById('limits-calibrate-week-btn').addEventListener('click',
      () => calibrate(7 * 86400 * 1000, 'limits-calibrate-week-pct', 'customWeek', 'limits-custom-week', 'weekly'));
  }

  function sumCostInWindow(events, sinceMs, predicate) {
    let s = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].t < sinceMs) break; // sorted ascending
      if (predicate && !predicate(events[i])) continue;
      s += events[i].cost;
    }
    return s;
  }

  function countMsgsInWindow(times, sinceMs) {
    let n = 0;
    for (let i = times.length - 1; i >= 0; i--) {
      if (times[i].t >= sinceMs) n++;
      else break;
    }
    return n;
  }

  function oldestInWindow(items, sinceMs) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].t >= sinceMs) return items[i].t;
    }
    return null;
  }

  function render(state) {
    const events = window.__COST_EVENTS__ || [];
    const times = window.__USER_MSG_TIMES__ || [];
    if (!Array.isArray(events) || !Array.isArray(times)) return;

    const now = Date.now();
    const FIVE_H = 5 * 3600 * 1000;
    const WEEK = 7 * 86400 * 1000;
    const since5 = now - FIVE_H;
    const sinceW = now - WEEK;

    const caps = effectiveCaps(state);
    const customWrap = document.getElementById('limits-custom');
    if (customWrap) customWrap.style.display = state.plan === 'custom' ? '' : 'none';

    function paintBar(fillEl, used, cap) {
      const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
      fillEl.style.width = pct + '%';
      fillEl.classList.remove('warn', 'danger');
      if (cap > 0 && pct >= 90) fillEl.classList.add('danger');
      else if (cap > 0 && pct >= 70) fillEl.classList.add('warn');
      return pct;
    }

    function paintSub(card, kind, used, cap) {
      const el = card.querySelector('.limit-sub-' + kind);
      if (!el) return;
      if (cap > 0) {
        el.style.display = '';
        el.querySelector('.limit-sub-used').textContent = fmtMoney(used);
        el.querySelector('.limit-sub-cap').textContent = fmtMoney(cap);
        paintBar(el.querySelector('.limit-bar-fill'), used, cap);
      } else {
        el.style.display = 'none';
      }
    }

    function paintCard(cardId, sinceMs, windowMs, subCaps) {
      const el = document.getElementById(cardId);
      if (!el) return;
      const usedCost = sumCostInWindow(events, sinceMs);
      const cap = subCaps.total;
      const msgs = countMsgsInWindow(times, sinceMs);
      const oldestTs = oldestInWindow(events, sinceMs) || oldestInWindow(times, sinceMs);

      el.querySelector('.limit-used').textContent = fmtMoney(usedCost);
      el.querySelector('.limit-cap').textContent = cap > 0 ? fmtMoney(cap) : '∞';
      const pct = paintBar(el.querySelector('.limit-bar-main > .limit-bar-fill'), usedCost, cap);
      el.querySelector('.limit-pct').textContent = (cap > 0 ? pct.toFixed(0) : 0) + '%';
      const resetEl = el.querySelector('.limit-reset');
      if (cap === 0) resetEl.textContent = 'n/a';
      else if (oldestTs) resetEl.textContent = formatDuration((oldestTs + windowMs) - now);
      else resetEl.textContent = '—';
      el.querySelector('.limit-msgs').textContent = msgs.toLocaleString();

      paintSub(el, 'opus',  sumCostInWindow(events, sinceMs, ev => isOpus(ev.model)),  subCaps.opus);
      paintSub(el, 'fable', sumCostInWindow(events, sinceMs, ev => isFable(ev.model)), subCaps.fable);
    }

    paintCard('limit-5h',   since5, FIVE_H, { total: caps.per5h,   opus: caps.opusPer5h,   fable: caps.fablePer5h });
    paintCard('limit-week', sinceW, WEEK,   { total: caps.perWeek, opus: caps.opusPerWeek, fable: caps.fablePerWeek });
  }

  function init() {
    ensurePlaceholder();
    const state = loadState();
    populatePlanDropdown(state);
    render(state);
    setInterval(() => render(state), 60_000);
    window.cutUsageLimits = { rerender: () => render(state) };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
