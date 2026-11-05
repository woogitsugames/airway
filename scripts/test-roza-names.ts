// [night-14b] D-259: curved city names on airport roses (src/ui/skin/roza.ts rozaNameLayout) never overlap. In a dense
// cluster at close zoom a lower-priority rose shortens its name to the IATA code or drops it; a jam, a hub and the
// fuller airport keep theirs first; a lone rose always keeps its name; a label it already shows needs less clearance.
// [night-16a] D-262: a name whose top is taken runs along the bottom of the ring before it shortens; the store shot's
// Levant cluster (game-phone 360×640) keeps the busiest hub's name and its note (code and fill at least).
import assert from 'node:assert/strict';
import { roseLabelBelow, roseLabelText, roseNameBox, roseRank, rozaCaptionClashes, rozaNameLayout, rozaNotePlaces, rozaRoseObstacle,
  type RoseLabel, type RoseLabelMode } from '../src/ui/skin/roza.ts';
import { layoutTags, type TagSlot } from '../src/ui/overlay-layout.ts';

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
const LEVANT: { label: RoseLabel; width: number; compact: number }[] = [
  { label: rose(132, 163, 'Ryga', 'RIX', { r: 23, fill: 0 }), width: 72, compact: 72 },
  { label: rose(44, 229, 'Wenecja', 'VCE', { r: 22, fill: 2 / 24 }), width: 104, compact: 84 },
  { label: rose(101, 285, 'Ateny', 'ATH', { r: 34, hub: true, fill: 5 / 24 }), width: 132, compact: 84 },
  { label: rose(169, 271, 'Ankara', 'ANK', { r: 25, fill: 1 / 24 }), width: 110, compact: 84 },
  { label: rose(192, 338, 'Amman', 'AMM', { r: 36, hub: true, fill: 14 / 24 }), width: 196, compact: 96 },
  { label: rose(260, 323, 'Bagdad', 'BGW', { r: 25, fill: 3 / 24 }), width: 104, compact: 84 },
];
const PHONE = { width: 360, height: 640, top: 72, bottom: 120, gap: 4 };
/** One overlay frame as src/ui/overlay.ts runs it: names, then the notes beside the roses (fixed rose boxes). */
function levantFrame(scene: typeof LEVANT, last?: { modes: RoseLabelMode[]; tags: TagSlot[] }) {
  const labels = scene.map((s, i) => ({ ...s.label, last: last?.modes[i] }));
  const modes = rozaNameLayout(labels);
  const busiest = labels.reduce((best, l, i) => (l.hub && (best < 0 || roseRank(l) > roseRank(labels[best])) ? i : best), -1);
  const slots: TagSlot[] = [];
  const tags = labels.map((label, i) => {
    const tag: TagSlot = last?.tags[i] ?? { id: label.code, anchorX: 0, anchorY: 0, width: 0, height: 30, active: true, jammed: false,
      x: 0, y: 0, placed: false };
    tag.width = scene[i].width;
    tag.compactWidth = scene[i].compact;
    tag.minor = label.fill === 0;
    tag.rank = roseRank(label);
    tag.must = i === busiest;
    rozaNotePlaces(tag, label, modes[i], PHONE.width);
    const box: TagSlot = { id: label.code + '~rose', anchorX: 0, anchorY: 0, width: 0, height: 0, active: true, jammed: false, fixed: true,
      x: 0, y: 0, placed: false, rank: tag.rank };
    rozaRoseObstacle(box, label, modes[i]);
    slots.push(tag, box);
    return tag;
  });
  layoutTags(slots, PHONE);
  return { labels, modes, tags, slots };
}
test('store shot game-phone: the busiest hub (Amman) keeps its name and its note; names never overlap', () => {
  const { labels, modes, tags } = levantFrame(LEVANT);
  assertClear(labels, modes);
  assert.notEqual(modes[4], 'none', 'Amman has a name');
  assert(tags[4].placed, 'Amman has a note');
  // Priority jam > hub > fuller: both hubs keep a name, and every airport with passengers waiting beats Ryga (empty).
  assert.notEqual(modes[2], 'none', 'Ateny has a name');
  assert(tags.filter((t) => t.placed).length >= 4, `only ${tags.filter((t) => t.placed).map((t) => t.id)} have a note`);
});
test('store shot game-phone: no note covers another note or a rose and its name', () => {
  const { slots } = levantFrame(LEVANT);
  const shown = slots.filter((s) => s.placed);
  shown.forEach((a, i) => shown.forEach((b, j) => {
    if (j <= i || (a.fixed && b.fixed)) return;
    assert(!(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height), `${a.id} overlaps ${b.id}`);
  }));
  shown.forEach((s) => assert(s.fixed || (s.x >= 6 && s.x + s.width <= PHONE.width - 6), `${s.id} leaves the screen`));
});
test('store shot game-phone: the busiest hub shows at least code and fill even when boxed in on every side', () => {
  // Amman's neighbours pressed in: its full note fits nowhere, the compact one does (or is forced over a lower rose).
  const tight = LEVANT.map((s) => ({ ...s, label: { ...s.label } }));
  tight[3].label.x = 205; tight[3].label.y = 290; // Ankara right above Amman
  tight[5].label.x = 245; // Bagdad nearer
  tight.push({ label: rose(185, 400, 'Akaba', 'AQJ', { r: 25, fill: .3 }), width: 104, compact: 84 });
  tight.push({ label: rose(130, 360, 'Hajfa', 'HFA', { r: 25, fill: .3 }), width: 104, compact: 84 });
  const { tags } = levantFrame(tight);
  assert(tags[4].placed, 'Amman has a note');
  assert.equal(tags[4].compact, true, 'Amman shows the compact note');
  assert.equal(tags[4].width, 96);
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
console.log(`SUMMARY test:roza-names passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
