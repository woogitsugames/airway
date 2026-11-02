import '../hud.css';
import { createBoardingPass } from './boarding-pass';
import { createTagDock } from './tag-dock';
import type { HudActions, HudController, HudState } from './types';
import { watchHudLayout } from '../layout';

export type { HudActions, HudController, HudState, PlaneType, GameSpeed } from './types';

/** Attach the HUD to a positioned game surface. No simulation or Three.js dependencies. */
export function mountHud(host: HTMLElement, actions: HudActions = {}): HudController {
  const element = document.createElement('div');
  element.className = 'airway-hud';
  element.setAttribute('data-testid', 'airway-hud');
  host.appendChild(element);

  const pass = createBoardingPass(element, actions.onTogglePause);
  const dock = createTagDock(element, actions);
  const stopWatching = watchHudLayout(host, (layout) => { element.dataset.layout = layout; });
  let destroyed = false;

  return {
    element,
    render(state: HudState): void {
      if (destroyed) return;
      pass.render(state);
      dock.render(state);
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      stopWatching();
      dock.destroy();
      element.remove();
    },
  };
}
