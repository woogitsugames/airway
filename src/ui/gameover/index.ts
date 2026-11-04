// [task-15] Airport departure-board failure presentation; all gameplay effects use injected adapters.
import { buildCauseReport, type CauseFact, type CauseKind, type HubCauseLedger, type RegionCode } from '../../game/causes';
import { localNumber, t, type TranslationKey } from '../../i18n';
import { nextWorldSeed, sameWorldIdentity, type WorldIdentity } from './seed';
import { persistBestRecord, type BestStorage } from './storage';
import type { TimelineWeek } from '../../game/runTimeline';
import { gameOverTip, unservedHint, type GameOverTip, type TipKind } from '../../game/gameoverTip';
import './gameover.css';
import { reducedMotion } from '../motion'; // [night-11g] D-88

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
  /** [night-06c] Optional extra board under the report (daily ranking, D-66). */
  readonly extra?: HTMLElement;
  /** [night-10e] Daily runs: share the result (src/platform/share.ts); the report shows the outcome. */
  readonly share?: () => Promise<{ readonly status: 'shared' | 'copied' | 'unavailable' | 'failed'; readonly text: string }>;
  /** [night-10r] What the player did each week, re-read from the command journal on demand (src/game/runTimeline.ts). */
  readonly timeline?: () => Promise<RunTimeline | null>;
  /** [night-11f] Show one tip from the leading cause (the player's first flights, src/game/gameoverTip.ts). */
  readonly tip?: boolean;
  /** [night-12y] R8b: aircraft left in the reserve at the jam (turboprops + widebodies); picks the unserved hint. */
  readonly spareAircraft?: number;
}

/** [night-10r] Weeks of the run plus the day of the jam; hub ids in picks are already display labels. */
export interface RunTimeline {
  readonly weeks: readonly TimelineWeek[];
  readonly endDay: number;
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
  /** [night-11c] Hardware back / Escape: from the map view return to the report; false otherwise. */
  back(): boolean;
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
  ASI: 'gameover.region.ASI',
  OCE: 'gameover.region.OCE',
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
  'slot-wait': 'gameover.cause.slotWait', // [task-32]
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

const TIP_KEYS: Record<TipKind, TranslationKey> = {
  'hub-overflow': 'gameover.tip.hubOverflow',
  'region': 'gameover.tip.region',
  'no-route': 'gameover.tip.noRoute',
  'seats': 'gameover.tip.seats',
  'transfer': 'gameover.tip.transfer',
  'slot-wait': 'gameover.tip.slotWait',
};

/** [night-11f] One line under the causes: a kicker and what to try next time. */
function tipLine(tip: GameOverTip): HTMLElement {
  const line = element('p', 'airway-go-tip');
  line.dataset.testid = 'gameover-tip';
  line.dataset.tip = tip.kind;
  line.append(element('span', 'airway-go-tip-label', t('gameover.tip.label')),
    document.createTextNode(' ' + t(TIP_KEYS[tip.kind], tip.region ? { region: t(REGION_KEYS[tip.region]) } : {})));
  return line;
}

function causeText(fact: CauseFact): string {
  const params: Record<string, number | string> = { ...fact.params };
  if (fact.region) params.region = t(REGION_KEYS[fact.region]);
  return t(CAUSE_KEYS[fact.kind], params);
}

function preferredReducedMotion(): boolean {
  return reducedMotion(); // [night-11g] D-88: the camera cuts to the jammed hub instead of panning
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

/** [night-10e] Share button on the paper strip; a dismissed native sheet says nothing, never copies. */
function shareRow(share: NonNullable<GameOverSnapshot['share']>): HTMLElement {
  const row = element('div', 'airway-go-share');
  const button = element('button', 'airway-go-button airway-go-share-button', t('daily.share.action'));
  button.type = 'button';
  button.dataset.testid = 'gameover-share';
  const status = element('p', 'airway-go-share-status');
  status.setAttribute('role', 'status');
  status.dataset.testid = 'gameover-share-status';
  let busy = false;
  button.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    void share().then((outcome) => {
      row.querySelector('.airway-go-share-text')?.remove();
      status.textContent = outcome.status === 'copied' ? t('daily.share.copied')
        : outcome.status === 'unavailable' ? t('daily.share.select') : '';
      if (outcome.status === 'unavailable') {
        const text = element('textarea', 'airway-go-share-text');
        text.readOnly = true;
        text.rows = Math.min(8, outcome.text.split('\n').length);
        text.value = outcome.text;
        text.dataset.testid = 'gameover-share-text';
        row.append(text);
        text.select();
      }
    }).catch(() => { status.textContent = ''; }).finally(() => { busy = false; });
  });
  row.append(button, status);
  return row;
}

