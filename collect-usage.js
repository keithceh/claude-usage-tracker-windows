#!/usr/bin/env node
/**
 * Claude Usage Collector v4 — Windows port (cross-platform)
 *
 * Original: https://github.com/658jjh/claude-usage-tracker
 *
 * Auto-detects which Claude tools are installed and parses their JSONL/log
 * files. On Windows, looks under %APPDATA% / %LOCALAPPDATA% in addition to
 * the macOS Library paths, so the same script works on either OS.
 *
 * Supported sources:
 *   OpenClaw / Clawdbot, Claude Code CLI, Claude Desktop, Cursor, Windsurf,
 *   Cline, Roo Code, Aider, Continue.dev
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const OUTPUT_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const CACHE_FILE = path.join(OUTPUT_DIR, 'sessions-cache.json');
const SCAN_INDEX_FILE = path.join(OUTPUT_DIR, 'scan-index.json');
const LOCK_FILE = path.join(OUTPUT_DIR, 'collect.lock');

// Prevent concurrent collector runs (e.g. watcher's 5-min timer firing
// while a manual `refresh.bat` is running) — they'd both write data.js
// and cache files at the same time and cause EPERM lock contention on
// the network share. The lock is a tiny file holding our PID; if it's
// older than 10 minutes we treat it as stale (previous process crashed)
// and steal it.
try {
  if (fs.existsSync(LOCK_FILE)) {
    let stale = false;
    try {
      const st = fs.statSync(LOCK_FILE);
      stale = (Date.now() - st.mtimeMs) > 10 * 60 * 1000;
    } catch { stale = true; }
    if (!stale) {
      console.log('Another collector run is in progress (lockfile present). Exiting.');
      process.exit(0);
    }
    try { fs.unlinkSync(LOCK_FILE); } catch {}
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
} catch (e) {
  console.warn(`Could not create lockfile: ${e.message}`);
}
const releaseLock = () => { try { fs.unlinkSync(LOCK_FILE); } catch {} };
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(130); });
process.on('SIGTERM', () => { releaseLock(); process.exit(143); });

const HOME = os.homedir();
const APPDATA = process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
const TZ_OFFSET = -new Date().getTimezoneOffset() / 60;

// ─── Helpers ─────────────────────────────────────────────

function toLocalDate(timestampMs) {
  if (!timestampMs) return null;
  const d = new Date(timestampMs + TZ_OFFSET * 3600000);
  return d.toISOString().split('T')[0];
}

function toLocalTime(timestampMs) {
  if (!timestampMs) return null;
  const d = new Date(timestampMs + TZ_OFFSET * 3600000);
  return d.toISOString().split('T')[1].substring(0, 5);
}

function parseTimestamp(ts) {
  if (!ts) return null;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

function getPricing(model) {
  if (!model) return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
  const m = model.toLowerCase();
  // Official Fable 5 API pricing (Anthropic, July 2026): $10/M input,
  // $50/M output, cache read $1/M (90% input discount), cache write
  // $12.50/M (standard 1.25x input).
  if (m.includes('fable'))
    return { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 1.0 };
  if (m.includes('opus-5'))
    return { input: 20, output: 100, cacheWrite: 25, cacheRead: 2.0 };
  if (m.includes('opus-4-5') || m.includes('opus-4.5') || m.includes('opus-4-6') || m.includes('opus-4.6') || m.includes('opus-4-7') || m.includes('opus-4.7') || m.includes('opus-4-8') || m.includes('opus-4.8') || m.includes('opus-4-9') || m.includes('opus-4.9'))
    return { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.50 };
  if (m.includes('opus-4-1') || m.includes('opus-4.1'))
    return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };
  if (m.includes('opus'))
    return { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.50 };
  if (m.includes('sonnet'))
    return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
  if (m.includes('haiku-4-5') || m.includes('haiku-4.5'))
    return { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.10 };
  if (m.includes('haiku'))
    return { input: 0.25, output: 1.25, cacheWrite: 0.30, cacheRead: 0.03 };
  return { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };
}

function findJsonl(dir, maxDepth = 10) {
  const results = [];
  if (maxDepth <= 0) return results;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.git')) {
        results.push(...findJsonl(fullPath, maxDepth - 1));
      } else if (entry.name.endsWith('.jsonl')) {
        // Note: previously filtered out "audit" filenames. Claude Desktop's
        // session logs are now named audit.jsonl, so we keep them.
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

function makeDayEntry() {
  return { cost: 0, input_tokens: 0, output_tokens: 0, cache_read: 0, cache_write: 0, models: new Set(), times: [] };
}

function cleanMessageText(text) {
  text = text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim();
  text = text.replace(/<[^>]+>/g, '').trim();
  text = text.replace(/^\[SUGGESTION MODE:[^\]]*\]\s*/i, '').trim();
  const cronMatch = text.match(/^\[cron:[a-f0-9-]+\s+([^\]]*)\]\s*(.*)/i);
  if (cronMatch) {
    text = cronMatch[1].trim() + (cronMatch[2] ? ' — ' + cronMatch[2].trim() : '');
  }
  return text;
}

