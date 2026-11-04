// In-game composition (task 30 integration): one run, one world, every in-game layer.
// Authority flows input → RunCommand → EndlessRun.step() at fixed 100 ms ticks → read-only
// snapshots → render / UI / audio. Nothing here writes run state except through queue().
import { pauseSummary } from './pauseSummary';
import { t } from '../i18n';
import { framingPoints } from './framing';
import { cameraGestureCallbacks, attachPointerGestures, type AttachedGestures, type GestureHit } from '../input';
import {
  RouteTool, hitTestRouteSegments, nearestCity, routeHandles,
  type ProjectedCity, type RouteToolCommand,
} from '../input/routeTool';
import { createJamHaptics, hapticCommand, hapticNetworkClosed, routeHaptics } from '../platform';
import { PLANE_TYPES, SIM_TICKS_PER_SECOND } from '../sim/params';
import { TICKS_PER_WEEK } from '../sim/upgrades';
import { calendarDayAt, calendarWeekAt } from '../sim/clock'; // [task-31]
import type { PlaneView as PlaneRenderSnapshot } from '../render';
import type { AudioCue } from '../audio/events';
import { mountAtcStrip, mountRouteContextMenu, mountRouteHandles } from '../ui/atcStrip';
import { createGameOverController, type GameOverController, type GameOverSnapshot, type RunTimeline } from '../ui/gameover';
import { buildRunTimeline } from './runTimeline'; // [night-10r]
import { mountHud, type GameSpeed, type HudController, type PlaneType } from '../ui/hud';
import { createAirportOverlay, type AirportOverlay } from '../ui/overlay';
import { resolveHudLayout } from '../ui/layout'; // [night-10x]
import { WeeklyUpgradeView } from '../ui/upgrade';
import { EndlessRun, cityDistanceKm, type RunCommand, type RunEvent } from './run';
import { mountSlotHint } from './tutorial/slot-hint'; // [task-32]
import { FirstTimeRegistry, beyondRange, curfewAirport, fillingHub } from './tutorial/first-time'; // [night-11p] R6a
import { mountFirstTimeCards } from './tutorial/first-time-card';
import { browserTutorialStorage } from './tutorial/controller';
import { airportLabel } from '../ui/airportLabel'; // [night-05] D-68
import { AudioCueMapper, cueRun } from './audioCues'; // [night-03]
import type { World, ScreenPoint } from './world';
import { NewAirportMarks } from './newAirports'; // [night-10a]
import { onSettingsChange, readSettings, saveSettings } from '../ui/settings/settings'; // [G8] D-172

/**
 * [night-11m] D-128: at the gameplay zoom and closer (the run opens at 3 of [1, 4]) every on-screen airport carries
 * its code plate; zoomed out to the whole network only hubs and the airports the UI names do.
 */
