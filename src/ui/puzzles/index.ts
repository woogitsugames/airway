// Task 17: airport departure-board puzzle selector and temporary flight-strip editor.
import { PUZZLES, type PuzzleLevel, type PuzzleCommand } from '../../data/puzzles';
import { dispatchPuzzle, resetPuzzle, startPuzzle, undoPuzzle, type PuzzleSession } from '../../game/modes/puzzle';
import { getLanguage, setLanguage, t, type TranslationKey } from '../../i18n';
import './board.css';

const PROGRESS_KEY = 'airway.puzzles.v1';
type Progress = Record<string, number>;
function readProgress(): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Progress = {};
    for (const level of PUZZLES) {
      const value = (parsed as Record<string, unknown>)[level.id];
      if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3) result[level.id] = value;
    }
    return result;
  } catch { return {}; }
}
function saveProgress(progress: Progress): void {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); }
  catch { /* Private browsing may block storage; the session still keeps progress. */ }
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text: string, action: string, className = '', disabled = false): HTMLButtonElement {
  const node = element('button', className, text);
  node.type = 'button';
  node.dataset.action = action;
  node.disabled = disabled;
  return node;
}
function heading(level: PuzzleLevel): string { return t(level.titleKey as TranslationKey); }
function goalLine(level: PuzzleLevel): string {
  if (level.goal.kind === 'continents') return t('puzzle.goal.continents', {
    continents: level.goal.continents, passengers: level.goal.targetDelivered,
  });
  if (level.goal.kind === 'curfewNights') return t('puzzle.goal.nights', {
    nights: level.goal.nights, passengers: level.goal.targetDelivered,
  });
  return t('puzzle.goal.deliver', { passengers: level.goal.targetDelivered });
}
function stars(count: number): string { return `${'★'.repeat(count)}${'☆'.repeat(3 - count)}`; }
function remainingStock(session: PuzzleSession): string {
  const supply = session.snapshot.stock;
  return t('puzzle.inventory', { turboprops: supply.turboprops, jets: supply.jets, upgrades: supply.hubUpgrades });
}
export interface PuzzleUI { dispose(): void }
/** Mount once. Later the task-14 menu will use this view as a standalone route. */
export function mountPuzzleSelector(host: HTMLElement): PuzzleUI {
  const root = element('section', 'puzzle-shell');
  root.setAttribute('aria-label', t('puzzle.board.title'));
  const live = element('div', 'puzzle-live');
  live.setAttribute('aria-live', 'polite');
  root.appendChild(live);
  host.appendChild(root);
  const progress = readProgress();
  let current: PuzzleLevel | null = null;
  let session: PuzzleSession | null = null;
  let error = '';
  function renderBoard(): void {
    current = null;
    session = null;
    const completed = Object.keys(progress).length;
    const totalStars = Object.values(progress).reduce((a, b) => a + b, 0);
    const wrapper = element('div', 'puzzle-board');
    const banner = element('header', 'puzzle-sign');
    const logomark = element('span', 'puzzle-sign-plane');
    logomark.setAttribute('aria-hidden', 'true');
    banner.append(logomark, element('strong', '', t('app.title')),
      element('span', 'puzzle-sign-meta', t('puzzle.board.subtitle')));
    wrapper.appendChild(banner);
    const title = element('div', 'puzzle-board-title');
    title.append(element('span', '', t('puzzle.board.title')),
      element('span', 'puzzle-count', t('puzzle.board.progress', { done: completed, total: PUZZLES.length, stars: totalStars })));
    wrapper.appendChild(title);
    const table = element('div', 'puzzle-departures');
    table.setAttribute('role', 'group');
    PUZZLES.forEach((level) => {
      const flap = button('', `open:${level.id}`, 'puzzle-flap');
      flap.setAttribute('aria-label', t('puzzle.board.item', {
        number: level.id, title: heading(level), stars: progress[level.id] ?? 0,
      }));
      flap.append(element('span', 'puzzle-flap-number', level.id),
        element('span', 'puzzle-flap-title', heading(level)),
        element('span', 'puzzle-flap-gate', `B${level.id}`),
        element('span', `puzzle-flap-stars ${progress[level.id] ? 'is-done' : ''}`,
          progress[level.id] ? stars(progress[level.id]) : t('menu.onTime')));
      table.appendChild(flap);
    });
    wrapper.appendChild(table);
    const bottom = element('footer', 'puzzle-board-footer');
    bottom.append(element('span', '', t('puzzle.board.caption')),
      button(getLanguage().toUpperCase(), 'language', 'puzzle-language'));
    wrapper.appendChild(bottom);
    root.replaceChildren(wrapper, live);
  }
  function openLevel(level: PuzzleLevel): void {
    current = level;
    session = startPuzzle(level);
    error = '';
    renderGame();
  }
  function renderGame(): void {
    if (!current || !session) { renderBoard(); return; }
    const level = current;
    const { snapshot } = session;
    const over = snapshot.status !== 'playing';
    const wrapper = element('div', 'puzzle-game');
    const sign = element('header', 'puzzle-game-sign');
    sign.append(button(t('action.back'), 'back', 'puzzle-back'),
      element('strong', '', t('puzzle.game.title', { number: level.id })),
      element('span', 'puzzle-game-status', t(`puzzle.status.${snapshot.status}` as TranslationKey)));
    wrapper.appendChild(sign);
    const ticket = element('section', 'puzzle-ticket');
    ticket.append(element('p', 'puzzle-kicker', t('puzzle.game.brief')),
      element('h1', '', heading(level)), element('p', 'puzzle-goal', goalLine(level)));
    const statGrid = element('div', 'puzzle-stats');
    const stats = [
      [t('puzzle.stat.time'), t('puzzle.time', { current: Math.floor(snapshot.tick / 60), total: Math.floor(level.durationTicks / 60) })],
      [t('puzzle.stat.delivered'), String(snapshot.delivered)],
      [t('puzzle.stat.continents'), String(snapshot.coveredContinents)],
      [t('puzzle.stat.nights'), String(snapshot.nightsSurvived)],
    ];
    stats.forEach(([label, value]) => {
      const cell = element('div', 'puzzle-stat');
      cell.append(element('span', '', label), element('strong', '', value));
      statGrid.appendChild(cell);
    });
    ticket.appendChild(statGrid);
    if (over) {
      const info = element('p', `puzzle-result ${snapshot.status}`,
        snapshot.status === 'won' ? t('puzzle.result.won', { stars: stars(snapshot.stars), margin: snapshot.marginPercent }) :
          snapshot.reason === 'hub-jam' ? t('puzzle.result.jam', { city: snapshot.jammedCity ?? '' }) :
            t('puzzle.result.deadline'));
      ticket.appendChild(info);
    }
    if (error) ticket.appendChild(element('p', 'puzzle-error', error));
    wrapper.appendChild(ticket);
    const routesPanel = element('section', 'puzzle-route-panel');
    routesPanel.appendChild(element('h2', '', t('puzzle.game.routes')));
    routesPanel.appendChild(element('p', 'puzzle-supply', remainingStock(session)));
    const routes = element('div', 'puzzle-route-list');
    for (let index = 0; index < level.availableRoutes.length; index++) {
      const edge = level.availableRoutes[index];
      const id = [edge.from, edge.to].sort().join('-');
      const selected = snapshot.routes.includes(id);
      const label = `${edge.from}  —  ${edge.to}`;
      const route = button('', `connect:${index}`, `puzzle-route ${selected ? 'is-active' : ''}`,
        over || selected || (edge.plane === 'jet' ? snapshot.stock.jets : snapshot.stock.turboprops) <= 0);
      route.append(element('span', 'puzzle-route-codes', label),
        element('span', 'puzzle-route-detail', t(edge.plane === 'jet' ? 'puzzle.plane.jet' : 'puzzle.plane.turboprop')),
        element('span', 'puzzle-route-cta', selected ? t('puzzle.action.connected') : t('puzzle.action.connect')));
      routes.appendChild(route);
    }
    routesPanel.appendChild(routes);
    if (level.stock.hubUpgrades > 0) {
      routesPanel.appendChild(element('h2', 'puzzle-hub-heading', t('puzzle.game.hubs')));
      const hubs = element('div', 'puzzle-hub-list');
      for (const city of level.startCities) {
        const selected = snapshot.upgradedCities.includes(city.id);
        const count = snapshot.waiting[city.id] ?? 0;
        const item = button('', `upgrade:${city.id}`, 'puzzle-hub',
          over || selected || snapshot.stock.hubUpgrades === 0);
        item.append(element('span', '', `${city.id} · ${count}/${city.hubCapacity + (selected ? 32 : 0)}`),
          element('span', '', selected ? t('puzzle.action.upgraded') : t('puzzle.action.upgrade')));
        hubs.appendChild(item);
      }
      routesPanel.appendChild(hubs);
    }
    wrapper.appendChild(routesPanel);
    const controls = element('nav', 'puzzle-controls');
    controls.setAttribute('aria-label', t('puzzle.game.controls'));
    controls.append(button(t('puzzle.action.undo'), 'undo', 'puzzle-control', session.history.length === 0),
      button(t('puzzle.action.reset'), 'reset', 'puzzle-control'),
      button(t('puzzle.action.advance'), 'advance', 'puzzle-control', over),
      button(t('puzzle.action.finish'), 'finish', 'puzzle-control primary', over));
    wrapper.appendChild(controls);
    root.replaceChildren(wrapper, live);
  }
  const onClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest<HTMLButtonElement>('button[data-action]');
    if (!control || !root.contains(control) || control.disabled) return;
    const [name, value] = (control.dataset.action ?? '').split(':');
    if (name === 'language') { setLanguage(getLanguage() === 'pl' ? 'en' : 'pl'); renderBoard(); return; }
    if (name === 'back') { renderBoard(); return; }
    if (name === 'open') {
      const level = PUZZLES.find((item) => item.id === value);
      if (level) openLevel(level);
      return;
    }
    if (!current || !session) return;
    try {
      if (name === 'undo') session = undoPuzzle(current, session);
      if (name === 'reset') session = resetPuzzle(current);
      if (name === 'connect') {
        const route = current.availableRoutes[Number(value)];
        if (!route) return;
        const command: PuzzleCommand = { type: 'connect', from: route.from, to: route.to, plane: route.plane };
        session = dispatchPuzzle(current, session, command);
      }
      if (name === 'upgrade' && value) session = dispatchPuzzle(current, session, { type: 'upgradeHub', city: value });
      if (name === 'advance' || name === 'finish') {
        const remaining = current.durationTicks - session.snapshot.tick;
        if (remaining > 0) {
          session = dispatchPuzzle(current, session, { type: 'advance', ticks: name === 'finish' ? remaining : Math.min(360, remaining) });
        }
      }
      if (session.snapshot.status === 'won') {
        progress[current.id] = Math.max(progress[current.id] ?? 0, session.snapshot.stars);
        saveProgress(progress);
        live.textContent = t('puzzle.result.won', { stars: stars(session.snapshot.stars), margin: session.snapshot.marginPercent });
      } else live.textContent = '';
      error = '';
    } catch (cause) {
      error = t('puzzle.error.action');
      console.warn('Puzzle command rejected', cause);
    }
    renderGame();
  };
  root.addEventListener('click', onClick);
  renderBoard();
  return { dispose(): void { root.removeEventListener('click', onClick); root.remove(); } };
}
