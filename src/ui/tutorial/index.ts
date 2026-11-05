// [task-23] Airport-object overlay for the isolated three-city training flight.
import { t, type TranslationKey } from '../../i18n';
import {
  TUTORIAL_ACTION_STEPS,
  TUTORIAL_STEPS,
  TutorialController,
  type TutorialAction,
  type TutorialState,
  type TutorialStep,
} from '../../game/tutorial/controller';
import { regionGlyph } from '../glyphs';
import { airportLabel } from '../airportLabel';
import '../skin/current.css'; // [night-11aq] skin tokens read by overlay.css
import '../overlay.css'; // [night-11p] D-129: the vignette uses the game's own luggage tag
import './tutorial.css';

const SVG = `
<svg class="aw-world-art" viewBox="0 0 412 520" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
 <defs>
  <clipPath id="aw-planet-clip"><circle cx="206" cy="271" r="192"/></clipPath>
 </defs>
 <ellipse cx="210" cy="476" rx="142" ry="13" fill="#265c69" opacity=".18"/>
 <circle class="aw-planet" cx="206" cy="271" r="196" fill="#1b5e7f"/>
 <g clip-path="url(#aw-planet-clip)">
  <path d="M-25 85L140 27 279 44 469 107 463 491 300 532 35 517Z" fill="#3c9cb0"/>
  <path d="M28 119L90 71 157 84 172 126 230 113 292 159 261 203 311 241 287 297 252 330 245 396 192 419 145 392 90 430 34 380 -18 302Z" fill="#86b35a"/>
  <path d="M28 119L90 71 157 84 172 126 145 165 93 180 48 159Z" fill="#b9c16a"/>
  <path d="M145 165L230 113 292 159 261 203 214 227 168 206Z" fill="#6c9e55"/>
  <path d="M93 180L145 165 168 206 143 259 90 267 34 238Z" fill="#759f58"/>
  <path d="M168 206L214 227 261 203 311 241 287 297 243 285 214 318 143 259Z" fill="#87b15c"/>
  <path d="M34 238L90 267 143 259 158 320 110 349 34 333Z" fill="#b4b56a"/>
  <path d="M158 320L214 318 243 285 287 297 252 330 245 396 192 419 145 392Z" fill="#568d4e"/>
  <path d="M12 369L90 430 145 392 192 419 141 466 66 485Z" fill="#dcb36e"/>
  <path d="M295 110L328 84 386 124 398 170 343 204 292 159Z" fill="#91b75f"/>
  <path d="M343 204L398 170 449 220 399 275 311 241Z" fill="#b8b36b"/>
  <path d="M312 281L399 275 440 363 387 432 320 398Z" fill="#d2b273"/>
  <path d="M82 96l14 -23 13 25 15 -8 19 32 -33 -8 -26 14Z" fill="#f3f1ea" opacity=".85"/>
  <path d="M149 348l15 -32 13 29 13 -16 15 39 -28 -8 -19 12Z" fill="#e4e4d2"/>
  <path d="M179 363l12 -22 11 26 13 -7 10 32 -24 -12 -12 9Z" fill="#f3f1ea"/>
  <path d="M40 275l28 -12 23 17 -25 21 -28 -7Z" fill="#3e7c47"/>
  <path d="M84 390l35 -27 28 29 -40 28Z" fill="#4f8a45"/>
  <path d="M302 154l25 -14 23 20 -26 18Z" fill="#4f8a45"/>
  <path d="M-5 85c120 -22 268 15 384 20" fill="none" stroke="#f5f2db" stroke-width="24" opacity=".15"/>
  <path d="M0 390c119 89 286 92 419 13" fill="none" stroke="#1f5f86" stroke-width="26" opacity=".20"/>
  <g fill="#f5f0de" opacity=".85"><ellipse cx="92" cy="143" rx="36" ry="9"/><ellipse cx="102" cy="136" rx="24" ry="12"/><ellipse cx="314" cy="320" rx="38" ry="9"/><ellipse cx="304" cy="313" rx="24" ry="11"/></g>
  <path class="aw-route aw-route-feeder" d="M257 229 Q310 289 232 359"/>
  <path class="aw-route aw-route-primary" d="M133 174 Q205 143 257 229"/>
  <path class="aw-guide aw-guide-primary" d="M133 174 Q205 143 257 229"/>
  <path class="aw-live-path" d=""/>
  <g class="aw-aircraft-symbol" transform="translate(186 168) rotate(52)"><path d="M0 -16l4 12 14 8v6L3 6l-1 12 4 4v3L0 23l-6 2v-3l4 -4 -1 -12 -15 4V4l14 -8Z" fill="#f8f1de" stroke="#13302e" stroke-width="2"/></g>
 </g>
 <circle cx="206" cy="271" r="192" fill="none" stroke="#d5ecdf" stroke-opacity=".7" stroke-width="4"/>
</svg>`;

