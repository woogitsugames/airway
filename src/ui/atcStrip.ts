/** Airport-paper route hints and route actions (D-11), independent of game state. */
import { getLanguage, t } from '../i18n';
import type { RangeWarning, RouteHandle, RouteMenuRequest } from '../input/routeTool';
import './atcStrip.css';

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
      const locale = getLanguage() === 'pl' ? 'pl-PL' : 'en-GB';
      const distance = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(warning.distanceKm);
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

/** Mount this button into the luggage-tag dock from task 13 when it exists. */
export function mountRouteUndo(host: HTMLElement, onUndo: () => void): () => void {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'airway-route-undo';
  button.setAttribute('aria-label', t('route.undo'));
  button.title = t('route.undo');
  // Procedural icon; no emoji or third-party SVG asset.
  button.innerHTML = '<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
    '<path d="M26 22A11 11 0 1 1 14 5" fill="none" stroke="currentColor" stroke-width="3"/>' +
    '<path d="M4 2v12h12L4 2Z" fill="currentColor"/></svg>';
  button.addEventListener('click', onUndo);
  host.appendChild(button);
  return () => { button.removeEventListener('click', onUndo); button.remove(); };
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
  show(handles: readonly RouteHandle[]): void;
  dispose(): void;
} {
  const layer = document.createElement('div');
  layer.className = 'airway-route-handles';
  layer.setAttribute('aria-hidden', 'true');
  host.appendChild(layer);
  const elements = new Map<string, HTMLSpanElement>();
  return {
    show(handles) {
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
      }
      for (const [id, element] of elements) {
        if (!visible.has(id)) element.hidden = true;
      }
    },
    dispose() { layer.remove(); elements.clear(); },
  };
}