const PICK_KEYS: Record<NonNullable<TimelineWeek['pick']>['upgrade'], TranslationKey> = {
  turboprop: 'upgrade.turboprop', widebody: 'upgrade.widebody', 'hub-expansion': 'upgrade.hub', 'departure-slots': 'upgrade.slots',
};

/** [night-10r] One ruled line per week: the crate taken, then what changed in the network. */
function timelineRow(week: TimelineWeek): HTMLLIElement {
  const row = element('li', 'airway-go-timeline-week');
  row.dataset.week = String(week.week);
  const parts: string[] = [];
  if (week.pick) {
    const name = t(PICK_KEYS[week.pick.upgrade]).replace(/\u00AD/g, '');
    parts.push(week.pick.hubId ? t('gameover.timeline.pickAt', { upgrade: name, hub: week.pick.hubId }) : name);
  }
  if (week.routes) parts.push(t('gameover.timeline.routes', { count: week.routes }));
  if (week.extended) parts.push(t('gameover.timeline.extended', { count: week.extended }));
  if (week.removed) parts.push(t('gameover.timeline.removed', { count: week.removed }));
  if (week.aircraft) parts.push(t('gameover.timeline.aircraft', { count: week.aircraft }));
  row.append(element('span', 'airway-go-timeline-mark', t('gameover.timeline.week', { week: week.week })),
    element('span', 'airway-go-timeline-text', parts.length ? parts.join(' · ') : t('gameover.timeline.quiet')));
  return row;
}

/** [night-10r] Causes and the run timeline share one panel behind two tabs, so the report keeps its height. */
function reportTabs(causesList: HTMLElement, load: NonNullable<GameOverSnapshot['timeline']>, hubCode: string): HTMLElement[] {
  const tabs = element('div', 'airway-go-tabs');
  tabs.setAttribute('aria-label', t('gameover.causes'));
  tabs.setAttribute('role', 'tablist');
  const timeline = element('ol', 'airway-go-timeline');
  timeline.dataset.testid = 'gameover-timeline';
  timeline.hidden = true;
  const make = (label: string, panel: HTMLElement, id: string): HTMLButtonElement => {
    const tab = element('button', 'airway-go-tab', label);
    tab.type = 'button';
    tab.id = `airway-go-tab-${id}`;
    tab.dataset.testid = `gameover-tab-${id}`;
    tab.setAttribute('role', 'tab');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    return tab;
  };
  const causesTab = make(t('gameover.timeline.causes'), causesList, 'causes');
  const timelineTab = make(t('gameover.timeline.title'), timeline, 'timeline');
  let loaded = false;
  const select = (showTimeline: boolean): void => {
    if (showTimeline && !timeline.hidden) return;
    // Same height for both panels: the report and its actions never move when switching.
    const height = Math.max(causesList.offsetHeight, timeline.offsetHeight);
    causesTab.setAttribute('aria-selected', String(!showTimeline));
    timelineTab.setAttribute('aria-selected', String(showTimeline));
    causesList.hidden = showTimeline;
    timeline.hidden = !showTimeline;
    if (showTimeline && height) timeline.style.height = `${height}px`;
    if (!showTimeline || loaded) return;
    loaded = true;
    timeline.dataset.state = 'loading';
    timeline.replaceChildren(element('li', 'airway-go-timeline-note', t('gameover.timeline.loading')));
    void load().catch(() => null).then((result) => {
      timeline.dataset.state = result ? 'ready' : 'unavailable';
      if (!result) { timeline.replaceChildren(element('li', 'airway-go-timeline-note', t('gameover.timeline.unavailable'))); return; }
      const end = element('li', 'airway-go-timeline-week airway-go-timeline-end');
      const last = result.weeks.at(-1)?.week ?? 1;
      end.append(element('span', 'airway-go-timeline-mark', t('gameover.timeline.week', { week: last })),
        element('span', 'airway-go-timeline-text', t('gameover.timeline.end', { day: result.endDay, hub: hubCode })));
      timeline.replaceChildren(...result.weeks.map(timelineRow), end);
      timeline.scrollTop = timeline.scrollHeight; // the last weeks and the jam first; earlier weeks scroll up
    });
  };
  causesTab.addEventListener('click', () => select(false));
  timelineTab.addEventListener('click', () => select(true));
  causesTab.setAttribute('aria-selected', 'true');
  timelineTab.setAttribute('aria-selected', 'false');
  tabs.append(causesTab, timelineTab);
  return [tabs, causesList, timeline];
}

