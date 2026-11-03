// In-game composition (task 30 integration): one run, one world, every in-game layer.
// Authority flows input → RunCommand → EndlessRun.step() at fixed 100 ms ticks → read-only
// snapshots → render / UI / audio. Nothing here writes run state except through queue().
import { t } from '../i18n';
import { cameraGestureCallbacks, attachPointerGestures, type AttachedGestures, type GestureHit } from '../input';
import {
  RouteTool, hitTestRouteSegments, nearestCity, routeHandles,
  type ProjectedCity, type RouteToolCommand,
} from '../input/routeTool';
import { createJamHaptics, routeHaptics } from '../platform';
import { PLANE_TYPES, SIM_TICKS_PER_SECOND } from '../sim/params';
import { TICKS_PER_WEEK } from '../sim/upgrades';
import { calendarDayAt, calendarWeekAt } from '../sim/clock'; // [task-31]
import type { PlaneView as PlaneRenderSnapshot } from '../render';
import type { AudioCue } from '../audio/events';
import { mountAtcStrip, mountRouteContextMenu, mountRouteHandles } from '../ui/atcStrip';
import { createGameOverController, type GameOverController } from '../ui/gameover';
import { mountHud, type GameSpeed, type HudController, type PlaneType } from '../ui/hud';
import { createAirportOverlay, type AirportOverlay } from '../ui/overlay';
import { WeeklyUpgradeView } from '../ui/upgrade';
import { EndlessRun, cityDistanceKm, type RunCommand, type RunEvent } from './run';
import { mountSlotHint } from './tutorial/slot-hint'; // [task-32]
import { airportLabel } from '../ui/airportLabel'; // [night-05] D-68
import { AudioCueMapper, cueRun } from './audioCues'; // [night-03]
import type { World, ScreenPoint } from './world';

export type SessionScreen = 'game' | 'upgrade' | 'gameover';
export type RunMode = 'endless' | 'daily';
const MAX_CATCH_UP_TICKS = 40;

export interface SessionCallbacks {
  readonly mode: RunMode;
  onScreen(screen: SessionScreen): void;
  /** Leave the run (pause sheet or game-over board). */
  onMenu(): void;
  onRestart(seed: number): void;
  onSave(run: EndlessRun): Promise<boolean>;
  onFailure?(run: EndlessRun): void;
  onTick?(run: EndlessRun, speed: number): void;
  cue?(cue: AudioCue): void;
}

