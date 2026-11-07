/**
 * [night-28a] D-283 / D-284: the "Linoryt" skin helpers (docs/styles/kierunki-2026-11b/KIERUNKI.md, direction A; plan
 * docs/styles/kierunki-2026-11b/PLAN-LINORYT.md, step U1). A relief print in three inks on paper: the HUD is printed on a
 * paper margin at the top (a big Besley clock, the week, "day 2 of 3 · 34 passengers" and a day bar of 24 carved
 * hours, night hours inked solid, a red cut for "now") and a paper dock at the bottom behind a double print rule (six
 * cut symbols with captions, the chosen aircraft a solid ink block, an empty one only its outline); the menu is a
 * printed index under the title (the run-starting entry on the one red block).
 *
 * Step U1 is a DEV-only preview: src/main.ts turns it on only when `import.meta.env.DEV && ?skin=linoryt`, and every
 * call site is guarded by the same `import.meta.env.DEV`, so a release build folds the helpers away (dist/ stays
 * byte-identical). The preview builds on the base ("Diorama") DOM of the HUD and menu, not on Róża's: the flip step
 * (U6) deletes Róża and keeps the base components, restyled by linoryt.css.
 *
 * Like roza.ts this module has no runtime imports (only types): src/main.ts hands in what it needs. Player text reuses
 * existing catalog keys (`roza.*`, `menu.*`); U6 renames them to skin-neutral keys.
 */
import type { TranslationKey, TranslationParams } from '../../i18n';

export const linoryt = { on: false };

/** What the helpers need from the rest of the app, handed in by src/main.ts. */
export interface LinorytDeps {
  t(key: TranslationKey, params?: TranslationParams): string;
  localNumber(value: number): string;
}
let deps: LinorytDeps = { t: (key) => key, localNumber: String };
const t: LinorytDeps['t'] = (key, params) => deps.t(key, params);

/** Turns the preview on: <html data-skin="linoryt"> scopes linoryt.css (call before the HUD and menu are mounted). */
export function startLinoryt(next: LinorytDeps): void {
  deps = next;
  linoryt.on = true;
  document.documentElement.dataset.skin = 'linoryt';
}

/** Night hours of the day bar, inked solid: the same 20:00–06:00 band the Róża dial hatched (quiet demand hours). */
export const LINORYT_NIGHT = { from: 20, to: 6 } as const;
export const isNightHour = (hour: number): boolean => hour >= LINORYT_NIGHT.from || hour < LINORYT_NIGHT.to;

function setText(el: Element, text: string): void { if (el.textContent !== text) el.textContent = text; }
const pad2 = (n: number): string => String(n).padStart(2, '0');

// ---- Symbols ---------------------------------------------------------------------------------------------------------

/**
 * Cut symbols drawn for Airway (docs/styles/kierunki-2026-11b/src/icons.js, 100 × 100 boxes): solid ink shapes, as a
 * linocut prints them; linoryt.css draws an empty (unavailable) one as its outline only. The speed arrow carries one
 * wind barb per 1× of game speed, as in Róża.
 */
const SYMBOL = {
  undo: 'M78 70L78 46Q78 26 58 26L30 26 30 12 8 32 30 52 30 38 58 38Q66 38 66 46L66 70Z',
  turboprop: 'M46 8L54 8 56 40 92 44 92 54 56 56 55 80 68 86 68 92 32 92 32 86 45 80 44 56 8 54 8 44 44 40ZM20 34L30 34 30 46 20 46ZM70 34L80 34 80 46 70 46Z',
  widebody: 'M47 6L53 6 56 36 94 62 94 70 56 56 55 80 70 90 70 95 50 90 30 95 30 90 45 80 44 56 6 70 6 62 44 36ZM16 58L22 55 24 64 18 66ZM30 49L36 46 38 55 32 57ZM64 46L70 49 68 57 62 55ZM78 55L84 58 82 66 76 64Z',
  hub: 'M44 6L56 6 56 94 44 94ZM12 22L18 12 88 78 82 88ZM82 12L88 22 18 88 12 78Z',
  satellite: 'M50 8A42 42 0 1 1 49.9 8ZM50 18A32 32 0 0 0 50 82Q34 50 50 18Z',
  map: 'M50 8A42 42 0 1 1 49.9 8ZM50 18A32 32 0 0 0 50 82Q34 50 50 18Z',
  speed: 'M8 46L68 46 68 30 94 52 68 74 68 58 8 58Z',
  pause: 'M30 18H44V82H30ZM56 18H70V82H56Z',
  resume: 'M30 14L82 50 30 86Z',
} as const;
export type LinorytSymbol = keyof typeof SYMBOL;

/** One symbol as inline SVG (same class as the HUD icons, so the base layout sizes it). */
export function linorytIcon(name: LinorytSymbol, barbs = 1): string {
  const extra = name === 'speed'
    ? Array.from({ length: Math.max(1, barbs) }, (_, i) => `M${20 + i * 14} 46L${12 + i * 14} 22 ${22 + i * 14} 22 ${30 + i * 14} 46Z`).join('')
    : '';
  return `<svg class="airway-hud__icon lin-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="${SYMBOL[name]}${extra}" fill="currentColor" stroke-linejoin="round"/></svg>`;
}

// ---- HUD: clock, week, day/passengers, day bar ------------------------------------------------------------------------

interface PassParts { clock: HTMLElement; week: HTMLElement; sub: HTMLElement; cells: HTMLElement[]; now: HTMLElement; bar: HTMLElement; minute: number }
const passParts = new WeakMap<HTMLElement, PassParts>();

