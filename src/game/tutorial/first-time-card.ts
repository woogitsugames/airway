// [night-11p] R6a / D-130: the "first time" cards, drawn as the slot hint's ATC paper strip (D-11) with a 48 dp
// dismiss tag. A card never stops time; it leaves on its button or after a while, and each card shows once per
// install (marked when shown). Only one card is on screen; others wait their turn in arrival order.
import { t } from '../../i18n';
import type { FirstTimeCard, FirstTimeRegistry } from './first-time';
import '../../ui/skin/current.css'; // [night-11as] skin tokens read by atcStrip.css
import '../../ui/atcStrip.css';

const VISIBLE_MS = 12000;

export interface FirstTimeText {
  /** Short stamp on the strip, e.g. "IST · HUB 26/36". */
  readonly tag: string;
  /** One or two short sentences. */
  readonly hint: string;
}

export interface FirstTimeCards {
  /** Queue a card unless it was ever shown or is already waiting; `text` is read when the card is shown. */
  offer(card: FirstTimeCard, text: () => FirstTimeText): void;
  /** Show the next waiting card when nothing else is on screen and `blocked` is false. */
  flush(blocked: boolean): void;
  readonly visible: FirstTimeCard | null;
  hide(): void;
  dispose(): void;
}

const STEP_KEYS = {
  'hub-full': 'firstTime.step.hubFull',
  'out-of-range': 'firstTime.step.outOfRange',
  curfew: 'firstTime.step.curfew',
  'weekly-board': 'firstTime.step.weeklyBoard',
  surge: 'firstTime.step.surge', // [night-35a] D-272
} as const;

/** [night-35a] D-272: `onShow` runs once when a card appears (the surge card's one-time sound). */
export function mountFirstTimeCards(
  host: HTMLElement, registry: FirstTimeRegistry, enabled = true, onShow?: (card: FirstTimeCard) => void,
): FirstTimeCards {
  const strip = document.createElement('aside');
  strip.className = 'airway-atc-strip airway-first-time';
  strip.dataset.testid = 'first-time-card';
  strip.setAttribute('role', 'status');
  strip.setAttribute('aria-live', 'polite');
  strip.hidden = true;
  const step = document.createElement('span');
  step.className = 'airway-atc-field airway-atc-flight';
  const tag = document.createElement('strong');
  tag.className = 'airway-atc-field airway-atc-error';
  const hint = document.createElement('span');
  hint.className = 'airway-atc-field airway-atc-hint';
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'airway-first-time__ok';
  dismiss.dataset.testid = 'first-time-ok';
  strip.append(step, tag, hint, dismiss);
  host.append(strip);
  const pending: Array<{ card: Exclude<FirstTimeCard, 'slots'>; text: () => FirstTimeText }> = [];
  let current: FirstTimeCard | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const hide = (): void => {
    strip.hidden = true;
    current = null;
    delete strip.dataset.card;
    if (timer !== null) { clearTimeout(timer); timer = null; }
  };
  dismiss.addEventListener('click', hide);
  return {
    offer(card, text) {
      if (!enabled || card === 'slots' || registry.seen(card) || current === card || pending.some((item) => item.card === card)) return;
      pending.push({ card, text });
    },
    flush(blocked) {
      if (blocked || current !== null || pending.length === 0) return;
      const next = pending.shift()!;
      if (registry.seen(next.card)) return;
      registry.mark(next.card);
      const copy = next.text();
      current = next.card;
      strip.dataset.card = next.card;
      step.textContent = t(STEP_KEYS[next.card]);
      tag.textContent = copy.tag;
      hint.textContent = copy.hint;
      dismiss.textContent = t('firstTime.ok');
      dismiss.setAttribute('aria-label', t('firstTime.okAria'));
      strip.hidden = false;
      timer = setTimeout(hide, VISIBLE_MS);
      onShow?.(next.card);
    },
    get visible() { return current; },
    hide,
    dispose() { hide(); pending.length = 0; strip.remove(); },
  };
}