/**
 * [night-11k] R5f: while the report is open its host (the game layer) carries `data-gameover-report`, and the
 * stylesheet hides the off-screen edge chips and the tag dock under it; they return on the "Map" view.
 */
const REPORT_ATTRIBUTE = 'data-gameover-report';
function markReport(host: Element | null, open: boolean): void {
  host?.toggleAttribute(REPORT_ATTRIBUTE, open);
}

function buildDialog(
  snapshot: GameOverSnapshot,
  isNewRecord: boolean,
  onSame: () => void,
  onNew: () => void,
  onMenu: () => void,
): { overlay: HTMLDivElement; firstButton: HTMLButtonElement; closeMap: () => boolean } {
  const overlay = element('div', 'airway-go-overlay');
  overlay.dataset.gameoverState = 'open';
  overlay.dataset.testid = 'game-over';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'airway-gameover-heading');

  const content = element('main', 'airway-go-content');
  const sign = element('header', 'airway-go-sign');
  const mark = element('span', 'airway-go-sign-mark');
  mark.setAttribute('aria-hidden', 'true');
  const title = element('h1', 'airway-go-heading', t('gameover.title'));
  title.id = 'airway-gameover-heading';
  // [night-11c] "Map": the report hid the network the run ended on. The toggle lifts the report and the dim so the
  // jammed airport, its tag and the routes can be looked at (and the globe turned); one paper tag brings it back.
  const mapButton = element('button', 'airway-go-map', t('gameover.map'));
  mapButton.type = 'button';
  mapButton.dataset.testid = 'gameover-map';
  mapButton.setAttribute('aria-label', t('gameover.mapLabel', { hub: snapshot.hubCode }));
  sign.append(mark, title, mapButton);

  const board = element('section', 'airway-go-board');
  board.setAttribute('aria-label', t('gameover.departures', { hub: snapshot.hubCode }));
  const boardTitle = element('h2', 'airway-go-board-title', t('gameover.departures', { hub: snapshot.hubCode }));
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
  // [night-11b] The departures are the jammed airport's route neighbours, so an empty board always means no route
  // served it: say so (and what would have helped) instead of a bare "no scheduled departures".
  if (departing.length === 0) {
    const none = element('div', 'airway-go-none');
    none.dataset.testid = 'gameover-unserved';
    none.append(element('p', 'airway-go-none-line', t('gameover.unserved', { hub: snapshot.hubCode })),
      element('p', 'airway-go-none-hint', t(unservedHint(snapshot.spareAircraft))));
    flightList.append(none);
  }
  // [night-11k] R5f: column headings only above real rows; over the unserved sentence they read as an unfinished table.
  if (departing.length > 0) {
    const columns = element('div', 'airway-go-board-head');
    for (const text of [t('gameover.flight'), t('menu.gate'), t('menu.status')]) {
      columns.append(element('span', '', text));
    }
    board.append(boardTitle, columns, flightList);
  } else {
    board.append(boardTitle, flightList);
  }

  const strip = element('section', 'airway-go-strip');
  strip.setAttribute('aria-label', t('gameover.report'));
  const stripHeader = element('h2', 'airway-go-strip-title', t('gameover.report'));
  const scoreRow = element('div', 'airway-go-score-row');
  scoreRow.append(
    element('p', 'airway-go-score', t('gameover.score', { score: localNumber(snapshot.delivered) })),
    element('p', 'airway-go-weeks', t('gameover.weeks', { weeks: snapshot.completedWeeks })),
  );
  const causesTitle = element('h3', 'airway-go-causes-title', t('gameover.causes'));
  const causesList = element('ol', 'airway-go-causes');
  const facts = buildCauseReport(snapshot.ledger);
  for (const fact of facts) {
    causesList.append(element('li', '', causeText(fact)));
  }
  // [night-11f] The tip sits in the causes panel, so the Timeline tab hides it with the causes.
  const tip = snapshot.tip ? gameOverTip(facts, { unserved: departing.length === 0 }) : null;
  let causesPanel: HTMLElement = causesList;
  if (tip) {
    causesPanel = element('div', 'airway-go-causes-panel');
    causesPanel.append(causesList, tipLine(tip));
  }
  strip.append(stripHeader, scoreRow);
  if (snapshot.share) strip.append(shareRow(snapshot.share));
  if (snapshot.timeline) strip.append(...reportTabs(causesPanel, snapshot.timeline, snapshot.hubCode));
  else strip.append(causesTitle, causesPanel);
  if (isNewRecord) strip.append(element('p', 'airway-go-record', t('gameover.newRecord')));

  const actions = element('nav', 'airway-go-actions');
  actions.setAttribute('aria-label', t('gameover.actions'));
  const same = element('button', 'airway-go-button airway-go-same', t('gameover.sameWorld'));
  const next = element('button', 'airway-go-button airway-go-new', t('gameover.newWorld'));
  const menu = element('button', 'airway-go-button airway-go-menu', t('gameover.menu'));
  same.type = next.type = menu.type = 'button';
  same.dataset.testid = 'gameover-same';
  next.dataset.testid = 'gameover-new';
  menu.dataset.testid = 'gameover-menu';
  same.addEventListener('click', onSame);
  next.addEventListener('click', onNew);
  menu.addEventListener('click', onMenu);
  actions.append(same, next, menu);
  content.append(sign, board, strip, ...(snapshot.extra ? [snapshot.extra] : []), actions);
  const mapBar = element('div', 'airway-go-mapbar');
  mapBar.hidden = true;
  const mapBack = element('button', 'airway-go-button airway-go-mapback', t('gameover.mapBack'));
  mapBack.type = 'button';
  mapBack.dataset.testid = 'gameover-map-back';
  mapBar.append(element('span', 'airway-go-mapbar-hub', t('gameover.mapHub', { hub: snapshot.hubCode })), mapBack);
  const setMap = (open: boolean): void => {
    overlay.classList.toggle('is-map', open);
    markReport(overlay.parentElement, !open); // [night-11k] the map view brings edge chips and the dock back
    content.hidden = open;
    mapBar.hidden = !open;
    // While the map shows, the overlay is no dialog: the globe under it takes the gestures.
    overlay.setAttribute('aria-modal', String(!open));
    (open ? mapBack : mapButton).focus({ preventScroll: true });
  };
  mapButton.addEventListener('click', () => setMap(true));
  mapBack.addEventListener('click', () => setMap(false));
  overlay.append(content, mapBar);
  const closeMap = (): boolean => {
    if (!overlay.classList.contains('is-map')) return false;
    setMap(false);
    return true;
  };
  return { overlay, firstButton: same, closeMap };
}

/** Called once by game composition when a hub's jam countdown reaches zero. */
export function createGameOverController(adapters: GameOverAdapters): GameOverController {
  let phase: 'idle' | 'opening' | 'open' | 'disposed' = 'idle';
  let overlay: HTMLDivElement | null = null;
  let closeMap: (() => boolean) | null = null;
  const previousFocus = { element: null as HTMLElement | null };
  const isDisposed = (): boolean => phase === 'disposed';

  function removeOverlay(): void {
    if (overlay) markReport(overlay.parentElement, false);
    overlay?.remove();
    overlay = null;
    closeMap = null;
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
        console.error('Hub camera focus failed', error);
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
      closeMap = dialog.closeMap;
      adapters.host.append(overlay);
      markReport(adapters.host, true);
      phase = 'open';
      dialog.firstButton.focus();
    },
    back(): boolean { return phase === 'open' && !!closeMap?.(); },
    dispose(): void {
      phase = 'disposed';
      removeOverlay();
    },
  };
}