export interface GameSession {
  readonly screen: SessionScreen;
  readonly run: EndlessRun;
  /** Advance the authoritative clock synchronously (dev handle / tests). */
  advance(ticks: number): void;
  setPaused(paused: boolean): void;
  /** Screen points (canvas CSS px) for a route-drawing drag between two reachable cities. */
  routeGesture(): { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  planeGesture(): { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  forceOverload(): void;
  /** Android back / Escape: closes the topmost in-game layer; returns false when nothing was open. */
  back(): boolean;
  dispose(): void;
}

function button(className: string, label: string, testId: string, onClick: () => void): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  node.dataset.testid = testId;
  node.addEventListener('click', onClick);
  return node;
}

export function startSession(host: HTMLElement, world: World, initial: EndlessRun, callbacks: SessionCallbacks): GameSession {
  let run = initial;
  let screen: SessionScreen = 'game';
  let paused = false;
  let speed: GameSpeed = 1;
  let slow = 1;
  let selectedPlane: PlaneType = 'turboprop';
  let accumulator = 0;
  let disposed = false;
  let renderRevision = 0;
  let lastRunRevision = -1;
  let lastRun: EndlessRun | null = null;
  let previousPlanes: PlaneRenderSnapshot[] = [];
  const knownAirports = new Set<string>();
  const audioCues = callbacks.cue ? new AudioCueMapper(callbacks.cue) : null; // [night-03]
  let lastHubKey = '';
  const waitingKeys = new Map<string, string>();
  const jamKeys = new Map<string, number | null>();
  const jamHaptics = createJamHaptics();
  const point: ScreenPoint = { x: 0, y: 0, visible: false };

  const layer = document.createElement('div');
  layer.className = 'airway-game-layer';
  host.append(layer);

  world.reset();
  world.setIdleSpin(0);
  // Keep the globe clear of the boarding pass and the tag dock (bottom in portrait, right in landscape).
  const applyInsets = (): void => {
    const landscape = host.clientWidth > host.clientHeight;
    world.setInsets(landscape ? { top: 40, right: 110 } : { top: 84, bottom: 96 });
  };
  applyInsets();
  window.addEventListener('resize', applyInsets);

  // ---- presentation layers -------------------------------------------------------------
  const overlay: AirportOverlay = createAirportOverlay(layer, world.camera, {
    reservedTop: 84, reservedBottom: 96,
    project: (lon, lat, altitude, out) => world.renderer.project(lon, lat, altitude, out),
    onNavigate: (id) => {
      const city = run.cityList().find((item) => item.id === id);
      if (city) world.orbit.setTarget(city.lon, city.lat);
    },
  });
  const atc = mountAtcStrip(layer);
  const slotHint = mountSlotHint(layer); // [task-32] one-time departure-slot step
  const handles = mountRouteHandles(layer);
  const hud: HudController = mountHud(layer, {
    onUndo: () => tool.undo(),
    onTogglePause: () => setPaused(!paused),
    onCycleSpeed: () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; renderHud(); },
    onSelectPlane: (type) => { selectedPlane = type; renderHud(); },
    onAssignPlane: (type, routeId) => { run.queue({ type: 'AssignPlane', routeId, aircraft: type }); },
    routeAtPoint: (clientX, clientY) => {
      const rect = world.canvas.getBoundingClientRect();
      return hitTestRouteSegments(networkRoutes(), projectedCities(), clientX - rect.left, clientY - rect.top, 24);
    },
  });
  const upgradeHost = document.createElement('div');
  upgradeHost.className = 'airway-upgrade-host';
  layer.append(upgradeHost);
  let hubSelection: readonly string[] = [];
  const upgrade = new WeeklyUpgradeView(upgradeHost, {
    onCommand: (command) => {
      run.queue({ type: 'ChooseUpgrade', week: command.week, upgrade: command.upgrade, ...(command.hubId ? { hubId: command.hubId } : {}) });
      audioCues?.command('ChooseUpgrade'); // [night-03]
      run.resolveBoundary();
      syncUpgrade(true);
    },
    onCancelPick: (week) => cancelPick(week), // [task-39]
    onPreviewModel: (container, kind) => {
      // The real low-poly model, rendered through the shared WebGL context into a 2D canvas.
      // Measured on the next frame, once the board is in the document.
      requestAnimationFrame(() => {
        if (!container.isConnected) return;
        const canvas = document.createElement('canvas');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(Math.max(64, container.clientWidth) * dpr);
        canvas.height = Math.round(Math.max(64, container.clientHeight) * dpr);
        container.append(canvas);
        if (world.renderer.drawModelPreview(kind, canvas)) container.classList.add('has-model');
        else canvas.remove();
      });
    },
    onHubSelectionMode: (active, hubIds) => { hubSelection = active ? hubIds : []; layer.classList.toggle('is-selecting-hub', active); },
  });
  let upgradeWeek = 0;

  const pauseSheet = document.createElement('section');
  pauseSheet.className = 'airway-pause';
  pauseSheet.setAttribute('role', 'dialog');
  pauseSheet.setAttribute('aria-modal', 'true');
  pauseSheet.hidden = true;
  const pauseTitle = document.createElement('h2');
  const pauseStatus = document.createElement('p');
  pauseStatus.className = 'airway-pause__status';
  pauseStatus.setAttribute('role', 'status');
  const resume = button('airway-pause__button airway-pause__button--primary', '', 'action-resume', () => setPaused(false));
  const save = button('airway-pause__button', '', 'action-save', () => {
    void callbacks.onSave(run).then((ok) => { pauseStatus.textContent = t(ok ? 'save.done' : 'save.failed'); });
  });
  const menu = button('airway-pause__button', '', 'action-menu', () => callbacks.onMenu());
  pauseSheet.append(pauseTitle, resume, save, menu, pauseStatus);
  layer.append(pauseSheet);

  const gameOver: GameOverController = createGameOverController({
    host: layer,
    pauseSimulation: () => { paused = true; },
    freezeScene: () => { world.onFrame(null); },
    focusHub: (hubId, progress) => {
      const city = run.cityList().find((item) => item.id === hubId);
      if (!city) return;
      const state = world.orbit.getState();
      world.orbit.setTarget(state.longitude + (city.lon - state.longitude) * progress,
        state.latitude + (city.lat - state.latitude) * progress);
    },
    restartSameWorld: (identity) => callbacks.onRestart(identity.seed),
    restartNewWorld: (seed) => callbacks.onRestart(seed),
    returnToMenu: () => callbacks.onMenu(),
  });

