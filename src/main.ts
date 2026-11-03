// Composition root: boot → split-flap departures menu → Endless / Daily / Puzzles / Settings.
// It wires modules through their public APIs only; rules live in src/sim (via src/game/run.ts),
// drawing in src/render (via src/game/world.ts) and presentation in src/ui.
import './ui/fonts.css';
import './ui/base.css';
import './ui/theme/theme.css';
import './ui/game.css';
import { bootAudio, audioSettingsFromToggles } from './audio';
import { dailyKey } from './core/daily';
import { PUZZLES } from './data/puzzles';
import { registerDevGameAdapter, type AwDevState, type AwScreen } from './game/devHandle';
import { createDailyMode } from './game/modes/daily';
import { dailyRankingBoard } from './game/dailyRanking'; // [night-06c] D-66
import { createBrowserLeaderboards } from './net'; // [night-06c] D-66
import { EndlessRun } from './game/run';
import { readGame, restoreSimFromSave, saveSourceFromSim, writeGame } from './game/save';
import { LocalScoreService } from './game/scores';
import { mountScreens, type ScreenName } from './game/screens';
import { startSession, type GameSession, type RunMode, type SessionScreen } from './game/session';
import { mountTutorial } from './game/tutorial';
import { TUTORIAL_KEY } from './game/tutorial/controller';
import { createWorld, type World } from './game/world';
import { getLanguage, t } from './i18n';
import { configureHaptics, createDefaultStorage, GameLifecycle, type KeyValueStorage } from './platform';
import { initializeAccessibility } from './ui/a11y';
import { readBestRecord } from './ui/gameover/storage';
import { mountPuzzleSelector, readPuzzleProgress } from './ui/puzzles';
import { onSettingsChange, readSettings } from './ui/settings/settings';
import { TICKS_PER_WEEK } from './sim/clock'; // [task-31] single week length (D-40)
import { NOVEMBER_SUBSOLAR_LATITUDE_DEG } from './render/sun'; // [task-40] store `game` scene light

const mount = document.getElementById('app');
if (!mount) throw new Error('Missing #app mount point');
const app: HTMLElement = mount;
document.documentElement.lang = getLanguage();
initializeAccessibility();
document.title = t('app.title');
const query = new URLSearchParams(location.search);
/** [task-36] Ticks of autoplay before a store scene is lit (game, night, failure). */
const STORE_SHOT_PLAY_TICKS = 1500;
/**
 * [task-40] D-63: sun elevation (dot of the surface normal and the sun direction, daynight.ts units) wanted
 * over the network centroid in the store `game` scene. Just on the sunny side of the terminator, inside the
 * warm ±DUSK_HALF_WIDTH band, so the network sits in golden low-sun light with long shadows, not daylight
 * (on seed 0xA1A1: hour angle −70.7° at 31.2°E 38.2°N, about 17:05 on the boarding pass).
 */
const STORE_GAME_SUN_DOT = 0.05;

// The airport-model fixture lives in dev/world.html (render agent, shared world renderer).
if (import.meta.env.DEV && query.get('preview') === 'gameover') {
  void import('./ui/gameover/preview').then(({ mountGameOverPreview }) => mountGameOverPreview(app));
} else if (query.get('perf') === 'scene') {
  // scripts/perf-scene.ts mounts its own fixture; the game must not open a second WebGL context.
} else {
  void boot();
}

interface SavedSummary { readonly mode: RunMode; readonly week: number; readonly passengers: number }

