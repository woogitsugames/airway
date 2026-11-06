// [night-14b] D-259: curved city names on airport roses (src/ui/skin/roza.ts rozaNameLayout) never overlap. In a dense
// cluster at close zoom a lower-priority rose shortens its name to the IATA code or drops it; a jam, a hub and the
// fuller airport keep theirs first; a lone rose always keeps its name; a label it already shows needs less clearance.
// [night-16a] D-262: a name whose top is taken runs along the bottom of the ring before it shortens; the store shot's
// Levant cluster (game-phone 360×640) keeps the busiest hub's name and its note (code and fill at least).
import assert from 'node:assert/strict';
import { roseLabelBelow, roseLabelText, roseNameBox, roseRank, rozaBoardCovers, rozaCaptionClashes, rozaNameLayout, rozaNotePlaces, rozaRoseObstacles, roseHomeReach, roseRingHalf,
  type RoseLabel, type RoseLabelMode } from '../src/ui/skin/roza.ts';
import { layoutTags, NOTE_GAP_X, NOTE_GAP_Y, OWN_MARGIN, type TagSlot } from '../src/ui/overlay-layout.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const rose = (x: number, y: number, name: string, code: string, extra: Partial<RoseLabel> = {}): RoseLabel =>
  ({ x, y, r: 14, hub: false, jam: false, fill: 0, name, code, ...extra });
/** No two shown labels overlap, and no label covers another rose's ticks. */
function assertClear(labels: RoseLabel[], modes: RoseLabelMode[]): void {
  const boxes = labels.map((label, i) => (modes[i] === 'none' ? null : roseNameBox(label, roseLabelText(label, modes[i]), roseLabelBelow(modes[i]))));
  boxes.forEach((a, i) => {
    if (!a) return;
    boxes.forEach((b, j) => {
      if (j <= i || !b) return;
      assert(!(a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b), `${labels[i].code} and ${labels[j].code} overlap`);
    });
    labels.forEach((other, j) => {
      if (j === i) return;
      const dx = Math.max(a.l - other.x, 0, other.x - a.r), dy = Math.max(a.t - other.y, 0, other.y - a.b);
      assert(dx * dx + dy * dy >= (other.r + 9) ** 2, `${labels[i].code}'s label covers ${other.code}'s rose`);
    });
  });
}

test('a lone rose and well-spaced roses keep their names', () => {
  assert.deepEqual(rozaNameLayout([rose(200, 300, 'Santa Cruz de la Sierra', 'VVI')]), ['name']);
  assert.deepEqual(rozaNameLayout([rose(100, 300, 'Ateny', 'ATH'), rose(300, 300, 'Ankara', 'ANK'), rose(200, 500, 'Amman', 'AMM')]),
    ['name', 'name', 'name']);
});
test('two roses side by side: the second sets its name along the bottom of its ring', () => {
  const labels = [rose(200, 300, 'Frankfurt', 'FRA'), rose(262, 300, 'Düsseldorf', 'DUS')];
  const modes = rozaNameLayout(labels);
  assert.deepEqual(modes, ['name', 'name-below']);
  assertClear(labels, modes);
});
test('the fuller airport, a hub and a jam keep their names first', () => {
  const pair = (gap: number, extra: Partial<RoseLabel>) =>
    rozaNameLayout([rose(200, 300, 'Frankfurt', 'FRA'), rose(200 + gap, 300, 'Düsseldorf', 'DUS', extra)]);
  assert.deepEqual(pair(62, { fill: .8 }), ['name-below', 'name']);
  // A hub's and a jam's names run on a wider ring, so the pair stands a little further apart.
  assert.deepEqual(pair(80, { hub: true, r: 20 }).map((m) => m === 'name'), [false, true]);
  assert.deepEqual(pair(80, { jam: true }).map((m) => m === 'name'), [false, true]);
});
test('a rose right under another sets its name below rather than cover the ticks; boxed in, it drops it', () => {
  const labels = [rose(200, 300, 'Bruksela', 'BRU', { fill: .5 }), rose(200, 338, 'Antwerpia', 'ANR')];
  const modes = rozaNameLayout(labels);
  assert.deepEqual(modes, ['name', 'name-below']);
  assertClear(labels, modes);
  const stack = [...labels, rose(200, 376, 'Gandawa', 'GNE', { fill: .5 })];
  const stacked = rozaNameLayout(stack);
  assert.deepEqual(stacked, ['name', 'none', 'name-below']);
  assertClear(stack, stacked);
});
test('a dense European cluster at close zoom never overlaps (seeded grid)', () => {
  let seed = 0xA1A1;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const names = ['Amsterdam', 'Bruksela', 'Kolonia', 'Düsseldorf', 'Frankfurt', 'Luksemburg', 'Paryż', 'Londyn', 'Rotterdam',
    'Antwerpia', 'Lille', 'Eindhoven', 'Stuttgart', 'Strasburg', 'Zurych', 'Monachium', 'Hamburg', 'Bremen', 'Hanower', 'Berlin'];
  for (let round = 0; round < 40; round++) {
    const labels = names.map((name, i) => rose(40 + rnd() * 340, 120 + rnd() * 500, name, name.slice(0, 3).toUpperCase(),
      { r: 10 + rnd() * 14, hub: i % 7 === 0, fill: rnd(), jam: i === round % 20 && round % 3 === 0 }));
    const modes = rozaNameLayout(labels);
    assertClear(labels, modes);
    assert(modes.some((m) => m === 'name'), 'at least one name survives');
  }
});
test('hysteresis: a label already shown keeps it at a clearance a new one would not get', () => {
  const at = (gap: number, last?: RoseLabelMode) => rozaNameLayout([rose(200, 300, 'Frankfurt', 'FRA', { fill: .9 }),
    rose(200 + gap, 300, 'Düsseldorf', 'DUS', last ? { last } : {})])[1];
  // Find the smallest gap at which a new label fits; one pixel closer, a label already shown stays.
  let gap = 30;
  while (at(gap) === 'none' && gap < 200) gap++;
  const shown = at(gap);
  assert.notEqual(shown, 'none');
  assert.equal(at(gap - 1), 'none');
  assert.equal(at(gap - 1, shown), shown);
  // The same for a full name on top (the pair one above the other, the lower one fuller).
  const up = (gap: number, last?: RoseLabelMode) => rozaNameLayout([rose(200, 300, 'Frankfurt', 'FRA'),
    rose(200 + gap, 300, 'Düsseldorf', 'DUS', { fill: .9, ...(last ? { last } : {}) })])[1];
  let wide = 30;
  while (up(wide) !== 'name' && wide < 300) wide++;
  assert.notEqual(up(wide - 1), 'name');
  assert.equal(up(wide - 1, 'name'), 'name');
});
test('the layout is deterministic and keeps the input order', () => {
  const labels = [rose(200, 300, 'Frankfurt', 'FRA'), rose(262, 300, 'Düsseldorf', 'DUS'), rose(500, 300, 'Wiedeń', 'VIE')];
  assert.deepEqual(rozaNameLayout(labels), rozaNameLayout(labels));
  assert.equal(rozaNameLayout(labels)[2], 'name');
});

