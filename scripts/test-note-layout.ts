// [night-30a] PLAN-LINORYT.md step U2: the Linoryt airport notes (src/ui/skin/linoryt.ts) laid out by the same engine as
// the Róża notes (src/ui/overlay-layout.ts layoutTags), with the world's stamp ([night-46a] E2's STAMP_SIZE_PX, the size
// projectAirport reports) as the fixed obstacle instead of the rose ring. The fixtures of the former test:roza-names
// (D-262…D-268, D-281) re-run with stamp boxes:
// the store shot game-phone Levant cluster (360×640), game-iphone and night-iphone (440×956), game-tablet and night-tablet
// (768×1024), the hub board open in landscape (915×412) and portrait (360×640). The HUD bands are the Linoryt paper
// margins measured on the preview (`?skin=linoryt`, stub world): top margin and dock. [night-46a] D-301: Róża and
// test:roza-names are gone (U5); this is the note layout's fixture suite.
// [night-73a] D-328 (PLAN-NOWY-KIERUNEK.md step T2): the same fixtures re-run with the UI-A airport signs' sizes
// (src/ui/skin/board-notes.ts signSize: code plate, queue, city strip, NOWE tag; the sign row level with the pin), so the
// engine's promises hold for the new geometry too.
import assert from 'node:assert/strict';
import { layoutTags, NOTE_GAP_X, NOTE_GAP_Y, OWN_MARGIN, type TagBounds, type TagSlot } from '../src/ui/overlay-layout.ts';
import {
  besleyWidth, figureWidth, freshWidth, baseBoardCovers, baseCompactPasses, baseFrameEnd, baseFrameStart,
  baseHomeReach, baseNoteFrame, baseNoteMust, baseRank, baseStampBox, baseStampFallback, baseStampSlot, NAME_LINE,
  noteSize, stampReach, type NoteSize,
} from '../src/ui/skin/base.ts';
import { STAMP_SIZE_PX } from '../src/render/marks.ts';
import { LOD1_GLYPHS, signSize, SIGN_ROW, FRESH_ROW } from '../src/ui/skin/board-notes.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** One airport of a fixture: where its stamp stands and what its note shows. */
interface Airport {
  code: string; name: string; x: number; y: number; hub?: boolean;
  /** Waiting passengers per region group, and the waiting places. */
  groups?: number[]; capacity?: number;
  fresh?: boolean; jam?: number;
}
type Box = { l: number; t: number; r: number; b: number };
type View = TagBounds;
const taken = (a: Airport): number => (a.groups ?? []).reduce((sum, n) => sum + n, 0);
const capacity = (a: Airport): number => a.capacity ?? (a.hub ? 36 : 24);
const sizeOf = (a: Airport, language: 'pl' | 'en' = 'pl'): NoteSize => noteSize({
  name: a.name, code: a.code, hub: a.hub === true, capacity: capacity(a), taken: taken(a), groups: a.groups ?? [], folded: 0,
  stubs: 0, trend: 0, fresh: a.fresh ? (language === 'pl' ? 'NOWE' : 'NEW') : null, jamSeconds: a.jam ?? null,
  jamHead: language === 'pl' ? 'Zator za' : 'Jam in', fillText: `${taken(a)} ${language === 'pl' ? 'z' : 'of'} ${capacity(a)}`,
});
/** [night-73a] D-328: the UI-A sign of the airport at level 1 (one glyph per passenger, 7 then "+n", city under it). */
const signOf = (a: Airport, language: 'pl' | 'en' = 'pl') => {
  const total = taken(a);
  return signSize({ label: a.code, name: a.name, hub: a.hub === true, lod: 1, glyphs: Math.min(LOD1_GLYPHS, total),
    count: total > LOD1_GLYPHS ? '+' + (total - LOD1_GLYPHS) : '', stubs: 0, fresh: a.fresh ? (language === 'pl' ? 'NOWE' : 'NEW') : null,
    jamSeconds: a.jam ?? null });
};
let signs = false; // the fixtures below run with the Linoryt notes, then again with the signs
const half = (a: Airport): number => (a.hub ? STAMP_SIZE_PX.hub : STAMP_SIZE_PX.airport) / 2;
const fakeHost = { querySelector: () => null } as unknown as HTMLElement; // no HUD: the fixture's view is the band
const edge = { width: 0, height: 0, top: 0, bottom: 0, right: 0 };

