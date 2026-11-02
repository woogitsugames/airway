// Deterministic render benchmark of the production world renderer (globe, airports, routes,
// planes, day/night). Plane progress is a fixed visual script, not a simulation.
import { AdaptiveFrameScheduler, type QualityPreference } from './quality';
import { createWorldRenderer, type CityView, type HubLoadView, type RouteView, type ScreenPoint } from './world';
import type { PlaneRenderSnapshot } from './planes';

const CITY_COUNT = 40;
const PLANE_COUNT = 100;
const ROUTE_COUNT = 40;
const SEED = '0xA1A1';
const SPEED = 4;
const HISTORY = 8192;
const TICK_MS = 100;
const PROGRESS_SCALE = 10_000;

export interface PerfSnapshot {
  renderedFrames: number;
  simulatedMinutes: number;
  drawCalls: number;
  triangles: number;
  overlayDomElements: number;
  geometries: number;
  textures: number;
  lastRenderCpuMs: number;
  lastFrameIntervalMs: number;
}

export interface PerfSummary {
  frameCount: number;
  meanRenderCpuMs: number;
  p95RenderCpuMs: number;
  maxRenderCpuMs: number;
  meanFrameIntervalMs: number;
  p95FrameIntervalMs: number;
}

export interface PerfFixture {
  readonly seed: string;
  readonly speed: number;
  readonly counts: { cities: number; planes: number; routes: number };
  readonly preset: string;
  readonly pixelRatio: number;
  read(): PerfSnapshot;
  summarize(): PerfSummary;
  /** Resolves once the real terrain is in the scene. */
  readonly ready: Promise<void>;
  setInteracting(value: boolean): void;
  dispose(): void;
}

function summarizeHistory(buffer: Float32Array, recorded: number): {
  mean: number;
  p95: number;
  max: number;
} {
  const length = Math.min(recorded, HISTORY);
  if (length === 0) return { mean: 0, p95: 0, max: 0 };
  const sorted = new Array<number>(length);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const value = buffer[i];
    sorted[i] = value;
    sum += value;
  }
  sorted.sort((a, b) => a - b);
  return {
    mean: sum / length,
    p95: sorted[Math.ceil(length * 0.95) - 1],
    max: sorted[length - 1],
  };
}