const CITY_POSITIONS = { LON: [133, 174], PAR: [257, 229], ROM: [232, 359] } as const;
type City = keyof typeof CITY_POSITIONS;
type DragKind = 'route' | 'aircraft';

/** [night-11p] D-129: the game's airport object (src/render/airports.ts colours, read only): a pad with a rim, a
 *  dark runway with its centre line and a small terminal; a hub has a teal rim and roof and its ring of waiting
 *  places (white seats, the taken ones orange) like the hub load ring on the globe. */
function airportSvg(hub: boolean, seats = 24, taken = 0): string {
  const ring = hub ? Array.from({ length: seats }, (_, i) => {
    const a0 = (i / seats) * Math.PI * 2 - Math.PI / 2 + 0.04;
    const a1 = ((i + 1) / seats) * Math.PI * 2 - Math.PI / 2 - 0.04;
    const r = 23.5;
    const p = (a: number) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
    return `<path d="M${p(a0)}A${r} ${r} 0 0 1 ${p(a1)}" stroke="${i < taken ? '#FF9A3D' : '#F2EFE6'}"/>`;
  }).join('') : '';
  return `<svg class="aw-airport" viewBox="-27 -27 54 54" aria-hidden="true">
   <ellipse cx="1" cy="4" rx="21" ry="19" fill="#13302e" opacity=".28"/>
   ${hub ? `<g class="aw-airport-ring" fill="none" stroke-width="4">${ring}</g>` : ''}
   <circle r="${hub ? 19 : 17}" fill="${hub ? '#2FA39A' : '#E3743E'}"/>
   <circle r="${hub ? 17 : 15}" fill="#EFE9DA"/>
   <g transform="rotate(-35)"><rect x="${hub ? -15 : -13}" y="-3.4" width="${hub ? 30 : 26}" height="6.8" fill="#3B4046"/>
   <path d="M${hub ? -12 : -10} 0H${hub ? 12 : 10}" stroke="#F5F1E6" stroke-width="1" stroke-dasharray="3 2"/></g>
   <rect x="2" y="4.5" width="10" height="6" fill="#F2EFE6"/><rect x="2" y="3" width="10" height="2.6" fill="${hub ? '#2A8F8A' : '#C96F4A'}"/>
  </svg>`;
}
/** Passengers in the vignette fly London → Paris (hub) → Rome: Southern Europe, the crescent glyph. */
const PASSENGER_REGION = 'EUS' as const;
/** Where the passenger glyphs wait at each step (the game's luggage tag; a plate alone when nobody waits). */
const WAITING: Record<TutorialStep, Partial<Record<City, number>>> = {
  route: { LON: 2 }, aircraft: { LON: 2 }, transfer: { PAR: 2 }, complete: {},
};

function translate(key: TranslationKey): string { return t(key); }

function buttonLabel(element: HTMLElement, key: TranslationKey): void {
  element.textContent = translate(key);
}

