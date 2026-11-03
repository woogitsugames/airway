import type { HubPressure, UpgradeCommand, UpgradeKind, WeeklyUpgradeState } from '../../sim/upgrades';
import './upgrade.css';
import { t } from '../../i18n';
import { cardModel, upgradeFacts, type CardModel, type SlotPressure } from './cards';
import { airportLabel } from '../airportLabel'; // [m3]

export { cardModel, upgradeFacts, mostSlotStarved, type CardModel, type UpgradeFacts, type SlotPressure } from './cards';

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
  heading.append(span('airway-upgrade-code', `${t('upgrade.freight')} · ${model.code}`), span('airway-upgrade-count', model.counter));
  const title = span('airway-upgrade-title', model.title);
  // [task-37] Longest word (soft hyphens excluded) drives the fit-to-width font size in upgrade.css.
  title.style.setProperty('--title-chars', String(Math.max(...model.title.replace(/\u00AD/g, '').split(/\s+/).map((w) => w.length))));
  const grid = span('airway-upgrade-grid');
  for (const row of model.rows) grid.append(span('airway-upgrade-key', row.label), span('airway-upgrade-value', row.value));
  body.append(heading, title, grid);
  if (model.stamp) body.append(span('airway-upgrade-stamp', model.stamp));
  card.append(window, body);
  card.setAttribute('aria-label', [model.title, ...model.rows.map((row) => `${row.label}: ${row.value}`), model.stamp]
    .filter(Boolean).join('. '));
  return { card, window };
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

/** [m3] D-55: the globe tap as buttons: visible with keyboard input, screen-reader-only otherwise (theme.css). */
function pickButtons(ids: readonly string[], onPick: (id: string) => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'airway-upgrade-picks';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', t('a11y.pickGroup'));
  for (const id of ids) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'airway-upgrade-pick';
    button.dataset.testid = `upgrade-pick-${id}`;
    button.textContent = airportLabel(id);
    button.setAttribute('aria-label', t('a11y.pick', { airport: airportLabel(id, 'name') }));
    button.addEventListener('click', () => onPick(id));
    row.append(button);
  }
  return row;
}

export class WeeklyUpgradeView {
  private readonly root: HTMLElement;
  private readonly options: UpgradeUIOptions;
  private state: WeeklyUpgradeState | null = null;
  private hubs: readonly HubPressure[] = [];
  private airports: readonly SlotPressure[] = [];
  constructor(root: HTMLElement, options: UpgradeUIOptions) { this.root = root; this.options = options; }
  /** `airports` (task 32): every active airport, for the "+2 slots" stamp and airport pick. */
  render(state: WeeklyUpgradeState | null, hubs: readonly HubPressure[], airports: readonly SlotPressure[] = []): void {
    this.state = state;
    this.hubs = hubs;
    this.airports = airports;
    const pickingSlots = !!state?.pendingHub && state.selected === 'departure-slots';
    this.root.replaceChildren();
    this.root.classList.toggle('airway-upgrade-open', !!state?.paused);
    this.root.classList.toggle('is-picking-hub', !!state?.paused && state.pendingHub);
    if (!state?.paused) { this.options.onHubSelectionMode?.(false, []); return; }
    const week = t('notice.week', { week: state.week });
    const wrap = document.createElement('section');
    wrap.className = 'airway-upgrade';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', week);
    // Yellow wayfinding sign: week number + what this screen is.
    const sign = document.createElement('header');
    sign.className = 'airway-upgrade-sign';
    const heading = document.createElement('h2');
    heading.className = 'airway-upgrade-week';
    heading.textContent = week;
    const subtitle = document.createElement('p');
    subtitle.className = 'airway-upgrade-sub';
    subtitle.textContent = pickingSlots ? t('upgrade.selectAirport') : state.pendingHub ? t('upgrade.selectHub') : t('upgrade.subtitle');
    sign.append(heading, subtitle);
    wrap.append(sign);
    if (state.pendingHub) {
      // The globe must stay readable while the player taps a hub: only the sign remains.
      if (this.options.onCancelPick) sign.prepend(backTile(() => this.options.onCancelPick?.(state.week))); // [task-39]
      const pickIds = pickingSlots ? this.airports.map(a => a.cityId) : this.hubs.map(h => h.hubId);
      sign.append(pickButtons(pickIds, (id) => this.selectHub(id))); // [m3] D-55 keyboard / screen-reader pick
      this.options.onHubSelectionMode?.(true, pickIds);
      this.root.append(wrap);
      return;
    }
    this.options.onHubSelectionMode?.(false, []);
    const cards = document.createElement('div');
    cards.className = 'airway-upgrade-labels';
    cards.dataset.count = String(state.offers.length);
    state.offers.forEach((offer, i) => {
      const model = cardModel(offer.id, i, state.offers.length, hubs, upgradeFacts(), airports);
      const { card, window } = cargoLabel(model, i);
      card.disabled = model.unavailable;
      card.addEventListener('click', () => this.options.onCommand({ type: 'ChooseUpgrade', week: state.week, upgrade: offer.id }));
      cards.append(card);
      this.options.onPreviewModel?.(window, offer.id);
    });
    wrap.append(cards);
    this.root.append(wrap);
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
