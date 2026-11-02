// [task-07] Deterministic route-gesture tests; no DOM, renderer or sim kernel required.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = '0xA1A1';
const source = readFileSync(resolve(ROOT, 'src/input/routeTool.ts'), 'utf8');
const js = ts.transpileModule(source, { fileName: 'routeTool.ts', compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText;
const { RouteTool, nearestCity, routeHandles, pointerDistanceKm } =
  await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (error) {
    failures.push(name + ': ' + (error instanceof Error ? error.message : String(error)));
  }
}
const AIRPORTS = [
  { id: 'LIS', x: 30, y: 100, lon: -9.14, lat: 38.72, visible: true },
  { id: 'DKR', x: 130, y: 100, lon: -17.45, lat: 14.69, visible: true },
  { id: 'ACC', x: 230, y: 100, lon: -0.18, lat: 5.56, visible: true },
  { id: 'LON', x: 30, y: 240, lon: -0.12, lat: 51.5, visible: true },
  { id: 'NYC', x: 230, y: 240, lon: -74, lat: 40.7, visible: true },
  { id: 'HIDDEN', x: 80, y: 100, lon: 0, lat: 0, visible: false },
];
const DISTANCES = new Map([
  ['DKR-LIS', 1800], ['ACC-DKR', 1950], ['ACC-LIS', 3788],
  ['LON-NYC', 5570], ['LIS-LON', 1700], ['ACC-NYC', 8100],
]);
function makePort({ selection = 'turboprop', originalSpeed = 2, routes = [] } = {}) {
  const commands = [];
  const previews = [];
  const warnings = [];
  const menus = [];
  const vibrations = [];
  let speed = originalSpeed;
  let undoCalls = 0;
  const ports = {
    cities: () => AIRPORTS,
    routes: () => routes,
    selectedAircraft: () => selection,
    aircraft: (type) => ({ type, rangeKm: type === 'turboprop' ? 2400 : 9000 }),
    distanceKm: (a, b) => DISTANCES.get([a, b].sort().join('-')) ?? NaN,
    cursorGeo: () => null,
    speed: () => speed,
    dispatch: (cmd) => { commands.push(cmd); if (cmd.type === 'SetSpeed') speed = cmd.speed; return true; },
    undo: () => { undoCalls++; },
    preview: (model) => { previews.push(model); },
    warning: (info) => { warnings.push(info); },
    routeAt: () => routes.length ? routes[0].id : null,
    menu: (request) => { menus.push(request); },
    haptics: { snap: () => vibrations.push('snap'), confirm: () => vibrations.push('confirm') },
  };
  return { ports, commands, previews, warnings, menus, vibrations, get speed() { return speed; }, get undoCalls() { return undoCalls; } };
}
const networkCommands = (commands) => commands.filter((cmd) => cmd.type !== 'SetSpeed');

test('snap radius 36dp inclusive; exclude hidden cities', () => {
  assert.equal(nearestCity(AIRPORTS, 66, 100, 36)?.id, 'LIS');
  assert.equal(nearestCity(AIRPORTS, 67, 100, 36), null);
  assert.equal(nearestCity(AIRPORTS, 80, 100, 5), null);
});
test('snap tie uses stable city ID', () => {
  const a = [{ ...AIRPORTS[0], id: 'Z', x: 0 }, { ...AIRPORTS[0], id: 'A', x: 20 }];
  assert.equal(nearestCity(a, 10, 100, 20)?.id, 'A');
});
test('start radius 28dp vs a globe rotation gesture', () => {
  const p = makePort(); const tool = new RouteTool(p.ports);
  assert.equal(tool.pointerDown(1, 59, 100), false);
  assert.equal(tool.pointerDown(1, 58, 100), true);
  tool.pointerCancel(1);
  assert.deepEqual(p.commands.map((c) => c.speed), [0.25, 2]);
});
test('LIS to DKR to ACC is a single AddRoute with deterministic leg kms', () => {
  const p = makePort(); const tool = new RouteTool(p.ports);
  assert.equal(tool.pointerDown(1, 30, 100), true);
  tool.pointerMove(1, 130, 100);
  tool.pointerMove(1, 230, 100);
  assert.equal(tool.pointerUp(1, 230, 100), true);
  assert.deepEqual(networkCommands(p.commands), [{ type: 'AddRoute', aircraft: 'turboprop',
    cityIds: ['LIS', 'DKR', 'ACC'], legDistancesKm: [1800, 1950] }]);
  assert.equal(p.speed, 2);
  assert.deepEqual(p.vibrations, ['snap', 'snap', 'snap', 'confirm']);
});
test('out-of-range LIS to ACC is rejected and warns (not network-committed)', () => {
  const p = makePort(); const tool = new RouteTool(p.ports);
  tool.pointerDown(1, 30, 100);
  tool.pointerMove(1, 230, 100);
  assert.equal(p.warnings.at(-1)?.distanceKm, 3788);
  assert.equal(p.warnings.at(-1)?.aircraft, 'turboprop');
  assert.equal(p.previews.at(-1)?.legDistancesKm[0], 3788);
  assert.equal(tool.pointerUp(1, 230, 100), false);
  assert.deepEqual(networkCommands(p.commands), []);
  assert.equal(p.speed, 2);
});
test('failed direct leg can be replaced with a stopover and re-finished', () => {
  const p = makePort(); const tool = new RouteTool(p.ports);
  tool.pointerDown(1, 30, 100);
  tool.pointerMove(1, 230, 100); // Invalid ACC leg.
  tool.pointerMove(1, 130, 100); // Replace invalid ACC by DKR.
  tool.pointerMove(1, 230, 100); // Add valid DKR -> ACC.
  assert.equal(tool.pointerUp(1, 230, 100), true);
  assert.deepEqual(networkCommands(p.commands)[0].cityIds, ['LIS', 'DKR', 'ACC']);
});
test('release in open space cannot commit even with prior snapped destination', () => {
  const p = makePort(); const tool = new RouteTool(p.ports);
  tool.pointerDown(1, 30, 100);
  tool.pointerMove(1, 130, 100);
  assert.equal(tool.pointerUp(1, 185, 180), false);
  assert.deepEqual(networkCommands(p.commands), []);
});
test('backtracking over the previous city removes the last stop', () => {
  const p = makePort(); const tool = new RouteTool(p.ports);
  tool.pointerDown(1, 30, 100);
  tool.pointerMove(1, 130, 100);
  tool.pointerMove(1, 30, 100);
  assert.equal(tool.pointerUp(1, 30, 100), false);
  assert.deepEqual(networkCommands(p.commands), []);
});
test('widebody long distance LON -> NYC commits', () => {
  const p = makePort({ selection: 'widebody' }); const tool = new RouteTool(p.ports);
  tool.pointerDown(1, 30, 240); tool.pointerMove(1, 230, 240);
  assert.equal(tool.pointerUp(1, 230, 240), true);
  assert.deepEqual(networkCommands(p.commands)[0].legDistancesKm, [5570]);
});
test('48dp endpoint handle is 20dp beyond the city', () => {
  const r = [{ id: 'r', cityIds: ['LIS', 'DKR'], aircraft: 'turboprop' }];
  const handles = routeHandles(r, AIRPORTS);
  assert.equal(handles.length, 2);
  assert.deepEqual(handles.map(({ x }) => x), [10, 150]);
});
test('ExtendRoute from trailing handle preserves existing route and plane type', () => {
  const routes = [{ id: 'r', cityIds: ['LIS', 'DKR'], aircraft: 'turboprop' }];
  const p = makePort({ routes, selection: 'widebody' }); const tool = new RouteTool(p.ports);
  assert.equal(tool.pointerDown(1, 150, 100), true);
  tool.pointerMove(1, 230, 100);
  assert.equal(tool.pointerUp(1, 230, 100), true);
  assert.deepEqual(networkCommands(p.commands)[0], { type: 'ExtendRoute', routeId: 'r', end: 'end',
    aircraft: 'turboprop', cityIds: ['LIS', 'DKR', 'ACC'], legDistancesKm: [1800, 1950] });
});
test('ExtendRoute from leading handle prepends in correct order', () => {
  const routes = [{ id: 'r', cityIds: ['LIS', 'DKR'], aircraft: 'turboprop' }];
  const p = makePort({ routes }); const tool = new RouteTool(p.ports);
  assert.equal(tool.pointerDown(1, 10, 100), true);
  tool.pointerMove(1, 30, 240);
  assert.equal(tool.pointerUp(1, 30, 240), true);
  assert.deepEqual(networkCommands(p.commands)[0].cityIds, ['LON', 'LIS', 'DKR']);
});
test('long press invokes RemoveRoute and ShortenRoute commands, not sim mutations', () => {
  const routes = [{ id: 'r', cityIds: ['LIS', 'DKR', 'ACC'], aircraft: 'turboprop' }];
  const p = makePort({ routes }); const tool = new RouteTool(p.ports);
  assert.equal(tool.longPress(226, 100), true);
  assert.equal(p.menus.at(-1).canShorten, true);
  assert.equal(p.menus.at(-1).end, 'end');
  assert.equal(tool.shortenRoute(), true);
  assert.deepEqual(networkCommands(p.commands)[0], { type: 'ShortenRoute', routeId: 'r', end: 'end' });
  assert.equal(tool.longPress(30, 100), true);
  assert.equal(tool.removeRoute(), true);
  assert.deepEqual(networkCommands(p.commands)[1], { type: 'RemoveRoute', routeId: 'r' });
});
test('undo interrupts drawing, restores speed, then calls sim undo port', () => {
  const p = makePort({ originalSpeed: 4 }); const tool = new RouteTool(p.ports);
  tool.pointerDown(1, 30, 100);
  tool.undo();
  assert.equal(p.speed, 4);
  assert.equal(p.undoCalls, 1);
  assert.equal(tool.drawing, false);
});
test('paused simulation stays paused during editing and afterward', () => {
  const p = makePort({ originalSpeed: 0 }); const tool = new RouteTool(p.ports);
  tool.pointerDown(1, 30, 100);
  assert.equal(p.speed, 0);
  tool.pointerCancel(1);
  assert.equal(p.speed, 0);
});
test('city centre starts a new route even when a handle overlaps its hit target', () => {
  const routes = [{ id: 'r', cityIds: ['LIS', 'DKR'], aircraft: 'turboprop' }];
  const p = makePort({ routes }); const tool = new RouteTool(p.ports);
  assert.equal(tool.pointerDown(1, 30, 100), true);
  tool.pointerMove(1, 30, 240);
  assert.equal(tool.pointerUp(1, 30, 240), true);
  assert.equal(networkCommands(p.commands)[0].type, 'AddRoute');
});
test('pointer geodesic km is symmetric and finite', () => {
  assert.equal(pointerDistanceKm(AIRPORTS[0], AIRPORTS[1]), pointerDistanceKm(AIRPORTS[1], AIRPORTS[0]));
  assert.equal(pointerDistanceKm(AIRPORTS[0], AIRPORTS[0]), 0);
});
for (const failure of failures) console.error('FAIL ' + failure);
console.log(`SUMMARY test:route-tool seed=${SEED} passed=${passed} failed=${failures.length}`);
if (failures.length) process.exitCode = 1;
