// [m3] D-55: screen-reader announcements for the run (aria-live). Presentation only: it reads the
// city list the session already built for the frame and never writes run state.
// Two regions: polite (role=status) for everything, assertive (role=alert) only for a hub that has
// started its jam countdown. Messages are coalesced (one utterance per flush) and throttled in game
// time, so a busy network never floods the screen reader.
import { t } from '../i18n';
import { SIM_TICKS_PER_SECOND } from '../sim/params';
import { airportLabel } from './airportLabel';

export type LivePriority = 'polite' | 'assertive';

export interface LiveCity {
  readonly id: string;
  readonly hub: boolean;
  readonly capacity: number;
  readonly waiting: readonly unknown[];
  readonly jamTicksLeft: number | null;
  readonly slotHeld: number;
}

export interface LiveAnnouncer {
  /** Free text (already translated). Polite messages arriving in one flush window are joined. */
  say(text: string, priority?: LivePriority): void;
  /** Per-frame city readings: overload warnings, jam start/clear, slot holds (game-time throttled). */
  cities(cities: readonly LiveCity[], clockMinute: number): void;
  /** The weekly board opened with these offer titles. */
  upgradeOpened(week: number, titles: readonly string[]): void;
  gameOver(hubId: string, delivered: number): void;
  /** Everything said so far (QA; bounded). */
  readonly log: readonly { readonly priority: LivePriority; readonly text: string }[];
  dispose(): void;
}

/** An airport is "nearly full" from this load; the warning re-arms when it drops below RESET. */
const WARN_RATIO = 0.8;
const RESET_RATIO = 0.6;
/** At most one slot-hold message per this many game minutes (one game hour). */
const SLOT_WINDOW_MINUTES = 60;
const FLUSH_MS = 400;
const MAX_LOG = 200;

const plain = (text: string): string => text.replace(/­/g, '');

function region(priority: LivePriority): HTMLElement {
  const node = document.createElement('div');
  node.className = 'airway-sr-only';
  node.dataset.airwayLive = priority;
  node.setAttribute('role', priority === 'assertive' ? 'alert' : 'status');
  node.setAttribute('aria-live', priority);
  node.setAttribute('aria-atomic', 'true');
  return node;
}

export function createLiveAnnouncer(host: HTMLElement): LiveAnnouncer {
  const polite = region('polite');
  const assertive = region('assertive');
  host.append(polite, assertive);
  const pending: Record<LivePriority, string[]> = { polite: [], assertive: [] };
  const log: { priority: LivePriority; text: string }[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const warned = new Set<string>();
  const jammed = new Set<string>();
  let slotWindow = -1;
  const slotSeen = new Set<string>();

  function write(target: HTMLElement, text: string): void {
    // Clearing first makes an identical message count as a change for every screen reader.
    target.textContent = '';
    setTimeout(() => { if (!disposed) target.textContent = text; }, 60); // not rAF: frames may stall
  }
  function flush(): void {
    timer = null;
    if (disposed) return;
    for (const priority of ['assertive', 'polite'] as const) {
      const lines = pending[priority].splice(0);
      if (!lines.length) continue;
      const text = lines.map((line) => (/[.!?…]$/.test(line) ? line : line + '.')).join(' ');
      write(priority === 'assertive' ? assertive : polite, text);
      log.push({ priority, text });
      if (log.length > MAX_LOG) log.shift();
    }
  }
  function say(text: string, priority: LivePriority = 'polite'): void {
    if (disposed || !text) return;
    const list = pending[priority];
    if (!list.includes(text)) list.push(text);
    timer ??= setTimeout(flush, FLUSH_MS);
  }

  return {
    say,
    cities(cities, clockMinute) {
      const held: string[] = [];
      for (const city of cities) {
        const ratio = city.capacity > 0 ? city.waiting.length / city.capacity : 0;
        const label = airportLabel(city.id, 'name'); // a spoken name reads better than a code
        if (city.jamTicksLeft !== null) {
          if (!jammed.has(city.id)) {
            jammed.add(city.id);
            warned.add(city.id);
            say(t('a11y.live.jam', { hub: label, seconds: Math.max(1, Math.ceil(city.jamTicksLeft / SIM_TICKS_PER_SECOND)) }), 'assertive');
          }
        } else if (jammed.delete(city.id)) {
          say(t('a11y.live.jamCleared', { hub: label }));
        }
        if (city.capacity > 0 && city.jamTicksLeft === null) {
          if (ratio >= WARN_RATIO && !warned.has(city.id)) {
            warned.add(city.id);
            say(t('a11y.live.busy', { hub: label, waiting: city.waiting.length, capacity: city.capacity }));
          } else if (ratio < RESET_RATIO) warned.delete(city.id);
        }
        if (city.slotHeld > 0) held.push(city.id);
      }
      const window = Math.floor(clockMinute / SLOT_WINDOW_MINUTES);
      if (window !== slotWindow) { slotWindow = window; slotSeen.clear(); }
      const fresh = held.filter((id) => !slotSeen.has(id));
      if (fresh.length && slotSeen.size === 0) {
        // One coalesced message per game hour: every airport that holds aircraft right now.
        for (const id of held) slotSeen.add(id);
        say(t('a11y.live.slotHold', { airports: held.map((id) => airportLabel(id, 'name')).join(', ') }));
      }
    },
    upgradeOpened(week, titles) {
      say(t('a11y.live.upgrade', { week, offers: titles.map(plain).join(', ') }));
    },
    gameOver(hubId, delivered) {
      say(t('a11y.live.gameOver', { hub: airportLabel(hubId, 'name'), score: delivered }));
    },
    get log() { return log; },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      polite.remove();
      assertive.remove();
    },
  };
}
