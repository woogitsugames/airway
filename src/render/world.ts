/**
 * The single world-renderer composition: one WebGLRenderer, one scene, one light rig,
 * one quality profile and one orbit camera shared by globe, airports, routes, planes,
 * route preview and model previews. Consumes plain read-only view objects; never
 * imports simulation internals and never writes authoritative state.
 *
 * Screen coordinates (`pick`, `project`, `resize`) are CSS pixels relative to the
 * canvas' top-left corner, matching `GlobeOrbitCamera` and the gesture recognizer.
 */
import { Color, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { createAirports, type AirportsLayer } from './airports';
import { GlobeOrbitCamera, type OrbitCameraOptions, type SafeAreaInsets } from './camera';
import { createGlobe, createSunLights, type GlobeInstance } from './globe';
import { pickSphereNdc, setLatLonVec3, type LonLat } from './globe/geo-math';
import { createModelPreviewRenderer, type ModelPreviewRenderer } from './modelPreview';
import { PlaneLayer, type PlaneRenderSnapshot } from './planes';
import {
  applyQualityProfile, resolveQualityProfile, type QualityPreference, type QualityProfile,
} from './quality';
import { createRoutePreview, type RoutePreviewView } from './routePreview';
import { RouteLayer, type AircraftKind, type GeoWaypoint, type RouteRenderSpec } from './routes';
import { createSunController, type SunController } from './sun';
import { measureLayerContrast, sampleLuminance, type LayerContrast, type PixelRect } from './contrast';
import type { UpgradeKind } from '../sim/upgrades';

export const DIORAMA_SKY = '#8CC3D8';
/** Airport tap radius in CSS px (dp); matches the route tool's start radius. */
export const CITY_PICK_RADIUS_DP = 28;

export interface CityView {
  readonly id: string;
  readonly lon: number;
  readonly lat: number;
  readonly hub?: boolean;
}
export interface HubLoadView {
  readonly id: string;
  readonly used: number;
  readonly cap: number;
}
export interface RouteView {
  readonly id: string;
  readonly aircraft: AircraftKind;
  readonly cityIds: readonly string[];
}
export type PlaneView = PlaneRenderSnapshot;
export type { RoutePreviewView } from './routePreview';

/** Writable projection result; pass the same object every frame. */
export interface ScreenPoint {
  x: number;
  y: number;
  /** On the camera-facing hemisphere and inside the view frustum depth range. */
  visible: boolean;
}
export type PickResult =
  | { readonly kind: 'city'; readonly id: string; readonly lon: number; readonly lat: number }
  | { readonly kind: 'globe'; readonly lon: number; readonly lat: number };

export interface WorldStats {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly planes: number;
  readonly routes: number;
  readonly airports: number;
}

export interface WorldRendererOptions {
  /** Device tier preference; persistence is owned by the settings screen. */
  readonly quality?: QualityPreference;
  /** Decorative (non-simulation) seed for trees, rocks, clouds and lights. */
  readonly seed?: number;
  readonly landUrl?: string;
  readonly camera?: OrbitCameraOptions;
  readonly maxAirports?: number;
  readonly maxHubSeats?: number;
  readonly maxPlanes?: number;
  /** Fixed-point scale of `PlaneView.progress01` (task 09 uses 10,000). */
  readonly progressScale?: number;
  /** Observe this element and resize automatically (insets from `insets()`). */
  readonly autoResize?: HTMLElement;
  readonly insets?: () => SafeAreaInsets;
}

export interface WorldRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly scene: Scene;
  /** The three.js camera, e.g. for `createAirportOverlay(host, camera)`. */
  readonly camera: PerspectiveCamera;
  /** Orbit/zoom/limb API for the input layer (`cameraGestureCallbacks`). */
  readonly orbit: GlobeOrbitCamera;
  readonly quality: QualityProfile;
  /** Resolves when the land mask, terrain and decorations are in the scene. */
  readonly ready: Promise<void>;
  setSun(lon: number, lat: number): void;
  /** Day/night from the authoritative tick plus render interpolation fraction. */
  setTime(tick: number, fraction?: number): void;
  setCities(cities: readonly CityView[]): void;
  setHubLoad(loads: readonly HubLoadView[]): void;
  /** Complete set of airports whose curfew barrier is closed. */
  setCurfew(closedIds: readonly string[]): void;
  /** Rebuilds route tubes only when `revision` changes (or is omitted). */
  setRoutes(routes: readonly RouteView[], revision?: number | string): void;
  setRoutePreview(model: RoutePreviewView | null): void;
  /** Call on each tick boundary with the previous and current plane views. */
  setPlanes(previous: readonly PlaneView[], current: readonly PlaneView[]): void;
  /** Draw one frame. `alpha` is the [0,1] tick accumulator fraction; `dtSeconds` drives camera inertia. */
  render(alpha: number, dtSeconds: number): void;
  pick(x: number, y: number): PickResult | null;
  pickGlobe(x: number, y: number): LonLat | null;
  project(lon: number, lat: number, altitude: number, out: ScreenPoint): ScreenPoint;
  resize(width: number, height: number, insets?: SafeAreaInsets): void;
  setQuality(preference: QualityPreference): Promise<void>;
  /** Paint an upgrade-card model into a 2D canvas through the shared WebGL context. */
  drawModelPreview(kind: UpgradeKind, target: HTMLCanvasElement): boolean;
  stats(): WorldStats;
  /** [task-34] Diagnostic: median WCAG contrast of routes/airports/planes against the globe behind them. */
  measureLayerContrast(): Record<string, LayerContrast | null>;
  /** [task-34] Diagnostic: median relative luminance of the rendered frame inside CSS-pixel rects. */
  sampleLuminance(rects: readonly PixelRect[]): (number | null)[];
  dispose(): void;
}

