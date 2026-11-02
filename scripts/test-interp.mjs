// [task-10] Renderer interpolation and 100-plane instance-budget regression.
// Transpile to a temporary ESM tree so Node can import TS without a bundler.
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 0xA1A1;
let seed = SEED;
const rng = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let value = seed;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
};
let passed = 0;
let failed = 0;
const failures = [];
function check(condition, description) {
  if (condition) passed++;
  else { failed++; failures.push(description); }
}
function near(a, b, tolerance = 1e-7) { return Math.abs(a - b) <= tolerance; }
const folder = mkdtempSync(resolve(ROOT, 'node_modules/.interp-'));
try {
  writeFileSync(join(folder, 'package.json'), JSON.stringify({ type: 'module' }));
  for (const path of ['src/render/globe/geo-math.ts', 'src/render/routes.ts', 'src/render/models/planes.ts', 'src/render/planes.ts']) {
    const file = resolve(ROOT, path);
    const target = join(folder, path.slice('src/render/'.length).replace(/\.ts$/, '.js'));
    mkdirSync(dirname(target), { recursive: true });
    const content = readFileSync(file, 'utf8');
    const { outputText } = ts.transpileModule(content, {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    writeFileSync(target, outputText.replace(/from (['"])(\.\.?\/[^'"]+)\1/g,
      (_, quote, spec) => `from ${quote}${spec}.js${quote}`));
  }
  const three = await import('three');
  const routes = await import(pathToFileURL(join(folder, 'routes.js')).href);
  const planes = await import(pathToFileURL(join(folder, 'planes.js')).href);
  const { Vector3, PerspectiveCamera } = three;
  const { prepareRoute, sampleGreatCircleArc, sampleRouteDistance, RouteLayer } = routes;
  const { PlaneLayer, planeProgressDistance, interpolatePlaneDistance } = planes;
  const lonLat = [
    { lon: -9.14, lat: 38.72 }, { lon: -0.13, lat: 51.5 }, { lon: 31.23, lat: 30.04 },
  ];
  const wb = prepareRoute({ id: 'test-wb', type: 'widebody', waypoints: lonLat });
  const tp = prepareRoute({ id: 'test-tp', type: 'turboprop', waypoints: lonLat });
  check(wb !== null && tp !== null, 'both route types prepare');
  const reused = { from: new Vector3(), side: new Vector3(), angle: 0, lift: 0, liftFactor: 0 };
  const arcOut = routes.makeGreatCircleArc(lonLat[0], lonLat[1], 'turboprop', reused);
  check(arcOut === reused && near(arcOut.angle, wb.arcs[0].angle, 1e-12) &&
    arcOut.lift === routes.CRUISE_LIFT.turboprop, 'preview arc reuses caller storage with identical geometry');
  const a = new Vector3(); const b = new Vector3(); const tang = new Vector3();
  sampleGreatCircleArc(wb.arcs[0], 1, a, tang);
  sampleGreatCircleArc(wb.arcs[1], 0, b, tang);
  check(a.distanceTo(b) < 1e-9, 'no spatial gap at a route waypoint');
  sampleGreatCircleArc(wb.arcs[0], 0.5, a);
  sampleGreatCircleArc(tp.arcs[0], 0.5, b);
  check(a.length() > b.length() + 0.01, 'widebody arch higher than turboprop arch');
  sampleRouteDistance(wb, wb.cumulative[1], a);
  sampleGreatCircleArc(wb.arcs[1], 0, b);
  check(a.distanceTo(b) < 1e-9, 'distance sampling reaches shared waypoint');

  const before = { id: 'P', routeId: 'test-wb', segment: 0, progress01: 9990, load: 50, direction: 1 };
  const after = { ...before, segment: 1, progress01: 10 };
  const from = planeProgressDistance(wb, before);
  const to = planeProgressDistance(wb, after);
  check(to > from && to - from < 0.002, 'forward cross-segment distance stays continuous');
  sampleRouteDistance(wb, interpolatePlaneDistance(from, to, 0.5), a);
  sampleRouteDistance(wb, wb.cumulative[1], b);
  check(a.distanceTo(b) < 0.002, 'interpolated plane crosses shared city continuously');
  check(near(interpolatePlaneDistance(from, to, 0), from) &&
    near(interpolatePlaneDistance(from, to, 1), to), 'alpha endpoints exact');
  check(near(interpolatePlaneDistance(from, to, 2), to), 'alpha is clamped');
  const backwardBefore = { ...before, segment: 1, progress01: 9990, direction: -1 };
  const backwardAfter = { ...before, segment: 0, progress01: 10, direction: -1 };
  check(planeProgressDistance(wb, backwardBefore) - planeProgressDistance(wb, backwardAfter) < 0.002,
    'reverse cross-segment distance continuous');

  const arc = routes.makeGreatCircleArc({ lon: 0, lat: 0 }, { lon: 180, lat: 0 }, 'widebody');
  sampleGreatCircleArc(arc, 0.37, a, tang);
  check(Number.isFinite(a.length()) && near(tang.length(), 1, 1e-6), 'antipodal arc remains finite');

  const layer = new RouteLayer();
  const specs = [];
  for (let i = 0; i < 40; i++) {
    const kind = i % 2 ? 'turboprop' : 'widebody';
    const lon = -135 + rng() * 270;
    const lat = -50 + rng() * 100;
    specs.push({ id: `R${i}`, type: kind, waypoints: [
      { lon, lat }, { lon: lon + 5 + rng() * 22, lat: lat + 1 + rng() * 18 },
      { lon: lon + 24 + rng() * 25, lat: lat + 4 + rng() * 23 },
    ] });
  }
  layer.setRoutes(specs, 42);
  check(layer.stats.routes === 40 && layer.stats.drawCalls <= 4, '40 routes in at most 4 route draw calls');
  const geoCount = layer.stats.rebuilds;
  layer.setRoutes(specs, 42);
  check(layer.stats.rebuilds === geoCount, 'same network revision never rebuilds geometry');
  const poseBefore = [];
  const poseAfter = [];
  for (let i = 0; i < 100; i++) {
    const routeId = `R${i % 40}`;
    const type = specs[i % 40].type;
    const offset = Math.round(rng() * 6000);
    poseBefore.push({ id: `P${i}`, routeId, segment: 0, progress01: offset, type,
      load: Math.round(rng() * 48), capacity: 48 });
    poseAfter.push({ ...poseBefore[i], progress01: offset + 100 });
  }
  const planeLayer = new PlaneLayer(layer, { maxPlanes: 100 });
  planeLayer.setSnapshots(poseBefore, poseAfter);
  const camera = new PerspectiveCamera(30, 412 / 915, 0.1, 20);
  camera.position.set(1, 2, 2);
  camera.lookAt(0, 0, 0);
  for (let i = 0; i < 500; i++) planeLayer.update((i % 101) / 100, camera);
  check(planeLayer.stats.planes === 100 && planeLayer.stats.droppedPlanes === 0,
    '100 planes update without dropped instances');
  check(planeLayer.stats.mainPassCalls + layer.stats.drawCalls <= 16,
    'routes + planes use at most 16 main-pass draw calls');
  check(layer.stats.rebuilds === geoCount, '500 frames never rebuild routes');
  check(planeLayer.stats.triangles < 200_000, 'instanced planes remain under 200k submitted triangles');
  console.log(`BENCH routes=${layer.stats.routes} planes=${planeLayer.stats.planes}` +
    ` calls=${layer.stats.drawCalls + planeLayer.stats.mainPassCalls}` +
    ` routeTriangles=${layer.stats.triangles} planeTriangles=${planeLayer.stats.triangles}` +
    ' (estimated main pass, no WebGL)');
  planeLayer.dispose();
  layer.dispose();
} catch (error) {
  failed++;
  failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  rmSync(folder, { recursive: true, force: true });
  for (const entry of failures) console.error('FAIL ' + entry);
  console.log(`SUMMARY test:interp seed=0x${SEED.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
  if (failed) process.exitCode = 1;
}
