// [night-11aj] R2g / D-236: Endless home region. The choice anchors only the start cluster in the region, Random
// (no choice) is bit-for-bit the pre-R2g game, Daily and puzzles refuse a region, the region survives save/restore,
// the D-76 replay of an older-rules save and the save-envelope bump (v1 saves still load), and the logbook and the
// menu preference keep it. Fails on the old code: no HOME_REGIONS, the config drops the region, the replay starts a
// random world.
import assert from 'node:assert/strict';
import { createGame, HOME_REGIONS, Sim, TICKS_PER_WEEK } from '../src/sim/index.ts';
import { RULES_VERSION } from '../src/sim/state.ts';
import { startClustersIn } from '../src/sim/spawner.ts';
import { CITIES } from '../src/data/cities.ts';
import { REGION_IDS, type RegionId } from '../src/data/regions.ts';
import { decodeSave, encodeSave, restoreSimDetailed, saveSourceFromSim, SAVE_VERSION } from '../src/game/save.ts';
import { EndlessRun } from '../src/game/run.ts';
import { readLogbook, recordFlight } from '../src/game/logbook.ts';
import { HOME_REGION_CHOICES, readHomeRegion, writeHomeRegion } from '../src/game/homeRegion.ts';
import { buildRunTimeline } from '../src/game/runTimeline.ts';

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const SEEDS = [0xA1A1, 0xB2B2, 0xC3C3, 7, 123456];

function startIndices(sim: Sim): number[] {
  const state = JSON.parse(sim.snapshot()).state;
  return state.world.spawner.activeCityIndices as number[];
}
/** Link the first start airport to the others with turboprops so the journal is not empty. */
function play(sim: Sim, ticks: number): void {
  const [first, ...rest] = sim.world.activeCityIds();
  for (const other of rest) sim.apply({ type: 'AddRoute', cityIds: [first, other], aircraft: 'turboprop' });
  sim.advance(ticks);
}
/** FNV-1a over the envelope fields in the order save.ts checksums them (to forge a v1 envelope as written). */
function checksum(body: Record<string, unknown>): string {
  const data = JSON.stringify([body.v, body.savedAt, body.seed, body.tick, body.snapshot, body.commands,
    body.stateHash, body.paramsVersion]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) { hash ^= data.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, data };
}

// Pre-R2g reference: createGame(seed).advance(3000) on origin/dev before this change.
const RANDOM_GOLDEN: Record<number, string> = { 0xA1A1: 'ae2813e8', 0xB2B2: '2f2a83ed', 7: '0860120b' };

await test('home regions: every region with a start cluster; Oceania has none (no other region within 2,500 km)', () => {
  assert.deepEqual([...HOME_REGIONS], REGION_IDS.filter((region) => region !== 'OCE'));
  assert.equal(startClustersIn('OCE').length, 0);
  for (const region of HOME_REGIONS) assert.ok(startClustersIn(region).length > 0, region);
  assert.deepEqual([...HOME_REGION_CHOICES], ['random', ...HOME_REGIONS]);
});

await test('Random is the pre-R2g game: same hashes, no region in the config', () => {
  for (const [seed, hash] of Object.entries(RANDOM_GOLDEN)) {
    const sim = createGame(Number(seed));
    assert.deepEqual(sim.config, { mode: 'endless' });
    sim.advance(3000);
    assert.equal(sim.hash(), hash, `seed ${seed}`);
    const explicit = createGame(Number(seed), 'endless', undefined, null);
    explicit.advance(3000);
    assert.equal(explicit.hash(), hash);
  }
});

await test('a home region anchors the start cluster there, for every region and seed', () => {
  for (const region of HOME_REGIONS) {
    const anchors = new Set(startClustersIn(region).map((cluster) => cluster[0]));
    for (const seed of SEEDS) {
      const sim = createGame(seed, 'endless', undefined, region);
      assert.deepEqual(sim.config, { mode: 'endless', homeRegion: region });
      const start = startIndices(sim);
      assert.ok(start.length >= 3 && start.length <= 4, `${region} ${seed}: ${start.length} airports`);
      assert.equal(CITIES[start[0]].region, region, `${region} ${seed}: anchor ${CITIES[start[0]].code}`);
      assert.ok(anchors.has(start[0]));
      // Passengers only fly to other regions: the start still holds two.
      assert.ok(new Set(start.map((index) => CITIES[index].region)).size >= 2);
    }
  }
});

