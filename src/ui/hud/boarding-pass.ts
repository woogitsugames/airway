import { getLanguage, t } from '../../i18n';
import type { HudState } from './types';
import { iconSvg } from './icons';

const DAYS = [
  'hud.monday', 'hud.tuesday', 'hud.wednesday', 'hud.thursday',
  'hud.friday', 'hud.saturday', 'hud.sunday',
] as const;

function updateText(node: Element, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

function integer(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.trunc(value))) : minimum;
}

/** Creates DOM once; render only touches nodes whose displayed values changed. */
export function createBoardingPass(root: HTMLElement, onTogglePause?: () => void): { render(state: HudState): void } {
  const section = document.createElement('section');
  section.className = 'airway-pass';
  section.setAttribute('aria-label', t('hud.boardingPass'));
  section.innerHTML = `
    <div class="airway-pass__ticket">
      <div class="airway-pass__band" aria-hidden="true"></div>
      <div class="airway-pass__field airway-pass__week"><span data-label="week" class="airway-pass__label"></span><strong data-value="week"></strong></div>
      <div class="airway-pass__field airway-pass__day"><span data-label="day" class="airway-pass__label"></span><strong data-value="day"></strong><span class="airway-pass__days" aria-hidden="true">${'<i></i>'.repeat(7)}</span></div>
      <div class="airway-pass__field airway-pass__time"><span data-label="time" class="airway-pass__label"></span><strong data-value="time"></strong></div>
      <div class="airway-pass__perf" aria-hidden="true"></div>
      <div class="airway-pass__field airway-pass__passengers"><span data-label="passengers" class="airway-pass__label"></span><strong data-value="passengers"></strong></div>
    </div>
    <button type="button" class="airway-pass__pause" data-hud-action="pause">${iconSvg('pause')}</button>
  `;
  root.appendChild(section);
  const field = (name: string): Element => {
    const element = section.querySelector(`[data-value="${name}"]`);
    if (!element) throw new Error(`Missing boarding-pass field: ${name}`);
    return element;
  };
  const week = field('week');
  const day = field('day');
  const time = field('time');
  const passengers = field('passengers');
  const squares = Array.from(section.querySelectorAll<HTMLElement>('.airway-pass__days i'));
  const pause = section.querySelector<HTMLButtonElement>('.airway-pass__pause');
  if (!pause) throw new Error('Missing pause control');
  pause.addEventListener('click', () => onTogglePause?.());
  let locale = '';
  let paused: boolean | undefined;
  let lastDay: number | undefined;
  let lastPassengers: number | undefined;

  return {
    render(state): void {
      const currentLanguage = getLanguage();
      if (currentLanguage !== locale) {
        locale = currentLanguage;
        section.setAttribute('aria-label', t('hud.boardingPass'));
        for (const label of ['week', 'day', 'time', 'passengers'] as const) {
          const el = section.querySelector(`[data-label="${label}"]`);
          if (el) updateText(el, t((`hud.${label}`) as 'hud.week' | 'hud.day' | 'hud.time' | 'hud.passengers'));
        }
        lastDay = undefined;
        lastPassengers = undefined;
      }
      const dayNumber = integer(state.day, 1, 7);
      updateText(week, String(integer(state.week, 1, 999)).padStart(2, '0'));
      updateText(day, t(DAYS[dayNumber - 1]));
      const minute = integer(state.timeMinutes, 0, 1439);
      updateText(time, `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
      const passengerCount = integer(state.passengers, 0, Number.MAX_SAFE_INTEGER);
      if (lastPassengers !== passengerCount || lastDay === undefined) {
        updateText(passengers, new Intl.NumberFormat(currentLanguage === 'pl' ? 'pl-PL' : 'en-US').format(passengerCount));
        lastPassengers = passengerCount;
      }
      if (lastDay !== dayNumber) {
        squares.forEach((square, index) => {
          const next = index + 1 === dayNumber ? 'is-current' : index + 1 < dayNumber ? 'is-past' : '';
          if (square.className !== next) square.className = next;
        });
        lastDay = dayNumber;
      }
      if (paused !== state.paused || pause.dataset.locale !== locale) {
        paused = state.paused;
        const nextLabel = t(state.paused ? 'action.resume' : 'action.pause');
        if (pause.getAttribute('aria-label') !== nextLabel) pause.setAttribute('aria-label', nextLabel);
        const nextIcon = state.paused ? 'resume' : 'pause';
        if (pause.dataset.icon !== nextIcon) {
          pause.innerHTML = iconSvg(nextIcon);
          pause.dataset.icon = nextIcon;
        }
        pause.setAttribute('aria-pressed', String(state.paused));
        pause.dataset.locale = locale;
      }
    },
  };
}