/**
 * The top margin of the HUD (inside the boarding pass section, whose old fields linoryt.css hides): the clock, the week
 * and "day 2 of 3 · 34 passengers" beside it, and under them the day bar — 24 carved hours, night hours solid ink, the
 * hours already flown today in Prussian blue, the rest hollow, a red cut at "now", figures at 0/6/12/18. The clock is
 * real text (it is the HUD's time); the bar repeats it graphically and is aria-hidden.
 */
export function linorytPass(section: HTMLElement, minute: number, week: number, day: number, days: number, passengers: number): void {
  let parts = passParts.get(section);
  if (!parts) {
    const box = document.createElement('div');
    box.className = 'lin-pass';
    const clock = document.createElement('div');
    clock.className = 'lin-clock';
    const lines = document.createElement('div');
    lines.className = 'lin-lines';
    const weekLine = document.createElement('div');
    weekLine.className = 'lin-week';
    const sub = document.createElement('div');
    sub.className = 'lin-sub';
    lines.append(weekLine, sub);
    const bar = document.createElement('div');
    bar.className = 'lin-day';
    bar.setAttribute('aria-hidden', 'true');
    const cells: HTMLElement[] = [];
    const row = document.createElement('div');
    row.className = 'lin-day__cells';
    for (let h = 0; h < 24; h++) {
      const cell = document.createElement('i');
      if (isNightHour(h)) cell.className = 'is-night';
      cells.push(cell);
      row.append(cell);
    }
    const now = document.createElement('b');
    now.className = 'lin-day__now';
    row.append(now);
    const figures = document.createElement('div');
    figures.className = 'lin-day__hours';
    for (const h of [0, 6, 12, 18]) {
      const span = document.createElement('span');
      span.textContent = String(h);
      span.style.setProperty('--h', String(h));
      figures.append(span);
    }
    bar.append(row, figures);
    box.append(clock, lines, bar);
    section.querySelector('.airway-pass__ticket')?.appendChild(box);
    parts = { clock, week: weekLine, sub, cells, now, bar, minute: -1 };
    passParts.set(section, parts);
    publishPassBottom(section);
  }
  setText(parts.clock, `${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`);
  setText(parts.week, t('roza.week', { week }));
  const count = t('roza.passengers', { count: passengers }).replace(String(passengers), deps.localNumber(passengers));
  setText(parts.sub, `${t('roza.dayOf', { day, days })} · ${count}`);
  if (parts.minute !== minute) {
    const hour = Math.floor(minute / 60);
    if (Math.floor(parts.minute / 60) !== hour) {
      parts.cells.forEach((cell, h) => {
        const next = isNightHour(h) ? 'is-night' : h < hour ? 'is-past' : h === hour ? 'is-now' : '';
        if (cell.className !== next) cell.className = next;
      });
    }
    parts.minute = minute;
    parts.now.style.setProperty('--at', (minute / 1440).toFixed(4));
  }
}

/**
 * [night-29a] U3: the sheets (pause, hub board, weekly board, report) start under the top margin, whose height depends on
 * the screen, the safe area and whether the day bar is folded away; its bottom edge is published as `--lin-pass-bottom`
 * on <html> and re-measured whenever the margin changes size.
 */
function publishPassBottom(section: HTMLElement): void {
  const root = document.documentElement;
  const publish = (): void => {
    const bottom = section.getBoundingClientRect().bottom;
    if (bottom > 0) root.style.setProperty('--lin-pass-bottom', `${Math.ceil(bottom)}px`);
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(publish).observe(section);
  publish();
}

// ---- Dock: captions ----------------------------------------------------------------------------------------------------

/**
 * The caption under a dock symbol, and the wait for the next crates under an empty aircraft or hub ("za 1 dzień", in
 * blue). Captions repeat the button's accessible name, so they are aria-hidden.
 */
export function linorytDockLabel(button: HTMLElement, name: string, globeMode: string | undefined, speed: number, wait: string | null): void {
  const text = name === 'undo' ? t('roza.dock.undo')
    : name === 'turboprop' ? t('roza.dock.turboprop')
    : name === 'widebody' ? t('roza.dock.widebody')
    : name === 'hub' ? t('roza.dock.hub')
    : name === 'globe' ? t(globeMode === 'map' ? 'roza.dock.map' : 'roza.dock.satellite')
    : t('roza.dock.speed', { speed });
  let caption = button.querySelector<HTMLElement>('.lin-caption');
  let when = button.querySelector<HTMLElement>('.lin-wait');
  if (!caption || !when) {
    caption = document.createElement('span');
    caption.className = 'lin-caption';
    caption.setAttribute('aria-hidden', 'true');
    when = document.createElement('span');
    when.className = 'lin-wait';
    when.setAttribute('aria-hidden', 'true');
    button.append(caption, when);
  }
  setText(caption, text);
  setText(when, wait === null ? '' : t('roza.dock.in', { when: wait }));
  when.hidden = wait === null;
}

// ---- Game-over report -----------------------------------------------------------------------------------------------

/**
 * [night-29a] U3: the failing hub's code on the report's one red block, beside the heading (the jam block of the map).
 * The heading and the "Map" button already name the hub for screen readers, so the block is aria-hidden.
 */
export function linorytReportHub(sign: HTMLElement, hubCode: string): void {
  const block = document.createElement('span');
  block.className = 'lin-hub';
  block.setAttribute('aria-hidden', 'true');
  block.textContent = hubCode;
  sign.querySelector('.airway-go-heading')?.after(block);
}

// ---- Menu ------------------------------------------------------------------------------------------------------------

/** The tagline under the title ("Sieć lotnicza na całym globie"). */
export function linorytTagline(): HTMLElement {
  const line = document.createElement('div');
  line.className = 'lin-tagline';
  line.textContent = t('roza.menu.tagline');
  return line;
}
