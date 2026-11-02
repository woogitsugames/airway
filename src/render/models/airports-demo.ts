// [task-06] Temporary 30-city visual fixture until the globe and city dataset PRs merge.
import {
  AmbientLight, Color, DirectionalLight, Mesh, MeshStandardMaterial, PerspectiveCamera,
  Scene, SphereGeometry, Vector3, WebGLRenderer,
} from 'three';
import { t } from '../../i18n';
import { createAirports } from '../airports';
import { createAirportOverlay, type OverlayAirport } from '../../ui/overlay';
import type { DestinationRegion } from '../../ui/glyphs';

const DEG = Math.PI / 180;
const DEST: readonly DestinationRegion[] = ['NAM', 'EUN', 'EUS', 'AFR', 'ME', 'SAM'];
const CITIES: readonly (OverlayAirport & { hub: boolean })[] = [
  { id: 'LON', code: 'LON', lon: -0.1, lat: 51.5, hub: true },
  { id: 'PAR', code: 'PAR', lon: 2.4, lat: 48.9, hub: true },
  { id: 'BRU', code: 'BRU', lon: 4.4, lat: 50.8, hub: false },
  { id: 'AMS', code: 'AMS', lon: 4.9, lat: 52.4, hub: false },
  { id: 'BER', code: 'BER', lon: 13.4, lat: 52.5, hub: true },
  { id: 'WAW', code: 'WAW', lon: 21, lat: 52.2, hub: true },
  { id: 'ROM', code: 'ROM', lon: 12.5, lat: 41.9, hub: false },
  { id: 'MAD', code: 'MAD', lon: -3.7, lat: 40.4, hub: false },
  { id: 'LIS', code: 'LIS', lon: -9.1, lat: 38.7, hub: true },
  { id: 'BCN', code: 'BCN', lon: 2.2, lat: 41.4, hub: false },
  { id: 'MIL', code: 'MIL', lon: 9.2, lat: 45.5, hub: false },
  { id: 'PRG', code: 'PRG', lon: 14.4, lat: 50.1, hub: false },
  { id: 'VIE', code: 'VIE', lon: 16.4, lat: 48.2, hub: false },
  { id: 'BUD', code: 'BUD', lon: 19.1, lat: 47.5, hub: false },
  { id: 'ZRH', code: 'ZRH', lon: 8.5, lat: 47.4, hub: false },
  { id: 'CPH', code: 'CPH', lon: 12.6, lat: 55.7, hub: false },
  { id: 'OSL', code: 'OSL', lon: 10.8, lat: 59.9, hub: false },
  { id: 'STO', code: 'STO', lon: 18.1, lat: 59.3, hub: false },
  { id: 'HEL', code: 'HEL', lon: 24.9, lat: 60.2, hub: false },
  { id: 'DUB', code: 'DUB', lon: -6.3, lat: 53.3, hub: false },
  { id: 'EDI', code: 'EDI', lon: -3.2, lat: 55.9, hub: false },
  { id: 'IST', code: 'IST', lon: 29, lat: 41, hub: true },
  { id: 'ATH', code: 'ATH', lon: 23.7, lat: 38, hub: false },
  { id: 'CAI', code: 'CAI', lon: 31.2, lat: 30.0, hub: true },
  { id: 'CMN', code: 'CMN', lon: -7.6, lat: 33.6, hub: false },
  { id: 'ALG', code: 'ALG', lon: 3.1, lat: 36.7, hub: false },
  { id: 'TUN', code: 'TUN', lon: 10.2, lat: 36.8, hub: false },
  { id: 'DKR', code: 'DKR', lon: -17.5, lat: 14.7, hub: false },
  { id: 'NYC', code: 'NYC', lon: -74, lat: 40.7, hub: true },
  { id: 'TOR', code: 'TOR', lon: -79.4, lat: 43.7, hub: false },
];

function point(lon: number, lat: number, distance: number, out: Vector3): void {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  out.set(Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda)).multiplyScalar(distance);
}

