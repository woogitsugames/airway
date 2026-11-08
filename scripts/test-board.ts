// [night-69a] D-324 (PLAN-NOWY-KIERUNEK.md step T1): the pure parts of the UI-A preview helpers (src/ui/skin/board.ts):
// the figures the split-flap board shows for a HUD state and their cell budgets (src/i18n/limits.ts BOARD_CELLS), the
// night band of the 24-hour bar (D-285 L3), the flap timing of the spec (UI-A-SPEC.md §3), the speed selector's stops,
// the Linoryt structure re-scoped to the preview, and the main.ts branch that loads the preview only in a DEV build.
// [night-73a] D-328 (step T2): the airport signs' metrics, queue and level of detail, the atlas label placement and the
// yellow budget of the direction signs (src/ui/skin/board-notes.ts), and the release overlay's empty sign slot.
// [night-75a] D-330 (step T3): the hub strips' order, the bay's place and strip count, the strip layout and queue
// (src/ui/skin/board-strips.ts), and the release session's empty strip slot.
// [night-77a] D-332 (step T5): the menu board's plan (main sign and row order), the print-out's dates, clock, queue and
// weeks table (src/ui/skin/board-sheets.ts), the Linoryt sections the twin leaves out, the T5 texts, and the release
// menu and report's empty sheet slot.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOARD_FLIP_MS, BOARD_NIGHT, BOARD_REFLIP_MS, BOARD_STAGGER_MS, boardFigures, boardTwin, isBoardNight, SPEED_ANGLE } from '../src/ui/skin/board.ts';
import { BOARD_CELLS } from '../src/i18n/limits.ts';
import {
  atlasLabelWidth, codeWidth, CITY_ROW, DENSE_SIGNS, FRESH_ROW, LOD1_GLYPHS, LOD1_MAX_SPAN_KM, placeAtlas, showsCity, SIGN_ROW, signClock,
  signLod, signQueue, signSize, textWidth, yellowSigns, type AtlasPlaced, type SignShape,
} from '../src/ui/skin/board-notes.ts';
import { ATLAS_LABELS, atlasLabelKey } from '../src/data/atlasLabels.ts';
import {
  bayPlace, COLUMN_MIN, MAP_KEEP, QUEUE_MIN, STRIP_H, STRIP_STAY, stripClock, stripLayout, stripOrder, stripQueue, stripUrgency, queueFit,
} from '../src/ui/skin/board-strips.ts';
import { REGION_IDS, type RegionId } from '../src/data/regions.ts';
import { boardDate, menuPlan, printClock, printDate, printQueue, printWeeks, PRINT_GLYPHS_PER_REGION } from '../src/ui/skin/board-sheets.ts';
import { BOARD_TWIN_CUTS } from '../src/ui/skin/board.ts';
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

// ---- T2: airport signs (D-328) -----------------------------------------------------------------------------------------
const shape = (o: Partial<SignShape>): SignShape => ({ label: 'AMM', name: 'Amman', hub: false, lod: 1, glyphs: 0, count: '', stubs: 0, fresh: null,
  jamSeconds: null, ...o });
