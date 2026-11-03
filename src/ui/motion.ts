// [night-11g] R1h, D-88: one "reduce motion" source for the whole game. The player's switch in Settings → Display
// wins; until they touch it the game follows the system (`prefers-reduced-motion`). Everything that moves on its
// own asks `reducedMotion()`: the split-flap cascade, the game-over camera pan (cut instead), the menu globe turn,
// and every CSS animation through `:root[data-airway-motion="reduce"]` (no stylesheet reads the media query itself,
// `test:motion` checks that). No i18n or DOM framework imports, so Node tests load it directly.
const KEY = 'airway.settings';
const FIELD = 'reduceMotion';
const QUERY = '(prefers-reduced-motion: reduce)';
export type MotionMode = 'reduce' | 'full';

const listeners = new Set<(reduce: boolean) => void>();
/** undefined = not read yet; null = no explicit choice (follow the system). */
let memory: boolean | null | undefined;

function storedRecord(): Record<string, unknown> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
function media(): MediaQueryList | null {
  try {
    return typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(QUERY) : null;
  } catch {
    return null;
  }
}

/** What the operating system asks for (false when the browser cannot say). */
export function systemReducedMotion(): boolean {
  return media()?.matches === true;
}
/** The player's explicit choice, or null while the game follows the system. */
export function storedReducedMotion(): boolean | null {
  if (memory === undefined) {
    const value = storedRecord()[FIELD];
    memory = typeof value === 'boolean' ? value : null;
  }
  return memory;
}
/** The one question every animation asks: should this move be cut? */
export function reducedMotion(): boolean {
  return storedReducedMotion() ?? systemReducedMotion();
}
export function motionMode(): MotionMode {
  return reducedMotion() ? 'reduce' : 'full';
}

/** Mark the document root so stylesheets can still every animation with one attribute. */
export function applyMotion(root?: HTMLElement): void {
  const element = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (element) element.dataset.airwayMotion = motionMode();
}

function notify(root?: HTMLElement): void {
  applyMotion(root);
  const reduce = reducedMotion();
  listeners.forEach((listener) => listener(reduce));
}

/** Save the player's choice (null forgets it and follows the system again), apply it and tell the listeners. */
export function setReducedMotion(value: boolean | null, root?: HTMLElement): boolean {
  memory = value;
  try {
    const record = storedRecord();
    if (value === null) delete record[FIELD];
    else record[FIELD] = value;
    globalThis.localStorage?.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage may be denied; the choice still holds for this session.
  }
  notify(root);
  return reducedMotion();
}

export function onReducedMotionChange(listener: (reduce: boolean) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Apply now and follow later system changes (while no explicit choice) and other tabs' choices. */
export function initializeMotion(root?: HTMLElement): () => void {
  applyMotion(root);
  const query = media();
  const onSystem = (): void => { if (storedReducedMotion() === null) notify(root); };
  query?.addEventListener?.('change', onSystem);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === KEY) { memory = undefined; notify(root); }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    query?.removeEventListener?.('change', onSystem);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/** Test hook: forget the cached choice so the next read goes to storage again. */
export function resetMotionCache(): void {
  memory = undefined;
}
