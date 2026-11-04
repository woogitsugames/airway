// [night-11ai] R4g: keyboard shortcuts for play on a desktop, a Chromebook or a tablet with a keyboard.
// Pure mapping (no DOM types needed) plus a small listener; the game session decides what each action does.
// Escape/Back stays in src/platform/back.ts (one back entry point for Android back, Escape and history).

export type ShortcutSpeed = 1 | 2 | 4;
export type ShortcutAction =
  | { type: 'toggle-pause' }
  | { type: 'speed'; speed: ShortcutSpeed }
  | { type: 'zoom'; direction: 1 | -1 };

/** Screens of the game session (src/game/session.ts SessionScreen). */
export type ShortcutScreen = 'game' | 'upgrade' | 'gameover';

/** One key step; the same size as one wheel notch (deltaY 100 → ×0.82 in attachPointerGestures). */
export const KEY_ZOOM_STEP = 1.25;

/** The subset of KeyboardEvent this module reads; `target` is the focused element, if any. */
export interface KeyInput {
  readonly key: string;
  readonly code?: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly repeat?: boolean;
  readonly target?: unknown;
}

interface TargetLike {
  readonly tagName?: string;
  readonly type?: string;
  readonly isContentEditable?: boolean;
  closest?(selector: string): unknown;
}

const SPEED_BY_DIGIT: Readonly<Record<string, ShortcutSpeed>> = { 1: 1, 2: 2, 3: 4 };
const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time']);

function asTarget(value: unknown): TargetLike | null {
  return value && typeof value === 'object' ? value as TargetLike : null;
}

/** True when keys belong to a text field or a select (typing a "1" must never change the game speed). */
export function isTypingTarget(value: unknown): boolean {
  const target = asTarget(value);
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && TEXT_INPUT_TYPES.has((target.type ?? '').toLowerCase());
}

/**
 * True inside an open dialog (pause sheet, settings, weekly board, game-over report): there the keys keep their
 * normal meaning, e.g. Space activates the focused "Resume" button instead of toggling the pause a second time.
 */
export function isInDialog(value: unknown): boolean {
  const target = asTarget(value);
  return !!target?.closest?.('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
}

/** Map one key press to a game action, or null when the key is not a shortcut here. */
export function shortcutFor(event: KeyInput): ShortcutAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null; // browser zoom (Ctrl +) and OS shortcuts
  if (isTypingTarget(event.target) || isInDialog(event.target)) return null;
  const code = event.code ?? '';
  if (event.key === ' ' || event.key === 'Spacebar' || code === 'Space') return { type: 'toggle-pause' };
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code)?.[1] ?? (/^[0-9]$/.test(event.key) ? event.key : null);
  if (digit !== null) {
    const speed = SPEED_BY_DIGIT[digit];
    return speed ? { type: 'speed', speed } : null;
  }
  // '=' is '+' without Shift on US/UK layouts; '_' is '-' with Shift.
  if (event.key === '+' || event.key === '=' || code === 'NumpadAdd') return { type: 'zoom', direction: 1 };
  if (event.key === '-' || event.key === '_' || code === 'NumpadSubtract') return { type: 'zoom', direction: -1 };
  return null;
}

/**
 * Whether the session acts on an action on this screen. Pause and speed only change a running game; zoom also works
 * on the weekly airport pick and the game-over map. While paused only Space (resume) and zoom act on the globe.
 */
export function shortcutAllowed(action: ShortcutAction, screen: ShortcutScreen | 'menu'): boolean {
  if (action.type === 'zoom') return screen !== 'menu';
  return screen === 'game';
}

/**
 * Rows of the shortcut list in Settings → Help: key caps and the i18n key of the meaning. A cap that starts with
 * "settings.keys." is an i18n key (a word such as Space); the others are printed as they are. Mouse rows have no cap.
 */
export const SHORTCUT_HELP: ReadonlyArray<{ readonly keys: readonly string[]; readonly label: ShortcutHelpKey }> = [
  { keys: ['settings.keys.space'], label: 'settings.keys.pause' },
  { keys: ['1', '2', '3'], label: 'settings.keys.speed' },
  { keys: ['+', '−'], label: 'settings.keys.zoom' },
  { keys: ['Esc'], label: 'settings.keys.back' },
  { keys: [], label: 'settings.keys.wheel' },
  { keys: [], label: 'settings.keys.drag' },
];
export type ShortcutHelpKey = 'settings.keys.space' | 'settings.keys.pause' | 'settings.keys.speed' |
  'settings.keys.zoom' | 'settings.keys.back' | 'settings.keys.wheel' | 'settings.keys.drag';

/** `aria-keyshortcuts` values (WAI-ARIA key names, never translated) for the HUD controls with a shortcut. */
export const ARIA_KEYSHORTCUTS = { pause: 'Space', speed: '1 2 3' } as const;

export interface KeyEventLike extends KeyInput {
  preventDefault(): void;
}
export interface KeyTarget {
  addEventListener(type: 'keydown' | 'keyup', listener: (event: KeyEventLike) => void): void;
  removeEventListener(type: 'keydown' | 'keyup', listener: (event: KeyEventLike) => void): void;
}

/**
 * Listen for shortcuts on `target` (the window). `handle` returns true when it used the action; the key is then
 * consumed (no page scroll on Space, no button click on the focused HUD tag). A held key repeats zoom only.
 */
export function attachKeyboardShortcuts(target: KeyTarget, handle: (action: ShortcutAction) => boolean): () => void {
  let consumedSpace = false;
  const down = (event: KeyEventLike): void => {
    const action = shortcutFor(event);
    if (!action) return;
    if (event.repeat && action.type !== 'zoom') {
      if (action.type === 'toggle-pause' && consumedSpace) event.preventDefault();
      return;
    }
    if (!handle(action)) return;
    event.preventDefault();
    if (action.type === 'toggle-pause') consumedSpace = true;
  };
  // A focused button is clicked by Space on key release; the press already toggled the pause.
  const up = (event: KeyEventLike): void => {
    if (consumedSpace && (event.key === ' ' || event.code === 'Space')) { consumedSpace = false; event.preventDefault(); }
  };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
  };
}
