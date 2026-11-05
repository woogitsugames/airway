// Composition root: boot → split-flap departures menu → Endless / Daily / Puzzles / Settings.
// It wires modules through their public APIs only; rules live in src/sim (via src/game/run.ts),
// drawing in src/render (via src/game/world.ts) and presentation in src/ui.
import './ui/fonts.css';
import './ui/base.css';
import './ui/theme/theme.css';
import './ui/game.css';
import { bootAudio, audioSettingsFromToggles } from './audio';
import { createFlapRattle } from './game/flapSound'; // [night-07e]
import { audioClockTick } from './game/audioCues'; // [night-12t] D-153
import { onSplitFlapAnimate } from './ui/flap'; // [night-07e]
import { dailyKey, dailySeedForKey } from './core/daily';
import { PUZZLES } from './data/puzzles';
import { registerDevGameAdapter, type AwDevState, type AwScreen } from './game/devHandle';
import { createDailyMode, servedTicketRegions } from './game/modes/daily';
import { dailyRankingBoard } from './game/dailyRanking'; // [night-06c] D-66
import { IDENTITY_KEYS, createBrowserLeaderboards } from './net'; // [night-06c] D-66
import { EndlessRun } from './game/run';
import { readHomeRegion, writeHomeRegion } from './game/homeRegion'; // [night-11aj] R2g
import { HOME_REGIONS } from './sim';
import type { RegionId } from './data/regions';
import { dailyRowHint } from './game/dailyRow'; // [night-10d]
import { firstMilestones, localDay, readLogbook, recordFlight, runHub, type RunRecord } from './game/logbook'; // [night-10n]
import type { MilestoneId } from './game/milestones'; // [night-12ax] R1n
import { APP_VERSION } from './core/version'; // [night-12ap] R3j
import { tipsForFlight } from './game/gameoverTip'; // [night-11f]
import { loadSavedSimChecked, saveSourceFromSim, writeGame, type SaveNotice } from './game/save';
import { LocalScoreService, type DailyResult } from './game/scores';
import { mountScreens, type ScreenName } from './game/screens';
import { startSession, type GameSession, type RunMode, type SessionScreen } from './game/session';
import { mountTutorial } from './game/tutorial';
import { browserTutorialStorage, readTutorialOutcome, TUTORIAL_KEY } from './game/tutorial/controller';
import { createWorld, type World } from './game/world';
import { getLanguage, setPseudoLocale, t } from './i18n';
import { FrameRecorder, gameLoopLogLine, gameLoopReport, gameLoopScenario, type GameLoopRunFacts } from './game/gameLoop'; // [night-12ay] R3i
import { nativeGameLoopPort, readGameLoop, type GameLoopBridge } from './platform/gameLoop'; // [night-12ay] R3i
import { configureHaptics, createDefaultStorage, createNativeInstallMarker, forgetIdentityOnNewInstall, GameLifecycle, shareDailyResult, type KeyValueStorage } from './platform';
import { initializeAccessibility } from './ui/a11y';
import { initializeMotion } from './ui/motion';
import { mountUnsupported } from './ui/unsupported'; // [night-11h]
import { gpuRendererString, webgl2Available } from './render/contextGuard'; // [night-11h]
import { readBestRecord } from './ui/gameover/storage';
import { mountPuzzleSelector, readPuzzleProgress } from './ui/puzzles';
import { onSettingsChange, readSettings } from './ui/settings/settings';
import { applyAirlineColour, onAirlineColour, readAirlineColour } from './ui/airlineColour';
import { TICKS_PER_WEEK } from './sim/clock'; // [task-31] single week length (D-40)
import { NOVEMBER_SUBSOLAR_LATITUDE_DEG } from './render/sun'; // [task-40] store `game` scene light

const mount = document.getElementById('app');
if (!mount) throw new Error('Missing #app mount point');
const app: HTMLElement = mount;
document.documentElement.lang = getLanguage();
initializeAccessibility();
initializeMotion(); // [night-11g] D-88
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

