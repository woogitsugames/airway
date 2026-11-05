/**
 * [night-11au] D-256: the KARTA skin preview (docs/styles/ui-2026-11/KIERUNKI.md), DEV only, pending the owner's choice.
 * src/main.ts turns it on in a DEV build with `?skin=karta` (production never sets it: the shipped UI stays the
 * "Diorama" skin of current.css). While on, the airport overlay names every on-screen airport (chart lettering) and
 * hands src/ui/skin/karta.css the geometry it draws from: leader line to the airport, seat scale, week ruler.
 *
 * [night-11av] The rest of the mockup's chart furniture: occupancy figures next to the code, glyphs grouped by region
 * with a count, the time arc on the jam ring, the distance note on an off-screen airport, day names under the week
 * ruler, names under the dock cells and the graphic scale on the menu's title block. Every helper below is called only
 * from a branch guarded by `import.meta.env.DEV && skinPreview.karta`, so a release build drops this code entirely.
 * Text comes from existing catalog keys only (no new player strings, so the release `dist/` stays unchanged).
 * This module has no runtime imports (only types): a static import here would move the i18n/sim modules earlier in
 * the release bundle even though the code is dropped, so src/main.ts hands in what it needs (KartaDeps).
 */
import type { TranslationKey, TranslationParams } from '../../i18n';
import type { DestinationRegion } from '../glyphs';

export const skinPreview = { karta: false };

/** What the helpers need from the rest of the app, handed in by the DEV branch of src/main.ts. */
export interface KartaDeps {
  t(key: TranslationKey, params?: TranslationParams): string;
  localNumber(value: number): string;
  /** CONGESTION_GRACE_TICKS / SIM_TICKS_PER_SECOND: the jam countdown's full length in seconds. */
  jamGraceSeconds: number;
}
let deps: KartaDeps = { t: (key) => key, localNumber: String, jamGraceSeconds: 45 };
const t: KartaDeps['t'] = (key, params) => deps.t(key, params);

/** Turns the preview on: <html data-skin="karta"> scopes karta.css (call before the HUD and overlay are mounted). */
export function startKartaPreview(next: KartaDeps): void {
  deps = next;
  skinPreview.karta = true;
  document.documentElement.dataset.skin = 'karta';
}

function setText(el: Element, text: string): void { if (el.textContent !== text) el.textContent = text; }

/** Mono figures in the label (karta.css: IBM Plex Mono 600, a 0.6 em advance): counts 12 px, occupancy 13 px; each
 *  extra child also takes the label's 3 px flex gap and its own margin (karta.css). */
const KARTA_DIGIT = 7.2;
const KARTA_FILL_DIGIT = 7.8;
/** One grouped region symbol: the 16 px glyph and its 2 px margin, as laid out by overlay.css. */
const KARTA_GLYPH = 18;

interface KartaLabel { fill: HTMLSpanElement; more: HTMLSpanElement; counts: Map<string, HTMLSpanElement>; extra: number }
const labels = new WeakMap<HTMLElement, KartaLabel>();
function labelState(bubble: HTMLElement): KartaLabel {
  let state = labels.get(bubble);
  if (!state) {
    const fill = document.createElement('span');
    fill.className = 'karta-fill';
    fill.setAttribute('aria-hidden', 'true');
    const more = document.createElement('span');
    more.className = 'karta-count karta-more';
    more.setAttribute('aria-hidden', 'true');
    state = { fill, more, counts: new Map(), extra: 0 };
    labels.set(bubble, state);
  }
  return state;
}

/**
 * Rewrites the label's child list in chart order: code, occupancy "14/24", then each region once with how many wait
 * for it (ready ones first, connecting ones hollow after them, in order of first arrival), as the mockup groups them.
 * The single glyphs and the "+N" overflow of the shipped tag are dropped. Returns the width of what it added minus the
 * glyph row it replaced (`removed`), which kartaExtraWidth() hands the tag layout (the overlay adds it to `mainWidth`).
 */
