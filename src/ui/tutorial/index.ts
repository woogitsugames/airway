// [task-23] Airport-object overlay for the isolated three-city training flight.
import { t, type TranslationKey } from '../../i18n';
import {
  TutorialController,
  type TutorialAction,
  type TutorialState,
  type TutorialStep,
} from '../../game/tutorial/controller';
import './tutorial.css';

const SVG = `
<svg class="aw-world-art" viewBox="0 0 412 520" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
 <defs>
  <clipPath id="aw-planet-clip"><circle cx="206" cy="271" r="224"/></clipPath>
  <pattern id="aw-runway-stripes" width="12" height="8" patternUnits="userSpaceOnUse"><path d="M6 0v4" stroke="#f8f3e8" stroke-width="2"/></pattern>
 </defs>
 <ellipse cx="210" cy="488" rx="166" ry="16" fill="#265c69" opacity=".18"/>
 <circle cx="206" cy="271" r="228" fill="#1b5e7f"/>
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
  <path class="aw-night-wash" d="M-20 -20h460v590H-20z" fill="#102c39" opacity=".66"/>
  <path class="aw-route aw-route-feeder" d="M257 229 Q310 289 232 359"/>
  <path class="aw-route aw-route-primary" d="M133 174 Q205 143 257 229"/>
  <path class="aw-route aw-route-relief" d="M133 174 Q89 282 232 359"/>
  <path class="aw-guide aw-guide-primary" d="M133 174 Q205 143 257 229"/>
  <path class="aw-guide aw-guide-relief" d="M133 174 Q89 282 232 359"/>
  <path class="aw-live-path" d=""/>
  <g class="aw-aircraft-symbol" transform="translate(205 183) rotate(44)"><path d="M0 -16l4 12 14 8v6L3 6l-1 12 4 4v3L0 23l-6 2v-3l4 -4 -1 -12 -15 4V4l14 -8Z" fill="#f8f1de" stroke="#13302e" stroke-width="2"/></g>
  <g class="aw-wave-awakening" fill="none" stroke="#ffbd77" stroke-width="3"><circle cx="257" cy="229" r="32"/><circle cx="257" cy="229" r="45"/><circle cx="257" cy="229" r="57"/></g>
  <g class="aw-congestion-ring" fill="none" stroke="#c8352a" stroke-width="8"><circle cx="257" cy="229" r="30" stroke-dasharray="12 5"/></g>
  <g class="aw-terminal" transform="translate(133 174)"><ellipse cy="12" rx="25" ry="10" fill="#265f64"/><rect x="-17" y="-2" width="34" height="9" fill="#f7f3ea"/><path d="M-18 -2L0 -13 18 -2Z" fill="#1e6f6a"/><path d="M-2 9h4v23h-4z" fill="url(#aw-runway-stripes)"/></g>
  <g class="aw-terminal" transform="translate(257 229)"><ellipse cy="12" rx="29" ry="12" fill="#1b585c"/><rect x="-20" y="-2" width="40" height="11" fill="#f7f3ea"/><path d="M-21 -2L0 -16 21 -2Z" fill="#1e6f6a"/><rect x="17" y="-20" width="7" height="21" fill="#f7f3ea"/><path d="M15 -20h11l-5 -7Z" fill="#ff7a3d"/></g>
  <g class="aw-terminal" transform="translate(232 359)"><ellipse cy="12" rx="25" ry="10" fill="#265f64"/><rect x="-17" y="-2" width="34" height="9" fill="#f7f3ea"/><path d="M-18 -2L0 -13 18 -2Z" fill="#dcb36e"/></g>
 </g>
 <circle cx="206" cy="271" r="224" fill="none" stroke="#d5ecdf" stroke-opacity=".7" stroke-width="4"/>
</svg>`;