test('sign metrics: code plate, queue, city strip under it, NOWE over it; the sign row is level with the pin', () => {
  const plain = signSize(shape({}));
  assert.equal(plain.height, SIGN_ROW + CITY_ROW, 'level 1: the sign and its city strip');
  assert.equal(plain.lineMid, SIGN_ROW / 2);
  assert.equal(plain.compactHeight, SIGN_ROW, 'compact: the code alone, one row');
  const queued = signSize(shape({ glyphs: 5 }));
  assert.equal(queued.width - plain.width >= 5 * 18, true, 'every glyph cell adds its width');
  const fresh = signSize(shape({ fresh: 'NOWE' }));
  assert.equal(fresh.height, FRESH_ROW + SIGN_ROW + CITY_ROW);
  assert.equal(fresh.lineMid, FRESH_ROW + SIGN_ROW / 2, 'the sign row stays level with the pin under the NOWE tag');
  const hub = signSize(shape({ hub: true }));
  assert(hub.compactWidth > plain.compactWidth + 17, 'a hub plate: larger code, double frame, hub mark');
  const jam = signSize(shape({ jamSeconds: 42 }));
  assert(jam.compactWidth >= plain.compactWidth + codeWidth('0:42', 15), 'a jam keeps its countdown in the compact form');
  assert.equal(signClock(42), '0:42');
  assert.equal(signClock(61.2), '1:02');
});
test('sign metrics: Archivo advances cover the printed text (Chromium measurements)', () => {
  // canvas measureText at 100 px: Archivo 800/80 % "AMM" 2.195 em, "LCA·BEY" 3.755 em; Archivo 600 "Karaczi 2 408 km" 7.735 em.
  assert(codeWidth('AMM', 15) >= 2.195 * 15 && codeWidth('AMM', 15) <= 2.195 * 15 + 3);
  assert(codeWidth('LCA·BEY', 15) >= 3.755 * 15);
  assert(textWidth('Karaczi 2 408 km', 11.5) >= 7.735 * 11.5);
  assert(textWidth('Santa Cruz de la Sierra', 11.5) >= 10.363 * 11.5);
});
test('city strip: level 1 under every sign, level 2 only under hubs, never when the sign already shows the city', () => {
  assert(showsCity({ lod: 1, hub: false, label: 'AMM', name: 'Amman' }));
  assert(!showsCity({ lod: 2, hub: false, label: 'AMM', name: 'Amman' }));
  assert(showsCity({ lod: 2, hub: true, label: 'AMM', name: 'Amman' }));
  assert(!showsCity({ lod: 1, hub: false, label: 'Amman', name: 'Amman' }), 'D-68 name plates');
});
test('queue level 1: one glyph per passenger, 7 then "+n", connecting ones hollow (at most half when it overflows)', () => {
  const q = signQueue(['EUN', 'EUN', 'ME'], 1, 1);
  assert.deepEqual(q.glyphs.map((g) => `${g.region}${g.hollow ? '~' : ''}`), ['EUN', 'EUN', 'ME~']);
  assert.equal(q.count, '');
  const many = signQueue(Array.from({ length: 12 }, (_, i) => (i % 2 ? 'EUS' : 'AFR')), 10, 1);
  assert.equal(many.glyphs.length, LOD1_GLYPHS);
  assert.equal(many.count, '+5');
  assert.equal(many.glyphs.filter((g) => g.hollow).length, 4, 'half of the 7 (rounded up) hollow');
});
test('queue level 2: one glyph per direction, most numerous first, then the total', () => {
  const q = signQueue(['ME', 'EUN', 'EUN', 'AFR', 'EUN', 'ME'], 1, 2);
  assert.deepEqual(q.glyphs.map((g) => g.region), ['EUN', 'ME', 'AFR']);
  assert.equal(q.count, '6');
  assert.deepEqual(q.glyphs.map((g) => g.hollow), [false, false, false], 'a direction with a ready passenger is filled');
  assert.equal(signQueue(['EUN', 'ME'], 1, 2).glyphs[1].hollow, true, 'only connecting: hollow');
  assert.deepEqual(signQueue([], 0, 2), { glyphs: [], count: '' });
});
test('level of detail: level 1 at the opening framing, level 2 wide, at 130 % text or dense; hysteresis; zoom shows more', () => {
  assert.equal(signLod(4400, 100, 6, 1), 1);
  assert.equal(signLod(LOD1_MAX_SPAN_KM + 1, 100, 3, 1), 2);
  assert.equal(signLod(4400, 130, 3, 1), 2);
  assert.equal(signLod(4400, 100, DENSE_SIGNS + 1, 1), 2);
  assert.equal(signLod(4400, 100, DENSE_SIGNS - 1, 2), 2, 'stays at 2 until two fewer');
  assert.equal(signLod(4400, 100, DENSE_SIGNS - 2, 2), 1);
  assert.equal(signLod(3300, 100, DENSE_SIGNS + 4, 1), 1, 'the closest zoom allows twice the density');
});
test('atlas labels: lighter weight and seas first, never over an obstacle or another label, inside the band', () => {
  const out: AtlasPlaced[] = [];
  const cands = [
    { id: 'country-gr', kind: 'country' as const, weight: 3, x: 100, y: 100, width: 60 },
    { id: 'sea-mediterranean', kind: 'sea' as const, weight: 2, x: 110, y: 104, width: 120 },
    { id: 'country-tr', kind: 'country' as const, weight: 2, x: 300, y: 100, width: 50 },
    { id: 'country-eg', kind: 'country' as const, weight: 2, x: 200, y: 300, width: 50 },
    { id: 'sea-edge', kind: 'sea' as const, weight: 1, x: 8, y: 200, width: 60 },
  ];
  placeAtlas(cands, [{ l: 180, t: 290, r: 260, b: 320 }], { l: 4, t: 60, r: 396, b: 600 }, out);
  assert.deepEqual(out.map((p) => p.id), ['sea-mediterranean', 'country-tr'], 'Greece yields to the sea, Egypt to a sign, the edge label to the band');
  const again: AtlasPlaced[] = [];
  placeAtlas([...cands].reverse(), [{ l: 180, t: 290, r: 260, b: 320 }], { l: 4, t: 60, r: 396, b: 600 }, again);
  assert.deepEqual(again, out, 'deterministic');
});
test('atlas labels: every PL/EN name has a width; countries print in spaced capitals', () => {
  for (const catalog of [pl, en]) {
    for (const label of ATLAS_LABELS) {
      const name = (catalog as Record<string, string>)[atlasLabelKey(label)];
      assert(name, `${atlasLabelKey(label)} missing`);
      assert(atlasLabelWidth(name, label.kind) > 0 && atlasLabelWidth(name, label.kind) < 360, `${name} ${atlasLabelWidth(name, label.kind)} px`);
    }
  }
  assert(atlasLabelWidth('Polska', 'country') > atlasLabelWidth('Polska', 'sea'), 'capitals tracked .3 em');
});
test('direction signs: at most two yellow (new first, then the fuller), a jam is red and never counts', () => {
  const keep = yellowSigns([{ jam: false, fresh: false, fill: .2 }, { jam: true, fresh: false, fill: 1 }, { jam: false, fresh: false, fill: .9 },
    { jam: false, fresh: true, fill: 0 }, { jam: false, fresh: false, fill: .5 }]);
  assert.deepEqual(keep, [false, false, true, true, false]);
});
test('boardTwin leaves Linoryt\'s note rules (U2) out: the board prints its own signs', () => {
  const real = boardTwin(readFileSync('src/ui/skin/linoryt.css', 'utf8'));
  assert.equal(real.includes('.lin-jam'), false);
  assert.equal(real.includes('.airport-edge'), false);
  assert.equal(real.includes('.lin-pass'), true, 'the rest of the twin stays');
});
test('the release overlay reaches the signs only through the empty slot (no static import of the preview)', () => {
  const overlay = readFileSync('src/ui/overlay.ts', 'utf8');
  assert.match(overlay, /from '\.\/overlay-skin'/);
  assert.doesNotMatch(overlay, /board-notes|skin\/board/);
  const slot = readFileSync('src/ui/overlay-skin.ts', 'utf8');
  assert.match(slot, /export const noteSkin: \{ current: NoteSkin \| null \} = \{ current: null \}/);
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /import\('\.\/ui\/skin\/board-notes'\)/);
  assert.match(main, /noteSkin\.current = notes\.createBoardNotes/);
});