test('a dock caption over a rose or its name steps back; one beside it stays (store shot game-phone: "Satelita" on Amman)', () => {
  const labels = [rose(290, 500, 'Amman', 'AMM', { r: 52, hub: true }), rose(390, 480, 'Bagdad', 'BGW', { r: 36 })];
  const modes = rozaNameLayout(labels);
  const captions = [
    { l: 320, t: 530, r: 385, b: 548 }, // "Satelita" on Amman's ring
    { l: 400, t: 520, r: 470, b: 538 }, // "Tempo 1×" on Bagdad's ticks
    { l: 60, t: 700, r: 140, b: 718 }, // "Cofnij" far away
    { l: 270, t: 426, r: 310, b: 436 }, // on Amman's name, clear of its ticks
  ];
  assert.deepEqual(rozaCaptionClashes(captions, labels, modes), [true, true, false, modes[0] !== 'none']);
  assert.deepEqual(rozaCaptionClashes(captions, [], []), [false, false, false, false]);
});
// [night-16a] D-262: the store shot game-phone (360×640, docs/store/shots/pl/game-phone.png before D-262): Ateny, Ankara,
// Amman, Bagdad, Wenecja and Ryga in one cluster. Amman, the busiest hub, lost both its name and its note there, and
// only RIX and ANK kept a note, because whoever was placed first won. Positions and medallion radii read off that PNG.
type Scene = { label: RoseLabel; width: number; compact: number; minor?: boolean }[];
type View = { width: number; height: number; top: number; bottom: number; gap: number };
const LEVANT: Scene = [
  { label: rose(132, 163, 'Ryga', 'RIX', { r: 23, fill: 0 }), width: 72, compact: 72 },
  { label: rose(44, 229, 'Wenecja', 'VCE', { r: 22, fill: 2 / 24 }), width: 104, compact: 84 },
  { label: rose(101, 285, 'Ateny', 'ATH', { r: 34, hub: true, fill: 5 / 24 }), width: 132, compact: 84 },
  { label: rose(169, 271, 'Ankara', 'ANK', { r: 25, fill: 1 / 24 }), width: 110, compact: 84 },
  { label: rose(192, 338, 'Amman', 'AMM', { r: 36, hub: true, fill: 14 / 24 }), width: 196, compact: 96 },
  { label: rose(260, 323, 'Bagdad', 'BGW', { r: 25, fill: 3 / 24 }), width: 104, compact: 84 },
];
const PHONE = { width: 360, height: 640, top: 72, bottom: 120, gap: 4 };
/** [night-16b] D-263: the Róża dock symbols on their arc in that shot (globe mode, hub, widebody; 48 × 48 centres). */
const DOCK = [[233, 388], [182, 419], [146, 469]];
/** One overlay frame as src/ui/overlay.ts runs it: names, then the notes beside the roses (fixed rose boxes). */
function levantFrame(scene: Scene, last?: { modes: RoseLabelMode[]; tags: TagSlot[] }, view: View = PHONE, dock: number[][] = DOCK,
  screenWidth = view.width) {
  const labels = scene.map((s, i) => ({ ...s.label, last: last?.modes[i] }));
  const modes = rozaNameLayout(labels);
  const busiest = labels.reduce((best, l, i) => (l.hub && (best < 0 || roseRank(l) > roseRank(labels[best])) ? i : best), -1);
  const slots: TagSlot[] = [];
  const tags = labels.map((label, i) => {
    const tag: TagSlot = last?.tags[i] ?? { id: label.code, anchorX: 0, anchorY: 0, width: 0, height: 30, active: true, jammed: false,
      x: 0, y: 0, placed: false };
    tag.width = scene[i].width;
    tag.compactWidth = scene[i].compact;
    tag.minor = scene[i].minor ?? label.fill === 0;
    tag.rank = roseRank(label);
    tag.must = i === busiest;
    rozaNotePlaces(tag, label, modes[i], screenWidth);
    const box: TagSlot = { id: label.code + '~rose', anchorX: 0, anchorY: 0, width: 0, height: 0, active: true, jammed: false, fixed: true,
      x: 0, y: 0, placed: false, rank: tag.rank };
    const name: TagSlot = { ...box, id: label.code + '~name' };
    rozaRoseObstacles(box, name, label, modes[i]);
    slots.push(tag, box, name);
    return tag;
  });
  for (const [x, y] of dock) slots.push({ id: 'dock', anchorX: 0, anchorY: 0, width: 48, height: 48, active: true, jammed: false,
    fixed: true, x: x - 24, y: y - 24, placed: false, rank: Infinity });
  layoutTags(slots, view);
  return { labels, modes, tags, slots };
}
test('store shot game-phone: the busiest hub (Amman) keeps its name and its note; names never overlap', () => {
  const { labels, modes, tags } = levantFrame(LEVANT);
  assertClear(labels, modes);
  assert.notEqual(modes[4], 'none', 'Amman has a name');
  assert(tags[4].placed, 'Amman has a note');
  // Priority jam > hub > fuller: both hubs keep a name, and every airport with passengers waiting beats Ryga (empty).
  assert.notEqual(modes[2], 'none', 'Ateny has a name');
  assert(tags.filter((t) => t.placed).length >= 3, `only ${tags.filter((t) => t.placed).map((t) => t.id)} have a note`);
});
test('store shot game-phone (D-263): Amman\'s compact note stands beside its own name, level with it', () => {
  const { labels, modes, tags } = levantFrame(LEVANT);
  const amm = tags[4];
  assert(amm.placed && amm.compact === true, 'Amman shows the compact note');
  const name = roseNameBox(labels[4], roseLabelText(labels[4], modes[4]), roseLabelBelow(modes[4]));
  const mid = amm.y + amm.height / 2;
  assert(mid > name.t && mid < name.b, `the note (middle ${mid}) is level with the name (${Math.round(name.t)}–${Math.round(name.b)})`);
  assert(amm.x + amm.width <= name.l || amm.x >= name.r, 'beside the name, not on it');
  assert(Math.min(Math.abs(amm.x + amm.width - name.l), Math.abs(amm.x - name.r)) <= 4 + 36, 'next to the name');
});
test('store shot game-phone: no note covers another note, a rose\'s name or a dock symbol', () => {
  const { slots } = levantFrame(LEVANT);
  const shown = slots.filter((s) => s.placed);
  shown.forEach((a, i) => shown.forEach((b, j) => {
    // Rings are discs (assertNotesAtHome checks them; a note may use the free corner of a ring's box).
    if (j <= i || (a.fixed && b.fixed) || a.ring || b.ring) return;
    assert(!(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height), `${a.id} overlaps ${b.id}`);
  }));
  shown.forEach((s) => assert(s.fixed || (s.x >= 6 && s.x + s.width <= PHONE.width - 6), `${s.id} leaves the screen`));
});
/** [night-16b] D-263: no shown note covers any rose's ring of ticks, and each stays within one radius of its own ring. */
function assertNotesAtHome(labels: RoseLabel[], tags: TagSlot[]): void {
  tags.forEach((t, i) => {
    if (!t.placed) return;
    labels.forEach((l) => {
      const dx = Math.max(t.x - l.x, 0, l.x - t.x - t.width), dy = Math.max(t.y - l.y, 0, l.y - t.y - t.height);
      assert(dx * dx + dy * dy >= (l.r + 9) ** 2, `${t.id}'s note covers ${l.code}'s ring`);
    });
    const own = labels[i];
    const dx = Math.max(t.x - own.x, 0, own.x - t.x - t.width), dy = Math.max(t.y - own.y, 0, own.y - t.y - t.height);
    assert(Math.hypot(dx, dy) <= roseHomeReach(own.r), `${t.id}'s note floats ${Math.round(Math.hypot(dx, dy) - own.r)} px off its ring`);
  });
}
test('store shot game-phone: no note covers a rose ring, every note stays within one radius of its own rose', () => {
  const { labels, tags } = levantFrame(LEVANT);
  assertNotesAtHome(labels, tags);
  assert(tags[4].placed, 'Amman has a note');
});
test('store shot game-phone: boxed in by rings on every side, the busiest hub hides its note rather than cover one', () => {
  // Amman's neighbours pressed in so that every place near it touches a ring (D-263: a ring is never covered).
  const tight = LEVANT.map((s) => ({ ...s, label: { ...s.label } }));
  tight[3].label.x = 205; tight[3].label.y = 290; // Ankara right above Amman
  tight[5].label.x = 245; // Bagdad nearer
  tight.push({ label: rose(185, 400, 'Akaba', 'AQJ', { r: 25, fill: .3 }), width: 104, compact: 84 });
  tight.push({ label: rose(130, 360, 'Hajfa', 'HFA', { r: 25, fill: .3 }), width: 104, compact: 84 });
  const { labels, tags } = levantFrame(tight);
  assert(!tags[4].placed, 'Amman hides its note');
  assertNotesAtHome(labels, tags);
});
test('store shot game-phone: an unchanged frame lays out the same, and 1 px of camera motion flips nothing', () => {
  const first = levantFrame(LEVANT);
  const snap = (f: ReturnType<typeof levantFrame>) => JSON.stringify([f.modes, f.tags.map((t) => [t.placed, t.compact, t.x, t.y])]);
  const before = snap(first);
  const second = levantFrame(LEVANT, first);
  assert.equal(snap(second), before);
  for (const d of [-1, 1]) {
    const moved = LEVANT.map((s) => ({ ...s, label: { ...s.label, x: s.label.x + d, y: s.label.y + d } }));
    const next = levantFrame(moved, levantFrame(LEVANT, levantFrame(LEVANT)));
    assert.deepEqual(next.modes, first.modes);
    assert.deepEqual(next.tags.map((t) => [t.placed, t.compact, t.lastPick]), first.tags.map((t) => [t.placed, t.compact, t.lastPick]));
  }
});

