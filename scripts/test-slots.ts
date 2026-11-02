// [task-32] D-41 departure slots: hourly per-airport limit, deterministic queue, "+2 slots" upgrade.
import assert from 'node:assert/strict';
import { createPlaneFleet, assignPlane, createScheduledRoute } from '../src/sim/planes.ts';
import { tickPlaneSchedule, type DepartureSlotGate } from '../src/sim/schedule.ts';
import { Sim } from '../src/sim/index.ts';
import { cityDistanceKm } from '../src/data/index.ts';
import { PLANE_TYPES, DEPARTURE_SLOT_UPGRADE } from '../src/sim/params.ts';

const SEED = 0xA1A1;
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}

/** Hourly gate with a fixed limit per city, mirroring world.ts (hour = floor(minute / 60)). */
function hourlyGate(limit: number, clock: { minute: number }): DepartureSlotGate & { readonly heldCount: () => number } {
  let hour = -1;
  let held = 0;
  const used = new Map<string, number>();
  return {
    tryTake(cityId: string): boolean {
      const now = Math.floor(clock.minute / 60);
      if (now !== hour) { hour = now; used.clear(); }
      const n = used.get(cityId) ?? 0;
      if (n >= limit) return false;
      used.set(cityId, n + 1);
      return true;
    },
    held() { held++; },
    heldCount: () => held,
  };
}

test('limit 1 slot/h: two aircraft from one city never depart in the same game hour', () => {
  const route = createScheduledRoute('R1', ['AAA', 'BBB'], () => 400);
  const fleet = createPlaneFleet({ turboprop: 3 });
  for (let i = 0; i < 3; i++) assignPlane(fleet, route, 'turboprop');
  const clock = { minute: 0 };
  const gate = hourlyGate(1, clock);
  const departures: Array<[string, number, string]> = [];
  for (let minute = 1; minute <= 6 * 60; minute++) {
    clock.minute = minute;
    const before = fleet.planes.map((plane) => plane.phase);
    tickPlaneSchedule(fleet, [route], undefined, undefined, gate);
    fleet.planes.forEach((plane, i) => {
      if (before[i] === 'ground' && plane.phase === 'flight') departures.push([plane.id, minute, route.cityIds[plane.cityIndex]]);
    });
  }
  const perHour = new Map<string, number>();
  for (const [, minute, city] of departures) {
    const key = `${city}:${Math.floor(minute / 60)}`;
    perHour.set(key, (perHour.get(key) ?? 0) + 1);
  }
  assert.ok(departures.length >= 4, `expected several departures, got ${departures.length}`);
  for (const [key, count] of perHour) assert.equal(count, 1, `${key} had ${count} departures`);
  // First ready, first out; ties by plane serial: plane-1 at minute 25, then plane-2 / plane-3 at the next hours.
  assert.deepEqual(departures.filter(([, , city]) => city === 'AAA').slice(0, 3).map(([id, minute]) => [id, minute]), [['plane-1', 25], ['plane-2', 60], ['plane-3', 120]]);
});

test('held aircraft keep their load and wait time; queue order is deterministic', () => {
  const route = createScheduledRoute('R1', ['AAA', 'BBB'], () => 400);
  const run = () => {
    const fleet = createPlaneFleet({ turboprop: 4 });
    for (let i = 0; i < 4; i++) assignPlane(fleet, route, 'turboprop');
    const clock = { minute: 0 };
    const gate = hourlyGate(1, clock);
    const trace: string[] = [];
    for (let minute = 1; minute <= 12 * 60; minute++) {
      clock.minute = minute;
      tickPlaneSchedule(fleet, [route], undefined, undefined, gate);
      trace.push(fleet.planes.map((p) => `${p.phase[0]}${p.cityIndex}:${p.slotWaitTicks}`).join(','));
    }
    return { trace, held: gate.heldCount() };
  };
  const a = run();
  const b = run();
  assert.deepEqual(a.trace, b.trace);
  assert.ok(a.held > 0);
  // At minute 59 plane-4 has waited 35 minutes (ready at 25, not departed).
  assert.match(a.trace[58], /g0:35$/);
});

/** Real Sim: one route from the seed's first city, four turboprops waiting at the same airport. */
function crowdedStart(): { sim: Sim; from: string; to: string } {
  const sim = new Sim(SEED);
  const ids = sim.world.activeCityIds();
  let pair: [string, string] | null = null;
  for (const a of ids) for (const b of ids) {
    const km = cityDistanceKm(a, b);
    if (!pair && a !== b && km !== undefined && km <= PLANE_TYPES.turboprop.rangeKm) pair = [a, b];
  }
  assert.ok(pair, 'seed has a turboprop-range pair');
  const [from, to] = pair;
  sim.apply({ type: 'AddRoute', cityIds: [from, to], aircraft: 'turboprop' });
  sim.tick();
  for (let i = 0; i < 3; i++) sim.apply({ type: 'AssignPlane', routeId: 'R1', aircraft: 'turboprop' });
  sim.tick();
  assert.equal(sim.world.planes.length, 4);
  return { sim, from, to };
}

