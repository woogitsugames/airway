import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { RouteNetwork } = await import('../src/sim/network.ts');
const { AudioCueMapper, cueRun, audioClockTick } = await import('../src/game/audioCues.ts');
const { TutorialController, TUTORIAL_KEY, readTutorialOutcome } = await import('../src/game/tutorial/controller.ts');
let passed = 0, failed = 0;
async function check(name, fn) { try { await fn(); passed++; } catch (e) { failed++; console.error(`FAIL ${name}:`, e); } }
await check('invalid network commands preserve state and revision', () => {
  assert.throws(() => new RouteNetwork(['A', 'A']));
  assert.throws(() => new RouteNetwork(['A', '']));
  const net = new RouteNetwork(['A', 'B', 'C']); net.addRoute('r', ['A', 'B']);
  const before = net.snapshot();
  for (const action of [() => net.addRoute('r', ['A', 'B']), () => net.addRoute('x', ['A', 'X']),
    () => net.extendRoute('r', 'C', 'bad'), () => net.shortenRoute('r', 'start'), () => net.removeRoute('missing')]) {
    assert.throws(action); assert.deepEqual(net.snapshot(), before);
  }
  assert.throws(() => net.restore({ routes: [], revision: -1 }));
});
await check('route edges, extension, shortening, defensive copies', () => {
  const net = new RouteNetwork(['A', 'B', 'C']); net.addRoute('r', ['A', 'B']); net.extendRoute('r', 'C', 'start');
  assert.ok(net.hasSegment('r', 'A', 'C')); assert.equal(net.hasSegment('missing', 'A', 'C'), false);
  const copy = net.getRoute('r'); copy.cities.push('X'); assert.deepEqual(net.getRoute('r').cities, ['C', 'A', 'B']);
  net.shortenRoute('r', 'start'); assert.deepEqual(net.getRoute('r').cities, ['A', 'B']);
});
await check('audio adapter reads live run and arrival handles missing city', () => {
  const run = { tick: 7, clockMinute: 12, cityList: () => [], sim: { world: { cityView: () => ({ localHour: 23 }) } } };
  const view = cueRun(run); assert.equal(audioClockTick(view), 7); assert.equal(view.localHour('A'), 23);
  run.tick = 8; assert.equal(view.tick, 8);
  const cues = [], mapper = new AudioCueMapper((cue) => cues.push(cue));
  mapper.events([{ type: 'arrival', cityId: 'A' }, { type: 'new-city', cityId: 'A' }, { type: 'jam', cityId: 'A', jammed: true }], view);
  assert.equal(cues.length, 2); assert.equal(cues[0].latitude, 0); assert.equal(cues[0].night, true); assert.equal(cues[1].type, 'new-city');
});
await check('tutorial rejected action keeps progress and unlocks retry', async () => {
  const pauses = []; const port = { setPaused: (value) => pauses.push(value), perform: async () => { throw Error('offline'); } };
  const tutorial = new TutorialController(port); const route = { type: 'route', from: 'LON', to: 'PAR' };
  assert.equal(await tutorial.submit({ type: 'route', from: 'PAR', to: 'LON' }), false);
  assert.equal(await tutorial.submit(route), false); assert.deepEqual(tutorial.getState(), { visible: true, step: 'route', busy: false });
  assert.equal(pauses[0], true); tutorial.dispose(); assert.equal(pauses.at(-1), false);
});
await check('tutorial skip invalidates pending action', async () => {
  let accept; const states = [], pauses = [], data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) };
  const tutorial = new TutorialController({ setPaused: (v) => pauses.push(v), perform: () => new Promise((r) => { accept = r; }) }, storage);
  const unsubscribe = tutorial.subscribe((s) => states.push(s));
  const pending = tutorial.submit({ type: 'route', from: 'LON', to: 'PAR' });
  assert.equal(tutorial.getState().busy, true); tutorial.skip(); accept(true);
  assert.equal(await pending, false); assert.equal(tutorial.getState().visible, false); assert.equal(readTutorialOutcome(storage), 'skipped');
  assert.equal(JSON.parse(data.get(TUTORIAL_KEY)).status, 'skipped'); assert.equal(pauses.at(-1), false); unsubscribe();
});
console.log(`SUMMARY test:coverage-gaps seed=0xA1A1 passed=${passed} failed=${failed}`);
process.exitCode = failed ? 1 : 0;