function extractText(msg) {
  if (!msg || typeof msg !== 'object') return '';
  const content = msg.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    if (content.some(b => b.type === 'tool_result')) return '';
    const textBlock = content.find(c => c.type === 'text' && c.text && c.text.trim());
    return textBlock ? textBlock.text : '';
  }
  return '';
}

function extractSessionMeta(filePath) {
  const meta = { title: '', sessionId: '', cwd: '' };
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    let foundTitle = false;
    for (const line of lines) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (!meta.sessionId && entry.sessionId) meta.sessionId = entry.sessionId;
      if (!meta.cwd && entry.cwd) meta.cwd = entry.cwd;
      const msg = entry.message;
      if (!msg || typeof msg !== 'object') continue;
      const role = msg.role;
      if (role !== 'user' && role !== 'assistant') continue;
      if (foundTitle && meta.sessionId && meta.cwd) break;
      if (!foundTitle && role === 'user') {
        const rawText = extractText(msg);
        if (!rawText) continue;
        const text = cleanMessageText(rawText);
        if (!text) continue;
        meta.title = text.length > 80 ? text.substring(0, 77) + '...' : text;
        foundTitle = true;
      }
    }
  } catch {}
  if (!meta.sessionId) {
    const base = path.basename(filePath, '.jsonl');
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(base)) {
      meta.sessionId = base;
    }
  }
  return meta;
}

function pushSessions(sessions, dayData, source, fileName, meta, filePath) {
  meta = meta || {};
  for (const [date, data] of Object.entries(dayData)) {
    if (data.cost < 0.0001) continue;
    const models = [...data.models];
    const time = data.times.length > 0 ? data.times.sort()[0] : '00:00';
    const entry = {
      date,
      time,
      source,
      file: fileName,
      cost: parseFloat(data.cost.toFixed(4)),
      input_tokens: data.input_tokens,
      output_tokens: data.output_tokens,
      cache_read: data.cache_read,
      cache_write: data.cache_write,
      model: models[models.length - 1] || ''
    };
    if (filePath) entry.filePath = filePath;
    if (meta.title) entry.title = meta.title;
    if (meta.sessionId) entry.sessionId = meta.sessionId;
    if (meta.cwd) entry.cwd = meta.cwd;
    sessions.push(entry);
  }
}

// ─── Cache helpers ───────────────────────────────────────

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return [];
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const valid = data.filter(s =>
      s && typeof s.source === 'string' && typeof s.file === 'string' &&
      typeof s.date === 'string' && typeof s.cost === 'number'
    );
    for (const s of valid) { if (s.history) delete s.history; }
    return valid;
  } catch { return []; }
}

// Atomic-ish write for network shares. Strategy:
//   1. Write to .tmp
//   2. Try rename over the target
//   3. If rename fails (target locked by serve.js etc), retry up to 3 times
//      with a small backoff before giving up.
// Critically: never unlink the destination as a fallback — losing existing
// data is worse than failing to update it. Caller decides on retry.
function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data);
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fs.renameSync(tmp, filePath);
      return;
    } catch (e) {
      lastErr = e;
      // Busy-wait briefly. 50ms is plenty for serve.js to release its read.
      const until = Date.now() + 50 * (attempt + 1);
      while (Date.now() < until) { /* spin */ }
    }
  }
  // Couldn't rename. Try plain overwrite as a last resort — if it fails too,
  // throw and let the caller see it. .tmp may remain; we clean on success
  // paths only so a stale .tmp signals "the latest write didn't land."
  try {
    fs.writeFileSync(filePath, data);
    try { fs.unlinkSync(tmp); } catch {}
  } catch {
    throw lastErr;
  }
}