// [night-18a] D-264: the store shots game-iphone and night-iphone (440×956, docs/store/shots/pl/ after PR #271): the
// layout inputs read from the real overlay in those scenes (rose centres, medallion radii, fills, note widths, the dock
// symbols, the HUD bands). There "ATH 2 z 36" hung right above Ankara's name and "BGW 2 z 24" stood level beside
// Ankara's ring: both read as Ankara's notes.
const IPHONE: View = { width: 440, height: 956, top: 84, bottom: 96, gap: 4 };
const IPHONE_DOCK = [[223, 908], [212, 847], [226, 786], [262, 736], [315, 705], [377, 696]];
const iphoneScene = (fills: number[], widths: number[], minor: boolean[]): Scene => [
  rose(124.6, 436.8, 'Ateny', 'ATH', { r: 40, hub: true }),
  rose(206.8, 419.6, 'Ankara', 'ANK', { r: 29.7 }),
  rose(234.6, 501.3, 'Amman', 'AMM', { r: 40, hub: true }),
  rose(315.7, 484.9, 'Bagdad', 'BGW', { r: 29.1 }),
  rose(54.3, 366.2, 'Wenecja', 'VCE', { r: 26.1 }),
  rose(160.6, 283.1, 'Ryga', 'RIX', { r: 27.3 }),
].map((label, i) => ({ label: { ...label, fill: fills[i] }, width: widths[i], compact: 89, minor: minor[i] }));
const GAME_IPHONE = iphoneScene([2 / 36, 1 / 24, 3 / 36, 2 / 24, 1 / 24, 0], [144, 144, 178, 178, 144, 103],
  [false, false, false, false, false, true]);
