// End-to-end determinism of the authoritative Sim: 3 seeds x 2 game weeks driven by a scripted,
// state-dependent command policy. Checks mid-run snapshot/restore, journal-only replay, the save
// envelope (src/game/save.ts) and undo, all against the final state hash.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { createGame, Sim, TICKS_PER_WEEK } = await import('../src/sim/index.ts');
const { cityDistanceKm } = await import('../src/data/index.ts');
const { encodeSave, decodeSave } = await import('../src/game/save.ts');
const { saveSourceFromSim, restoreSimFromSave } = await import('../src/game/save.ts');

const botModules = { ...(await import('./balance-game-adapter.ts')), ...(await import('./bot.ts')) };
const SEEDS = [0xA1A1, 0xB2B2, 0xC3C3];
// A balance-sample seed whose bot run survives past the first week (docs/balance/game-50.csv).
const UPGRADE_SEED = 0xA1A1 + 9;
const END = 2 * TICKS_PER_WEEK;
const MID = TICKS_PER_WEEK + 1234;
let passed = 0;
let failed = 0;
const notes = [];
function check(name, fn) {
  try { fn(); passed++; } catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}

/** Scripted policy: a pure function of the current read-only views, so a restored run continues identically. */
function drive(sim) {
  const world = sim.world;
  if (world.status === 'upgrade' && world.offer) {
    const offer = world.offer;
    if (!sim.pendingCount) {
      const pick = offer.offers.find((o) => o.id !== 'hub-expansion') ?? offer.offers[0];
      const hub = world.cities().filter((c) => c.isHub).sort((a, b) => b.waiting - a.waiting)[0];
      sim.apply(pick.id === 'hub-expansion' && hub
        ? { type: 'ChooseUpgrade', week: offer.week, upgrade: pick.id, hubId: hub.id }
        : { type: 'ChooseUpgrade', week: offer.week, upgrade: pick.id });
    }
    return;
  }
  if (world.status !== 'running' || sim.tickCount % 60 !== 0) return;
  const cities = world.cities();
  const linked = cities.filter((c) => c.routes > 0);
  for (const city of cities.filter((c) => c.routes === 0)) {
    const targets = (linked.length ? linked : cities).filter((c) => c.id !== city.id)
      .map((c) => ({ id: c.id, km: cityDistanceKm(city.id, c.id) }))
      .sort((a, b) => a.km - b.km || (a.id < b.id ? -1 : 1));
    const target = targets[0];
    if (!target) continue;
    const aircraft = target.km <= 2500 && world.reserve.turboprop > 0 ? 'turboprop' : 'widebody';
    const command = { type: 'AddRoute', cityIds: [city.id, target.id], aircraft };
    if (sim.check(command).ok) { sim.apply(command); return; }
  }
  // Spare aircraft go to the route whose endpoints have the most waiting passengers.
  for (const aircraft of ['turboprop', 'widebody']) {
    if (world.reserve[aircraft] === 0) continue;
    const waiting = new Map(cities.map((c) => [c.id, c.waiting]));
    const best = world.routes().map((route) => ({ route, load: route.cityIds.reduce((n, id) => n + (waiting.get(id) ?? 0), 0) }))
      .filter(({ route }) => sim.check({ type: 'AssignPlane', routeId: route.id, aircraft }).ok)
      .sort((a, b) => b.load - a.load || (a.route.id < b.route.id ? -1 : 1))[0];
    if (best) { sim.apply({ type: 'AssignPlane', routeId: best.route.id, aircraft }); return; }
  }
}

function play(sim, until) {
  while (sim.tickCount < until) {
    drive(sim);
    sim.tick();
    sim.drainEvents();
  }
  return sim;
}

for (const seed of SEEDS) {
  const label = seed.toString(16);
  const run = createGame(seed);
  play(run, MID);
  const midSnapshot = run.snapshot();
  const midHash = run.hash();
  play(run, END);
  const finalHash = run.hash();
  const journal = run.getCommandLog();
  notes.push(`${label}:${finalHash}:min${run.world.minute}:${run.world.status}:score${run.world.score}:cmds${journal.length}`);

  check(`${label} journal is non-trivial`, () => {
    assert.ok(journal.length >= 3, 'policy must issue commands');
    assert.ok(journal.some(([, c]) => c.type === 'AddRoute'));
  });
  check(`${label} restore mid-run snapshot and continue`, () => {
    const resumed = Sim.fromSnapshot(midSnapshot);
    assert.equal(resumed.hash(), midHash);
    play(resumed, END);
    assert.equal(resumed.hash(), finalHash);
    assert.deepEqual(resumed.getCommandLog(), journal);
  });
  check(`${label} replay from the journal only`, () => {
    assert.equal(Sim.replay(seed, journal, END).hash(), finalHash);
  });
  check(`${label} save envelope round trip`, () => {
    const text = JSON.stringify(encodeSave(saveSourceFromSim(run), 0));
    const decoded = decodeSave(text);
    assert.equal(decoded.status, 'ok');
    const restored = restoreSimFromSave(decoded.save);
    assert.ok(restored, 'restore must succeed');
    assert.equal(restored.hash(), finalHash);
    notes.push(`${label}:saveBytes${text.length}`);
  });
  check(`${label} undo returns to the exact hash`, () => {
    const copy = Sim.fromSnapshot(run.snapshot());
    copy.apply({ type: 'SetSpeed', speed: 2 });
    copy.tick();
    const reference = Sim.fromSnapshot(run.snapshot());
    reference.tick();
    assert.equal(copy.undo(), true);
    assert.equal(copy.hash(), reference.hash());
  });
  check(`${label} different seed differs`, () => {
    assert.notEqual(Sim.replay(seed + 1, [], 10).hash(), Sim.replay(seed, [], 10).hash());
  });
}

check('bot-driven run crosses a weekly upgrade and replays exactly', () => {
  const { createBalanceSession } = botModules;
  const session = createBalanceSession(UPGRADE_SEED);
  for (let i = 0; i < 2000; i++) {
    const snap = session.snapshot();
    if (snap.status === 'finished') break;
    const decision = botModules.chooseBotAction(snap);
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  const sim = session.simulation;
  assert.ok(sim.world.upgrades.length >= 1, 'a weekly upgrade must have been chosen');
  assert.ok(sim.world.minute > TICKS_PER_WEEK);
  assert.equal(Sim.replay(UPGRADE_SEED, sim.getCommandLog(), sim.tickCount).hash(), sim.hash());
  assert.equal(Sim.fromSnapshot(sim.snapshot()).hash(), sim.hash());
  notes.push(`bot${UPGRADE_SEED.toString(16)}:min${sim.world.minute}:upgrades=${sim.world.upgrades.map((u) => u.upgrade).join('+')}`);
});

check('puzzle scenario runs on the real Sim', () => {
  const sim = createGame(1, 'puzzle', '01');
  assert.deepEqual(sim.world.activeCityIds().sort(), ['LON', 'PAR']);
  sim.apply({ type: 'AddRoute', cityIds: ['LON', 'PAR'], aircraft: 'turboprop' });
  while (sim.world.status === 'running') sim.tick();
  assert.equal(sim.world.status, 'won');
  assert.ok(sim.world.score > 0, 'scripted waves are delivered');
  notes.push(`puzzle01:score${sim.world.score}`);
});

console.log(`SUMMARY test:replay seeds=${SEEDS.length} ticks=${END} passed=${passed} failed=${failed} ${notes.join(' ')}`);
if (failed) process.exitCode = 1;
