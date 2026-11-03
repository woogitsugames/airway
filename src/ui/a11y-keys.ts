// [m3] D-55: keyboard and TV-remote (D-pad) operation for every screen.
// - Tab / Shift+Tab stay inside the topmost open modal board (upgrade, pause, game over, tutorial).
// - Arrow keys move focus to the previous / next control of the same scope (D-pad on a tablet or TV).
// - Escape / BrowserBack are the Android back press (src/platform/back.ts); nothing to do here.
// - `data-airway-keyboard` on <html> marks keyboard modality so keyboard-only helpers can show.

const FOCUSABLE = [
  'button:not([disabled])', 'a[href]', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function visible(element: HTMLElement): boolean {
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const rects = element.getClientRects();
  if (!rects.length) return false;
  const style = getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

/** The topmost open modal board, or null when none is open. */
export function activeModal(root: ParentNode = document): HTMLElement | null {
  const modals = [...root.querySelectorAll<HTMLElement>('[aria-modal="true"]')].filter(visible);
  return modals.at(-1) ?? null;
}

/** Focusable controls of a scope in DOM (= reading) order. */
export function focusables(scope: ParentNode): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
}

/** Move focus into a freshly opened board (first enabled control); returns the focused element. */
export function focusInto(scope: HTMLElement | null, preferred?: string): HTMLElement | null {
  if (!scope) return null;
  const list = focusables(scope);
  const target = (preferred ? list.find((element) => element.matches(preferred)) : undefined) ?? list[0] ?? null;
  target?.focus({ preventScroll: true });
  return target;
}

function editable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit'].includes(target.type);
  return target.isContentEditable;
}

export function installKeyboardNavigation(doc: Document = document): () => void {
  const html = doc.documentElement;
  const scopeOf = (): HTMLElement => activeModal(doc) ?? doc.querySelector<HTMLElement>('#app') ?? doc.body;

  const onKey = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Tab' || NAV_KEYS.has(event.key)) html.dataset.airwayKeyboard = 'true';
    if (event.key === 'Tab') {
      const scope = activeModal(doc);
      if (!scope) return;
      const list = focusables(scope);
      if (!list.length) { event.preventDefault(); return; }
      const index = list.indexOf(doc.activeElement as HTMLElement);
      const next = event.shiftKey
        ? (index <= 0 ? list.at(-1) : list[index - 1])
        : (index < 0 || index === list.length - 1 ? list[0] : list[index + 1]);
      event.preventDefault();
      next?.focus({ preventScroll: true });
      return;
    }
    if (!NAV_KEYS.has(event.key) || event.shiftKey || editable(event.target)) return;
    const list = focusables(scopeOf());
    if (!list.length) return;
    const index = list.indexOf(doc.activeElement as HTMLElement);
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const next = index < 0 ? list[0]
      : list[Math.max(0, Math.min(list.length - 1, index + (forward ? 1 : -1)))];
    if (next && next !== doc.activeElement) {
      event.preventDefault();
      next.focus({ preventScroll: true });
    }
  };
  const onPointer = (): void => { delete html.dataset.airwayKeyboard; };
  // A focused control removed with its board must not leave focus on <body> inside a modal.
  const onFocusIn = (event: FocusEvent): void => {
    const scope = activeModal(doc);
    if (scope && event.target instanceof Node && !scope.contains(event.target)) focusInto(scope);
  };
  doc.addEventListener('keydown', onKey);
  doc.addEventListener('pointerdown', onPointer, true);
  doc.addEventListener('focusin', onFocusIn);
  return () => {
    doc.removeEventListener('keydown', onKey);
    doc.removeEventListener('pointerdown', onPointer, true);
    doc.removeEventListener('focusin', onFocusIn);
  };
}