async function boot(): Promise<void> {
  configureHaptics({ isEnabled: () => readSettings().haptics });
  const { audio } = bootAudio({ toggles: readSettings() });
  let appliedQuality = readSettings().graphics;
  onSettingsChange((settings) => {
    audio.setSettings(audioSettingsFromToggles(settings));
    if (settings.graphics !== appliedQuality) { appliedQuality = settings.graphics; world?.setQuality(settings.graphics); }
    document.title = t('app.title');
  });

  let world: World | null = null;
  try {
    world = createWorld(app, t('canvas.label'), readSettings().graphics);
    world.showMenuBackdrop();
  } catch (error) {
    console.error('WebGL is unavailable; the menu stays on the flat sky.', error);
  }

  const storage: KeyValueStorage = await createDefaultStorage();
  const scores = new LocalScoreService();
  const daily = createDailyMode(scores);
  // [night-06c] D-66: off without VITE_FIREBASE_* config; otherwise retry queued daily runs at start.
  const leaderboards = createBrowserLeaderboards(import.meta.env);
  void leaderboards.flush();
  let saved: SavedSummary | null = null;
  let session: GameSession | null = null;
  let pendingSeed: number | null = null;
  let skipTutorialOnce = false;
  let dailySession: ReturnType<typeof daily.start> | null = null;

  const loaded = await readGame(storage);
  if (loaded.status === 'ok') {
    const sim = restoreSimFromSave(loaded.save);
    if (sim) {
      const run = new EndlessRun(sim);
      saved = summary(run);
    }
  }

  function summary(run: EndlessRun): SavedSummary {
    return { mode: run.mode === 'daily' ? 'daily' : 'endless', week: Math.floor(run.clockMinute / TICKS_PER_WEEK) + 1, /* [task-31] */ passengers: run.passengers };
  }

  let screenName: AwScreen = 'menu';
  const screens = mountScreens(app, {
    getMenuData: () => {
      const progress = readPuzzleProgress();
      let best: number | null = null;
      try { best = readBestRecord(globalThis.localStorage)?.score ?? null; } catch { /* Storage blocked. */ }
      return {
        bestPassengers: best,
        solvedPuzzles: Object.keys(progress).length,
        totalPuzzles: PUZZLES.length,
        dailyNew: !scores.getProgress(dailyKey()).officialUsed,
        saved: saved ? { week: saved.week, passengers: saved.passengers } : null,
      };
    },
    onMode: (mode) => {
      if (mode === 'continue') void continueSaved();
      else if (mode === 'endless') startEndless(pendingSeed ?? freshSeed());
      else if (mode === 'daily') startDaily();
      else openPuzzles();
    },
    onScreen: (name: ScreenName) => {
      if (name !== 'game') {
        if (session) { endSession(); world?.reset(); }
        world?.showMenuBackdrop();
        screenName = name === 'settings' || name === 'licenses' ? 'settings' : 'menu';
      }
    },
    onLanguageChanged: () => { document.title = t('app.title'); },
    onReplayTutorial: () => openTutorial(() => screens.show('menu'), true),
  });

  function freshSeed(): number {
    const random = new Uint32Array(1);
    globalThis.crypto.getRandomValues(random);
    return random[0] ?? 1;
  }
  function endSession(): void {
    session?.dispose();
    session = null;
  }

  const lifecycle = new GameLifecycle({
    getTick: () => session?.run.tick ?? 0,
    pause: () => session?.setPaused(true),
    save: async () => { if (session && !session.run.failed) await saveRun(session.run); },
    requireResume: () => session?.setPaused(true),
    onError: (error) => console.warn('Lifecycle save failed', error),
  });
  void lifecycle.attach();

  async function saveRun(run: EndlessRun): Promise<boolean> {
    const result = await writeGame(storage, saveSourceFromSim(run.sim));
    if (result.ok) saved = summary(run);
    return result.ok;
  }

  function openGame(run: EndlessRun, mode: RunMode): void {
    if (!world) return;
    endSession();
    const view = document.createElement('div');
    view.className = 'airway-game-screen';
    screens.open('game', { element: view, back: () => session?.back() ?? false });
    // The router's onScreen('game') does not tear down; build the session after it.
    session = startSession(app, world, run, {
      mode,
      onScreen: (next: SessionScreen) => { screenName = next; },
      onMenu: () => screens.show('menu'),
      onRestart: (seed) => { if (mode === 'daily') screens.show('menu'); else startEndless(seed); },
      onSave: saveRun,
      onFailure: (failed) => {
        let ranking: HTMLElement | undefined;
        if (mode === 'daily' && dailySession?.status === 'started') {
          daily.finish(dailySession.session, failed.passengers, Math.floor(failed.tick / TICKS_PER_WEEK), []); // [task-31]
          ranking = dailyRankingBoard(leaderboards, failed, dailySession.session); // [night-06c]
          dailySession = null;
        }
        saved = null;
        void storage.remove('aw-save-v1').catch(() => undefined);
        return ranking;
      },
      onTick: (current, speed) => {
        audio.setSimClock(current.clockMinute, speed);
        lifecycle.onTick(current.tick);
      },
      cue: (cue) => { audio.emit(cue); },
    });
    world.setIdleSpin(0);
  }

  /** Training vignette; `then` runs once after it is completed or skipped. */
  function openTutorial(then: () => void, replay = false): void {
    const tutorialHost = document.createElement('div');
    tutorialHost.className = 'airway-tutorial-screen';
    const tutorial = mountTutorial(tutorialHost);
    if (replay) tutorial.controller.replay();
    let done = false;
    const unsubscribe = tutorial.controller.subscribe((state) => {
      if (state.visible || done) return;
      done = true;
      queueMicrotask(() => { unsubscribe(); then(); });
    });
    screens.open('tutorial', { element: tutorialHost, dispose: () => { unsubscribe(); tutorial.dispose(); } });
    screenName = 'menu';
  }

  function startEndless(seed: number): void {
    pendingSeed = null;
    const firstRun = (() => {
      try { return !globalThis.localStorage?.getItem(TUTORIAL_KEY); } catch { return false; }
    })();
    if (skipTutorialOnce || !firstRun) {
      skipTutorialOnce = false;
      openGame(EndlessRun.create(seed), 'endless');
      return;
    }
    openTutorial(() => openGame(EndlessRun.create(seed), 'endless'));
  }

  function startDaily(): void {
    const kind = scores.getProgress(dailyKey()).officialUsed ? 'practice' : 'official';
    dailySession = daily.start(kind);
    if (dailySession.status === 'started') openGame(new EndlessRun(dailySession.session.simulation), 'daily');
  }

  async function continueSaved(): Promise<void> {
    const result = await readGame(storage);
    if (result.status !== 'ok') { saved = null; screens.show('menu'); return; }
    const save = result.save;
    const sim = restoreSimFromSave(save);
    if (!sim) {
      console.warn('Saved flight failed verification; starting fresh.');
      saved = null;
      screens.show('menu');
      return;
    }
    const run = new EndlessRun(sim);
    openGame(run, run.mode === 'daily' ? 'daily' : 'endless');
    session?.setPaused(true);
  }

  function openPuzzles(): void {
    const host = document.createElement('div');
    host.className = 'airway-puzzle-screen';
    const ui = mountPuzzleSelector(host, () => screens.show('menu'));
    screens.open('puzzles', { element: host, back: () => ui.back(), dispose: () => ui.dispose() });
  }

  function devState(): AwDevState {
    const run = session?.run;
    return {
      screen: session ? screenName : (screens.current() === 'settings' || screens.current() === 'licenses' ? 'settings' : 'menu'),
      seed: run?.seed ?? pendingSeed ?? 0,
      tick: run?.tick ?? 0,
      nextWeekTick: run?.nextWeekTick ?? 0,
      routeCount: run?.routeList().length ?? 0,
      aircraftAssignments: run?.assignments ?? 0,
      snapshotHash: run?.hash() ?? '',
    };
  }

  /** DEV/QA only: the task-22 bot plays the visible session through real Commands. */
  async function autoplayUntil(untilWeek: number): Promise<void> {
    // The ternary lets Vite drop the bot from production bundles entirely.
    const bot = import.meta.env.DEV ? await import('./game/dev/autoplay') : null;
    if (!bot) return;
    const { nextAutoplayCommand, AUTOPLAY_ACTION_INTERVAL } = bot;
    const active = session;
    if (!active) throw new Error('autoplay needs a running game');
    for (let guard = 0; guard < 200_000; guard++) {
      const run = active.run;
      if (run.failed) break;
      const offer = run.weeklyUpgrade;
      if (offer && offer.week >= untilWeek && !offer.lastChoice) break;
      const command = nextAutoplayCommand(run.sim);
      if (command) run.queue(command);
      active.advance(AUTOPLAY_ACTION_INTERVAL);
    }
  }

  // QA bridge for e2e (Vite dev builds only). It drives the production session, never a copy.
  if (import.meta.env.DEV) {
    registerDevGameAdapter({
      state: () => devState(),
      prepareSeed: (seed) => { pendingSeed = seed >>> 0; skipTutorialOnce = true; },
      advanceTicks: (ticks) => session?.advance(ticks),
      gesture: (kind) => {
        const drag = kind === 'route' ? session?.routeGesture() : session?.planeGesture();
        if (!drag) throw new Error('No gesture available for ' + kind);
        if (kind === 'plane') return drag;
        const rect = world!.canvas.getBoundingClientRect();
        return { from: { x: drag.from.x + rect.left, y: drag.from.y + rect.top }, to: { x: drag.to.x + rect.left, y: drag.to.y + rect.top } };
      },
      forceHubOverload: () => session?.forceOverload(),
      autoplay: async (untilWeek) => { await autoplayUntil(untilWeek); return devState(); },
    });
  }

  // Store screenshots (scripts/store-shots.mjs, DEV only): drive the real session to a scene through
  // real Commands, then flag <html data-store-shot-ready>. Never a static mock.
  // [task-36] Scenes are played by the DEV autoplay bot (the same Commands as the route tool, dock and
  // weekly board), so the stores show a grown network; the light is set by the sun's hour angle over the
  // camera centre (sun.ts formula), not by the boarding-pass clock of the home airport.
  const storeShot = import.meta.env.DEV ? query.get('storeShot') : null;
  if (storeShot) void runStoreShot(storeShot);

  async function runStoreShot(scene: string): Promise<void> {
    const seed = Number(query.get('seed') ?? '41377') >>> 0;
    await world?.ready.catch(() => undefined);
    const done = (): void => {
      document.documentElement.dataset.storeShotSeed = String(seed);
      document.documentElement.dataset.storeShotReady = scene;
    };
    const frames = (n: number): Promise<void> => new Promise((resolve) => {
      const step = (): void => { if (--n <= 0) resolve(); else requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    if (scene === 'menu') { await frames(30); done(); return; }
    skipTutorialOnce = true;
    startEndless(seed);
    const active = session as GameSession | null;
    if (!active || !world) return;
    const run = active.run;
    // The ternary lets Vite drop the bot from production bundles entirely.
    const bot = import.meta.env.DEV ? await import('./game/dev/autoplay') : null;
    if (!bot) return;
    /** The bot plays `ticks` more ticks (it also answers weekly boards) or until the run ends. */
    const play = (ticks: number): void => {
      for (let left = ticks; left > 0 && !run.failed;) {
        const command = bot.nextAutoplayCommand(run.sim);
        if (command) run.queue(command);
        const step = Math.min(left, bot.AUTOPLAY_ACTION_INTERVAL);
        active.advance(step);
        left -= step;
      }
    };
    /** Ticks until the sun stands `hourAngle` degrees east of the camera centre (0 = noon, 180 = midnight). */
    const ticksToSun = (hourAngle: number): number => {
      const sunLon = world!.orbit.longitudeDeg + hourAngle;
      const minuteOfDay = ((180 - sunLon) * 4 % 1440 + 1440) % 1440;
      return Math.round((minuteOfDay - (run.clockMinute % 1440) + 1440) % 1440);
    };
    /**
     * [task-40] Ticks until the sun elevation over the network centroid (spherical mean of the open airports,
     * as `fitNetwork`) equals `dot` in the evening (sun west of it). The oblique camera centre sits well
     * south of the network, so it is not used here.
     */
    const ticksToEveningSun = (dot: number): { ticks: number; label: string } => {
      const DEG = Math.PI / 180;
      let x = 0, y = 0, z = 0;
      for (const city of run.cityList()) {
        x += Math.cos(city.lat * DEG) * Math.sin(city.lon * DEG);
        y += Math.sin(city.lat * DEG);
        z += Math.cos(city.lat * DEG) * Math.cos(city.lon * DEG);
      }
      const lon = Math.atan2(x, z) / DEG;
      const lat = Math.atan2(y, Math.hypot(x, z)); // radians
      const dec = NOVEMBER_SUBSOLAR_LATITUDE_DEG * DEG;
      const cos = (dot - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
      const hourAngle = -Math.acos(Math.max(-1, Math.min(1, cos))) / DEG;
      const minuteOfDay = ((180 - (lon + hourAngle)) * 4 % 1440 + 1440) % 1440;
      return {
        ticks: Math.round((minuteOfDay - (run.clockMinute % 1440) + 1440) % 1440),
        label: `${hourAngle.toFixed(1)}@${lon.toFixed(1)},${(lat / DEG).toFixed(1)}`,
      };
    };
    if (scene === 'upgrade') await autoplayUntil(1);
    else {
      // About one game day of real play grows the network before the light is chosen.
      play(STORE_SHOT_PLAY_TICKS);
      if (scene === 'failure') active.forceOverload(); // The player stops building; real demand jams a hub.
      else {
        await frames(20); // Let the layout-measured framing settle before reading the camera centre.
        // [task-40] `game`: golden low sun just before sunset over the network (was a fixed −95° from the
        // camera centre, which left the European network past the terminator in November).
        const evening = scene === 'night' ? null : ticksToEveningSun(STORE_GAME_SUN_DOT);
        // Recorded by scripts/store-shots.mjs in the manifest: hour angle@network lon,lat.
        document.documentElement.dataset.storeShotSun = evening ? evening.label : '180@camera';
        // Stay on the game screen: never let the game/night setup run into the weekly board.
        let ticks = evening ? evening.ticks : ticksToSun(180);
        if (run.tick + ticks >= run.nextWeekTick) ticks = Math.max(0, ticks - 1440);
        play(ticks);
      }
    }
    active.setPaused(false);
    // Fail closed: never label a different situation (e.g. an early jam) as the requested scene.
    const reached = scene === 'failure' ? active.screen === 'gameover'
      : scene === 'upgrade' ? active.screen === 'upgrade' : active.screen === 'game';
    if (!reached) {
      console.warn(`storeShot "${scene}" not reached; run ended on "${active.screen}" at tick ${run.tick}`);
      return;
    }
    await frames(30);
    done();
  }
}
