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
  // [M1] Render files go to <tmp>/render, the read-only dataset they import to <tmp>/data.
  for (const path of ['globe/geo-math.ts', 'routes.ts', 'models/planes.ts', 'planes.ts', 'routePreview.ts', 'airports.ts',
    'camera.ts', 'framing.ts', 'contrast.ts', 'menuNetwork.ts', 'sun.ts' /* [task-34] */,
    'models/airportStyle.ts', 'models/airportKit.ts', 'globe/land-mask.ts', '../data/cities.ts' /* [M1] */]) {
    const file = resolve(ROOT, 'src/render', path);
    const target = join(folder, 'render', path.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(target), { recursive: true });
    const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
      fileName: file, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    writeFileSync(target, outputText.replace(/from (['"])(\.\.?\/[^'"]+)\1/g, (_, q, spec) => `from ${q}${spec}.js${q}`));
  }
  const three = await import('three');
  const load = (name) => import(pathToFileURL(join(folder, 'render', name)).href);
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

  // [M1] Richer world: regional airport styles, hubs, landmarks and plane bank.
  {
    const style = await load('models/airportStyle.js');
    const kitMod = await load('models/airportKit.js');
    const { airportPieces } = await load('airports.js');
    const { decodeLandMask } = await load('globe/land-mask.js');
    const { CITIES } = await import(pathToFileURL(join(folder, 'data/cities.js')).href);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    check(same(style.airportStyle('LIS', -9.1, 38.7), style.airportStyle('LIS', -9.1, 38.7)) &&
      same(style.airportStyle('C7', 20, 10), style.airportStyle('C7', 20, 10)), 'airport style is deterministic per id');
    const lis = style.airportStyle('LIS', -9.1, 38.7), osl = style.airportStyle('OSL', 10.75, 59.9);
    const sin = style.airportStyle('SIN', 103.8, 1.3), nyc = style.airportStyle('NYC', -74, 40.7);
    check(lis.region === 'EUS' && lis.roof === 'hip' && nyc.region === 'NAM' && nyc.roof === 'flat',
      'region comes from the dataset and picks the regional roof');
    check(osl.climate === 'snow' && osl.roofColor === style.SNOW && osl.palms === 0, 'northern airports get snow, no palms');
    check(sin.climate === 'tropical' && sin.palms >= 3 && sin.palms <= 5 && lis.palms === 0, 'tropical airports get 3-5 palms');
    const roofs = new Set(CITIES.map((c) => style.airportStyle(c.code, c.lon, c.lat).roof));
    check(roofs.size === 5, 'five roof archetypes across the dataset (' + [...roofs] + ')');
    check(style.regionFromLonLat(-74, 40) === 'NAM' && style.regionFromLonLat(139, 35) === 'ASI' &&
      style.regionFromLonLat(150, -33) === 'OCE', 'unknown ids fall back to a coarse lon/lat region');
    const palms = style.palmBearings(sin, 180);
    check(palms.length === sin.palms && palms.every((b) => Math.abs(((b - 180 + 540) % 360) - 180) >= 45),
      'palms keep out of the landmark sector');

    // Hubs are visibly larger: bigger pad, more pieces (apron, pier, tower).
    const hubLayout = airportPieces('LIS', -9.1, 38.7, true), cityLayout = airportPieces('LIS', -9.1, 38.7, false);
    check(hubLayout.pieces.length >= cityLayout.pieces.length + 3 && hubLayout.pieces.some((p) => p.piece === 'tower') &&
      !cityLayout.pieces.some((p) => p.piece === 'tower'), 'hub adds apron, second terminal and tower');
    const sizeScene = new three.Scene();
    const sized = createAirports(sizeScene, { maxAirports: 4, maxHubSeats: 8 });
    sized.addAirport({ id: 'LIS', lon: -9.1, lat: 38.7, hub: true });
    sized.addAirport({ id: 'MAD', lon: -3.7, lat: 40.4 });
    const field = sized.group.children.find((c) => c.name === 'airport-airfield');
    const scaleOf = (i) => { const m = new three.Matrix4(); field.getMatrixAt(i, m); return new three.Vector3().setFromMatrixScale(m).x; };
    check(field.count === 2 && scaleOf(0) / scaleOf(1) > 1.35, 'hub pad is ~1.4x the city pad');
    const lattice = sized.group.children.find((c) => c.name === 'airport-lattice');
    check(lattice.count === 0, 'no landmark without its city');
    sized.addAirport({ id: 'PAR', lon: 2.35, lat: 48.86 });
    check(lattice.count === 1, 'landmark appears with its active city');
    sized.clear();
    check(lattice.count === 0 && field.count === 0, 'clear() removes airports, decor and landmarks');
    sized.dispose();

    // Landmarks: off the pads (own barrier and every other dataset hub pad), on land, inside their footprint.
    const mask = decodeLandMask(JSON.parse(readFileSync(resolve(ROOT, 'public/data/land-50m.json'), 'utf8')));
    const F = style.AIRPORT_FOOTPRINT;
    let landmarkIssues = [];
    const geometryCache = new Map();
    const v = new three.Vector3();
    for (const id of Object.keys(style.LANDMARKS)) {
      const city = CITIES.find((c) => c.code === id);
      const place = style.landmarkFor(id);
      if (!city || !place) { landmarkIssues.push(id + ' missing'); continue; }
      const r = style.LANDMARK_RADIUS[place.kind];
      const own = style.angularDistance(city.lon, city.lat, place.lon, place.lat);
      if (own - r < F.barrierRadius) landmarkIssues.push(id + ' touches its own pad/barrier');
      for (const other of CITIES) {
        if (other.code !== id && style.angularDistance(place.lon, place.lat, other.lon, other.lat) - r < F.padRadius * F.hubScale) {
          landmarkIssues.push(id + ' overlaps ' + other.code);
        }
      }
      if (mask.distanceAt(place.lon, place.lat) < 0.3) landmarkIssues.push(id + ' is not on land');
      const layout = airportPieces(id, city.lon, city.lat, false);
      let reach = 0;
      for (const piece of layout.pieces.filter((p) => p.anchor === 0 && layout.anchors[0].bearing === place.bearing)) {
        if (!geometryCache.has(piece.piece)) geometryCache.set(piece.piece, kitMod.kitGeometry(piece.piece));
        const pos = geometryCache.get(piece.piece).getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(piece.local);
          reach = Math.max(reach, Math.hypot(v.x, v.z));
        }
      }
      if (!(reach > 0) || reach > r + 1e-6) landmarkIssues.push(id + ' geometry reach ' + reach.toFixed(4) + ' > ' + r.toFixed(4));
    }
    check(landmarkIssues.length === 0, 'landmarks clear of pads, on land, within footprint ' + landmarkIssues.join('; '));
    for (const g of geometryCache.values()) g.dispose();

    // Bank: exactly level on a straight great circle, bounded and smooth in a turn, level on the ground.
    const { stepBank, createBankState, MAX_BANK } = await load('planes.js');
    const arcState = createBankState();
    const axis = new three.Vector3(0.3, 1, 0.2).normalize();
    const p0 = new three.Vector3().crossVectors(axis, new three.Vector3(1, 0, 0)).normalize();
    const pos = new three.Vector3(), fwd = new three.Vector3(), upv = new three.Vector3();
    let straightMax = 0;
    for (let i = 0; i < 300; i++) {
      pos.copy(p0).applyAxisAngle(axis, i * 0.004);
      upv.copy(pos).normalize();
      fwd.crossVectors(axis, upv).normalize();
      straightMax = Math.max(straightMax, Math.abs(stepBank(arcState, fwd, upv, 1 / 60, 1)));
    }
    check(straightMax < 1e-6, 'zero bank on straight (great-circle) flight: ' + straightMax);
    const turn = createBankState();
    const north = new three.Vector3(0, 0, -1), east = new three.Vector3(1, 0, 0), y = new three.Vector3(0, 1, 0);
    stepBank(turn, north, y, 1 / 60, 1);
    let peak = 0, flips = 0, last = 0;
    for (let i = 0; i < 240; i++) {
      const b = stepBank(turn, east, y, 1 / 60, 1);
      if (Math.abs(b) > Math.abs(peak)) peak = b;
      if (last !== 0 && Math.sign(b) !== Math.sign(last) && b !== 0) flips++;
      last = b;
    }
    check(Math.abs(peak) > 0.05 && Math.abs(peak) <= MAX_BANK + 1e-9, 'bank in a turn is visible and bounded: ' + peak.toFixed(3));
    check(flips === 0 && Math.abs(last) < Math.abs(peak) * 0.05, 'bank settles without overshoot after the turn');
    const ground = createBankState();
    stepBank(ground, north, y, 1 / 60, 0);
    let groundMax = 0;
    for (let i = 0; i < 60; i++) groundMax = Math.max(groundMax, Math.abs(stepBank(ground, east, y, 1 / 60, 0)));
    check(groundMax === 0, 'no bank on the ground');

    // Through the layer: a straight single-leg route keeps every plane level.
    const levelRoutes = new RouteLayer();
    levelRoutes.setRoutes([{ id: 'S', type: 'widebody', waypoints: [LIS, { lon: 37.6, lat: 55.8 }] }], 1);
    const levelPlanes = new PlaneLayer(levelRoutes, { maxPlanes: 4 });
    const cam = new three.PerspectiveCamera(30, 1, 0.05, 30);
    cam.position.set(0, 0, 4);
    const levelSnap = (t) => [0, 1, 2].map((i) => ({ id: 'L' + i, routeId: 'S', segment: 0, progress01: 2000 + i * 2000 + t * 15, load: 1 }));
    let levelMax = 0;
    for (let t = 0; t < 40; t++) {
      levelPlanes.setSnapshots(levelSnap(t), levelSnap(t + 1));
      for (let f = 0; f < 3; f++) {
        levelPlanes.update(f / 3, cam, 1 / 30);
        for (const track of levelPlanes.tracks) levelMax = Math.max(levelMax, Math.abs(track.bank.bank));
      }
    }
    check(levelMax < 1e-6, 'plane layer: straight leg stays level');
    levelPlanes.dispose();
    levelRoutes.dispose();
  }

  // [task-34] Camera insets measured from the HUD/menu boxes, not fixed numbers.
  const { insetsFromLayout, menuFraming, solveZoomForRadius, menuSpinRate, MENU_SPIN_DEG_PER_S } = await load('framing.js'); // [task-39]
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

  // [task-39] D-62 menu rotation: ~1.2°/s on the shown menu, 0 with reduced motion, hidden menu or in a run.
  const shown = { menuActive: true, menuShown: true, reducedMotion: false };
  check(Math.abs(menuSpinRate(shown) - 1.2) < 0.05 && MENU_SPIN_DEG_PER_S === menuSpinRate(shown), 'menu globe turns ~1.2°/s');
  check(menuSpinRate({ ...shown, reducedMotion: true }) === 0, 'menu rotation stops with prefers-reduced-motion');
  check(menuSpinRate({ ...shown, menuShown: false }) === 0 && menuSpinRate({ ...shown, hidden: true }) === 0,
    'menu rotation stops while the menu is hidden');
  check(menuSpinRate({ ...shown, menuActive: false }) === 0, 'no menu rotation during a run');
  // Rotating the orbit keeps the menu disc (and the horizon under the sign) where the framing put it.
  const spinCam = new GlobeOrbitCamera(new three.PerspectiveCamera(30, 1, 0.05, 30), { zoom: 1 });
  spinCam.setViewport(915, 412, menuL.insets);
  const d0 = spinCam.getScreenDisc();
  spinCam.setTarget(-16 + MENU_SPIN_DEG_PER_S * 60, 40);
  const d1 = spinCam.getScreenDisc();
  check(Math.abs(d0.x - d1.x) < 0.5 && Math.abs(d0.y - d1.y) < 0.5 && Math.abs(d0.radius - d1.radius) < 0.5,
    'a minute of menu rotation leaves the framed disc in place');

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
