// [night-12be] DEV/QA only: the `World` of src/game/world.ts without WebGL (`?render=stub` in a Vite dev build).
// Since the satellite globe, SwiftShader draws the real globe at ~10 fps (G7), so browser journeys through the real
// session time out. This stub keeps everything the session reads from the world real except the drawing: the same
// GlobeOrbitCamera on a three.js PerspectiveCamera (no renderer, no context), the same project/pickGlobe maths as
// src/render/world.ts (so gesture hit tests, route drags and the airport tags land where the game puts them), the
// same requestAnimationFrame clock feeding the session's frame hook. A plain 2D canvas shows airports and routes as
// dots and lines for failure screenshots. main.ts loads this module only behind `import.meta.env.DEV`, so release
// bundles never contain it (`test:bundle` looks for STUB_WORLD_MARK in dist/).
import { PerspectiveCamera, Vector3 } from 'three';
import { GlobeOrbitCamera, STAMP_SIZE_PX, type AirportScreenBox, type CityView, type QualityPreference, type RouteView, type SafeAreaInsets, type ScreenPoint, type WorldRenderer } from '../../render';
import { pickSphereNdc, setLatLonVec3 } from '../../render/globe/geo-math';
import type { FrameState, World } from '../world';

/** Literal the bundle guard searches for: never present in a release build. */
export const STUB_WORLD_MARK = 'airway-stub-world';

export interface StubWorldProbe {
  /** Frames the stub loop has run (each one calls the session's frame hook). */
  readonly frames: number;
  readonly cities: number;
  readonly routes: number;
  readonly planes: number;
  readonly curfew: readonly string[];
  /** Page coordinates (CSS px) of an airport as the session's hit test sees it, or null when it is not drawn. */
  airportPoint(id: string): { x: number; y: number; visible: boolean } | null;
}

export interface StubWorldOptions {
  /**
   * `?clock=frozen`: every frame reaches the session's frame hook with dt = 0, so game time passes only through
   * window.aw (advanceTicks, autoplay, botStep) and a journey replays exactly, whatever the machine's frame rate.
   */
  readonly frozenClock?: boolean;
}