const NIGHT_IPHONE = iphoneScene([3 / 36, 0, 5 / 36, 3 / 24, 0, 0], [144, 103, 144, 178, 103, 103],
  [false, true, false, false, true, true]);
const iphoneFrame = (scene: Scene, last?: { modes: RoseLabelMode[]; tags: TagSlot[] }) => levantFrame(scene, last, IPHONE, IPHONE_DOCK);
/** The frame as the shot met it: what each rose and note showed the frame before (labels, then the places they held). */
function iphoneShotFrame(scene: Scene) {
  const before = iphoneFrame(scene);
  [5, -1, 1, 9, -1, 0].forEach((pick, i) => { before.tags[i].lastPick = pick; });
  return iphoneFrame(scene, { modes: ['name', 'name', 'name-below', 'name', 'name', 'name'], tags: before.tags });
}
/**
 * [night-18a] D-264: every shown note is clearly its own rose's: its gap to its own ring (or to its own name when it
 * stands level beside it) is at least OWN_MARGIN px smaller than its gap to any other rose's ring, and it keeps
 * OWN_MARGIN px from every other rose's name.
 */
function assertNotesOwned(labels: RoseLabel[], modes: RoseLabelMode[], tags: TagSlot[]): void {
  const ringGap = (t: TagSlot, l: RoseLabel) => {
    const dx = Math.max(t.x - l.x, 0, l.x - t.x - t.width), dy = Math.max(t.y - l.y, 0, l.y - t.y - t.height);
    return Math.max(0, Math.hypot(dx, dy) - roseRingHalf(l));
  };
  const nameBox = (i: number) => (modes[i] === 'none' ? null : roseNameBox(labels[i], roseLabelText(labels[i], modes[i]), roseLabelBelow(modes[i])));
  const boxGap = (t: TagSlot, b: { l: number; t: number; r: number; b: number }) =>
    Math.hypot(Math.max(b.l - t.x - t.width, 0, t.x - b.r), Math.max(b.t - t.y - t.height, 0, t.y - b.b));
  tags.forEach((t, i) => {
    if (!t.placed) return;
    let own = ringGap(t, labels[i]);
    const name = nameBox(i), mid = t.y + t.height / 2;
    if (name && mid >= name.t && mid <= name.b) own = Math.min(own, boxGap(t, name));
    labels.forEach((l, j) => {
      if (j === i) return;
      const other = ringGap(t, l);
      assert(own + OWN_MARGIN <= other + 1e-6,
        `${t.id}'s note is ${Math.round(own)} px from its rose but ${Math.round(other)} px from ${l.code}'s ring (reads as ${l.code}'s)`);
      const name = nameBox(j);
      assert(!name || boxGap(t, name) >= OWN_MARGIN - 1e-6, `${t.id}'s note stands right next to ${l.code}'s name`);
    });
  });
}

