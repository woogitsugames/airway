import { getLanguage, t } from '../../i18n';
import { iconSvg } from './icons';
import type { HudActions, HudState, PlaneType } from './types';

type TagId = 'undo' | PlaneType | 'hub' | 'speed';
const TAGS: readonly TagId[] = ['undo', 'turboprop', 'widebody', 'hub', 'speed'];
const DRAG_THRESHOLD_SQUARED = 64;

interface DragState {
  readonly type: PlaneType;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  moved: boolean;
}

function formatCount(value: number): string {
  return String(Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);
}

/** The dock emits intents only; it does not decrement inventory or change the selection itself. */
export function createTagDock(root: HTMLElement, actions: HudActions): { render(state: HudState): void; destroy(): void } {
  const dock = document.createElement('nav');
  dock.className = 'airway-dock';
  dock.setAttribute('aria-label', t('hud.dock'));
  const controls = new Map<TagId, HTMLButtonElement>();
  for (const tag of TAGS) {
    const holder = document.createElement('div');
    holder.className = 'airway-dock__holder';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'airway-dock__tag';
    button.dataset.hudAction = tag;
    button.innerHTML = `<span class="airway-dock__eyelet" aria-hidden="true"></span>${iconSvg(tag === 'speed' ? 'speed' : tag)}<span class="airway-dock__count" aria-hidden="true"></span>`;
    holder.appendChild(button);
    dock.appendChild(holder);
    controls.set(tag, button);
  }
  const ghost = document.createElement('div');
  ghost.className = 'airway-dock__ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.hidden = true;
  root.append(dock, ghost);

  let active: DragState | null = null;
  let locale = '';
  let lastSpeed = 0;

  function hideGhost(): void {
    if (!ghost.hidden) ghost.hidden = true;
    dock.classList.remove('is-dragging');
  }

  function drop(type: PlaneType, x: number, y: number): void {
    const hit = document.elementFromPoint(x, y);
    const route = actions.routeAtPoint?.(x, y)
      ?? hit?.closest<HTMLElement>('[data-route-id]')?.dataset.routeId
      ?? null;
    if (route) actions.onAssignPlane?.(type, route);
  }

  for (const [name, button] of controls) {
    if (name === 'undo') button.addEventListener('click', () => actions.onUndo?.());
    else if (name === 'hub') button.addEventListener('click', () => actions.onUpgradeHub?.());
    else if (name === 'speed') button.addEventListener('click', () => actions.onCycleSpeed?.());
    else {
      const plane: PlaneType = name;
      button.addEventListener('click', (event) => {
        // Keyboard and assistive-technology activation; pointer clicks are handled on release.
        if (event.detail === 0) actions.onSelectPlane?.(plane);
      });
      button.addEventListener('pointerdown', (event) => {
        if (button.disabled || !event.isPrimary || event.button !== 0 || active) return;
        active = { type: plane, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
        button.setPointerCapture(event.pointerId);
      });
      button.addEventListener('pointermove', (event) => {
        const drag = active;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && dx * dx + dy * dy >= DRAG_THRESHOLD_SQUARED) {
          drag.moved = true;
          ghost.innerHTML = iconSvg(drag.type);
          ghost.hidden = false;
          dock.classList.add('is-dragging');
        }
        if (drag.moved) ghost.style.transform = `translate3d(${event.clientX - 27}px, ${event.clientY - 30}px, 0)`;
      });
      button.addEventListener('pointerup', (event) => {
        const drag = active;
        if (!drag || drag.pointerId !== event.pointerId) return;
        active = null;
        hideGhost();
        if (drag.moved) drop(drag.type, event.clientX, event.clientY);
        else if (!button.disabled) actions.onSelectPlane?.(drag.type);
      });
      button.addEventListener('pointercancel', (event) => {
        if (active?.pointerId !== event.pointerId) return;
        active = null;
        hideGhost();
      });
      button.addEventListener('lostpointercapture', () => {
        active = null;
        hideGhost();
      });
    }
  }

  return {
    render(state): void {
      const language = getLanguage();
      if (language !== locale) {
        locale = language;
        dock.setAttribute('aria-label', t('hud.dock'));
      }
      for (const [name, button] of controls) {
        const isPlane = name === 'turboprop' || name === 'widebody';
        const stock = name === 'turboprop' ? state.stock.turboprop
          : name === 'widebody' ? state.stock.widebody
          : name === 'hub' ? state.stock.hub : 0;
        const count = button.querySelector('.airway-dock__count');
        const nextCount = name === 'speed' ? `${state.speed}×` : name === 'undo' ? '' : formatCount(stock);
        if (count && count.textContent !== nextCount) count.textContent = nextCount;
        const disabled = (name === 'undo' && !state.canUndo)
          || ((isPlane || name === 'hub') && (!Number.isFinite(stock) || stock <= 0));
        if (button.disabled !== disabled) button.disabled = disabled;
        button.classList.toggle('is-empty', disabled);
        const chosen = isPlane && !disabled && name === state.selectedPlane;
        button.classList.toggle('is-selected', chosen);
        if (isPlane) button.setAttribute('aria-pressed', String(chosen));
        const label = name === 'undo' ? t('hud.undo')
          : name === 'hub' ? t('hud.hubCount', { count: nextCount })
          : name === 'turboprop' ? t('hud.turbopropCount', { count: nextCount })
          : name === 'widebody' ? t('hud.widebodyCount', { count: nextCount })
          : t('hud.speed', { speed: state.speed });
        if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      }
      if (lastSpeed !== state.speed) {
        lastSpeed = state.speed;
        controls.get('speed')?.setAttribute('data-speed', String(state.speed));
      }
      // Invalidate a pending drag when its item is depleted by another command.
      if (active && controls.get(active.type)?.disabled) {
        active = null;
        hideGhost();
      }
    },
    destroy(): void {
      active = null;
      hideGhost();
      dock.remove();
      ghost.remove();
    },
  };
}
