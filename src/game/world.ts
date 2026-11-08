// Frame loop and menu/game framing around the single render facade (src/render, "Render API").
// The renderer has no clock of its own; this owns requestAnimationFrame and feeds render(alpha, dt).
import {
  createWorldRenderer, createMenuNetwork, type CityView, type HubLoadView, type PlaneView, type QualityPreference,
  type RouteView, type SafeAreaInsets, type ScreenPoint, type WorldRenderer,
} from '../render';
import type { RoutePreviewModel } from '../input/routeTool';
import {
  contrastRatio, relativeLuminance, insetsFromLayout, menuFraming, solveZoomForRadius, menuSpinRate, type LayoutRect,
} from '../render'; // [task-34] [task-39] menuSpinRate
import { cityByCode } from '../data'; // [task-34]
import { indexFraming, menuNetworkClashes, menuTilt, type ClearRect } from './menu-clear'; // [night-16a] D-262; [night-29b] U4
import { t } from '../i18n'; // [night-11h]
import { forgetAdaptiveSteps, readAdaptiveSteps, writeAdaptiveSteps } from './adaptiveMemory'; // [night-07b]
import { reducedMotion } from '../ui/motion'; // [night-11g] D-88
import type { GlobeLook } from '../render/globe';

/**
 * [ext-04 E4] D-285: the Linoryt print is the shipped look; `?look=linoryt` is accepted for old links.
 * [night-70a R1] D-323/D-325: `?look=earth` previews the NASA globe, and so does the UI-A preview `?skin=board` unless
 * `?look=linoryt` asks for the print (DEV only; the caller passes nothing in a release).
 */
function devGlobeLook(): GlobeLook | undefined {
  const query = new URLSearchParams(location.search);
  const look = query.get('look');
  if (look === 'linoryt' || look === 'earth') return look;
  return import.meta.env.DEV && query.get('skin') === 'board' ? 'earth' : undefined;
}

// [task-34] HTML panels the globe must stay clear of. Their boxes become camera insets (D-47).
// [night-75a] D-330: the UI-A preview's hub strip bay is one too (present only in a DEV `?skin=board` build).
const GAME_PANELS = ['.airway-pass', '.airway-dock', '.airway-strip-bay'];
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
  /** [night-10g] Airports closed by the night curfew now: the red-white barrier ring (task 11). */
  setCurfew(closedIds: readonly string[]): void;
  /** [night-10g] DEV/QA: airports the renderer draws with the barrier. */
  curfewDrawn(): number;
  setRoutes(routes: readonly RouteView[], revision: number | string): void;
  setPlanes(previous: readonly PlaneView[], current: readonly PlaneView[]): void;
  preview(model: RoutePreviewModel | null): void;
  project(lon: number, lat: number, out: ScreenPoint): ScreenPoint;
  pickGlobe(x: number, y: number): { lon: number; lat: number } | null;
  setQuality(preference: QualityPreference): void;
  /** Clear all game layers (menu ↔ new run). */
  reset(): void;
  /** [night-11a] An opaque full-screen page (settings, logbook, puzzles, tutorial) hides the globe: stop drawing it. */
  setCovered(covered: boolean): void;
  /** [night-11h] D-118: the WebGL context is lost; the run is held and a notice says so. */
  contextLost(): boolean;
  /** Per-frame hook: advance the run, return the authoritative tick and accumulator fraction. */
  onFrame(callback: ((dtSeconds: number) => FrameState | void) | null): void;
  dispose(): void;
}

/** [task-34] Menu camera target: North Atlantic between New York and Europe (mockup menu-p). */
const MENU_TARGET = { lon: -16, lat: 40 };
/**
 * [night-14b] D-259: the menu entries; the view looks south of MENU_TARGET so the demo network rides above them
 * ([night-16a] D-262: as far as it takes for no demo airport to stand on an entry, src/game/menu-clear.ts).
 * [night-29b] D-284 U4 / [night-46a] D-301: the Linoryt menu frames its globe from the printed index (the board box,
 * src/game/menu-clear.ts indexFraming) and clears these rows.
 */
const MENU_ENTRIES = '.airway-board .airway-flight, .airway-board .airway-flight__region';