  // ---- adapters between the run and input/render -----------------------------------------
  function projectedCities(): ProjectedCity[] {
    return run.cityList().map((city) => {
      world.project(city.lon, city.lat, point);
      return { id: city.id, lon: city.lon, lat: city.lat, x: point.x, y: point.y, visible: point.visible };
    });
  }
  function networkRoutes(): { id: string; cityIds: readonly string[]; aircraft: PlaneType }[] {
    return run.routeList();
  }
  function toRunCommand(command: RouteToolCommand): RunCommand | null {
    switch (command.type) {
      case 'AddRoute': return { type: 'AddRoute', cityIds: command.cityIds, aircraft: command.aircraft };
      case 'ExtendRoute': return { type: 'ExtendRoute', routeId: command.routeId, end: command.end, cityIds: command.cityIds };
      case 'RemoveRoute': return { type: 'RemoveRoute', routeId: command.routeId };
      case 'ShortenRoute': return { type: 'ShortenRoute', routeId: command.routeId, end: command.end };
      case 'SetSpeed': return null;
    }
  }

  const routeMenu = mountRouteContextMenu(layer, {
    remove: () => tool.removeRoute(),
    shorten: () => tool.shortenRoute(),
    close: () => tool.closeMenu(),
  });
  const tool: RouteTool = new RouteTool({
    cities: projectedCities,
    routes: networkRoutes,
    selectedAircraft: () => selectedPlane,
    aircraft: (type) => ({ type, rangeKm: PLANE_TYPES[type].rangeKm }),
    distanceKm: cityDistanceKm,
    cursorGeo: (x, y) => world.pickGlobe(x, y),
    speed: () => (paused ? 0 : slow),
    dispatch: (command) => {
      if (command.type === 'SetSpeed') { slow = command.speed === 0 ? slow : command.speed; return true; }
      const mapped = toRunCommand(command);
      const accepted = mapped ? run.queue(mapped) : false;
      if (accepted && mapped) audioCues?.command(mapped.type); // [night-03]
      return accepted;
    },
    undo: () => {
      const previous = run.undo();
      if (!previous) return;
      run = previous;
      previousPlanes = [];
      syncWorld(true);
    },
    preview: (model) => world.preview(model),
    warning: (info) => atc.show(info),
    menu: (request) => routeMenu.show(request),
    handles: (list) => handles.show(list),
    haptics: routeHaptics,
  });

  const hitTest = (x: number, y: number, radius: number): GestureHit => {
    const cities = projectedCities();
    const city = nearestCity(cities, x, y, radius);
    if (city) return { kind: 'city', id: city.id };
    for (const handle of routeHandles(networkRoutes(), cities)) {
      if ((handle.x - x) ** 2 + (handle.y - y) ** 2 <= 24 * 24) return { kind: 'route-handle', id: handle.routeId };
    }
    const route = hitTestRouteSegments(networkRoutes(), cities, x, y);
    return route ? { kind: 'route-body', id: route } : { kind: 'empty' };
  };
  const ROUTE_POINTER = 1;
  const gestures: AttachedGestures = attachPointerGestures(world.canvas, cameraGestureCallbacks(world.orbit, {
    hitTest,
    onRouteStart: (_hit, x, y) => { if (screen === 'game' && !paused) tool.pointerDown(ROUTE_POINTER, x, y); },
    onRouteMove: (x, y) => tool.pointerMove(ROUTE_POINTER, x, y),
    onRouteEnd: (x, y) => { tool.pointerUp(ROUTE_POINTER, x, y); },
    onRouteCancel: () => tool.pointerCancel(ROUTE_POINTER),
    onContextMenu: (_hit, x, y) => { tool.longPress(x, y); },
    onTap: (hit) => {
      if (hit.kind === 'city' && hubSelection.includes(hit.id)) upgrade.selectHub(hit.id);
    },
  }));