/**
 * [night-19a] D-266: no shown note stacks against another rose's note (NOTE_GAP_Y px above or below it, NOTE_GAP_X px
 * beside it) or crosses the line from another rose's centre to that rose's note.
 */
function assertNotesApart(labels: RoseLabel[], tags: TagSlot[]): void {
  const shown = tags.map((t, i) => ({ t, l: labels[i] })).filter((n) => n.t.placed);
  for (const a of shown) for (const b of shown) {
    if (a === b) continue;
    const { t } = a, { t: o } = b;
    const gapX = Math.max(o.x - t.x - t.width, t.x - o.x - o.width), gapY = Math.max(o.y - t.y - t.height, t.y - o.y - o.height);
    assert(gapX >= NOTE_GAP_X - 1e-6 || gapY >= NOTE_GAP_Y - 1e-6,
      `${t.id}'s note stacks against ${o.id}'s (${Math.round(gapX)} px beside, ${Math.round(gapY)} px above or below)`);
    // The line from b's rose to the nearest point of b's note, sampled: never inside a's note.
    const nx = Math.max(o.x, Math.min(b.l.x, o.x + o.width)), ny = Math.max(o.y, Math.min(b.l.y, o.y + o.height));
    for (let k = 0; k <= 20; k++) {
      const px = b.l.x + (nx - b.l.x) * k / 20, py = b.l.y + (ny - b.l.y) * k / 20;
      assert(!(px > t.x && px < t.x + t.width && py > t.y && py < t.y + t.height), `${t.id}'s note stands between ${b.l.code} and its note`);
    }
  }
}
for (const [id, scene] of [['game', GAME_IPHONE], ['night', NIGHT_IPHONE]] as const) {
  test(`store shot ${id}-iphone (D-264): every note is clearly its own rose's, none hangs at Ankara`, () => {
    for (const { labels, modes, tags } of [iphoneFrame(scene), iphoneShotFrame(scene)]) {
    assertNotesOwned(labels, modes, tags);
    assertNotesAtHome(labels, tags);
    assertNotesApart(labels, tags);
    const [ath, ank, amm, bgw] = tags;
    const ankara = roseNameBox(labels[1], roseLabelText(labels[1], modes[1]), roseLabelBelow(modes[1]));
    // Before D-264: "ATH 2 z 36" right above Ankara's name, "BGW 2 z 24" level with Ankara's ring right of it.
    assert(!ath.placed || ath.y >= ankara.b || ath.x + ath.width <= ankara.l - OWN_MARGIN, 'ATH no longer hangs over Ankara');
    assert(!bgw.placed || bgw.y > labels[1].y + roseRingHalf(labels[1]) || bgw.y + bgw.height < labels[1].y - roseRingHalf(labels[1]),
      'BGW no longer stands level with Ankara');
    // The busiest hub keeps its note, and the cluster still shows most notes (alternative places, then compact).
    assert(amm.placed, 'Amman (busiest hub) has a note');
    assert(ank.placed && ath.placed, 'Ankara and Ateny keep a note at their own roses');
    }
  });
  test(`store shot ${id}-iphone: no note covers another note, a name, a ring or a dock symbol; stable frame to frame`, () => {
    const first = iphoneFrame(scene);
    const shown = first.slots.filter((s) => s.placed);
    shown.forEach((a, i) => shown.forEach((b, j) => {
      if (j <= i || (a.fixed && b.fixed) || a.ring || b.ring) return;
      assert(!(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height), `${a.id} overlaps ${b.id}`);
    }));
    shown.forEach((s) => assert(s.fixed || (s.x >= 6 && s.x + s.width <= IPHONE.width - 6), `${s.id} leaves the screen`));
    const snap = (f: ReturnType<typeof levantFrame>) => JSON.stringify([f.modes, f.tags.map((t) => [t.placed, t.compact, t.x, t.y])]);
    assert.equal(snap(iphoneFrame(scene, first)), snap(first));
  });
}
test('store shot game-phone (D-264): the 360×640 Levant cluster: every note clearly its own rose\'s', () => {
  const { labels, modes, tags } = levantFrame(LEVANT);
  assertNotesOwned(labels, modes, tags);
  assertNotesApart(labels, tags);
  assert(tags[4].placed && tags[4].compact === true, 'Amman\'s forced compact note still stands beside its own name');
});
// [night-19a] D-266: the store shots game-tablet and night-tablet (768×1024, docs/store/shots/pl/ after PR #272): the
// layout inputs read from the real overlay in those scenes (the notes' band is 576 px wide there). "BGW 2 z 24" stood
// over Bagdad's name 4 px under "ANK 1 z 24": within D-264, but the two notes read as one block.
const TABLET: View = { width: 576, height: 1024, top: 84, bottom: 96, gap: 4 };
const TABLET_DOCK = [[551.2, 975.7], [540, 914.8], [553.8, 854.4], [590.2, 804.3], [643.4, 772.6], [704.7, 764.4]];
const tabletScene = (fills: number[], widths: number[], minor: boolean[]): Scene => [
  rose(182.7, 452.3, 'Ateny', 'ATH', { r: 40, hub: true }),
  rose(308.8, 426.1, 'Ankara', 'ANK', { r: 40 }),
  rose(351.7, 548.3, 'Amman', 'AMM', { r: 40, hub: true }),
  rose(476.8, 524.1, 'Bagdad', 'BGW', { r: 40 }),
  rose(79.8, 352.3, 'Wenecja', 'VCE', { r: 38.7 }),
  rose(241.1, 236.1, 'Ryga', 'RIX', { r: 40 }),
].map((label, i) => ({ label: { ...label, fill: fills[i] }, width: widths[i], compact: 89, minor: minor[i] }));
const GAME_TABLET = tabletScene([2 / 36, 1 / 24, 3 / 36, 2 / 24, 1 / 24, 0], [144, 144, 178, 178, 144, 103],
  [false, false, false, false, false, true]);
