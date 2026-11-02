// [task-05] Check city integrity and all rounded great-circle distances with a fixed seed.
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTask05Modules } from './test-05-loader.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = '0xA1A1';
let count = 0;
let pairs = 0;
const errors = [];
let modules;
try {
  modules = loadTask05Modules();
  const { CITIES } = modules.cities;
  const { REGION_IDS, REGIONS, GLYPH_PATHS } = modules.regions;
  const { DISTANCE_CITY_COUNT, DISTANCE_CITY_CODES, distanceKm } = modules.distances;
  count = CITIES.length;
  assert.ok(count >= 140 && count <= 180, 'target ~150 cities');
  assert.equal(DISTANCE_CITY_COUNT, count);
  assert.equal(DISTANCE_CITY_CODES.length, count);
  const codes = new Set();
  const glyphs = new Set();
  const colors = new Set();
  for (const region of REGION_IDS) {
    const definition = REGIONS[region];
    assert.ok(definition);
    assert.ok(definition.namePl && definition.nameEn && GLYPH_PATHS[definition.glyph]);
    glyphs.add(definition.glyph);
    colors.add(definition.color);
  }
  assert.equal(glyphs.size, REGION_IDS.length, 'distinct region glyphs');
  assert.equal(colors.size, REGION_IDS.length, 'distinct region colours');
  for (let i = 0; i < count; i++) {
    const city = CITIES[i];
    assert.match(city.code, /^[A-Z]{3}$/);
    assert.ok(!codes.has(city.code), `duplicate ${city.code}`);
    codes.add(city.code);
    assert.equal(DISTANCE_CITY_CODES[i], city.code, 'distance order changed');
    assert.ok(city.namePl.trim() && city.nameEn.trim());
    assert.ok(REGION_IDS.includes(city.region), 'unknown region');
    assert.ok(Number.isInteger(city.population) && city.population > 0);
    assert.ok(city.lat >= -90 && city.lat <= 90 && city.lon >= -180 && city.lon <= 180);
    assert.ok(Math.abs(city.lon * 10 - Math.round(city.lon * 10)) < 0.00001);
    assert.ok(Math.abs(city.lat * 10 - Math.round(city.lat * 10)) < 0.00001);
    assert.equal(distanceKm(i, i), 0);
    for (let j = 0; j < i; j++) {
      const other = CITIES[j];
      const rad = Math.PI / 180;
      const dLat = (city.lat - other.lat) * rad;
      const dLon = (city.lon - other.lon) * rad;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(city.lat * rad) *
        Math.cos(other.lat * rad) * Math.sin(dLon / 2) ** 2;
      const expected = 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
      const actual = distanceKm(i, j);
      assert.ok(Math.abs(actual - expected) <= 1, `${city.code}-${other.code}: ${actual} vs ${expected}`);
      assert.equal(actual, distanceKm(j, i), 'distance symmetry');
      pairs++;
    }
  }
  assert.throws(() => distanceKm(-1, 0), RangeError);
  assert.throws(() => distanceKm(0, count), RangeError);
  execFileSync(process.execPath, [resolve(ROOT, 'scripts/build-distances.mjs'), '--check'], { cwd: ROOT, stdio: 'pipe' });
} catch (error) {
  errors.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  modules?.dispose();
}
for (const error of errors) console.error('FAIL ' + error);
console.log(`SUMMARY test:cities seed=${SEED} cities=${count} pairs=${pairs} passed=${errors.length ? 0 : 1} failed=${errors.length}`);
if (errors.length) process.exitCode = 1;
