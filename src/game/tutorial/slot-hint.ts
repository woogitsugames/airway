// [task-32] One short training step about departure slots (D-41). It is not part of the first-run
// vignette: it appears in a live run the first time an aircraft is held for a slot, once per install,
// as an ATC paper strip (D-11) that leaves on the next tap or after a few seconds.
import { t } from '../../i18n';
import { browserTutorialStorage, type TutorialStorage } from './controller';
import '../../ui/atcStrip.css';

export const SLOT_HINT_KEY = 'aw-tutorial-slots';
const VISIBLE_MS = 9000;

export interface SlotHint {
  /** An aircraft is held at `airport`; shows the hint only if it was never shown before. */
  held(airport: string, limit: number, minutesToSlot: number): void;
  readonly visible: boolean;
  /** Hide early (e.g. when the weekly board opens). */
  hide(): void;
  dispose(): void;
}

/** Game time until the next slot as H:MM, e.g. "0:12" (the tag in docs/tasks/32). */
export function slotClock(minutes: number): string {
  const whole = Math.max(0, Math.floor(minutes));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function seen(storage: TutorialStorage | null): boolean {
  try { return storage?.getItem(SLOT_HINT_KEY) === '1'; } catch { return false; }
}

export function mountSlotHint(host: HTMLElement, storage: TutorialStorage | null = browserTutorialStorage()): SlotHint {
  const strip = document.createElement('aside');
  strip.className = 'airway-atc-strip airway-slot-hint';
  strip.dataset.testid = 'slot-hint';
  strip.setAttribute('role', 'status');
  strip.setAttribute('aria-live', 'polite');
  strip.hidden = true;
  const step = document.createElement('span');
  step.className = 'airway-atc-field airway-atc-flight';
  const tag = document.createElement('strong');
  tag.className = 'airway-atc-field airway-atc-error';
  const hint = document.createElement('span');
  hint.className = 'airway-atc-field airway-atc-hint';
  strip.append(step, tag, hint);
  host.append(strip);
  let shown = seen(storage);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const hide = (): void => {
    strip.hidden = true;
    if (timer !== null) { clearTimeout(timer); timer = null; }
    host.removeEventListener('pointerdown', hide, true);
  };
  return {
    held(airport, limit, minutesToSlot) {
      if (shown) return;
      shown = true;
      try { storage?.setItem(SLOT_HINT_KEY, '1'); } catch { /* storage is optional */ }
      step.textContent = t('tutorial.step.slots');
      tag.textContent = t('tutorial.slots.tag', { airport, time: slotClock(minutesToSlot) });
      hint.textContent = t('tutorial.slots.hint', { airport, limit });
      strip.hidden = false;
      host.addEventListener('pointerdown', hide, true);
      timer = setTimeout(hide, VISIBLE_MS);
    },
    get visible() { return !strip.hidden; },
    hide,
    dispose() { hide(); strip.remove(); },
  };
}
