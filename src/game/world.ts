// Frame loop and menu/game framing around the single render facade (src/render, "Render API").
// The renderer has no clock of its own; this owns requestAnimationFrame and feeds render(alpha, dt).
import {
  createWorldRenderer, createMenuNetwork, type CityView, type HubLoadView, type PlaneView, type QualityPreference,
  type RouteView, type SafeAreaInsets, type ScreenPoint, type WorldRenderer,
} from '../render';
import type { RoutePreviewModel } from '../input/routeTool';
import {
  contrastRatio, relativeLuminance, insetsFromLayout, menuFraming, solveZoomForRadius, type LayoutRect,
} from '../render'; // [task-34]
import { cityByCode } from '../data'; // [task-34]

// [task-34] HTML panels the globe must stay clear of. Their boxes become camera insets (D-47).
const GAME_PANELS = ['.airway-pass', '.airway-dock'];
const MENU_SIGN = '.airway-sign';
const MENU_BOARD = '.airway-board';

export type { ScreenPoint } from '../render';

export interface FrameState { readonly tick: number; readonly alpha: number }

export interface World {
  readonly renderer: WorldRenderer;
  readonly canvas: HTMLCanvasElement;
  readonly camera: WorldRenderer['camera'];
  readonly orbit: WorldRenderer['orbit'];
  readonly ready: Promise<void>;
  setInsets(insets: SafeAreaInsets): void;
  setIdleSpin(degreesPerSecond: number): void;
  /** Menu framing: North Atlantic close-up behind the departures board, slowly turning. */
  showMenuBackdrop(): void;
  setCities(cities: readonly CityView[]): void;
  setHubLoad(loads: readonly HubLoadView[]): void;
  setRoutes(routes: readonly RouteView[], revision: number | string): void;
  setPlanes(previous: readonly PlaneView[], current: readonly PlaneView[]): void;
  preview(model: RoutePreviewModel | null): void;
  project(lon: number, lat: number, out: ScreenPoint): ScreenPoint;
  pickGlobe(x: number, y: number): { lon: number; lat: number } | null;
  setQuality(preference: QualityPreference): void;
  /** Clear all game layers (menu ↔ new run). */
  reset(): void;
  /** Per-frame hook: advance the run, return the authoritative tick and accumulator fraction. */
  onFrame(callback: ((dtSeconds: number) => FrameState | void) | null): void;
  dispose(): void;
}

/** [task-34] Menu camera target: North Atlantic between New York and Europe (mockup menu-p). */
const MENU_TARGET = { lon: -16, lat: 40 };

