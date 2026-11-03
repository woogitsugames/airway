// [night-02] Golden save regression: a real-Sim save written by an earlier build must keep loading to the exact
// same state hash, continue identically and replay from its journal alone. A save from an older RULES_VERSION
// (e.g. v3 before the D-41 slots) is never half-restored: it is replayed from its journal under the current rules
// (D-76, night N7k) or refused. Regenerate the fixture only on an
// intentional RULES_VERSION bump: `node scripts/test-save-golden.mjs --write`.
import './ts-test-loader.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const { createGame, Sim, TICKS_PER_WEEK } = await import('../src/sim/index.ts');
const { RULES_VERSION } = await import('../src/sim/state.ts');
const { cityDistanceKm } = await import('../src/data/index.ts');
const { encodeSave, decodeSave, saveSourceFromSim, restoreSimFromSave, restoreSimDetailed, loadSavedSim, loadSavedSimChecked, readGame, MAX_REPLAY_TICKS } = await import('../src/game/save.ts');
const { GAME_SAVE_KEY } = await import('../src/platform/storage.ts');

const SEED = 0xA1A1;
const SAVE_AT = TICKS_PER_WEEK + 600; // past the first weekly board, inside week 2
const CONTINUE = 1440;
const FIXTURE = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/save-golden.json');
let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; } catch (error) { failed++; console.error(`FAIL ${name}:`, error instanceof Error ? error.message : error); }
}
function assert(condition, message) { if (!condition) throw new Error(message); }

/**
 * Deterministic policy: link each unlinked city to its nearest linked one, stack spare aircraft on the busiest
 * airport's first route (so departures queue for slots) and prefer the "+2 slots" card for that airport.
 */
function busiest(world) {
  return world.cities().filter((city) => city.routes > 0)
    .sort((a, b) => b.routes - a.routes || b.waiting - a.waiting || (a.id < b.id ? -1 : 1))[0];
}
function drive(sim) {
  const world = sim.world;
  if (world.status === 'upgrade' && world.offer && !sim.pendingCount) {
    const offers = world.offer.offers;
    const pick = offers.find((offer) => offer.id === 'departure-slots') ?? offers.find((offer) => offer.id !== 'hub-expansion') ?? offers[0];
    const airport = busiest(world);
    sim.apply(pick.id !== 'turboprop' && pick.id !== 'widebody' && airport
      ? { type: 'ChooseUpgrade', week: world.offer.week, upgrade: pick.id, hubId: airport.id }
      : { type: 'ChooseUpgrade', week: world.offer.week, upgrade: pick.id });
    return;
  }
  if (world.status !== 'running' || sim.tickCount % 60 !== 0) return;
  const cities = world.cities();
  const linked = cities.filter((city) => city.routes > 0);
  for (const city of cities.filter((c) => c.routes === 0)) {
    const target = (linked.length ? linked : cities).filter((c) => c.id !== city.id)
      .map((c) => ({ id: c.id, km: cityDistanceKm(city.id, c.id) }))
      .sort((a, b) => a.km - b.km || (a.id < b.id ? -1 : 1))[0];
    if (!target) continue;
    const command = { type: 'AddRoute', cityIds: [city.id, target.id], aircraft: target.km <= 2500 ? 'turboprop' : 'widebody' };
    if (sim.check(command).ok) { sim.apply(command); return; }
  }
  const airport = busiest(world);
  const route = airport && world.routes().filter((r) => r.cityIds.includes(airport.id)).sort((a, b) => (a.id < b.id ? -1 : 1))[0];
  for (const aircraft of ['turboprop', 'widebody']) {
    const command = route && { type: 'AssignPlane', routeId: route.id, aircraft };
    if (command && world.reserve[aircraft] > 0 && sim.check(command).ok) { sim.apply(command); return; }
  }
}
function play(sim, until) {
  while (sim.tickCount < until && (sim.world.status === 'running' || sim.world.status === 'upgrade')) {
    drive(sim); sim.tick(); sim.drainEvents();
  }
  return sim;
}

if (process.argv.includes('--write')) {
  const sim = play(createGame(SEED), SAVE_AT);
  const save = JSON.stringify(encodeSave(saveSourceFromSim(sim), 0));
  const continued = Sim.fromSnapshot(sim.snapshot());
  for (let i = 0; i < CONTINUE && continued.world.status === 'running'; i++) continued.tick();
  writeFileSync(FIXTURE, JSON.stringify({ rulesVersion: RULES_VERSION, saveAt: sim.tickCount, hash: sim.hash(),
    continueTicks: CONTINUE, continueHash: continued.hash(), save }) + '\n');
  console.log(`wrote ${FIXTURE} rules=${RULES_VERSION} tick=${sim.tickCount} hash=${sim.hash()}`);
  process.exit(0);
}