const NIGHT_TABLET = tabletScene([3 / 36, 0, 5 / 36, 3 / 24, 0, 0], [144, 103, 144, 178, 103, 103],
  [false, true, false, false, true, true]);
const tabletFrame = (scene: Scene, last?: { modes: RoseLabelMode[]; tags: TagSlot[] }) =>
  levantFrame(scene, last, TABLET, TABLET_DOCK, 768);
/** The frame as the shot met it: every rose showed its name and each note held its place (the overlay's lastPick). */
function tabletShotFrame(scene: Scene) {
  const before = tabletFrame(scene);
  [2, 0, 1, 3, 3, 0].forEach((pick, i) => { before.tags[i].lastPick = pick; });
  return tabletFrame(scene, { modes: ['name', 'name', 'name', 'name', 'name', 'name'], tags: before.tags });
}
for (const [id, scene] of [['game', GAME_TABLET], ['night', NIGHT_TABLET]] as const) {
  test(`store shot ${id}-tablet (D-266): no note stacks against another rose's note; BGW not under ANK's note`, () => {
    for (const { labels, modes, tags } of [tabletFrame(scene), tabletShotFrame(scene)]) {
      assertNotesApart(labels, tags);
      assertNotesOwned(labels, modes, tags);
      assertNotesAtHome(labels, tags);
      const [, ank, amm, bgw] = tags;
      // Before D-266: BGW's note (388..566 × 428..458) hung 4 px under ANK's (363..507 × 394..424).
      assert(!bgw.placed || !ank.placed || bgw.y >= ank.y + ank.height + NOTE_GAP_Y || bgw.x >= ank.x + ank.width + NOTE_GAP_X ||
        bgw.y + bgw.height + NOTE_GAP_Y <= ank.y, 'BGW\'s note no longer hangs right under ANK\'s');
      assert(amm.placed, 'Amman (busiest hub) has a note');
      assert(tags.filter((t) => t.placed).length >= 4, `only ${tags.filter((t) => t.placed).map((t) => t.id)} have a note`);
    }
  });
  test(`store shot ${id}-tablet: no note covers another note, a name, a ring or a dock symbol; stable frame to frame`, () => {
    const first = tabletFrame(scene);
    const shown = first.slots.filter((s) => s.placed);
    shown.forEach((a, i) => shown.forEach((b, j) => {
      if (j <= i || (a.fixed && b.fixed) || a.ring || b.ring) return;
      assert(!(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height), `${a.id} overlaps ${b.id}`);
    }));
    const snap = (f: ReturnType<typeof levantFrame>) => JSON.stringify([f.modes, f.tags.map((t) => [t.placed, t.compact, t.x, t.y])]);
    assert.equal(snap(tabletFrame(scene, first)), snap(first));
  });
}
// [night-21a] D-268: the open hub board (long press on an airport) is an obstacle for the overlay. The overlay frame as
// src/ui/overlay.ts runs it with a board box: a rose whose ring the board covers steps back with its note, the names
// are laid out with the board as a taken box, and the board is a fixed rank-Infinity slot no note covers (not even the
// busiest hub's forced one). Landscape 915×412 (the board left of the rack, under the pass; RIX right at its edge as in
// the owner's report) and portrait 360×640 (the board across the top half).
type Board = { l: number; t: number; r: number; b: number };
function boardFrame(scene: Scene, board: Board, view: View, dock: number[][]) {
  const shown = scene.filter((s) => !rozaBoardCovers(s.label, board));
  const labels = shown.map((s) => ({ ...s.label }));
  const modes = rozaNameLayout(labels, [board]);
  const busiest = labels.reduce((best, l, i) => (l.hub && (best < 0 || roseRank(l) > roseRank(labels[best])) ? i : best), -1);
  const slots: TagSlot[] = [{ id: 'board', anchorX: 0, anchorY: 0, width: board.r - board.l, height: board.b - board.t, active: true,
    jammed: false, fixed: true, rank: Infinity, x: board.l, y: board.t, placed: false }];
  const tags = labels.map((label, i) => {
    const tag: TagSlot = { id: label.code, anchorX: 0, anchorY: 0, width: shown[i].width, height: 30, active: true, jammed: false,
      x: 0, y: 0, placed: false, compactWidth: shown[i].compact, minor: label.fill === 0, rank: roseRank(label), must: i === busiest };
    rozaNotePlaces(tag, label, modes[i], view.width);
    const box: TagSlot = { id: label.code + '~rose', anchorX: 0, anchorY: 0, width: 0, height: 0, active: true, jammed: false, fixed: true,
      x: 0, y: 0, placed: false, rank: tag.rank };
    const name: TagSlot = { ...box, id: label.code + '~name' };
    rozaRoseObstacles(box, name, label, modes[i]);
    slots.push(tag, box, name);
    return tag;
  });
  for (const [x, y] of dock) slots.push({ id: 'dock', anchorX: 0, anchorY: 0, width: 48, height: 48, active: true, jammed: false,
    fixed: true, x: x - 24, y: y - 24, placed: false, rank: Infinity });
  layoutTags(slots, view);
  return { hidden: scene.filter((s) => rozaBoardCovers(s.label, board)).map((s) => s.label.code), labels, modes, tags };
}
const LANDSCAPE: View = { width: 915 - 96 * 2, height: 412, top: 40, bottom: 0, gap: 4 };
const LANDSCAPE_BOARD: Board = { l: 413, t: 80, r: 813, b: 330 };
const LANDSCAPE_SCENE: Scene = [
  { label: rose(470, 210, 'Stambuł', 'IST', { r: 30, hub: true, fill: 30 / 36 }), width: 150, compact: 96 }, // the board's hub, under it
  { label: rose(398, 150, 'Ryga', 'RIX', { r: 20, fill: 3 / 24 }), width: 104, compact: 84 }, // ring half under the board edge
  { label: rose(370, 250, 'Wilno', 'VNO', { r: 14, fill: 2 / 24 }), width: 104, compact: 84 }, // right beside the board
  { label: rose(520, 370, 'Ateny', 'ATH', { r: 16, hub: true, fill: 6 / 36 }), width: 132, compact: 84 }, // just under it
  { label: rose(140, 190, 'Praga', 'PRG', { r: 18, fill: 5 / 24 }), width: 104, compact: 84 }, // well clear
];
const PORTRAIT: View = { width: 360, height: 640, top: 84, bottom: 96, gap: 4 };
const PORTRAIT_BOARD: Board = { l: 12, t: 80, r: 348, b: 420 };
const PORTRAIT_SCENE: Scene = [
  { label: rose(180, 250, 'Stambuł', 'IST', { r: 30, hub: true, fill: 30 / 36 }), width: 150, compact: 96 },
  { label: rose(120, 446, 'Ryga', 'RIX', { r: 18, fill: 3 / 24 }), width: 104, compact: 84 }, // name would reach into the board
  { label: rose(250, 470, 'Kair', 'CAI', { r: 22, hub: true, fill: 9 / 36 }), width: 132, compact: 84 },
  { label: rose(330, 425, 'Bagdad', 'BGW', { r: 14, fill: 2 / 24 }), width: 104, compact: 84 }, // ring under the board's corner
];
const off = (a: Board, b: Board): boolean => a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;
for (const [id, scene, board, view, dock] of [
  ['landscape 915×412', LANDSCAPE_SCENE, LANDSCAPE_BOARD, LANDSCAPE, [[880, 120], [880, 200], [880, 280]]],
  ['portrait 360×640', PORTRAIT_SCENE, PORTRAIT_BOARD, PORTRAIT, DOCK.map(([x, y]) => [x, y + 140])],
] as const) {
  test(`hub board open, ${id} (D-268): no note, name or ring stands on the board`, () => {
    const { hidden, labels, modes, tags } = boardFrame(scene, board, view, dock as number[][]);
    for (const label of labels) {
      const half = roseRingHalf(label);
      assert(off({ l: label.x - half, t: label.y - half, r: label.x + half, b: label.y + half }, { l: board.l + 2, t: board.t + 2, r: board.r - 2, b: board.b - 2 }) ||
        !rozaBoardCovers(label, board), `${label.code}'s ring is on the board`);
    }
    labels.forEach((label, i) => {
      const text = roseLabelText(label, modes[i]);
      if (text) assert(off(roseNameBox(label, text, roseLabelBelow(modes[i])), board), `${label.code}'s name "${text}" is on the board`);
    });
    for (const tag of tags) if (tag.placed) assert(off({ l: tag.x, t: tag.y, r: tag.x + tag.width, b: tag.y + tag.height }, board), `${tag.id}'s note is on the board`);
    assert(hidden.includes('IST'), 'the board\'s own hub, under the board, steps back');
    assertClear(labels, modes);
    assert(tags.some((t) => t.placed), 'roses clear of the board keep their notes');
  });
}
test('hub board open (D-268): RIX at the landscape board\'s edge steps back; a rose beside it keeps ring, name and note', () => {
  const { hidden, labels, modes, tags } = boardFrame(LANDSCAPE_SCENE, LANDSCAPE_BOARD, LANDSCAPE, []);
  assert.deepEqual(hidden, ['IST', 'RIX']);
  const vno = labels.findIndex((l) => l.code === 'VNO'), prg = labels.findIndex((l) => l.code === 'PRG');
  assert.notEqual(modes[vno], 'none', 'Wilno keeps a name');
  assert(tags[vno].placed && tags[vno].x + tags[vno].width <= LANDSCAPE_BOARD.l, `Wilno's note stands left of the board ${JSON.stringify(tags[vno])}`);
  assert.equal(modes[prg], 'name');
  assert(tags[prg].placed, 'Praga keeps its note');
  // The same airports with the board closed: RIX shows and Wilno's note takes its first place, on the right.
  const closed = levantFrame(LANDSCAPE_SCENE, undefined, LANDSCAPE, [], 915);
  assert(closed.tags[1].placed || closed.modes[1] !== 'none', 'RIX shows with the board closed');
});
test('hub board open (D-268): the selected hub\'s rose clear of the board stays (portrait, the board over the top half)', () => {
  const below = [{ ...PORTRAIT_SCENE[0], label: { ...PORTRAIT_SCENE[0].label, y: 500 } }, ...PORTRAIT_SCENE.slice(1, 3)];
  const { hidden, labels, tags } = boardFrame(below, PORTRAIT_BOARD, PORTRAIT, []);
  assert(!hidden.includes('IST'), 'the board\'s hub is shown');
  assert.equal(labels[0].code, 'IST');
  assert(tags[0].placed, 'the board\'s hub keeps its note');
  assert(!rozaBoardCovers(rose(180, 460, 'X', 'X', { r: 14 }), PORTRAIT_BOARD) && rozaBoardCovers(rose(180, 440, 'X', 'X', { r: 14 }), PORTRAIT_BOARD),
    'a ring 2 px past the board edge counts as covered');
});
console.log(`SUMMARY test:roza-names passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