interface Frame { tags: TagSlot[]; slots: TagSlot[]; airports: Airport[] }
/**
 * One overlay frame as src/ui/overlay.ts runs it in the preview: each airport's note sized, its stamp an obstacle, its
 * places round the stamp, its priority and must flag; the busiest hub must show; layoutTags; the compact runs. `fixed`:
 * more fixed obstacles (the landscape top margin, rank Infinity). `last`: the previous frame (lastPick hysteresis).
 */
function frame(airports: Airport[], view: View, opts: { board?: Box; fixed?: Box[]; last?: Frame } = {}): Frame {
  const bounds = { ...view };
  baseFrameStart(fakeHost, view.width, view.height, bounds, edge);
  const slots: TagSlot[] = [];
  const tags = airports.map((a, i) => {
    const tag: TagSlot = opts.last?.tags[i] ?? { id: a.code, anchorX: 0, anchorY: 0, width: 0, height: 0, active: true, jammed: false,
      x: 0, y: 0, placed: false };
    const sign = signs ? signOf(a) : null;
    const size = sign ?? sizeOf(a);
    tag.width = size.width;
    tag.height = size.height;
    tag.active = !(opts.board && a.x > opts.board.l - 2 && a.x < opts.board.r + 2 && a.y > opts.board.t - 2 && a.y < opts.board.b + 2);
    tag.jammed = a.jam !== undefined;
    tag.minor = taken(a) === 0 && !a.fresh && a.jam === undefined;
    baseStampFallback(baseStampBox(tag), a.x, a.y, half(a), true);
    baseNoteFrame(tag, { code: a.code, hub: a.hub === true, jam: a.jam !== undefined, fresh: a.fresh === true,
      fill: taken(a) / capacity(a), size, viewWidth: view.width, board: opts.board ?? null, ...(sign ? { lineMid: sign.lineMid } : {}) });
    slots.push(tag, baseStampSlot(tag));
    return tag;
  });
  if (opts.board) slots.push(fixedBox('board', opts.board));
  for (const box of opts.fixed ?? []) slots.push(fixedBox('margin', box));
  baseFrameEnd();
  layoutTags(slots, bounds);
  baseCompactPasses(slots, bounds, layoutTags, signs);
  return { tags, slots, airports };
}
const fixedBox = (id: string, b: Box): TagSlot => ({ id, anchorX: 0, anchorY: 0, width: b.r - b.l, height: b.b - b.t, active: true,
  jammed: false, fixed: true, rank: Infinity, x: b.l, y: b.t, placed: false });
const shownTags = (f: Frame): { tag: TagSlot; a: Airport }[] => f.tags.map((tag, i) => ({ tag, a: f.airports[i] })).filter((n) => n.tag.placed);
const boxOf = (t: TagSlot): Box => ({ l: t.x, t: t.y, r: t.x + t.width, b: t.y + t.height });
const meet = (a: Box, b: Box): boolean => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
/** The inked stamp: a square of side 2·half, or the hub octagon round a circle of radius half (its corners). */
function stampPolygon(a: Airport): [number, number][] {
  const h = half(a);
  if (!a.hub) return [[a.x - h, a.y - h], [a.x + h, a.y - h], [a.x + h, a.y + h], [a.x - h, a.y + h]];
  const r = h / Math.cos(Math.PI / 8);
  return Array.from({ length: 8 }, (_, i) => [a.x + r * Math.cos((i + .5) * Math.PI / 4), a.y + r * Math.sin((i + .5) * Math.PI / 4)] as [number, number]);
}
/** A note box meets the inked stamp (its polygon, sampled along the edges and inside). */
function coversStamp(b: Box, a: Airport): boolean {
  const poly = stampPolygon(a);
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length];
    for (let k = 0; k <= 10; k++) {
      const x = x0 + (x1 - x0) * k / 10, y = y0 + (y1 - y0) * k / 10;
      if (x > b.l && x < b.r && y > b.t && y < b.b) return true;
    }
  }
  return a.x > b.l && a.x < b.r && a.y > b.t && a.y < b.b;
}
/** Gap (px) between a note box and a stamp's obstacle disc. */
const discGap = (b: Box, a: Airport): number => {
  const dx = Math.max(b.l - a.x, 0, a.x - b.r), dy = Math.max(b.t - a.y, 0, a.y - b.b);
  return Math.max(0, Math.hypot(dx, dy) - stampReach(half(a), a.hub === true));
};