function saveCache(sessions) {
  try { atomicWrite(CACHE_FILE, JSON.stringify(sessions)); }
  catch (e) { console.warn(`⚠️  Could not save cache: ${e.message}`); }
}

function loadScanIndex() {
  try {
    if (!fs.existsSync(SCAN_INDEX_FILE)) return {};
    const data = JSON.parse(fs.readFileSync(SCAN_INDEX_FILE, 'utf-8'));
    return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
  } catch { return {}; }
}

function saveScanIndex(index) {
  try { atomicWrite(SCAN_INDEX_FILE, JSON.stringify(index)); }
  catch (e) { console.warn(`⚠️  Could not save scan index: ${e.message}`); }
}

let _scanIndex = {};
let _newScanIndex = {};
let _cachedByFilePath = new Map();
const _seenFilePaths = new Set();
let _skipCount = 0;
let _parseCount = 0;

function processJsonlFile(sessions, source, fullPath, parser) {
  let stat;
  try { stat = fs.statSync(fullPath); } catch { return; }
  _seenFilePaths.add(fullPath);
  const prev = _scanIndex[fullPath];
  const cached = _cachedByFilePath.get(fullPath);
  if (prev && cached && prev.mtime === stat.mtimeMs && prev.size === stat.size) {
    for (const entry of cached) sessions.push(entry);
    _newScanIndex[fullPath] = prev;
    _skipCount++;
    return;
  }
  try {
    const dayData = parser(fullPath);
    const meta = extractSessionMeta(fullPath);
    pushSessions(sessions, dayData, source, path.basename(fullPath), meta, fullPath);
    _newScanIndex[fullPath] = { mtime: stat.mtimeMs, size: stat.size };
    _parseCount++;
  } catch (e) {
    console.error(`  Error: ${fullPath}: ${e.message}`);
  }
}

// ─── Parsers ─────────────────────────────────────────────

function parseOpenClawFormat(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  const dayData = {};
  let fallbackDate = null;
  try { fallbackDate = toLocalDate(fs.statSync(filePath).mtimeMs); } catch {}
  for (const line of lines) {
    let entry; try { entry = JSON.parse(line); } catch { continue; }
    const msg = entry.message;
    const usage = (msg && msg.usage) || entry.usage;
    if (!usage) continue;
    if (!usage.cost && !usage.input && !usage.output) continue;
    let tsMs = parseTimestamp(entry.timestamp) || parseTimestamp(msg && msg.timestamp);
    let date = tsMs ? toLocalDate(tsMs) : fallbackDate;
    let time = tsMs ? toLocalTime(tsMs) : '00:00';
    if (!date) continue;
    if (!dayData[date]) dayData[date] = makeDayEntry();
    const dd = dayData[date];
    if (time) dd.times.push(time);
    const model = (msg && msg.model) || entry.model || '';
    if (model && model.startsWith('claude')) dd.models.add(model);
    if (usage.cost && usage.cost.total) {
      dd.cost += usage.cost.total;
    } else {
      const pricing = getPricing(model);
      const inp = usage.input || 0, out = usage.output || 0;
      const cr = usage.cacheRead || 0, cw = usage.cacheWrite || 0;
      dd.cost += (inp * pricing.input + out * pricing.output + cw * pricing.cacheWrite + cr * pricing.cacheRead) / 1000000;
    }
    dd.input_tokens += (usage.input || 0);
    dd.output_tokens += (usage.output || 0);
    dd.cache_read += (usage.cacheRead || 0);
    dd.cache_write += (usage.cacheWrite || 0);
  }
  return dayData;
}

