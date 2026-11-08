// [night-11g] R1h, D-88: "Reduce motion" (src/ui/motion.ts). The game follows the system until the player chooses;
// the choice wins both ways, is saved beside the other settings, marks the document root, follows later system
// changes only while there is no choice, stills the menu globe turn, and no stylesheet or module outside motion.ts
// reads `prefers-reduced-motion` itself (otherwise an explicit "off" could not bring a flap or stamp back).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Fake browser: a localStorage map and a controllable `prefers-reduced-motion` query.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, String(value)); },
  removeItem: (key: string) => { store.delete(key); },
};
let systemReduce = false;
const mediaListeners = new Set<() => void>();
(globalThis as Record<string, unknown>).matchMedia = (query: string) => ({
  get matches() { return query === '(prefers-reduced-motion: reduce)' && systemReduce; },
  media: query,
  addEventListener: (_type: string, listener: () => void) => { mediaListeners.add(listener); },
  removeEventListener: (_type: string, listener: () => void) => { mediaListeners.delete(listener); },
});
function setSystem(reduce: boolean): void {
  systemReduce = reduce;
  for (const listener of mediaListeners) listener();
}
const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;

type Motion = typeof import('../src/ui/motion.ts');
let motion: Motion | null = null;
async function load(): Promise<Motion> {
  motion ??= await import('../src/ui/motion.ts');
  return motion;
}
async function fresh(): Promise<Motion> {
  const m = await load();
  store.clear();
  m.resetMotionCache();
  return m;
}

await test('without a choice the game follows the system', async () => {
  const m = await fresh();
  setSystem(false);
  assert.equal(m.storedReducedMotion(), null);
  assert.equal(m.reducedMotion(), false);
  setSystem(true);
  assert.equal(m.reducedMotion(), true);
  m.applyMotion(root);
  assert.equal(root.dataset.airwayMotion, 'reduce');
});

await test('an explicit choice wins over the system, both ways', async () => {
  const m = await fresh();
  setSystem(true);
  m.setReducedMotion(false, root);
  assert.equal(m.reducedMotion(), false, 'off on a reduce-motion system');
  assert.equal(root.dataset.airwayMotion, 'full');
  setSystem(false);
  m.setReducedMotion(true, root);
  assert.equal(m.reducedMotion(), true, 'on on a full-motion system');
  assert.equal(root.dataset.airwayMotion, 'reduce');
});

await test('the choice is saved beside the other settings and survives a reload', async () => {
  const m = await fresh();
  store.set('airway.settings', JSON.stringify({ language: 'pl', textScale: 115, sound: false }));
  m.setReducedMotion(true);
  const saved = JSON.parse(store.get('airway.settings') ?? '{}') as Record<string, unknown>;
  assert.deepEqual(saved, { language: 'pl', textScale: 115, sound: false, reduceMotion: true });
  m.resetMotionCache();
  setSystem(false);
  assert.equal(m.reducedMotion(), true, 'read back from storage');
  m.setReducedMotion(null);
  assert.equal('reduceMotion' in (JSON.parse(store.get('airway.settings') ?? '{}') as object), false, 'null forgets it');
  store.set('airway.settings', '{not json');
  m.resetMotionCache();
  assert.equal(m.storedReducedMotion(), null, 'corrupt storage = no choice');
});

await test('later system changes apply only while there is no choice', async () => {
  const m = await fresh();
  setSystem(false);
  const seen: boolean[] = [];
  const stop = m.initializeMotion(root);
  const off = m.onReducedMotionChange((reduce) => seen.push(reduce));
  setSystem(true);
  assert.equal(root.dataset.airwayMotion, 'reduce');
  m.setReducedMotion(false, root);
  setSystem(false);
  setSystem(true);
  assert.equal(root.dataset.airwayMotion, 'full', 'explicit off stays off');
  assert.deepEqual(seen, [true, false]);
  off();
  stop();
  assert.equal(mediaListeners.size, 0, 'listener removed');
});

await test('the menu globe stands still with reduced motion', async () => {
  const m = await fresh();
  const { menuSpinRate, MENU_SPIN_DEG_PER_S } = await import('../src/render/framing.ts');
  setSystem(false);
  const spin = () => menuSpinRate({ menuActive: true, menuShown: true, reducedMotion: m.reducedMotion() });
  assert.equal(spin(), MENU_SPIN_DEG_PER_S);
  m.setReducedMotion(true);
  assert.equal(spin(), 0);
});