await test('only the start cluster changes: later airports still spawn, anywhere the ordinary rules allow', () => {
  const sim = createGame(0xA1A1, 'endless', undefined, 'SAM');
  const start = startIndices(sim).length;
  sim.advance(2 * TICKS_PER_WEEK);
  assert.ok(sim.world.activeCityIds().length > start, 'new airports opened');
});

await test('deterministic: same seed and region give the same run; regions differ', () => {
  const a = createGame(0xB2B2, 'endless', undefined, 'EUN');
  const b = createGame(0xB2B2, 'endless', undefined, 'EUN');
  play(a, 2000);
  play(b, 2000);
  assert.equal(a.hash(), b.hash());
  const c = createGame(0xB2B2, 'endless', undefined, 'ASI');
  assert.notDeepEqual(startIndices(c), startIndices(createGame(0xB2B2, 'endless', undefined, 'EUN')));
  const random = createGame(0xB2B2);
  assert.notEqual(createGame(0xB2B2, 'endless', undefined, 'ASI').hash(), random.hash(), 'the region is in the hash');
});

await test('Daily, puzzles and unknown regions refuse a home region', () => {
  assert.throws(() => new Sim(1, { mode: 'daily', homeRegion: 'EUN' }), /configuration/);
  assert.throws(() => new Sim(1, { mode: 'puzzle', puzzleId: 'p01', homeRegion: 'EUN' }), /configuration/);
  assert.throws(() => new Sim(1, { mode: 'endless', homeRegion: 'OCE' }), /configuration/);
  assert.throws(() => new Sim(1, { mode: 'endless', homeRegion: 'XX' as RegionId }), /configuration/);
  assert.deepEqual(createGame(1, 'daily', undefined, 'EUN').config, { mode: 'daily' }, 'the facade drops it for Daily');
  assert.equal(EndlessRun.create(1, 'daily', 'EUN').homeRegion, null);
  assert.equal(EndlessRun.create(1, 'endless', 'EUN').homeRegion, 'EUN');
  assert.equal(EndlessRun.create(1).homeRegion, null);
});

await test('save → load keeps the region and the exact hash (envelope v2)', () => {
  const sim = createGame(0xC3C3, 'endless', undefined, 'AFR');
  play(sim, 1500);
  const save = encodeSave(saveSourceFromSim(sim), 1000);
  assert.equal(save.v, SAVE_VERSION);
  assert.equal(SAVE_VERSION, 3); // [night-12ba] R2k: 2 -> 3 (weekly contract)
  const decoded = decodeSave(JSON.stringify(save));
  assert.equal(decoded.status, 'ok');
  if (decoded.status !== 'ok') return;
  const restored = restoreSimDetailed(decoded.save);
  assert.ok(restored && !restored.replayed);
  assert.equal(restored.sim.hash(), sim.hash());
  assert.equal(restored.sim.config.homeRegion, 'AFR');
  restored.sim.advance(500);
  sim.advance(500);
  assert.equal(restored.sim.hash(), sim.hash(), 'continues identically');
});

await test('D-76: an older-rules save with a region is replayed in the same region, to the same state', () => {
  const sim = createGame(0xA1A1, 'endless', undefined, 'ME');
  play(sim, 1800);
  const save = encodeSave({ ...saveSourceFromSim(sim), paramsVersion: RULES_VERSION - 1 }, 1000);
  const restored = restoreSimDetailed(save);
  assert.ok(restored, 'replayed');
  assert.equal(restored.replayed, true);
  assert.equal(restored.sim.config.homeRegion, 'ME');
  assert.deepEqual(startIndices(restored.sim).slice(0, 3), startIndices(sim).slice(0, 3));
  assert.equal(restored.sim.hash(), sim.hash(), 'unchanged rules replay to the same hash');
});