function parseClaudeCodeFormat(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  const dayData = {};
  let fallbackDate = null;
  try { fallbackDate = toLocalDate(fs.statSync(filePath).mtimeMs); } catch {}
  for (const line of lines) {
    let entry; try { entry = JSON.parse(line); } catch { continue; }
    const msg = entry.message;
    const usage = (msg && msg.usage) || entry.usage;
    if (!usage) continue;
    const inputTok = usage.input_tokens || 0;
    const outputTok = usage.output_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    if (inputTok === 0 && outputTok === 0 && cacheRead === 0 && cacheWrite === 0) continue;
    let tsMs = parseTimestamp(entry.timestamp)
      || parseTimestamp(entry._audit_timestamp)
      || parseTimestamp(msg && msg.timestamp);
    let date = tsMs ? toLocalDate(tsMs) : fallbackDate;
    let time = tsMs ? toLocalTime(tsMs) : '00:00';
    if (!date) continue;
    if (!dayData[date]) dayData[date] = makeDayEntry();
    const dd = dayData[date];
    if (time) dd.times.push(time);
    const model = (msg && msg.model) || entry.model || '';
    if (model && model.startsWith('claude')) dd.models.add(model);
    dd.input_tokens += inputTok;
    dd.output_tokens += outputTok;
    dd.cache_read += cacheRead;
    dd.cache_write += cacheWrite;
    const pricing = getPricing(model);
    dd.cost += (inputTok * pricing.input + outputTok * pricing.output + cacheWrite * pricing.cacheWrite + cacheRead * pricing.cacheRead) / 1000000;
  }
  return dayData;
}

function parseAiderFormat(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  const dayData = {};
  let fallbackDate = null;
  try { fallbackDate = toLocalDate(fs.statSync(filePath).mtimeMs); } catch {}
  for (const line of lines) {
    let entry; try { entry = JSON.parse(line); } catch { continue; }
    const usage = entry.usage || entry.response?.usage;
    if (!usage) continue;
    const inputTok = usage.prompt_tokens || usage.input_tokens || 0;
    const outputTok = usage.completion_tokens || usage.output_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    if (inputTok === 0 && outputTok === 0) continue;
    let tsMs = parseTimestamp(entry.timestamp) || parseTimestamp(entry.created);
    if (entry.created && typeof entry.created === 'number' && entry.created < 2000000000) {
      tsMs = entry.created * 1000;
    }
    let date = tsMs ? toLocalDate(tsMs) : fallbackDate;
    let time = tsMs ? toLocalTime(tsMs) : '00:00';
    if (!date) continue;
    if (!dayData[date]) dayData[date] = makeDayEntry();
    const dd = dayData[date];
    if (time) dd.times.push(time);
    const model = entry.model || '';
    if (model && model.includes('claude')) dd.models.add(model);
    dd.input_tokens += inputTok;
    dd.output_tokens += outputTok;
    dd.cache_read += cacheRead;
    dd.cache_write += cacheWrite;
    const pricing = getPricing(model);
    dd.cost += (inputTok * pricing.input + outputTok * pricing.output + cacheWrite * pricing.cacheWrite + cacheRead * pricing.cacheRead) / 1000000;
  }
  return dayData;
}

function parseContinueFormat(filePath) {
  const dayData = {};
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const steps = data.steps || data.history || [];
    for (const step of steps) {
      const usage = step.usage || step.promptTokens ? { input_tokens: step.promptTokens || 0, output_tokens: step.completionTokens || 0 } : null;
      if (!usage && !step.tokens) continue;
      const inputTok = usage?.input_tokens || step.promptTokens || 0;
      const outputTok = usage?.output_tokens || step.completionTokens || 0;
      if (inputTok === 0 && outputTok === 0) continue;
      let tsMs = parseTimestamp(step.timestamp) || parseTimestamp(data.dateCreated);
      let date = tsMs ? toLocalDate(tsMs) : null;
      let time = tsMs ? toLocalTime(tsMs) : '00:00';
      if (!date) {
        try { date = toLocalDate(fs.statSync(filePath).mtimeMs); } catch { continue; }
      }
      if (!dayData[date]) dayData[date] = makeDayEntry();
      const dd = dayData[date];
      if (time) dd.times.push(time);
      const model = step.model || data.model || '';
      if (model && model.includes('claude')) dd.models.add(model);
      dd.input_tokens += inputTok;
      dd.output_tokens += outputTok;
      const pricing = getPricing(model);
      dd.cost += (inputTok * pricing.input + outputTok * pricing.output) / 1000000;
    }
  } catch {}
  return dayData;
}

// ─── Source Collectors ───────────────────────────────────
//
// On Windows, dotted-name dirs like ~/.openclaw still work because the
// OpenClaw / Aider / Continue CLIs create them under %USERPROFILE%. The
// Library/Application Support paths are macOS-only — Windows equivalents
// live under %APPDATA% (Roaming) for these apps.