const golden = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const decoded = decodeSave(golden.save);
check('fixture decodes', () => assert(decoded.status === 'ok', `decode: ${JSON.stringify(decoded)}`));
check('fixture covers a weekly "+2 slots" upgrade', () => {
  const world = JSON.parse(golden.save).snapshot.state.world;
  assert(world.upgradeHistory.some((entry) => entry.upgrade === 'departure-slots'), 'no "+2 slots" upgrade before the save');
  assert(Object.values(world.slots.bonus).some((count) => count > 0), 'slot bonus not serialised');
});
check('fixture matches the current RULES_VERSION', () => assert(golden.rulesVersion === RULES_VERSION,
  `fixture is rules v${golden.rulesVersion}, code is v${RULES_VERSION}: regenerate with --write after an intentional bump`));
const save = decoded.status === 'ok' ? decoded.save : null;
let restored = null;
check('golden save restores to the exact hash', () => {
  restored = restoreSimFromSave(save);
  assert(restored, 'restore refused');
  assert(restored.tickCount === golden.saveAt, `tick ${restored.tickCount} != ${golden.saveAt}`);
  assert(restored.hash() === golden.hash, `hash ${restored.hash()} != ${golden.hash}`);
});
check('restored game continues identically', () => {
  assert(restored, 'no restored game');
  for (let i = 0; i < golden.continueTicks && restored.world.status === 'running'; i++) restored.tick();
  assert(restored.hash() === golden.continueHash, `continue hash ${restored.hash()} != ${golden.continueHash}`);
});
check('journal alone replays to the saved hash', () => {
  const replay = Sim.replay(save.seed, save.commands, save.tick);
  assert(replay.hash() === golden.hash, `replay hash ${replay.hash()} != ${golden.hash}`);
});
check('the same game re-played today still produces the golden save', () => {
  const sim = play(createGame(SEED), golden.saveAt);
  assert(sim.hash() === golden.hash, `fresh run hash ${sim.hash()} != ${golden.hash} (rules changed without a RULES_VERSION bump?)`);
});
check('older-rules save is replayed from its journal to the same tick (D-76)', () => {
  const old = { ...save, paramsVersion: RULES_VERSION - 1,
    snapshot: { ...save.snapshot, state: { ...save.snapshot.state, rulesVersion: RULES_VERSION - 1 } } };
  let threw = false;
  try { Sim.fromSnapshot(JSON.stringify(old.snapshot)); } catch { threw = true; }
  assert(threw, 'Sim must reject an older-rules snapshot (never half-restored)');
  const restored = restoreSimDetailed(old);
  assert(restored && restored.replayed, 'an older-rules save must be replayed');
  assert(restored.sim.tickCount === golden.saveAt, `replayed tick ${restored.sim.tickCount} != ${golden.saveAt}`);
  // Rules did not really change here, so the replay must land on the golden state exactly.
  assert(restored.sim.hash() === golden.hash, `replayed hash ${restored.sim.hash()} != ${golden.hash}`);
  assert(JSON.stringify(restored.sim.getCommandLog()) === JSON.stringify(save.commands), 'journal must be kept');
});
check('legacy save without a rules version whose snapshot no longer loads is replayed', () => {
  const legacy = { ...save, paramsVersion: null, stateHash: null,
    snapshot: { ...save.snapshot, state: { ...save.snapshot.state, rulesVersion: RULES_VERSION - 1 } } };
  const restored = restoreSimDetailed(legacy);
  assert(restored && restored.replayed && restored.sim.hash() === golden.hash, 'legacy save must replay');
});
check('current-rules save with a wrong hash is corrupt, never replayed', () => {
  assert(restoreSimFromSave({ ...save, stateHash: 'deadbeef' }) === null, 'hash mismatch must be refused');
});
check('save from newer rules is refused', () => {
  assert(restoreSimFromSave({ ...save, paramsVersion: RULES_VERSION + 1 }) === null, 'newer rules must be refused');
});
check('older-rules run that the current rules already end is not offered', () => {
  // Build nothing and take every first upgrade card: the start airports jam and the run ends.
  const sim = createGame(SEED);
  while (sim.world.status !== 'over' && sim.tickCount < MAX_REPLAY_TICKS) {
    const offer = sim.world.status === 'upgrade' && !sim.pendingCount ? sim.world.offer : null;
    if (offer) sim.apply({ type: 'ChooseUpgrade', week: offer.week, upgrade: offer.offers.find((o) => o.id === 'turboprop' || o.id === 'widebody')?.id ?? offer.offers[0].id });
    sim.tick(); sim.drainEvents();
  }
  assert(sim.world.status === 'over', 'fixture run did not end');
  const lost = { ...save, paramsVersion: RULES_VERSION - 1, commands: sim.getCommandLog(), tick: sim.tickCount,
    snapshot: { ...save.snapshot, pending: [] } };
  assert(restoreSimFromSave(lost) === null, 'a run that is over after replay must not be resumed');
});
check('older-rules save longer than the replay cap is refused', () => {
  assert(restoreSimFromSave({ ...save, paramsVersion: RULES_VERSION - 1, tick: MAX_REPLAY_TICKS + 1 }) === null,
    'over-long replay must be refused');
});
check('pending commands of the saved tick survive a replay', () => {
  const command = { type: 'SetSpeed', speed: 2 };
  const old = { ...save, paramsVersion: RULES_VERSION - 1, snapshot: { ...save.snapshot, pending: [command] } };
  const restored = restoreSimDetailed(old);
  assert(restored && restored.sim.pendingCount === 1, 'pending command lost');
});
const store = { values: new Map(), async get(k) { return this.values.get(k) ?? null; }, async set(k, v) { this.values.set(k, v); }, async remove(k) { this.values.delete(k); } };
const oldEnvelope = encodeSave({ ...saveSourceFromSim(restoreSimFromSave(save)), paramsVersion: RULES_VERSION - 1 }, 0);
await store.set(GAME_SAVE_KEY, JSON.stringify(oldEnvelope));
const first = await loadSavedSim(store);
const rewritten = await readGame(store);
check('loading a migrated save writes it back under the current rules', () => {
  assert(first && first.replayed, 'first load must replay');
  assert(rewritten.status === 'ok' && rewritten.save.paramsVersion === RULES_VERSION, 'save not written back');
  assert(rewritten.save.stateHash === first.sim.hash(), 'written-back hash differs');
});
const second = await loadSavedSim(store);
check('the next load restores directly, without a second replay', () => {
  assert(second && !second.replayed && second.sim.hash() === first.sim.hash(), 'second load must be a plain restore');
});
// [night-10c] Why an existing save cannot be continued (menu notice).
const issueOf = async (text, throwing = false) => {
  const s = { values: new Map(), async get(k) { if (throwing) throw new Error('blocked'); return this.values.get(k) ?? null; }, async set(k, v) { this.values.set(k, v); }, async remove() {} };
  if (text !== null) await s.set(GAME_SAVE_KEY, text);
  return loadSavedSimChecked(s);
};
const noSave = await issueOf(null);
const damaged = await issueOf('{"v":1,"broken');
const newerEnvelope = await issueOf(JSON.stringify({ v: 99 }));
const newerRules = await issueOf(JSON.stringify(encodeSave({ ...saveSourceFromSim(restoreSimFromSave(save)), paramsVersion: RULES_VERSION + 1 }, 0)));
const blocked = await issueOf(null, true);
const good = await issueOf(golden.save);
check('save notice: none without a save or with unreadable storage, none for a good save', () => {
  assert(noSave.restored === null && noSave.issue === null, 'missing save');
  assert(blocked.restored === null && blocked.issue === null, 'blocked storage must not claim a broken save');
  assert(good.restored && good.issue === null, 'good save');
});
check('save notice: damaged → corrupt, newer envelope or rules → unsupported', () => {
  assert(damaged.restored === null && damaged.issue === 'corrupt', `damaged ${damaged.issue}`);
  assert(newerEnvelope.issue === 'unsupported', `newer envelope ${newerEnvelope.issue}`);
  assert(newerRules.restored === null && newerRules.issue === 'unsupported', `newer rules ${newerRules.issue}`);
});
check('tampered golden save is rejected by the checksum', () => {
  const tampered = JSON.parse(golden.save);
  tampered.tick += 1;
  assert(decodeSave(JSON.stringify(tampered)).status === 'error', 'checksum must catch a tampered field');
});
console.log(`SUMMARY test:save-golden seed=0x${SEED.toString(16).toUpperCase()} rules=${RULES_VERSION} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