/** [task-39] First menu show only: longest wait for the sign/board before the globe renders anyway. */
const MENU_HOLD_MS = 1500;

export function createWorld(host: HTMLElement, label: string, quality: QualityPreference): World {
  let insets: SafeAreaInsets = {};
  // [task-39] Insets last applied by the framing; the renderer's own resize observer reuses them
  // instead of falling back to the bare safe-area insets between two measurements.
  let appliedInsets: SafeAreaInsets = {};
  let disposed = false;
  const renderer = createWorldRenderer(undefined, {
    quality, seed: 0xA1A1, autoResize: host, insets: () => appliedInsets,
    camera: { longitude: -18, latitude: 40, zoom: 2 }, maxAirports: 64, maxPlanes: 120,
    // [ext-03] DEV-only experimental globe look (`?globeLook=refined|satellite|painted`); production: diorama.
    look: import.meta.env.DEV ? devGlobeLook() : undefined, // [night-46a] D-301: release = DEFAULT_GLOBE_LOOK (Linoryt)
    // [night-07b] D-74: a slow device starts where its last session ended up.
    adaptedSteps: quality === 'auto' ? readAdaptiveSteps() : [],
    onAdapt: (steps) => writeAdaptiveSteps(steps),
  });
  const canvas = renderer.canvas;
  canvas.classList.add('airway-world');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  host.prepend(canvas);

  // [task-34] Insets are the larger of the caller's (safe area) and the measured HUD/menu boxes.
  let menuActive = false;
  let menuShown = false; // [task-39] the menu sign is on screen (not settings, not mid-transition)
  let menuFramed = false; // [task-39] the first menu framing with a measured sign/board has been applied
  let menuShownAt = 0;
  // [task-39] Store shots and screenshot harnesses need a still menu (D-62).
  const frozenSpin = import.meta.env.DEV && new URLSearchParams(location.search).has('storeShot');
  let measureRaf = 0;
  let lastFrame = ''; // last applied framing; unchanged layout never resizes the drawing buffer
  let demoCities: readonly { lon: number; lat: number }[] = []; // [night-16a] D-262: the menu network's airports
  let menuTiltNow = 0; // [night-16a] D-262: degrees the Róża menu looks south of MENU_TARGET (DEV probe)
  const panelObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => scheduleMeasure()) : null;
  const observed = new Set<Element>();
  const boxOf = (element: Element | null, origin: DOMRect): LayoutRect | null => {
    if (!element) return null;
    // [night-75a] D-330: observed while hidden too, so a panel that appears later (the strip bay) re-frames the globe.
    if (!observed.has(element)) { observed.add(element); panelObserver?.observe(element); }
    const r = element.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    return { left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top };
  };
  /** Union of the visible boxes of `elements` (layer coordinates). */
  const unionBox = (elements: NodeListOf<Element>, origin: DOMRect): LayoutRect | null => {
    let box: LayoutRect | null = null;
    for (const element of elements) {
      const r = element.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const next = { left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top };
      box = box ? { left: Math.min(box.left, next.left), top: Math.min(box.top, next.top),
        right: Math.max(box.right, next.right), bottom: Math.max(box.bottom, next.bottom) } : next;
    }
    return box;
  };
  /** [night-16a] D-262: every menu entry's box (layer coordinates), for the demo network's clearance. */
  const entryRects = (origin: DOMRect): ClearRect[] => {
    const rects: ClearRect[] = [];
    for (const element of host.querySelectorAll(MENU_ENTRIES)) {
      const r = element.getBoundingClientRect();
      if (r.width >= 1 && r.height >= 1) rects.push({ left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top });
    }
    return rects;
  };
  const measure = (): void => {
    measureRaf = 0;
    if (disposed) return;
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    const origin = host.getBoundingClientRect();
    if (menuActive) {
      const sign = boxOf(host.querySelector(MENU_SIGN), origin);
      const board = boxOf(host.querySelector(MENU_BOARD), origin);
      menuShown = sign !== null; // [task-39]
      if (sign && board) menuFramed = true;
      let framing = menuFraming(w, h, sign, board, insets);
      // [night-14b] D-259: the entries' box (the printed index rows).
      const entries = unionBox(host.querySelectorAll(MENU_ENTRIES), origin);
      if (entries && w > h) {
        // Landscape: a big globe left of the entries, its horizon under the title like the portrait menu (the board
        // column used to be the left inset, which left a small disc between the title and the entries).
        const left = insets.left ?? 0;
        const right = Math.max(insets.right ?? 0, Math.round(w - entries.left + 16));
        const top = Math.round(sign?.bottom ?? h * 0.12);
        framing = {
          mode: 'horizon', horizonY: top + 20, radius: Math.max(1, (w - left - right) / 2),
          insets: { left, right, top, bottom: insets.bottom ?? 0 },
        };
      }
      // [night-29b] D-284 U4, D-286: the whole globe printed between the title and the index (or left of the index
      // column in landscape); a screen too short for it keeps the horizon framing above.
      framing = indexFraming(w, h, sign, board, insets) ?? framing;
      // The entries' box is part of the key: the tilt below needs them laid out (a first measure may come before).
      const key = `menu ${w} ${h} ${entries ? `${Math.round(entries.left)},${Math.round(entries.top)}` : '-'} ${demoCities.length} ${JSON.stringify(framing)}`;
      if (key === lastFrame) return;
      lastFrame = key;
      appliedInsets = framing.insets; // [task-39]
      renderer.resize(w, h, framing.insets);
      const orbit = renderer.orbit;
      orbit.setViewShift(0, 0);
      if (framing.mode === 'disc') { orbit.setZoom(1); return; }
      const zoom = solveZoomForRadius((z) => { orbit.setZoom(z); return orbit.getScreenDisc()?.radius ?? 0; }, framing.radius);
      orbit.setZoom(zoom);
      // Slide the view so the limb top lands on the wanted horizon line under the sign.
      const disc = orbit.getScreenDisc();
      if (disc) orbit.setViewShift(0, framing.horizonY - (disc.y - disc.radius));
      // [night-14b] D-259: the entries stand in the lower half, so the view looks further south and the demo network
      // (London–Dakar) rides above them (it ran under "Lot bez końca" / "Ustawienia" on tall phones and foldables). The
      // globe's outline does not move; the slow menu spin keeps this latitude.
      // [night-16a] D-262: 16° was not enough on a short phone (Dakar under "Ustawienia"): the tilt grows until no demo
      // airport comes near an entry at any turn of the spin.
      if (entries) {
        const longitude = orbit.getState().longitude;
        const rects = entryRects(origin);
        const tilt = menuTilt((next) => {
          orbit.setTarget(longitude, MENU_TARGET.lat - next);
          renderer.camera.updateMatrixWorld();
          return menuNetworkClashes(demoCities, rects, (lon, lat, out) => renderer.project(lon, lat, 1.01, out));
        });
        orbit.setTarget(longitude, MENU_TARGET.lat - tilt);
        menuTiltNow = tilt;
      }
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
    appliedInsets = gameInsets; // [task-39]
    renderer.resize(w, h, gameInsets);
  };
  function scheduleMeasure(): void {
    if (!measureRaf && !disposed) measureRaf = requestAnimationFrame(measure);
  }
  const resize = (): void => {
    lastFrame = '';
    appliedInsets = insets; // [task-39]
    renderer.resize(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight, insets);
    // [task-39] Measure now, not on the next frame: the next rendered frame already has the framing.
    if (measureRaf) cancelAnimationFrame(measureRaf);
    measure();
  };
  window.addEventListener('resize', scheduleMeasure);
  // The menu mounts its sign/board after showMenuBackdrop(); watch the DOM only while the menu shows.
  const menuWatcher = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => scheduleMeasure()) : null;
  panelObserver?.observe(host);
  let spin = 0;
  // [night-16a] D-262: the demo airports pass through to the renderer and are kept for the menu clearance (measure).
  const demo = createMenuNetwork({
    setCities: (cities) => { demoCities = cities; renderer.setCities(cities); },
    setRoutes: (routes, revision) => renderer.setRoutes(routes, revision),
    setHubLoad: (loads) => renderer.setHubLoad(loads),
    setPlanes: (previous, current) => renderer.setPlanes(previous, current),
    setCurfew: (closedIds) => renderer.setCurfew(closedIds),
    setRoutePreview: (model) => renderer.setRoutePreview(model),
  }, (code) => cityByCode(code) ?? null); // [task-34]
  let frameCallback: ((dt: number) => FrameState | void) | null = null;
  let last = performance.now();
  let raf = 0;
  // [night-11a] Settings, licences, logbook, puzzles and the tutorial cover the canvas with an opaque page; the globe
  // (menu spin, demo planes, terrain) kept drawing at full rate behind them, minutes of GPU work on a phone for nothing.
  let covered = false;
  let drawn = 0;
  // [task-39] What the first rendered menu frame used vs. the framing now (scripts/shots-34.mjs).
  let firstMenuFrame: string | null = null;
  const framingKey = (): string => `${lastFrame} zoom=${renderer.orbit.zoomLevel.toFixed(4)}`;
  if (import.meta.env.DEV) installWorldProbe(renderer, () => ({ first: firstMenuFrame, now: framingKey(), menuSpin: menuSpin(), // [task-34]
    // [night-16a] D-262: the menu tilt in use and how many (demo airport, spin angle) samples still touch an entry.
    menuTilt: menuTiltNow, menuClashes: menuActive ? (renderer.camera.updateMatrixWorld(),
      menuNetworkClashes(demoCities, entryRects(host.getBoundingClientRect()), (lon, lat, out) => renderer.project(lon, lat, 1.01, out))) : 0,
  }), () => drawn);
  /** [task-39] D-62: degrees per second the menu globe turns right now. */
  const menuSpin = (): number => menuSpinRate({
    menuActive, menuShown, reducedMotion: reducedMotion() || frozenSpin, // [night-11g] D-88 the game's switch
    hidden: typeof document !== 'undefined' && document.hidden,
  });
  const loop = (now: number): void => {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (covered && !frameCallback) return; // a running game always draws (no page covers it)
    // [night-11h] D-118: no GPU context, no frame. The run is not advanced either (same as a hidden tab): the frame
    // hook is the run's only clock, so the network waits under the notice instead of jamming unseen.
    if (renderer.contextLost()) return;
    // [task-39] A layout change since the last frame is framed before drawing, never one frame late.
    if (measureRaf) { cancelAnimationFrame(measureRaf); measure(); }
    // [task-39] First menu show: hold the globe until the sign and board are laid out (bounded).
    if (menuActive && !menuFramed && now - menuShownAt < MENU_HOLD_MS) return;
    const turn = spin || menuSpin(); // [task-39] D-62 slow menu rotation; routes ride along (world space)
    if (turn) {
      const state = renderer.orbit.getState();
      renderer.orbit.setTarget(state.longitude + turn * dt, state.latitude);
    }
    const frame = frameCallback?.(dt);
    const demoAlpha = frameCallback ? null : demo.frame(dt); // [task-34] menu planes
    if (frame) renderer.setTime(frame.tick, Math.max(0, Math.min(1, frame.alpha)));
    else {
      // Without a run, keep the sun just ahead of the view so the menu backdrop is daylit.
      const lon = renderer.orbit.getState().longitude + 25;
      renderer.setTime(Math.round(((180 - lon) * 4 % 1440 + 1440) % 1440), 0);
    }
    if (menuActive && firstMenuFrame === null) firstMenuFrame = framingKey(); // [task-39]
    renderer.render(frame ? frame.alpha : demoAlpha ?? 1, dt);
    drawn++;
  };
  raf = requestAnimationFrame(loop);
  // [night-11h] D-118: one paper strip over the globe while the graphics restart; the HUD stays readable.
  let glNotice: HTMLElement | null = null;
  const stopContextWatch = renderer.onContextChange((lost) => {
    // The lost drawing buffer paints blank white; hide it so the sky behind the canvas shows under the notice.
    canvas.style.visibility = lost ? 'hidden' : '';
    if (lost && !glNotice) {
      glNotice = document.createElement('div');
      glNotice.className = 'airway-notice airway-gl-notice';
      glNotice.dataset.testid = 'gl-lost-notice';
      glNotice.setAttribute('role', 'status');
      glNotice.textContent = t('gl.lost');
      host.append(glNotice);
    } else if (!lost) {
      glNotice?.remove();
      glNotice = null;
      last = performance.now(); // the gap is not game time
      lastFrame = ''; // re-measure the framing on the restored drawing buffer
      scheduleMeasure();
    }
  });

  return {
    renderer, canvas, camera: renderer.camera, orbit: renderer.orbit, ready: renderer.ready,
    setInsets(next) { insets = next; menuActive = false; menuShown = false; menuWatcher?.disconnect(); demo.stop(); resize(); }, // [task-34] [task-39]
    setIdleSpin(degreesPerSecond) { spin = degreesPerSecond; },
    setCovered(next) { covered = next; },
    contextLost: () => renderer.contextLost(), // [night-11h]
    showMenuBackdrop() {
      // [task-34] Mockup menu framing: horizon under the sign (portrait) or the whole disc beside the
      // board (landscape), measured from the live sign/board boxes; a still camera over a small
      // decorative network so routes and planes read above the board.
      insets = {};
      menuActive = true;
      menuShownAt = performance.now(); // [task-39]
      spin = 0;
      renderer.orbit.setTarget(MENU_TARGET.lon, MENU_TARGET.lat);
      demo.start();
      menuWatcher?.observe(host, { childList: true, subtree: true });
      resize();
    },
    setCities: (cities) => renderer.setCities(cities),
    setHubLoad: (loads) => renderer.setHubLoad(loads),
    setCurfew: (closedIds) => renderer.setCurfew(closedIds), // [night-10g]
    curfewDrawn: () => renderer.stats().curfewAirports,
    setRoutes: (routes, revision) => renderer.setRoutes(routes, revision),
    setPlanes: (previous, current) => renderer.setPlanes(previous, current),
    preview: (model) => renderer.setRoutePreview(model),
    project: (lon, lat, out) => renderer.project(lon, lat, 1.01, out),
    pickGlobe: (x, y) => renderer.pickGlobe(x, y),
    setQuality(preference) {
      forgetAdaptiveSteps(); // [night-07b] an explicit choice (also back to auto) detects afresh
      void renderer.setQuality(preference).catch((error: unknown) => console.warn('Quality change failed', error));
    },
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
      stopContextWatch();
      glNotice?.remove();
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
function installWorldProbe(renderer: WorldRenderer,
  framing: () => { first: string | null; now: string; menuSpin: number; menuTilt: number; menuClashes: number },
  frames: () => number): void {
  const probe = {
    ready: false,
    framing, // [task-39]
    frames, // [night-11a] globe frames drawn so far
    longitude: () => renderer.orbit.longitudeDeg,
    zoom: () => renderer.orbit.zoomLevel, // [night-11ai] R4g keyboard zoom e2e
    /** [N12n] Store feature graphic (scripts/store-shots.mjs --feature): set the zoom and slide the view (CSS px). */
    featureView(shiftX: number, shiftY: number, zoom: number): void {
      renderer.orbit.setZoom(zoom);
      renderer.orbit.setViewShift(shiftX, shiftY);
    },
    /** [task-40] Globe disc on screen (CSS px, page coordinates) for the store-shot warmth check. */
    disc(): { x: number; y: number; radius: number } | null {
      const disc = renderer.orbit.getScreenDisc();
      if (!disc) return null;
      const canvas = renderer.canvas.getBoundingClientRect();
      return { x: disc.x + canvas.left, y: disc.y + canvas.top, radius: disc.radius };
    },
    /** Median WCAG contrast per layer; `tags` is the worst luggage tag against the globe under it. */
    nightContrast(selector = '.airport-bubble'): Record<string, number | null> { // [task-38] selector: slot tags too
      const out: Record<string, number | null> = {};
      for (const [name, value] of Object.entries(renderer.measureLayerContrast())) out[name] = value ? value.ratio : null;
      const canvas = renderer.canvas.getBoundingClientRect();
      const tags = [...document.querySelectorAll<HTMLElement>(selector)].filter((tag) => !tag.hidden && tag.offsetParent);
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
