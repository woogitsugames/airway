/**
 * The single world-renderer composition: one WebGLRenderer, one scene, one light rig,
 * one quality profile and one orbit camera shared by globe, airports, routes, planes,
 * route preview and model previews. Consumes plain read-only view objects; never
 * imports simulation internals and never writes authoritative state.
 *
 * Screen coordinates (`pick`, `project`, `resize`) are CSS pixels relative to the
 * canvas' top-left corner, matching `GlobeOrbitCamera` and the gesture recognizer.
 */
import { Color, Group, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { createContextGuard } from './contextGuard'; // [night-11h]
import type { AirportsLayer, AirportStyle } from './airports';
import { GlobeOrbitCamera, type OrbitCameraOptions, type SafeAreaInsets } from './camera';
import { createGlobe, createSunLights, DEFAULT_GLOBE_LOOK, type GlobeInstance, type GlobeLook } from './globe';
import { pickSphereNdc, setLatLonVec3, type LonLat } from './globe/geo-math';
import { createModelPreviewRenderer, type ModelPreviewRenderer } from './modelPreview';
import type { PlaneRenderSnapshot } from './planes';
import {
  AdaptiveQualityMonitor, adaptiveSteps, applyAdaptiveSteps, applyQualityProfile, frameDue, resolveQualityProfile,
  SAVER_DECOR_DENSITY, type AdaptiveStep, type QualityPreference, type QualityProfile,
} from './quality';
import type { RoutePreviewLayer, RoutePreviewView } from './routePreview';
import type { AircraftKind, GeoWaypoint, RouteRenderSpec } from './routes';
import { createSunController, type SunController } from './sun';
import { measureLayerContrast, sampleLuminance, type LayerContrast, type PixelRect } from './contrast';
import type { UpgradeKind } from '../sim/upgrades';
// [ext-04 E2/E3] D-283: Linoryt stamps, ribbons and silhouettes (drawn when the look is `linoryt`).
import type { LinorytObjects, PlaneLayerLike, RouteLayerLike } from './linoryt-objects';
import { STAMP_SIZE_PX } from './globe/linoryt';

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
  /** [ext-04 E2] Linoryt: share of the jam grace period left (0..1), null/absent = not jammed; any airport. */
  readonly jam01?: number | null;
}
/** [ext-04 E2] Spec §8: an airport stamp on screen (CSS px): centre, half the side, on the visible hemisphere. */
export interface AirportScreenBox {
  x: number;
  y: number;
  half: number;
  visible: boolean;
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
  /** [night-10g] Airports drawn with the curfew barrier now. */
  readonly curfewAirports: number;
  /** [night-04] Terrain LOD level (0 = preset mesh), drawn chunks / all chunks, terrain draw runs. */
  readonly terrainLevel: number;
  readonly terrainChunks: number;
  readonly terrainChunksTotal: number;
  readonly terrainRuns: number;
  readonly terrainTriangles: number;
  /** [night-04] Adaptive quality steps taken this session, in order. */
  readonly adaptations: readonly AdaptiveStep[];
  /** [night-07f] Tree and rock instances drawn after chunk culling / all of them (D-75). */
  readonly decorDrawn: number;
  readonly decorTotal: number;
}

/** [G8] D-172: the two surfaces the player can choose. */
export type GlobeMode = 'satellite' | 'map';

