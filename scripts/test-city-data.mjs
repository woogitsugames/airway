// [night-12h] R4b: city data guard. `City.code` is the sim id (saves, journals, logbook, puzzles, golden hashes), so
// the id list is frozen here in order and spelling: a rename or reorder fails loudly. The codes players see
// (`displayCode`, R4a) must be three capital letters and unique; every city sits on land or within ~30 km of the
// coast of the game's own Natural Earth land raster; names and populations are present.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import './ts-test-loader.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { CITIES, displayCode } = await import('../src/data/index.ts');
const { decodeLandMask } = await import('../src/render/globe/land-mask.ts');

// Frozen sim ids (rules v4/v5 order). Never edit an entry; new cities may only be appended at the end.
const FROZEN_IDS = [
  'NYC', 'LAX', 'CHI', 'HOU', 'SFO', 'SEA', 'BOS', 'MIA', 'ATL', 'DFW', 'DEN', 'PHX', 'DCA', 'YYZ', 'YUL', 'YVR', 'YYC',
  'MEX', 'GDL', 'MTY', 'HAV', 'PTY', 'BOG', 'MDE', 'UIO', 'GYE', 'LIM', 'CUZ', 'SCL', 'EZE', 'COR', 'MVD', 'ASU', 'LPB',
  'VVI', 'GRU', 'RIO', 'BSB', 'SSA', 'REC', 'FOR', 'MAO', 'LON', 'PAR', 'BRU', 'AMS', 'BER', 'HAM', 'FRA', 'MUC', 'WAW',
  'KRK', 'GDN', 'PRG', 'VIE', 'BUD', 'CPH', 'OSL', 'STO', 'HEL', 'REK', 'DUB', 'EDI', 'MAN', 'RIX', 'TLL', 'KIV', 'LIS',
  'OPO', 'MAD', 'BCN', 'VLC', 'SVQ', 'ROM', 'MIL', 'NAP', 'VCE', 'ATH', 'SKG', 'SOF', 'BEG', 'ZAG', 'TIA', 'BUH', 'SJJ',
  'CMN', 'ALG', 'TUN', 'ALX', 'DKR', 'ACC', 'LOS', 'ABV', 'ABJ', 'BKO', 'OUA', 'NBO', 'ADD', 'DAR', 'KGL', 'LUA', 'LUS',
  'JNB', 'CPT', 'DUR', 'TNR', 'IST', 'ANK', 'CAI', 'TLV', 'AMM', 'BEY', 'BGW', 'RUH', 'JED', 'MCT', 'DXB', 'DOH', 'KWI',
  'THR', 'ISF', 'DEL', 'BOM', 'BLR', 'MAA', 'HYD', 'CCU', 'KTM', 'DAC', 'KHI', 'LHE', 'TAS', 'ALA', 'ULN', 'PEK', 'SHA',
  'CAN', 'CTU', 'WUH', 'HKG', 'TPE', 'SEL', 'PUS', 'TYO', 'OSA', 'BKK', 'HCM', 'HAN', 'SIN', 'KUL', 'JKT', 'MNL', 'RGN',
  'SYD', 'MEL', 'BNE', 'PER', 'ADL', 'CBR', 'AKL', 'WLG', 'CHC', 'SUV', 'POM', 'NOU',
];
// R4a: the six ids whose screen code differs (common city code, else the main airport).
const DISPLAY = { KIV: 'IEV', HCM: 'SGN', LUA: 'LAD', LUS: 'LUN', ISF: 'IFN', ALX: 'ALY' };
// Signed coast distance in degrees (+ land); ~30 km of latitude.
const COAST_TOLERANCE_DEG = 0.27;

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

test('sim ids are unchanged: same order and spelling as the frozen list (append only)', () => {
  const ids = CITIES.map((city) => city.code);
  assert.ok(ids.length >= FROZEN_IDS.length, `${ids.length} cities < ${FROZEN_IDS.length} frozen ids`);
  const changed = FROZEN_IDS.map((id, i) => (ids[i] === id ? null : `#${i} ${id} -> ${ids[i]}`)).filter(Boolean);
  assert.deepEqual(changed, [], `renamed or moved ids: ${changed.join(', ')}`);
});

test('display codes are three capital letters and unique', () => {
  const seen = new Map();
  for (const city of CITIES) {
    const code = displayCode(city.code);
    assert.match(code, /^[A-Z]{3}$/, `${city.code}: display code ${code}`);
    assert.ok(!seen.has(code), `${city.code} and ${seen.get(code)} both show ${code}`);
    seen.set(code, city.code);
  }
});

test('the six corrected airports show the code from a ticket (R4a)', () => {
  for (const [id, code] of Object.entries(DISPLAY)) assert.equal(displayCode(id), code, id);
  const overridden = CITIES.filter((city) => city.displayCode !== undefined).map((city) => city.code).sort();
  assert.deepEqual(overridden, Object.keys(DISPLAY).sort(), 'only these six cities carry a displayCode');
  for (const city of CITIES) {
    if (city.displayCode !== undefined) assert.notEqual(city.displayCode, city.code, `${city.code}: redundant displayCode`);
  }
});

