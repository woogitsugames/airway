// Bootstrap backdrop: the shared world renderer with no game data, behind the menus.
import { AdaptiveFrameScheduler } from './quality';
import { createWorldRenderer, type WorldRenderer } from './world';

export function mountEmptyScene(host: HTMLElement): {
  canvas: HTMLCanvasElement;
  world: WorldRenderer | null;
  dispose: () => void;
} {
  // The isolated perf route mounts its own world; do not create a second WebGL context.
  if (new URLSearchParams(window.location.search).get('perf') === 'scene') {
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    return { canvas, world: null, dispose: () => canvas.remove() };
  }
  const world = createWorldRenderer(undefined, { autoResize: host, camera: { longitude: -12, latitude: 34 } });
  host.appendChild(world.canvas);
  // Midday over the Atlantic, the menu mockup's frozen time of day.
  world.setSun(-30, -18.5);
  const scheduler = new AdaptiveFrameScheduler(host, (_now, elapsedMs) => world.render(0, elapsedMs / 1000));
  return {
    canvas: world.canvas,
    world,
    dispose: () => {
      scheduler.dispose();
      world.dispose();
    },
  };
}