/** No shown note meets another note, any stamp, the board/margins (fixed boxes) or leaves the band between the margins. */
function assertClear(f: Frame, view: View, fixed: Box[] = []): void {
  const shown = shownTags(f);
  for (const { tag, a } of shown) {
    const b = boxOf(tag);
    for (const other of f.airports) assert(!coversStamp(b, other), `${a.code}'s note covers ${other.code}'s stamp`);
    for (const box of fixed) assert(!meet(b, box), `${a.code}'s note is on a fixed box ${JSON.stringify(box)}`);
    assert(b.l >= 6 - 1e-6 && b.r <= view.width - 6 + 1e-6, `${a.code}'s note leaves the screen (${b.l}..${b.r})`);
    assert(b.t >= view.top - 1e-6 && b.b <= view.height - view.bottom + 1e-6, `${a.code}'s note runs into a margin (${b.t}..${b.b})`);
    for (const { tag: o, a: oa } of shown) if (o !== tag) assert(!meet(b, boxOf(o)), `${a.code}'s note overlaps ${oa.code}'s`);
  }
}
/** D-263: every shown note within its home reach of its own stamp (a jam's has none). */
function assertAtHome(f: Frame): void {
  for (const { tag, a } of shownTags(f)) {
    if (a.jam !== undefined) continue;
    const b = boxOf(tag);
    const dx = Math.max(b.l - a.x, 0, a.x - b.r), dy = Math.max(b.t - a.y, 0, a.y - b.b);
    assert(Math.hypot(dx, dy) <= baseHomeReach(half(a), a.hub === true) + 1e-6, `${a.code}'s note floats ${Math.round(Math.hypot(dx, dy))} px off its stamp`);
  }
}
/** D-264: every shown note is clearly its own airport's: OWN_MARGIN px nearer its own stamp than any other stamp. */
function assertOwned(f: Frame): void {
  for (const { tag, a } of shownTags(f)) {
    const b = boxOf(tag);
    const own = discGap(b, a);
    for (const other of f.airports) {
      if (other === a) continue;
      assert(own + OWN_MARGIN <= discGap(b, other) + 1e-6,
        `${a.code}'s note is ${Math.round(own)} px from its stamp but ${Math.round(discGap(b, other))} px from ${other.code}'s (reads as ${other.code}'s)`);
    }
  }
}
/** D-266: no shown note stacks against another airport's note or stands between that airport and its note. */
function assertApart(f: Frame): void {
  const shown = shownTags(f);
  for (const { tag: t, a } of shown) for (const { tag: o, a: oa } of shown) {
    if (t === o) continue;
    const gapX = Math.max(o.x - t.x - t.width, t.x - o.x - o.width), gapY = Math.max(o.y - t.y - t.height, t.y - o.y - o.height);
    assert(gapX >= NOTE_GAP_X - 3 - 1e-6 || gapY >= NOTE_GAP_Y - 3 - 1e-6, `${a.code}'s note stacks against ${oa.code}'s (${Math.round(gapX)} / ${Math.round(gapY)} px)`);
    const nx = Math.max(o.x, Math.min(oa.x, o.x + o.width)), ny = Math.max(o.y, Math.min(oa.y, o.y + o.height));
    for (let k = 0; k <= 20; k++) {
      const px = oa.x + (nx - oa.x) * k / 20, py = oa.y + (ny - oa.y) * k / 20;
      assert(!(px > t.x && px < t.x + t.width && py > t.y && py < t.y + t.height), `${a.code}'s note stands between ${oa.code} and its note`);
    }
  }
}
const snap = (f: Frame): string => JSON.stringify(f.tags.map((t) => [t.placed, t.compact, t.x, t.y]));
const placedCodes = (f: Frame): string => shownTags(f).map((n) => n.a.code + (n.tag.compact ? '(c)' : '')).join(' ');