function departuresFrom(sim: Sim, from: string, minutes: number): number[] {
  const hours: number[] = [];
  const route = sim.world.routes()[0];
  for (let i = 0; i < minutes; i++) {
    const before = sim.world.planes.map((plane) => plane.phase);
    sim.tick();
    sim.world.planes.forEach((plane, j) => {
      if (before[j] === 'ground' && plane.phase === 'flight' && route.cityIds[plane.cityIndex] === from) {
        hours.push(Math.floor(sim.world.minute / 60));
      }
    });
  }
  return hours;
}

test('real Sim: the airport limit holds aircraft, reports them and records the cause', () => {
  const { sim, from } = crowdedStart();
  const limit = sim.world.departureSlotLimit(from);
  assert.ok(limit < 4, `base limit ${limit} must be below four aircraft for this test`);
  const hours = departuresFrom(sim, from, 56); // up to minute 58, still game hour 0
  assert.equal(hours.filter((h) => h === 0).length, limit);
  const view = sim.world.cityView(from);
  assert.equal(view.departuresThisHour, limit);
  assert.equal(view.slotHeldPlanes, 4 - limit);
  assert.equal(view.nextSlotMinutes, 60 - sim.world.minute);
  assert.ok(sim.world.hubCauseLedger(from).slotWaitMinutes > 0);
  const events = sim.drainEvents().filter((event) => event.type === 'DepartureHeld');
  assert.equal(events.length, 4 - limit);
  assert.equal(events.filter((event) => event.type === 'DepartureHeld' && event.first).length, 1);
  // Snapshot/restore and replay keep the slot state.
  const copy = Sim.fromSnapshot(sim.snapshot());
  assert.equal(copy.hash(), sim.hash());
  const replay = Sim.replay(SEED, sim.getCommandLog(), sim.tickCount);
  assert.equal(replay.hash(), sim.hash());
  departuresFrom(sim, from, 10);
  assert.equal(sim.world.cityView(from).slotHeldPlanes, 0, 'held aircraft depart in the next hour');
});

test('"+2 slots" on the chosen airport raises its hourly throughput', () => {
  const base = crowdedStart();
  const baseLimit = base.sim.world.departureSlotLimit(base.from);
  const baseHours = departuresFrom(base.sim, base.from, 56);

  const boosted = crowdedStart();
  // Open a week-1 board offering the slot upgrade through a regular snapshot (no rule shortcut).
  const save = JSON.parse(boosted.sim.snapshot());
  save.state.world.status = 'upgrade';
  save.state.world.upgrade = { week: 1, paused: true, offers: [{ id: 'departure-slots', week: 1 }, { id: 'turboprop', week: 1 }], pendingHub: false };
  boosted.sim.restore(JSON.stringify(save));
  boosted.sim.apply({ type: 'ChooseUpgrade', week: 1, upgrade: 'departure-slots' });
  boosted.sim.tick();
  assert.equal(boosted.sim.world.offer?.pendingHub, true, 'slot upgrade asks for an airport');
  assert.equal(boosted.sim.check({ type: 'ChooseUpgrade', week: 1, upgrade: 'departure-slots', hubId: 'ZZZ' }).ok, false);
  boosted.sim.apply({ type: 'ChooseUpgrade', week: 1, upgrade: 'departure-slots', hubId: boosted.from });
  boosted.sim.tick();
  assert.equal(boosted.sim.world.status, 'running');
  assert.equal(boosted.sim.world.departureSlotLimit(boosted.from), baseLimit + DEPARTURE_SLOT_UPGRADE);
  assert.equal(boosted.sim.world.departureSlotLimit(boosted.to), base.sim.world.departureSlotLimit(base.to));
  assert.equal(boosted.sim.world.departureSlots, DEPARTURE_SLOT_UPGRADE);
  const boostedHours = departuresFrom(boosted.sim, boosted.from, 54);
  const firstHour = (hours: number[]) => hours.filter((h) => h === 0).length;
  assert.ok(firstHour(boostedHours) > firstHour(baseHours),
    `boosted ${firstHour(boostedHours)} vs base ${firstHour(baseHours)} departures in hour 0`);
  assert.equal(firstHour(boostedHours), Math.min(4, baseLimit + DEPARTURE_SLOT_UPGRADE));
});

console.log(`SUMMARY test:slots seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
