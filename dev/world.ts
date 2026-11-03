// [render] Full world-renderer laboratory: globe, airports, hub rings, curfew barriers,
// routes, interpolated planes, day/night and the HTML airport overlay, composed exactly
// as the game does through createWorldRenderer(). Scene content mirrors the Diorama mockup.
import '../src/ui/fonts.css';
import '../src/ui/theme/theme.css';
import { CITIES } from '../src/data/cities';
import { createWorldRenderer, AdaptiveFrameScheduler, type PlaneView, type RouteView } from '../src/render';
import { createAirportOverlay } from '../src/ui/overlay';
import type { DestinationRegion } from '../src/ui/glyphs';

declare global {
  interface Window {
    __ready?: boolean;
    __worldMetrics?: { fps: number; drawCalls: number; triangles: number; frameMs: number };
  }
}

const params = new URLSearchParams(location.search);
const host = document.getElementById('root') as HTMLElement;
const stats = document.getElementById('stats') as HTMLElement;
if (params.has('clean')) document.body.classList.add('clean');

const HUBS: Record<string, { cap: number; waiting: DestinationRegion[]; jam?: number }> = {
  LON: { cap: 12, waiting: ['NAM', 'NAM', 'EUS', 'NAM', 'ME', 'EUN', 'NAM', 'AFR', 'SAM', 'NAM', 'EUS'], jam: 42 },
  LIS: { cap: 8, waiting: ['SAM', 'AFR', 'EUN'] },
  IST: { cap: 8, waiting: ['EUN', 'ME', 'EUN', 'EUN', 'AFR'] },
};
const WAITING: Record<string, DestinationRegion[]> = {
  WAW: ['EUS', 'NAM'], NYC: ['EUN', 'EUN', 'ME'], REK: [], OSL: ['NAM'], CAI: ['EUN', 'EUN'],
  DKR: ['SAM'], CMN: ['EUN'], MAD: ['NAM', 'AFR'], KIV: ['ME'], REC: ['EUN'], ROM: ['NAM', 'ME', 'EUN'],
  LOS: ['EUN', 'NAM'], ACC: [],
};
const ROUTES: RouteView[] = [
  { id: 'r1', aircraft: 'widebody', cityIds: ['LON', 'NYC'] },
  { id: 'r2', aircraft: 'widebody', cityIds: ['LIS', 'REC'] },
  { id: 'r3', aircraft: 'turboprop', cityIds: ['LON', 'WAW', 'IST', 'CAI'] },
  { id: 'r4', aircraft: 'turboprop', cityIds: ['LIS', 'LON', 'OSL'] },
  { id: 'r5', aircraft: 'turboprop', cityIds: ['LON', 'REK'] },
  { id: 'r6', aircraft: 'turboprop', cityIds: ['IST', 'KIV'] },
  { id: 'r7', aircraft: 'turboprop', cityIds: ['MAD', 'LIS', 'CMN', 'DKR'] },
];
const codes = [...Object.keys(HUBS), ...Object.keys(WAITING)];
const cities = codes.map((code) => {
  const city = CITIES.find((entry) => entry.code === code);
  if (!city) throw new Error('Unknown city ' + code);
  return { id: code, code, lon: city.lon, lat: city.lat, hub: code in HUBS };
});

const world = createWorldRenderer(undefined, {
  quality: (params.get('quality') as 'low' | 'medium' | 'high' | null) ?? 'medium',
  autoResize: host,
  // HUD reservations: boarding pass on top and tag dock below (portrait) or at the side (landscape).
  insets: () => (host.clientWidth > host.clientHeight ? { top: 64, right: 96 } : { top: 96, bottom: 96 }),
  camera: { longitude: 7, latitude: 35, zoom: Number(params.get('zoom')) || 3.3 },
});
host.appendChild(world.canvas);
(window as unknown as { __world: unknown }).__world = world; // probes (perf, LOD tests)
world.setCities(cities);
world.setRoutes(ROUTES, 1);
world.setHubLoad(Object.entries(HUBS).map(([id, hub]) => ({ id, used: hub.waiting.length, cap: hub.cap })));
world.setCurfew(['CAI', 'KIV']);
world.setRoutePreview({
  points: [cities.find((c) => c.id === 'LIS')!, { lon: -0.2, lat: 5.6 }],
  legDistancesKm: [3788], rangeKm: 2500, aircraft: 'turboprop',
});
const overlay = createAirportOverlay(host, world.camera, { reservedTop: 96, reservedBottom: 96 });
for (const city of cities) {
  overlay.addAirport(city);
  overlay.setPassengers(city.id, HUBS[city.id]?.waiting ?? WAITING[city.id] ?? []);
}
overlay.setJamCountdown('LON', HUBS.LON.jam ?? null);

// Scripted visual planes (not a simulation): one per route leg, ping-ponging.
const SCALE = 10_000;
const planeIds = ROUTES.flatMap((route, r) => route.cityIds.slice(1).map((_, leg) => ({ r, leg })));
const makePlanes = (): Array<{ -readonly [K in keyof PlaneView]: PlaneView[K] }> => planeIds.map(({ r, leg }, i) => ({
  id: 'p' + i, routeId: ROUTES[r].id, segment: leg, progress01: 0, direction: 1, load: (i * 37) % 48, capacity: 48,
}));
let previous = makePlanes();
let current = makePlanes();
const place = (list: typeof current, tick: number): void => {
  for (let i = 0; i < list.length; i++) list[i].progress01 = (tick * 40 + i * 2731) % SCALE;
};
// Frozen moment of the mockup: UTC ~16:10 (tick 970 of the day).
const frozen = params.has('frozen');
let tick = 970;
place(previous, tick);
place(current, tick + 1);
world.setPlanes(previous, current);
let accumulator = 0;
let frames = 0;
let cpu = 0;
let since = performance.now();
world.setTime(tick, 0);
new AdaptiveFrameScheduler(host, (now, elapsedMs) => {
  if (!frozen) {
    accumulator += elapsedMs;
    while (accumulator >= 100) {
      accumulator -= 100;
      tick++;
      const swap = previous; previous = current; current = swap;
      place(current, tick + 1);
      world.setPlanes(previous, current);
    }
  }
  const alpha = frozen ? 0.5 : accumulator / 100;
  world.setTime(tick, alpha);
  const begin = performance.now();
  world.render(alpha, elapsedMs / 1000);
  overlay.update();
  cpu += performance.now() - begin;
  frames++;
  if (now - since >= 500) {
    const info = world.stats();
    window.__worldMetrics = { fps: Math.round(frames * 1000 / (now - since)), drawCalls: info.drawCalls,
      triangles: info.triangles, frameMs: Math.round(cpu / frames * 100) / 100 };
    stats.textContent = `preset ${world.quality.preset} dpr ${world.quality.pixelRatio}\n` +
      `fps ${window.__worldMetrics.fps} calls ${info.drawCalls} tris ${info.triangles}\n` +
      `cpu ${window.__worldMetrics.frameMs} ms planes ${info.planes} routes ${info.routes}`;
    frames = 0; cpu = 0; since = now;
  }
});
world.ready.then(() => {
  // Two frames after the terrain arrives so shadows/overlay settle before a screenshot.
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
}, (error: unknown) => { stats.textContent = String(error); });