// ---- the note itself -------------------------------------------------------------------------------------------------
test('note metrics: name row, fill bar, glyph row; compact is one line and narrower; a jam adds its block', () => {
  const plain = sizeOf({ code: 'AMM', name: 'Amman', x: 0, y: 0, hub: true, groups: [6, 5, 3] });
  assert.equal(plain.height, NAME_LINE + 12 + 20);
  assert(plain.compactWidth < plain.width && plain.compactHeight === NAME_LINE, JSON.stringify(plain));
  const empty = sizeOf({ code: 'RIX', name: 'Ryga', x: 0, y: 0 });
  assert.equal(empty.height, NAME_LINE + 12, 'nobody waiting: name and fill bar only');
  const jam = sizeOf({ code: 'AMM', name: 'Amman', x: 0, y: 0, hub: true, groups: [20, 16], jam: 42 });
  assert.equal(jam.height, plain.height + 3 + 46, 'the jam block under the note');
  assert(jam.width >= 104 && jam.compactWidth >= 104 && jam.compactHeight === NAME_LINE + 49, 'a compact jam keeps its block');
  const fresh = sizeOf({ code: 'BGW', name: 'Bagdad', x: 0, y: 0, fresh: true });
  assert.equal(fresh.compactWidth, besleyWidth('BGW', 14) + 8 + freshWidth('NOWE'), 'compact new = code + NOWE (D-281)');
  // Fill bar: 12 ticks of 5 px for 24 places, 18 of 4 px for a hub's 36: never wider than the hub name row needs.
  assert.equal(sizeOf({ code: 'X', name: 'X', x: 0, y: 0, capacity: 24 }).width, Math.max(60 + 8, besleyWidth('X', 14) + 8));
});
test('note metrics: widths are at least the printed text (Besley advances, tabular figures)', () => {
  // Measured in Chromium (Besley 800 at 14 px, kerned): Wenecja 63.2, Santa Cruz de la Sierra 157.4, AMM 39.1 px.
  assert(besleyWidth('Wenecja', 14) >= 63.2 && besleyWidth('Wenecja', 14) <= 70);
  assert(besleyWidth('Santa Cruz de la Sierra', 14) >= 157.4);
  assert(besleyWidth('AMM', 14) >= 39.1);
  assert(figureWidth('36 z 36', 12.5) >= 4 * .64 * 12.5 + 2 * .23 * 12.5 + .55 * 12.5);
});
test('stamp obstacle: its disc holds the inked square and octagon, the note\'s first places clear it', () => {
  for (const hub of [false, true]) {
    const a: Airport = { code: 'X', name: 'X', x: 100, y: 100, hub };
    const r = stampReach(half(a), hub);
    for (const [x, y] of stampPolygon(a)) assert(Math.hypot(x - 100, y - 100) <= r + 1e-9, 'a corner outside the disc');
  }
  const f = frame([{ code: 'RIX', name: 'Ryga', x: 180, y: 300, groups: [1] }], { width: 360, height: 640, top: 111, bottom: 88, gap: 4 });
  const [tag] = f.tags;
  assert(tag.placed && tag.lastPick === 0 && !tag.compact, 'a lone note takes its first place, right of the stamp');
  assert(tag.x - (180 + 11) <= 12, `close to the stamp (${tag.x - 191} px)`);
  assert(Math.abs(tag.y + NAME_LINE / 2 - 300) <= 1, 'its name line level with the stamp');
});
test('priority (D-262, D-281): jam > new > hub > fuller airport; only a new airport without a jam must show', () => {
  const r = (o: Partial<{ jam: boolean; fresh: boolean; hub: boolean; fill: number }>) =>
    baseRank({ jam: false, fresh: false, hub: false, fill: 0, ...o });
  assert(r({ jam: true }) > r({ fresh: true, hub: true, fill: 1 }) && r({ fresh: true }) > r({ hub: true, fill: 1 }) && r({ hub: true }) > r({ fill: 1 }));
  assert(baseNoteMust({ jam: false, fresh: true }) && !baseNoteMust({ jam: true, fresh: true }) && !baseNoteMust({ jam: false, fresh: false }));
});