export interface WorldRendererOptions {
  /** Device tier preference; persistence is owned by the settings screen. */
  readonly quality?: QualityPreference;
  /** Decorative (non-simulation) seed for trees, rocks, clouds and lights. */
  readonly seed?: number;
  readonly landUrl?: string;
  /**
   * [ext-04 E4] The globe look; the Linoryt print is the only one (D-285).
   */
  readonly look?: GlobeLook;
  /** [G8] D-172: the player's globe mode, Satelita (default) or Mapa; change it later with `setGlobeMode`. */
  readonly globeMode?: GlobeMode;
  /** [ext-03] D-175/D-178 airport/route style; default `medal` (owner, D-178). DEV `?airportStyle=` compares. */
  readonly airportStyle?: AirportStyle;
  readonly camera?: OrbitCameraOptions;
  readonly maxAirports?: number;
  readonly maxHubSeats?: number;
  readonly maxPlanes?: number;
  /** Fixed-point scale of `PlaneView.progress01` (task 09 uses 10,000). */
  readonly progressScale?: number;
  /** Observe this element and resize automatically (insets from `insets()`). */
  readonly autoResize?: HTMLElement;
  readonly insets?: () => SafeAreaInsets;
  /**
   * [night-04] Step quality down when frames are slow (D-73). Default: on for `auto`, off under
   * automation (`navigator.webdriver`), so SwiftShader harnesses keep the quality they ask for.
   */
  readonly adaptive?: boolean;
  /**
   * [night-07b] Adaptive steps taken in an earlier session (D-74), applied before the first frame
   * when they are a prefix of the `auto` ladder; ignored for any other preference.
   */
  readonly adaptedSteps?: readonly AdaptiveStep[];
  /** [night-07b] Called with every step taken so far (in order) whenever a new one is taken. */
  readonly onAdapt?: (steps: readonly AdaptiveStep[]) => void;
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
  /** [night-11h] D-118: true while the WebGL context is lost (nothing draws; the caller pauses the run). */
  contextLost(): boolean;
  /** [night-11h] Called with true on context loss and false once it is restored and the quality re-applied. */
  onContextChange(listener: (lost: boolean) => void): () => void;
  setSun(lon: number, lat: number): void;
  /** [G8] D-172: Satelita ↔ Mapa; swaps the surface textures of the current globe and keeps the mode across rebuilds. */
  setGlobeMode(mode: GlobeMode): void;
  /** Day/night from the authoritative tick plus render interpolation fraction. */
  setTime(tick: number, fraction?: number): void;
  setCities(cities: readonly CityView[]): void;
  setHubLoad(loads: readonly HubLoadView[]): void;
  /**
   * [ext-04 E2] Spec §8: the stamp of airport `id` on screen, written into `out` without allocating (DEV builds until
   * E3; the UI calls it as `projectAirport?.(id, out)`). Unknown id → `visible: false`.
   */
  projectAirport?(id: string, out: AirportScreenBox): AirportScreenBox;
  /** Complete set of airports whose curfew barrier is closed. */
  setCurfew(closedIds: readonly string[]): void;
  /** Rebuilds route tubes only when `revision` changes (or is omitted). */
  setRoutes(routes: readonly RouteView[], revision?: number | string): void;
  setRoutePreview(model: RoutePreviewView | null): void;
  /** Call on each tick boundary with the previous and current plane views. */
  setPlanes(previous: readonly PlaneView[], current: readonly PlaneView[]): void;
  /**
   * Draw one frame. `alpha` is the [0,1] tick accumulator fraction; `dtSeconds` drives camera inertia.
   * [night-04] Returns false when the battery-saver frame cap skipped this display frame.
   */
  render(alpha: number, dtSeconds: number): boolean;
  /** [night-04] Pin the terrain LOD level (0 = preset mesh, 1 = far); null = automatic. Tests/shots. */
  forceTerrainLevel(level: number | null): void;
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
  let preference: QualityPreference = opts.quality ?? 'auto';
  let quality = resolveQualityProfile(preference);
  // [night-07b] Steps remembered from an earlier session start this one already stepped down.
  const remembered = preference === 'auto' && opts.adaptedSteps?.length
    ? applyAdaptiveSteps(quality, opts.adaptedSteps) : null;
  const ladder = adaptiveSteps(quality);
  if (remembered) quality = remembered;
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
  // [ext-04 E2] The Linoryt look draws stamps, double-line ribbons, a dashed preview and cut silhouettes instead.
  // [ext-04 E3] The look this renderer draws: the override, else the default look when that is the print.
  const look: GlobeLook = opts.look ?? DEFAULT_GLOBE_LOOK; // [ext-04 E4] always the print
  // The Linoryt layers live in their own chunk (with the print globe); until it arrives, record-only stand-ins keep
  // the airport set and the last routes, planes, loads and preview are replayed into the real layers (D-300).
  let linorytObjects: LinorytObjects | null = null;
  let airports: AirportsLayer;
  let routes: RouteLayerLike;
  let planes: PlaneLayerLike;
  let preview: RoutePreviewLayer;
  {
  const known = new Map<string, boolean>();
  airports = {
    group: new Group(), addAirport: (def) => { known.set(def.id, def.hub === true); }, setHubLoad() { /* replayed */ },
    setCurfew() { /* replayed */ }, setZoom() { /* screen-constant */ }, getPosition: () => null, has: (id) => known.has(id),
    isHub: (id) => known.get(id) === true, clear: () => known.clear(), update() { /* nothing drawn yet */ }, dispose() { known.clear(); },
  };
  routes = { group: new Group(), getRoute: () => undefined, setRoutes() { /* replayed */ }, dispose() { /* nothing yet */ },
    stats: { routes: 0, segments: 0, drawCalls: 0, triangles: 0, rebuilds: 0 } };
  planes = { group: new Group(), setSnapshots() { /* replayed */ }, update() { /* nothing yet */ }, setDaylight() { /* print */ },
    dispose() { /* nothing yet */ }, stats: { planes: 0, turboprops: 0, widebodies: 0, mainPassCalls: 0, triangles: 0, droppedPlanes: 0 } };
  preview = { object: new Group(), update() { /* replayed */ }, dispose() { /* nothing yet */ } };
  }
  scene.add(routes.group);
  scene.add(planes.group);
  scene.add(preview.object);
  // [ext-04 E3] Last inputs, for the Linoryt replay.
  let lastSpecs: RouteRenderSpec[] = [];
  let lastRevision: number | string | undefined;
  let lastPlanes: readonly [readonly PlaneView[], readonly PlaneView[]] = [[], []];
  let lastPreview: RoutePreviewView | null = null;
  let lastLoads: readonly HubLoadView[] = [];
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
  // [night-04] Frame cap, adaptive quality and terrain LOD state.
  let lastPaintAt = 0;
  let pendingDt = 0;
  let forcedLevel: number | null = null;
  const adaptations: AdaptiveStep[] = remembered ? opts.adaptedSteps!.slice() : [];
  const automated = typeof navigator !== 'undefined' && navigator.webdriver === true;
  const adaptiveWanted = (): boolean => opts.adaptive ?? (preference === 'auto' && !automated);
  let monitor: AdaptiveQualityMonitor | null = adaptiveWanted()
    ? new AdaptiveQualityMonitor(ladder.slice(adaptations.length)) : null;