export function kartaLabelChildren(bubble: HTMLElement, want: Node[], plate: Node | null, waiting: readonly DestinationRegion[],
  connecting: number, capacity: number, removed: number, room: number,
  glyph: (region: DestinationRegion, hollow: boolean) => SVGSVGElement): void {
  const state = labelState(bubble);
  const kept = want.filter((node) => !(node instanceof SVGSVGElement) && !(node as Element).classList.contains('airport-bubble__count'));
  const at = plate ? kept.indexOf(plate) + 1 : 0;
  const added: Node[] = [];
  let width = -removed;
  const taken = Math.min(waiting.length, capacity);
  if (capacity > 0 && plate) {
    const text = `${taken}/${capacity}`;
    setText(state.fill, text);
    added.push(state.fill);
    width += 3 + 4 + text.length * KARTA_FILL_DIGIT;
  }
  const ready = waiting.length - Math.min(connecting, waiting.length);
  const groups = new Map<string, number>();
  waiting.forEach((region, i) => { const key = i < ready ? region : region + '~'; groups.set(key, (groups.get(key) ?? 0) + 1); });
  // Groups that do not fit in `room` (the screen width less the code, figures and timer) fold into "+N", so a
  // jam label always fits on a 320 px screen and the layout never drops it.
  let folded = 0;
  let used = 0;
  for (const [key, count] of groups) {
    const cost = KARTA_GLYPH + (count > 1 ? 8 + String(count).length * KARTA_DIGIT : 0);
    if (folded > 0 || used + cost > room) { folded += count; continue; }
    used += cost;
    const hollow = key.endsWith('~');
    added.push(glyph((hollow ? key.slice(0, -1) : key) as DestinationRegion, hollow));
    let span = state.counts.get(key);
    if (!span) {
      span = document.createElement('span');
      span.className = 'karta-count';
      span.setAttribute('aria-hidden', 'true');
      state.counts.set(key, span);
    }
    // A lone passenger is the symbol alone (as on the mockup); two or more carry their count.
    width += KARTA_GLYPH;
    if (count > 1) {
      setText(span, String(count));
      added.push(span);
      width += 3 + 5 + String(count).length * KARTA_DIGIT;
    }
  }
  if (folded > 0) {
    const text = '+' + folded;
    setText(state.more, text);
    added.push(state.more);
    width += 3 + 5 + text.length * KARTA_DIGIT;
  }
  kept.splice(at, 0, ...added);
  want.length = 0;
  want.push(...kept);
  state.extra = Math.ceil(width);
}

/** Width the chart lettering adds to the label over the shipped glyph row (see kartaLabelChildren). */
export function kartaExtraWidth(bubble: HTMLElement): number { return labels.get(bubble)?.extra ?? 0; }

/** Share of the jam grace still left (1 = just jammed, 0 = the network closes), for the time arc on the jam ring. */
export function kartaJamShare(seconds: number | null): string {
  const grace = deps.jamGraceSeconds;
  return seconds === null ? '0' : Math.max(0, Math.min(1, seconds / grace)).toFixed(3);
}

const EARTH_KM = 6371;
/**
 * The margin note of an off-screen airport: great-circle distance from the point under the view centre (the camera
 * looks at the globe's centre) to the airport, "1 790 km", rounded to 10 km; `side` lets karta.css keep it on screen.
 */
export function kartaEdgeNote(edge: HTMLElement, normal: { x: number; y: number; z: number },
  camera: { x: number; y: number; z: number }, side: number): void {
  const length = Math.hypot(camera.x, camera.y, camera.z) || 1;
  const cos = Math.max(-1, Math.min(1, (normal.x * camera.x + normal.y * camera.y + normal.z * camera.z) / length));
  const text = t('upgrade.value.km', { km: Math.round(Math.acos(cos) * EARTH_KM / 10) * 10 });
  if (edge.dataset.kartaKm !== text) edge.dataset.kartaKm = text;
  if (edge.dataset.kartaSide !== String(side)) edge.dataset.kartaSide = String(side);
}

