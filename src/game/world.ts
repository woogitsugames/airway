// [integration-ui] adapter: replace when src/render exposes one world facade ("Render API" in
// docs/ARCHITECTURE.md). Composes the existing render modules (globe 03, camera 04, airports 06,
// routes/planes 10, sun 11, route preview 07) behind ONE WebGL context shared by menu and game.
import { Color, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { createAirports, type AirportsLayer } from '../render/airports';
import { GlobeOrbitCamera, type SafeAreaInsets } from '../render/camera';
import { createGlobe, type GlobeInstance } from '../render/globe';
import { PlaneLayer, type PlaneRenderSnapshot } from '../render/planes';
import { applyQualityProfile, resolveQualityProfile } from '../render/quality';
import { createRoutePreview, type RoutePreviewView } from '../render/routePreview';
import { RouteLayer, type RouteRenderSpec } from '../render/routes';
import { createSunController, type SunController } from '../render/sun';
import type { RoutePreviewModel } from '../input/routeTool';

const DIORAMA_SKY = '#8CC3D8';
const DEG = Math.PI / 180;

export interface WorldAirport { readonly id: string; readonly lon: number; readonly lat: number; readonly hub?: boolean }
export interface ScreenPoint { x: number; y: number; visible: boolean }

export interface World {
  readonly canvas: HTMLCanvasElement;
  readonly camera: PerspectiveCamera;
  readonly orbit: GlobeOrbitCamera;
  /** Resolves when terrain finished loading (or failed and the sea-only sky remains). */
  readonly ready: Promise<boolean>;
  setInsets(insets: SafeAreaInsets): void;
  /** Slow decorative rotation for the menu; stops as soon as the player touches the globe. */
  setIdleSpin(degreesPerSecond: number): void;
  addAirport(airport: WorldAirport): void;
  setHubLoad(id: string, used: number, capacity: number): void;
  setRoutes(routes: readonly RouteRenderSpec[], revision: number | string): void;
  setPlanes(previous: readonly PlaneRenderSnapshot[], current: readonly PlaneRenderSnapshot[]): void;
  preview(model: RoutePreviewModel | null): void;
  /** Screen position (CSS px relative to the canvas) and whether the point faces the camera. */
  project(lon: number, lat: number, out: ScreenPoint): ScreenPoint;
  pick(x: number, y: number): { lon: number; lat: number } | null;
  /** Clear all game layers (menu ↔ new run). */
  reset(): void;
  /** Per-frame callback: dt seconds; returns interpolation alpha and the tick for the sun. */
  onFrame(callback: ((dtSeconds: number) => { tick: number; alpha: number } | void) | null): void;
  dispose(): void;
}

export function createWorld(host: HTMLElement, label: string): World {
  const scene = new Scene();
  scene.background = new Color(DIORAMA_SKY);
  const quality = resolveQualityProfile();
  const renderer = new WebGLRenderer({ antialias: quality.antialias, alpha: false, powerPreference: 'high-performance' });
  applyQualityProfile(renderer, quality);
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  canvas.className = 'airway-world';
  host.appendChild(canvas);

  const camera = new PerspectiveCamera(30, 1, 0.05, 40);
  const orbit = new GlobeOrbitCamera(camera, { longitude: 8, latitude: 44, zoom: 1.05 });
  let airports: AirportsLayer = createAirports(scene, { maxAirports: 64, maxHubSeats: 32 });
  let routeLayer = new RouteLayer();
  let planes = new PlaneLayer(routeLayer, { maxPlanes: 120 });
  scene.add(routeLayer.group, planes.group);
  const routePreview: RoutePreviewView = createRoutePreview();
  scene.add(routePreview.object);

  let globe: GlobeInstance | null = null;
  let sun: SunController | null = null;
  let disposed = false;
  let insets: SafeAreaInsets = {};
  let width = 1;
  let height = 1;
  const ready = createGlobe(scene, {
    renderer, canvas, quality: quality.preset, seed: 0xA1A1,
    viewport: () => canvas.getBoundingClientRect(),
  }).then((instance) => {
    if (disposed) { instance.dispose(); return false; }
    globe = instance;
    sun = createSunController(instance, renderer);
    sun.update(16 * 60);
    return true;
  }).catch((error: unknown) => {
    console.error('Globe terrain unavailable; keeping the sky scene.', error);
    return false;
  });

  const resize = (): void => {
    width = Math.max(1, host.clientWidth || window.innerWidth);
    height = Math.max(1, host.clientHeight || window.innerHeight);
    renderer.setSize(width, height, false);
    orbit.setViewport(width, height, insets);
  };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(host);
  window.addEventListener('resize', resize);
  resize();

  let frameCallback: ((dt: number) => { tick: number; alpha: number } | void) | null = null;
  let spin = 0;
  let last = performance.now();
  let raf = 0;
  const loop = (now: number): void => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (spin) {
      const state = orbit.getState();
      orbit.setTarget(state.longitude + spin * dt, state.latitude);
    }
    orbit.update(dt);
    camera.updateMatrixWorld();
    const frame = frameCallback?.(dt);
    const state = orbit.getState();
    if (sun) {
      sun.setViewCenter(state.longitude, state.latitude);
      sun.update(frame ? frame.tick : 16 * 60, frame ? Math.max(0, Math.min(1, frame.alpha)) : 0);
    }
    airports.setZoom(state.zoom);
    planes.update(frame ? frame.alpha : 1, camera);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);

  const point = new Vector3();
  const normal = new Vector3();
  const toEye = new Vector3();
  return {
    canvas, camera, orbit, ready,
    setInsets(next) { insets = next; orbit.setViewport(width, height, insets); },
    setIdleSpin(degreesPerSecond) { spin = degreesPerSecond; },
    addAirport(airport) { airports.addAirport({ id: airport.id, lon: airport.lon, lat: airport.lat, hub: airport.hub }); },
    setHubLoad(id, used, capacity) { airports.setHubLoad(id, used, capacity); },
    setRoutes(routes, revision) { routeLayer.setRoutes(routes, revision); },
    setPlanes(previous, current) { planes.setSnapshots(previous, current); },
    preview(model) { routePreview.update(model); },
    project(lon, lat, out) {
      const phi = lat * DEG;
      const theta = lon * DEG;
      const cos = Math.cos(phi);
      normal.set(cos * Math.sin(theta), Math.sin(phi), cos * Math.cos(theta));
      toEye.copy(camera.position).sub(normal);
      out.visible = normal.dot(toEye) > 0.02;
      point.copy(normal).multiplyScalar(1.01).project(camera);
      out.x = (point.x + 1) / 2 * width;
      out.y = (1 - point.y) / 2 * height;
      return out;
    },
    pick(x, y) {
      if (!globe) return null;
      const rect = canvas.getBoundingClientRect();
      return globe.pick(x + rect.left, y + rect.top, camera);
    },
    reset() {
      routePreview.update(null);
      scene.remove(routeLayer.group, planes.group);
      planes.dispose();
      routeLayer.dispose();
      airports.dispose();
      airports = createAirports(scene, { maxAirports: 64, maxHubSeats: 32 });
      routeLayer = new RouteLayer();
      planes = new PlaneLayer(routeLayer, { maxPlanes: 120 });
      scene.add(routeLayer.group, planes.group);
    },
    onFrame(callback) { frameCallback = callback; last = performance.now(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      routePreview.dispose();
      planes.dispose();
      routeLayer.dispose();
      airports.dispose();
      (globe as GlobeInstance | null)?.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
