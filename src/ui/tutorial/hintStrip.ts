// [m2] The contextual-hint strip (D-54): an ATC paper flight strip (D-11) with an acknowledgement
// field ("Roger") as its ≥ 48 dp tap target. Any other tap (globe, tags, board) also dismisses it
// and still reaches its target.
import { t } from '../../i18n';
import type { HintContent, HintId, HintView } from '../../game/tutorial/hints';
import '../atcStrip.css';
import './hints.css';

const TEST_IDS: Record<HintId, string> = {
  jam: 'jam-hint', slots: 'slot-hint', curfew: 'curfew-hint', upgrade: 'upgrade-hint',
};

export function mountHintStrip(host: HTMLElement, onDismiss: () => void): HintView & { dispose(): void } {
  const strip = document.createElement('aside');
  strip.className = 'airway-atc-strip airway-hint-strip';
  strip.setAttribute('role', 'status');
  strip.setAttribute('aria-live', 'polite');
  strip.hidden = true;
  const step = document.createElement('span');
  step.className = 'airway-atc-field airway-atc-flight';
  const tag = document.createElement('strong');
  tag.className = 'airway-atc-field airway-atc-error';
  const text = document.createElement('span');
  text.className = 'airway-atc-field airway-atc-hint';
  const ack = document.createElement('button');
  ack.type = 'button';
  ack.className = 'airway-hint-ack';
  ack.dataset.testid = 'hint-ack';
  strip.append(step, tag, text, ack);
  host.append(strip);
  const dismiss = (event: Event): void => {
    // Taps on the strip are handled by its own click; everything else just closes it and goes through.
    if (event.target instanceof Node && strip.contains(event.target)) return;
    onDismiss();
  };
  strip.addEventListener('click', () => onDismiss()); // the whole strip, "Roger" included
  return {
    show(id: HintId, content: HintContent, onBoard: boolean) {
      strip.dataset.testid = TEST_IDS[id];
      strip.dataset.hint = id;
      strip.classList.toggle('is-on-board', onBoard);
      step.textContent = content.step;
      tag.textContent = content.tag;
      tag.hidden = content.tag === '';
      text.textContent = content.text;
      ack.textContent = t('tutorial.hints.ack');
      ack.setAttribute('aria-label', t('tutorial.hints.dismiss'));
      strip.hidden = false;
      document.addEventListener('pointerdown', dismiss, true);
    },
    hide() {
      strip.hidden = true;
      document.removeEventListener('pointerdown', dismiss, true);
    },
    dispose() {
      document.removeEventListener('pointerdown', dismiss, true);
      strip.remove();
    },
  };
}