/** Day names under the week ruler ("DZIEŃ 1 … 3"); today's is set in paper, the others dim. */
export function kartaDays(section: HTMLElement, days: number, today: number): void {
  let row = section.querySelector<HTMLElement>('.karta-days');
  if (!row) {
    row = document.createElement('div');
    row.className = 'karta-days';
    row.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < days; i++) row.appendChild(document.createElement('span'));
    section.querySelector('.airway-pass__ticket')?.appendChild(row);
  }
  const name = t('hud.day');
  Array.from(row.children).forEach((cell, i) => {
    setText(cell, `${name} ${i + 1}`);
    if (cell.classList.contains('is-today') !== (i + 1 === today)) cell.classList.toggle('is-today', i + 1 === today);
  });
}

/**
 * The name under a dock cell, from the catalog's short names (undo, the two aircraft, hub, the globe view, speed). The
 * speed has no short name of its own: the keyboard-help line "Game speed 1×, 2×, 4×" up to its first figure.
 */
export function kartaDockLabel(button: HTMLElement, name: string, globeMode: string | undefined): void {
  const text = name === 'undo' ? t('puzzle.action.undo')
    : name === 'turboprop' ? t('upgrade.turboprop')
    : name === 'widebody' ? t('upgrade.widebody')
    : name === 'hub' ? t('logbook.col.hub')
    : name === 'globe' ? t(globeMode === 'map' ? 'settings.globeMode.map' : 'settings.globeMode.satellite')
    : t('settings.keys.speed').replace(/\s*\d.*$/, '');
  let span = button.querySelector<HTMLElement>('.karta-dock-label');
  if (!span) {
    span = document.createElement('span');
    span.className = 'karta-dock-label';
    span.setAttribute('aria-hidden', 'true');
    button.appendChild(span);
  }
  setText(span, text);
}

/** The title block's graphic scale (0 · 1000 · 2000 km): a chart sheet always carries one. Decorative, aria-hidden. */
export function kartaScale(): HTMLElement {
  const scale = document.createElement('div');
  scale.className = 'karta-scale';
  scale.setAttribute('aria-hidden', 'true');
  const marks = document.createElement('span');
  for (const km of [0, 1000, 2000]) {
    const mark = document.createElement('b');
    mark.textContent = km === 2000 ? t('upgrade.value.km', { km }) : deps.localNumber(km);
    marks.appendChild(mark);
  }
  scale.append(document.createElement('i'), marks);
  return scale;
}

/** Bottom of the KARTA top margin (the HUD pass) in the overlay host's coordinates, 0 when no HUD is mounted. */
export function kartaTopMargin(host: HTMLElement): number {
  const pass = document.querySelector('.airway-pass');
  if (!pass) return 0;
  return Math.ceil(pass.getBoundingClientRect().bottom - host.getBoundingClientRect().top) + 4;
}

/**
 * Hides an edge note that would cover an airport label (the note sits outside the chip, so the tag layout does not
 * know it): a label, a jam above all, always wins over the distance.
 */
export function kartaEdgeClash(edge: HTMLElement, chip: { x: number; y: number; side: number },
  tags: readonly { x: number; y: number; width: number; height: number; placed: boolean }[]): void {
  const w = (edge.dataset.kartaKm ?? '').length * 6.6 + 4;
  const x = chip.side === 0 ? chip.x : chip.side === 1 ? chip.x + 58 - w : chip.x + 29 - w / 2;
  const y = chip.side === 3 ? chip.y - 17 : chip.y + 51;
  const clash = tags.some((tag) => tag.placed && tag.width > 0 && x < tag.x + tag.width && x + w > tag.x && y < tag.y + tag.height && y + 14 > tag.y);
  if ((edge.dataset.kartaClash === '1') !== clash) edge.dataset.kartaClash = clash ? '1' : '';
}
