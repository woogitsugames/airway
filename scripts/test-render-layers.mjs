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
  for (const path of ['globe/geo-math.ts', 'routes.ts', 'planes.ts', 'routePreview.ts', 'airports.ts',
    'camera.ts', 'framing.ts', 'contrast.ts', 'menuNetwork.ts', 'sun.ts', /* [task-34] */
    'globe/linoryt.ts', 'linoryt-objects.ts'] /* [ext-04 E2] */) {
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
  const { sampleGreatCircleArc, makeGreatCircleArc } = await load('routes.js');
  const linoE5 = await load('linoryt-objects.js'); // [ext-04] the print layers replace the satellite ones (D-302)

  // [ext-04] D-302: the Linoryt layers (stamps, ribbon, dashed preview, sprites) replace the satellite ones.
  const sharedE5 = { uViewport: { value: { x: 412, y: 915 } }, uDpr: { value: 1 }, uTime: { value: 0 }, uPxPerRad: { value: 200 },
    uPaper: { value: new three.Color('#ECE3CC') }, uInk: { value: new three.Color('#1E1C1F') }, uRed: { value: new three.Color('#B33823') } };
  // Route preview: the part beyond the range is marked, and the ribbon lies on the committed (lifted) arc.
  const preview = linoE5.createLinorytRoutePreview(sharedE5);
  const LIS = { lon: -9.1, lat: 38.7 }, ACC = { lon: -0.2, lat: 5.6 };
  preview.update({ points: [LIS, ACC], legDistancesKm: [3788], rangeKm: 2500, aircraft: 'widebody' });
  const ribbonMesh = preview.object.children[0];
  const track = ribbonMesh.geometry.getAttribute('aTrack').array;
  const positions = ribbonMesh.geometry.getAttribute('position').array;
  const used = ribbonMesh.geometry.drawRange.count;
  let beyondVerts = 0, insideVerts = 0;
  const vertexCount = Math.max(...Array.from(ribbonMesh.geometry.index.array.slice(0, used))) + 1;
  for (let v = 0; v < vertexCount; v++) { if (track[v * 3 + 1] === 1) beyondVerts++; else insideVerts++; }
  check(ribbonMesh.visible && Math.abs(beyondVerts / (beyondVerts + insideVerts) - (1 - 2500 / 3788)) < 0.05,
    'preview marks the share beyond the range');
  const arc = makeGreatCircleArc(LIS, ACC, 'widebody');
  const mid = sampleGreatCircleArc(arc, 0.5, new three.Vector3());
  let nearest = Infinity;
  for (let v = 0; v < vertexCount; v++) {
    nearest = Math.min(nearest, Math.hypot(positions[v * 3] - mid.x, positions[v * 3 + 1] - mid.y, positions[v * 3 + 2] - mid.z));
  }
  check(nearest < 0.01, 'preview lies on the same lifted arc as the route ribbon');
  preview.update(null);
  check(!ribbonMesh.visible && ribbonMesh.geometry.drawRange.count === 0, 'preview clears');
  preview.dispose();

  // Airports: stamp rebuild is deferred until update(); clear() empties the layer.
  const scene = new three.Scene();
  const airports = linoE5.createStampLayer(scene, sharedE5, 8);
  airports.addAirport({ id: 'LON', lon: -0.1, lat: 51.5, hub: true });
  airports.addAirport({ id: 'CAI', lon: 31.2, lat: 30, hub: false });
  const stampMeshE5 = airports.group.children[1];
  airports.setCurfew('CAI', true);
  check(stampMeshE5.geometry.instanceCount === 0, 'stamp rebuild is deferred until update()');
  airports.update();
  check(stampMeshE5.geometry.instanceCount === 2, 'one stamp per airport');
  airports.clear();
  airports.update();
  check(stampMeshE5.geometry.instanceCount === 0 && !airports.has('LON'), 'clear() removes airports and stamps');
  airports.addAirport({ id: 'LON', lon: -0.1, lat: 51.5, hub: true });
  check(airports.isHub('LON'), 'airport can be re-added after clear');
  airports.dispose();

  // Planes: tick-boundary snapshots reuse pooled tracks.
  const routes = new linoE5.LinorytRouteLayer(sharedE5);
  routes.setRoutes([{ id: 'R', type: 'turboprop', waypoints: [LIS, { lon: -0.1, lat: 51.5 }] }], 1);
  const planes = new linoE5.LinorytPlaneLayer(routes, sharedE5, { maxPlanes: 10 });
  const snap = (p) => Array.from({ length: 10 }, (_, i) => ({ id: 'P' + i, routeId: 'R', segment: 0, progress01: (p + i * 900) % 10000, load: i }));
  planes.setSnapshots(snap(0), snap(10));
  const firstTrack = planes.tracks[0];
  for (let t = 1; t < 50; t++) planes.setSnapshots(snap(t * 10), snap(t * 10 + 10));
  check(planes.tracks[0] === firstTrack && planes.pool.length === 10, 'plane tracks are pooled across ticks');
  planes.update(0.5);
  check(planes.stats.planes === 10 && planes.stats.mainPassCalls === 1, 'ten planes in one sprite draw');
  planes.dispose();
  routes.dispose();

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
  // [ext-03 G9] D-177: a light disc with a dark outline on a dark sea reads by its core vs the outline (the outline
  // itself barely differs from the sea); a plain light disc on a light ground does not read at all.
  const W = 40, ground = new Uint8Array(W * W * 4).fill(16);
  const disc = (outline) => {
    const out = ground.slice();
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const r = Math.hypot(x - 20, y - 20);
      if (r < 12) out.set(r > 9 && outline ? [27, 36, 39] : [244, 240, 230], (y * W + x) * 4);
    }
    return out;
  };
  const outlined = layerContrast(disc(true), ground, 24, 20, W);
  const lightGround = new Uint8Array(W * W * 4).fill(236);
  const plainDisc = lightGround.slice();
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    if (Math.hypot(x - 20, y - 20) < 12) plainDisc.set([250, 248, 244], (y * W + x) * 4);
  }
  const plain = layerContrast(plainDisc, lightGround, 24, 20, W);
  check(outlined && outlined.core > 4.5 && outlined.ratio >= outlined.core && outlined.edge < 2,
    'outlined symbol: core vs outline counts (D-177) ' + JSON.stringify(outlined));
  check(plain === null || plain.ratio < 1.5, 'a light disc on a light ground stays unreadable (D-177)');
  // [ext-04] D-303: a print stamp (ink body in a 3 px paper rim) on ochre reads by ink : paper inside the rim; a
  // one-colour symbol has core ≈ 1 and must stand off the ground by its edge.
  const ochre = new Uint8Array(W * W * 4); for (let i = 0; i < W * W; i++) ochre.set([210, 156, 71, 255], i * 4);
  const stamp = ochre.slice(), flat = ochre.slice();
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const d = Math.max(Math.abs(x - 20), Math.abs(y - 20));
    if (d < 12) stamp.set(d >= 9 ? [236, 227, 204] : [30, 28, 31], (y * W + x) * 4);
    if (d < 12) flat.set([30, 28, 31], (y * W + x) * 4);
  }
  const printed = layerContrast(stamp, ochre, 24, 20, W), oneInk = layerContrast(flat, ochre, 24, 20, W);
  check(printed && printed.core > 10 && printed.ratio >= 3, 'print stamp: ink vs its paper rim > 10:1 (D-303) ' + JSON.stringify(printed));
  check(oneInk && oneInk.core < 1.2 && oneInk.edge > 4, 'one-colour symbol: core ≈ 1, read by its edge ' + JSON.stringify(oneInk));

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

  // [ext-04 E1] D-283 Linoryt look: spec §1 inks, no photo textures, no clouds/ocean/haze shells, DEV-only until E3.
  const linoryt = readFileSync(resolve(ROOT, 'src/render/globe/linoryt.ts'), 'utf8');
  const linorytGlobe = readFileSync(resolve(ROOT, 'src/render/globe/linoryt-globe.ts'), 'utf8');
  const globeIndex = readFileSync(resolve(ROOT, 'src/render/globe/index.ts'), 'utf8');
  const renderIndex = readFileSync(resolve(ROOT, 'src/render/index.ts'), 'utf8');
  const inks = { paper: '#ECE3CC', ink: '#1E1C1F', blue: '#2B4A66', ochre: '#D29C47', red: '#B33823' };
  for (const [name, hex] of Object.entries(inks)) check(linoryt.includes(`${name}: '${hex}'`), `linoryt ink ${name} = ${hex}`);
  check(/SKY_COLOUR = LINORYT_INKS\.paper/.test(linoryt), 'linoryt sky is paper');
  check(/LINORYT_INKS/.test(renderIndex) && /SKY_COLOUR/.test(renderIndex), 'render index exports LINORYT_INKS and SKY_COLOUR');
  check(!/\b(day|night|map|clouds)-\d+\.(jpg|png)/.test(linorytGlobe) && !/TextureLoader/.test(linorytGlobe),
    'linoryt look loads no photo textures (only elevation-2048.png)');
  check(!/createCloudShell|createOceanShell|createScatterAtmosphere/.test(linorytGlobe), 'linoryt look has no cloud, ocean or haze shell');
  check(!/awRed|LINORYT_INKS\.red/.test(linorytGlobe), 'linoryt globe material has no red (red is for a jam only, E2)');
  check(/await import\('\.\/linoryt-globe'\)/.test(globeIndex) && !/createTexturedTerrainMaterial|loadLookAssets|createDecorations|createAtmosphere/.test(globeIndex),
    '[E4] createGlobe builds only the Linoryt print (lazy chunk); no texture looks, decorations or atmosphere shell');
  const lookSrc = readFileSync(resolve(ROOT, 'src/render/globe/look.ts'), 'utf8');
  check(/export type GlobeLook = 'linoryt';/.test(lookSrc) && !/satellite|painted|refined|diorama'/.test(lookSrc.replace(/^\/\/.*$/gm, '')),
    '[E4] GlobeLook is the print only (Satelita, Mapa and the comparisons removed, D-285)');
  const worldSrcE3 = readFileSync(resolve(ROOT, 'src/render/world.ts'), 'utf8');
  check(!/import\.meta\.env\.DEV/.test(worldSrcE3) && !/createAirports\(|new RouteLayer\(|new PlaneLayer\(|createRoutePreview\(/.test(worldSrcE3),
    '[E4] world renderer draws only the Linoryt layers (no medallions, tubes or plane models)');

  // [ext-04 E2] D-283 spec §5–§8: Linoryt stamps by shape, curfew outline, jam zone + countdown arc, palette, routes.
  {
    const lino = await load('linoryt-objects.js');
    const inksModule = await load('globe/linoryt.js');
    check(inksModule.STAMP_SIZE_PX.airport === 22 && inksModule.STAMP_SIZE_PX.hub === 30, 'STAMP_SIZE_PX = { airport: 22, hub: 30 }');
    const scene2 = new three.Scene();
    const objects = { uViewport: { value: { x: 412, y: 915 } }, uDpr: { value: 1 }, uTime: { value: 0 }, uPxPerRad: { value: 200 },
      uPaper: { value: new three.Color('#ECE3CC') }, uInk: { value: new three.Color('#1E1C1F') }, uRed: { value: new three.Color('#B33823') } };
    const stamps = lino.createStampLayer(scene2, objects, 8);
    stamps.addAirport({ id: 'WAW', lon: 21, lat: 52.2 });
    stamps.addAirport({ id: 'IST', lon: 28.9, lat: 41, hub: true });
    stamps.update();
    const [jamMesh, stampMesh] = stamps.group.children;
    const shape = stampMesh.geometry.getAttribute('aShape').array;
    check(stampMesh.geometry.instanceCount === 2 && shape[0] === 0 && shape[4] === 1,
      'stamps: regular airport = square kind 0, hub = octagon kind 1 (shape, not colour)');
    check(stamps.halfSize('WAW') === 11 && stamps.halfSize('IST') === 15 && stamps.halfSize('XXX') === 0, 'stamp half size 11 / 15 px');
    stamps.setCurfew('WAW', true); stamps.update();
    check(stampMesh.geometry.getAttribute('aShape').array[1] === 1, 'curfew: the stamp is drawn as an outline (closed flag)');
    check(!jamMesh.visible && jamMesh.geometry.instanceCount === 0, 'no jam zone without a jam');
    stamps.setJam('IST', 0.4); stamps.update();
    const jam = jamMesh.geometry.getAttribute('aJam').array;
    check(jamMesh.visible && jamMesh.geometry.instanceCount === 1 && jam[0] === 45 && Math.abs(jam[1] - 0.4) < 1e-6 &&
      stampMesh.geometry.getAttribute('aShape').array[6] === 1, 'jam: zone r = 3 × half (45 px for a hub), arc = share left, stamp in red');
    stamps.setJam('IST', 7); stamps.update();
    check(Math.abs(jamMesh.geometry.getAttribute('aJam').array[1] - 1) < 1e-6, 'jam share clamped to 1');
    stamps.setJam('IST', null); stamps.update();
    check(!jamMesh.visible, 'jam cleared → zone gone');
    check(stamps.group.children.length === 2, 'stamps + jam zone: two instanced draws');
    const stampFrag = stampMesh.material.fragmentShader, jamFrag = jamMesh.material.fragmentShader;
    check(/vShape\.z > 0\.5 \? uRed : uInk/.test(stampFrag), 'stamp red only when jammed');
    check(/sdOctagon/.test(stampFrag) && /sdBox/.test(stampFrag) && /abs\(outer \+ 1\.25\) - 1\.25/.test(stampFrag),
      'stamp SDF: octagon hub, square airport, 2.5 px outline when closed');
    check(/atan\(vPx\.x, vPx\.y\)/.test(jamFrag) && /vJam\.y \* 6\.2831853/.test(jamFrag), 'jam arc from 12 o\'clock, clockwise, length = share');
    check(/mix\(uPaper, uRed, red\)/.test(jamFrag), 'jam ring and arc sit on a paper rim (D-303)');
    // Palette (L5): the route ribbon, the preview and the planes never use red.
    const routes2 = new lino.LinorytRouteLayer(objects);
    routes2.setRoutes([{ id: 'r', type: 'widebody', waypoints: [{ lon: -0.1, lat: 51.5 }, { lon: -74, lat: 40.7 }] },
      { id: 't', type: 'turboprop', waypoints: [{ lon: 21, lat: 52.2 }, { lon: 28.9, lat: 41 }, { lon: 31.2, lat: 30 }] }], 1);
    const ribbon = routes2.group.children[0];
    check(routes2.stats.routes === 2 && routes2.stats.drawCalls === 1 && ribbon.renderOrder === 10, 'routes: one ribbon draw for every route');
    const widths = ribbon.geometry.getAttribute('aWidth').array;
    const pairs = new Set(); for (let i = 0; i < widths.length; i += 2) pairs.add(widths[i] + '/' + widths[i + 1]);
    check(pairs.has('3.25/1.25') && pairs.has('2.5/1'), 'double line: widebody 6.5/2.5 px, turboprop 5/2 px (outer/core)');
    check(!/uRed/.test(ribbon.material.fragmentShader), 'routes: no red');
    check(routes2.getRoute('t')?.arcs.length === 2, 'ribbon routes keep the prepared arcs for the planes');
    const preview2 = lino.createLinorytRoutePreview(objects);
    preview2.update({ points: [{ lon: -9.1, lat: 38.7 }, { lon: -0.2, lat: 5.6 }], legDistancesKm: [3788], rangeKm: 2500, aircraft: 'turboprop' });
    const previewMesh = preview2.object.children[0];
    check(previewMesh.visible && previewMesh.geometry.drawRange.count > 0 && previewMesh.material.uniforms.uDash.value === 1 &&
      !/uRed/.test(previewMesh.material.fragmentShader), 'route preview: dashed ink, no red (beyond the range: dots)');
    const beyond = previewMesh.geometry.getAttribute('aTrack').array;
    let flagged = 0; for (let i = 1; i < beyond.length; i += 3) if (beyond[i] === 1) flagged++;
    check(flagged > 0, 'route preview marks the part beyond the range');
    preview2.update(null);
    check(!previewMesh.visible, 'route preview hides on null');
    const worldSrc = readFileSync(resolve(ROOT, 'src/render/world.ts'), 'utf8');
    const body = worldSrc.slice(worldSrc.indexOf('world.projectAirport = '), worldSrc.indexOf('return world;'));
    check(/project\(city\.lon, city\.lat, 1\.01, point\)/.test(body) && /project\(city\.lon, city\.lat, 1\.01, point\)/.test(worldSrc.slice(worldSrc.indexOf('pick(x, y)'))),
      'projectAirport measures the same point as pick() (altitude 1.01)');
    check(!/new |\[\]|=> \(\{/.test(body), 'projectAirport allocates nothing (writes into out)');
    stamps.dispose(); routes2.dispose(); preview2.dispose();
  }
} catch (error) {
  failed++;
  failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  rmSync(folder, { recursive: true, force: true });
  for (const entry of failures) console.error('FAIL ' + entry);
  console.log(`SUMMARY test:render-layers seed=0x${SEED.toString(16).toUpperCase()} passed=${passed} failed=${failed}`);
  if (failed) process.exitCode = 1;
}
