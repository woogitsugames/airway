// [night-11af] R4c: the fill trend rule and the hourly readings behind the chevron on the passenger tag, without a
// Sim or DOM. Fails on the code before R4c: src/game/fillTrend.ts did not exist.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { fillTrend, FillReadings, TREND_MIN_FILL, TREND_STEADY } = await import('../src/game/fillTrend.ts');
const { gameHour } = await import('../src/game/audioCues.ts');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}
const city = (id, waiting, capacity = 12) => ({ id, waiting: Array(waiting).fill('EUN'), capacity });
const fakeRun = (minute, cities) => ({ clockMinute: minute, cityList: () => cities });

check('rule constants: from half full, steady within ±1', () => {
  assert.equal(TREND_MIN_FILL, 0.5);
  assert.equal(TREND_STEADY, 1);
});

check('rule: below half full there is no chevron, whatever the balance', () => {
  assert.equal(fillTrend(5, 12, 4), null);
  assert.equal(fillTrend(5, 12, -4), null);
  assert.equal(fillTrend(0, 0, 3), null); // unknown capacity
});

check('rule: from half full, +2 fills, -2 empties, ±1 and 0 are steady', () => {
  assert.equal(fillTrend(6, 12, 2), 'filling');
  assert.equal(fillTrend(6, 12, -2), 'emptying');
  assert.equal(fillTrend(12, 12, 9), 'filling');
  assert.equal(fillTrend(7, 13, -5), 'emptying'); // 7/13 ≥ 50 %
  assert.equal(fillTrend(6, 13, 5), null); // 6/13 < 50 %
  for (const balance of [-1, 0, 1]) assert.equal(fillTrend(10, 12, balance), null, `balance ${balance}`);
  assert.equal(fillTrend(10, 12, null), null); // no history yet
});

check('readings: one per game hour, the balance is the change between the last two', () => {
  const readings = new FillReadings();
  assert.equal(readings.hourly(fakeRun(60, [city('FRA', 4)])), true);
  assert.equal(readings.balance('FRA'), null);
  assert.equal(readings.hourly(fakeRun(90, [city('FRA', 11)])), false); // same hour: no new reading
  assert.equal(readings.balance('FRA'), null);
  assert.equal(readings.hourly(fakeRun(120, [city('FRA', 9)])), true);
  assert.equal(readings.balance('FRA'), 5);
  assert.equal(readings.trend('FRA', 9, 12), 'filling');
  readings.hourly(fakeRun(180, [city('FRA', 6)]));
  assert.equal(readings.balance('FRA'), -3);
  assert.equal(readings.trend('FRA', 6, 12), 'emptying');
  assert.equal(readings.trend('FRA', 5, 12), null); // dropped below half since the reading
  readings.hourly(fakeRun(240, [city('FRA', 7)]));
  assert.equal(readings.trend('FRA', 7, 12), null); // +1: steady
});

check('readings: hour boundary is the one the audio drones use', () => {
  const readings = new FillReadings();
  readings.hourly(fakeRun(59, [city('FRA', 2)]));
  assert.equal(readings.hourly(fakeRun(60, [city('FRA', 8)])), true);
  assert.equal(gameHour(59) + 1, gameHour(60));
  assert.equal(readings.balance('FRA'), 6);
});

check('readings: an airport opened since the last reading has no trend yet', () => {
  const readings = new FillReadings();
  readings.hourly(fakeRun(60, [city('FRA', 4)]));
  readings.hourly(fakeRun(120, [city('FRA', 4), city('NEW', 8)]));
  assert.equal(readings.balance('NEW'), null);
  assert.equal(readings.trend('NEW', 8, 12), null);
  readings.hourly(fakeRun(180, [city('FRA', 4), city('NEW', 10)]));
  assert.equal(readings.trend('NEW', 10, 12), 'filling');
});

check('readings: a jump (undo back an hour, restored save) starts the history over', () => {
  const readings = new FillReadings();
  readings.hourly(fakeRun(60, [city('FRA', 2)]));
  readings.hourly(fakeRun(120, [city('FRA', 9)]));
  assert.equal(readings.balance('FRA'), 7);
  readings.hourly(fakeRun(70, [city('FRA', 3)])); // undo into the previous hour
  assert.equal(readings.balance('FRA'), null);
  readings.hourly(fakeRun(600, [city('FRA', 9)])); // skipped hours
  assert.equal(readings.balance('FRA'), null);
  readings.hourly(fakeRun(660, [city('FRA', 6)]));
  assert.equal(readings.balance('FRA'), -3);
});

check('readings never touch the run', () => {
  const cities = Object.freeze([Object.freeze(city('FRA', 7))]);
  const readings = new FillReadings();
  readings.hourly(fakeRun(60, cities));
  readings.hourly(fakeRun(120, cities));
  assert.equal(readings.balance('FRA'), 0);
});

console.log(`SUMMARY test:fill-trend seed=0xA1A1 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