export function createWorldRenderer(
  canvas?: HTMLCanvasElement, opts: WorldRendererOptions = {},
): WorldRenderer {
  let quality = resolveQualityProfile(opts.quality ?? 'auto');
  const renderer = new WebGLRenderer({
    canvas, antialias: quality.antialias, alpha: false, powerPreference: 'high-performance',
  });
  applyQualityProfile(renderer, quality);
  const element = renderer.domElement;
  const scene = new Scene();
  scene.background = new Color(DIORAMA_SKY);
  const camera = new PerspectiveCamera(30, 1, 0.05, 30);
  const orbit = new GlobeOrbitCamera(camera, opts.camera);

  const lights = createSunLights(quality);
  scene.add(lights.group);
  const sun: SunController = createSunController(lights, renderer);
  const airports: AirportsLayer = createAirports(scene, {
    maxAirports: opts.maxAirports ?? 64, maxHubSeats: opts.maxHubSeats ?? 48,
  });
  const routes = new RouteLayer();
  scene.add(routes.group);
  const planes = new PlaneLayer(routes, {
    maxPlanes: opts.maxPlanes ?? 120, progressScale: opts.progressScale,
  });
  scene.add(planes.group);
  const preview = createRoutePreview();
  scene.add(preview.object);
  let models: ModelPreviewRenderer | null = null;

  const cities = new Map<string, CityView>();
  const cityList: CityView[] = [];
  const closed = new Set<string>();
  const scratch = new Vector3();
  const toCamera = new Vector3();
  const point: ScreenPoint = { x: 0, y: 0, visible: false };
  let globe: GlobeInstance | null = null;
  let globeEpoch = 0;
  let disposed = false;
  let lastZoom = -1;

  const loadGlobe = async (): Promise<void> => {
    const mine = ++globeEpoch;
    const next = await createGlobe(scene, {
      quality, seed: opts.seed ?? 0xA1A1, landUrl: opts.landUrl, sunDirection: lights.direction,
    });
    if (disposed || mine !== globeEpoch) { next.dispose(); return; }
    globe?.dispose();
    globe = next;
  };

  function resize(width: number, height: number, insets?: SafeAreaInsets): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    renderer.setSize(w, h, false);
    orbit.setViewport(w, h, insets);
    camera.updateMatrixWorld();
  }

  const observed = opts.autoResize;
  const onResize = (): void => {
    if (!observed || disposed) return;
    resize(observed.clientWidth || window.innerWidth, observed.clientHeight || window.innerHeight, opts.insets?.());
  };
  const observer = observed && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  observer?.observe(observed as HTMLElement);
  if (observed) onResize();
  else resize(element.clientWidth || 412, element.clientHeight || 915);

  const ready = loadGlobe();
  ready.catch(() => { /* surfaced to the caller through `ready` */ });

  function project(lon: number, lat: number, altitude: number, out: ScreenPoint): ScreenPoint {
    setLatLonVec3(scratch, lon, lat, altitude);
    toCamera.copy(camera.position).sub(scratch);
    // Front-facing test against the local surface normal (radius-normalised position).
    const facing = toCamera.dot(scratch) > 0;
    scratch.project(camera);
    out.x = (scratch.x + 1) / 2 * orbit.viewportWidth;
    out.y = (1 - scratch.y) / 2 * orbit.viewportHeight;
    out.visible = facing && scratch.z >= -1 && scratch.z <= 1;
    return out;
  }

  function pickGlobe(x: number, y: number): LonLat | null {
    const w = orbit.viewportWidth;
    const h = orbit.viewportHeight;
    camera.updateMatrixWorld();
    return pickSphereNdc(x / w * 2 - 1, 1 - y / h * 2, camera);
  }

  const world: WorldRenderer = {
    canvas: element, scene, camera, orbit, ready,
    get quality() { return quality; },
    setSun: (lon, lat) => lights.setSun(lon, lat),
    setTime(tick, fraction = 0) {
      sun.setViewCenter(orbit.longitudeDeg, orbit.latitudeDeg);
      sun.update(tick, fraction);
    },
    setCities(views) {
      let reset = false;
      const seen = new Set<string>();
      for (const view of views) {
        seen.add(view.id);
        const known = cities.get(view.id);
        if (known && (known.hub === true) !== (view.hub === true)) reset = true;
      }
      for (const id of cities.keys()) if (!seen.has(id)) reset = true;
      if (reset) {
        airports.clear();
        cities.clear();
      }
      cityList.length = 0;
      for (const view of views) {
        if (!cities.has(view.id)) airports.addAirport({ id: view.id, lon: view.lon, lat: view.lat, hub: view.hub });
        cities.set(view.id, view);
        cityList.push(view);
      }
      if (reset) for (const id of closed) if (cities.has(id)) airports.setCurfew(id, true);
    },
    setHubLoad(loads) {
      for (const load of loads) if (airports.isHub(load.id)) airports.setHubLoad(load.id, load.used, load.cap);
    },
    setCurfew(closedIds) {
      const next = new Set(closedIds);
      for (const id of closed) if (!next.has(id) && airports.has(id)) airports.setCurfew(id, false);
      for (const id of next) if (airports.has(id)) airports.setCurfew(id, true);
      closed.clear();
      for (const id of next) closed.add(id);
    },
    setRoutes(views, revision) {
      const specs: RouteRenderSpec[] = [];
      for (const view of views) {
        const waypoints: GeoWaypoint[] = [];
        for (const id of view.cityIds) {
          const city = cities.get(id);
          if (!city) { waypoints.length = 0; break; }
          waypoints.push(city);
        }
        if (waypoints.length >= 2) specs.push({ id: view.id, type: view.aircraft, waypoints });
      }
      routes.setRoutes(specs, revision);
    },
    setRoutePreview: (model) => preview.update(model),
    setPlanes: (previous, current) => planes.setSnapshots(previous, current),
    render(alpha, dtSeconds) {
      if (disposed) return;
      orbit.update(dtSeconds);
      const zoom = orbit.zoomLevel;
      if (zoom !== lastZoom) { airports.setZoom(zoom); lastZoom = zoom; }
      airports.update();
      camera.updateMatrixWorld();
      planes.update(alpha, camera);
      renderer.render(scene, camera);
    },
    pick(x, y) {
      let best: CityView | null = null;
      let bestDistance = CITY_PICK_RADIUS_DP * CITY_PICK_RADIUS_DP;
      camera.updateMatrixWorld();
      for (let i = 0; i < cityList.length; i++) {
        const city = cityList[i];
        project(city.lon, city.lat, 1.01, point);
        if (!point.visible) continue;
        const dx = point.x - x;
        const dy = point.y - y;
        const d = dx * dx + dy * dy;
        if (d <= bestDistance) { bestDistance = d; best = city; }
      }
      if (best) return { kind: 'city', id: best.id, lon: best.lon, lat: best.lat };
      const hit = pickGlobe(x, y);
      return hit ? { kind: 'globe', lon: hit.lon, lat: hit.lat } : null;
    },
    pickGlobe,
    project,
    resize,
    async setQuality(preference) {
      const next = resolveQualityProfile(preference);
      if (next.preset === quality.preset && next.pixelRatio === quality.pixelRatio) return;
      // Antialiasing is fixed for the lifetime of the WebGL context.
      quality = { ...next, antialias: quality.antialias };
      applyQualityProfile(renderer, quality);
      lights.applyQuality(quality);
      resize(orbit.viewportWidth, orbit.viewportHeight);
      await loadGlobe();
    },
    drawModelPreview(kind, target) {
      if (disposed) return false;
      models ??= createModelPreviewRenderer(renderer);
      return models.draw(kind, target);
    },
    stats() {
      const info = renderer.info;
      return {
        drawCalls: info.render.calls, triangles: info.render.triangles,
        geometries: info.memory.geometries, textures: info.memory.textures,
        planes: planes.stats.planes, routes: routes.stats.routes, airports: cities.size,
      };
    },
    measureLayerContrast() {
      camera.updateMatrixWorld();
      return measureLayerContrast(renderer, scene, camera,
        { routes: routes.group, airports: airports.group, planes: planes.group });
    },
    sampleLuminance(rects) {
      camera.updateMatrixWorld();
      return sampleLuminance(renderer, scene, camera, rects, orbit.viewportWidth);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      globe?.dispose();
      globe = null;
      models?.dispose();
      preview.dispose();
      planes.dispose();
      routes.dispose();
      airports.dispose();
      lights.dispose();
      scene.clear();
      renderer.dispose();
      if (!canvas) element.remove();
    },
  };
  return world;
}
