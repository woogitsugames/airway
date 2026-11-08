import type { HubPressure, UpgradeCommand, UpgradeKind, WeeklyUpgradeState } from '../../sim/upgrades';
import '../skin/current.css'; // [night-11aq] skin tokens read by upgrade.css
import './upgrade.css';
import { t, type TranslationKey } from '../../i18n';
import { cardModel, upgradeFacts, type CardModel, type ContractBoard, type SlotPressure } from './cards';
import { setClass } from '../classes'; // [night-59a] D-322

export { cardModel, upgradeFacts, mostSlotStarved, type CardModel, type ContractBoard, type UpgradeFacts, type SlotPressure } from './cards';

export interface UpgradeUIOptions {
  onCommand: (command: UpgradeCommand) => void;
  onHubSelectionMode?: (active: boolean, hubIds: readonly string[]) => void;
  onPreviewModel?: (container: HTMLElement, kind: UpgradeKind) => void;
  /** [task-39] "Back" in the airport pick: the host queues CancelUpgradePick for `week` (D-49). */
  onCancelPick?: (week: number) => void;
}

const span = (className: string, text?: string): HTMLSpanElement => {
  const element = document.createElement('span');
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

/** [task-35] One air-cargo label (mockups/diorama/png/upgrade-*.png): model window, stencil header, field grid, stamp. */
function cargoLabel(model: CardModel, index: number): { card: HTMLButtonElement; window: HTMLElement } {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'airway-upgrade-tag';
  card.dataset.testid = `upgrade-option-${index}`;
  card.dataset.upgrade = model.kind;
  const window = span(`airway-upgrade-model model-${model.kind}`);
  window.setAttribute('aria-hidden', 'true');
  const body = span('airway-upgrade-body');
  const heading = span('airway-upgrade-heading');
  // [night-10p] Two unbreakable pieces: a longer translation wraps after the " · " instead of being cut by an ellipsis.
  const code = span('airway-upgrade-code');
  code.append(span('', `${t('upgrade.freight')} ·`), ' ', span('', model.code));
  heading.append(code, span('airway-upgrade-count', model.counter));
  const title = span('airway-upgrade-title', model.title);
  // [task-37] Longest word (soft hyphens excluded) drives the fit-to-width font size in upgrade.css.
  title.style.setProperty('--title-chars', String(Math.max(...model.title.replace(/\u00AD/g, '').split(/\s+/).map((w) => w.length))));
  const grid = span('airway-upgrade-grid');
  for (const row of model.rows) grid.append(span('airway-upgrade-key', row.label), span('airway-upgrade-value', row.value));
  body.append(heading, title, grid);
  if (model.stamp) {
    // [night-11r] R5e: a small caption line names what the stamp measures; the aria text reads "caption: stamp".
    const stamp = span('airway-upgrade-stamp');
    if (model.stampCaption) stamp.append(span('airway-upgrade-stamp-caption', model.stampCaption));
    stamp.append(span('airway-upgrade-stamp-value', model.stamp));
    body.append(stamp);
  }
  card.append(window, body);
  const stampText = model.stamp && model.stampCaption ? `${model.stampCaption}: ${model.stamp}` : model.stamp;
  card.setAttribute('aria-label', [model.title, ...model.rows.map((row) => `${row.label}: ${row.value}`), stampText]
    .filter(Boolean).join('. '));
  return { card, window };
}

/**
 * [night-12ba] R2k, D-247: the weekly contract as a freight waybill pinned under the sign: the two regions, the
 * target and the reward; under it last week's result with a filled (met) or hollow (missed) square, so the outcome
 * reads by shape, not only by words. Inks are local custom properties (`--aw-contract-*`) for the pending redesign.
 */
function waybill(contract: ContractBoard): HTMLElement | null {
  if (!contract.next && !contract.last) return null;
  const sheet = document.createElement('section');
  sheet.className = 'airway-upgrade-waybill';
  sheet.dataset.testid = 'upgrade-contract';
  const title = span('airway-upgrade-waybill-title', t('upgrade.contract.title'));
  sheet.append(title);
  if (contract.next) {
    const [from, to] = contract.next.regions;
    const route = span('airway-upgrade-waybill-route', t('upgrade.contract.route', {
      from: t(`region.name.${from}` as TranslationKey), to: t(`region.name.${to}` as TranslationKey) }));
    route.dataset.regions = `${from} ${to}`;
    const task = span('airway-upgrade-waybill-task', t('upgrade.contract.task', { target: contract.next.target }));
    const text = document.createElement('p');
    text.className = 'airway-upgrade-waybill-text';
    text.append(route, ' ', task);
    sheet.append(text);
  }
  if (contract.last) {
    const last = span('airway-upgrade-waybill-last', t(contract.last.met ? 'upgrade.contract.lastMet' : 'upgrade.contract.lastMissed',
      { delivered: contract.last.delivered, target: contract.last.target }));
    last.dataset.met = String(contract.last.met);
    title.after(last);
  }
  // [night-24a] D-280: the one-line form a low screen shows instead (upgrade.css; 320×568 scrolled 45 px): last week's
  // square and figures, the short region names, the target and the reward. The full slip stays for screen readers.
  const line = document.createElement('p');
  line.className = 'airway-upgrade-waybill-line';
  line.setAttribute('aria-hidden', 'true');
  if (contract.last) {
    const mark = span('airway-upgrade-waybill-mark', `${contract.last.delivered}/${contract.last.target}`);
    mark.dataset.met = String(contract.last.met);
    line.append(mark);
  }
  if (contract.next) {
    const [from, to] = contract.next.regions;
    line.append(span('airway-upgrade-waybill-short', t('upgrade.contract.route', {
      from: t(`region.short.${from}` as TranslationKey), to: t(`region.short.${to}` as TranslationKey) })),
    span('airway-upgrade-waybill-goal', t('upgrade.contract.line', { target: contract.next.target })));
  }
  sheet.append(line);
  return sheet;
}

/** [task-39] Black wayfinding tile with a yellow arrow, set into the yellow sign: back to the crates. */
function backTile(onBack: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'airway-upgrade-back';
  button.dataset.testid = 'upgrade-pick-back';
  button.setAttribute('aria-label', t('upgrade.backLabel'));
  const svgNs = 'http://www.w3.org/2000/svg';
  const arrow = document.createElementNS(svgNs, 'svg');
  arrow.setAttribute('viewBox', '0 0 24 24');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.classList.add('airway-upgrade-back-arrow');
  const path = document.createElementNS(svgNs, 'path');
  // Wayfinding arrow (ISO 7001 proportions): square shaft, 90° head.
  path.setAttribute('d', 'M3 12 12 3v6h9v6h-9v6z');
  arrow.append(path);
  button.append(arrow, span('airway-upgrade-back-text', t('upgrade.back')));
  button.addEventListener('click', onBack);
  return button;
}

export class WeeklyUpgradeView {
  private readonly root: HTMLElement;
  private readonly options: UpgradeUIOptions;
  private state: WeeklyUpgradeState | null = null;
  private hubs: readonly HubPressure[] = [];
  private airports: readonly SlotPressure[] = [];
  /** [night-49a] N47a: the board view last shown ("week:crates" / "week:pick"), null while closed. */
  private shown: string | null = null;
  constructor(root: HTMLElement, options: UpgradeUIOptions) { this.root = root; this.options = options; }
  /** `airports` (task 32): every active airport, for the "+2 slots" stamp and airport pick. */
  /** [night-12ba] R2k: `contract` = the weekly contract waybill (Endless runs with the contract only). */
  render(state: WeeklyUpgradeState | null, hubs: readonly HubPressure[], airports: readonly SlotPressure[] = [],
    contract: ContractBoard | null = null): void {
    this.state = state;
    this.hubs = hubs;
    this.airports = airports;
    const pickingSlots = !!state?.pendingHub && state.selected === 'departure-slots';
    this.root.replaceChildren();
    setClass(this.root, 'airway-upgrade-open', !!state?.paused);
    setClass(this.root, 'is-picking-hub', !!state?.paused && !!state.pendingHub); // [night-59a] D-322
    // [night-49a] N47a: the host element outlives the board, and so did its scroll position: at 150 % text the next
    // week's board opened where the last one was left (week sign and contract result out of sight). Every time the
    // board opens, or turns between the crates and the airport pick, it starts at the top.
    const shown = state?.paused ? `${state.week}:${state.pendingHub ? 'pick' : 'crates'}` : null;
    const reset = shown !== this.shown;
    this.shown = shown;
    if (reset) this.root.scrollTop = 0;
    if (!state?.paused) { this.options.onHubSelectionMode?.(false, []); return; }
    const week = t('notice.week', { week: state.week });
    const wrap = document.createElement('section');
    wrap.className = 'airway-upgrade';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', week);
    wrap.dataset.crates = String(state.offers.length); // [night-12ba] R2k: four crates trim the model windows
    // Yellow wayfinding sign: week number + what this screen is.
    const sign = document.createElement('header');
    sign.className = 'airway-upgrade-sign';
    const heading = document.createElement('h2');
    heading.className = 'airway-upgrade-week';
    heading.textContent = week;
    const subtitle = document.createElement('p');
    subtitle.className = 'airway-upgrade-sub';
    subtitle.textContent = pickingSlots ? t('upgrade.selectAirport') : state.pendingHub ? t('upgrade.selectHub')
      : state.offers.length === 4 ? t('upgrade.subtitleFour') : t('upgrade.subtitle');
    sign.append(heading, subtitle);
    wrap.append(sign);
    if (state.pendingHub) {
      // The globe must stay readable while the player taps a hub: only the sign remains.
      if (this.options.onCancelPick) sign.prepend(backTile(() => this.options.onCancelPick?.(state.week))); // [task-39]
      this.options.onHubSelectionMode?.(true, pickingSlots ? this.airports.map(a => a.cityId) : this.hubs.map(h => h.hubId));
      this.root.append(wrap);
      if (reset) this.root.scrollTop = 0;
      return;
    }
    this.options.onHubSelectionMode?.(false, []);
    const sheet = contract ? waybill(contract) : null;
    if (sheet) wrap.append(sheet);
    const cards = document.createElement('div');
    cards.className = 'airway-upgrade-labels';
    cards.dataset.count = String(state.offers.length);
    state.offers.forEach((offer, i) => {
      const model = cardModel(offer.id, i, state.offers.length, hubs, upgradeFacts(), airports);
      const { card, window } = cargoLabel(model, i);
      card.disabled = model.unavailable;
      // [night-12ba] R2k: the crate a met contract added carries a "CONTRACT" piece in its stencil line.
      if (contract?.extraCrate === offer.id && state.extraCrate === offer.id) {
        card.dataset.extra = 'contract';
        card.querySelector('.airway-upgrade-code')?.append(' ', span('airway-upgrade-extra', `· ${t('upgrade.contract.crate')}`));
        card.setAttribute('aria-label', `${card.getAttribute('aria-label')}. ${t('upgrade.contract.crate')}`);
      }
      card.addEventListener('click', () => this.options.onCommand({ type: 'ChooseUpgrade', week: state.week, upgrade: offer.id }));
      cards.append(card);
      this.options.onPreviewModel?.(window, offer.id);
    });
    wrap.append(cards);
    this.root.append(wrap);
    if (reset) this.root.scrollTop = 0;
  }
  /** Called by the globe hit-test when the hub highlight mode is active. */
  selectHub(hubId: string): void {
    const state = this.state;
    if (!state?.paused || !state.pendingHub) return;
    // [task-32] The same globe pick completes "+2 slots" for any active airport.
    if (state.selected === 'departure-slots') {
      if (!this.airports.some(a => a.cityId === hubId)) return;
      this.options.onCommand({ type: 'ChooseUpgrade', week: state.week, upgrade: 'departure-slots', hubId });
      return;
    }
    if (!this.hubs.some(h => h.hubId === hubId)) return;
    this.options.onCommand({ type: 'ChooseUpgrade', week: state.week, upgrade: 'hub-expansion', hubId });
  }
}