  // ---- read-only sync -----------------------------------------------------------------------
  function syncWorld(force = false): void {
    const cities = run.cityList();
    const hubKey = cities.map((city) => city.id + (city.hub ? '*' : '')).join(',');
    if (hubKey !== lastHubKey) {
      lastHubKey = hubKey;
      world.setCities(cities.map((city) => ({ id: city.id, lon: city.lon, lat: city.lat, hub: city.hub })));
    }
    world.setHubLoad(cities.filter((city) => city.hub)
      .map((city) => ({ id: city.id, used: Math.min(city.waiting.length, city.capacity), cap: city.capacity })));
    for (const city of cities) {
      if (!knownAirports.has(city.id)) {
        knownAirports.add(city.id);
        // D-68: the 58 px edge chip has no room for a city name, so it always shows the code.
        overlay.addAirport({ id: city.id, code: city.id, lon: city.lon, lat: city.lat, hub: city.hub });
      }
      const key = city.waiting.join(',');
      if (waitingKeys.get(city.id) !== key) { waitingKeys.set(city.id, key); overlay.setPassengers(city.id, city.waiting); }
      const seconds = city.jamTicksLeft === null ? null : Math.ceil(city.jamTicksLeft / SIM_TICKS_PER_SECOND);
      if (jamKeys.get(city.id) !== seconds) { jamKeys.set(city.id, seconds); overlay.setJamCountdown(city.id, seconds); }
      jamHaptics.setJammed(city.id, city.jamTicksLeft !== null);
      overlay.setSlotHold(city.id, city.slotHeld, city.nextSlotMinutes); // [task-38] deduplicated inside
    }
    if (force || run !== lastRun || run.revision !== lastRunRevision) {
      lastRun = run;
      lastRunRevision = run.revision;
      world.setRoutes(run.routeList(), ++renderRevision);
      tool.refreshHandles();
    }
    const planes: PlaneRenderSnapshot[] = run.planeList();
    world.setPlanes(previousPlanes.length ? previousPlanes : planes, planes);
    previousPlanes = planes;
    renderHud();
  }
  function renderHud(): void {
    const clock = run.localMinute;
    const stock = run.inventory;
    hud.render({
      // [task-31] Calendar week/day from the sim clock (D-40, 3-day week); at a weekly board it still
      // shows the week just finished with a full day bar.
      week: calendarWeekAt(run.clockMinute),
      day: calendarDayAt(run.clockMinute),
      timeMinutes: ((clock % 1440) + 1440) % 1440,
      passengers: run.passengers,
      paused, speed, canUndo: run.networkUndoable,
      selectedPlane,
      stock: { turboprop: stock.turboprop, widebody: stock.widebody, hub: stock.hub },
    });
  }
  /** [task-39] Back from the hub/airport pick to the week's crates: one journaled sim command (D-49). */
  function cancelPick(week: number): void {
    run.queue({ type: 'CancelUpgradePick', week });
    run.resolveBoundary();
    syncUpgrade(true);
  }
  function syncUpgrade(force = false): void {
    const state = run.weeklyUpgrade;
    if (state && (force || state.week !== upgradeWeek || state.pendingHub)) {
      upgradeWeek = state.week;
      upgrade.render(state, run.hubPressure(), run.slotPressure()); // [task-32] airports for "+2 slots"
      setScreen('upgrade');
    } else if (!state && screen === 'upgrade') {
      upgrade.render(null, []);
      setScreen('game');
    }
  }
  function setScreen(next: SessionScreen): void {
    if (screen === next) return;
    screen = next;
    callbacks.onScreen(next);
  }
  function emit(events: readonly RunEvent[]): void {
    audioCues?.events(events, cueRun(run)); // [night-03]
    for (const event of events) {
      if (event.type === 'week') {
        slotHint.hide(); // [task-32] the weekly board replaces the hint
      } else if (event.type === 'slot-held') { // [task-32]
        slotHint.held(event.cityId, event.limit, event.minutesToSlot);
      }
    }
  }
  function afterTicks(): void {
    emit(run.drainEvents());
    audioCues?.hourly(cueRun(run)); // [night-03]
    syncWorld();
    syncUpgrade();
    const failure = run.failed;
    if (failure && screen !== 'gameover') {
      setScreen('gameover');
      tool.pointerCancel(ROUTE_POINTER);
      callbacks.onFailure?.(run);
      const flights = failure.departures.map((departure, i) => ({
        originHubId: failure.cityId, flightNumber: 'AW' + String(101 + i),
        destinationCode: departure.destination, gate: String.fromCharCode(65 + (i % 6)) + String(1 + i),
      }));
      void gameOver.show({
        seed: run.seed, initialHash: '', hubId: failure.cityId, hubCode: airportLabel(failure.cityId),
        delivered: run.passengers, completedWeeks: Math.floor(failure.tick / TICKS_PER_WEEK),
        ledger: failure.ledger, departures: flights,
      });
    }
  }
  function advance(ticks: number): void {
    let stepped = 0;
    for (let i = 0; i < ticks; i++) {
      if (!run.step()) break;
      stepped++;
      callbacks.onTick?.(run, paused ? 0 : speed * slow);
    }
    if (stepped || run.weeklyUpgrade || run.failed) afterTicks();
  }
  function setPaused(next: boolean): void {
    if (screen === 'gameover') return;
    paused = next;
    pauseTitle.textContent = t('pause.title');
    resume.textContent = t('action.resume');
    save.textContent = t('action.save');
    menu.textContent = t('action.menu');
    pauseStatus.textContent = '';
    pauseSheet.hidden = !paused;
    if (paused) resume.focus({ preventScroll: true });
    renderHud();
  }

