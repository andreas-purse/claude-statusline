#!/usr/bin/env node
// Claude Code status line: model, context window, and the 5-hour and weekly plan limits.
// Claude Code pipes session JSON to stdin; whatever this prints is the status line.

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
// Green below 50%, yellow below 80%, red from 80%.
const hot = (p, s) => `\x1b[${p >= 80 ? 31 : p >= 50 ? 33 : 32}m${s}\x1b[0m`;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// resets_at is epoch seconds; accept ms or an ISO string too.
function toMs(t) {
  const ms = typeof t === 'number' ? (t < 1e12 ? t * 1000 : t) : Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

// A bar of `width` identical cells; colour alone separates used from free.
function bar(p, width = 8) {
  const filled = Math.max(0, Math.min(width, Math.round((p / 100) * width)));
  return hot(p, '━'.repeat(filled)) + dim('━'.repeat(width - filled));
}

const gauge = (label, p) => `${dim(label)} ${bar(p)} ${hot(p, (Math.round(p) + '%').padStart(3))}`;

// Reset time in the system locale and zone: clock time within 20h, otherwise the weekday.
function resetLabel(ms, now) {
  const opts = ms - now < 20 * 36e5 ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short' };
  return new Date(ms).toLocaleString(undefined, opts);
}

function contextPct(cw) {
  cw = cw || {};
  const pct = num(cw.used_percentage);
  if (pct != null) return pct;
  const u = cw.current_usage;
  const size = num(cw.context_window_size);
  if (!u || !size) return 0;
  return (((u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0)) / size) * 100;
}

function render(input, now = Date.now()) {
  const model = String(input.model?.display_name || input.model?.id || 'Claude').replace(/\s*\(.*\)$/, '');
  const out = [bold(model), gauge('ctx', contextPct(input.context_window))];
  // rate_limits only arrive after the first reply in a session, and only on Pro and Max plans.
  const limits = input.rate_limits || {};
  for (const [label, w] of [['5h', limits.five_hour], ['wk', limits.seven_day]]) {
    const pct = num(w?.used_percentage);
    if (pct == null) continue;
    const reset = toMs(w.resets_at);
    out.push(gauge(label, pct) + (reset ? '  ' + dim(resetLabel(reset, now)) : ''));
  }
  return out.join('   ');
}

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (d) => (raw += d));
  process.stdin.on('end', () => {
    let input = {};
    // Windows PowerShell prefixes piped text with a byte-order mark.
    try { input = JSON.parse(raw.replace(/^\uFEFF/, '')) || {}; } catch {}
    try {
      process.stdout.write(render(input));
    } catch {
      process.stdout.write('statusline: bad input');
    }
  });
}

module.exports = { render };