// [night-10p] layout check only; [night-11ac] R7h: `?pseudo=harsh` doubles short strings.
if (import.meta.env.DEV && query.has('pseudo')) setPseudoLocale(query.get('pseudo') === 'harsh' ? 'harsh' : true);

// The airport-model fixture lives in dev/world.html (render agent, shared world renderer).
if (import.meta.env.DEV && query.get('preview') === 'gameover') {
  void import('./ui/gameover/preview').then(({ mountGameOverPreview }) => mountGameOverPreview(app));
} else if (query.get('perf') === 'scene') {
  // scripts/perf-scene.ts mounts its own fixture; the game must not open a second WebGL context.
} else {
  void boot();
}

/** [night-10c, night-11j] Menu notice for a saved flight that cannot be continued. */
const SAVE_NOTICE_KEY = { corrupt: 'save.error.corrupt', unsupported: 'save.error.unsupported', 'old-rules': 'save.error.oldRules' } as const;

interface SavedSummary { readonly mode: RunMode; readonly week: number; readonly passengers: number }

async function boot(): Promise<void> {
  configureHaptics({ isEnabled: () => readSettings().haptics });
  const { audio } = bootAudio({ toggles: readSettings() });
  // [night-12t] D-153: read-only audio health for device checks over chrome://inspect / Safari Web Inspector
  // (docs/ANDROID.md "Sound check"); no setter, nothing persisted.
  (globalThis as { airwayAudioStatus?: () => unknown }).airwayAudioStatus = () => audio.status;
  // [night-07e] Departure boards rattle when they flip (menu, puzzles, game over, ranking).
  const rattle = createFlapRattle(() => { audio.emit({ type: 'flap' }); });
  onSplitFlapAnimate((cells, durationMs) => rattle.animate(cells, durationMs));
  let appliedQuality = readSettings().graphics;
  onSettingsChange((settings) => {
    audio.setSettings(audioSettingsFromToggles(settings));
    if (settings.graphics !== appliedQuality) { appliedQuality = settings.graphics; world?.setQuality(settings.graphics); }
    world?.setGlobeMode(settings.globeMode); // [G8] D-172 (no-op when unchanged)
    document.title = t('app.title');
  });

  let world: World | null = null;
  try {
    world = createWorld(app, t('canvas.label'), readSettings().graphics, readSettings().globeMode);
    world.showMenuBackdrop();
  } catch (error) {
    // [night-11h] D-118: no WebGL 2 (three.js r170 needs it). A plain page says so instead of a blank sky whose
    // Play button led nowhere; the renderer string is what a support mail needs.
    console.error('WebGL 2 is unavailable.', error);
    if (!webgl2Available(() => document.createElement('canvas'))) {
      mountUnsupported(app, gpuRendererString(() => document.createElement('canvas')));
      return;
    }
  }
  // [night-09c] D-80: the boarding pass band reads the CSS variable; the plane liveries paint through this hook
  // once the renderer offers `setAirlineColour` (the livery models belong to the parallel M1 task).
  applyAirlineColour(readAirlineColour());
  onAirlineColour((hex) => {
    (world?.renderer as { setAirlineColour?: (hex: string) => void } | undefined)?.setAirlineColour?.(hex);
  });

  const storage: KeyValueStorage = await createDefaultStorage();
  const scores = new LocalScoreService();
  const daily = createDailyMode(scores);
  // [night-12c] D-92: a backup restored onto another phone keeps the game, not the leaderboard identity.
  await forgetIdentityOnNewInstall(await createNativeInstallMarker(), (() => {
    try { return globalThis.localStorage ?? null; } catch { return null; }
  })(), IDENTITY_KEYS);
  // [night-06c] D-66: off without VITE_FIREBASE_* config; otherwise retry queued daily runs at start.
  const leaderboards = createBrowserLeaderboards(import.meta.env);
  void leaderboards.flush();
  let saved: SavedSummary | null = null;
  let session: GameSession | null = null;
  let pendingSeed: number | null = null;
  let skipTutorialOnce = false;
  // [night-11p] DEV: seeded E2E/store runs keep their screens free of first-time cards unless a test asks for them.
  let devFirstTimeCards = true;
  let dailySession: ReturnType<typeof daily.start> | null = null;
  let lastDaily: DailyResult | null = null; // [night-10e] the finished daily run, for the share action
  let firstReached: readonly MilestoneId[] = []; // [night-12ax] R1n: milestones the last flight reached first
  let failedDailySeed: number | null = null;

  // [night-07k] D-76: a save from older sim rules is replayed and written back here, once.
  const loaded = await loadSavedSimChecked(storage);
  if (loaded.restored) saved = summary(new EndlessRun(loaded.restored.sim));
  // [night-10c] A save that exists but cannot be continued is said so on the menu, until the next flight starts.
  let saveNotice: SaveNotice | null = loaded.issue;

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
        dailyHint: dailyRowHint(scores.getProgress(dailyKey())), // [night-10d]
        saved: saved ? { week: saved.week, passengers: saved.passengers } : null,
        notice: saveNotice ? t(SAVE_NOTICE_KEY[saveNotice]) : null,
        homeRegions: HOME_REGIONS, homeRegion: preferredHomeRegion(), // [night-11aj] R2g
      };
    },
    // [night-10n] Logbook: its own store plus the best record, daily scores and puzzle stars already kept.
    getLogbookData: () => {
      let storageRef: Storage | undefined;
      try { storageRef = globalThis.localStorage; } catch { storageRef = undefined; }
      const progress = readPuzzleProgress();
      const dailyProgress = scores.getProgress(dailyKey());
      let best: { score: number; weeks: number } | null = null;
      try { best = readBestRecord(storageRef) ?? null; } catch { /* Storage blocked. */ }
      return {
        book: readLogbook(storageRef),
        best: best && best.score > 0 ? { score: best.score, weeks: best.weeks } : null,
        dailyBest: dailyProgress.bestOfficial?.score ?? null,
        longestStreak: dailyProgress.longestStreak,
        puzzlesSolved: Object.keys(progress).length,
        puzzlesTotal: PUZZLES.length,
        stars: Object.values(progress).reduce((sum, value) => sum + value, 0),
        tutorial: readTutorialOutcome(browserTutorialStorage()), // [night-12am] R1o
      };
    },
    onHomeRegion: (region) => { try { writeHomeRegion(globalThis.localStorage, region); } catch { /* Storage blocked. */ } },
    onMode: (mode) => {
      if (mode === 'continue') void continueSaved();
      else if (mode === 'endless') { saveNotice = null; startEndless(pendingSeed ?? freshSeed()); }
      else if (mode === 'daily') { saveNotice = null; startDaily(); }
      else openPuzzles();
    },
    onScreen: (name: ScreenName) => {
      world?.setCovered(name !== 'menu' && name !== 'game'); // [night-11a] opaque pages hide the globe
      if (name !== 'game') {
        if (session) { endSession(); world?.reset(); }
        world?.showMenuBackdrop();
        screenName = name === 'settings' || name === 'licenses' || name === 'privacy' || name === 'terms' ? 'settings' : name === 'logbook' ? 'logbook' : 'menu';
      }
    },
    onLanguageChanged: () => { document.title = t('app.title'); },
    onReplayTutorial: () => openTutorial(() => screens.show('menu'), true),
    ranking: leaderboards, // [night-12k] D-114 (R1a): settings row "Delete my ranking data"
  });

  /** [night-11aj] R2g: the menu's home-region choice (null = Random). */
  function preferredHomeRegion(): RegionId | null {
    try { return readHomeRegion(globalThis.localStorage); } catch { return null; }
  }
  function freshSeed(): number {
    const random = new Uint32Array(1);
    globalThis.crypto.getRandomValues(random);
    return random[0] ?? 1;
  }
  /** [night-12ap] R3j: the device side of a run's playtest record (training, graphics, version); never throws. */
  function deviceRecord(): RunRecord {
    let tutorial: RunRecord['tutorial'];
    try { tutorial = readTutorialOutcome(globalThis.localStorage); } catch { tutorial = undefined; }
    let preset: RunRecord['preset'];
    let adapt: number | undefined;
    try {
      preset = world?.renderer.quality.preset;
      adapt = world?.renderer.stats().adaptations.length;
    } catch { /* A lost context reads nothing. */ }
    return { tutorial, quality: readSettings().graphics, preset, adapt, version: APP_VERSION };
  }
  function endSession(): void {
    session?.dispose();
    session = null;
  }

  const lifecycle = new GameLifecycle({
    getTick: () => session?.run.tick ?? 0,
    // [night-11i] D-119: only a running flight gets the pause sheet; the upgrade picker and the game-over board
    // already hold the clock and stay as they are (a blur over the picker must not cover it).
    pause: () => { if (session?.screen === 'game') session.setPaused(true); },
    save: async () => { if (session && !session.run.failed) await saveRun(session.run); },
    requireResume: () => { if (session?.screen === 'game') session.setPaused(true); },
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
      firstTimeCards: devFirstTimeCards,
      onScreen: (next: SessionScreen) => { screenName = next; },
      onMenu: () => screens.show('menu'),
      // [night-10e] Daily: "same world" is a practice of the same day's world (menu once the day changed),
      // "new world" is Endless; both used to drop silently to the menu.
      onRestart: (seed) => {
        // [night-11aj] R2g: "same world" keeps the run's home region; a new world takes the menu's current choice.
        if (mode !== 'daily') startEndless(seed, seed === run.seed ? run.homeRegion : preferredHomeRegion());
        else if (seed === dailySeedForKey(dailyKey())) startDaily();
        else if (seed === failedDailySeed) screens.show('menu');
        else startEndless(seed);
      },
      onSave: saveRun,
      onFailure: (failed) => {
        let ranking: HTMLElement | undefined;
        lastDaily = null;
        failedDailySeed = mode === 'daily' ? failed.seed : null;
        if (mode === 'daily' && dailySession?.status === 'started') {
          // [night-10e] The ticket is the regions the network served (it read "--" for every run).
          lastDaily = daily.finish(dailySession.session, failed.passengers, Math.floor(failed.tick / TICKS_PER_WEEK),
            servedTicketRegions(failed.cityList(), failed.routeList())); // [task-31]
          ranking = dailyRankingBoard(leaderboards, failed, dailySession.session); // [night-06c]
          dailySession = null;
        }
        const reached = mode === 'endless' ? failed.milestones() : []; // [night-12ax] R1n
        firstReached = [];
        try { // [night-10n] one logbook line per finished flight
          const book = recordFlight(globalThis.localStorage, {
            day: localDay(new Date()), mode, passengers: failed.passengers,
            weeks: Math.floor(failed.tick / TICKS_PER_WEEK), hub: runHub(failed.cityList(), failed.routeList()),
            ...(failed.homeRegion ? { region: failed.homeRegion } : {}), // [night-11aj] R2g
          }, { ...failed.playtestStats(), ...deviceRecord() }, // [night-12am] R1o; [night-12ap] R3j playtest record
          reached); // [night-12ax] R1n: milestones first reached in this flight
          firstReached = firstMilestones(book, reached);
        } catch { /* Storage blocked: the flight is not logged. */ }
        saved = null;
        void storage.remove('aw-save-v1').catch(() => undefined);
        return ranking;
      },
      // [night-11f] onFailure has logged this flight already: tips for the first TIP_RUNS flights.
      failureTip: () => { try { return tipsForFlight(readLogbook(globalThis.localStorage).flights); } catch { return true; } },
      failureMilestones: () => firstReached, // [night-12ax] R1n
      failureShare: () => {
        const result = lastDaily;
        if (!result) return undefined;
        const streak = scores.getProgress(result.dateKey).currentStreak;
        return () => shareDailyResult(result, t, { streak });
      },
      onTick: (current, speed) => {
        audio.setSimClock(audioClockTick(current), speed); // [night-12t] cues carry run.tick, not the world minute
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

  function startEndless(seed: number, homeRegion: RegionId | null = preferredHomeRegion()): void {
    pendingSeed = null;
    const firstRun = (() => {
      try { return !globalThis.localStorage?.getItem(TUTORIAL_KEY); } catch { return false; }
    })();
    if (skipTutorialOnce || !firstRun) {
      skipTutorialOnce = false;
      openGame(EndlessRun.create(seed, 'endless', homeRegion), 'endless');
      return;
    }
    openTutorial(() => openGame(EndlessRun.create(seed, 'endless', homeRegion), 'endless'));
  }

  function startDaily(): void {
    const kind = scores.getProgress(dailyKey()).officialUsed ? 'practice' : 'official';
    dailySession = daily.start(kind);
    if (dailySession.status === 'started') openGame(new EndlessRun(dailySession.session.simulation), 'daily');
  }

  async function continueSaved(): Promise<void> {
    const checked = await loadSavedSimChecked(storage);
    const sim = checked.restored?.sim ?? null;
    if (!sim) {
      console.warn('Saved flight failed verification; starting fresh.');
      saved = null;
      saveNotice = checked.issue ?? 'corrupt'; // [night-10c] the Continue row vanished: say why
      screens.show('menu');
      screens.refresh();
      return;
    }
    const run = new EndlessRun(sim);
    if (run.mode === 'daily') {
      // [night-07a] A resumed daily keeps its kind: the open official attempt is still ranked.
      const resumed = daily.resume(sim, run.seed);
      dailySession = resumed ? { status: 'started', session: resumed } : null;
    }
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
      screen: session ? screenName : (screens.current() === 'settings' || screens.current() === 'licenses' || screens.current() === 'privacy' || screens.current() === 'terms' ? 'settings'
        : screens.current() === 'logbook' ? 'logbook' : 'menu'),
      seed: run?.seed ?? pendingSeed ?? 0,
      homeRegion: run?.homeRegion ?? null, // [night-11aj] R2g
      tick: run?.tick ?? 0,
      nextWeekTick: run?.nextWeekTick ?? 0,
      routeCount: run?.routeList().length ?? 0,
      aircraftAssignments: run?.assignments ?? 0,
      snapshotHash: run?.hash() ?? '',
      upgrades: (run?.sim.world.upgrades ?? []).map((item) => ({ ...item })), // [night-07q]
      curfewClosed: (run?.cityList() ?? []).filter((city) => city.curfewClosed).map((city) => city.id), // [night-10g]
      curfewDrawn: world?.curfewDrawn() ?? 0,
      airports: (run?.cityList() ?? []).map((city) => ({ id: city.id, waiting: city.waiting.length, capacity: city.capacity, hub: city.hub })),
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
      prepareSeed: (seed, options) => {
        pendingSeed = seed >>> 0; skipTutorialOnce = true; devFirstTimeCards = options?.firstTime === true;
      },
      advanceTicks: (ticks) => session?.advance(ticks),
      gesture: (kind) => {
        const drag = kind === 'route' ? session?.routeGesture() : kind === 'pick' ? session?.pickGesture() : session?.planeGesture();
        if (!drag) throw new Error('No gesture available for ' + kind);
        if (kind === 'plane') return drag;
        const rect = world!.canvas.getBoundingClientRect();
        return { from: { x: drag.from.x + rect.left, y: drag.from.y + rect.top }, to: { x: drag.to.x + rect.left, y: drag.to.y + rect.top } };
      },
      forceHubOverload: () => session?.forceOverload(),
      autoplay: async (untilWeek) => { await autoplayUntil(untilWeek); return devState(); },
      // [night-07x] One bot decision through real Commands, no fast-forward (long real-time play-throughs).
      botStep: async () => {
        const bot = import.meta.env.DEV ? await import('./game/dev/autoplay') : null;
        const run = session?.run;
        if (!bot || !run || run.failed) return null;
        const command = bot.nextAutoplayCommand(run.sim);
        if (command) run.queue(command);
        return command?.type ?? null;
      },
    });
  }

  // [night-12ay] R3i (D-245): Firebase Test Lab game loop (Android only, TEST_LOOP intent; docs/ANDROID.md). Not DEV:
  // the release build plays the scenario with the task-22 bot through real Commands, then writes the report.
  const gameLoop = await readGameLoop(nativeGameLoopPort());
  if (gameLoop) void runGameLoop(gameLoop);

  async function runGameLoop(loop: GameLoopBridge): Promise<void> {
    const scenario = gameLoopScenario(loop.launch.scenario);
    const frames = new FrameRecorder();
    let started = performance.now();
    let commands = 0;
    let error: string | undefined;
    try {
      if (!scenario) throw new Error('unknown-scenario');
      if (!world) throw new Error('no-webgl2');
      await world.ready.catch(() => undefined);
      // A lazy chunk: only a game-loop launch (or DEV) ever loads the bot.
      const bot = await import('./game/dev/autoplay');
      skipTutorialOnce = true;
      devFirstTimeCards = false;
      startEndless(scenario.seed, null);
      session?.setSpeed(scenario.speed);
      started = performance.now();
      let decidedTick = -Infinity;
      let decidedAt = -Infinity;
      await new Promise<void>((resolve) => {
        const frame = (now: number): void => {
          frames.push(now);
          const run = session?.run;
          // The weekly board holds the clock: decide again after a second of real time there.
          if (run && !run.failed && (run.tick - decidedTick >= scenario.decisionTicks || now - decidedAt >= 1000)) {
            decidedTick = run.tick;
            decidedAt = now;
            const command = bot.nextAutoplayCommand(run.sim);
            if (command) { run.queue(command); commands++; }
          }
          if (now - started >= scenario.durationMs) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
    }
    const run = session?.run;
    const facts: GameLoopRunFacts | null = run ? {
      week: Math.floor(run.clockMinute / TICKS_PER_WEEK) + 1, passengers: run.passengers,
      routes: run.routeList().length, commands, failed: run.failed !== null,
    } : null;
    let preset: string | null = null;
    let adaptations: readonly string[] = [];
    try {
      preset = world?.renderer.quality.preset ?? null;
      adaptations = world?.renderer.stats().adaptations ?? [];
    } catch { /* A lost context reads nothing. */ }
    const report = gameLoopReport({
      scenarioNumber: loop.launch.scenario, scenario, measuredMs: performance.now() - started,
      frames: frames.summarize(), run: facts, error,
      device: {
        userAgent: navigator.userAgent, renderer: gpuRendererString(() => document.createElement('canvas')),
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        graphics: readSettings().graphics, preset, adaptations, appVersion: APP_VERSION,
      },
    });
    console.info(gameLoopLogLine(report));
    await loop.finish(JSON.stringify(report, null, 2) + '\n');
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
    devFirstTimeCards = false; // [night-11p]
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
      // [ext-03] DEV fixture knobs for the globe-look mockups: `storePlay` ticks of play, `storeSunDot` sun elevation.
      play(Number(query.get('storePlay') ?? STORE_SHOT_PLAY_TICKS));
      if (scene === 'failure') active.forceOverload(); // The player stops building; real demand jams a hub.
      else {
        await frames(20); // Let the layout-measured framing settle before reading the camera centre.
        // [task-40] `game`: golden low sun just before sunset over the network (was a fixed −95° from the
        // camera centre, which left the European network past the terminator in November).
        const evening = scene === 'night' ? null
          : ticksToEveningSun(Number(query.get('storeSunDot') ?? STORE_GAME_SUN_DOT));
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
