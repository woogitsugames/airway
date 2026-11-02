import type { HubPressure, UpgradeCommand, UpgradeKind, WeeklyUpgradeState } from '../../sim/upgrades';
import { mostLoadedHub } from '../../sim/upgrades';
import './upgrade.css';
import { en } from '../../i18n/en';
import { pl } from '../../i18n/pl';

export interface UpgradeCopy {
  week: (n: number) => string;
  header: string;
  selectHub: string;
  choose: string;
  planeTurboprop: string;
  planeWidebody: string;
  hub: string;
  slots: string;
  hubDetail: string;
  slotsDetail: string;
  aircraftDetail: string;
  pressure: string;
}
export interface UpgradeUIOptions {
  locale: 'pl' | 'en';
  onCommand: (command: UpgradeCommand) => void;
  onHubSelectionMode?: (active: boolean, hubIds: readonly string[]) => void;
  onPreviewModel?: (container: HTMLElement, kind: UpgradeKind) => void;
}
const label = (kind: UpgradeKind, copy: UpgradeCopy) => ({ turboprop: copy.planeTurboprop, widebody: copy.planeWidebody, 'hub-expansion': copy.hub, 'departure-slots': copy.slots })[kind];
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
    if (!state?.paused) { this.options.onHubSelectionMode?.(false, []); return; }
    const catalog = this.options.locale === 'pl' ? pl : en;
    const copy: UpgradeCopy = {
      week: n => catalog['notice.week'].replace('{week}', String(n)),
      header: catalog['upgrade.freight'],
      selectHub: catalog['upgrade.selectHub'],
      choose: '',
      planeTurboprop: catalog['upgrade.turboprop'],
      planeWidebody: catalog['upgrade.widebody'],
      hub: catalog['upgrade.hub'], slots: catalog['upgrade.slots'],
      hubDetail: catalog['upgrade.hubDetail'], slotsDetail: catalog['upgrade.slotsDetail'],
      aircraftDetail: catalog['upgrade.aircraftDetail'], pressure: catalog['upgrade.pressure']
    };
    const wrap = document.createElement('section');
    wrap.className = 'airway-upgrade';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', copy.week(state.week));
    const sign = document.createElement('h2');
    sign.className = 'airway-upgrade-sign';
    sign.textContent = copy.week(state.week);
    wrap.append(sign);
    if (state.pendingHub) {
      const notice = document.createElement('p'); notice.className = 'airway-upgrade-prompt';
      notice.textContent = copy.selectHub; wrap.append(notice);
      this.options.onHubSelectionMode?.(true, this.hubs.map(h => h.hubId));
    } else this.options.onHubSelectionMode?.(false, []);
    const cards = document.createElement('div'); cards.className = 'airway-upgrade-labels';
    const congested = mostLoadedHub(hubs);
    state.offers.forEach((offer, i) => {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'airway-upgrade-tag';
      card.disabled = state.pendingHub;
      card.setAttribute('aria-label', label(offer.id, copy));
      const heading = document.createElement('span'); heading.className = 'airway-upgrade-heading';
      heading.textContent = `${copy.header} · ${offer.id === 'turboprop' ? 'TP-48' : offer.id === 'widebody' ? 'WB-300' : offer.id === 'hub-expansion' ? 'HUB-06' : 'SL-02'} · ${i + 1}/3`;
      const model = document.createElement('span'); model.className = `airway-upgrade-model model-${offer.id}`;
      model.setAttribute('aria-hidden', 'true');
      const title = document.createElement('strong'); title.textContent = label(offer.id, copy);
      const detail = document.createElement('span'); detail.className = 'airway-upgrade-detail';
      detail.textContent = offer.id === 'hub-expansion' ? copy.hubDetail : offer.id === 'departure-slots' ? copy.slotsDetail : copy.aircraftDetail;
      const stamp = document.createElement('span'); stamp.className = 'airway-upgrade-stamp';
      stamp.textContent = congested ? `${congested.label.toUpperCase()} ${congested.waiting}/${congested.capacity}` : copy.pressure;
      card.append(heading, model, title, detail, stamp);
      card.addEventListener('click', () => this.options.onCommand({ type: 'ChooseUpgrade', week: state.week, upgrade: offer.id }));
      cards.append(card);
      this.options.onPreviewModel?.(model, offer.id);
    });
    wrap.append(cards); this.root.append(wrap);
  }
  /** Called by the globe hit-test when the hub highlight mode is active. */
  selectHub(hubId: string): void {
    const state = this.state;
    if (!state?.paused || !state.pendingHub || !this.hubs.some(h => h.hubId === hubId)) return;
    this.options.onCommand({ type: 'ChooseUpgrade', week: state.week, upgrade: 'hub-expansion', hubId });
  }
}