test('names in both languages and a positive population', () => {
  for (const city of CITIES) {
    assert.ok(city.namePl.trim() && city.nameEn.trim(), `${city.code}: empty name`);
    assert.ok(Number.isInteger(city.population) && city.population > 0, `${city.code}: population ${city.population}`);
  }
});

test(`every city is on land or within ${COAST_TOLERANCE_DEG}° (~30 km) of the coast`, () => {
  const mask = decodeLandMask(JSON.parse(readFileSync(resolve(ROOT, 'public/data/land-50m.json'), 'utf8')));
  const wet = [];
  for (const city of CITIES) {
    assert.ok(city.lat >= -90 && city.lat <= 90 && city.lon >= -180 && city.lon <= 180, `${city.code}: lat/lon out of range`);
    const distance = mask.distanceAt(city.lon, city.lat);
    if (distance < -COAST_TOLERANCE_DEG) wet.push(`${city.code} ${distance.toFixed(2)}°`);
  }
  assert.deepEqual(wet, [], `cities at sea: ${wet.join(', ')}`);
});

// [night-12ai] R7j, D-213: wave-1 names (de, fr, es, pt = pt-BR) from Wikidata labels + reviewed overrides.
const { createHash } = await import('node:crypto');
const { REGIONS, REGION_IDS } = await import('../src/data/regions.ts');
const { PLANNED_LANGUAGE_ENTRIES } = await import('../src/i18n/languages.ts');
const { buildNames } = await import('./city-names.mjs');
const readJson = (path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
const NAMES = readJson('src/data/city-names.json');
const MAPPING = readJson('scripts/data/city-wikidata.json');
const PLANNED = PLANNED_LANGUAGE_ENTRIES.map((entry) => entry.code);
// SHA-256 of "code\tnamePl\tnameEn" per city, then per region: the PL/EN names on screen today (D-107).
const PL_EN_DIGEST = 'c59cb8320449049d00998ffc74c650f64f9b1bb2ceae098c7ba95c07aa396d99';

test('every city and region has a name in every planned language (R7j)', () => {
  assert.deepEqual(NAMES.languages, PLANNED);
  assert.deepEqual(Object.keys(NAMES.cities), CITIES.map((city) => city.code));
  assert.deepEqual(Object.keys(NAMES.regions), [...REGION_IDS]);
  const missing = [];
  for (const [kind, table] of [['city', NAMES.cities], ['region', NAMES.regions]]) {
    for (const [key, names] of Object.entries(table)) {
      assert.deepEqual(Object.keys(names).sort(), [...PLANNED].sort(), `${kind} ${key} languages`);
      for (const code of PLANNED) if (!names[code]?.trim() || /[()]/.test(names[code])) missing.push(`${kind} ${key} ${code}: "${names[code]}"`);
    }
  }
  assert.deepEqual(missing, [], missing.join(', '));
});

test('the names file is the offline rebuild of the Wikidata snapshot and the reviewed overrides', () => {
  const { names, problems } = buildNames(MAPPING, readJson('scripts/data/wikidata-labels.json'), readJson('scripts/data/city-names-overrides.json'));
  assert.deepEqual(problems, []);
  assert.deepEqual(names, NAMES, 'run node scripts/city-names.mjs');
  assert.match(NAMES.source, /CC0/);
});

test('every city maps to its own Wikidata item; every override names a known item and says why', () => {
  const ids = CITIES.map((city) => MAPPING.cities[city.code]);
  assert.ok(ids.every((id) => /^Q\d+$/.test(id)), 'unmapped city');
  assert.equal(new Set(ids).size, ids.length, 'two cities share a Wikidata item');
  const overrides = readJson('scripts/data/city-names-overrides.json');
  for (const [kind, table] of [['cities', overrides.cities], ['regions', overrides.regions]]) {
    for (const [key, byLanguage] of Object.entries(table)) {
      assert.ok(MAPPING[kind][key], `override for unknown ${kind} ${key}`);
      for (const [code, value] of Object.entries(byLanguage)) {
        assert.ok(PLANNED.includes(code) && value.name && value.why, `${kind} ${key} ${code}: name + why`);
      }
    }
  }
});

test('PL and EN city and region names are unchanged (no planned language replaces them)', () => {
  const text = [...CITIES.map((c) => `${c.code}\t${c.namePl}\t${c.nameEn}`),
    ...REGION_IDS.map((r) => `${r}\t${REGIONS[r].namePl}\t${REGIONS[r].nameEn}`)].join('\n');
  assert.equal(createHash('sha256').update(text).digest('hex'), PL_EN_DIGEST);
  assert.ok(!('pl' in NAMES.cities.LON) && !('en' in NAMES.cities.LON));
  assert.equal(NAMES.cities.NYC.pt, 'Nova York', 'pt is Brazilian (D-212)');
});

console.log(`SUMMARY test:city-data seed=0 cities=${CITIES.length} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