// ---- T3: hub strips --------------------------------------------------------------------------------------------------
const hub = (id: string, waiting: number, capacity = 36, jamSeconds: number | null = null) =>
  ({ id, code: id, name: id, hub: true, waiting: Array.from({ length: waiting }, () => 'EUN' as RegionId), capacity, jamSeconds });
test('strips: a jam first (the sooner it closes, the higher), then the fuller; ties by code', () => {
  const order = stripOrder([hub('ATH', 14), hub('AMM', 30), hub('IST', 5, 36, 80), hub('CAI', 6, 36, 20), hub('BEY', 14)], []);
  assert.deepEqual(order.map((h) => h.id), ['CAI', 'IST', 'AMM', 'ATH', 'BEY']);
  assert.ok(stripUrgency(hub('X', 0, 36, 999)) > stripUrgency(hub('Y', 72, 36)), 'any jam outranks any fill');
});
test('strips: a strip on show keeps its place until another hub is fuller by the stay margin; a jam takes it at once', () => {
  const shown = ['ATH'];
  assert.equal(stripOrder([hub('ATH', 18), hub('AMM', 20)], shown)[0].id, 'ATH', '20/36 vs 18/36 is within the margin');
  const clearly = Math.ceil((18 / 36 + STRIP_STAY) * 36) + 1;
  assert.equal(stripOrder([hub('ATH', 18), hub('AMM', clearly)], shown)[0].id, 'AMM');
  assert.equal(stripOrder([hub('ATH', 30), hub('AMM', 2, 36, 50)], shown)[0].id, 'AMM');
});
test('strips: two queue rows: a glyph row per direction for one or two; past that the first row and glyph + count pairs', () => {
  const waiting: RegionId[] = ['ME', 'EUN', 'EUN', 'ASI', 'EUN', 'ME', 'AFR', 'NAM'];
  const q = stripQueue(waiting, REGION_IDS, 8, 3, false);
  assert.equal(q.directions, 5);
  assert.deepEqual(q.rows, [{ region: 'EUN', glyphs: 3, more: 0 }]);
  assert.deepEqual(q.pairs.map((p) => `${p.region}${p.count}`), ['ME2', 'NAM1'], 'ties in region order; the third pair would not fit');
  assert.equal(q.pairsMore, 2, '"+2": AFR and ASI past the pairs');
  assert.equal(stripQueue(waiting, REGION_IDS, 8, 4, false).pairsMore, 0);
  const two = stripQueue(['EUN', 'ME', 'ME'], REGION_IDS, 8, 3, false);
  assert.deepEqual(two.rows.map((r) => r.region), ['ME', 'EUN'], 'two directions: two glyph rows');
  const long = stripQueue(Array.from({ length: 20 }, () => 'EUN' as RegionId), REGION_IDS, 8, 3, false);
  assert.deepEqual(long.rows, [{ region: 'EUN', glyphs: 6, more: 14 }], 'a long row: perRow - 2 glyphs and "+n" (two glyphs wide)');
  const compact = stripQueue(waiting, REGION_IDS, 8, 3, true);
  assert.equal(compact.rows.length, 0);
  assert.equal(compact.pairs.reduce((sum, p) => sum + p.count, 0), waiting.length, 'every passenger counted');
  assert.equal(stripQueue([], REGION_IDS, 8, 3, false).directions, 0);
  const fit = queueFit(110);
  assert.deepEqual(fit, { perRow: 6, pairsFit: 2 }, 'D-08 glyphs at the theme floor (16 px)');
  assert.ok(queueFit(110, 21).perRow < fit.perRow, 'enhanced glyphs (21 px) fit fewer');
});
test('strips: portrait bay on the console, two strips when the map keeps its height, one at 130 % or on a short phone', () => {
  const base = { width: 412, height: 915, column: false, board: { l: 8, t: 6, r: 332, b: 90 }, dock: { l: 0, t: 820, r: 412, b: 915 },
    insetLeft: 8, insetRight: 8, insetBottom: 8, strip: STRIP_H, textScale: 100 };
  const tall = bayPlace(base);
  assert.deepEqual([tall.anchor, tall.left, tall.right, tall.slots], ['bottom', 8, 8, 2]);
  assert.equal(tall.y, 915 - 820 + 4, 'stands 4 px over the console');
  assert.equal(bayPlace({ ...base, textScale: 130, strip: STRIP_H * 1.3 }).slots, 1);
  const short = bayPlace({ ...base, width: 320, height: 568, dock: { l: 0, t: 470, r: 320, b: 568 } });
  assert.equal(short.slots, 1, `a 568 px phone keeps ${MAP_KEEP} px of map`);
});
test('strips: landscape bay in the right column beside the console, level with the board; one strip over the map when too narrow', () => {
  const base = { width: 915, height: 412, column: true, board: { l: 8, t: 6, r: 480, b: 92 }, dock: { l: 783, t: 0, r: 915, b: 412 },
    insetLeft: 8, insetRight: 8, insetBottom: 8, strip: STRIP_H, textScale: 100 };
  const wide = bayPlace(base);
  assert.deepEqual([wide.anchor, wide.left, wide.right, wide.y, wide.slots], ['top', 488, 915 - 783 + 8, 6, 2]);
  const narrow = bayPlace({ ...base, width: 844, dock: { l: 844 - COLUMN_MIN, t: 0, r: 844, b: 390 }, height: 390 });
  assert.deepEqual([narrow.anchor, narrow.slots, narrow.y], ['bottom', 1, 8]);
});
test('strips: side by side with the tile beside, then with the tile under them, then stacked (always at 130 %)', () => {
  const phone = stripLayout(396, 100, true);
  assert.deepEqual([phone.stack, phone.tileRow, phone.compact, phone.extra], [false, false, false, 0]);
  assert.ok(phone.perRow >= 7, `perRow ${phone.perRow}`);
  const column = stripLayout(290, 100, true);
  assert.deepEqual([column.stack, column.tileRow, column.height], [false, true, STRIP_H], 'landscape column: tile row, strips stay one line');
  assert.ok(column.extra > 0);
  assert.equal(stripLayout(290, 100, false).tileRow, false, 'nothing folded: no tile');
  const big = stripLayout(396, 150, true);
  assert.deepEqual([big.stack, big.tileRow, big.compact], [true, false, true]);
  assert.ok(big.height > STRIP_H * 1.5);
  const small = stripLayout(304, 150, true);
  assert.deepEqual([small.stack, small.tileRow], [true, true]);
  const narrow = stripLayout(250, 100, false);
  assert.equal(narrow.stack, true, `queue under ${QUEUE_MIN} px`);
});
test('strips: the landscape column keeps two one-line strips and the tile row within 45 % of the height', () => {
  const lay = stripLayout(915 - 488 - 140, 100, true);
  const place = bayPlace({ width: 915, height: 412, column: true, board: { l: 8, t: 6, r: 480, b: 92 }, dock: { l: 783, t: 0, r: 915, b: 412 },
    insetLeft: 8, insetRight: 8, insetBottom: 8, strip: lay.height, extra: lay.extra, textScale: 100 });
  assert.equal(place.slots, 2);
  const stacked = bayPlace({ width: 915, height: 412, column: true, board: { l: 8, t: 6, r: 480, b: 92 }, dock: { l: 783, t: 0, r: 915, b: 412 },
    insetLeft: 8, insetRight: 8, insetBottom: 8, strip: stripLayout(250, 100, false).height, textScale: 100 });
  assert.equal(stacked.slots, 1, 'stacked strips: one');
});
test('strips: countdown m:ss; every strip text PL + EN', () => {
  assert.equal(stripClock(42), '0:42');
  assert.equal(stripClock(61.2), '1:02');
  for (const key of ['bay', 'hub', 'airport', 'ariaJamAirport', 'queue', 'queueShort', 'queueEmpty', 'seats', 'close', 'closeNone', 'aria', 'ariaJam', 'moreWord', 'moreAria', 'lessAria']) {
    const full = `board.strip.${key}` as keyof typeof en;
    assert.ok(en[full] && pl[full], `missing ${full}`);
  }
});
test('the release session reaches the strips only through the empty slot (no static import of the preview)', () => {
  const session = readFileSync('src/game/session.ts', 'utf8');
  assert.match(session, /from '\.\.\/ui\/strip-skin'/);
  assert.doesNotMatch(session, /board-strips|skin\/board/);
  assert.match(readFileSync('src/ui/strip-skin.ts', 'utf8'), /export const stripSkin: \{ current: StripSkin \| null \} = \{ current: null \}/);
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /import\('\.\/ui\/skin\/board-strips'\)/);
  assert.match(main, /stripSkin\.current = strips\.createBoardStrips/);
  assert.match(readFileSync('src/game/world.ts', 'utf8'), /GAME_PANELS = \[[^\]]*'\.airway-strip-bay'/, 'the bay is a camera inset');
});

