// [night-14b] D-259: curved city names on airport roses (src/ui/skin/roza.ts rozaNameLayout) never overlap. In a dense
// cluster at close zoom a lower-priority rose shortens its name to the IATA code or drops it; a jam, a hub and the
// fuller airport keep theirs first; a lone rose always keeps its name; a label it already shows needs less clearance.
import assert from 'node:assert/strict';
import { roseNameBox, rozaNameLayout, type RoseLabel } from '../src/ui/skin/roza.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const rose = (x: number, y: number, name: string, code: string, extra: Partial<RoseLabel> = {}): RoseLabel =>
  ({ x, y, r: 14, hub: false, jam: false, fill: 0, name, code, ...extra });
const text = (label: RoseLabel, mode: string): string => (mode === 'name' ? label.name : mode === 'code' ? label.code : '');
/** No two shown labels overlap, and no label covers another rose's ticks. */
function assertClear(labels: RoseLabel[], modes: string[]): void {
  const boxes = labels.map((label, i) => (modes[i] === 'none' ? null : roseNameBox(label, text(label, modes[i]))));
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
test('two roses side by side: the second shortens its name to the code', () => {
  const labels = [rose(200, 300, 'Frankfurt', 'FRA'), rose(262, 300, 'Düsseldorf', 'DUS')];
  const modes = rozaNameLayout(labels);
  assert.deepEqual(modes, ['name', 'code']);
  assertClear(labels, modes);
});
test('the fuller airport, a hub and a jam keep their names first', () => {
  const pair = (gap: number, extra: Partial<RoseLabel>) =>
    rozaNameLayout([rose(200, 300, 'Frankfurt', 'FRA'), rose(200 + gap, 300, 'Düsseldorf', 'DUS', extra)]);
  assert.deepEqual(pair(62, { fill: .8 }), ['code', 'name']);
  // A hub's and a jam's names run on a wider ring, so the pair stands a little further apart.
  assert.deepEqual(pair(80, { hub: true, r: 20 }).map((m) => m === 'name'), [false, true]);
  assert.deepEqual(pair(80, { jam: true }).map((m) => m === 'name'), [false, true]);
});
test('a rose right above another drops its name rather than cover the ticks', () => {
  const labels = [rose(200, 300, 'Bruksela', 'BRU', { fill: .5 }), rose(200, 338, 'Antwerpia', 'ANR')];
  const modes = rozaNameLayout(labels);
  assert.equal(modes[0], 'name');
  assert.equal(modes[1], 'none');
  assertClear(labels, modes);
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
  const at = (gap: number, last?: 'code' | 'name') => rozaNameLayout([rose(200, 300, 'Frankfurt', 'FRA', { fill: .9 }),
    rose(200 + gap, 300, 'Düsseldorf', 'DUS', last ? { last } : {})])[1];
  // Find the smallest gap at which a new code fits; one pixel closer, a code already shown stays.
  let gap = 30;
  while (at(gap) === 'none' && gap < 200) gap++;
  assert.equal(at(gap), 'code');
  assert.equal(at(gap - 1), 'none');
  assert.equal(at(gap - 1, 'code'), 'code');
});
test('the layout is deterministic and keeps the input order', () => {
  const labels = [rose(200, 300, 'Frankfurt', 'FRA'), rose(262, 300, 'Düsseldorf', 'DUS'), rose(500, 300, 'Wiedeń', 'VIE')];
  assert.deepEqual(rozaNameLayout(labels), rozaNameLayout(labels));
  assert.equal(rozaNameLayout(labels)[2], 'name');
});

console.log(`SUMMARY test:roza-names passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