// ---- store shot game-phone: the Levant cluster at 360×640 (stamp centres = the D-262 fixture's rose centres) ---------
const PHONE: View = { width: 360, height: 640, top: 111, bottom: 88, gap: 4 };
const LEVANT: Airport[] = [
  { code: 'RIX', name: 'Ryga', x: 132, y: 163 },
  { code: 'VCE', name: 'Wenecja', x: 44, y: 229, groups: [2] },
  { code: 'ATH', name: 'Ateny', x: 101, y: 285, hub: true, groups: [3, 2] },
  { code: 'ANK', name: 'Ankara', x: 169, y: 271, groups: [1] },
  { code: 'AMM', name: 'Amman', x: 192, y: 338, hub: true, groups: [6, 5, 3] },
  { code: 'BGW', name: 'Bagdad', x: 260, y: 323, groups: [2, 1] },
];
test('store shot game-phone: the busiest hub (Amman) keeps its note; notes never cover a note, a stamp or a margin', () => {
  const f = frame(LEVANT, PHONE);
  assert(f.tags[4].placed, `Amman has a note (${placedCodes(f)})`);
  assert(f.tags[4].must, 'Amman is the must note');
  assert(shownTags(f).length >= 4, `only ${placedCodes(f)} have a note`);
  assertClear(f, PHONE);
});
test('store shot game-phone: every note at its own stamp (D-263), clearly its own (D-264), apart from the others (D-266)', () => {
  for (const f of [frame(LEVANT, PHONE), frame(LEVANT, PHONE, { last: frame(LEVANT, PHONE) })]) {
    assertAtHome(f);
    assertOwned(f);
    assertApart(f);
  }
});
test('store shot game-phone: an unchanged frame lays out the same, and 1 px of camera motion flips nothing', () => {
  const first = frame(LEVANT, PHONE);
  const before = snap(first);
  assert.equal(snap(frame(LEVANT, PHONE, { last: first })), before);
  const settled = frame(LEVANT, PHONE, { last: frame(LEVANT, PHONE) });
  for (const d of [-1, 1]) {
    const moved = LEVANT.map((a) => ({ ...a, x: a.x + d, y: a.y + d }));
    const next = frame(moved, PHONE, { last: frame(LEVANT, PHONE, { last: settled }) });
    assert.deepEqual(next.tags.map((t) => [t.placed, t.compact, t.lastPick]), settled.tags.map((t) => [t.placed, t.compact, t.lastPick]));
  }
});
test('store shot game-phone: boxed in by stamps on every side, the busiest hub hides its note rather than cover one', () => {
  const tight: Airport[] = [
    ...LEVANT.map((a) => ({ ...a })),
    { code: 'AQJ', name: 'Akaba', x: 192, y: 372, groups: [2] }, { code: 'HFA', name: 'Hajfa', x: 158, y: 338, groups: [2] },
    { code: 'DAM', name: 'Damaszek', x: 226, y: 338, groups: [2] }, { code: 'BEY', name: 'Bejrut', x: 192, y: 304, groups: [2] },
  ];
  const f = frame(tight, PHONE);
  assert(!f.tags[4].placed, `Amman hides its note (${placedCodes(f)})`);
  assertClear(f, PHONE);
  assertAtHome(f);
});
test('new airport (D-281): in the Levant cluster a new airport shows its note, at least code + NOWE', () => {
  for (const code of ['BGW', 'VCE', 'ANK']) {
    const at = LEVANT.findIndex((a) => a.code === code);
    const f = frame(LEVANT.map((a) => (a.code === code ? { ...a, fresh: true, groups: [] } : a)), PHONE);
    assert(f.tags[at].placed, `the new ${code}'s note shows (${placedCodes(f)})`);
    assertClear(f, PHONE);
    assertAtHome(f);
    assertOwned(f);
  }
});
test('jam (D-262): a jammed airport goes first, its note keeps the jam block; the busiest other hub still shows', () => {
  const at = LEVANT.findIndex((a) => a.code === 'BGW');
  const f = frame(LEVANT.map((a) => (a.code === 'BGW' ? { ...a, groups: [12, 8, 4], jam: 42 } : a)), PHONE);
  assert(f.tags[at].placed, `the jam's note shows (${placedCodes(f)})`);
  assert(f.tags[at].height >= NAME_LINE + 49, 'with its jam block');
  assertClear(f, PHONE);
});

// The landscape game screen of test:e2e:screen-audit:stub (PL 915×412, seed 0xA1A1 after the bot's afternoon; stamps read with
// the DEV probe): the dock a column from x 783, the top margin a block in the top-left corner. Before the compact runs
// Wenecja and Ankara hid (their full notes had no room and the one-line compact form was never tried at its height).
const LANDSCAPE_GAME: Airport[] = [
  { code: 'ATH', name: 'Ateny', x: 323, y: 210, hub: true, groups: [2] }, { code: 'ANK', name: 'Ankara', x: 392, y: 196, groups: [1] },
  { code: 'AMM', name: 'Amman', x: 415, y: 260, hub: true, groups: [1, 1] }, { code: 'BGW', name: 'Bagdad', x: 484, y: 248, groups: [2] },
  { code: 'VCE', name: 'Wenecja', x: 271, y: 162, groups: [1] }, { code: 'RIX', name: 'Ryga', x: 357, y: 106 },
  { code: 'KHI', name: 'Karaczi', x: 664, y: 314, groups: [4, 2] },
];
test('landscape game (D-262): a note with no room for its full form prints its one-line compact form instead of hiding', () => {
  const view: View = { width: 783, height: 412, top: 0, bottom: 0, gap: 4 };
  const pass: Box = { l: 0, t: 0, r: 480, b: 90 };
  const f = frame(LANDSCAPE_GAME, view, { fixed: [pass] });
  assert.equal(shownTags(f).length, 7, placedCodes(f));
  assert(f.tags[1].compact && f.tags[4].compact, `Ankara and Wenecja compact (${placedCodes(f)})`);
  assert(f.tags[1].height === NAME_LINE && f.tags[1].width === sizeOf(LANDSCAPE_GAME[1]).compactWidth, 'the compact box is one line');
  assert(!f.tags[0].compact && !f.tags[2].compact, 'the hubs keep their full notes');
  assertClear(f, view, [pass]);
  assertAtHome(f);
  assertOwned(f);
  assertApart(f);
  assert.equal(snap(frame(LANDSCAPE_GAME, view, { fixed: [pass], last: f })), snap(f), 'stable on the next frame');
});