export function createStubWorld(host: HTMLElement, label: string, options: StubWorldOptions = {}): World {
  const canvas = document.createElement('canvas');
  canvas.className = 'airway-world';
  canvas.dataset.render = STUB_WORLD_MARK;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  // The real canvas is sized by the renderer; here CSS fills the host like `.airway-world` does in the game.
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;background:#cfe3ea';
  host.prepend(canvas);

  const camera = new PerspectiveCamera(30, 1, 0.05, 30);
  const orbit = new GlobeOrbitCamera(camera, { longitude: -18, latitude: 40, zoom: 2 });
  const scratch = new Vector3();
  const toCamera = new Vector3();
  let insets: SafeAreaInsets = {};
  let disposed = false;
  let cities: readonly CityView[] = [];
  let routes: readonly RouteView[] = [];
  let planes = 0;
  let curfew: readonly string[] = [];
  let frames = 0;
  let spin = 0;
  let frameCallback: ((dt: number) => FrameState | void) | null = null;

  const resize = (): void => {
    const w = Math.max(1, Math.round(host.clientWidth || window.innerWidth));
    const h = Math.max(1, Math.round(host.clientHeight || window.innerHeight));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    orbit.setViewport(w, h, insets);
    camera.updateMatrixWorld();
  };
  resize();
  window.addEventListener('resize', resize);

  // Same maths as src/render/world.ts `project` / `pickGlobe`.
  function project(lon: number, lat: number, altitude: number, out: ScreenPoint): ScreenPoint {
    setLatLonVec3(scratch, lon, lat, altitude);
    toCamera.copy(camera.position).sub(scratch);
    const facing = toCamera.dot(scratch) > 0;
    scratch.project(camera);
    out.x = (scratch.x + 1) / 2 * orbit.viewportWidth;
    out.y = (1 - scratch.y) / 2 * orbit.viewportHeight;
    out.visible = facing && scratch.z >= -1 && scratch.z <= 1;
    return out;
  }
  function pickGlobe(x: number, y: number): { lon: number; lat: number } | null {
    camera.updateMatrixWorld();
    return pickSphereNdc(x / orbit.viewportWidth * 2 - 1, 1 - y / orbit.viewportHeight * 2, camera);
  }

  const point: ScreenPoint = { x: 0, y: 0, visible: false };
  const context = canvas.getContext('2d');
  function draw(): void {
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const disc = orbit.getScreenDisc();
    if (disc) {
      context.fillStyle = '#9cc3a4';
      context.beginPath();
      context.arc(disc.x, disc.y, disc.radius, 0, Math.PI * 2);
      context.fill();
    }
    const at = new Map<string, { x: number; y: number; visible: boolean }>();
    for (const city of cities) {
      project(city.lon, city.lat, 1.01, point);
      at.set(city.id, { x: point.x, y: point.y, visible: point.visible });
    }
    context.strokeStyle = '#1d3b53';
    context.lineWidth = 2;
    for (const route of routes) {
      context.beginPath();
      route.cityIds.forEach((id, i) => {
        const p = at.get(id);
        if (!p) return;
        if (i === 0) context.moveTo(p.x, p.y); else context.lineTo(p.x, p.y);
      });
      context.stroke();
    }
    for (const city of cities) {
      const p = at.get(city.id);
      if (!p?.visible) continue;
      context.fillStyle = curfew.includes(city.id) ? '#b3261e' : '#1d3b53';
      context.beginPath();
      context.arc(p.x, p.y, city.hub ? 7 : 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  let last = performance.now();
  let raf = 0;
  const loop = (now: number): void => {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (spin) {
      const state = orbit.getState();
      orbit.setTarget(state.longitude + spin * dt, state.latitude);
    }
    orbit.update(dt);
    camera.updateMatrixWorld();
    frameCallback?.(options.frozenClock ? 0 : dt);
    frames++;
    draw();
  };
  raf = requestAnimationFrame(loop);

  // Only what the composition root and the session read from the renderer; nothing here draws a model.
  const renderer = {
    canvas, camera, orbit, ready: Promise.resolve(),
    quality: { preset: 'low', pixelRatio: 1, shadowEnabled: false, shadowMapSize: 0, decorDensity: 0 },
    project, pickGlobe,
    // [ext-04 E2] Spec §8: the stamp box through the same projection; half = STAMP_SIZE_PX / 2.
    projectAirport(id: string, out: AirportScreenBox): AirportScreenBox {
      const city = cities.find((item) => item.id === id);
      if (!city) { out.visible = false; out.half = 0; return out; }
      project(city.lon, city.lat, 1.01, out);
      out.half = (city.hub ? STAMP_SIZE_PX.hub : STAMP_SIZE_PX.airport) / 2;
      return out;
    },
    drawModelPreview: () => false,
    stats: () => ({ adaptations: [] as string[], curfewAirports: curfew.length }),
    contextLost: () => false,
    onContextChange: () => () => undefined,
  } as unknown as WorldRenderer;

  const probe = {
    get frames() { return frames; },
    get cities() { return cities.length; },
    get routes() { return routes.length; },
    get planes() { return planes; },
    get curfew() { return curfew; },
    airportPoint(id: string) {
      const city = cities.find((item) => item.id === id);
      if (!city) return null;
      const out: ScreenPoint = { x: 0, y: 0, visible: false };
      project(city.lon, city.lat, 1.01, out);
      const box = canvas.getBoundingClientRect();
      return { x: out.x + box.left, y: out.y + box.top, visible: out.visible };
    },
  } satisfies StubWorldProbe;
  (window as unknown as { __awStub?: StubWorldProbe }).__awStub = probe;

  return {
    renderer, canvas, camera, orbit, ready: Promise.resolve(),
    setInsets(next) { insets = next; resize(); },
    setIdleSpin(degreesPerSecond) { spin = degreesPerSecond; },
    showMenuBackdrop() { insets = {}; spin = 0; orbit.setTarget(-16, 40); orbit.setZoom(1); resize(); },
    setCities(next) { cities = next.map((city) => ({ ...city })); },
    setHubLoad() { /* rings are drawn by the real renderer only */ },
    setCurfew(closedIds) { curfew = [...closedIds]; },
    curfewDrawn: () => curfew.length,
    setRoutes(next) { routes = next.map((route) => ({ ...route, cityIds: [...route.cityIds] })); },
    setPlanes(_previous, current) { planes = current.length; },
    preview() { /* the route ghost is a render layer */ },
    project: (lon, lat, out) => project(lon, lat, 1.01, out),
    pickGlobe,
    setQuality(_preference: QualityPreference) { /* no quality tiers without a renderer */ },
    setGlobeMode() { /* no textures */ },
    reset() { cities = []; routes = []; planes = 0; curfew = []; },
    setCovered() { /* the stub always draws its cheap 2D frame */ },
    contextLost: () => false,
    onFrame(callback) { frameCallback = callback; last = performance.now(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.remove();
    },
  };
}
