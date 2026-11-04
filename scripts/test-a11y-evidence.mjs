// [night-12al] R1i: docs/store/accessibility.md must match the code. Every test it names exists (claimed labels
// have fast evidence), the glyph table = src/data/regions.ts (distinct shapes), the colour-vision mode and text-size
// steps = the settings, no label is "Yes" while its blocker is open (Larger Text < 200 %, Sufficient Contrast while
// G9b is unticked), and the PL/EN store paragraphs claim nothing the game lacks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const DOC_PATH = 'docs/store/accessibility.md';
let doc = '';
try { doc = read(DOC_PATH); } catch { doc = ''; }
const pkg = JSON.parse(read('package.json'));
const fastSteps = pkg.scripts['test:fast'].split(/\s+/).slice(3);

let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error.message ?? error); }
}
function section(name) {
  const match = doc.match(new RegExp(`<!-- a11y:${name} -->([\\s\\S]*?)<!-- /a11y:${name} -->`));
  assert.ok(match, `${DOC_PATH}: section a11y:${name} missing`);
  return match[1].trim();
}
const rows = (name) => section(name).split('\n').filter((l) => l.startsWith('|')).slice(2)
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const ticks = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const sorted = (items) => [...items].sort();
const labels = () => new Map(rows('labels').map(([label, declare, evidence]) => [label, { declare, tests: ticks(evidence) }]));

const APPLE_LABELS = ['Differentiate Without Color Alone', 'Sufficient Contrast', 'Reduced Motion', 'Larger Text',
  'VoiceOver', 'Voice Control', 'Dark Interface', 'Captions', 'Audio Descriptions'];

