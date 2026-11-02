import assert from 'node:assert/strict';
import { Rng, seedFromString } from '../src/core/rng.ts';

const SEED = 0xa1a1;
let passed = 0;
let failed = 0;
function check(name: string, test: () => void): void {
  try { test(); passed++; }
  catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}

check('reference mulberry32 sequence', () => {
  const rng = new Rng(0);
  assert.deepEqual(Array.from({ length: 5 }, () => rng.next()), [
    0.26642920868471265, 0.0003297457005828619, 0.2232720274478197,
    0.1462021479383111, 0.46732782293111086,
  ]);
});
check('state can be resumed exactly', () => {
  const first = new Rng(SEED);
  for (let i = 0; i < 43; i++) first.next();
  const saved = first.state;
  const second = new Rng(SEED);
  second.setState(saved);
  for (let i = 0; i < 1000; i++) assert.equal(first.next(), second.next());
});
check('forks are independent of parent draw order', () => {
  const parent = new Rng(SEED);
  const demand = parent.fork('demand');
  const cities = parent.fork('cities');
  const expectedDemand = new Rng(SEED).fork('demand');
  const expectedCities = new Rng(SEED).fork('cities');
  parent.next(); parent.next(); cities.next();
  assert.equal(demand.next(), expectedDemand.next());
  expectedCities.next();
  assert.equal(cities.next(), expectedCities.next());
  assert.notEqual(demand.seed, cities.seed);
});
check('UTF-8 FNV-1a known vectors', () => {
  assert.equal(seedFromString(''), 0x811c9dc5);
  assert.equal(seedFromString('A'), 0xc40bf6cc);
  const reference = (input: string): number => {
    let value = 0x811c9dc5;
    for (const byte of Buffer.from(input, 'utf8')) value = Math.imul(value ^ byte, 0x01000193) >>> 0;
    return value;
  };
  for (const key of ['Warszawa', 'Lodz', 'Gdansk', 'Warszawa 2026', '🚀']) {
    assert.equal(seedFromString(key), reference(key));
  }
});
check('bounded values and nonempty pick', () => {
  const rng = new Rng(SEED);
  for (let i = 0; i < 3000; i++) {
    assert.ok(rng.int(7) >= 0);
    const number = rng.int(-5, 6);
    assert.ok(number >= -5 && number < 6);
    const fraction = rng.range(-3, 3);
    assert.ok(fraction >= -3 && fraction < 3);
    assert.ok([3, 7, 11].includes(rng.pick([3, 7, 11])));
    assert.equal(typeof rng.chance(0.6), 'boolean');
  }
});
check('invalid inputs fail instead of silently coercing', () => {
  assert.throws(() => new Rng(-1), RangeError);
  assert.throws(() => new Rng(SEED).setState(2 ** 32), RangeError);
  assert.throws(() => new Rng(SEED).int(0), RangeError);
  assert.throws(() => new Rng(SEED).range(1, 1), RangeError);
  assert.throws(() => new Rng(SEED).pick([]), RangeError);
  assert.throws(() => new Rng(SEED).chance(NaN), RangeError);
  assert.throws(() => new Rng(SEED).fork(''), RangeError);
});
console.log(`SUMMARY test:rng seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