test('menu: the run-starting row is the yellow sign; the board lists Today, Puzzles, Logbook, Settings', () => {
  const rows = (saved: boolean) => [...(saved ? [{ id: 'continue', hot: true }] : []), { id: 'endless', hot: !saved },
    { id: 'puzzles' }, { id: 'daily' }, { id: 'settings' }, { id: 'logbook' }];
  assert.deepEqual(menuPlan(rows(false)), { main: 'endless', list: ['daily', 'puzzles', 'logbook', 'settings'] });
  assert.deepEqual(menuPlan(rows(true)), { main: 'continue', list: ['endless', 'daily', 'puzzles', 'logbook', 'settings'] });
  assert.deepEqual(menuPlan([{ id: 'daily' }, { id: 'endless' }]), { main: 'endless', list: ['daily'] });
});
test('print-out: dates, the clock of the jam, wrapped into one day', () => {
  const day = new Date(2026, 10, 8);
  assert.equal(boardDate(day), '08.11');
  assert.equal(printDate(day), '08.11.2026');
  assert.equal(printClock(4 * 60 + 12), '04:12');
  assert.equal(printClock(1440 + 61), '01:01');
  assert.equal(printClock(-1), '23:59');
  assert.equal(printClock(Number.NaN), '00:00');
});
test('print-out: the queue at closing is a row per direction, most numerous first, one glyph a passenger up to the cap', () => {
  const rows = printQueue({ EUN: 3, ME: 12, AFR: 12, ASI: 0, OCE: PRINT_GLYPHS_PER_REGION + 5 }, REGION_IDS);
  assert.deepEqual(rows.map((row) => row.region), ['OCE', 'AFR', 'ME', 'EUN']);
  assert.deepEqual(rows[0], { region: 'OCE', glyphs: PRINT_GLYPHS_PER_REGION, more: 5 });
  assert.deepEqual(rows[3], { region: 'EUN', glyphs: 3, more: 0 });
  assert.deepEqual(printQueue({}, REGION_IDS), []);
});
test('print-out: the weeks table carries each crate and the jam on its last line', () => {
  const weeks = [{ week: 1, routes: 3, extended: 0, removed: 0, aircraft: 3 },
    { week: 2, routes: 1, extended: 1, removed: 0, aircraft: 2, pick: { upgrade: 'turboprop' as const } },
    { week: 3, routes: 0, extended: 0, removed: 1, aircraft: 0, pick: { upgrade: 'hub-expansion' as const, hubId: 'AMM' } }];
  const rows = printWeeks(weeks, (pick) => pick.hubId ? `Hub ${pick.hubId}` : pick.upgrade, 'Zator AMM');
  assert.deepEqual(rows.map((row) => row.notes), [[], ['turboprop'], ['Hub AMM', 'Zator AMM']]);
  assert.deepEqual(rows.map((row) => [row.week, row.routes, row.aircraft]), [[1, 3, 3], [2, 1, 2], [3, 0, 0]]);
  assert.deepEqual(printWeeks([], () => '', 'x'), []);
});
test('boardTwin leaves Linoryt\'s menu, report and U4 pages out, keeps the pause and the training flight', () => {
  const linoryt = readFileSync('src/ui/skin/linoryt.css', 'utf8');
  for (const [from, to] of BOARD_TWIN_CUTS) assert.ok(linoryt.includes(from) && linoryt.includes(to), `marker ${from} / ${to}`);
  const real = boardTwin(linoryt);
  assert.equal(real.includes('.lin-title'), false, 'menu index');
  assert.equal(real.includes('.airway-go-sign::after'), false, 'report');
  assert.equal(real.includes('.airway-logbook__totals'), false, 'U4 pages');
  assert.equal(real.includes('.airway-pause__summary'), true, 'pause geometry stays');
  assert.equal(real.includes('.aw-tutorial-stage'), true, 'training flight geometry stays');
  assert.equal(real.includes('.airway-upgrade'), true, 'weekly board stays (T4)');
});
test('T5 texts: PL + EN, the print-out\'s placeholders', () => {
  for (const catalog of [pl, en]) {
    for (const key of ['board.menu.tagline', 'board.menu.list', 'board.menu.choose', 'board.menu.daily', 'board.report.head',
      'board.report.again', 'board.report.againSub', 'board.report.same', 'board.report.stamp', 'board.report.end'] as const) {
      assert.ok(catalog[key].length > 0, key);
    }
    assert.match(catalog['board.report.hubClosed'], /\{code\}.*\{name\}/);
    assert.match(catalog['board.report.when'], /\{week\}.*\{day\}.*\{time\}/);
    assert.match(catalog['board.report.queue'], /\{waiting\}\/\{capacity\}/);
    for (const key of ['board.report.colWeek', 'board.report.colRoutes', 'board.report.colAircraft', 'board.report.colNote'] as const) {
      assert.ok(catalog[key].length <= 6, `${key} "${catalog[key]}" fits its column`);
    }
  }
});
test('the release menu and report reach the preview only through the empty sheet slot', () => {
  for (const file of ['src/ui/menu/menu.ts', 'src/ui/gameover/index.ts']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /from '\.\.\/sheet-skin'/, file);
    assert.doesNotMatch(source, /board-sheets|skin\/board/, file);
  }
  assert.match(readFileSync('src/ui/sheet-skin.ts', 'utf8'), /export const sheetSkin: \{ current: SheetSkin \| null \} = \{ current: null \}/);
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /import\('\.\/ui\/skin\/board-sheets'\)/);
  assert.match(main, /sheetSkin\.current = sheets\.createBoardSheets/);
});

console.log(`SUMMARY test:board seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
