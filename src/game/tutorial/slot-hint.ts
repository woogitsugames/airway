// [task-32] One short training step about departure slots (D-41). It is not part of the first-run
// vignette: it appears in a live run the first time an aircraft is held for a slot, once per install,
// as an ATC paper strip (D-11) that leaves on the next tap or after a few seconds.
// [m2] Shown through the shared contextual-hint queue (hints.ts, D-54); this file keeps its copy.
import { t } from '../../i18n';
import type { HintContent } from './hints';

export const SLOT_HINT_KEY = 'aw-tutorial-slots';

/** Game time until the next slot as H:MM, e.g. "0:12" (the tag in docs/tasks/32). */
export function slotClock(minutes: number): string {
  const whole = Math.max(0, Math.floor(minutes));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function slotHintContent(airport: string, limit: number, minutesToSlot: number): HintContent {
  return {
    step: t('tutorial.step.slots'),
    tag: t('tutorial.slots.tag', { airport, time: slotClock(minutesToSlot) }),
    text: t('tutorial.slots.hint', { airport, limit }),
  };
}
