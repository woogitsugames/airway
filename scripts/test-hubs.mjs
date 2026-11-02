import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { PassengerSimulation } = await import('../src/sim/passengers.ts');
const { MIN_TRANSFER_TICKS, CONGESTION_GRACE_TICKS, HUB_CAPACITY_UPGRADE, HUB_WAITING_CAPACITY: HUB, CITY_WAITING_CAPACITY: CITY } = await import('../src/sim/params.ts');
import { demandRng, city, fullyConnectedDistances, assertBalance } from './sim-fixtures.mjs';

const SEED = 0xA1A1;
const cities = [city('A', 'EUS'), city('B', 'NAM'), city('C', 'AFR'), city('D', 'ME')];
const distance = fullyConnectedDistances(cities.map((c) => c.cityId));
const sim = () => new PassengerSimulation(cities, distance, demandRng(SEED));
const routes = (s) => {
  s.apply({ type: 'AddRoute', routeId: 'R1', cities: ['A', 'B'] });
  s.apply({ type: 'AddRoute', routeId: 'R2', cities: ['B', 'C'] });
};
let tests = 0;
function test(fn) { fn(); tests++; }
try {
  test(() => {
    const s = sim(); routes(s);
    assert.equal(s.hubs.city('B').isHub, true);
    assert.equal(s.hubs.city('B').capacity, HUB);
    assert.equal(s.hubs.city('A').capacity, CITY);
    s.upgradeHub('B');
    assert.equal(HUB_CAPACITY_UPGRADE, 6);
    assert.equal(s.hubs.city('B').capacity, HUB + 6);
    assert.equal(s.hubs.city('B').transferTicks, 15, 'upgraded hub has a shorter connection time');
    s.apply({ type: 'RemoveRoute', routeId: 'R2' });
    assert.equal(s.hubs.city('B').isHub, false);
    assert.equal(s.hubs.city('B').capacity, CITY + 6);
  });
  test(() => {
    const s = sim(); routes(s);
    const id = s.seedPassenger('A', 'AFR');
    const boarded = s.boardAt('A', 'R1', 1, 'B');
    assert.deepEqual(boarded.map((p) => p.id), [id]);
    assert.throws(() => s.alightAt('B', 'R1', [id, id]), /manifest/);
    const transfer = s.alightAt('B', 'R1', [id]);
    assert.deepEqual(transfer.transferred, [id]);
    assert.equal(s.hubs.city('B').waiting[0].readyAtTick, MIN_TRANSFER_TICKS);
    assert.equal(s.boardAt('B', 'R2', 10, 'C').length, 0);
    for (let i = 0; i < MIN_TRANSFER_TICKS - 1; i++) s.step();
    assert.equal(s.boardAt('B', 'R2', 10, 'C').length, 0);
    s.step();
    assert.deepEqual(s.boardAt('B', 'R2', 10, 'C').map((p) => p.id), [id]);
    const landing = s.alightAt('C', 'R2', [id]);
    assert.deepEqual(landing.delivered, [id]);
    assert.equal(s.score, 1);
    assert.equal(s.ledger.region('AFR').delivered, 1);
    assertBalance(assert, s);
  });
  test(() => {
    const s = sim(); routes(s);
    for (let i = 0; i < HUB; i++) s.seedPassenger('B', 'ME');
    assert.equal(s.hubs.city('B').fullTicks, 0);
    for (let i = 0; i < CONGESTION_GRACE_TICKS - 1; i++) assert.equal(s.step(), null);
    const fail = s.step();
    assert.equal(fail.tick, CONGESTION_GRACE_TICKS);
    assert.equal(fail.cityId, 'B');
    assert.equal(fail.waiting, HUB);
    assert.equal(fail.leadingRegion, 'ME');
    assert.equal(fail.leadingRegionPercent, 100);
    assert.equal(s.ledger.hub('B').noRoute, HUB);
    assert.equal(s.ledger.hub('B').longWait, HUB);
    assert.equal(s.ledger.hub('B').full, HUB);
    assertBalance(assert, s);
    assert.equal(s.step().tick, CONGESTION_GRACE_TICKS, 'finished games freeze time');
  });
  test(() => {
    const s = sim(); routes(s);
    for (let i = 0; i < HUB; i++) s.seedPassenger('B', 'AFR');
    for (let i = 0; i < 250; i++) s.step();
    assert.equal(s.hubs.city('B').fullTicks, 250);
    assert.equal(s.boardAt('B', 'R2', 1, 'C').length, 1);
    s.step();
    assert.equal(s.hubs.city('B').fullTicks, 0, 'countdown resets when below capacity');
    s.seedPassenger('B', 'AFR');
    for (let i = 0; i < CONGESTION_GRACE_TICKS - 1; i++) assert.equal(s.step(), null);
    assert.equal(s.step().tick, 251 + CONGESTION_GRACE_TICKS);
  });
  test(() => {
    const s = sim(); routes(s);
    s.seedPassenger('A', 'AFR');
    const saved = JSON.parse(JSON.stringify(s.snapshot()));
    const restored = sim(); restored.restore(saved);
    assert.equal(restored.hash(), s.hash());
    for (let i = 0; i < 100; i++) { s.step(); restored.step(); }
    assert.equal(restored.hash(), s.hash());
  });
  test(() => {
    const populationCities = [city('A', 'EUS', 20_000_000), city('B', 'NAM', 20_000_000)];
    const s = new PassengerSimulation(populationCities, fullyConnectedDistances(['A', 'B']), demandRng(SEED), ['A']);
    for (let i = 0; i < 1_440; i++) s.step();
    assert.equal(s.passengerBalance().created, 0, 'inactive regions create no demand');
    s.activateCity('B');
    for (let i = 0; i < 500 && !s.failed; i++) s.step();
    assert.ok(s.passengerBalance().created > 0, 'new active region participates in demand');
    const snap = JSON.parse(JSON.stringify(s.snapshot()));
    const resumed = new PassengerSimulation(populationCities, fullyConnectedDistances(['A', 'B']), demandRng(SEED), ['A']);
    resumed.restore(snap);
    assert.equal(resumed.hash(), s.hash());
  });
  console.log(`SUMMARY test:hubs seed=0x${SEED.toString(16)} cases=${tests} passed=${tests} failed=0`);
} catch (e) {
  console.error(e);
  console.log(`SUMMARY test:hubs seed=0x${SEED.toString(16)} cases=${tests} passed=${tests} failed=1`);
  process.exitCode = 1;
}
