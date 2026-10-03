// Run with: node --test
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { render } = require('./statusline');

const plain = (s) => s.replace(/\x1b\[\d+m/g, '');
const now = Date.UTC(2026, 9, 1, 12, 0);
const full = {
  model: { display_name: 'Opus 5.5 (1M context)' },
  context_window: { used_percentage: 31 },
  rate_limits: {
    five_hour: { used_percentage: 38, resets_at: now / 1000 + 2 * 3600 },
    seven_day: { used_percentage: 22, resets_at: now / 1000 + 3 * 86400 },
  },
};

test('shows model, context and both limits', () => {
  const s = plain(render(full, now));
  assert.match(s, /^Opus 5\.5 {3}ctx ━{8} 31% {3}5h ━{8} 38%  \d\d:\d\d {3}wk ━{8} 22%  \w+$/);
});

test('context only before the first reply', () => {
  assert.strictEqual(plain(render({ model: { display_name: 'Opus 5.5' } }, now)), 'Opus 5.5   ctx ━━━━━━━━  0%');
});

test('works out context from token counts when no percentage is given', () => {
  const s = render({ context_window: { context_window_size: 200000, current_usage: { input_tokens: 1000, cache_read_input_tokens: 99000 } } }, now);
  assert.match(plain(s), /ctx ━{8} 50%/);
});

test('survives missing, odd and out-of-range values', () => {
  assert.strictEqual(plain(render({ model: null, context_window: null, rate_limits: null }, now)), 'Claude   ctx ━━━━━━━━  0%');
  const s = plain(render({
    context_window: { used_percentage: 140 },
    rate_limits: { five_hour: { used_percentage: 5 }, seven_day: { used_percentage: 'x', resets_at: 'soon' } },
  }, now));
  assert.strictEqual(s, 'Claude   ctx ━━━━━━━━ 140%   5h ━━━━━━━━  5%');
});

test('never crashes on bad stdin', () => {
  for (const input of ['', 'not json', 'null', '[]', '42']) {
    const out = execFileSync(process.execPath, [__dirname + '/statusline.js'], { input }).toString();
    assert.match(plain(out), /^Claude {3}ctx/);
  }
  const bom = execFileSync(process.execPath, [__dirname + '/statusline.js'], { input: '\uFEFF{"model":{"display_name":"Opus"}}' }).toString();
  assert.match(plain(bom), /^Opus {3}ctx/);
});
