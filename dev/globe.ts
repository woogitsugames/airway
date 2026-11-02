// [task-03] Globe-only laboratory on the shared world renderer (no game layers populated).
import { createWorldRenderer, type QualityPreference, type WorldRenderer } from '../src/render';

declare global {
  interface Window {
    __globeReady?: boolean;
    __globeMetrics?: { fps: number; drawCalls: number; triangles: number; frameMs: number };
  }
}

const host = document.getElementById('root');
const qualitySelect = document.getElementById('quality') as HTMLSelectElement | null;
const stats = document.getElementById('stats');
const errorDisplay = document.getElementById('error');
if (!host || !qualitySelect || !stats || !errorDisplay) throw new Error('Missing globe lab elements');
const root = host, picker = qualitySelect, info = stats, errors = errorDisplay;
root.style.width = '100%';
root.style.height = '100%';

let world: WorldRenderer | null = null;
let frameCount = 0, lastStats = performance.now(), frameMs = 0, lastFrame = performance.now();
let pointerId: number | null = null, lastX = 0, lastY = 0, lastMove = 0;

const load = (quality: QualityPreference): void => {
  window.__globeReady = false;
  errors.textContent = '';
  info.textContent = 'Loading terrain…';
  // Antialiasing is fixed per WebGL context, so a preset switch recreates the world.
  world?.dispose();
  const next = createWorldRenderer(undefined, {
    quality, autoResize: root, camera: { longitude: 7, latitude: 34, zoom: 1.6 },
  });
  root.appendChild(next.canvas);
  next.setSun(-62, -15); // Same frozen time-of-day as the approved mockup.
  world = next;
  next.ready.then(() => { if (world === next) window.__globeReady = true; }, (error: unknown) => {
    errors.textContent = error instanceof Error ? error.message : String(error);
    info.textContent = 'Globe unavailable';
  });
};
picker.addEventListener('change', () => { load(picker.value as QualityPreference); });

root.addEventListener('pointerdown', (event) => {
  if (pointerId !== null || !world) return;
  pointerId = event.pointerId;
  lastX = event.clientX; lastY = event.clientY; lastMove = event.timeStamp;
  root.setPointerCapture(pointerId);
  world.orbit.beginInteraction();
});
root.addEventListener('pointermove', (event) => {
  if (event.pointerId !== pointerId || !world) return;
  world.orbit.rotatePixels(event.clientX - lastX, event.clientY - lastY, event.timeStamp - lastMove);
  lastX = event.clientX; lastY = event.clientY; lastMove = event.timeStamp;
});
const release = (event: PointerEvent): void => {
  if (event.pointerId !== pointerId) return;
  pointerId = null;
  world?.orbit.endInteraction(true);
};
root.addEventListener('pointerup', release);
root.addEventListener('pointercancel', release);
root.addEventListener('wheel', (event) => {
  event.preventDefault();
  world?.orbit.zoomBy(event.deltaY > 0 ? 1 / 1.1 : 1.1);
}, { passive: false });

const loop = (now: number): void => {
  if (world) {
    const begin = performance.now();
    world.render(0, (now - lastFrame) / 1000);
    frameMs += performance.now() - begin;
    frameCount++;
  }
  lastFrame = now;
  if (world && now - lastStats >= 500 && frameCount > 0) {
    const s = world.stats();
    const data = {
      fps: Math.round(frameCount * 1000 / (now - lastStats)),
      drawCalls: s.drawCalls, triangles: s.triangles,
      frameMs: Math.round(frameMs / frameCount * 100) / 100,
    };
    window.__globeMetrics = data;
    info.textContent = 'Preset: ' + world.quality.preset +
      '\nFPS: ' + data.fps + '\nDraw calls: ' + data.drawCalls +
      '\nTriangles: ' + data.triangles.toLocaleString() +
      '\nRender CPU: ' + data.frameMs.toFixed(2) + ' ms';
    frameCount = 0;
    frameMs = 0;
    lastStats = now;
  }
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
load((new URLSearchParams(location.search).get('quality') as QualityPreference | null) || 'medium');