await test('a v1 envelope (pre-R2g, Random) still loads to its hash; tampering is still caught', () => {
  const sim = createGame(0xB2B2);
  play(sim, 1200);
  const current = encodeSave(saveSourceFromSim(sim), 1000);
  const { checksum: _drop, ...body } = { ...current, v: 1 };
  const v1 = { ...body, checksum: checksum(body) };
  const decoded = decodeSave(JSON.stringify(v1));
  assert.equal(decoded.status, 'ok');
  if (decoded.status !== 'ok') return;
  assert.equal(decoded.save.v, SAVE_VERSION, 're-tagged on load');
  const restored = restoreSimDetailed(decoded.save);
  assert.ok(restored && !restored.replayed);
  assert.equal(restored.sim.hash(), sim.hash());
  assert.equal(restored.sim.config.homeRegion, undefined);
  assert.equal(decodeSave(JSON.stringify({ ...v1, tick: v1.tick + 1 })).status, 'error');
  assert.equal(decodeSave(JSON.stringify({ ...v1, checksum: current.checksum })).status, 'error', 'v1 is checked as v1');
  const future = decodeSave(JSON.stringify({ ...current, v: SAVE_VERSION + 1 }));
  assert.ok(future.status === 'error' && future.issue === 'unsupported');
});

await test('the run timeline re-reads a home-region run in its own world (its routes are accepted)', async () => {
  const sim = createGame(0xA1A1, 'endless', undefined, 'EUS');
  play(sim, 600);
  const routes = sim.world.routes().length;
  assert.ok(routes >= 2);
  const weeks = await buildRunTimeline({ seed: sim.seed, config: sim.config, journal: sim.getCommandLog(),
    endTick: sim.tickCount, endMinute: sim.world.minute, upgrades: [] });
  assert.ok(weeks, 'timeline rebuilt');
  assert.equal(weeks[0]!.routes, routes);
});

await test('logbook keeps an Endless flight\'s region; Daily, bad and old entries carry none', () => {
  const storage = memory();
  recordFlight(storage, { day: '2026-11-04', mode: 'endless', passengers: 10, weeks: 1, hub: 'LIS', region: 'EUS' });
  recordFlight(storage, { day: '2026-11-04', mode: 'endless', passengers: 10, weeks: 1, hub: 'LIS' });
  recordFlight(storage, { day: '2026-11-04', mode: 'daily', passengers: 10, weeks: 1, hub: 'LIS', region: 'EUS' });
  recordFlight(storage, { day: '2026-11-04', mode: 'endless', passengers: 10, weeks: 1, hub: 'LIS', region: 'XX' as RegionId });
  const book = readLogbook(storage);
  assert.deepEqual(book.recent.map((item) => item.region ?? null), [null, null, null, 'EUS']);
  assert.equal(book.flights, 4);
});

await test('menu preference: Random by default, stored next to the settings, bad values read as Random', () => {
  const storage = memory({ 'airway.settings': JSON.stringify({ sound: false }) });
  assert.equal(readHomeRegion(storage), null);
  writeHomeRegion(storage, 'NAM');
  assert.equal(readHomeRegion(storage), 'NAM');
  assert.deepEqual(JSON.parse(storage.data.get('airway.settings')!), { sound: false, homeRegion: 'NAM' }, 'other settings kept');
  writeHomeRegion(storage, null);
  assert.equal(readHomeRegion(storage), null);
  assert.deepEqual(JSON.parse(storage.data.get('airway.settings')!), { sound: false });
  assert.equal(readHomeRegion(memory({ 'airway.settings': '{"homeRegion":"OCE"}' })), null, 'not offered → Random');
  assert.equal(readHomeRegion(memory({ 'airway.settings': '{oops' })), null);
  const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.equal(readHomeRegion(denied), null);
  writeHomeRegion(denied, 'NAM');
});

console.log(`SUMMARY test:home-region regions=${HOME_REGIONS.length} seeds=${SEEDS.length} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
