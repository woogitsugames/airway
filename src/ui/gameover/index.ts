// [task-15] Airport departure-board failure presentation; all gameplay effects use injected adapters.
import { buildCauseReport, type CauseFact, type CauseKind, type HubCauseLedger, type RegionCode } from '../../game/causes';
import { getLanguage, t, type TranslationKey } from '../../i18n';
import { nextWorldSeed, sameWorldIdentity, type WorldIdentity } from './seed';
import { persistBestRecord, type BestStorage } from './storage';
import './gameover.css';

export type { WorldIdentity } from './seed';
export type { GameOverBest, BestStorage } from './storage';

export interface FailedDeparture {
  readonly originHubId: string;
  readonly flightNumber: string;
  readonly destinationCode: string;
  readonly gate: string;
}

export interface GameOverSnapshot extends WorldIdentity {
  readonly hubId: string;
  readonly hubCode: string;
  readonly delivered: number;
  readonly completedWeeks: number;
  readonly ledger: HubCauseLedger;
  readonly departures: readonly FailedDeparture[];
}

export interface GameOverAdapters {
  readonly host: HTMLElement;
  /** Stop authoritative simulation ticks at the failure tick. */
  readonly pauseSimulation: () => void;
  /** Freeze world rendering after the fly-in (never tick the sim during flight). */
  readonly freezeScene: () => void;
  /** Set the renderer camera's focus, 0..1 eased progress; task 04 supplies the camera. */
  readonly focusHub?: (hubId: string, easedProgress: number) => void;
  readonly restartSameWorld: (identity: WorldIdentity) => void;
  readonly restartNewWorld: (seed: number) => void;
  readonly returnToMenu: () => void;
  readonly storage?: BestStorage;
  readonly randomSeed?: () => number;
  readonly reducedMotion?: () => boolean;
}

export interface GameOverController {
  show(snapshot: GameOverSnapshot): Promise<void>;
  dispose(): void;
}

