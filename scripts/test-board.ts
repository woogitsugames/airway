// [night-69a] D-324 (PLAN-NOWY-KIERUNEK.md step T1): the pure parts of the UI-A preview helpers (src/ui/skin/board.ts):
// the figures the split-flap board shows for a HUD state and their cell budgets (src/i18n/limits.ts BOARD_CELLS), the
// night band of the 24-hour bar (D-285 L3), the flap timing of the spec (UI-A-SPEC.md §3), the speed selector's stops,
// the Linoryt structure re-scoped to the preview, and the main.ts branch that loads the preview only in a DEV build.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOARD_FLIP_MS, BOARD_NIGHT, BOARD_REFLIP_MS, BOARD_STAGGER_MS, boardFigures, boardTwin, isBoardNight, SPEED_ANGLE } from '../src/ui/skin/board.ts';
import { BOARD_CELLS } from '../src/i18n/limits.ts';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const state = (timeMinutes: number, week: number, day: number, passengers: number) => ({ timeMinutes, week, day, passengers });

test('figures: clock HH:MM, week, day of 3, passengers padded to 3 digits', () => {
  assert.deepEqual(boardFigures(state(19 * 60 + 5, 1, 2, 34), BOARD_CELLS, 3), { clock: '19:05', week: '1', day: '2/3', passengers: '034', minute: 1145 });
  assert.equal(boardFigures(state(0, 12, 3, 1234), BOARD_CELLS, 3).passengers, '1234');
  assert.equal(boardFigures(state(1439, 1, 1, 0), BOARD_CELLS, 3).clock, '23:59');
});
test('figures stay inside the cell budgets (clamped, never NaN)', () => {
  const big = boardFigures(state(5000, 12345, 9, 10 ** 9), BOARD_CELLS, 3);
  assert.equal(big.clock, '23:59');
  assert.equal(big.week, '999');
  assert.equal(big.day, '3/3');
  assert.equal(big.passengers, '99999');
  const bad = boardFigures(state(Number.NaN, Number.NaN, Number.NaN, -4), BOARD_CELLS, 3);
  assert.deepEqual([bad.clock, bad.week, bad.day, bad.passengers], ['00:00', '1', '1/3', '000']);
  for (const value of [big, bad]) {
    assert.ok(value.clock.length <= BOARD_CELLS.clock && value.week.length <= BOARD_CELLS.week);
    assert.ok(value.day.length <= BOARD_CELLS.day && value.passengers.length <= BOARD_CELLS.passengers);
  }
});
test('the 24-hour bar: 10 night hours, 20:00–06:00 (D-285 L3)', () => {
  const night = Array.from({ length: 24 }, (_, h) => h).filter(isBoardNight);
  assert.deepEqual(night, [0, 1, 2, 3, 4, 5, 20, 21, 22, 23]);
  assert.deepEqual(BOARD_NIGHT, { from: 20, to: 6 });
});
test('flap timing of the spec: 120 ms a cell, 30 ms apart; a cell changing faster is set without a flip', () => {
  assert.equal(BOARD_FLIP_MS, 120);
  assert.equal(BOARD_STAGGER_MS, 30);
  // One game minute is 100 ms of real time at 1× (10 ticks/s): the minute digit must never try to flip.
  assert.ok(BOARD_REFLIP_MS > 100 && BOARD_REFLIP_MS >= BOARD_FLIP_MS * 2);
  // The tens of minutes change every second at 1× and every 250 ms at 4×: they still flip.
  assert.ok(BOARD_REFLIP_MS <= 250 * 2);
});
test('the board flip duration in board.css equals BOARD_FLIP_MS', () => {
  const css = readFileSync('src/ui/skin/board.css', 'utf8');
  assert.match(css, new RegExp(`--board-flip:\\s*${BOARD_FLIP_MS}ms`));
});
test('speed selector: 1×, 2× and 4× on three distinct stops', () => {
  assert.deepEqual([SPEED_ANGLE[1], SPEED_ANGLE[2], SPEED_ANGLE[4]], [-135, 0, 135]);
});
test('boardTwin re-scopes every Linoryt rule to the preview and leaves the plain :root inks', () => {
  const css = ':root { --lin-ink: #1E1C1F; }\n:root[data-skin="linoryt"] .a { color: red; }\n' +
    ':root[data-airway-motion="reduce"][data-skin="linoryt"] .b, :root[data-skin="linoryt"]:has(.c) .d { top: 0; }';
  const twin = boardTwin(css);
  assert.equal(twin.includes('[data-skin="linoryt"]'), false);
  assert.equal(twin.split('[data-skin="board"]').length - 1, 3);
  assert.ok(twin.startsWith(':root { --lin-ink: #1E1C1F; }'));
  const real = boardTwin(readFileSync('src/ui/skin/linoryt.css', 'utf8'));
  assert.equal(real.includes('[data-skin="linoryt"]'), false);
});
test('board labels are abbreviated on the board and spoken in full (PL/EN)', () => {
  for (const catalog of [pl, en]) {
    for (const key of ['board.week', 'board.day', 'board.passengers'] as const) assert.ok(catalog[key].length <= 6, `${key} "${catalog[key]}"`);
    assert.match(catalog['board.label'], /\{time\}.*\{week\}.*\{day\}.*\{days\}.*\{count\}/);
  }
  assert.equal(pl['board.week'], 'Tydz.');
  assert.equal(pl['board.passengers'], 'Pasaż.');
});
test('src/main.ts loads the preview only in a DEV build with ?skin=board, before the HUD mounts', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /import\.meta\.env\.DEV && query\.get\('skin'\) === 'board' \? startBoardPreview\(\) : null/);
  assert.match(main, /import\('\.\/ui\/skin\/board\.css'\)/);
  assert.match(main, /if \(devBoard\) await devBoard;/);
  assert.equal(/^import [^;]*skin\/board/m.test(main), false, 'board.ts or board.css imported statically');
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /<html[^>]*data-skin="linoryt"/);
});

console.log(`SUMMARY test:board seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