const CITY_POSITIONS = { LON: [133, 174], PAR: [257, 229], ROM: [232, 359] } as const;
type City = keyof typeof CITY_POSITIONS;
type DragKind = 'route' | 'aircraft' | 'relieve';

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
          <button type="button" class="aw-city aw-city-lon" data-city="LON" data-testid="city-lon"><span class="aw-city-pin"></span><span class="aw-city-name" data-copy="tutorial.city.london"></span></button>
          <button type="button" class="aw-city aw-city-par" data-city="PAR" data-testid="city-par"><span class="aw-city-pin aw-city-hub"></span><span class="aw-city-name" data-copy="tutorial.city.paris"></span></button>
          <button type="button" class="aw-city aw-city-rom" data-city="ROM" data-testid="city-rom"><span class="aw-city-pin"></span><span class="aw-city-name" data-copy="tutorial.city.rome"></span></button>
          <button type="button" class="aw-route-drop" data-testid="tutorial-route-drop"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 5V35M5 20H35" stroke="currentColor" stroke-width="3"/><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
          <div class="aw-passenger-card" aria-hidden="true"><span class="aw-passenger-shape">❯</span><span class="aw-passenger-arrow">→</span><span class="aw-passenger-shape">❯</span></div>
          <div class="aw-jam-label" data-copy="tutorial.jam"></div>
        </div>
        <div class="aw-tutorial-strip" role="status" aria-live="polite" aria-atomic="true">
          <span class="aw-strip-index" data-testid="tutorial-step-label"></span><span class="aw-strip-copy" data-testid="tutorial-instruction"></span>
        </div>
      </main>
      <footer class="aw-tutorial-controls">
        <p class="aw-tutorial-hint" data-testid="tutorial-hint"></p>
        <div class="aw-tutorial-dock">
          <button type="button" class="aw-plane-tag" data-testid="tutorial-plane-tag"><svg viewBox="0 0 48 36" aria-hidden="true"><path d="M24 3L29 17 45 25V31L27 26 26 34 22 34 21 26 3 31V25L19 17Z" fill="currentColor"/></svg><span data-copy="tutorial.tag.aircraft"></span></button>
          <button type="button" class="aw-action-tag aw-dawn-action" data-testid="tutorial-dawn" data-copy="tutorial.action.dawn"></button>
          <div class="aw-upgrades" data-testid="tutorial-upgrades">
            <button type="button" class="aw-upgrade" data-choice="hub" data-testid="tutorial-upgrade-hub"><span data-copy="tutorial.upgrade.hub"></span></button>
            <button type="button" class="aw-upgrade" data-choice="aircraft" data-testid="tutorial-upgrade-aircraft"><span data-copy="tutorial.upgrade.aircraft"></span></button>
            <button type="button" class="aw-upgrade" data-choice="slots" data-testid="tutorial-upgrade-slots"><span data-copy="tutorial.upgrade.slots"></span></button>
          </div>
          <button type="button" class="aw-action-tag aw-complete-action" data-testid="tutorial-continue" data-copy="tutorial.action.continue"></button>
        </div>
      </footer>
    </div>
    <button type="button" class="aw-settings-sign" data-testid="tutorial-settings" data-copy="tutorial.settings"></button>
    <div class="aw-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="aw-settings-title" hidden>
      <h2 id="aw-settings-title" data-copy="tutorial.settings"></h2>
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
  let dragging: { kind: DragKind; pointerId: number; source: City | 'tag' } | null = null;
  let keyboardSource: City | 'tag' | null = null;
  let closed = false;

  function render(state: TutorialState): void {
    root.classList.toggle('is-active', state.visible);
    root.classList.toggle('has-primary', ['aircraft','transfer','dawn','upgrade','congestion','complete'].includes(state.step));
    root.classList.toggle('has-plane', ['transfer','dawn','upgrade','congestion','complete'].includes(state.step));
    root.classList.toggle('has-relief', state.step === 'complete');
    root.classList.toggle('is-night', state.step === 'dawn');
    root.classList.toggle('is-jammed', state.step === 'congestion');
    root.dataset.step = state.step;
    query<HTMLElement>('[data-testid="tutorial-progress"]').textContent = t('tutorial.progress', {
      current: String(Math.min(6, ['route','aircraft','transfer','dawn','upgrade','congestion'].indexOf(state.step) + 1) || 6), total: 6,
    });
    const titles: Record<TutorialStep, TranslationKey> = {
      route: 'tutorial.step.route', aircraft: 'tutorial.step.aircraft', transfer: 'tutorial.step.transfer',
      dawn: 'tutorial.step.dawn', upgrade: 'tutorial.step.upgrade', congestion: 'tutorial.step.congestion',
      complete: 'tutorial.step.complete',
    };
    const instructions: Record<TutorialStep, TranslationKey> = {
      route: 'tutorial.instruction.route', aircraft: 'tutorial.instruction.aircraft', transfer: 'tutorial.instruction.transfer',
      dawn: 'tutorial.instruction.dawn', upgrade: 'tutorial.instruction.upgrade',
      congestion: 'tutorial.instruction.congestion', complete: 'tutorial.instruction.complete',
    };
    const hints: Record<TutorialStep, TranslationKey> = {
      route: 'tutorial.hint.route', aircraft: 'tutorial.hint.aircraft', transfer: 'tutorial.hint.transfer',
      dawn: 'tutorial.hint.dawn', upgrade: 'tutorial.hint.upgrade', congestion: 'tutorial.hint.congestion',
      complete: 'tutorial.hint.complete',
    };
    query<HTMLElement>('[data-testid="tutorial-step-label"]').textContent = translate(titles[state.step]);
    query<HTMLElement>('[data-testid="tutorial-instruction"]').textContent = translate(instructions[state.step]);
    query<HTMLElement>('[data-testid="tutorial-hint"]').textContent = translate(hints[state.step]);
    query<HTMLButtonElement>('[data-testid="tutorial-skip"]').disabled = state.busy;
    routeDrop.disabled = state.busy;
    for (const city of Object.keys(cityButtons) as City[]) cityButtons[city].disabled = state.busy;
    if (state.step !== 'route' && state.step !== 'congestion') keyboardSource = null;
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
    const rect = target.getBoundingClientRect();
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
    if ((step === 'route' || step === 'congestion') && city === 'LON') {
      keyboardSource = 'LON';
      return;
    }
    if (keyboardSource === 'LON' && step === 'route' && city === 'PAR') {
      keyboardSource = null;
      attempt({ type: 'route', from: 'LON', to: 'PAR' });
    } else if (keyboardSource === 'LON' && step === 'congestion' && city === 'ROM') {
      keyboardSource = null;
      attempt({ type: 'relieve', from: 'LON', to: 'ROM' });
    }
  }
  for (const city of Object.keys(cityButtons) as City[]) {
    const button = cityButtons[city];
    button.addEventListener('click', () => handleCity(city));
    button.addEventListener('pointerdown', (event: PointerEvent) => {
      const step = controller.getState().step;
      if (city !== 'LON' || !controller.getState().visible) return;
      if (step === 'route' || step === 'congestion') {
        dragging = { kind: step === 'route' ? 'route' : 'relieve', pointerId: event.pointerId, source: 'LON' };
      }
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
    else if (drag.kind === 'relieve' && hit(cityButtons.ROM, event.clientX, event.clientY))
      attempt({ type: 'relieve', from: 'LON', to: 'ROM' });
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
  query<HTMLButtonElement>('[data-testid="tutorial-dawn"]').addEventListener('click', () => attempt({ type: 'watch-dawn' }));
  root.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((button) => {
    button.addEventListener('click', () => attempt({ type: 'upgrade', choice: button.dataset.choice as 'hub' | 'aircraft' | 'slots' }));
  });
  query<HTMLButtonElement>('[data-testid="tutorial-continue"]').addEventListener('click', () => controller.close());
  query<HTMLButtonElement>('[data-testid="tutorial-settings"]').addEventListener('click', () => { settings.hidden = false; });
  query<HTMLButtonElement>('[data-testid="tutorial-settings-close"]').addEventListener('click', () => { settings.hidden = true; });
  query<HTMLButtonElement>('[data-testid="tutorial-replay"]').addEventListener('click', () => {
    settings.hidden = true;
    keyboardSource = null;
    controller.replay();
  });

  const unsubscribe = controller.subscribe(render);
  return { dispose(): void {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointermove', pointerMove);
    document.removeEventListener('pointerup', pointerUp);
    document.removeEventListener('pointercancel', pointerCancel);
    unsubscribe();
    root.remove();
  } };
}