const CAMERA_MS = 700;
const REGION_KEYS: Record<RegionCode, TranslationKey> = {
  NAM: 'gameover.region.NAM',
  SAM: 'gameover.region.SAM',
  EUN: 'gameover.region.EUN',
  EUS: 'gameover.region.EUS',
  AFR: 'gameover.region.AFR',
  ME: 'gameover.region.ME',
};
const CAUSE_KEYS: Record<CauseKind, TranslationKey> = {
  'regional-demand': 'gameover.cause.regionalDemand',
  'no-route': 'gameover.cause.noRoute',
  'seat-shortage': 'gameover.cause.seatShortage',
  'missed-transfer': 'gameover.cause.missedTransfer',
  'transfer-not-ready': 'gameover.cause.transferNotReady',
  'long-wait': 'gameover.cause.longWait',
  'capacity': 'gameover.cause.capacity',
  'congestion-duration': 'gameover.cause.congestionDuration',
  'unavailable': 'gameover.cause.unavailable',
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function causeText(fact: CauseFact): string {
  const params: Record<string, number | string> = { ...fact.params };
  if (fact.region) params.region = t(REGION_KEYS[fact.region]);
  return t(CAUSE_KEYS[fact.kind], params);
}

function preferredReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function eased(progress: number): number {
  const remainder = 1 - Math.max(0, Math.min(1, progress));
  return 1 - remainder * remainder * remainder;
}

function entropySeed(): number {
  try {
    if (!globalThis.crypto?.getRandomValues) return Number.NaN;
    const random = new Uint32Array(1);
    globalThis.crypto.getRandomValues(random);
    return random[0] ?? Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function buildDialog(
  snapshot: GameOverSnapshot,
  isNewRecord: boolean,
  onSame: () => void,
  onNew: () => void,
  onMenu: () => void,
): { overlay: HTMLDivElement; firstButton: HTMLButtonElement } {
  const overlay = element('div', 'airway-go-overlay');
  overlay.dataset.gameoverState = 'open';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'airway-gameover-heading');

  const content = element('main', 'airway-go-content');
  const sign = element('header', 'airway-go-sign');
  const mark = element('span', 'airway-go-sign-mark');
  mark.setAttribute('aria-hidden', 'true');
  const title = element('h1', 'airway-go-heading', t('gameover.title'));
  title.id = 'airway-gameover-heading';
  sign.append(mark, title);

  const board = element('section', 'airway-go-board');
  board.setAttribute('aria-label', t('gameover.departures', { hub: snapshot.hubCode }));
  const boardTitle = element('h2', 'airway-go-board-title', t('gameover.departures', { hub: snapshot.hubCode }));
  const columns = element('div', 'airway-go-board-head');
  for (const text of [t('gameover.flight'), t('menu.gate'), t('menu.status')]) {
    columns.append(element('span', '', text));
  }
  const flightList = element('div', 'airway-go-flight-list');
  flightList.setAttribute('role', 'list');
  const departing = snapshot.departures.filter((flight) => flight.originHubId === snapshot.hubId);
  for (const flight of departing) {
    const row = element('div', 'airway-go-flight');
    row.setAttribute('role', 'listitem');
    const number = element('span', 'airway-go-flight-number', flight.flightNumber + ' · ' + flight.destinationCode);
    const gate = element('span', 'airway-go-flight-gate', flight.gate);
    const status = element('span', 'airway-go-flap', t('gameover.cancelled'));
    row.append(number, gate, status);
    flightList.append(row);
  }
  if (departing.length === 0) flightList.append(element('p', 'airway-go-none', t('gameover.noDepartures')));
  board.append(boardTitle, columns, flightList);

  const strip = element('section', 'airway-go-strip');
  strip.setAttribute('aria-label', t('gameover.report'));
  const stripHeader = element('h2', 'airway-go-strip-title', t('gameover.report'));
  const scoreRow = element('div', 'airway-go-score-row');
  scoreRow.append(
    element('p', 'airway-go-score', t('gameover.score', { score: snapshot.delivered.toLocaleString(getLanguage()) })),
    element('p', 'airway-go-weeks', t('gameover.weeks', { weeks: snapshot.completedWeeks })),
  );
  const causesTitle = element('h3', 'airway-go-causes-title', t('gameover.causes'));
  const causesList = element('ol', 'airway-go-causes');
  for (const fact of buildCauseReport(snapshot.ledger)) {
    causesList.append(element('li', '', causeText(fact)));
  }
  strip.append(stripHeader, scoreRow, causesTitle, causesList);
  if (isNewRecord) strip.append(element('p', 'airway-go-record', t('gameover.newRecord')));

  const actions = element('nav', 'airway-go-actions');
  actions.setAttribute('aria-label', t('gameover.actions'));
  const same = element('button', 'airway-go-button airway-go-same', t('gameover.sameWorld'));
  const next = element('button', 'airway-go-button airway-go-new', t('gameover.newWorld'));
  const menu = element('button', 'airway-go-button airway-go-menu', t('gameover.menu'));
  same.type = next.type = menu.type = 'button';
  same.addEventListener('click', onSame);
  next.addEventListener('click', onNew);
  menu.addEventListener('click', onMenu);
  actions.append(same, next, menu);
  content.append(sign, board, strip, actions);
  overlay.append(content);
  return { overlay, firstButton: same };
}

/** Called once by game composition when a hub's jam countdown reaches zero. */
export function createGameOverController(adapters: GameOverAdapters): GameOverController {
  let phase: 'idle' | 'opening' | 'open' | 'disposed' = 'idle';
  let overlay: HTMLDivElement | null = null;
  const previousFocus = { element: null as HTMLElement | null };
  const isDisposed = (): boolean => phase === 'disposed';

  function removeOverlay(): void {
    overlay?.remove();
    overlay = null;
    previousFocus.element?.focus();
  }

  function focusOnFailure(hubId: string): Promise<void> {
    if (!adapters.focusHub) return Promise.resolve();
    if ((adapters.reducedMotion ?? preferredReducedMotion)()) {
      adapters.focusHub(hubId, 1);
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      let start = -1;
      const frame = (now: number): void => {
        if (phase === 'disposed') {
          resolve();
          return;
        }
        if (start < 0) start = now;
        const progress = Math.min(1, (now - start) / CAMERA_MS);
        adapters.focusHub?.(hubId, eased(progress));
        if (progress < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  return {
    async show(snapshot: GameOverSnapshot): Promise<void> {
      if (phase !== 'idle') return;
      phase = 'opening';
      adapters.pauseSimulation();
      try {
        await focusOnFailure(snapshot.hubId);
      } catch (error) {
        // A missing camera implementation must not hide the game-over report.
        console.error('[task-15] Hub camera focus failed', error);
      } finally {
        adapters.freezeScene();
      }
      if (isDisposed()) return;
      let storage = adapters.storage;
      if (!storage) {
        try {
          storage = globalThis.localStorage;
        } catch {
          // Storage can be disabled in private browsing.
        }
      }
      const { isNewRecord } = persistBestRecord(storage, {
        score: Math.max(0, Math.floor(snapshot.delivered)),
        weeks: Math.max(0, Math.floor(snapshot.completedWeeks)),
        seed: snapshot.seed >>> 0,
      });
      previousFocus.element = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const closeThen = (next: () => void): void => {
        removeOverlay();
        phase = 'idle';
        next();
      };
      const dialog = buildDialog(
        snapshot,
        isNewRecord,
        () => closeThen(() => adapters.restartSameWorld(sameWorldIdentity(snapshot))),
        () => closeThen(() => adapters.restartNewWorld(nextWorldSeed(
          snapshot.seed, adapters.randomSeed?.() ?? entropySeed(),
        ))),
        () => closeThen(adapters.returnToMenu),
      );
      overlay = dialog.overlay;
      adapters.host.append(overlay);
      phase = 'open';
      dialog.firstButton.focus();
    },
    dispose(): void {
      phase = 'disposed';
      removeOverlay();
    },
  };
}