export function mountPerformanceFixture(
  host: HTMLElement,
  preference: QualityPreference = 'medium',
): PerfFixture {
  const world = createWorldRenderer(undefined, {
    quality: preference, autoResize: host, maxAirports: CITY_COUNT, maxPlanes: PLANE_COUNT,
    camera: { longitude: 10, latitude: 30 },
  });
  world.canvas.style.cssText = 'display:block;width:100%;height:100%';
  host.appendChild(world.canvas);

  const cities: CityView[] = [];
  for (let i = 0; i < CITY_COUNT; i++) {
    // A fixed spatial lattice around Europe/Africa; no randomness.
    cities.push({ id: 'C' + i, lon: ((i * 37) % 120) - 40, lat: ((i * 23) % 100) - 40, hub: i % 5 === 0 });
  }
  world.setCities(cities);
  const routes: RouteView[] = [];
  for (let r = 0; r < ROUTE_COUNT; r++) {
    routes.push({ id: 'R' + r, aircraft: r % 2 ? 'turboprop' : 'widebody',
      cityIds: ['C' + r, 'C' + ((r + 7 + r % 4) % CITY_COUNT)] });
  }
  world.setRoutes(routes, 1);
  const loads: HubLoadView[] = [];
  for (let i = 0; i < CITY_COUNT; i += 5) loads.push({ id: 'C' + i, used: (i * 7) % 13, cap: 12 });
  world.setHubLoad(loads);
  world.setCurfew(['C3', 'C17']);

  // Two preallocated snapshot buffers, swapped on every visual tick.
  type MutableSnapshot = { -readonly [K in keyof PlaneRenderSnapshot]: PlaneRenderSnapshot[K] };
  const makeBuffer = (): MutableSnapshot[] => {
    const list: MutableSnapshot[] = [];
    for (let p = 0; p < PLANE_COUNT; p++) {
      list.push({ id: 'P' + p, routeId: 'R' + (p % ROUTE_COUNT), segment: 0, progress01: 0,
        direction: 1, load: (p * 11) % 48, capacity: 48 });
    }
    return list;
  };
  let previous = makeBuffer();
  let current = makeBuffer();
  const fill = (buffer: MutableSnapshot[], tick: number): void => {
    for (let p = 0; p < PLANE_COUNT; p++) {
      buffer[p].progress01 = (tick * 25 + p * 997) % PROGRESS_SCALE;
    }
  };

  const overlay = document.createElement('div');
  overlay.dataset.perfOverlay = 'true';
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
  const tags: HTMLSpanElement[] = [];
  for (let i = 0; i < CITY_COUNT; i++) {
    const tag = document.createElement('span');
    tag.dataset.perfOverlayItem = 'true';
    tag.textContent = String(i + 1);
    tag.style.cssText =
      'position:absolute;padding:1px 3px;background:#FBF8F1;color:#13302E;' +
      'font:11px monospace;display:none;white-space:nowrap;will-change:transform';
    overlay.appendChild(tag);
    tags.push(tag);
  }
  host.appendChild(overlay);
  const projected: ScreenPoint = { x: 0, y: 0, visible: false };

  const cpuHistory = new Float32Array(HISTORY);
  const intervalHistory = new Float32Array(HISTORY);
  let frameCount = 0;
  let elapsedSimulationMs = 0;
  let tick = 0;
  let lastRenderCpuMs = 0;
  let lastFrameIntervalMs = 0;
  let interacting = false;
  fill(previous, 0);
  fill(current, 1);
  world.setPlanes(previous, current);

  const paint = (_timestamp: number, elapsedMs: number): void => {
    elapsedSimulationMs += elapsedMs * SPEED;
    const targetTick = Math.floor(elapsedSimulationMs / TICK_MS);
    if (targetTick !== tick) {
      tick = targetTick;
      const swap = previous;
      previous = current;
      current = swap;
      fill(current, tick + 1);
      world.setPlanes(previous, current);
    }
    const alpha = (elapsedSimulationMs - tick * TICK_MS) / TICK_MS;
    // Interaction phase: a slow orbit, so overlays are re-projected every frame.
    if (interacting) world.orbit.rotatePixels(0.6, 0, elapsedMs);
    world.setTime(tick % 1_000_000, Math.min(1, Math.max(0, alpha)));
    const start = performance.now();
    world.render(alpha, elapsedMs / 1000);
    for (let i = 0; i < CITY_COUNT; i++) {
      world.project(cities[i].lon, cities[i].lat, 1.05, projected);
      const tag = tags[i];
      if (!projected.visible) {
        if (tag.style.display !== 'none') tag.style.display = 'none';
        continue;
      }
      if (tag.style.display !== 'block') tag.style.display = 'block';
      tag.style.transform = 'translate(' + Math.round(projected.x) + 'px,' + Math.round(projected.y) + 'px)';
    }
    lastRenderCpuMs = performance.now() - start;
    lastFrameIntervalMs = elapsedMs;
    const index = frameCount % HISTORY;
    cpuHistory[index] = lastRenderCpuMs;
    intervalHistory[index] = elapsedMs;
    frameCount++;
  };

  const scheduler = new AdaptiveFrameScheduler(host, paint);

  return {
    seed: SEED,
    speed: SPEED,
    counts: { cities: CITY_COUNT, planes: PLANE_COUNT, routes: ROUTE_COUNT },
    preset: world.quality.preset,
    pixelRatio: world.quality.pixelRatio,
    read: (): PerfSnapshot => {
      const stats = world.stats();
      return {
        renderedFrames: frameCount,
        simulatedMinutes: elapsedSimulationMs / 60000,
        drawCalls: stats.drawCalls,
        triangles: stats.triangles,
        overlayDomElements: overlay.childElementCount,
        geometries: stats.geometries,
        textures: stats.textures,
        lastRenderCpuMs,
        lastFrameIntervalMs,
      };
    },
    summarize: (): PerfSummary => {
      const cpu = summarizeHistory(cpuHistory, frameCount);
      const interval = summarizeHistory(intervalHistory, frameCount);
      return {
        frameCount,
        meanRenderCpuMs: cpu.mean,
        p95RenderCpuMs: cpu.p95,
        maxRenderCpuMs: cpu.max,
        meanFrameIntervalMs: interval.mean,
        p95FrameIntervalMs: interval.p95,
      };
    },
    ready: world.ready,
    setInteracting: (value: boolean): void => {
      interacting = value;
      scheduler.setInteracting(value);
    },
    dispose: (): void => {
      scheduler.dispose();
      overlay.remove();
      world.dispose();
    },
  };
}
