/** Airport-paper route hints and route actions (D-11), independent of game state. */
import { localNumber, t } from '../i18n'; // [task-37] D-61 formatter
import type { RangeWarning, RouteHandle, RouteMenuRequest } from '../input/routeTool';
import './skin/current.css'; // [night-11as] skin tokens read by atcStrip.css
import './atcStrip.css';
import { setClass } from './classes'; // [night-59a] D-321

export interface AtcStrip { show(warning: RangeWarning | null): void; dispose(): void }
export interface RouteContextMenu { show(request: RouteMenuRequest | null): void; dispose(): void }

export function mountAtcStrip(host: HTMLElement): AtcStrip {
  const strip = document.createElement('aside');
  strip.className = 'airway-atc-strip';
  strip.setAttribute('role', 'status');
  strip.setAttribute('aria-live', 'polite');
  strip.hidden = true;
  const flight = document.createElement('span');
  flight.className = 'airway-atc-field airway-atc-flight';
  const reason = document.createElement('strong');
  reason.className = 'airway-atc-field airway-atc-error';
  const instruction = document.createElement('span');
  instruction.className = 'airway-atc-field airway-atc-hint';
  strip.append(flight, reason, instruction);
  host.appendChild(strip);
  let previous = '';
  return {
    show(warning) {
      if (!warning) { strip.hidden = true; previous = ''; return; }
      const distance = localNumber(warning.distanceKm);
      const aircraft = t(warning.aircraft === 'turboprop' ? 'route.aircraft.turboprop' : 'route.aircraft.widebody');
      const nextFlight = t('route.atc.distance', { distance, from: warning.from, to: warning.to });
      const nextReason = t('route.atc.overRange', { aircraft });
      const nextHint = t('route.atc.stopover');
      const token = nextFlight + '\n' + nextReason + '\n' + nextHint;
      if (previous !== token) {
        flight.textContent = nextFlight;
        reason.textContent = nextReason;
        instruction.textContent = nextHint;
        previous = token;
      }
      strip.hidden = false;
    },
    dispose() { strip.remove(); },
  };
}

/** Route hit testing/long-press timing are delegated to tasks 04 and 10. */
export function mountRouteContextMenu(host: HTMLElement, callbacks: {
  remove(): void;
  shorten(): void;
  close(): void;
}): RouteContextMenu {
  const menu = document.createElement('div');
  menu.className = 'airway-route-menu';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', t('route.menu.label'));
  menu.hidden = true;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'airway-route-menu-danger';
  remove.textContent = t('route.menu.remove');
  const shorten = document.createElement('button');
  shorten.type = 'button';
  shorten.textContent = t('route.menu.shorten');
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = t('route.menu.cancel');
  menu.append(remove, shorten, cancel);
  host.appendChild(menu);
  remove.addEventListener('click', callbacks.remove);
  shorten.addEventListener('click', callbacks.shorten);
  cancel.addEventListener('click', callbacks.close);
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); callbacks.close(); }
  };
  const onOutside = (event: PointerEvent): void => {
    if (!menu.hidden && event.target instanceof Node && !menu.contains(event.target)) callbacks.close();
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onOutside);
  return {
    show(request) {
      if (!request) { menu.hidden = true; return; }
      menu.setAttribute('aria-label', t('route.menu.label'));
      remove.textContent = t('route.menu.remove');
      shorten.textContent = t('route.menu.shorten');
      cancel.textContent = t('route.menu.cancel');
      shorten.disabled = !request.canShorten;
      // Stay within the visual viewport, including small 412dp portrait displays.
      const bounds = host.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(bounds.width - 216, request.x - 108)) + 'px';
      menu.style.top = Math.max(8, Math.min(bounds.height - 172, request.y - 24)) + 'px';
      menu.hidden = false;
      remove.focus();
    },
    dispose() {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
      menu.remove();
    },
  };
}

/** Visual 48dp end-handle targets. Hit testing remains in routeTool, below this overlay. */
export function mountRouteHandles(host: HTMLElement): {
  show(handles: readonly RouteHandle[], activeRouteId?: string | null): void;
  dispose(): void;
} {
  const layer = document.createElement('div');
  layer.className = 'airway-route-handles';
  layer.setAttribute('aria-hidden', 'true');
  host.appendChild(layer);
  const elements = new Map<string, HTMLSpanElement>();
  return {
    show(handles, activeRouteId = null) {
      const visible = new Set<string>();
      for (const handle of handles) {
        const id = handle.routeId + ':' + handle.end;
        visible.add(id);
        let element = elements.get(id);
        if (!element) {
          element = document.createElement('span');
          element.className = 'airway-route-handle';
          layer.appendChild(element);
          elements.set(id, element);
        }
        element.hidden = false;
        element.style.left = handle.x + 'px';
        element.style.top = handle.y + 'px';
        // [night-57a] D-319: the printed tail points away from the airport, along the route it continues.
        element.style.setProperty('--aw-handle-turn', handle.angle.toFixed(3) + 'rad');
        // [night-11q] R5c: quiet at rest; the bold end bar only on the route in hand (D-319).
        const active = handle.routeId === activeRouteId;
        if (element.classList.contains('airway-route-handle--active') !== active) setClass(element, 'airway-route-handle--active', active);
      }
      for (const [id, element] of elements) {
        if (!visible.has(id)) element.hidden = true;
      }
    },
    dispose() { layer.remove(); elements.clear(); },
  };
}
