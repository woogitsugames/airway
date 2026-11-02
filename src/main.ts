// Composition root: boot → split-flap departures menu → Endless / Daily / Puzzles / Settings.
// It wires modules through their public APIs only; rules live in src/sim (via src/game/run.ts),
// drawing in src/render (via src/game/world.ts) and presentation in src/ui.
import './ui/fonts.css';
import './ui/base.css';
import './ui/theme/theme.css';
import './ui/game.css';
import { bootAudio, audioSettingsFromToggles } from './audio';
import { dailyKey } from './core/daily';
import { seedFromString } from './core/rng';
import { PUZZLES } from './data/puzzles';
import { registerDevGameAdapter, type AwScreen } from './game/devHandle';
import { DailyChallengeMode } from './game/modes/daily';
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

const mount = document.getElementById('app');
if (!mount) throw new Error('Missing #app mount point');
const app: HTMLElement = mount;
document.documentElement.lang = getLanguage();
initializeAccessibility();
document.title = t('app.title');
const query = new URLSearchParams(location.search);

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
  const daily = new DailyChallengeMode(
    { dailyKey, dailySeed: (key) => seedFromString(`airway/daily/v1/${key}`) },
    scores, (seed) => EndlessRun.create(seed, 'daily'),
  );
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
    return { mode: run.mode === 'daily' ? 'daily' : 'endless', week: Math.floor(run.clockMinute / (7 * 1440)) + 1, passengers: run.passengers };
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
        if (mode === 'daily' && dailySession?.status === 'started') {
          daily.finish(dailySession.session, failed.passengers, Math.floor(failed.tick / (7 * 1440)), []);
          dailySession = null;
        }
        saved = null;
        void storage.remove('aw-save-v1').catch(() => undefined);
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
    if (dailySession.status === 'started') openGame(dailySession.session.simulation, 'daily');
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

  // QA bridge for e2e (Vite dev builds only). It drives the production session, never a copy.
  if (import.meta.env.DEV) {
    registerDevGameAdapter({
      state: () => {
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
      },
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
    });
  }
}
