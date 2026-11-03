// [night-10i] Transfer passengers inside the minimum connection time are visible in the read-only city view
// (`connectingByRegion`) and in the run's tag list (`RunCity.connecting`, the tail of `waiting`): they appear when a
// plane drops them at a hub, stay for exactly the hub's connection time, and never board before it runs out.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, type Sim } from '../src/sim/index.ts';
import type { PassengerSimulation } from '../src/sim/passengers.ts';
import { EndlessRun } from '../src/game/run.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}

interface Ref { type: string; from?: string; to?: string; plane?: string; city?: string }
function playReference(id: string): Sim {
  const level = JSON.parse(readFileSync(new URL(`../src/data/puzzles/${id}.json`, import.meta.url), 'utf8')) as
    { demandSeed: number; referenceCommands: Ref[] };
  const sim = createGame(level.demandSeed, 'puzzle', id);
  for (const command of level.referenceCommands) {
    sim.apply(command.type === 'connect'
      ? { type: 'AddRoute', cityIds: [command.from!, command.to!], aircraft: command.plane === 'jet' ? 'widebody' : 'turboprop' }
      : { type: 'UpgradeHub', hubId: command.city! });
    sim.tick();
  }
  return sim;
}

const sum = (record: Readonly<Record<string, number>>): number => Object.values(record).reduce((a, b) => a + b, 0);

test('puzzle 16 reference: transfers show up connecting, then become ready after the connection time', () => {
  const sim = playReference('16');
  /** Per city: minute a connecting count first went up, to measure how long the first passenger stays hollow. */
  let seen = 0;
  let maxConnecting = 0;
  let longest = 0;
  const firstSeen = new Map<string, number>();
  while (sim.world.status === 'running' && sim.world.minute < 3000) {
    sim.tick();
    for (const view of sim.world.cities()) {
      const connecting = sum(view.connectingByRegion);
      for (const [region, count] of Object.entries(view.connectingByRegion)) {
        assert.ok(count > 0 && count <= (view.waitingByRegion[region] ?? 0),
          `${view.id} ${region}: ${count} connecting of ${view.waitingByRegion[region] ?? 0} waiting`);
      }
      if (connecting > 0) {
        seen++;
        maxConnecting = Math.max(maxConnecting, connecting);
        if (!firstSeen.has(view.id)) firstSeen.set(view.id, sim.world.minute);
        // No passenger can stay inside the connection window longer than the hub's MCT.
        longest = Math.max(longest, sim.world.minute - firstSeen.get(view.id)!);
        assert.ok(view.transferTicks > 0, `${view.id} has no connection time`);
      } else {
        firstSeen.delete(view.id);
      }
    }
  }
  assert.ok(seen > 0, 'no transfer passenger was ever inside the connection time');
  assert.ok(maxConnecting >= 1);
  assert.ok(longest > 0, 'connection window never lasted a minute');
});

test('the view matches the terminal queues exactly; nobody is hollow longer than the MCT (puzzles 16-18)', () => {
  for (const id of ['16', '17', '18']) {
    const sim = playReference(id);
    // White-box: the kernel world keeps its passenger simulation public for tests; the view must agree with it.
    const kernel = (sim.world as unknown as { passengers: PassengerSimulation }).passengers;
    let seen = 0;
    while (sim.world.status === 'running') {
      sim.tick();
      for (const view of sim.world.cities()) {
        const queue = kernel.hubs.city(view.id);
        const expected: Record<string, number> = {};
        for (const passenger of queue.waiting) {
          if (passenger.readyAtTick <= kernel.tick) continue;
          expected[passenger.destinationRegion] = (expected[passenger.destinationRegion] ?? 0) + 1;
          assert.ok(passenger.readyAtTick - kernel.tick <= view.transferTicks,
            `${id} ${view.id}: ${passenger.readyAtTick - kernel.tick} min left, MCT ${view.transferTicks}`);
          assert.ok(passenger.arrivedOnRoute, `${id} ${view.id}: a hollow passenger did not arrive by plane`);
        }
        assert.deepEqual({ ...view.connectingByRegion }, expected, `${id} ${view.id} view`);
        seen += sum(expected);
      }
    }
    assert.ok(seen > 0, `${id}: nobody ever made a connection`);
  }
});

test('EndlessRun city list puts connecting passengers at the tail of waiting', () => {
  const sim = playReference('16');
  const run = new EndlessRun(sim);
  let checked = 0;
  while (sim.world.status === 'running' && checked < 20) {
    sim.tick();
    for (const city of run.cityList()) {
      if (!city.connecting) continue;
      const view = sim.world.cityView(city.id);
      assert.ok(city.connecting <= city.waiting.length);
      const tail: Record<string, number> = {};
      for (const region of city.waiting.slice(city.waiting.length - city.connecting)) tail[region] = (tail[region] ?? 0) + 1;
      assert.deepEqual(tail, { ...view.connectingByRegion }, `${city.id} tail ≠ connecting view`);
      checked++;
    }
  }
  assert.ok(checked > 0, 'no connecting city seen through the run list');
});

console.log(`SUMMARY test:transfers seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exit(1);