export const PLATES_ALL_ZOOM = 2.75;

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
  /** May return an extra board for the game-over screen (daily ranking, D-66). */
  onFailure?(run: EndlessRun): HTMLElement | void;
  /** [night-10e] Called right after onFailure: a daily run's share action for the report. */
  failureShare?(): GameOverSnapshot['share'] | void;
  /** [night-11f] True while the player is in their first flights: the report shows one tip. */
  failureTip?(): boolean;
  onTick?(run: EndlessRun, speed: number): void;
  /** [night-11p] R6a: one-time cards in this run (default true; DEV seeded e2e runs turn them off). */
  readonly firstTimeCards?: boolean;
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
  /** [night-07q] DEV/QA: canvas point of a visible airport the weekly board's pick accepts (from === to). */
  pickGesture(): { from: { x: number; y: number }; to: { x: number; y: number } } | null;
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
  // [G8] D-172: the globe view on the dock tag; kept in sync with Settings → Globe view.
  let globeMode = readSettings().globeMode;
  const offGlobeMode = onSettingsChange((settings) => {
    if (settings.globeMode !== globeMode) { globeMode = settings.globeMode; renderHud(); }
  });
  let accumulator = 0;
  let disposed = false;
  let renderRevision = 0;
  let lastRunRevision = -1;
  let lastRun: EndlessRun | null = null;
  let previousPlanes: PlaneRenderSnapshot[] = [];
  const knownAirports = new Set<string>();
  const newMarks = new NewAirportMarks(); // [night-10a]
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
  // [night-08b] The same bands for the airport edge buttons: in landscape the dock is a right column
  // (right 12 px, 78 px wide), so the buttons stay left of it.
  const overlayReserved = { top: 84, bottom: 96, right: 0 };
  // [night-10x] Follow the HUD's own layout: the 'foldable' layout (≥ 600 × 600, e.g. the unfolded Fold in
  // portrait) also docks on the right, but `width > height` reserved the bottom row there, so edge buttons sat on
  // the dock tags and the globe centred behind the dock.
  const applyInsets = (): void => {
    const layout = resolveHudLayout(host.clientWidth, host.clientHeight);
    const landscape = host.clientWidth > host.clientHeight;
    world.setInsets(layout === 'portrait' ? { top: 84, bottom: 96 } : { top: landscape ? 40 : 84, right: 110 });
    overlayReserved.right = layout === 'portrait' ? 0 : 96;
  };
  applyInsets();
  window.addEventListener('resize', applyInsets);

  // ---- presentation layers -------------------------------------------------------------
  const overlay: AirportOverlay = createAirportOverlay(layer, world.camera, {
    reserved: () => overlayReserved,
    project: (lon, lat, altitude, out) => world.renderer.project(lon, lat, altitude, out),
    onNavigate: (id) => {
      const city = run.cityList().find((item) => item.id === id);
      if (city) world.orbit.setTarget(city.lon, city.lat);
    },
  });
  const atc = mountAtcStrip(layer);
  const firstTimeRegistry = new FirstTimeRegistry(browserTutorialStorage()); // [night-11p] one flag per card
  const slotHint = mountSlotHint(layer, firstTimeRegistry); // [task-32] one-time departure-slot step
  const firstTime = mountFirstTimeCards(layer, firstTimeRegistry, callbacks.firstTimeCards !== false);
  let boardSeen = false;
  const handles = mountRouteHandles(layer);
  const hud: HudController = mountHud(layer, {
    onUndo: () => { if (screen !== 'gameover') tool.undo(); }, // [night-11c] the map view leaves the dock reachable
    onTogglePause: () => setPaused(!paused),
    onCycleSpeed: () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; renderHud(); },
    // [G8] D-172: the same setting as Settings → Globe view; main.ts applies it to the world.
    onToggleGlobeMode: () => { saveSettings({ globeMode: globeMode === 'map' ? 'satellite' : 'map' }); },
    onSelectPlane: (type) => { selectedPlane = type; renderHud(); },
    onAssignPlane: (type, routeId) => {
      if (screen === 'gameover') return; // [night-11c]
      hapticCommand('AssignPlane', run.queue({ type: 'AssignPlane', routeId, aircraft: type })); // [night-10f]
    },
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
      const accepted = run.queue({ type: 'ChooseUpgrade', week: command.week, upgrade: command.upgrade, ...(command.hubId ? { hubId: command.hubId } : {}) });
      hapticCommand('ChooseUpgrade', accepted); // [night-10f]
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
  // [night-10j] A flight-strip summary of the network: what is built and where the pressure is.
  const pauseSummaryList = document.createElement('dl');
  pauseSummaryList.className = 'airway-pause__summary';
  pauseSummaryList.dataset.testid = 'pause-summary';
  // Save and Menu share one row so the sheet with its summary still fits a 412 px landscape screen.
  const pauseRow = document.createElement('div');
  pauseRow.className = 'airway-pause__row';
  pauseRow.append(save, menu);
  pauseSheet.append(pauseTitle, pauseSummaryList, resume, pauseRow, pauseStatus);
  layer.append(pauseSheet);

  const gameOver: GameOverController = createGameOverController({
    host: layer,
    pauseSimulation: () => { paused = true; },
    // [night-11c] The run is paused and off the 'game' screen, so the frame hook advances nothing; it keeps the
    // airport tags on the camera (the game-over map can be turned) and the final tick's light. Detaching it
    // left the tags where they were before the camera flew to the jammed hub and lit the globe like the menu.
    freezeScene: () => undefined,
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
      syncUpgrade(true); // [night-07x] if the world is back on an open weekly board, show it (never a frozen clock)
    },
    preview: (model) => world.preview(model),
    warning: (info) => atc.show(info),
    menu: (request) => routeMenu.show(request),
    handles: (list, activeRouteId) => handles.show(list, activeRouteId),
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
  let lastCurfewKey = '';
  const closedTags = new Set<string>();
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
        overlay.addAirport({ id: city.id, code: airportLabel(city.id, 'code'), lon: city.lon, lat: city.lat, hub: city.hub,
          label: airportLabel(city.id) }); // [night-11m] D-128 plate follows the D-68 code/name setting
      }
      overlay.setHub(city.id, city.hub); // [night-11m] D-128 hubs carry their plate; deduplicated inside
      overlay.setCapacity(city.id, city.capacity); // [night-11d] edge-chip gauge; deduplicated inside
      const key = city.waiting.join(',') + '/' + city.connecting; // [night-10i] hollow transfer glyphs
      if (waitingKeys.get(city.id) !== key) {
        waitingKeys.set(city.id, key);
        overlay.setPassengers(city.id, city.waiting, city.connecting);
      }
      const seconds = city.jamTicksLeft === null ? null : Math.ceil(city.jamTicksLeft / SIM_TICKS_PER_SECOND);
      if (jamKeys.get(city.id) !== seconds) { jamKeys.set(city.id, seconds); overlay.setJamCountdown(city.id, seconds); }
      jamHaptics.setJammed(city.id, city.jamTicksLeft !== null);
      overlay.setSlotHold(city.id, city.slotHeld, city.nextSlotMinutes); // [task-38] deduplicated inside
    }
    // [night-10g] The curfew barrier: rebuilt only when the set of closed airports changes.
    const curfewKey = cities.filter((city) => city.curfewClosed).map((city) => city.id).join(',');
    // [night-11p] R6a: the first hub at 70 % of its waiting places, and the first curfew night.
    const filling = fillingHub(cities.map((city) => ({ id: city.id, hub: city.hub, waiting: city.waiting.length, capacity: city.capacity })));
    if (filling) {
      firstTime.offer('hub-full', () => ({
        tag: t('firstTime.tag.hubFull', { airport: airportLabel(filling.id), waiting: filling.waiting, capacity: filling.capacity }),
        hint: t('firstTime.hint.hubFull', { airport: airportLabel(filling.id) }),
      }));
    }
    if (curfewKey !== lastCurfewKey) {
      lastCurfewKey = curfewKey;
      const closedCity = curfewAirport(cities);
      if (closedCity) {
        firstTime.offer('curfew', () => ({
          tag: t('firstTime.tag.curfew', { airport: airportLabel(closedCity.id) }),
          hint: t('firstTime.hint.curfew', { airport: airportLabel(closedCity.id) }),
        }));
      }
      const closed = curfewKey ? curfewKey.split(',') : [];
      world.setCurfew(closed);
      // [night-10h] The same state on the luggage tag and edge chip, readable at gameplay zoom.
      for (const id of closedTags) if (!closed.includes(id) && knownAirports.has(id)) overlay.setCurfew(id, false);
      closedTags.clear();
      for (const id of closed) { closedTags.add(id); if (knownAirports.has(id)) overlay.setCurfew(id, true); }
    }
    if (force || run !== lastRun || run.revision !== lastRunRevision) {
      lastRun = run;
      lastRunRevision = run.revision;
      world.setRoutes(run.routeList(), ++renderRevision);
      tool.refreshHandles();
    }
    for (const [id, on] of newMarks.update(run.tick, renderRevision, () => run.routeList(), (id) => knownAirports.has(id))) overlay.setNew(id, on);
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
      globeMode,
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
      if (!boardSeen) { // [night-11p] R6a: after the first weekly board, say what a crate was
        boardSeen = true;
        const week = upgradeWeek;
        firstTime.offer('weekly-board', () => ({
          tag: t('firstTime.tag.weeklyBoard', { week }), hint: t('firstTime.hint.weeklyBoard'),
        }));
      }
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
        firstTime.hide(); // [night-11p] and the first-time card
      } else if (event.type === 'new-city') {
        newMarks.opened(event.cityId, run.tick); // [night-10a]
        const rangeKm = PLANE_TYPES.turboprop.rangeKm; // [night-11p] R6a: first airport out of turboprop reach
        const km = beyondRange(event.cityId, run.cityList().map((city) => city.id), rangeKm, cityDistanceKm);
        if (km !== null) {
          const id = event.cityId;
          firstTime.offer('out-of-range', () => ({
            tag: t('firstTime.tag.outOfRange', { airport: airportLabel(id), km: Math.round(km / 10) * 10 }),
            hint: t('firstTime.hint.outOfRange', { airport: airportLabel(id), range: rangeKm }),
          }));
        }
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
    firstTime.flush(slotHint.visible || screen !== 'game'); // [night-11p] one card at a time, only in play
    const failure = run.failed;
    if (failure && screen !== 'gameover') {
      setScreen('gameover');
      hapticNetworkClosed(); // [night-10f]
      tool.pointerCancel(ROUTE_POINTER);
      handles.show([]); // [night-11c] route-end handles are edit controls; they stayed pinned where the camera was
      const extra = callbacks.onFailure?.(run) ?? undefined; // [night-06c]
      const share = callbacks.failureShare?.() ?? undefined; // [night-10e]
      const tip = run.mode !== 'puzzle' && (callbacks.failureTip?.() ?? false); // [night-11f]
      const flights = failure.departures.map((departure, i) => ({
        originHubId: failure.cityId, flightNumber: 'AW' + String(101 + i),
        destinationCode: airportLabel(departure.destination, 'code'), gate: String.fromCharCode(65 + (i % 6)) + String(1 + i),
      }));
      void gameOver.show({
        seed: run.seed, initialHash: '', hubId: failure.cityId, hubCode: airportLabel(failure.cityId),
        delivered: run.passengers, completedWeeks: Math.floor(failure.tick / TICKS_PER_WEEK),
        ledger: failure.ledger, departures: flights, ...(extra ? { extra } : {}), ...(share ? { share } : {}),
        ...(run.mode === 'puzzle' ? {} : { timeline: runTimelineLoader(run) }), ...(tip ? { tip } : {}),
        spareAircraft: run.inventory.turboprop + run.inventory.widebody, // [night-12y] R8b
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
  function fillPauseSummary(): void {
    const spare = run.inventory.turboprop + run.inventory.widebody;
    const rows = pauseSummary({
      routes: run.routeList().length, assigned: run.assignments, spare,
      hubs: run.hubPressure(),
      minutesToBoard: run.mode === 'puzzle' ? null : run.nextWeekTick - run.tick,
    });
    pauseSummaryList.replaceChildren(...rows.flatMap((row) => {
      const term = document.createElement('dt');
      term.textContent = row.label;
      const value = document.createElement('dd');
      value.textContent = row.value;
      value.dataset.row = row.key;
      return [term, value];
    }));
  }
  function setPaused(next: boolean): void {
    if (screen === 'gameover') return;
    paused = next;
    pauseTitle.textContent = t('pause.title');
    resume.textContent = t('action.resume');
    save.textContent = t('action.save');
    menu.textContent = t('action.menu');
    pauseStatus.textContent = '';
    if (paused) fillPauseSummary();
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
    overlay.setZoomedIn(world.orbit.zoomLevel >= PLATES_ALL_ZOOM); // [night-11m] D-128; deduplicated inside
    overlay.update();
    if (tool.drawing || screen === 'game') tool.refreshHandles();
    return { tick: run.clockMinute, alpha: Math.max(0, Math.min(1, accumulator)) };
  });
  const cities = run.cityList();
  // [night-07z] Frame the densest cluster when the airports span several continents (never an empty ocean).
  world.orbit.fitNetwork(framingPoints(cities.map((city) => ({ lon: city.lon, lat: city.lat, hub: city.hub }))));
  world.orbit.setZoom(3);
  syncWorld(true);
  syncUpgrade();
  // [night-08d] Measure the boarding pass and dock now that they are mounted: the first frame (and the first
  // gesture) already has the final framing instead of the pre-HUD bands until a resize observer fires.
  applyInsets();
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
    pickGesture() {
      // Clear of the boarding pass, the yellow sign above the globe, the dock and the screen edge.
      const w = world.canvas.clientWidth;
      const h = world.canvas.clientHeight;
      const sign = upgradeHost.querySelector('.airway-upgrade-sign')?.getBoundingClientRect();
      const canvas = world.canvas.getBoundingClientRect();
      const top = Math.max(100, (sign ? sign.bottom - canvas.top : 0) + 24);
      const target = projectedCities().find((c) => hubSelection.includes(c.id) && c.visible &&
        c.x > 40 && c.x < w - 120 && c.y > top && c.y < h - 120);
      return target ? { from: { x: target.x, y: target.y }, to: { x: target.x, y: target.y } } : null;
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
      if (screen === 'gameover') { if (!gameOver.back()) callbacks.onMenu(); return true; } // [night-11c] map view first
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
      firstTime.dispose();
      overlay.dispose();
      hud.destroy();
      offGlobeMode();
      gameOver.dispose();
      jamHaptics.reset();
      layer.remove();
    },
  };
}

/**
 * [night-10r] Game-over timeline: the journal, rules and weekly choices are copied now, and the throw-away replay
 * (src/game/runTimeline.ts) runs only when the player opens the tab, in slices between frames.
 */
function runTimelineLoader(run: EndlessRun): () => Promise<RunTimeline | null> {
  const input = {
    seed: run.seed, config: run.sim.config, journal: run.sim.getCommandLog(), endTick: run.sim.tickCount,
    endMinute: run.sim.world.minute, upgrades: run.sim.world.upgrades.map((record) => ({ ...record })),
    outcomes: run.sim.getCommandOutcomes(), // [night-10t] only a resumed save's prefix is replayed
  };
  // [night-10t] Built once per report: reopening the tab must not replay the run again.
  let built: Promise<RunTimeline | null> | null = null;
  return () => built ??= (async () => {
    const weeks = await buildRunTimeline(input, () => new Promise((resolve) => setTimeout(resolve, 0)));
    if (!weeks) return null;
    return {
      weeks: weeks.map((week) => week.pick?.hubId ? { ...week, pick: { ...week.pick, hubId: airportLabel(week.pick.hubId) } } : week),
      endDay: calendarDayAt(input.endMinute),
    };
  })();
}
