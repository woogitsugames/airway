// [night-03] AudioCueMapper: run events and hourly readings → audio cues, without a Sim or AudioContext.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { AudioCueMapper } = await import('../src/game/audioCues.ts');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}
function city(id, region, waiting, capacity, hub = true, lat = 10) {
  return { id, lon: 0, lat, region, waiting: Array(waiting).fill('EUN'), capacity, hub, jamTicksLeft: null, slotHeld: 0, nextSlotMinutes: 0 };
}
function fakeRun(cities, minute = 0, hours = {}) {
  return { tick: minute, clockMinute: minute, cityList: () => cities, localHour: (id) => hours[id] ?? 12 };
}
function mapper() { const cues = []; return { cues, map: new AudioCueMapper((cue) => cues.push(cue)) }; }

check('arrival carries region, night and load', () => {
  const { cues, map } = mapper();
  map.events([{ type: 'arrival', cityId: 'FRA' }], fakeRun([city('FRA', 'EUN', 18, 36)], 0, { FRA: 3 }));
  assert.equal(cues.length, 1);
  assert.equal(cues[0].regionId, 'EUN');
  assert.equal(cues[0].night, true);
  assert.equal(cues[0].loadRatio, 0.5);
});

check('slot-wait sounds once per airport per game hour', () => {
  const { cues, map } = mapper();
  const event = { type: 'slot-held', cityId: 'MAD', limit: 3, minutesToSlot: 20 };
  map.events([event, event], fakeRun([], 60));
  map.events([event], fakeRun([], 90));
  map.events([event], fakeRun([], 120));
  assert.deepEqual(cues.map((c) => c.type), ['slot-wait', 'slot-wait']);
});

check('hourly load: top four loaded hubs drone, a calmed hub is released once', () => {
  const { cues, map } = mapper();
  const cities = ['A', 'B', 'C', 'D', 'E'].map((id, i) => city(`H${id}`, 'EUN', 30 - i, 36));
  map.hourly(fakeRun(cities, 60));
  const loads = cues.filter((c) => c.type === 'hub-load');
  assert.equal(loads.length, 4);
  assert.deepEqual(loads.map((c) => c.hubId), ['HA', 'HB', 'HC', 'HD']);
  map.hourly(fakeRun(cities, 90)); // same hour: nothing
  assert.equal(cues.length, 4);
  cues.length = 0;
  cities[0] = city('HA', 'EUN', 2, 36);
  map.hourly(fakeRun(cities, 120));
  const release = cues.find((c) => c.hubId === 'HA');
  assert.equal(release.loadRatio, 0);
  cues.length = 0;
  map.hourly(fakeRun(cities, 180));
  assert.equal(cues.filter((c) => c.hubId === 'HA').length, 0, 'release is sent only once');
});

check('dawn blooms at hubs reaching 06:00, at most two per hour', () => {
  const { cues, map } = mapper();
  const cities = [city('X', 'ASI', 0, 36), city('Y', 'ASI', 0, 36), city('Z', 'ASI', 0, 36), city('W', 'ASI', 0, 36, false)];
  map.hourly(fakeRun(cities, 60, { X: 6, Y: 6, Z: 6, W: 6 }));
  const dawns = cues.filter((c) => c.type === 'dawn');
  assert.equal(dawns.length, 2);
  assert.ok(dawns.every((c) => c.regionId === 'ASI'));
});

check('player commands map to tag, paper and stamp', () => {
  const { cues, map } = mapper();
  for (const type of ['AddRoute', 'ExtendRoute', 'RemoveRoute', 'ShortenRoute', 'ChooseUpgrade', 'AssignPlane']) map.command(type);
  assert.deepEqual(cues.map((c) => c.type), ['tag', 'tag', 'paper', 'paper', 'stamp']);
});

check('week and jam cues pass through', () => {
  const { cues, map } = mapper();
  map.events([{ type: 'week', week: 3 }, { type: 'jam', cityId: 'FRA', jammed: true }], fakeRun([city('FRA', 'EUN', 36, 36)]));
  assert.deepEqual(cues.map((c) => c.type), ['week', 'hub-load']);
  assert.equal(cues[1].loadRatio, 1);
});

console.log(`SUMMARY test:audio-cues seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