export function mountAirportsDemo(host: HTMLElement): () => void {
  const scene = new Scene();
  scene.background = new Color('#8CC3D8');
  // Temporary sea sphere; land/terrain is exclusively owned by task 03.
  const sea = new Mesh(new SphereGeometry(1, 64, 40), new MeshStandardMaterial({ color: '#4AA3B8', flatShading: true, roughness: 1 }));
  scene.add(sea);
  const sunlight = new DirectionalLight('#FFF4E0', 2.2);
  sunlight.position.set(-2, 4, 5);
  scene.add(sunlight, new AmbientLight('#DDE5DE', 1));
  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const camera = new PerspectiveCamera(42, 1, 0.05, 30);
  renderer.domElement.setAttribute('aria-label', t('canvas.label'));
  host.appendChild(renderer.domElement);
  const airportLayer = createAirports(scene, { maxAirports: CITIES.length, maxHubSeats: 32 });
  let zoom = Math.max(1, Math.min(2.5, Number(new URLSearchParams(location.search).get('zoom')) || 1));
  const gaze = new Vector3();
  let targetLon = 12;
  let targetLat = 49;
  function setView(): void {
    point(targetLon, targetLat, 1.2 + 2.1 / zoom, gaze);
    camera.position.copy(gaze);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    airportLayer.setZoom(zoom);
  }
  setView();
  const overlay = createAirportOverlay(host, camera, {
    reservedTop: 108,
    reservedBottom: 80,
    onNavigate(id): void {
      const city = CITIES.find(item => item.id === id);
      if (!city) return;
      targetLon = city.lon;
      targetLat = city.lat;
      setView();
    },
  });
  for (let i = 0; i < CITIES.length; i++) {
    const city = CITIES[i];
    airportLayer.addAirport(city);
    overlay.addAirport(city);
    const cap = city.hub ? 8 + (i % 4) * 4 : 0;
    const used = city.hub ? (i * 13 + 7) % (cap + 1) : 0;
    if (city.hub) airportLayer.setHubLoad(city.id, i === 0 ? cap : used, cap);
    if (i === 9 || i === 15) airportLayer.setCurfew(city.id, true);
    const wait = Array.from({ length: i === 0 ? 10 : 1 + (i * 7) % 9 }, (_, j) => DEST[(i * 3 + j * 5) % DEST.length]);
    overlay.setPassengers(city.id, wait);
    if (i === 0 || i === 23) overlay.setJamCountdown(city.id, i === 0 ? 42 : 70);
  }
  const controls = document.createElement('div');
  controls.className = 'airport-demo-controls';
  const label = document.createElement('label');
  label.htmlFor = 'airport-demo-zoom';
  label.textContent = t('airport.demo.zoom');
  const slider = document.createElement('input');
  slider.id = 'airport-demo-zoom';
  slider.type = 'range';
  slider.min = '1';
  slider.max = '2.5';
  slider.step = '.1';
  slider.value = String(zoom);
  const currentZoom = document.createElement('output');
  currentZoom.textContent = zoom.toFixed(1) + '×';
  const pool = document.createElement('small');
  const stats = overlay.getPoolStats();
  pool.textContent = t('airport.demo.pool', { count: stats.domElements });
  controls.append(label, slider, currentZoom, pool);
  host.appendChild(controls);
  slider.addEventListener('input', () => {
    zoom = Number(slider.value);
    currentZoom.textContent = zoom.toFixed(1) + '×';
    setView();
  });
  const resize = (): void => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(host);
  window.addEventListener('resize', resize);
  resize();
  let frame = 0;
  let stopped = false;
  const draw = (): void => {
    if (stopped) return;
    renderer.render(scene, camera);
    overlay.update();
    frame = requestAnimationFrame(draw);
  };
  draw();
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener('resize', resize);
    overlay.dispose();
    airportLayer.dispose();
    controls.remove();
    renderer.domElement.remove();
    renderer.dispose();
    sea.geometry.dispose();
    (sea.material as MeshStandardMaterial).dispose();
  };
}