  world.onFrame((dt) => {
    if (!disposed && !paused && screen === 'game') {
      accumulator += dt * SIM_TICKS_PER_SECOND * speed * slow;
      const ticks = Math.min(MAX_CATCH_UP_TICKS, Math.floor(accumulator));
      accumulator = Math.min(accumulator - ticks, 1);
      if (ticks > 0) advance(ticks);
    }
    overlay.update();
    if (tool.drawing || screen === 'game') tool.refreshHandles();
    return { tick: run.clockMinute, alpha: Math.max(0, Math.min(1, accumulator)) };
  });
  const cities = run.cityList();
  world.orbit.fitNetwork(cities.map((city) => ({ lon: city.lon, lat: city.lat })));
  world.orbit.setZoom(3);
  syncWorld(true);
  syncUpgrade();
  callbacks.onScreen('game');

  function dragBetween(a: ProjectedCity, b: ProjectedCity) { return { from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y } }; }
  return {
    get screen() { return screen; },
    get run() { return run; },
    advance,
    setPaused,
    routeGesture() {
      // Only airports clear of the boarding pass, the dock and the screen edge are actionable.
      const w = world.canvas.clientWidth;
      const h = world.canvas.clientHeight;
      const list = projectedCities().filter((c) => c.visible && c.x > 40 && c.x < w - 120 && c.y > 100 && c.y < h - 120);
      const rangeKm = PLANE_TYPES[selectedPlane].rangeKm;
      for (const a of list) for (const b of list) {
        const km = cityDistanceKm(a.id, b.id);
        if (a.id < b.id && km > 0 && km <= rangeKm && Math.hypot(a.x - b.x, a.y - b.y) > 60) return dragBetween(a, b);
      }
      return null;
    },
    planeGesture() {
      const route = run.routeList().find((item) => run.inventory[item.aircraft] > 0);
      if (!route) return null;
      const byId = new Map(projectedCities().map((city) => [city.id, city]));
      const a = byId.get(route.cityIds[0]);
      const b = byId.get(route.cityIds[1]);
      const tag = layer.querySelector<HTMLElement>(`[data-hud-action="${route.aircraft}"]`);
      if (!a || !b || !tag) return null;
      const box = tag.getBoundingClientRect();
      const canvas = world.canvas.getBoundingClientRect();
      return { from: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
        to: { x: canvas.left + (a.x + b.x) / 2, y: canvas.top + (a.y + b.y) / 2 } };
    },
    forceOverload() {
      // QA: let real demand overflow a terminal with no new routes; answer weekly boards with a
      // real ChooseUpgrade so the clock keeps running. No state is written outside Commands.
      for (let guard = 0; guard < 400 && !run.failed; guard++) {
        const offer = run.weeklyUpgrade;
        if (offer && !offer.pendingHub) {
          // [task-32] '+2 slots' also waits for an airport pick, so take an aircraft (always offered).
          const pick = offer.offers.find((item) => item.id !== 'hub-expansion' && item.id !== 'departure-slots') ?? offer.offers[0];
          if (pick) run.queue({ type: 'ChooseUpgrade', week: offer.week, upgrade: pick.id });
        }
        advance(500);
      }
    },
    back() {
      if (screen === 'gameover') { callbacks.onMenu(); return true; }
      if (screen === 'upgrade') {
        // The weekly board must be answered; from the airport pick, back returns to the crates. [task-39]
        const offer = run.weeklyUpgrade;
        if (offer?.pendingHub) cancelPick(offer.week);
        return true;
      }
      setPaused(!paused);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      world.onFrame(null);
      window.removeEventListener('resize', applyInsets);
      world.preview(null);
      gestures.dispose();
      routeMenu.dispose();
      handles.dispose();
      atc.dispose();
      slotHint.dispose();
      overlay.dispose();
      hud.destroy();
      gameOver.dispose();
      jamHaptics.reset();
      layer.remove();
    },
  };
}
