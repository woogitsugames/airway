// Fixed-seed, dependency-free unit test of the independent task 11 adapters.
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'airway-daynight-'));
const seed = 0xA1A1;
let passed = 0;
let failed = 0;
const failures = [];
function check(label, condition) {
  if (condition) passed++;
  else { failed++; failures.push(label); }
}
function throws(label, fn) {
  let didThrow = false;
  try { fn(); } catch { didThrow = true; }
  check(label, didThrow);
}
function rootRng(gameSeed) {
  return { fork(label) {
    let x = gameSeed >>> 0;
    for (let i = 0; i < label.length; i++) x = Math.imul(x ^ label.charCodeAt(i), 16777619) >>> 0;
    return { int(max) {
      x = (x + 0x6d2b79f5) >>> 0;
      let v = Math.imul(x ^ (x >>> 15), x | 1);
      v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
      return Math.floor(((v ^ (v >>> 14)) >>> 0) / 4294967296 * max);
    } };
  } };
}

try {
  // Transpile only this task's TypeScript; the rest of dev is deliberately still a scaffold.
  for (const file of ['src/sim/params.ts', 'src/sim/daynight.ts', 'src/data/cities.ts', 'src/render/sun.ts']) {
    const source = readFileSync(resolve(root, file), 'utf8');
    const js = ts.transpileModule(source, {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      reportDiagnostics: true,
    });
    if (js.diagnostics?.length) throw new Error(`Transpile errors in ${file}`);
    const target = resolve(scratch, file.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, js.outputText);
  }
  writeFileSync(resolve(scratch, 'package.json'), '{"type":"module"}');
  const load = async (file) => import(pathToFileURL(resolve(scratch, file)).href);
  const sim = await load('src/sim/daynight.js');
  const params = await load('src/sim/params.js');
  const cities = await load('src/data/cities.js');
  const sun = await load('src/render/sun.js');
  const cityData = Array.from({ length: 24 }, (_, i) => ({ cityId: `C${String(i).padStart(2, '0')}`, utcOffsetH: i - 12 }));
  const cityIds = cityData.map((city) => city.cityId);
  const w4 = 3 * params.DAYNIGHT_MINUTES_PER_WEEK;

  check('24 positive integer hourly weights', params.DEMAND_HOURLY_WEIGHTS.length === 24 &&
    params.DEMAND_HOURLY_WEIGHTS.every((x) => Number.isInteger(x) && x > 0));
  check('dawn demand > night', sim.hourlyDemandWeight(6 * 60, 0) > sim.hourlyDemandWeight(2 * 60, 0));
  check('west-of-Greenwich demand', sim.hourlyDemandWeight(11 * 60, -5) > sim.hourlyDemandWeight(7 * 60, -5));
  check('local hour handles negative offset', sim.localHourAt(30, -5) === 19);
  check('local hour handles east offset', sim.localHourAt(23 * 60, 8) === 7);
  check('24h and weekly UTC wrap', sim.localHourAt(1440 + 90, 0) === 1 && sim.weekAtTick(w4) === 4);
  check('all timezone bands integer', [-180, -74, 0, 2.4, 21, 179.9, 180].every((lon) =>
    Number.isInteger(cities.utcOffsetHFromLongitude(lon))));
  check('timezone west/east boundaries', cities.utcOffsetHFromLongitude(-180) === -12 &&
    cities.utcOffsetHFromLongitude(180) === 12 && cities.utcOffsetHFromLongitude(21) === 1);
  check('timezone adapter immutable', cities.withUtcOffsetH({ code: 'WAW', lon: 21 }).utcOffsetH === 1);
  check('curfew start and end edges', !sim.isLocalCurfewHour(22 * 60 + 59, 0) &&
    sim.isLocalCurfewHour(23 * 60, 0) && sim.isLocalCurfewHour(5 * 60 + 59, 0) &&
    !sim.isLocalCurfewHour(6 * 60, 0));
  check('curfew offset across UTC day', sim.isLocalCurfewHour(11 * 60, -8) &&
    !sim.isLocalCurfewHour(14 * 60, -8));
  throws('invalid longitude rejected', () => cities.utcOffsetHFromLongitude(NaN));
  throws('invalid sim offset rejected', () => sim.localHourAt(0, 5.5));
  throws('negative tick rejected', () => sim.weekAtTick(-1));

  const a = new sim.CurfewPlanner('endless', cityData, rootRng(seed));
  const b = new sim.CurfewPlanner('endless', [...cityData].reverse(), rootRng(seed));
  check('no endless curfew before week four', a.advance(0) === null && a.advance(w4 - 1) === null &&
    a.curfewCityIds.length === 0);
  const announce = a.advance(w4);
  const announceB = b.advance(w4);
  check('week four announcement', announce?.week === 4 && announce.firstTick === w4 && announce.cityIds.length === 2);
  check('seed and shuffled catalog deterministic', JSON.stringify(announce.cityIds) === JSON.stringify(announceB.cityIds));
  check('announcement once per week', a.advance(w4 + 1) === null);
  check('selected airport closed during curfew', (() => {
    const picked = cityData.find((city) => city.cityId === announce.cityIds[0]);
    const utcHour = (23 - picked.utcOffsetH + 24) % 24;
    return a.isClosed(picked.cityId, w4 + utcHour * 60) &&
      !a.isClosed(picked.cityId, w4 + ((12 - picked.utcOffsetH + 24) % 24) * 60);
  })());
  const selected = cityData.find((city) => city.cityId === announce.cityIds[0]);
  const midnight = w4 + ((23 - selected.utcOffsetH + 24) % 24) * 60;
  a.advance(midnight);
  check('departures blocked', !a.canDepart(selected.cityId, midnight));
  check('landing blocked', !a.canLand(selected.cityId, midnight));
  const beforeCurfew = w4 + ((22 - selected.utcOffsetH + 24) % 24) * 60;
  check('arrival in curfew prevents leg', !a.canScheduleLeg(selected.cityId, selected.cityId, beforeCurfew, 90));
  a.setActiveCities(cityIds.slice(0, 14));
  const snapshot = a.snapshot();
  const restored = new sim.CurfewPlanner('endless', cityData, rootRng(seed));
  restored.restore(JSON.parse(JSON.stringify(snapshot)));
  check('saved schedule restores exactly', JSON.stringify(restored.snapshot()) === JSON.stringify(snapshot));
  check('snapshot cursors preserve announcement', restored.advance(midnight) === null);
  check('active cities may change midweek', snapshot.selectionCityIds.length === 24 &&
    snapshot.activeCityIds.length === 14);
  throws('cross-week target validates city', () =>
    a.canScheduleLeg(selected.cityId, 'UNKNOWN', w4 + 10_000, 180));
  throws('tampered snapshot rejected', () => restored.restore({ ...snapshot, selectedCityIds: ['C23'] }));
  check('curfew progression week 6', a.advance(5 * params.DAYNIGHT_MINUTES_PER_WEEK)?.cityIds.length === 3);
  const puzzle = new sim.CurfewPlanner('puzzle', cityData, rootRng(seed), ['C02', 'C05']);
  check('puzzle curfew available in week one', puzzle.advance(0)?.cityIds.length === 2 &&
    puzzle.isClosed('C02', 10 * 60));
  throws('unknown city rejected', () => puzzle.isClosed('UNKNOWN', 30));
  throws('curfew check needs current tick', () => puzzle.isClosed('C02', w4));

  check('midnight sun opposite Greenwich', sun.subsolarLongitudeAt(0) === -180);
  check('noon sun on Greenwich', sun.subsolarLongitudeAt(720) === 0);
  check('sun daily cycle exactly one revolution', sun.subsolarLongitudeAt(720 + 1440) === 0);
  check('continuous interpolation at date line', (() => {
    const left = sun.subsolarLongitudeAt(0, 0);
    const right = sun.subsolarLongitudeAt(0, 1);
    const radians = (left - right) * Math.PI / 180;
    return Math.abs(Math.sin(radians)) < 0.005;
  })());
  throws('invalid frame fraction rejected', () => sun.subsolarLongitudeAt(0, 1.2));
  let position = null;
  const render = { toneMappingExposure: 1.05 };
  const controller = sun.createSunController({ setSun(lon, lat) { position = { lon, lat }; } }, render);
  controller.update(720);
  const dayExposure = render.toneMappingExposure;
  controller.update(0);
  const nightExposure = render.toneMappingExposure;
  check('sun targets the current game tick', position.lat === -18.5 && position.lon === -180);
  check('exposure is subtle and follows light', dayExposure > nightExposure &&
    dayExposure < 1.08 && nightExposure > 0.97);
  controller.setSeasonDeclination(0);
  controller.update(360);
  check('season parameter updates sun only', position.lat === 0 && position.lon === 90);
  throws('invalid season rejected', () => controller.setSeasonDeclination(24));
  const barriers = [];
  const layer = { setCurfew(id, closed) { barriers.push([id, closed]); } };
  const presenter = sun.createCurfewBarrierPresenter(layer, ['C02']);
  presenter.sync(10 * 60, puzzle);
  presenter.sync(10 * 60, puzzle);
  check('barrier emits only changed closure', barriers.length === 1 && barriers[0][1]);
  presenter.sync(22 * 60, puzzle);
  check('barrier opens at daytime', barriers.length === 2 && !barriers[1][1]);
  presenter.dispose();
} catch (error) {
  failed++;
  failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  rmSync(scratch, { recursive: true, force: true });
  for (const failure of failures) console.error('FAIL ' + failure);
  console.log(`SUMMARY test:daynight seed=0x${seed.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
  if (failed) process.exitCode = 1;
}