// [ext-04] D-88 in the Linoryt print: a new route is drawn on in 200 ms only with motion; reduced motion shows it at
// once (the ribbon reads the root attribute motion.ts sets); the jam arc steps per game second.
await test('reduced motion: a new route appears at once, no draw-on', async () => {
  const m = await fresh();
  (globalThis as Record<string, unknown>).document = { documentElement: root };
  const { LinorytRouteLayer } = await import('../src/render/linoryt-objects.ts');
  const { Color } = await import('three');
  const shared = { uViewport: { value: { x: 412, y: 915 } }, uDpr: { value: 1 }, uTime: { value: 0 }, uPxPerRad: { value: 200 },
    uPaper: { value: new Color() }, uInk: { value: new Color() }, uRed: { value: new Color() } };
  const first = { id: 'A', type: 'turboprop' as const, waypoints: [{ lon: 0, lat: 50 }, { lon: 10, lat: 52 }] };
  const second = { id: 'B', type: 'widebody' as const, waypoints: [{ lon: 0, lat: 50 }, { lon: -40, lat: 45 }] };
  const bornOf = (layer: InstanceType<typeof LinorytRouteLayer>): number[] => {
    const mesh = layer.group.children[0] as unknown as { geometry: { getAttribute(n: string): { array: Float32Array } } };
    const track = mesh.geometry.getAttribute('aTrack').array;
    return [track[1], track[track.length - 2]]; // first vertex (route A) and last vertex (route B)
  };
  setSystem(false);
  m.setReducedMotion(false);
  m.applyMotion(root);
  const animated = new LinorytRouteLayer(shared);
  animated.setRoutes([first], 1);
  animated.setRoutes([first, second], 2);
  const [oldBorn, newBorn] = bornOf(animated);
  assert.ok(oldBorn < -1e5 && newBorn > 0, `with motion the new route is born now (${oldBorn}, ${newBorn})`);
  m.setReducedMotion(true);
  m.applyMotion(root);
  const still = new LinorytRouteLayer(shared);
  still.setRoutes([first], 1);
  still.setRoutes([first, second], 2);
  assert.ok(bornOf(still).every((born) => born < -1e5), 'with reduced motion every route is shown whole at once');
  animated.dispose(); still.dispose();
});

await test('reduced motion: the jam arc steps once per game second', async () => {
  const { jamArcShare } = await import('../src/render/globe/linoryt.ts');
  const grace = 450, tps = 10;
  assert.equal(jamArcShare(null, grace, tps, true), null);
  assert.equal(jamArcShare(421, grace, tps, false), 421 / 450);
  assert.equal(jamArcShare(421, grace, tps, true), 430 / 450);
  assert.equal(jamArcShare(430, grace, tps, true), 430 / 450);
  const shares = new Set<number>();
  for (let ticks = 420; ticks > 410; ticks--) shares.add(jamArcShare(ticks, grace, tps, true) as number);
  assert.equal(shares.size, 1, 'ten ticks inside one second draw one arc');
  const session = readFileSync(resolve(ROOT, 'src/game/session.ts'), 'utf8');
  assert.match(session, /jamArcShare\(city\.jamTicksLeft, CONGESTION_GRACE_TICKS, SIM_TICKS_PER_SECOND, reducedMotion\(\)\)/);
});

await test('nothing in the print pulses: stamps, jam zone and planes read no clock', () => {
  const src = readFileSync(resolve(ROOT, 'src/render/linoryt-objects.ts'), 'utf8');
  for (const name of ['STAMP_VERTEX', 'STAMP_FRAGMENT', 'JAM_VERTEX', 'JAM_FRAGMENT', 'PLANE_VERTEX', 'PLANE_FRAGMENT']) {
    const start = src.indexOf(`const ${name} =`);
    const body = src.slice(start, src.indexOf('}`;', start));
    assert.ok(start >= 0 && !/uTime|sin\(|cos\(uTime/.test(body), `${name} has no time-driven motion`);
  }
});

function files(folder: string, out: string[] = []): string[] {
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    const path = resolve(folder, item.name);
    if (item.isDirectory()) files(path, out);
    else if (['.ts', '.css'].includes(extname(path))) out.push(path);
  }
  return out;
}
const sources = files(resolve(ROOT, 'src'));

await test('only motion.ts reads prefers-reduced-motion', () => {
  const readers = sources.filter((path) => readFileSync(path, 'utf8').includes('prefers-reduced-motion'))
    .map((path) => relative(ROOT, path).replaceAll('\\', '/'));
  assert.deepEqual(readers, ['src/ui/motion.ts']);
});

await test('every stylesheet with a keyframe animation stills it under the root attribute', () => {
  const missing = sources.filter((path) => path.endsWith('.css'))
    .filter((path) => { const css = readFileSync(path, 'utf8'); return css.includes('@keyframes') && !css.includes('[data-airway-motion="reduce"]'); })
    .map((path) => relative(ROOT, path));
  assert.deepEqual(missing, []);
});

await test('main.ts and the dev world page initialise the motion attribute', () => {
  for (const file of ['src/main.ts', 'dev/world.ts']) {
    assert.match(readFileSync(resolve(ROOT, file), 'utf8'), /^initializeMotion\(/m, file);
  }
});

console.log(`SUMMARY test:motion seed=0xA1A1 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
