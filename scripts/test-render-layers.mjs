// [render] Headless checks of render layers that need no WebGL context: route preview
// range split, airport marker batching/clear, and allocation-free plane track pooling.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 0xA1A1;
let passed = 0;
let failed = 0;
const failures = [];
const check = (condition, label) => { if (condition) passed++; else { failed++; failures.push(label); } };
const folder = mkdtempSync(resolve(ROOT, 'node_modules/.render-layers-'));
try {
  writeFileSync(join(folder, 'package.json'), JSON.stringify({ type: 'module' }));
  for (const path of ['globe/geo-math.ts', 'routes.ts', 'models/planes.ts', 'planes.ts', 'routePreview.ts', 'airports.ts']) {
    const file = resolve(ROOT, 'src/render', path);
    const target = join(folder, path.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(target), { recursive: true });
    const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    writeFileSync(target, outputText.replace(/from (['"])(\.\.?\/[^'"]+)\1/g, (_, q, spec) => `from ${q}${spec}.js${q}`));
  }
  const three = await import('three');
  const load = (name) => import(pathToFileURL(join(folder, name)).href);
  const { createRoutePreview } = await load('routePreview.js');
  const { createAirports } = await load('airports.js');
  const { RouteLayer, sampleGreatCircleArc, makeGreatCircleArc } = await load('routes.js');
  const { PlaneLayer } = await load('planes.js');

  // Route preview: valid segments up to the range, red beyond it, on the committed arc.
  const preview = createRoutePreview();
  const LIS = { lon: -9.1, lat: 38.7 }, ACC = { lon: -0.2, lat: 5.6 };
  preview.update({ points: [LIS, ACC], legDistancesKm: [3788], rangeKm: 2500, aircraft: 'widebody' });
  const line = preview.object.children[0];
  const colors = line.geometry.getAttribute('color').array;
  const segments = line.geometry.drawRange.count / 2;
  let red = 0;
  for (let i = 0; i < segments; i++) if (colors[i * 6] < 0.9) red++;
  check(line.visible && segments === 65, 'preview splits exactly one segment at the range boundary');
  check(Math.abs(red / segments - (1 - 2500 / 3788)) < 0.03, 'out-of-range share of the preview is red');
  const positions = line.geometry.getAttribute('position').array;
  const arc = makeGreatCircleArc(LIS, ACC, 'widebody');
  const mid = sampleGreatCircleArc(arc, 0.5, new three.Vector3());
  let nearest = Infinity;
  for (let i = 0; i < segments * 2; i++) {
    nearest = Math.min(nearest, Math.hypot(positions[i * 3] - mid.x, positions[i * 3 + 1] - mid.y, positions[i * 3 + 2] - mid.z));
  }
  check(nearest < 1e-5, 'preview lies on the same lifted arc as the route tube');
  preview.update({ points: [LIS, ACC], legDistancesKm: [3788], rangeKm: 2500, aircraft: 'turboprop' });
  check(line.geometry.drawRange.count / 2 < segments, 'turboprop preview is dashed');
  preview.update(null);
  check(!line.visible && line.geometry.drawRange.count === 0, 'preview clears');
  preview.dispose();

  // Airports: hub rings and curfew barriers are rebuilt once per frame, not per call.
  const scene = new three.Scene();
  const airports = createAirports(scene, { maxAirports: 8, maxHubSeats: 16 });
  airports.addAirport({ id: 'LON', lon: -0.1, lat: 51.5, hub: true });
  airports.addAirport({ id: 'CAI', lon: 31.2, lat: 30, hub: false });
  const rings = airports.group.children.find((child) => child.isInstancedMesh && child.count === 0 && child.material.isMeshBasicMaterial);
  airports.setHubLoad('LON', 5, 12);
  airports.setCurfew('CAI', true);
  check(rings.count === 0, 'marker rebuild is deferred until update()');
  airports.update();
  check(rings.count === 12, 'one ring segment per hub seat');
  const barrierCount = airports.group.children.filter((c) => c.isInstancedMesh).reduce((n, c) => n + c.count, 0);
  check(barrierCount > 12, 'curfew barrier instances present');
  airports.clear();
  airports.update();
  check(rings.count === 0 && !airports.has('LON'), 'clear() removes airports and markers');
  airports.addAirport({ id: 'LON', lon: -0.1, lat: 51.5, hub: true });
  check(airports.isHub('LON'), 'airport can be re-added after clear');
  airports.dispose();

  // Planes: tick-boundary snapshots reuse pooled tracks.
  const routes = new RouteLayer();
  routes.setRoutes([{ id: 'R', type: 'turboprop', waypoints: [LIS, { lon: -0.1, lat: 51.5 }] }], 1);
  const planes = new PlaneLayer(routes, { maxPlanes: 10 });
  const snap = (p) => Array.from({ length: 10 }, (_, i) => ({ id: 'P' + i, routeId: 'R', segment: 0, progress01: (p + i * 900) % 10000, load: i }));
  planes.setSnapshots(snap(0), snap(10));
  const firstTrack = planes.tracks[0];
  for (let t = 1; t < 50; t++) planes.setSnapshots(snap(t * 10), snap(t * 10 + 10));
  check(planes.tracks[0] === firstTrack && planes.pool.length === 10, 'plane tracks are pooled across ticks');
  planes.dispose();
  routes.dispose();
} catch (error) {
  failed++;
  failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  rmSync(folder, { recursive: true, force: true });
  for (const entry of failures) console.error('FAIL ' + entry);
  console.log(`SUMMARY test:render-layers seed=0x${SEED.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
  if (failed) process.exitCode = 1;
}