// ---- store shots game-iphone / night-iphone (440×956) and game-tablet / night-tablet (768×1024) -----------------------
const IPHONE: View = { width: 440, height: 956, top: 100, bottom: 91, gap: 4 };
const iphone = (groups: number[][]): Airport[] => [
  { code: 'ATH', name: 'Ateny', x: 124.6, y: 436.8, hub: true },
  { code: 'ANK', name: 'Ankara', x: 206.8, y: 419.6 },
  { code: 'AMM', name: 'Amman', x: 234.6, y: 501.3, hub: true },
  { code: 'BGW', name: 'Bagdad', x: 315.7, y: 484.9 },
  { code: 'VCE', name: 'Wenecja', x: 54.3, y: 366.2 },
  { code: 'RIX', name: 'Ryga', x: 160.6, y: 283.1 },
].map((a, i) => ({ ...a, groups: groups[i] }));
const GAME_IPHONE = iphone([[2], [1], [2, 1], [2], [1], []]);
const NIGHT_IPHONE = iphone([[2, 1], [], [3, 2], [2, 1], [], []]);
for (const [id, scene] of [['game', GAME_IPHONE], ['night', NIGHT_IPHONE]] as const) {
  test(`store shot ${id}-iphone: every note clear, at home, its own, apart; the hubs keep their notes; stable`, () => {
    const first = frame(scene, IPHONE);
    for (const f of [first, frame(scene, IPHONE, { last: first })]) {
      assertClear(f, IPHONE);
      assertAtHome(f);
      assertOwned(f);
      assertApart(f);
      assert(f.tags[2].placed, `Amman (busiest hub) has a note (${placedCodes(f)})`);
      assert(f.tags[0].placed, `Ateny keeps a note (${placedCodes(f)})`);
      assert(shownTags(f).length >= 4, `only ${placedCodes(f)}`);
    }
    assert.equal(snap(frame(scene, IPHONE, { last: first })), snap(first));
  });
}
const TABLET: View = { width: 768, height: 1024, top: 100, bottom: 93, gap: 4 };
const tablet = (groups: number[][]): Airport[] => [
  { code: 'ATH', name: 'Ateny', x: 182.7, y: 452.3, hub: true },
  { code: 'ANK', name: 'Ankara', x: 308.8, y: 426.1 },
  { code: 'AMM', name: 'Amman', x: 351.7, y: 548.3, hub: true },
  { code: 'BGW', name: 'Bagdad', x: 476.8, y: 524.1 },
  { code: 'VCE', name: 'Wenecja', x: 79.8, y: 352.3 },
  { code: 'RIX', name: 'Ryga', x: 241.1, y: 236.1 },
].map((a, i) => ({ ...a, groups: groups[i] }));
for (const [id, scene] of [['game', tablet([[2], [1], [2, 1], [2], [1], []])], ['night', tablet([[2, 1], [], [3, 2], [2, 1], [], []])]] as const) {
  test(`store shot ${id}-tablet (D-266): every note shows, apart from the others; Bagdad's not under Ankara's`, () => {
    const f = frame(scene, TABLET);
    assertClear(f, TABLET);
    assertAtHome(f);
    assertOwned(f);
    assertApart(f);
    assert.equal(shownTags(f).length, 6, `only ${placedCodes(f)}`);
    const [, ank, , bgw] = f.tags;
    assert(bgw.y >= ank.y + ank.height + NOTE_GAP_Y || bgw.x >= ank.x + ank.width + NOTE_GAP_X || bgw.y + bgw.height + NOTE_GAP_Y <= ank.y,
      'BGW\'s note does not hang right under ANK\'s');
  });
}