  const loadGlobe = async (): Promise<void> => {
    const mine = ++globeEpoch;
    const next = await createGlobe(scene, {
      quality, seed: opts.seed ?? 0xA1A1, landUrl: opts.landUrl, sunDirection: lights.direction,
      look,
    });
    if (disposed || mine !== globeEpoch) { next.dispose(); return; }
    globe?.dispose();
    globe = next;
    globe.setDecorDensity(quality.decorDensity);
    globe.lod.forceLevel(forcedLevel);
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

  // [night-11h] D-118: on restore three.js re-creates its GL state and re-uploads buffers and textures on the next
  // draw; the quality profile (DPR, shadows, size) is re-applied and the frame cap / adaptive monitor restart, so the
  // loss gap is never read as a slow frame.
  const guard = createContextGuard(element, () => {
    applyQualityProfile(renderer, quality);
    lights.applyQuality(quality);
    resize(orbit.viewportWidth, orbit.viewportHeight);
    lastPaintAt = 0;
    pendingDt = 0;
  });
  const linorytReady = import('./linoryt-objects').then((module) => {
    if (disposed) return;
    const next = module.createLinorytObjects(scene,
      { maxAirports: opts.maxAirports, maxPlanes: opts.maxPlanes, progressScale: opts.progressScale });
    for (const old of [routes.group, planes.group, preview.object]) scene.remove(old);
    linorytObjects = next;
    airports = next.airports; routes = next.routes; planes = next.planes; preview = next.preview;
    scene.add(routes.group, planes.group, preview.object);
    for (const city of cityList) airports.addAirport({ id: city.id, lon: city.lon, lat: city.lat, hub: city.hub });
    for (const id of closed) if (airports.has(id)) airports.setCurfew(id, true);
    world.setHubLoad(lastLoads);
    routes.setRoutes(lastSpecs, lastRevision);
    planes.setSnapshots(lastPlanes[0], lastPlanes[1]);
    preview.update(lastPreview);
    lastZoom = -1;
  });
  const ready = Promise.all([loadGlobe(), linorytReady]).then(() => undefined);
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

  /** [night-04] One adaptive step down; terrain steps rebuild the globe off the frame. */
  function adapt(step: AdaptiveStep): void {
    adaptations.push(step);
    if (step === 'pixel-ratio') {
      quality = { ...quality, pixelRatio: 1 };
      applyQualityProfile(renderer, quality);
      resize(orbit.viewportWidth, orbit.viewportHeight);
    } else if (step === 'decorations') {
      quality = { ...quality, decorDensity: SAVER_DECOR_DENSITY };
      globe?.setDecorDensity(quality.decorDensity);
    } else {
      const lower = quality.preset === 'high' ? 'medium' : 'low';
      quality = { ...quality, preset: lower, shadowEnabled: false, shadowMapSize: 0 };
      applyQualityProfile(renderer, quality);
      lights.applyQuality(quality);
      void loadGlobe().catch(() => { /* keep the current globe */ });
    }
    opts.onAdapt?.(adaptations.slice());
  }

  /** Device pixels per degree of arc at the centre of the globe disc (0 when off screen). */
  function pixelsPerDegree(): number {
    const disc = orbit.getScreenDisc();
    return disc ? disc.radius * renderer.getPixelRatio() * Math.PI / 180 : 0;
  }

  function pickGlobe(x: number, y: number): LonLat | null {
    const w = orbit.viewportWidth;
    const h = orbit.viewportHeight;
    camera.updateMatrixWorld();
    return pickSphereNdc(x / w * 2 - 1, 1 - y / h * 2, camera);
  }

  const world: WorldRenderer = {
    canvas: element, scene, camera, orbit, ready,
    contextLost: () => guard.lost(),
    onContextChange: (listener) => guard.onChange(listener),
    get quality() { return quality; },
    setSun: (lon, lat) => lights.setSun(lon, lat),
    setGlobeMode() { /* [ext-04 E4] D-285: one look; kept until the UI drops the call */ },
    setTime(tick, fraction = 0) {
      sun.setViewCenter(orbit.longitudeDeg, orbit.latitudeDeg);
      sun.update(tick, fraction);
      planes.setDaylight(sun.daylight); // [task-34]
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
      lastLoads = loads;
      for (const load of loads) if (airports.isHub(load.id)) airports.setHubLoad(load.id, load.used, load.cap);
      if (linorytObjects) {
        for (const load of loads) linorytObjects.airports.setJam(load.id, load.jam01 ?? null);
      }
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
      lastSpecs = specs; lastRevision = revision;
      routes.setRoutes(specs, revision);
    },
    setRoutePreview(model) { lastPreview = model; preview.update(model); },
    setPlanes(previous, current) { lastPlanes = [previous, current]; planes.setSnapshots(previous, current); },
    render(alpha, dtSeconds) {
      if (disposed || guard.lost()) return false;
      const now = performance.now();
      pendingDt += dtSeconds;
      if (lastPaintAt !== 0 && !frameDue(now - lastPaintAt, quality.maxFps)) return false;
      if (lastPaintAt !== 0 && monitor) {
        const step = monitor.push(now - lastPaintAt);
        if (step) adapt(step);
      }
      lastPaintAt = now;
      const dt = Math.min(0.25, pendingDt);
      pendingDt = 0;
      orbit.update(dt);
      const zoom = orbit.zoomLevel;
      if (zoom !== lastZoom) { airports.setZoom(zoom); lastZoom = zoom; }
      airports.update();
      camera.updateMatrixWorld();
      planes.update(alpha, camera);
      globe?.update(camera, pixelsPerDegree());
      renderer.render(scene, camera);
      return true;
    },
    forceTerrainLevel(level) {
      forcedLevel = level;
      globe?.lod.forceLevel(level);
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
    async setQuality(nextPreference) {
      preference = nextPreference;
      // [night-07b] An explicit choice starts the ladder afresh (the caller forgets the memory).
      adaptations.length = 0;
      monitor = adaptiveWanted() ? new AdaptiveQualityMonitor(adaptiveSteps(resolveQualityProfile(preference))) : null;
      const next = resolveQualityProfile(preference);
      const rebuild = next.preset !== quality.preset;
      if (!rebuild && next.pixelRatio === quality.pixelRatio && next.maxFps === quality.maxFps &&
        next.decorDensity === quality.decorDensity && next.shadowEnabled === quality.shadowEnabled) return;
      // Antialiasing is fixed for the lifetime of the WebGL context.
      quality = { ...next, antialias: quality.antialias };
      applyQualityProfile(renderer, quality);
      lights.applyQuality(quality);
      resize(orbit.viewportWidth, orbit.viewportHeight);
      globe?.setDecorDensity(quality.decorDensity);
      if (rebuild) await loadGlobe();
    },
    drawModelPreview(kind, target) {
      if (disposed || guard.lost()) return false;
      models ??= createModelPreviewRenderer(renderer);
      return models.draw(kind, target);
    },
    stats() {
      const info = renderer.info;
      return {
        drawCalls: info.render.calls, triangles: info.render.triangles,
        geometries: info.memory.geometries, textures: info.memory.textures,
        planes: planes.stats.planes, routes: routes.stats.routes, airports: cities.size,
        curfewAirports: [...closed].filter((id) => airports.has(id)).length,
        terrainLevel: globe?.lod.stats.level ?? 0, terrainChunks: globe?.lod.stats.visibleChunks ?? 0,
        terrainChunksTotal: globe?.lod.stats.chunks ?? 0, terrainRuns: globe?.lod.stats.runs ?? 0,
        terrainTriangles: globe?.lod.stats.triangles ?? 0, adaptations: adaptations.slice(),
        decorDrawn: globe?.decor.drawn ?? 0, decorTotal: globe?.decor.total ?? 0,
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
      guard.dispose();
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
  // [ext-04 E2/E3] Spec §8: stamp boxes for the overlay; the centre is the same point `pick()` measures.
  {
    world.projectAirport = (id, out) => {
      const city = cities.get(id);
      if (!city) { out.visible = false; out.half = 0; return out; }
      camera.updateMatrixWorld();
      project(city.lon, city.lat, 1.01, point);
      out.x = point.x; out.y = point.y; out.visible = point.visible;
      out.half = linorytObjects ? linorytObjects.airports.halfSize(id)
        : (city.hub ? STAMP_SIZE_PX.hub : STAMP_SIZE_PX.airport) / 2;
      return out;
    };
  }
  return world;
}
