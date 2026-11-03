// [night-07w] The DEV/balance bot (src/game/dev/bot-policy.ts) as a fair balance signal: with no spare
// aircraft it extends a served route to an unserved city instead of waiting for the hub to jam, and a run that
// takes "+2 slots" (no aircraft) in week 1 is no longer an automatic loss. Fixed seed.
// [night-12a] It also takes a widebody when its fleet has none or an airport is out of turboprop reach, and pairs
// two unserved airports beyond the network with each other.
import assert from 'node:assert/strict';
import { chooseBotAction, type BotSnapshot, type BotCity, type BotRoute } from '../src/game/dev/bot-policy.ts';
import { createBalanceSession } from './balance-game-adapter.ts';

const SEED = 0xA1A1;
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const city = (id: string, connectedRoutes: number, isHub = false): BotCity =>
  ({ id, active: true, connectedRoutes, isHub, waiting: 4, capacity: 24, warningTicksRemaining: null });
const route = (id: string, stops: string[], turboprop: number, widebody = 0): BotRoute =>
  ({ id, stops, distanceKm: 900, waiting: 8, assigned: { turboprop, widebody } });

/** A served LON–PAR turboprop route, an unserved BER, and the given distances (km) from the route ends. */
function snapshot(berFromLon: number, berFromPar: number, routes: BotRoute[] = [route('r1', ['LON', 'PAR'], 1)]): BotSnapshot {
  const km: Record<string, Record<string, number>> = {
    LON: { LON: 0, PAR: 340, BER: berFromLon }, PAR: { LON: 340, PAR: 0, BER: berFromPar },
    BER: { LON: berFromLon, PAR: berFromPar, BER: 0 },
  };
  return {
    tick: 100, status: 'running', cities: [city('LON', 1, true), city('PAR', 1), city('BER', 0)], routes,
    distancesKm: km, inventory: { turboprop: 0, widebody: 0 }, offers: [], ledger: [],
  };
}

test('no spare aircraft: the nearest end of a served route is extended to the unserved city', () => {
  const decision = chooseBotAction(snapshot(930, 880));
  assert.deepEqual(decision?.command, { type: 'ExtendRoute', routeId: 'r1', end: 'end', cityId: 'BER' });
});

test('a turboprop route is not extended beyond turboprop range', () => {
  assert.equal(chooseBotAction(snapshot(2600, 2700)), null);
});

test('a widebody-only route may take a long leg', () => {
  const decision = chooseBotAction(snapshot(5200, 5000, [route('r1', ['LON', 'PAR'], 0, 1)]));
  assert.deepEqual(decision?.command, { type: 'ExtendRoute', routeId: 'r1', end: 'end', cityId: 'BER' });
});

test('a route without aircraft or already at five stops is left alone', () => {
  assert.equal(chooseBotAction(snapshot(930, 880, [route('r1', ['LON', 'PAR'], 0)])), null);
  assert.equal(chooseBotAction(snapshot(930, 880, [route('r1', ['ROM', 'MAD', 'LIS', 'LON', 'PAR'], 2)])), null);
});

test('a spare aircraft still opens a new route rather than extending', () => {
  const decision = chooseBotAction({ ...snapshot(930, 880), inventory: { turboprop: 1, widebody: 0 } });
  assert.equal(decision?.command.type, 'AddRoute');
});

/** Real Sim: the bot plays seed `seed`; the week-1 board is answered with `kind`. Returns upgrades taken. */
function playWithWeekOne(seed: number, kind: 'slots' | 'turboprop'): { upgrades: number; rejected: number } {
  const session = createBalanceSession(seed);
  let upgrades = 0;
  let rejected = 0;
  for (let step = 0; step < 600; step++) { // 600 × 30 ticks = 30 min at 1x, the balance horizon
    const snap = session.snapshot();
    if (snap.status === 'finished') break;
    let decision = chooseBotAction(snap);
    if (snap.status === 'upgrade' && upgrades === 0) {
      const offer = snap.offers.find((item) => item.kind === kind);
      assert.ok(offer, `week 1 of seed ${seed} offers no ${kind}`);
      const busiest = [...snap.cities].sort((a, b) => b.connectedRoutes - a.connectedRoutes || (a.id < b.id ? -1 : 1))[0];
      decision = { command: { type: 'ChooseUpgrade', offerId: offer.id, ...(kind === 'slots' ? { cityId: busiest.id } : {}) }, reason: 'test' };
    }
    if (decision) {
      if (session.dispatch(decision.command)) { if (decision.command.type === 'ChooseUpgrade') upgrades++; } else rejected++;
    }
    session.advance(30);
  }
  return { upgrades, rejected };
}

