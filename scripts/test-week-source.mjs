// [task-31] The game week length (D-40: 3 in-game days) has exactly one source of truth:
// SIM_DAYS_PER_WEEK in src/sim/params.ts. This test checks by import that every week constant is
// derived from it, and by source scan that nobody re-introduces a literal week length.
import './ts-test-loader.mjs';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'src/sim/params.ts';
let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function assert(condition, message) { if (!condition) throw new Error(message); }

const params = await import('../src/sim/params.ts');
const clock = await import('../src/sim/clock.ts');
const upgrades = await import('../src/sim/upgrades.ts');
const daynight = await import('../src/sim/daynight.ts');
const facade = await import('../src/sim/index.ts');
const DAY = params.SIM_MINUTES_PER_DAY;

check('D-40 week length is 3 days', () => {
  assert(params.SIM_DAYS_PER_WEEK === 3, `SIM_DAYS_PER_WEEK=${params.SIM_DAYS_PER_WEEK}`);
  assert(params.SIM_MINUTES_PER_WEEK === 3 * DAY, `SIM_MINUTES_PER_WEEK=${params.SIM_MINUTES_PER_WEEK}`);
});
check('every week constant equals the params source', () => {
  const week = params.SIM_MINUTES_PER_WEEK;
  for (const [name, value] of [
    ['clock.TICKS_PER_WEEK', clock.TICKS_PER_WEEK], ['upgrades.TICKS_PER_WEEK', upgrades.TICKS_PER_WEEK],
    ['index.TICKS_PER_WEEK', facade.TICKS_PER_WEEK], ['params.DAYNIGHT_MINUTES_PER_WEEK', params.DAYNIGHT_MINUTES_PER_WEEK],
  ]) assert(value === week, `${name}=${value}, expected ${week}`);
  assert(clock.DAYS_PER_WEEK === params.SIM_DAYS_PER_WEEK && facade.DAYS_PER_WEEK === params.SIM_DAYS_PER_WEEK,
    'DAYS_PER_WEEK re-exports must equal SIM_DAYS_PER_WEEK');
});
check('curfew starts in week 4 = day 10 (D-17)', () => {
  const firstCurfewDay = (params.CURFEW_ENDLESS_START_WEEK - 1) * params.SIM_DAYS_PER_WEEK + 1;
  assert(firstCurfewDay === 10, `curfew starts on day ${firstCurfewDay}`);
  assert(daynight.weekAtTick(9 * DAY - 1) === 3 && daynight.weekAtTick(9 * DAY) === 4, 'weekAtTick boundary');
});
check('clock and calendar follow the week', () => {
  const at = clock.clockAt(params.SIM_MINUTES_PER_WEEK + DAY + 5);
  assert(at.week === 2 && at.dayOfWeek === 2, `clockAt: ${JSON.stringify(at)}`);
  const cases = [[0, 1, 1], [DAY - 1, 1, 1], [DAY, 1, 2], [2 * DAY + 7, 1, 3],
    [3 * DAY, 1, 3], [3 * DAY + 1, 2, 1], [6 * DAY, 2, 3], [9 * DAY + 60, 4, 1]];
  for (const [minute, week, day] of cases) {
    assert(clock.calendarWeekAt(minute) === week && clock.calendarDayAt(minute) === day,
      `minute ${minute}: week ${clock.calendarWeekAt(minute)} day ${clock.calendarDayAt(minute)}, expected ${week}/${day}`);
  }
  assert(upgrades.startWeeklyUpgrade(params.SIM_MINUTES_PER_WEEK, { nextInt: () => 0 })?.week === 1, 'first board');
});

// Source scan: no other file may define a week length with a literal or hard-code 7/3-day arithmetic.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const file = resolve(dir, name);
    if (statSync(file).isDirectory()) walk(file, out);
    else if (/\.(ts|mjs|js)$/.test(name)) out.push(file);
  }
  return out;
}
const files = [...walk(resolve(ROOT, 'src')), ...walk(resolve(ROOT, 'scripts'))]
  .filter((file) => !file.endsWith('test-week-source.mjs'));
const definition = /\b[A-Z_]*(DAYS_PER_WEEK|MINUTES_PER_WEEK|TICKS_PER_WEEK)\b\s*(?::[^=;]+)?=\s*([^;\n]+)/g;
const literalWeek = /\b(?:7|3)\s*\*\s*(?:24\s*\*\s*60|1_?440)\b|\b10_?080\b/;
check('no second literal week definition', () => {
  const bad = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(definition)) {
      const literal = /^\s*\d/.test(match[2]);
      if (literal && !(rel === SOURCE && match[0].startsWith('SIM_DAYS_PER_WEEK'))) bad.push(`${rel}: ${match[0].trim()}`);
    }
    // Comments may mention numbers; only code lines count.
    text.split('\n').forEach((line, index) => {
      const code = line.replace(/\/\/.*$/, '');
      if (literalWeek.test(code) && !rel.startsWith('scripts/test-')) bad.push(`${rel}:${index + 1}: ${line.trim()}`);
    });
  }
  assert(bad.length === 0, bad.join(' | '));
});
check('HUD day bar is sized by DAYS_PER_WEEK', () => {
  const pass = readFileSync(resolve(ROOT, 'src/ui/hud/boarding-pass.ts'), 'utf8');
  assert(/repeat\(DAYS_PER_WEEK\)/.test(pass), 'day squares must be repeat(DAYS_PER_WEEK)');
  assert(!/repeat\(\s*7\s*\)|integer\(state\.day,\s*1,\s*7\)/.test(pass), 'literal 7-day bar left in boarding-pass.ts');
});

for (const line of failures) console.error('FAIL ' + line);
console.log(`SUMMARY test:week-source seed=0xA1A1 days=${params.SIM_DAYS_PER_WEEK} files=${files.length} ` +
  `passed=${passed} failed=${failures.length}`);
if (failures.length) process.exitCode = 1;