function collectOpenClaw() {
  const sessions = [];
  const seen = new Set();
  for (const dirName of ['openclaw', 'clawdbot']) {
    const sessDir = path.join(HOME, `.${dirName}`, 'agents', 'main', 'sessions');
    if (!fs.existsSync(sessDir)) continue;
    const source = dirName === 'openclaw' ? 'OpenClaw' : 'Clawdbot';
    for (const file of fs.readdirSync(sessDir).filter(f => f.endsWith('.jsonl'))) {
      if (seen.has(file)) continue;
      seen.add(file);
      processJsonlFile(sessions, source, path.join(sessDir, file), parseOpenClawFormat);
    }
  }
  return sessions;
}

function collectClaudeCode() {
  const sessions = [];
  const claudeDir = path.join(HOME, '.claude', 'projects');
  if (!fs.existsSync(claudeDir)) return sessions;
  for (const fp of findJsonl(claudeDir)) {
    processJsonlFile(sessions, 'Claude Code', fp, parseClaudeCodeFormat);
  }
  return sessions;
}

function collectClaudeDesktop() {
  const sessions = [];
  const dirs = [
    path.join(APPDATA, 'Claude', 'local-agent-mode-sessions'),
    path.join(HOME, 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const fp of findJsonl(dir)) {
      processJsonlFile(sessions, 'Claude Desktop', fp, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectCursor() {
  const sessions = [];
  const dirs = [
    path.join(HOME, '.cursor', 'projects'),
    path.join(APPDATA, 'Cursor', 'User', 'workspaceStorage'),
    path.join(HOME, 'Library', 'Application Support', 'Cursor', 'User', 'workspaceStorage'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const fp of findJsonl(dir)) {
      processJsonlFile(sessions, 'Cursor', fp, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectWindsurf() {
  const sessions = [];
  const dirs = [
    path.join(HOME, '.windsurf', 'projects'),
    path.join(HOME, '.windsurf'),
    path.join(APPDATA, 'Windsurf', 'User', 'workspaceStorage'),
    path.join(HOME, 'Library', 'Application Support', 'Windsurf', 'User', 'workspaceStorage'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const fp of findJsonl(dir)) {
      processJsonlFile(sessions, 'Windsurf', fp, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectCline() {
  const sessions = [];
  const dirs = [
    path.join(HOME, '.cline'),
    path.join(APPDATA, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev'),
    path.join(APPDATA, 'Code', 'User', 'globalStorage', 'cline.cline'),
    path.join(HOME, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev'),
    path.join(HOME, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'cline.cline'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const fp of findJsonl(dir)) {
      processJsonlFile(sessions, 'Cline', fp, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectRooCode() {
  const sessions = [];
  const dirs = [
    path.join(HOME, '.roo-code'),
    path.join(APPDATA, 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
    path.join(HOME, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const fp of findJsonl(dir)) {
      processJsonlFile(sessions, 'Roo Code', fp, parseClaudeCodeFormat);
    }
  }
  return sessions;
}

function collectAider() {
  const sessions = [];
  const dirs = [
    path.join(HOME, '.aider'),
    path.join(HOME, '.aider', 'logs'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    let entries;
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const f of entries) {
      if (!f.endsWith('.jsonl') && !f.endsWith('.json')) continue;
      processJsonlFile(sessions, 'Aider', path.join(dir, f), parseAiderFormat);
    }
  }
  return sessions;
}

function collectContinue() {
  const sessions = [];
  const sessDir = path.join(HOME, '.continue', 'sessions');
  if (!fs.existsSync(sessDir)) return sessions;
  let entries;
  try { entries = fs.readdirSync(sessDir); } catch { return sessions; }
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;
    processJsonlFile(sessions, 'Continue', path.join(sessDir, f), parseContinueFormat);
  }
  return sessions;
}

// ─── Main ────────────────────────────────────────────────

console.log('Claude Usage Collector v4 (Windows)');
console.log('====================================\n');

const sources = [
  { name: 'OpenClaw / Clawdbot', fn: collectOpenClaw },
  { name: 'Claude Code CLI',     fn: collectClaudeCode },
  { name: 'Claude Desktop',      fn: collectClaudeDesktop },
  { name: 'Cursor',              fn: collectCursor },
  { name: 'Windsurf',            fn: collectWindsurf },
  { name: 'Cline',               fn: collectCline },
  { name: 'Roo Code',            fn: collectRooCode },
  { name: 'Aider',               fn: collectAider },
  { name: 'Continue.dev',        fn: collectContinue },
];

let allSessions = [];
const sourceResults = {};

const cachedSessions = loadCache();
_scanIndex = loadScanIndex();
_newScanIndex = {};
_cachedByFilePath = new Map();
for (const s of cachedSessions) {
  if (!s.filePath) continue;
  const arr = _cachedByFilePath.get(s.filePath);
  if (arr) arr.push(s); else _cachedByFilePath.set(s.filePath, [s]);
}

const scanStartedAt = Date.now();
for (const { name, fn } of sources) {
  process.stdout.write(`Scanning ${name}... `);
  const sessions = fn();
  if (sessions.length > 0) {
    console.log(`OK ${sessions.length} session-day entries`);
    sourceResults[name] = sessions.length;
  } else {
    console.log(`-- not found or empty`);
  }
  allSessions.push(...sessions);
}

const scanMs = Date.now() - scanStartedAt;
console.log(`\nScan: ${_parseCount} parsed, ${_skipCount} skipped (unchanged) in ${scanMs}ms`);

let preservedHistorical = 0;
for (const s of cachedSessions) {
  if (!s.filePath || !_seenFilePaths.has(s.filePath)) {
    allSessions.push(s);
    preservedHistorical++;
  }
}
if (preservedHistorical > 0) {
  console.log(`Preserved ${preservedHistorical} historical/imported entries`);
}

const dedupedMap = new Map();
for (const s of allSessions) dedupedMap.set(`${s.source}|${s.file}|${s.date}`, s);
allSessions = [...dedupedMap.values()];
console.log(`Total after merge: ${allSessions.length} session-day entries\n`);

saveScanIndex(_newScanIndex);

const today = toLocalDate(Date.now());
const currentMonth = today.substring(0, 7);

const sourceTotals = {};
const sourceCounts = {};
allSessions.forEach(s => {
  sourceTotals[s.source] = (sourceTotals[s.source] || 0) + s.cost;
  sourceCounts[s.source] = (sourceCounts[s.source] || 0) + 1;
});
const grandTotal = allSessions.reduce((s, x) => s + x.cost, 0);
for (const k of Object.keys(sourceTotals)) sourceTotals[k] = parseFloat(sourceTotals[k].toFixed(2));

const todayCost = allSessions.filter(s => s.date === today).reduce((s, x) => s + x.cost, 0);
const monthCost = allSessions.filter(s => s.date.startsWith(currentMonth)).reduce((s, x) => s + x.cost, 0);

const summary = {
  generated_at: new Date().toISOString(),
  today,
  current_month: currentMonth,
  totals: { ...sourceTotals, grand_total: parseFloat(grandTotal.toFixed(2)) },
  today_cost: parseFloat(todayCost.toFixed(2)),
  month_cost: parseFloat(monthCost.toFixed(2)),
  session_counts: { ...sourceCounts, total: allSessions.length }
};

const openclawSessions = allSessions.filter(s => s.source === 'OpenClaw' || s.source === 'Clawdbot');
const otherSessions = allSessions.filter(s => s.source !== 'OpenClaw' && s.source !== 'Clawdbot');

// ─── Per-message timestamps for usage-limit math ─────────
// Walks every JSONL touched in the main scan (not just cost-bearing ones)
// from the last 14 days, and emits both:
//   - user-message timestamps (for "messages sent" count)
//   - assistant turn cost+tokens (for the cost-based weekly/5h metric,
//     which more closely tracks Anthropic's opaque plan-limit metric)
const MSG_WINDOW_MS = 14 * 86400000;
const msgCutoff = Date.now() - MSG_WINDOW_MS;
const userMsgTimes = [];   // [{t, source, model}]
const costEvents = [];     // [{t, source, model, cost}]

// ─── Efficiency Coach heuristic constants (tune here) ────
// Verified against real audit.jsonl shapes 2026-07-03: compaction is
// {type:'system',subtype:'compact_boundary',compact_metadata:{pre_tokens,post_tokens}};
// tool errors are user lines whose message.content[] has {type:'tool_result',is_error:true};
// Claude Desktop sessions end with a {type:'result',subtype:'success'} line.
const RAPID_REPROMPT_MS = 60_000;   // consecutive real user prompts closer than this = impatient re-prompt
const ERROR_RETRY_MS    = 120_000;  // user prompt this soon after a tool error = error-driven retry
const DUP_JACCARD       = 0.6;      // word-set similarity above this = near-duplicate prompt
const RESUME_MARKER     = 'continued from a previous conversation';

const sessionMetrics = []; // one entry per session file, see accumulator below

// Word-set Jaccard similarity, stdlib only.
function jaccard(a, b) {
  const A = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const B = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

// Extract the human-typed prompt text from a user line, or null if the line
// is a tool_result carrier / non-text turn.
function userPromptText(msg) {
  if (!msg) return null;
  const c = msg.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    if (c.some(p => p && p.type === 'tool_result')) return null;
    const t = c.filter(p => p && p.type === 'text').map(p => p.text).join(' ');
    return t || null;
  }
  return null;
}

// Map each visited file path to a source name based on which collector saw it.
// `processJsonlFile` doesn't track source on _seenFilePaths; rebuild it here
// by mapping seenFilePaths through the cost-bearing sessions, falling back
// to a path-substring heuristic for files with no cost entries yet.
const filePathToSource = new Map();
for (const s of allSessions) {
  if (s.filePath && !filePathToSource.has(s.filePath)) {
    filePathToSource.set(s.filePath, s.source);
  }
}
function guessSource(fp) {
  const p = fp.replace(/\\/g, '/').toLowerCase();
  if (p.includes('/.claude/projects/')) return 'Claude Code';
  if (p.includes('/claude/local-agent-mode-sessions')) return 'Claude Desktop';
  if (p.includes('/cursor/')) return 'Cursor';
  if (p.includes('/windsurf/')) return 'Windsurf';
  if (p.includes('/saoudrizwan.claude-dev') || p.includes('/cline.cline') || p.includes('/.cline')) return 'Cline';
  if (p.includes('/rooveterinaryinc.roo-cline') || p.includes('/.roo-code')) return 'Roo Code';
  if (p.includes('/.aider')) return 'Aider';
  if (p.includes('/.continue/')) return 'Continue';
  if (p.includes('/.openclaw/')) return 'OpenClaw';
  if (p.includes('/.clawdbot/')) return 'Clawdbot';
  return 'Unknown';
}

for (const fp of _seenFilePaths) {
  let st;
  try { st = fs.statSync(fp); } catch { continue; }
  if (st.mtimeMs < msgCutoff) continue;
  const source = filePathToSource.get(fp) || guessSource(fp);
  let content;
  try { content = fs.readFileSync(fp, 'utf-8'); } catch { continue; }

  // Per-session accumulator for the Efficiency Coach.
  const sm = {
    file: path.basename(path.dirname(fp)) + '/' + path.basename(fp),
    source, model: '',
    start: 0, end: 0, durationMs: 0,
    userMsgs: 0,
    tokens: { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 },
    cost: 0,
    rapidReprompts: 0, dupPrompts: 0, errorRetries: 0,
    compactCount: 0, compactTokensSaved: 0,
    wasResumed: false, endedClean: false,
  };
  let prevPromptText = null, prevPromptTs = 0, lastErrorTs = 0;
  let firstPromptSeen = false;

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    const msg = e.message;
    // Claude Desktop audit.jsonl uses _audit_timestamp; other formats use timestamp.
    const ts = parseTimestamp(e.timestamp)
      || parseTimestamp(e._audit_timestamp)
      || parseTimestamp(msg && msg.timestamp);
    if (!ts || ts < msgCutoff) continue;

    if (!sm.start || ts < sm.start) sm.start = ts;
    if (ts > sm.end) sm.end = ts;

    // Compaction boundary (Claude Desktop) or compact summary (Claude Code CLI).
    if ((e.type === 'system' && e.subtype === 'compact_boundary') || e.isCompactSummary) {
      sm.compactCount++;
      const cm = e.compact_metadata;
      if (cm && cm.pre_tokens && cm.post_tokens) sm.compactTokensSaved += cm.pre_tokens - cm.post_tokens;
      sm.endedClean = false;
    }

    // Session end / turn-quality signals.
    if (e.type === 'result') sm.endedClean = e.subtype === 'success';
    if (e.type === 'assistant' && msg && Array.isArray(msg.content)) {
      sm.endedClean = msg.content.some(p => p && p.type === 'text');
    }

    // User message: role==='user' on the inner message, OR top-level type==='user'
    // (which is how Claude Desktop / Claude Code format their user turns).
    const isUser =
      (msg && msg.role === 'user') ||
      e.type === 'user' ||
      e.role === 'user';
    if (isUser) {
      userMsgTimes.push({
        t: ts,
        source,
        model: (msg && msg.model) || e.model || '',
      });

      const text = userPromptText(msg);
      if (text) {
        sm.userMsgs++;
        if (!firstPromptSeen) {
          firstPromptSeen = true;
          if (text.toLowerCase().includes(RESUME_MARKER)) sm.wasResumed = true;
        }
        if (prevPromptTs && ts - prevPromptTs < RAPID_REPROMPT_MS) sm.rapidReprompts++;
        if (prevPromptText && jaccard(text, prevPromptText) > DUP_JACCARD) sm.dupPrompts++;
        if (lastErrorTs && ts - lastErrorTs < ERROR_RETRY_MS) { sm.errorRetries++; lastErrorTs = 0; }
        prevPromptText = text; prevPromptTs = ts;
        sm.endedClean = false;
      } else if (msg && Array.isArray(msg.content) &&
                 msg.content.some(p => p && p.type === 'tool_result' && p.is_error)) {
        lastErrorTs = ts;
        sm.endedClean = false;
      }
    }

    // Cost event: any entry with usage info — input/output tokens by either
    // Claude format. Compute cost the same way the parsers do.
    const usage = (msg && msg.usage) || e.usage;
    if (usage) {
      const inp = usage.input_tokens || usage.input || 0;
      const out = usage.output_tokens || usage.output || 0;
      const cw  = usage.cache_creation_input_tokens || usage.cacheWrite || 0;
      const cr  = usage.cache_read_input_tokens || usage.cacheRead || 0;
      if (inp || out || cw || cr) {
        const model = (msg && msg.model) || e.model || '';
        const pr = getPricing(model);
        const cost = (inp * pr.input + out * pr.output + cw * pr.cacheWrite + cr * pr.cacheRead) / 1000000;
        if (cost > 0) costEvents.push({ t: ts, source, model, cost });
        if (model) sm.model = model;
        sm.tokens.in += inp; sm.tokens.out += out;
        sm.tokens.cacheRead += cr; sm.tokens.cacheWrite += cw;
        sm.cost += cost;
      }
    }
  }

  if (sm.start) {
    sm.durationMs = sm.end - sm.start;
    sm.cost = Math.round(sm.cost * 10000) / 10000;
    sessionMetrics.push(sm);
  }
}
sessionMetrics.sort((a, b) => a.start - b.start);
userMsgTimes.sort((a, b) => a.t - b.t);
costEvents.sort((a, b) => a.t - b.t);
console.log(`Extracted ${userMsgTimes.length} user messages and ${costEvents.length} cost events from last 14 days`);
console.log(`Session metrics: ${sessionMetrics.length} sessions, ` +
  `${sessionMetrics.reduce((s, m) => s + m.rapidReprompts + m.dupPrompts + m.errorRetries, 0)} rework events, ` +
  `${sessionMetrics.reduce((s, m) => s + m.compactCount, 0)} compactions`);

saveCache(allSessions);

const dataJs = `// Auto-generated by collect-usage.js v4 (Windows) — ${new Date().toISOString()}
window.__SUMMARY__ = ${JSON.stringify(summary, null, 2)};
window.__OPENCLAW_SESSIONS__ = ${JSON.stringify(openclawSessions)};
window.__CLAUDE_SESSIONS__ = ${JSON.stringify(otherSessions)};
window.__USER_MSG_TIMES__ = ${JSON.stringify(userMsgTimes)};
window.__COST_EVENTS__ = ${JSON.stringify(costEvents)};
window.__SESSION_METRICS__ = ${JSON.stringify(sessionMetrics)};
`;
try {
  atomicWrite(path.join(OUTPUT_DIR, 'data.js'), dataJs);
  console.log(`Data written to: ${path.join(OUTPUT_DIR, 'data.js')}`);
} catch (e) {
  console.error(`Failed to write data.js: ${e.message}`);
  process.exitCode = 1;
}

console.log('\nDone.');
console.log('================================');
console.log(JSON.stringify(summary, null, 2));