test(`seed 0x${SEED.toString(16).toUpperCase()}: "+2 slots" in week 1 still reaches the week-3 board (was lost in week 2)`, () => {
  const slots = playWithWeekOne(SEED, 'slots');
  const turboprop = playWithWeekOne(SEED, 'turboprop');
  assert.equal(slots.rejected + turboprop.rejected, 0, 'the Sim refused bot commands');
  assert.ok(slots.upgrades >= 3, `"+2 slots" run took ${slots.upgrades} boards`);
  assert.ok(turboprop.upgrades >= 3, `turboprop run took ${turboprop.upgrades} boards`);
});

// [night-12a] Reach: the bot used to answer every board with a turboprop (a turboprop-only network has no
// "long route"), so an airport opening beyond 2,500 km of every other one always jammed unserved.
function board(offers: Array<'turboprop' | 'widebody' | 'hub' | 'slots'>, extra: Partial<BotSnapshot> = {}): BotSnapshot {
  return { ...snapshot(930, 880), status: 'upgrade', offers: offers.map((kind) => ({ id: kind, kind })), ...extra };
}

test('an airport out of turboprop reach of all others makes the bot take another widebody', () => {
  const far = snapshot(6200, 6000);
  const decision = chooseBotAction({ ...far, status: 'upgrade', offers: [{ id: 'turboprop', kind: 'turboprop' }, { id: 'widebody', kind: 'widebody' }],
    routes: [route('r1', ['LON', 'PAR'], 1), { ...route('r2', ['PAR', 'LON'], 0, 1), waiting: 400 }] });
  assert.deepEqual(decision?.command, { type: 'ChooseUpgrade', offerId: 'widebody' });
});

test('a fleet without any widebody takes one when offered; a fleet with one keeps adding turboprops', () => {
  assert.deepEqual(chooseBotAction(board(['turboprop', 'widebody', 'slots']))?.command, { type: 'ChooseUpgrade', offerId: 'widebody' });
  const owned = board(['turboprop', 'widebody', 'slots'], { routes: [route('r1', ['LON', 'PAR'], 1, 1)] });
  assert.deepEqual(chooseBotAction(owned)?.command, { type: 'ChooseUpgrade', offerId: 'turboprop' });
});

test('two unserved airports beyond the network but close to each other are paired by a new route', () => {
  const km: Record<string, Record<string, number>> = {
    LON: { LON: 0, PAR: 340, LOS: 5000, ABV: 5200 }, PAR: { LON: 340, PAR: 0, LOS: 4800, ABV: 4900 },
    LOS: { LON: 5000, PAR: 4800, LOS: 0, ABV: 520 }, ABV: { LON: 5200, PAR: 4900, LOS: 520, ABV: 0 },
  };
  const decision = chooseBotAction({
    tick: 100, status: 'running', cities: [city('LON', 1), city('PAR', 1), city('LOS', 0), city('ABV', 0)],
    routes: [route('r1', ['LON', 'PAR'], 1)], distancesKm: km, inventory: { turboprop: 1, widebody: 0 }, offers: [], ledger: [],
  });
  assert.deepEqual(decision?.command, { type: 'AddRoute', from: 'ABV', to: 'LOS' });
});

/** Real Sim, bot only: how many of `n` seeds end jammed at an airport that no route served. */
function unservedJams(n: number): { over: number; unserved: number } {
  let over = 0;
  let unserved = 0;
  for (let i = 0; i < n; i++) {
    const session = createBalanceSession(SEED + i);
    for (let step = 0; step < 600 && session.snapshot().status !== 'finished'; step++) {
      const decision = chooseBotAction(session.snapshot());
      if (decision) session.dispatch(decision.command);
      session.advance(30);
    }
    const world = session.simulation.world;
    if (world.status !== 'over') continue;
    over++;
    const jam = [...world.cities()].sort((a, b) => b.fullTicks - a.fullTicks)[0];
    if (jam && jam.routes === 0) unserved++;
  }
  return { over, unserved };
}

test('20 seeds: at most 4 runs end at an airport no route served (old bot: 14 of 18)', () => {
  const { over, unserved } = unservedJams(20);
  console.log(`  seeds=20 game_over=${over} unserved_jam=${unserved}`);
  assert.ok(unserved <= 4, `${unserved} of ${over} game overs at an unserved airport`);
});

console.log(`SUMMARY test:bot-policy seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