// ---- hub board open (D-268): landscape 915×412 (the dock a column from x 783, the top margin a corner block) and portrait
const LANDSCAPE: View = { width: 783, height: 412, top: 0, bottom: 0, gap: 4 };
const LANDSCAPE_PASS: Box = { l: 0, t: 0, r: 480, b: 90 };
const LANDSCAPE_BOARD: Box = { l: 413, t: 96, r: 773, b: 330 };
const LANDSCAPE_SCENE: Airport[] = [
  { code: 'IST', name: 'Stambuł', x: 470, y: 210, hub: true, groups: [12, 10, 8] }, // the board's hub, under it
  { code: 'RIX', name: 'Ryga', x: 400, y: 160, groups: [3] }, // stamp at the board's edge
  { code: 'VNO', name: 'Wilno', x: 360, y: 250, groups: [2] }, // right beside the board
  { code: 'ATH', name: 'Ateny', x: 520, y: 372, hub: true, groups: [4, 2] }, // just under it
  { code: 'PRG', name: 'Praga', x: 140, y: 190, groups: [3, 2] }, // well clear
];
const PORTRAIT_BOARD: Box = { l: 12, t: 120, r: 348, b: 420 };
const PORTRAIT_SCENE: Airport[] = [
  { code: 'IST', name: 'Stambuł', x: 180, y: 250, hub: true, groups: [12, 10, 8] },
  { code: 'RIX', name: 'Ryga', x: 120, y: 470, groups: [3] },
  { code: 'CAI', name: 'Kair', x: 250, y: 492, hub: true, groups: [5, 4] },
  { code: 'BGW', name: 'Bagdad', x: 330, y: 425, groups: [2] }, // stamp under the board's corner
];
for (const [id, scene, board, view, fixed] of [
  ['landscape 915×412', LANDSCAPE_SCENE, LANDSCAPE_BOARD, LANDSCAPE, [LANDSCAPE_PASS]],
  ['portrait 360×640', PORTRAIT_SCENE, PORTRAIT_BOARD, PHONE, []],
] as const) {
  test(`hub board open, ${id} (D-268): no note on the board or the top margin; the board's hub steps back`, () => {
    const f = frame([...scene], view, { board, fixed: [...fixed] });
    assertClear(f, view, [board, ...fixed]);
    assertAtHome(f);
    assertOwned(f);
    assert(!f.tags[0].placed, 'the board\'s own hub (under the board) shows no note');
    assert(shownTags(f).length >= 2, `notes clear of the board stay (${placedCodes(f)})`);
  });
}
test('hub board open (D-268): a stamp the board covers steps back; a stamp beside it keeps its note left of the board', () => {
  const f = frame([...LANDSCAPE_SCENE], LANDSCAPE, { board: LANDSCAPE_BOARD, fixed: [LANDSCAPE_PASS] });
  assert(baseBoardCovers({ x: 400, y: 160, half: 11, visible: true }, false, LANDSCAPE_BOARD), 'Ryga\'s stamp is under the board edge');
  assert(!f.tags[1].placed, 'Ryga steps back');
  assert(f.tags[2].placed && f.tags[2].x + f.tags[2].width <= LANDSCAPE_BOARD.l, `Wilno keeps its note left of the board ${JSON.stringify(f.tags[2])}`);
  assert(f.tags[4].placed, 'Praga keeps its note');
  const closed = frame([...LANDSCAPE_SCENE], LANDSCAPE, { fixed: [LANDSCAPE_PASS] });
  assert(closed.tags[0].placed && closed.tags[1].placed, `with the board closed Stambuł and Ryga show (${placedCodes(closed)})`);
  assertClear(closed, LANDSCAPE, [LANDSCAPE_PASS]);
});

