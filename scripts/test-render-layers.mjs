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
  for (const path of ['globe/geo-math.ts', 'routes.ts', 'models/planes.ts', 'planes.ts', 'routePreview.ts', 'airports.ts',
    'camera.ts', 'framing.ts', 'contrast.ts', 'menuNetwork.ts', 'sun.ts'] /* [task-34] */) {
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
  // [task-34] Plane shadows fade with daylight (no sun at night).
  planes.setDaylight(0);
  check(!planes.shadow.visible && planes.shadowMaterial.opacity === 0, 'plane shadows hidden at night');
  planes.setDaylight(1);
  check(planes.shadow.visible && planes.shadowMaterial.opacity > 0.2, 'plane shadows back by day');
  planes.dispose();
  routes.dispose();

  // [task-34] Camera insets measured from the HUD/menu boxes, not fixed numbers.
  const { insetsFromLayout, menuFraming, solveZoomForRadius } = await load('framing.js');
  const { GlobeOrbitCamera } = await load('camera.js');
  const { contrastRatio, relativeLuminance, layerContrast } = await load('contrast.js');
  const { createMenuNetwork } = await load('menuNetwork.js');
  const { createSunController } = await load('sun.js');
  // Landscape 915x412: boarding pass top-left, tag rail on the right.
  const pass = { left: 12, top: 10, right: 432, bottom: 70 };
  const rail = { left: 817, top: 0, right: 915, bottom: 412 };
  const land = insetsFromLayout(915, 412, [pass, rail], { left: 0 });
  check(land.top === 78 && land.right === 106 && land.left === 0 && land.bottom === 0,
    'landscape: pass -> top inset, tag rail -> right inset ' + JSON.stringify(land));
  // Portrait 412x915: pass on top, dock at the bottom; safe-area base insets win when larger.
  const port = insetsFromLayout(412, 915, [{ left: 12, top: 10, right: 400, bottom: 70 },
    { left: 0, top: 830, right: 412, bottom: 915 }], { top: 100, bottom: 0 });
  check(port.top === 100 && port.bottom === 93 && port.left === 0 && port.right === 0,
    'portrait: dock -> bottom inset, larger safe-area top kept ' + JSON.stringify(port));
  check(JSON.stringify(insetsFromLayout(412, 915, [{ left: 0, top: 0, right: 0, bottom: 0 }])) ===
    JSON.stringify({ top: 0, right: 0, bottom: 0, left: 0 }), 'hidden (empty) panels add no inset');
  const fold = insetsFromLayout(904, 1000, [rail.left === 817 ? { left: 790, top: 0, right: 904, bottom: 1000 } : rail]);
  check(fold.right === 122 && fold.top === 0, 'foldable side rail -> right inset');

  // The globe disc is centred in the free area and stays clear of the panels.
  const camLand = new GlobeOrbitCamera(new three.PerspectiveCamera(30, 1, 0.05, 30), { zoom: 1 });
  camLand.setViewport(915, 412, land);
  const dl = camLand.getScreenDisc();
  const freeCx = (0 + 915 - land.right) / 2, freeCy = (land.top + 412) / 2;
  check(Math.abs(dl.x - freeCx) < 2 && Math.abs(dl.y - freeCy) < dl.radius * 0.15, // oblique tilt
    `landscape disc centred in the free area (${dl.x.toFixed(1)},${dl.y.toFixed(1)} vs ${freeCx},${freeCy})`);
  check(dl.x + dl.radius <= 915 - land.right + 1 && dl.y - dl.radius >= land.top - 1,
    'landscape zoom-1 disc clears the tag rail and the boarding pass');
  const camPort = new GlobeOrbitCamera(new three.PerspectiveCamera(30, 1, 0.05, 30), { zoom: 1 });
  camPort.setViewport(412, 915, port);
  const dp = camPort.getScreenDisc();
  check(dp.y + dp.radius <= 915 - port.bottom + 1 && dp.y - dp.radius >= port.top - 1 && dp.radius > 150,
    'portrait zoom-1 disc fits between pass and dock');

  // Menu: portrait horizon under the sign, network band above the board; landscape disc beside the board.
  const sign = { left: 16, top: 20, right: 260, bottom: 96 };
  const boardP = { left: 12, top: 597, right: 400, bottom: 900 };
  const menuP = menuFraming(412, 915, sign, boardP);
  check(menuP.mode === 'horizon' && menuP.insets.top === 96 && menuP.insets.bottom === 318,
    'portrait menu frames between sign and board ' + JSON.stringify(menuP.insets));
  const camMenu = new GlobeOrbitCamera(new three.PerspectiveCamera(30, 1, 0.05, 30), { zoom: 1 });
  camMenu.setViewport(412, 915, menuP.insets);
  const zoom = solveZoomForRadius((z) => { camMenu.setZoom(z); return camMenu.getScreenDisc().radius; }, menuP.radius);
  camMenu.setZoom(zoom);
  let dm = camMenu.getScreenDisc();
  camMenu.setViewShift(0, menuP.horizonY - (dm.y - dm.radius));
  dm = camMenu.getScreenDisc();
  check(Math.abs(dm.y - dm.radius - menuP.horizonY) < 1 && menuP.horizonY > 96 && menuP.horizonY < 597,
    `menu horizon lands under the sign (${(dm.y - dm.radius).toFixed(1)} vs ${menuP.horizonY.toFixed(1)})`);
  check(dm.radius >= 412 * 0.9 && dm.radius < 412 * 2, 'menu globe is wider than the phone, like the mockup');
  const menuL = menuFraming(915, 412, { left: 16, top: 12, right: 242, bottom: 88 }, { left: 16, top: 132, right: 426, bottom: 405 });
  check(menuL.mode === 'disc' && menuL.insets.left === 442, 'landscape menu keeps the globe beside the board');
  const camMenuL = new GlobeOrbitCamera(new three.PerspectiveCamera(30, 1, 0.05, 30), { zoom: 1 });
  camMenuL.setViewport(915, 412, menuL.insets);
  const dml = camMenuL.getScreenDisc();
  check(dml.x - dml.radius >= 426, 'landscape menu disc does not slide under the board');

  // Contrast helpers (WCAG) and the layer-diff median used by scripts/shots-34.mjs.
  check(Math.abs(contrastRatio(relativeLuminance(255, 255, 255), relativeLuminance(0, 0, 0)) - 21) < 1e-9,
    'white on black is 21:1');
  const bg = new Uint8Array(400 * 4).fill(20);
  const fg = bg.slice();
  for (let i = 0; i < 100; i++) fg.set([240, 236, 226], i * 4);
  const lc = layerContrast(fg, bg);
  check(lc && lc.pixels === 100 && lc.ratio > 4.5, 'layer contrast counts only changed pixels');

  // Menu decorative network: sets and clears its own layers; planes advance on a private clock.
  const calls = [];
  const target = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, args]) });
  const lookup = (code) => ({ NYC: [-74, 40.7], LON: [-0.1, 51.5], MAD: [-3.7, 40.4], DKR: [-17.4, 14.7],
    LIS: [-9.1, 38.7], PAR: [2.35, 48.86], DUB: [-6.26, 53.35], OSL: [10.75, 59.91], CMN: [-7.6, 33.57] })[code]
    ?.reduce((lon, lat) => ({ lon, lat }));
  const menu = createMenuNetwork(target, lookup);
  check(menu.frame(0.1) === null, 'menu network is idle until started');
  menu.start();
  const routesCall = calls.find(([name]) => name === 'setRoutes');
  check(routesCall && routesCall[1][0].length === 5, 'menu network shows five routes');
  const before = calls.filter(([name]) => name === 'setPlanes').length;
  const alpha = menu.frame(0.25);
  check(calls.filter(([name]) => name === 'setPlanes').length > before && alpha >= 0 && alpha < 1,
    'menu planes advance on whole ticks with an interpolation alpha');
  const planesNow = calls.filter(([name]) => name === 'setPlanes').at(-1)[1][1];
  check(planesNow.every((p) => p.progress01 >= 0 && p.progress01 <= 10000), 'menu plane progress stays on the leg');
  menu.stop();
  check(calls.at(-1)[0] === 'setCities' && calls.at(-1)[1][0].length === 0, 'menu network clears on stop');

  // Sun: daylight at the view centre is 1 at noon and 0 at midnight.
  const sunCtl = createSunController({ setSun() {} });
  sunCtl.setViewCenter(0, 0);
  sunCtl.update(720);
  const noon = sunCtl.daylight;
  sunCtl.update(0);
  check(noon === 1 && sunCtl.daylight === 0, 'view-centre daylight drives night-only behaviour');
} catch (error) {
  failed++;
  failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  rmSync(folder, { recursive: true, force: true });
  for (const entry of failures) console.error('FAIL ' + entry);
  console.log(`SUMMARY test:render-layers seed=0x${SEED.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
  if (failed) process.exitCode = 1;
}
