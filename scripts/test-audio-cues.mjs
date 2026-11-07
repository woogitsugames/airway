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

// [night-35a] D-272: the surge notice comes with the surge "first time" card, which shows once per install.
const { FirstTimeRegistry, surgeAnnouncement } = await import('../src/game/tutorial/first-time.ts');
const { SURGE_NOTICE } = await import('../src/audio/engine.ts');
check('surge notice: the first announcement seen on an install sounds once; later ones, a new run, Daily stay silent', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
  // The session's path: an announced surge offers the card; the card shows once (registry); showing it sounds.
  const runOnce = (mode, announcements) => {
    const { cues, map } = mapper();
    const registry = new FirstTimeRegistry(storage);
    for (const view of announcements) {
      if (!surgeAnnouncement(mode, view, () => true) || registry.seen('surge')) continue;
      registry.mark('surge');
      map.surgeNotice();
    }
    return cues;
  };
  const soon = (cityId) => ({ cityId, active: false });
  assert.deepEqual(runOnce('daily', [soon('FRA')]), [], 'Daily never');
  const first = runOnce('endless', [soon('FRA'), { cityId: 'FRA', active: true }, soon('MAD')]);
  assert.deepEqual(first, [{ type: 'surge-notice' }], 'one cue, on the effects path (no sim tick)');
  assert.deepEqual(runOnce('endless', [soon('ROM')]), [], 'a later run on the same install');
  const { cues, map } = mapper();
  map.surgeNotice();
  map.surgeNotice();
  assert.equal(cues.length, 1, 'the mapper itself never repeats it');
});
check('surge notice synthesis: short (<= 0.6 s) and quieter than the route tag', () => {
  assert.ok(SURGE_NOTICE.offset + SURGE_NOTICE.ring <= 0.6, `length ${SURGE_NOTICE.offset + SURGE_NOTICE.ring}`);
  assert.ok(SURGE_NOTICE.peak < 0.043, `peak ${SURGE_NOTICE.peak}`);
  assert.ok(SURGE_NOTICE.high > SURGE_NOTICE.low);
});

// [night-07e] Split-flap rattle: capped, spaced clicks; simultaneous boards merge into one rattle.
const flap = await import('../src/game/flapSound.ts');
check('flap plan: a few clicks per animation, spaced and capped', () => {
  assert.deepEqual(flap.planFlapClicks(1, 76), [0]);
  assert.deepEqual(flap.planFlapClicks(9, 268), [0, 45, 90]);
  const board = flap.planFlapClicks(150, 3600);
  assert.equal(board.length, flap.FLAP_MAX_CLICKS);
  for (let i = 1; i < board.length; i++) assert.ok(board[i] - board[i - 1] >= flap.FLAP_CLICK_GAP_MS);
  assert.deepEqual(flap.planFlapClicks(0, 100), []);
  assert.deepEqual(flap.planFlapClicks(12, 300, 400), [], 'fully covered by an earlier rattle');
});
check('flap rattle: rows of one board merge, a later board rattles again', () => {
  let clock = 0;
  const timers = [];
  let clicks = 0;
  const rattle = flap.createFlapRattle(() => { clicks++; }, () => clock, (fn, ms) => { timers.push({ fn, at: clock + ms }); return timers.length; }, () => {});
  for (let row = 0; row < 12; row++) rattle.animate(20, 20 * 24 + 76); // whole menu board at once
  const flush = () => { timers.sort((a, b) => a.at - b.at); while (timers.length) { const t = timers.shift(); clock = t.at; t.fn(); } };
  flush();
  assert.equal(clicks, flap.FLAP_MAX_CLICKS, `merged board clicks ${clicks}`);
  const first = clicks;
  clock += 2000;
  rattle.animate(6, 196);
  flush();
  assert.equal(clicks - first, 2, 'a later status change rattles on its own');
});

console.log(`SUMMARY test:audio-cues seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
