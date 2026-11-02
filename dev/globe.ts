// [task-03] Standalone WebGL laboratory, deliberately not coupled to the game bootstrap.
import { Color, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { createGlobe } from '../src/render/globe';
import type { GlobeInstance, QualitySetting } from '../src/render/globe';

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
const scene = new Scene();
scene.background = new Color('#8cc3d8');
const renderer = new WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance' });
root.appendChild(renderer.domElement);
const canvas = renderer.domElement;
const camera = new PerspectiveCamera(34, 1, .1, 100);
let lon = 7, lat = 34, zoom = 2.75, pointerId: number | null = null, lastX = 0, lastY = 0;
let globe: GlobeInstance | null = null, epoch = 0;
let frameCount = 0, lastStats = performance.now(), frameMs = 0;
const position = new Vector3();

const resize = (): void => {
  const w = Math.max(1, root.clientWidth || window.innerWidth);
  const h = Math.max(1, root.clientHeight || window.innerHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
root.style.width = '100%';
root.style.height = '100%';
const observer = new ResizeObserver(resize);
observer.observe(root);
resize();

const landUrl = new URL('../data/land-50m.json', window.location.href).href;
const load = async (quality: QualitySetting): Promise<void> => {
  const mine = ++epoch;
  window.__globeReady = false;
  errors.textContent = '';
  info.textContent = 'Loading terrain…';
  globe?.dispose();
  globe = null;
  try {
    const instance = await createGlobe(scene, {
      quality, canvas, renderer, landUrl, seed: 0xA1A1,
    });
    if (mine !== epoch) { instance.dispose(); return; }
    instance.setSun(-62, -15); // Same frozen time-of-day as the approved mockup.
    globe = instance;
    resize();
    window.__globeReady = true;
  } catch (error) {
    errors.textContent = error instanceof Error ? error.message : String(error);
    info.textContent = 'Globe unavailable';
  }
};
picker.addEventListener('change', () => { void load(picker.value as QualitySetting); });

canvas.addEventListener('pointerdown', (event) => {
  if (pointerId !== null) return;
  pointerId = event.pointerId;
  lastX = event.clientX; lastY = event.clientY;
  canvas.setPointerCapture(pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (event.pointerId !== pointerId) return;
  lon -= (event.clientX - lastX) * .25;
  lat = Math.max(-80, Math.min(80, lat + (event.clientY - lastY) * .25));
  lastX = event.clientX; lastY = event.clientY;
});
const release = (event: PointerEvent): void => {
  if (event.pointerId === pointerId) pointerId = null;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  zoom = Math.max(1.55, Math.min(4.6, zoom + Math.sign(event.deltaY) * .16));
}, { passive: false });

const loop = (now: number): void => {
  const begin = performance.now();
  // Avoid allocating even a temporary vector in the frame loop.
  const longitude = lon * Math.PI / 180;
  const latitude = lat * Math.PI / 180;
  const ring = Math.cos(latitude) * zoom;
  position.set(ring * Math.sin(longitude), zoom * Math.sin(latitude),
    ring * Math.cos(longitude));
  camera.position.copy(position);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  frameMs += performance.now() - begin;
  frameCount++;
  if (now - lastStats >= 500) {
    const fps = frameCount * 1000 / (now - lastStats);
    const data = {
      fps: Math.round(fps),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      frameMs: Math.round(frameMs / frameCount * 100) / 100,
    };
    window.__globeMetrics = data;
    info.textContent = 'Preset: ' + (globe?.quality ?? '—') +
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
void load(new URLSearchParams(location.search).get('quality') as QualitySetting || 'medium');