// ---- [night-73a] D-328: the same promises with the UI-A airport signs ------------------------------------------------
signs = true;
test('signs: a lone sign takes its first place right of the pin, its sign row level with the pin; compact keeps the row level', () => {
  const f = frame([{ code: 'RIX', name: 'Ryga', x: 180, y: 300, groups: [1] }], PHONE);
  const [tag] = f.tags;
  assert(tag.placed && tag.lastPick === 0 && !tag.compact, 'right of the pin');
  assert(Math.abs(tag.y + SIGN_ROW / 2 - 300) <= 1, `sign row level with the pin (${tag.y + SIGN_ROW / 2})`);
  const fresh = frame([{ code: 'RIX', name: 'Ryga', x: 180, y: 300, fresh: true }], PHONE);
  assert(Math.abs(fresh.tags[0].y + FRESH_ROW + SIGN_ROW / 2 - 300) <= 1, 'under its NOWE tag too');
  // Boxed in left and right: the sign takes its compact form with the row still level with the pin.
  const tight = frame([{ code: 'RIX', name: 'Ryga', x: 180, y: 300, groups: [5] }], PHONE,
    { fixed: [{ l: 235, t: 280, r: 360, b: 340 }, { l: 0, t: 280, r: 125, b: 340 }, { l: 0, t: 316, r: 360, b: 360 }, { l: 0, t: 200, r: 360, b: 285 }] });
  if (tight.tags[0].placed && tight.tags[0].compact) assert(Math.abs(tight.tags[0].y + SIGN_ROW / 2 - 300) <= 1, `compact row level (${tight.tags[0].y})`);
});
test('signs, store shot game-phone: the busiest hub keeps its sign; clear, at home, its own, apart; stable', () => {
  const f = frame(LEVANT, PHONE);
  assert(f.tags[4].placed, `Amman has a sign (${placedCodes(f)})`);
  assert(shownTags(f).length >= 4, `only ${placedCodes(f)}`);
  for (const g of [f, frame(LEVANT, PHONE, { last: f })]) { assertClear(g, PHONE); assertAtHome(g); assertOwned(g); assertApart(g); }
  assert.equal(snap(frame(LEVANT, PHONE, { last: f })), snap(f));
});
test('signs, new airport (D-281) and jam (D-262): a new airport\'s sign shows; a jam goes first', () => {
  for (const code of ['BGW', 'VCE', 'ANK']) {
    const at = LEVANT.findIndex((a) => a.code === code);
    const f = frame(LEVANT.map((a) => (a.code === code ? { ...a, fresh: true, groups: [] } : a)), PHONE);
    assert(f.tags[at].placed, `the new ${code}'s sign shows (${placedCodes(f)})`);
    assertClear(f, PHONE);
    assertAtHome(f);
    assertOwned(f);
  }
  const at = LEVANT.findIndex((a) => a.code === 'BGW');
  const jam = frame(LEVANT.map((a) => (a.code === 'BGW' ? { ...a, groups: [12, 8, 4], jam: 42 } : a)), PHONE);
  assert(jam.tags[at].placed, `the jam's sign shows (${placedCodes(jam)})`);
  assertClear(jam, PHONE);
});
test('signs, landscape game: every airport shows a sign (full or the code alone), clear, at home, its own, apart', () => {
  const view: View = { width: 783, height: 412, top: 0, bottom: 0, gap: 4 };
  const pass: Box = { l: 0, t: 0, r: 480, b: 90 };
  const f = frame(LANDSCAPE_GAME, view, { fixed: [pass] });
  assert(shownTags(f).length >= 6, placedCodes(f));
  assertClear(f, view, [pass]);
  assertAtHome(f);
  assertOwned(f);
  assertApart(f);
  assert.equal(snap(frame(LANDSCAPE_GAME, view, { fixed: [pass], last: f })), snap(f), 'stable on the next frame');
});
for (const [id, scene, view] of [['game-iphone', GAME_IPHONE, IPHONE], ['night-iphone', NIGHT_IPHONE, IPHONE],
  ['game-tablet', tablet([[2], [1], [2, 1], [2], [1], []]), TABLET]] as const) {
  test(`signs, store shot ${id}: clear, at home, its own, apart; both hubs keep their signs`, () => {
    const f = frame(scene, view);
    assertClear(f, view);
    assertAtHome(f);
    assertOwned(f);
    assertApart(f);
    assert(f.tags[0].placed && f.tags[2].placed, `Ateny and Amman (${placedCodes(f)})`);
  });
}
for (const [id, scene, board, view, fixed] of [
  ['landscape 915×412', LANDSCAPE_SCENE, LANDSCAPE_BOARD, LANDSCAPE, [LANDSCAPE_PASS]],
  ['portrait 360×640', PORTRAIT_SCENE, PORTRAIT_BOARD, PHONE, []],
] as const) {
  test(`signs, hub board open ${id} (D-268): no sign on the board; the board's hub steps back`, () => {
    const f = frame([...scene], view, { board, fixed: [...fixed] });
    assertClear(f, view, [board, ...fixed]);
    assertAtHome(f);
    assertOwned(f);
    assert(!f.tags[0].placed, 'the board\'s own hub shows no sign');
  });
}

console.log(`SUMMARY test:note-layout passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