export function mountTutorialUi(host: HTMLElement, controller: TutorialController): { dispose(): void } {
  const root = document.createElement('section');
  root.className = 'aw-tutorial';
  root.dataset.testid = 'tutorial';
  root.innerHTML = `
    <div class="aw-tutorial-stage">
      <header class="aw-tutorial-ticket">
        <div class="aw-tutorial-ticket-id"><span class="aw-tutorial-kicker" data-copy="tutorial.title"></span><strong data-testid="tutorial-progress"></strong></div>
        <div class="aw-ticket-perf" aria-hidden="true"></div>
        <button type="button" class="aw-ticket-skip" data-testid="tutorial-skip" data-copy="tutorial.action.skip"></button>
      </header>
      <main class="aw-tutorial-center">
        <div class="aw-tutorial-world" data-testid="tutorial-world">
          ${SVG}
          <button type="button" class="aw-city aw-city-lon" data-city="LON" data-testid="city-lon"><span class="airport-bubble aw-city-tag"><span class="airport-bubble__plate"></span><span class="aw-city-glyphs"></span></span>${airportSvg(false)}</button>
          <button type="button" class="aw-city aw-city-par aw-city--hub" data-city="PAR" data-testid="city-par"><span class="airport-bubble aw-city-tag"><span class="airport-bubble__plate"></span><span class="aw-city-glyphs"></span></span>${airportSvg(true, 24, 8)}</button>
          <button type="button" class="aw-city aw-city-rom" data-city="ROM" data-testid="city-rom"><span class="airport-bubble aw-city-tag"><span class="airport-bubble__plate"></span><span class="aw-city-glyphs"></span></span>${airportSvg(false)}</button>
          <button type="button" class="aw-route-drop" data-testid="tutorial-route-drop"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 5V35M5 20H35" stroke="currentColor" stroke-width="3"/><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
        </div>
        <div class="aw-tutorial-strip" role="status" aria-live="polite" aria-atomic="true">
          <span class="aw-strip-index" data-testid="tutorial-step-label"></span><span class="aw-strip-copy" data-testid="tutorial-instruction"></span>
        </div>
      </main>
      <footer class="aw-tutorial-controls">
        <p class="aw-tutorial-hint" data-testid="tutorial-hint"></p>
        <div class="aw-tutorial-dock">
          <button type="button" class="aw-plane-tag" data-testid="tutorial-plane-tag"><svg viewBox="0 0 48 36" aria-hidden="true"><path d="M24 3L29 17 45 25V31L27 26 26 34 22 34 21 26 3 31V25L19 17Z" fill="currentColor"/></svg><span data-copy="tutorial.tag.aircraft"></span></button>
          <button type="button" class="aw-action-tag aw-complete-action" data-testid="tutorial-continue" data-copy="tutorial.action.continue"></button>
        </div>
      </footer>
    </div>
    <button type="button" class="aw-settings-sign" data-testid="tutorial-settings" data-copy="menu.settings"></button>
    <div class="aw-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="aw-settings-title" hidden>
      <h2 id="aw-settings-title" data-copy="menu.settings"></h2>
      <button type="button" data-testid="tutorial-replay" data-copy="tutorial.replay"></button>
      <button type="button" data-testid="tutorial-settings-close" data-copy="tutorial.action.close"></button>
    </div>`;
  host.appendChild(root);
  const query = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error('Missing tutorial node ' + selector);
    return element;
  };
  root.querySelectorAll<HTMLElement>('[data-copy]').forEach((element) => {
    buttonLabel(element, element.dataset.copy as TranslationKey);
  });
  const routeDrop = query<HTMLButtonElement>('[data-testid="tutorial-route-drop"]');
  routeDrop.setAttribute('aria-label', translate('tutorial.route.drop'));
  const worldArt = query<SVGSVGElement>('.aw-world-art');
  const livePath = query<SVGPathElement>('.aw-live-path');
  const settings = query<HTMLElement>('.aw-settings-dialog');
  const cityButtons = Object.fromEntries(['LON', 'PAR', 'ROM'].map((city) =>
    [city, query<HTMLButtonElement>(`[data-city="${city}"]`)])) as Record<City, HTMLButtonElement>;
  // [night-11p] Plates follow the D-68 code/name setting like the game; the button says the city (and "hub").
  const cityNames: Record<City, TranslationKey> = { LON: 'tutorial.city.london', PAR: 'tutorial.city.paris', ROM: 'tutorial.city.rome' };
  for (const city of Object.keys(cityButtons) as City[]) {
    const button = cityButtons[city];
    button.querySelector('.airport-bubble__plate')!.textContent = airportLabel(city);
    const name = translate(cityNames[city]);
    button.setAttribute('aria-label', city === 'PAR' ? t('tutorial.city.hubAria', { city: name }) : name);
  }
  const shownWaiting: Partial<Record<City, number>> = {};
  function renderWaiting(step: TutorialStep): void {
    for (const city of Object.keys(cityButtons) as City[]) {
      const count = WAITING[step][city] ?? 0;
      if (shownWaiting[city] === count) continue;
      shownWaiting[city] = count;
      const tag = cityButtons[city].querySelector<HTMLElement>('.aw-city-tag')!;
      const glyphs = tag.querySelector<HTMLElement>('.aw-city-glyphs')!;
      glyphs.replaceChildren(...Array.from({ length: count }, () => regionGlyph(PASSENGER_REGION, 16)));
      tag.classList.toggle('airport-bubble--plate-only', count === 0);
    }
  }
  let dragging: { kind: DragKind; pointerId: number; source: City | 'tag' } | null = null;
  let keyboardSource: City | 'tag' | null = null;
  let closed = false;

  function render(state: TutorialState): void {
    root.classList.toggle('is-active', state.visible);
    root.classList.toggle('has-primary', state.step !== 'route');
    root.classList.toggle('has-plane', state.step === 'transfer' || state.step === 'complete');
    root.dataset.step = state.step;
    const index = TUTORIAL_STEPS.indexOf(state.step);
    query<HTMLElement>('[data-testid="tutorial-progress"]').textContent = t('tutorial.progress', {
      current: Math.min(TUTORIAL_ACTION_STEPS, index + 1), total: TUTORIAL_ACTION_STEPS,
    });
    renderWaiting(state.step);
    const titles: Record<TutorialStep, TranslationKey> = {
      route: 'tutorial.step.route', aircraft: 'tutorial.step.aircraft', transfer: 'tutorial.step.transfer',
      complete: 'tutorial.step.complete',
    };
    const instructions: Record<TutorialStep, TranslationKey> = {
      route: 'tutorial.instruction.route', aircraft: 'tutorial.instruction.aircraft', transfer: 'tutorial.instruction.transfer',
      complete: 'tutorial.instruction.complete',
    };
    const hints: Record<TutorialStep, TranslationKey> = {
      route: 'tutorial.hint.route', aircraft: 'tutorial.hint.aircraft', transfer: 'tutorial.hint.transfer',
      complete: 'tutorial.hint.complete',
    };
    query<HTMLElement>('[data-testid="tutorial-step-label"]').textContent = translate(titles[state.step]);
    query<HTMLElement>('[data-testid="tutorial-instruction"]').textContent = translate(instructions[state.step]);
    query<HTMLElement>('[data-testid="tutorial-hint"]').textContent = translate(hints[state.step]);
    query<HTMLButtonElement>('[data-testid="tutorial-skip"]').disabled = state.busy;
    routeDrop.disabled = state.busy;
    for (const city of Object.keys(cityButtons) as City[]) cityButtons[city].disabled = state.busy;
    if (state.step !== 'route' && state.step !== 'aircraft') keyboardSource = null;
  }

  function viewPoint(clientX: number, clientY: number): [number, number] {
    const bounds = worldArt.getBoundingClientRect();
    return [(clientX - bounds.left) * 412 / bounds.width, (clientY - bounds.top) * 520 / bounds.height];
  }
  function drawPath(clientX: number, clientY: number): void {
    if (!dragging) return;
    const start = dragging.source === 'tag' ? [205, 183] : CITY_POSITIONS[dragging.source];
    const end = viewPoint(clientX, clientY);
    livePath.setAttribute('d', `M${start[0]} ${start[1]} Q${(start[0]+end[0])/2} ${Math.min(start[1],end[1])-26} ${end[0]} ${end[1]}`);
    root.classList.add('is-dragging');
  }
  function hit(target: HTMLElement, x: number, y: number): boolean {
    // [night-11p] Aim at the airport disc (the button also holds its luggage tag above it).
    const rect = (target.querySelector('.aw-airport') ?? target).getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.hypot(cx - x, cy - y) <= Math.max(34, rect.width / 2 + 10);
  }
  function attempt(action: TutorialAction): void { void controller.submit(action); }
  function handleCity(city: City): void {
    const step = controller.getState().step;
    if (step === 'transfer' && city === 'PAR') {
      attempt({ type: 'inspect-transfer', hub: 'PAR' });
      return;
    }
    if (step === 'route' && city === 'LON') {
      keyboardSource = 'LON';
      return;
    }
    if (keyboardSource === 'LON' && step === 'route' && city === 'PAR') {
      keyboardSource = null;
      attempt({ type: 'route', from: 'LON', to: 'PAR' });
    }
  }
  for (const city of Object.keys(cityButtons) as City[]) {
    const button = cityButtons[city];
    button.addEventListener('click', () => handleCity(city));
    button.addEventListener('pointerdown', (event: PointerEvent) => {
      const step = controller.getState().step;
      if (city !== 'LON' || !controller.getState().visible) return;
      if (step === 'route') dragging = { kind: 'route', pointerId: event.pointerId, source: 'LON' };
    });
  }
  const planeTag = query<HTMLButtonElement>('[data-testid="tutorial-plane-tag"]');
  planeTag.addEventListener('pointerdown', (event) => {
    if (controller.getState().step === 'aircraft') dragging = { kind: 'aircraft', pointerId: event.pointerId, source: 'tag' };
  });
  planeTag.addEventListener('click', () => { if (controller.getState().step === 'aircraft') keyboardSource = 'tag'; });
  routeDrop.addEventListener('click', () => {
    if (keyboardSource === 'tag' && controller.getState().step === 'aircraft') {
      keyboardSource = null;
      attempt({ type: 'assign-aircraft', route: 'LON-PAR' });
    }
  });
  const pointerMove = (event: PointerEvent): void => {
    if (dragging?.pointerId === event.pointerId) drawPath(event.clientX, event.clientY);
  };
  const pointerUp = (event: PointerEvent): void => {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const drag = dragging;
    dragging = null;
    livePath.setAttribute('d', '');
    root.classList.remove('is-dragging');
    if (drag.kind === 'route' && hit(cityButtons.PAR, event.clientX, event.clientY))
      attempt({ type: 'route', from: 'LON', to: 'PAR' });
    else if (drag.kind === 'aircraft' && hit(routeDrop, event.clientX, event.clientY))
      attempt({ type: 'assign-aircraft', route: 'LON-PAR' });
  };
  const pointerCancel = (): void => {
    dragging = null;
    livePath.setAttribute('d', '');
    root.classList.remove('is-dragging');
  };
  document.addEventListener('pointermove', pointerMove);
  document.addEventListener('pointerup', pointerUp);
  document.addEventListener('pointercancel', pointerCancel);

  query<HTMLButtonElement>('[data-testid="tutorial-skip"]').addEventListener('click', () => controller.skip());
  query<HTMLButtonElement>('[data-testid="tutorial-continue"]').addEventListener('click', () => controller.close());
  query<HTMLButtonElement>('[data-testid="tutorial-settings"]').addEventListener('click', () => { settings.hidden = false; });
  query<HTMLButtonElement>('[data-testid="tutorial-settings-close"]').addEventListener('click', () => { settings.hidden = true; });
  query<HTMLButtonElement>('[data-testid="tutorial-replay"]').addEventListener('click', () => {
    settings.hidden = true;
    keyboardSource = null;
    controller.replay();
  });

  // [night-11l] Size the world from the space its row really has (safe areas, a wrapped ATC card). The CSS estimate
  // (100dvh minus a fixed allowance) ignored the status and gesture bars, so on an unfolded Fold the card overflowed
  // into the hint line below it.
  const center = query<HTMLElement>('.aw-tutorial-center');
  const world = query<HTMLElement>('.aw-tutorial-world');
  const strip = query<HTMLElement>('.aw-tutorial-strip');
  const fitWorld = (): void => {
    if (!center.clientHeight) return;
    const gap = parseFloat(getComputedStyle(center).rowGap) || 0;
    const height = center.clientHeight - strip.offsetHeight - gap;
    const width = Math.max(150, Math.min(center.clientWidth, 430, height * 412 / 520));
    world.style.width = `${Math.floor(width)}px`;
  };
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(fitWorld) : null;
  resize?.observe(center);
  resize?.observe(strip);
  fitWorld();

  const unsubscribe = controller.subscribe((state) => { render(state); fitWorld(); });
  return { dispose(): void {
    if (closed) return;
    closed = true;
    resize?.disconnect();
    document.removeEventListener('pointermove', pointerMove);
    document.removeEventListener('pointerup', pointerUp);
    document.removeEventListener('pointercancel', pointerCancel);
    unsubscribe();
    root.remove();
  } };
}
