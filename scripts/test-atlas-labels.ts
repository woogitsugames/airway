// [night-72a R2] D-327: the atlas label list (src/data/atlasLabels.ts) and the border data of the NASA globe preview.
//   - at most 120 labels, unique ids, weights 1–4, anchors inside lon/lat range;
//   - every name is in the PL and EN catalogs, and the names the UI-A/K2 mockups letter are there;
//   - country anchors lie on land and sea anchors on open water (Natural Earth 50m land mask, public/data/land-50m.json);
//   - the zoom gate: heavier labels need a closer frame, weight 1 always shows;
//   - the committed border file decodes into segments no longer than the split step, inside lon/lat range, without the
//     Crimean isthmus line (D-327).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATLAS_LABELS, ATLAS_WEIGHT_MAX_SPAN_KM, atlasLabelEligible, atlasLabelKey } from '../src/data/atlasLabels.ts';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';
import { decodeLandMask } from '../src/render/globe/land-mask.ts';
import { BORDER_STYLE, BORDERS_FILE, decodeBorders, type BorderData } from '../src/render/globe/borders.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const catalogs = { en: en as Record<string, string>, pl: pl as Record<string, string> };

test('at most 120 labels, unique ids, weights 1–4, anchors in range', () => {
  assert.ok(ATLAS_LABELS.length <= 120 && ATLAS_LABELS.length >= 100, `${ATLAS_LABELS.length} labels`);
  assert.equal(new Set(ATLAS_LABELS.map((l) => l.id)).size, ATLAS_LABELS.length, 'duplicate id');
  for (const l of ATLAS_LABELS) {
    assert.ok([1, 2, 3, 4].includes(l.weight), l.id + ' weight');
    assert.ok(Math.abs(l.lon) <= 180 && Math.abs(l.lat) <= 90, l.id + ' lon/lat');
  }
  for (const kind of ['country', 'sea'] as const) {
    const weights = new Set(ATLAS_LABELS.filter((l) => l.kind === kind).map((l) => l.weight));
    assert.equal(weights.size, 4, kind + ' labels use every weight');
  }
});

test('every name is in the PL and EN catalogs (no empty or untranslated placeholder)', () => {
  for (const l of ATLAS_LABELS) {
    for (const [lang, catalog] of Object.entries(catalogs)) {
      const text = catalog[atlasLabelKey(l)];
      assert.ok(typeof text === 'string' && text.trim().length > 1, `${lang} ${atlasLabelKey(l)}`);
    }
  }
  const keys = Object.keys(en).filter((k) => k.startsWith('atlas.'));
  const used = new Set(ATLAS_LABELS.map(atlasLabelKey));
  assert.deepEqual(keys.filter((k) => !used.has(k)), [], 'catalog atlas keys without a label');
});

test('the names lettered in the K2 / UI-A mockups are there (PL)', () => {
  const names = new Set(ATLAS_LABELS.map((l) => catalogs.pl[atlasLabelKey(l)]));
  for (const name of ['Polska', 'Rumunia', 'Turcja', 'Egipt', 'Irak', 'Libia', 'Morze Czarne', 'Morze Śródziemne']) {
    assert.ok(names.has(name), name);
  }
});

test('countries on land, seas on open water (Natural Earth 50m mask)', () => {
  const mask = decodeLandMask(JSON.parse(readFileSync(resolve(ROOT, 'public/data/land-50m.json'), 'utf8')));
  const wrong: string[] = [];
  for (const l of ATLAS_LABELS) {
    const d = mask.distanceAt(l.lon, l.lat);
    if (l.kind === 'country' ? d <= 0 : d >= 0) wrong.push(`${l.id} (${l.lon}, ${l.lat}) d=${d.toFixed(2)}`);
  }
  assert.deepEqual(wrong, []);
});

test('zoom gate: weight 1 always, heavier labels only closer in', () => {
  assert.equal(ATLAS_WEIGHT_MAX_SPAN_KM[1], Infinity);
  assert.ok(ATLAS_WEIGHT_MAX_SPAN_KM[2] > ATLAS_WEIGHT_MAX_SPAN_KM[3] && ATLAS_WEIGHT_MAX_SPAN_KM[3] > ATLAS_WEIGHT_MAX_SPAN_KM[4]);
  assert.ok(atlasLabelEligible({ weight: 1 }, 40000) && !atlasLabelEligible({ weight: 2 }, 12000));
  assert.ok(atlasLabelEligible({ weight: 4 }, 1500) && !atlasLabelEligible({ weight: 4 }, 3000));
  const close = ATLAS_LABELS.filter((l) => atlasLabelEligible(l, 1500)).length;
  const wide = ATLAS_LABELS.filter((l) => atlasLabelEligible(l, 20000)).length;
  assert.ok(close === ATLAS_LABELS.length && wide >= 10 && wide <= 20, `close ${close}, wide ${wide}`);
});

test('border data: decodes, segments ≤ the split step, Crimean isthmus left out', () => {
  const data = JSON.parse(readFileSync(resolve(ROOT, 'public/data', BORDERS_FILE), 'utf8')) as BorderData;
  const seg = decodeBorders(data);
  assert.ok(seg.length % 4 === 0 && seg.length / 4 > 8000 && seg.length / 4 < 20000, `${seg.length / 4} segments`);
  let longest = 0;
  let crimea = 0;
  for (let i = 0; i < seg.length; i += 4) {
    assert.ok(Math.abs(seg[i]) <= 180 && Math.abs(seg[i + 1]) <= 90 && Math.abs(seg[i + 2]) <= 180 && Math.abs(seg[i + 3]) <= 90);
    longest = Math.max(longest, Math.abs(seg[i + 2] - seg[i]), Math.abs(seg[i + 3] - seg[i + 1]));
    const mid = [(seg[i] + seg[i + 2]) / 2, (seg[i + 1] + seg[i + 3]) / 2];
    if (mid[0] > 33.5 && mid[0] < 35.1 && mid[1] > 45.7 && mid[1] < 46.25) crimea++;
  }
  assert.ok(longest <= BORDER_STYLE.maxStepDeg + 1e-4, `longest step ${longest}°`);
  assert.equal(crimea, 0, 'no line across the Crimean isthmus');
});

console.log(`SUMMARY test:atlas-labels seed=0xA1A1 labels=${ATLAS_LABELS.length} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