check('every Apple label has a row with Yes / Not yet / No', () => {
  const map = labels();
  assert.deepEqual(sorted(map.keys()), sorted(APPLE_LABELS));
  for (const [label, { declare }] of map) assert.ok(['Yes', 'Not yet', 'No'].includes(declare), `${label}: ${declare}`);
});
check('every named test exists; each declared label has fast evidence', () => {
  for (const [label, { declare, tests }] of labels()) {
    for (const test of tests) assert.ok(pkg.scripts[test], `${label}: no npm script ${test}`);
    if (declare === 'Yes') assert.ok(tests.some((t) => fastSteps.includes(t)), `${label}: no evidence in test:fast`);
  }
  for (const test of new Set(ticks(doc).filter((t) => /^test:[\w:-]+$/.test(t)))) assert.ok(pkg.scripts[test], `no npm script ${test}`);
});
check('glyph table = regions.ts, every region a distinct shape', () => {
  const source = read('src/data/regions.ts');
  const regions = [...source.matchAll(/^\s+(\w+): \{ glyph: '(\w+)'/gm)].map((m) => [m[1], m[2]]);
  assert.ok(regions.length >= 6, 'regions not found');
  assert.deepEqual(rows('glyphs').map((r) => ticks(r.join(' '))), regions);
  assert.equal(new Set(regions.map(([, g]) => g)).size, regions.length, 'two regions share a glyph');
  const paths = source.match(/GLYPH_PATHS[^=]*= \{([\s\S]*?)\n\};/)[1];
  const d = [...paths.matchAll(/(\w+): '([^']+)'/g)].map((m) => m[2]);
  assert.equal(new Set(d).size, d.length, 'two glyphs share a path');
});
check('CVD-checked regions = tokens.json destinations', () => {
  const tokens = Object.keys(JSON.parse(read('src/ui/theme/tokens.json')).destinations);
  const line = doc.split('\n').find((l) => l.includes('for the six original regions'));
  assert.ok(line, 'CVD region line missing');
  const next = doc.split('\n')[doc.split('\n').indexOf(line) + 1] ?? '';
  assert.deepEqual(sorted(ticks(line + next).filter((t) => /^[A-Z]{2,3}$/.test(t)).slice(0, tokens.length)), sorted(tokens));
});
check('colour-vision mode: setting exists and the sizes match theme.css', () => {
  const css = read('src/ui/theme/theme.css');
  const base = css.match(/--airway-glyph-size:\s*(\d+px)/)[1];
  const baseStroke = css.match(/--airway-glyph-stroke:\s*([\d.]+px)/)[1];
  const enhanced = css.match(/\[data-airway-cvd='enhanced'\]\s*\{([^}]*)\}/)[1];
  const size = enhanced.match(/--airway-glyph-size:\s*(\d+px)/)[1];
  const stroke = enhanced.match(/--airway-glyph-stroke:\s*([\d.]+px)/)[1];
  assert.ok(doc.includes(`from \`${base}\` to \`${size}\``), `doc must say from \`${base}\` to \`${size}\``);
  assert.ok(doc.includes(`\`${stroke}\` outline instead of \`${baseStroke}\``), 'outline widths');
  assert.match(read('src/ui/settings/settings.ts'), /switchField\(t\('settings\.colorblind'\)/);
});
check('Larger Text is not declared below 200 %, and the steps match the settings', () => {
  const steps = read('src/ui/a11y.ts').match(/export type TextScale = ([\d |]+);/)[1].split('|').map((s) => Number(s.trim()));
  assert.ok(doc.includes(`\`${steps.join('/')}\` %`), `doc must list \`${steps.join('/')}\` %`);
  const max = Math.max(...steps);
  if (max < 200) assert.notEqual(labels().get('Larger Text').declare, 'Yes');
  else assert.fail(`text scale reaches ${max} %: revisit the Larger Text label`);
  for (const id of ['store-en', 'store-pl']) assert.ok(section(id).includes(`${max}%`), `${id}: max text size ${max}%`);
});
check('Reduced Motion is declared only with the setting and the single helper', () => {
  const declared = labels().get('Reduced Motion').declare === 'Yes';
  const helper = /export function reducedMotion\(/.test(read('src/ui/motion.ts'));
  const setting = /switchField\(t\('settings\.reduceMotion'\)/.test(read('src/ui/settings/settings.ts'));
  assert.ok(!declared || (helper && setting), 'declared without the helper or the setting');
});
check('Sufficient Contrast is not declared while G9b is open; pair count = tokens.json', () => {
  const g9b = read('docs/NIGHT-BACKLOG.md').match(/^- \[( |x)\] G9b /m);
  assert.ok(g9b, 'G9b not found in the backlog');
  if (g9b[1] === ' ') assert.notEqual(labels().get('Sufficient Contrast').declare, 'Yes');
  const pairs = JSON.parse(read('src/ui/theme/tokens.json')).textPairs.length;
  assert.ok(doc.includes(`\`test:contrast\`, ${pairs} pairs`), `doc must say \`test:contrast\`, ${pairs} pairs`);
});
check('labels without support are not declared', () => {
  for (const label of ['VoiceOver', 'Voice Control', 'Dark Interface']) assert.equal(labels().get(label).declare, 'No', label);
  assert.ok(!/prefers-color-scheme/.test(read('src/ui/theme/theme.css')), 'the UI has a dark mode now: revisit Dark Interface');
});
check('store paragraphs: PL and EN, short, no unsupported claims', () => {
  const FORBIDDEN = /voiceover|screen reader|czytnik|dark mode|tryb ciemny|dynamic type|200 ?%|subtit|napis/i;
  for (const id of ['store-en', 'store-pl']) {
    const text = section(id);
    assert.ok(text.length >= 120 && text.length <= 500, `${id}: ${text.length} chars`);
    assert.ok(!FORBIDDEN.test(text), `${id} claims an unsupported feature`);
  }
  const pl = read('src/i18n/pl.ts');
  for (const key of ['settings.reduceMotion']) {
    const label = pl.match(new RegExp(`'${key.replace('.', '\\.')}': '([^']+)'`))[1];
    assert.ok(section('store-pl').includes(label), `PL paragraph must use the in-game label "${label}"`);
  }
  const en = read('src/i18n/en.ts').match(/'settings\.reduceMotion': '([^']+)'/)[1];
  assert.ok(section('store-en').includes(en), `EN paragraph must use the in-game label "${en}"`);
});

console.log(`SUMMARY test:a11y-evidence seed=0 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
