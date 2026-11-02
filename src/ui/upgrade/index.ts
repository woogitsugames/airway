import type { HubPressure, UpgradeCommand, UpgradeKind, WeeklyUpgradeState } from '../../sim/upgrades';
import './upgrade.css';
import { t } from '../../i18n';
import { cardModel, type CardModel } from './cards';

export { cardModel, upgradeFacts, type CardModel, type UpgradeFacts } from './cards';

export interface UpgradeUIOptions {
  onCommand: (command: UpgradeCommand) => void;
  onHubSelectionMode?: (active: boolean, hubIds: readonly string[]) => void;
  onPreviewModel?: (container: HTMLElement, kind: UpgradeKind) => void;
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
  const grid = span('airway-upgrade-grid');
  for (const row of model.rows) grid.append(span('airway-upgrade-key', row.label), span('airway-upgrade-value', row.value));
  body.append(heading, title, grid);
  if (model.stamp) body.append(span('airway-upgrade-stamp', model.stamp));
  card.append(window, body);
  card.setAttribute('aria-label', [model.title, ...model.rows.map((row) => `${row.label}: ${row.value}`), model.stamp]
    .filter(Boolean).join('. '));
  return { card, window };
}

export class WeeklyUpgradeView {
  private readonly root: HTMLElement;
  private readonly options: UpgradeUIOptions;
  private state: WeeklyUpgradeState | null = null;
  private hubs: readonly HubPressure[] = [];
  constructor(root: HTMLElement, options: UpgradeUIOptions) { this.root = root; this.options = options; }
  render(state: WeeklyUpgradeState | null, hubs: readonly HubPressure[]): void {
    this.state = state;
    this.hubs = hubs;
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
    subtitle.textContent = state.pendingHub ? t('upgrade.selectHub') : t('upgrade.subtitle');
    sign.append(heading, subtitle);
    wrap.append(sign);
    if (state.pendingHub) {
      // The globe must stay readable while the player taps a hub: only the sign remains.
      this.options.onHubSelectionMode?.(true, this.hubs.map(h => h.hubId));
      this.root.append(wrap);
      return;
    }
    this.options.onHubSelectionMode?.(false, []);
    const cards = document.createElement('div');
    cards.className = 'airway-upgrade-labels';
    cards.dataset.count = String(state.offers.length);
    state.offers.forEach((offer, i) => {
      const model = cardModel(offer.id, i, state.offers.length, hubs);
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
    if (!state?.paused || !state.pendingHub || !this.hubs.some(h => h.hubId === hubId)) return;
    this.options.onCommand({ type: 'ChooseUpgrade', week: state.week, upgrade: 'hub-expansion', hubId });
  }
}