export function createWorld(host: HTMLElement, label: string, quality: QualityPreference): World {
  let insets: SafeAreaInsets = {};
  let disposed = false;
  const renderer = createWorldRenderer(undefined, {
    quality, seed: 0xA1A1, autoResize: host, insets: () => insets,
    camera: { longitude: -18, latitude: 40, zoom: 2 }, maxAirports: 64, maxPlanes: 120,
  });
  const canvas = renderer.canvas;
  canvas.classList.add('airway-world');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  host.prepend(canvas);

  // [task-34] Insets are the larger of the caller's (safe area) and the measured HUD/menu boxes.
  let menuActive = false;
  let measureRaf = 0;
  let lastFrame = ''; // last applied framing; unchanged layout never resizes the drawing buffer
  const panelObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => scheduleMeasure()) : null;
  const observed = new Set<Element>();
  const boxOf = (element: Element | null, origin: DOMRect): LayoutRect | null => {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    if (!observed.has(element)) { observed.add(element); panelObserver?.observe(element); }
    return { left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top };
  };
  const measure = (): void => {
    measureRaf = 0;
    if (disposed) return;
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    const origin = host.getBoundingClientRect();
    if (menuActive) {
      const framing = menuFraming(w, h, boxOf(host.querySelector(MENU_SIGN), origin),
        boxOf(host.querySelector(MENU_BOARD), origin), insets);
      const key = `menu ${w} ${h} ${JSON.stringify(framing)}`;
      if (key === lastFrame) return;
      lastFrame = key;
      renderer.resize(w, h, framing.insets);
      const orbit = renderer.orbit;
      orbit.setViewShift(0, 0);
      if (framing.mode === 'disc') { orbit.setZoom(1); return; }
      const zoom = solveZoomForRadius((z) => { orbit.setZoom(z); return orbit.getScreenDisc()?.radius ?? 0; }, framing.radius);
      orbit.setZoom(zoom);
      // Slide the view so the limb top lands on the wanted horizon line under the sign.
      const disc = orbit.getScreenDisc();
      if (disc) orbit.setViewShift(0, framing.horizonY - (disc.y - disc.radius));
      return;
    }
    const boxes: LayoutRect[] = [];
    for (const selector of GAME_PANELS) {
      for (const element of host.querySelectorAll(selector)) {
        const box = boxOf(element, origin);
        if (box) boxes.push(box);
      }
    }
    const gameInsets = insetsFromLayout(w, h, boxes, insets);
    const key = `game ${w} ${h} ${JSON.stringify(gameInsets)}`;
    if (key === lastFrame) return;
    lastFrame = key;
    renderer.orbit.setViewShift(0, 0);
    renderer.resize(w, h, gameInsets);
  };
  function scheduleMeasure(): void {
    if (!measureRaf && !disposed) measureRaf = requestAnimationFrame(measure);
  }
  const resize = (): void => {
    lastFrame = '';
    renderer.resize(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight, insets);
    scheduleMeasure();
  };
  window.addEventListener('resize', scheduleMeasure);
  // The menu mounts its sign/board after showMenuBackdrop(); watch the DOM only while the menu shows.
  const menuWatcher = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => scheduleMeasure()) : null;
  panelObserver?.observe(host);
  let spin = 0;
  const demo = createMenuNetwork(renderer, (code) => cityByCode(code) ?? null); // [task-34]
  let frameCallback: ((dt: number) => FrameState | void) | null = null;
  let last = performance.now();
  let raf = 0;
  const loop = (now: number): void => {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
  if (import.meta.env.DEV) installWorldProbe(renderer); // [task-34] screenshot/contrast probe (scripts/shots-34.mjs)
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (spin) {
      const state = renderer.orbit.getState();
      renderer.orbit.setTarget(state.longitude + spin * dt, state.latitude);
    }
    const frame = frameCallback?.(dt);
    const demoAlpha = frameCallback ? null : demo.frame(dt); // [task-34] menu planes
    if (frame) renderer.setTime(frame.tick, Math.max(0, Math.min(1, frame.alpha)));
    else {
      // Without a run, keep the sun just ahead of the view so the menu backdrop is daylit.
      const lon = renderer.orbit.getState().longitude + 25;
      renderer.setTime(Math.round(((180 - lon) * 4 % 1440 + 1440) % 1440), 0);
    }
    renderer.render(frame ? frame.alpha : demoAlpha ?? 1, dt);
  };
  raf = requestAnimationFrame(loop);

  return {
    renderer, canvas, camera: renderer.camera, orbit: renderer.orbit, ready: renderer.ready,
    setInsets(next) { insets = next; menuActive = false; menuWatcher?.disconnect(); demo.stop(); resize(); }, // [task-34]
    setIdleSpin(degreesPerSecond) { spin = degreesPerSecond; },
    showMenuBackdrop() {
      // [task-34] Mockup menu framing: horizon under the sign (portrait) or the whole disc beside the
      // board (landscape), measured from the live sign/board boxes; a still camera over a small
      // decorative network so routes and planes read above the board.
      insets = {};
      menuActive = true;
      spin = 0;
      renderer.orbit.setTarget(MENU_TARGET.lon, MENU_TARGET.lat);
      demo.start();
      menuWatcher?.observe(host, { childList: true, subtree: true });
      resize();
    },
    setCities: (cities) => renderer.setCities(cities),
    setHubLoad: (loads) => renderer.setHubLoad(loads),
    setRoutes: (routes, revision) => renderer.setRoutes(routes, revision),
    setPlanes: (previous, current) => renderer.setPlanes(previous, current),
    preview: (model) => renderer.setRoutePreview(model),
    project: (lon, lat, out) => renderer.project(lon, lat, 1.01, out),
    pickGlobe: (x, y) => renderer.pickGlobe(x, y),
    setQuality(preference) { void renderer.setQuality(preference).catch((error: unknown) => console.warn('Quality change failed', error)); },
    reset() {
      demo.stop(); // [task-34]
      renderer.setRoutePreview(null);
      renderer.setPlanes([], []);
      renderer.setRoutes([], 'reset');
      renderer.setHubLoad([]);
      renderer.setCurfew([]);
      renderer.setCities([]);
    },
    onFrame(callback) { frameCallback = callback; last = performance.now(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(measureRaf); // [task-34]
      panelObserver?.disconnect();
      menuWatcher?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      renderer.dispose();
    },
  };
}

// [task-34] DEV-only probe for scripts/shots-34.mjs: camera centre and night readability measurements.
function installWorldProbe(renderer: WorldRenderer): void {
  const probe = {
    ready: false,
    longitude: () => renderer.orbit.longitudeDeg,
    /** Median WCAG contrast per layer; `tags` is the worst luggage tag against the globe under it. */
    nightContrast(): Record<string, number | null> {
      const out: Record<string, number | null> = {};
      for (const [name, value] of Object.entries(renderer.measureLayerContrast())) out[name] = value ? value.ratio : null;
      const canvas = renderer.canvas.getBoundingClientRect();
      const tags = [...document.querySelectorAll<HTMLElement>('.airport-bubble')].filter((tag) => !tag.hidden && tag.offsetParent);
      const rects = tags.map((tag) => {
        const r = tag.getBoundingClientRect();
        return { x: r.left - canvas.left, y: r.top - canvas.top, width: r.width, height: r.height };
      });
      const under = renderer.sampleLuminance(rects);
      let worst: number | null = null;
      tags.forEach((tag, i) => {
        const globe = under[i];
        const paper = parseRgb(getComputedStyle(tag).backgroundColor);
        if (globe === null || !paper) return;
        const ratio = Math.round(contrastRatio(relativeLuminance(paper[0], paper[1], paper[2]), globe) * 100) / 100;
        worst = worst === null ? ratio : Math.min(worst, ratio);
      });
      out.tags = worst;
      return out;
    },
  };
  void renderer.ready.then(() => { probe.ready = true; });
  (window as unknown as { __awWorld: typeof probe }).__awWorld = probe;
}

function parseRgb(css: string): [number, number, number] | null {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
