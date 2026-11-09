// [render] Headless checks of render layers that need no WebGL context: route preview
// range split, airport marker batching/clear, and allocation-free plane track pooling.
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { execSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 0xA1A1;
let passed = 0;
let failed = 0;
const failures = [];
const check = (condition, label) => { if (condition) passed++; else { failed++; failures.push(label); } };
const execGrep = (pattern) => execSync(`git grep -lE ${JSON.stringify(pattern)} -- src || true`, { cwd: ROOT, encoding: 'utf8' }).trim();
const folder = mkdtempSync(resolve(ROOT, 'node_modules/.render-layers-'));
try {
  writeFileSync(join(folder, 'package.json'), JSON.stringify({ type: 'module' }));
  for (const path of ['globe/geo-math.ts', 'routes.ts', 'planes.ts', 'routePreview.ts', 'airports.ts',
    'camera.ts', 'framing.ts', 'contrast.ts', 'menuNetwork.ts', 'sun.ts', /* [task-34] */
    'marks.ts', 'objects.ts', 'objects-earth.ts', /* [ext-04 E2]; [night-82a R6] marks.ts */ 'globe/earth.ts', /* [night-70a R1] */
    'globe/borders.ts', 'projection.ts'] /* [night-72a R2] */) {
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
  const linoE5 = await load('objects.js'); // [ext-04] the object layers replace the satellite ones (D-302)

  // [ext-04] D-302: the object layers (points, ribbon, preview, sprites) replace the satellite ones.
  const sharedE5 = { uViewport: { value: { x: 412, y: 915 } }, uDpr: { value: 1 }, uTime: { value: 0 }, uPxPerRad: { value: 200 }, uScale: { value: 1 },
    uPaper: { value: new three.Color('#ECE3CC') }, uInk: { value: new three.Color('#1E1C1F') }, uRed: { value: new three.Color('#B33823') } };
  // Route preview: the part beyond the range is marked, and the ribbon lies on the committed (lifted) arc.
  const preview = linoE5.createRoutePreviewRibbon(sharedE5);
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
  const routes = new linoE5.RouteRibbonLayer(sharedE5);
  routes.setRoutes([{ id: 'R', type: 'turboprop', waypoints: [LIS, { lon: -0.1, lat: 51.5 }] }], 1);
  const planes = new linoE5.PlaneSpriteLayer(routes, sharedE5, { maxPlanes: 10 });
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
  // [night-75a] D-330 (T3): the UI-A preview's hub strip bay is a game panel like the dock: on the console in portrait
  // it lifts the bottom inset to its own top; beside the console in landscape (level with the board) it is a top band.
  const bayPort = insetsFromLayout(412, 915, [{ left: 12, top: 10, right: 400, bottom: 70 },
    { left: 0, top: 830, right: 412, bottom: 915 }, { left: 8, top: 706, right: 404, bottom: 826 }]);
  check(bayPort.bottom === 915 - 706 + 8 && bayPort.top === 78, 'portrait: strip bay over the dock -> bottom inset ' + JSON.stringify(bayPort));
  const bayLand = insetsFromLayout(915, 412, [pass, rail, { left: 488, top: 6, right: 775, bottom: 130 }]);
  check(bayLand.top === 138 && bayLand.right === 106 && bayLand.bottom === 0, 'landscape: strip bay beside the console -> top inset ' + JSON.stringify(bayLand));
  check(readFileSync(new URL('../src/game/world.ts', import.meta.url), 'utf8').includes("'.airway-strip-bay'"), 'world.ts measures the strip bay');
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

  // [night-79a R4] D-334: the UI-A menu frames the night globe to its `[data-globe-frame="menu"]` box (boxes measured on
  // the real board skin): centred on the frame's column, the limb under the tagline, at most 30 % behind the opaque
  // board (or the bottom edge in landscape), the part under the board inside its width and above its foot; a frame too
  // short for a 72 px disc shows the horizon of a disc as wide as the board. The camera reaches every radius (no clamp).
  {
    const { globeFrameFraming, GLOBE_FRAME_GAP, GLOBE_FRAME_HIDDEN_MAX, GLOBE_FRAME_DISC_MIN } = await load('framing.js');
    const cases = [
      ['412x915', 412, 915, { left: 10, top: 115, right: 402, bottom: 423 }, { left: 10, top: 433, right: 402, bottom: 761 }, 'disc'],
      ['390x844', 390, 844, { left: 10, top: 112, right: 380, bottom: 352 }, { left: 10, top: 362, right: 380, bottom: 690 }, 'disc'],
      ['768x1024', 768, 1024, { left: 10, top: 119, right: 758, bottom: 532 }, { left: 104, top: 542, right: 664, bottom: 870 }, 'disc'],
      ['320x568', 320, 568, { left: 10, top: 101, right: 310, bottom: 153 }, { left: 10, top: 163, right: 310, bottom: 414 }, 'cap'],
      ['360x640', 360, 640, { left: 10, top: 107, right: 350, bottom: 148 }, { left: 10, top: 158, right: 350, bottom: 486 }, 'cap'],
      ['915x412', 915, 412, { left: 10, top: 67, right: 459, bottom: 334 }, null, 'disc'],
      ['640x360', 640, 360, { left: 10, top: 61, right: 279, bottom: 282 }, null, 'disc'],
    ];
    for (const [tag, w, h, frame, cover, kind] of cases) {
      const f = globeFrameFraming(w, h, frame, cover);
      const cam = new GlobeOrbitCamera(new three.PerspectiveCamera(30, 1, 0.05, 30), { zoom: 1 });
      cam.setViewport(w, h, f.insets);
      const z = solveZoomForRadius((next) => { cam.setZoom(next); return cam.getScreenDisc().radius; }, f.radius);
      cam.setZoom(z);
      let d = cam.getScreenDisc();
      cam.setViewShift(0, f.horizonY - (d.y - d.radius));
      d = cam.getScreenDisc();
      const cx = (frame.left + frame.right) / 2;
      const coverTop = cover ? cover.top : h;
      const hidden = Math.max(0, d.y + d.radius - coverTop) / (2 * d.radius);
      const chordAt = (y) => (Math.abs(y - d.y) >= d.radius ? 0 : Math.sqrt(d.radius ** 2 - (y - d.y) ** 2));
      const under = cover ? Math.max(chordAt(Math.max(coverTop, Math.min(d.y, cover.bottom))), chordAt(coverTop)) : 0;
      check(f.kind === kind, `[R4] ${tag}: ${kind} (got ${f.kind}, radius ${f.radius})`);
      check(Math.abs(d.radius - f.radius) < 1.5, `[R4] ${tag}: the camera reaches radius ${f.radius} (got ${d.radius.toFixed(1)}, zoom ${z.toFixed(3)})`);
      check(Math.abs(d.x - cx) < 1.5, `[R4] ${tag}: centred on the frame's column (${d.x.toFixed(1)} vs ${cx})`);
      check(d.x - d.radius >= frame.left - 1 && d.x + d.radius <= frame.right + 1, `[R4] ${tag}: never wider than the frame`);
      check(d.y - d.radius >= frame.top + GLOBE_FRAME_GAP - 1, `[R4] ${tag}: the limb stays under the tagline (${(d.y - d.radius).toFixed(1)})`);
      if (kind === 'disc') {
        check(hidden <= GLOBE_FRAME_HIDDEN_MAX + 0.01 && d.radius >= GLOBE_FRAME_DISC_MIN, `[R4] ${tag}: ≤ 30 % behind the board/edge (${hidden.toFixed(2)})`);
        check(f.anchorY > d.y - d.radius && f.anchorY < Math.min(d.y + d.radius, coverTop), `[R4] ${tag}: the network anchor is in the visible part`);
      } else {
        check(f.anchorY > f.horizonY && f.anchorY < coverTop, `[R4] ${tag}: horizon: the network anchor is in the strip above the board`);
      }
      if (cover) {
        check(cx + under <= cover.right + 1 && cx - under >= cover.left - 1, `[R4] ${tag}: no sliver of globe beside the board (half chord ${under.toFixed(1)})`);
        check(d.y + d.radius <= cover.bottom + 1, `[R4] ${tag}: nothing of the globe under the board's foot`);
      }
    }
    // The old frames: on 412×915 the R4 disc is larger than D-286's index disc (142 px), on 915×412 than 171 px.
    check(globeFrameFraming(412, 915, cases[0][3], cases[0][4]).radius > 170 && globeFrameFraming(915, 412, cases[5][3], null).radius > 200,
      '[R4] the globe is larger than in the D-286 framing (412×915 > 170 px, 915×412 > 200 px)');
    const world = readFileSync(resolve(ROOT, 'src/game/world.ts'), 'utf8');
    check(world.includes(`'[data-globe-frame="menu"]'`) && /globeFrameFraming\(w, h, frame/.test(world) && /frameTilt\(/.test(world),
      '[R4] world.ts frames the menu globe to the board skin\'s [data-globe-frame="menu"] box');
    check(/menuShown = sign !== null \|\| frame !== null/.test(world), '[R4] the framed UI-A menu counts as shown: the D-62 spin runs there too');
    // Menu sun: the K2 night (sun 82° west of the view); [night-82a R6] D-337: the print's daylit menu is gone.
    const sunR4 = await load('sun.js');
    const lonOf = (tick) => sunR4.subsolarLongitudeAt(tick);
    const wrap = (v) => ((v + 180) % 360 + 360) % 360 - 180;
    check(Math.abs(wrap(lonOf(sunR4.menuSunTick(-16)) - (-98))) <= 0.25 && !('MENU_DAY_SUN_OFFSET_DEG' in sunR4),
      '[R4/R6] menu sun 82° west of the view (night, the dusk band left of centre); no daylit print menu');
    for (const lon of [-180, -16, 0, 97.3, 179.9]) {
      const tick = sunR4.menuSunTick(lon);
      check(Number.isInteger(tick) && tick >= 0 && tick < 1440, `[R4] menu sun tick for ${lon}° in [0, 1440) (got ${tick})`);
    }
    // Under the menu sun (view at 16°W) London is at night and New York in daylight: the terminator crosses the network.
    const daylightAt = (lon, lat) => {
      const ctl = sunR4.createSunController({ setSun() {} });
      ctl.setViewCenter(lon, lat);
      ctl.update(sunR4.menuSunTick(-16));
      return ctl.daylight;
    };
    check(daylightAt(-0.1, 51.5) === 0 && daylightAt(-74, 40.7) > 0.9,
      `[R4] menu night: London dark (${daylightAt(-0.1, 51.5)}), New York lit (${daylightAt(-74, 40.7).toFixed(2)})`);
    check(/menuSunTick\(renderer\.orbit\.getState\(\)\.longitude\)/.test(world) && !/nightMenu|devGlobeLook|DEFAULT_GLOBE_LOOK/.test(world),
      '[R4/R6] world.ts: the menu always shows the night (one globe, no look switch)');
  }

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

  // [night-82a R6] D-337: one globe, the NASA one: the D-283 print, its `?look=` switch and `GlobeLook` are gone.
  const globeIndex = readFileSync(resolve(ROOT, 'src/render/globe/index.ts'), 'utf8');
  const renderIndex = readFileSync(resolve(ROOT, 'src/render/index.ts'), 'utf8');
  {
    const gone = ['src/render/globe/linoryt.ts', 'src/render/globe/linoryt-globe.ts', 'src/render/globe/look.ts']
      .filter((path) => existsSync(resolve(ROOT, path)));
    check(gone.length === 0, '[R6] the print modules and look.ts are deleted (left: ' + gone.join(', ') + ')');
    const linorytRefs = execGrep('[Ll]inoryt|LINORYT').split('\n').filter((path) => path && !path.startsWith('src/ui/') && !path.startsWith('src/data/puzzles/'));
    check(linorytRefs.length === 0, '[R6] nothing in src/ outside src/ui names the print (got ' + linorytRefs.join(', ') + ')');
    const lookRefs = execGrep('GlobeLook|DEFAULT_GLOBE_LOOK|devGlobeLook');
    check(lookRefs === '', '[R6] no GlobeLook / DEFAULT_GLOBE_LOOK left in src/ (got ' + lookRefs + ')');
    check(!/LINORYT_INKS|SKY_COLOUR/.test(renderIndex) && /STAMP_SIZE_PX, jamArcShare \} from '\.\/marks'/.test(renderIndex),
      '[R6] render index exports STAMP_SIZE_PX and jamArcShare from marks.ts, no print inks or paper sky');
    const worldR6 = readFileSync(resolve(ROOT, 'src/render/world.ts'), 'utf8');
    check(/scene\.background = new Color\(EARTH_LOOK\.space\)/.test(worldR6) && !/DIORAMA_SKY|SKY_COLOUR/.test(worldR6),
      '[R6] the scene starts on the globe\'s space (no paper or blue frame before the globe chunk loads)');
    check(!/createTexturedTerrainMaterial|loadLookAssets|createDecorations|createAtmosphere|opts\.look/.test(globeIndex),
      '[E4/R6] createGlobe builds only the NASA globe (no look switch, texture looks or decorations)');
    const marks = await load('marks.js');
    check(marks.objectScale(320) === 1 && marks.objectScale(1000) === 1 && marks.objectScale(100) === 0.55 && Math.abs(marks.objectScale(240) - 0.75) < 1e-9,
      '[R6] object scale 0.55…1 by disc radius (D-309, was test:hatch-alias)');
    check(marks.STAMP_SIZE_PX.airport === 22 && marks.STAMP_SIZE_PX.hub === 30, '[R6] STAMP_SIZE_PX (the overlay\'s fallback box) = { airport: 22, hub: 30 }');
  }

  // [night-70a R1] D-323: the NASA globe preview: DEV-only lazy chunk, presets, terminator from the game clock.
  {
    const earthGlobe = readFileSync(resolve(ROOT, 'src/render/globe/earth-globe.ts'), 'utf8');
    // [night-79a R4] D-334: no DEV guard any more: the release build carries the chunk, DEFAULT_GLOBE_LOOK selects it.
    check(/const \{ createEarthGlobe \} = await import\('\.\/earth-globe'\)/.test(globeIndex) && !/import\.meta\.env\.DEV/.test(globeIndex),
      '[R1/R4] the earth globe is a dynamic import (its own chunk), in the release build too');
    const staticEarth = execGrep("from '(\\./|\\.\\./)*(globe/)?earth-globe'");
    check(staticEarth === '', '[R1] nothing imports earth-globe statically (got ' + staticEarth + ')');
    check(!/TextureLoader/.test(earthGlobe) && /createImageBitmap\(blob/.test(earthGlobe),
      '[R1] earth textures are decoded off the render thread (createImageBitmap), no TextureLoader');
    check(/awSunDirection: \{ value: opts\.sunDirection \}/.test(earthGlobe),
      '[R1] the terminator follows the shared sun direction (SunLights.direction, moved by the game clock)');
    check(!/gl_FragColor = vec4\([^;]*\+ *glow/i.test(earthGlobe) && /ifdef AW_GLINT/.test(earthGlobe),
      '[R1] glint only behind AW_GLINT (high), no glow term');
    const earth = await load('globe/earth.js');
    const low = earth.earthPreset({ preset: 'low', batterySaver: false });
    const saver = earth.earthPreset({ preset: 'medium', batterySaver: true });
    const medium = earth.earthPreset({ preset: 'medium', batterySaver: false });
    const high = earth.earthPreset({ preset: 'high', batterySaver: false });
    check(low.day === 2048 && low.night === 1024 && !low.glint && !low.shell && JSON.stringify(saver) === JSON.stringify(low),
      '[R1] low/saver: day 2048, night 1024, no glint, no shell');
    check(medium.startDay === 2048 && medium.day === 4096 && medium.night === 2048 && !medium.glint && !medium.shell,
      '[R1] medium: starts 2048/1024, upgrades to 4096/2048, no glint or shell');
    check(high.day === 4096 && high.night === 2048 && high.glint && high.shell, '[R1] high: medium + glint + shell');
    check(earth.earthNightWeight(1) === 0 && earth.earthNightWeight(-1) === 1 && earth.earthNightWeight(0) > 0.1 && earth.earthNightWeight(0) < 0.5,
      '[R1] night lights: none under the sun, full past the terminator, partial on it');
    check(earth.earthDuskWeight(1) === 0 && earth.earthDuskWeight(-1) === 0 && earth.earthDuskWeight(-0.01) > 0.9 && earth.earthDuskWeight(0.2) === 0,
      '[R1] dusk band is narrow (≈ −11° … +9°) and peaks at the terminator');
    check(earth.earthDayLight(-0.5) === 0 && earth.earthDayLight(1) === 1, '[R1] direct light: 0 at night, 1 at noon');
    // [night-81a] D-336 (owner: brighten the land at night): land gets more moonlight than the sea (and a flat floor), so
    // coasts read; the sea keeps the old moonlight; even bright desert stays far under the city lights (gain 1.55).
    {
      const sea = earth.earthMoonlight(0.2, 1), forest = earth.earthMoonlight(0.2, 0), desert = earth.earthMoonlight(0.6, 0);
      check(Math.abs(sea - 0.2 * earth.EARTH_LOOK.moon) < 1e-9 && forest > sea + 0.04 && desert < 0.12 &&
        desert * 4 < earth.EARTH_LOOK.nightGain * 0.42, `[T6/R5] night land lifted above the sea, lights dominant (sea ${sea.toFixed(3)}, forest ${forest.toFixed(3)}, desert ${desert.toFixed(3)})`);
      const shader = readFileSync(resolve(ROOT, 'src/render/globe/earth-globe.ts'), 'utf8');
      check(/\(awMoon \+ awMoonLand \* land\) \+ awMoonLandFloor \* land/.test(shader), '[T6/R5] the shader mirrors earthMoonlight');
    }
    check(/space: '#010306'/.test(readFileSync(resolve(ROOT, 'src/render/globe/earth.ts'), 'utf8')), '[R1] K2 space colour');
    // Terminator from the game clock: the subsolar longitude for three game hours (UTC noon over 0°, 18:00 over 90°W).
    const sunModule = await load('sun.js');
    const subsolar = (tick) => { let got = null; sunModule.createSunController({ setSun(lon, lat) { got = [lon, lat]; } }).update(tick); return got; };
    const [noon, six, midnight] = [720, 1080, 0].map(subsolar);
    check(Math.abs(noon[0]) < 1e-9 && Math.abs(six[0] + 90) < 1e-9 && Math.abs(Math.abs(midnight[0]) - 180) < 1e-9 && noon[1] === -18.5,
      '[R1] sun for 12:00, 18:00, 00:00 game time: 0°, 90°W, 180° at the November declination');
    // A point at 0°N 0°E: noon = day (no lights), 18:00 = on the terminator (dusk), 00:00 = night (lights).
    const sunCos = ([lon, lat]) => { const s = new three.Vector3(); const p = new three.Vector3(0, 0, 1);
      s.set(Math.sin(lon * Math.PI / 180) * Math.cos(lat * Math.PI / 180), Math.sin(lat * Math.PI / 180), Math.cos(lon * Math.PI / 180) * Math.cos(lat * Math.PI / 180));
      return p.dot(s); };
    check(earth.earthNightWeight(sunCos(noon)) === 0 && earth.earthDuskWeight(sunCos(six)) > 0.5 && earth.earthNightWeight(sunCos(midnight)) === 1,
      '[R1] the terminator moves with the game clock (day at 12:00, dusk at 18:00, night at 00:00 over 0°/0°)');
  }
  // [night-72a R2] D-327: country borders (one instanced draw, screen-pixel width, hidden past the horizon, day/night
  // colour) and projectLonLat (same projection and altitude as projectAirport, no allocation).
  {
    const bordersModule = await load('globe/borders.js');
    const data = JSON.parse(readFileSync(resolve(ROOT, 'public/data', bordersModule.BORDERS_FILE), 'utf8'));
    const segments = bordersModule.decodeBorders(data);
    const sun = new three.Vector3(0, 0, 1);
    const layer = bordersModule.createBorderLayer(segments, sun);
    const { mesh } = layer;
    check(mesh.isMesh && mesh.children.length === 0 && !mesh.geometry.isInstancedBufferGeometry && layer.segments === segments.length / 4 &&
      mesh.geometry.index.count === 6 * layer.segments && mesh.geometry.getAttribute('position').count === 4 * layer.segments &&
      mesh.geometry.groups.length === 0, '[R2] borders: one mesh, one quad per segment in one plain (not instanced) batch: one draw call for every border');
    check(mesh.material.transparent && !mesh.material.depthTest && !mesh.material.depthWrite && mesh.renderOrder === 5 &&
      mesh.renderOrder < 10 && mesh.frustumCulled === false, '[R2] borders: translucent, after the globe, before the map objects (renderOrder 5 < 10)');
    const vs = mesh.material.vertexShader;
    check(/float core = max\(awWidth, 1\.0\)/.test(vs) && /\* min\(awWidth, 1\.0\)/.test(vs) &&
      /clamp\(vAwHalf \+ 0\.5 - abs\(vAwAcross\), 0\.0, 1\.0\)/.test(mesh.material.fragmentShader),
      '[R2] borders: width in device px, a hairline is 1 px at lower alpha, coverage anti-aliasing (no sub-pixel dropout)');
    const viewport = mesh.material.uniforms.awViewport.value;
    mesh.onBeforeRender({ getDrawingBufferSize: (v) => v.set(824, 1830), getPixelRatio: () => 2 });
    check(viewport.x === 824 && viewport.y === 1830 && Math.abs(mesh.material.uniforms.awWidth.value - 1.6) < 1e-9,
      '[R2] borders: 0.8 CSS px × pixel ratio, drawing-buffer viewport set before each draw');
    // Horizon: camera at 3 radii on +z. A point is visible while p·c > |p|² (cosine margin > 0), faded in near the limb.
    const h = (x, y, z) => bordersModule.borderHorizon(x, y, z, 0, 0, 3);
    const limbZ = 1 / 3, limbX = Math.sqrt(1 - limbZ * limbZ);
    check(h(0, 0, 1) === 1 && h(0, 0, -1) === 0 && h(1, 0, 0) === 0 && h(limbX, 0, limbZ) === 0 &&
      h(Math.sqrt(1 - 0.36 * 0.36), 0, 0.36) > 0 && h(Math.sqrt(1 - 0.36 * 0.36), 0, 0.36) < 1,
      '[R2] borders: hidden behind the horizon (back side and limb 0, near side 1, a short fade before the limb)');
    check(/\(dot\(p, cameraPosition\) - r2\) \/ \(sqrt\(r2\) \* length\(cameraPosition\)\)/.test(vs) &&
      /if \(awHorizon\(aStart\) <= 0\.0 && awHorizon\(aEnd\) <= 0\.0\) clip = vec4\(2\.0, 2\.0, 2\.0, 1\.0\)/.test(vs),
      '[R2] borders: the shader uses the same horizon margin and collapses a segment wholly past it');
    check(bordersModule.borderDaylight(1) === 1 && bordersModule.borderDaylight(-1) === 0 && bordersModule.borderDaylight(0) === 0.5 &&
      bordersModule.BORDER_STYLE.night === '#C9CED6' && bordersModule.BORDER_STYLE.nightAlpha < bordersModule.BORDER_STYLE.dayAlpha,
      '[R2] borders: cool grey and fainter by night, white by day (mockup .border / .day .border), switched at the terminator');
    layer.dispose();
    const earthGlobeSrc = readFileSync(resolve(ROOT, 'src/render/globe/earth-globe.ts'), 'utf8');
    check((earthGlobeSrc.match(/createBorderLayer\(/g) ?? []).length === 1 && /group\.add\(borders\.mesh\)/.test(earthGlobeSrc) &&
      /borders\?\.dispose\(\)/.test(earthGlobeSrc), '[R2] the earth globe adds the one border layer and disposes it');
    // projectLonLat: the projection behind project/pick/projectAirport/projectLonLat, at the shared anchor altitude.
    const projection = await load('projection.js');
    const { GlobeOrbitCamera: Orbit } = await load('camera.js');
    const cam3 = new three.PerspectiveCamera(30, 1, 0.05, 30);
    const orbit3 = new Orbit(cam3, { zoom: 1, longitude: 25, latitude: 45 });
    orbit3.setViewport(412, 915);
    orbit3.update(0);
    cam3.updateMatrixWorld();
    const out = { x: 0, y: 0, visible: false };
    const scratch = new three.Vector3(), toCam = new three.Vector3();
    const at = (lon, lat) => projection.projectToScreen(cam3, 412, 915, lon, lat, projection.SURFACE_ANCHOR_ALTITUDE, scratch, toCam, { ...out });
    const near = [[21, 52.2], [28.8, 41.3], [31.4, 30.1], [23.9, 37.9]].map(([lon, lat]) => at(lon, lat));
    const far = [[151.2, -33.9], [-118.4, 33.9], [-157.9, 21.3]].map(([lon, lat]) => at(lon, lat));
    check(near.every((p) => p.visible && p.x > 0 && p.x < 412 && p.y > 0 && p.y < 915) && far.every((p) => !p.visible),
      '[R2] projectLonLat: near-side airports on screen and visible, far-side ones behind the horizon');
    const centre = at(25, 45);
    check(Math.abs(centre.x - 206) < 30 && projection.SURFACE_ANCHOR_ALTITUDE === 1.01, '[R2] the camera target projects near the viewport centre; anchors at r = 1.01');
    const worldR2 = readFileSync(resolve(ROOT, 'src/render/world.ts'), 'utf8');
    const lonLatBody = worldR2.slice(worldR2.indexOf('projectLonLat(lon, lat, out) {'), worldR2.indexOf('resize,', worldR2.indexOf('projectLonLat(lon, lat, out) {')));
    const airportBody = worldR2.slice(worldR2.indexOf('world.projectAirport = '), worldR2.indexOf('return world;'));
    check(/return project\(lon, lat, SURFACE_ANCHOR_ALTITUDE, out\)/.test(lonLatBody) &&
      /project\(city\.lon, city\.lat, SURFACE_ANCHOR_ALTITUDE, point\)/.test(airportBody) && !/new |\[\]|=> \(\{/.test(lonLatBody) &&
      /projectToScreen\(camera, orbit\.viewportWidth, orbit\.viewportHeight/.test(worldR2),
      '[R2] projectLonLat = projectAirport\'s projection and altitude for the same lon/lat, writes into out (no allocation)');
    const projSrc = readFileSync(resolve(ROOT, 'src/render/projection.ts'), 'utf8');
    check(!/new |\[\]/.test(projSrc.slice(projSrc.indexOf('export function projectToScreen'))), '[R2] projectToScreen allocates nothing');
  }
  const worldSrcE3 = readFileSync(resolve(ROOT, 'src/render/world.ts'), 'utf8');
  check(!/import\.meta\.env\.DEV/.test(worldSrcE3) && !/createAirports\(|new RouteLayer\(|new PlaneLayer\(|createRoutePreview\(/.test(worldSrcE3),
    '[E4] world renderer draws only the object layers (no medallions, tubes or plane models)');

  // [ext-04 E2] The overlay's airport boxes.
  {
    const worldSrc = readFileSync(resolve(ROOT, 'src/render/world.ts'), 'utf8');
    const body = worldSrc.slice(worldSrc.indexOf('world.projectAirport = '), worldSrc.indexOf('return world;'));
    check(/project\(city\.lon, city\.lat, SURFACE_ANCHOR_ALTITUDE, point\)/.test(body) && /project\(city\.lon, city\.lat, SURFACE_ANCHOR_ALTITUDE, point\)/.test(worldSrc.slice(worldSrc.indexOf('pick(x, y)'))),
      'projectAirport measures the same point as pick() (altitude SURFACE_ANCHOR_ALTITUDE = 1.01)');
    check(!/new |\[\]|=> \(\{/.test(body), 'projectAirport allocates nothing (writes into out)');
  }
  // [night-74a R3] D-329: the NASA-globe object style: shapes, line patterns, red only for a jam, one draw per layer;
  // [night-82a R6] D-337: the only style (the print's shaders are gone), in the objects chunk.
  {
    const objectsR3 = await load('objects.js');
    const earthR3 = await load('objects-earth.js');
    const style = earthR3.earthObjectStyle({ atlasSdf: objectsR3.ATLAS_SDF_GLSL, revealMs: objectsR3.ROUTE_REVEAL_MS });
    const sceneR3 = new three.Scene();
    const made = objectsR3.createObjects(sceneR3, { maxAirports: 8, maxPlanes: 10 }, style);
    check(made.style === 'earth' && objectsR3.createObjects(new three.Scene(), {}).style === 'earth' && !('LINORYT_STYLE' in objectsR3),
      '[R3/R6] createObjects: the earth style, also by default; no print style');
    const { airports: pts, routes: rts, planes: pls, preview: pv } = made;
    pts.addAirport({ id: 'BEG', lon: 20.5, lat: 44.8 });
    pts.addAirport({ id: 'AMM', lon: 35.9, lat: 31.9, hub: true });
    pts.update();
    const [jamR3, pointR3] = pts.group.children;
    check(pointR3.geometry.instanceCount === 2 && pts.group.children.length === 2, '[R3] points + jam zone: two instanced draws');
    check(pts.halfSize('BEG') === 6.5 && pts.halfSize('AMM') === 13.6, '[R3] point half size 6.5 px (dot), 13.6 px (hub ring)');
    const pf = pointR3.material.fragmentShader;
    check(/lightPart = cover\(r - 11\.4, aa\) \* \(1\.0 - cover\(r - 9\.0, aa\)\)/.test(pf) && /outer = cover\(r - 6\.5, aa\)/.test(pf),
      '[R3] point: dot with a dark outline; hub = a light ring around a dark core (shape, not colour)');
    check(/sdBox\(vPx, vec2\(4\.2, 1\.2\)\)/.test(pf) && /sdBox\(vPx, vec2\(6\.4, 1\.5\)\)/.test(pf),
      '[R3] curfew: a barrier bar across the point and across the hub core (a shape)');
    check(/vec3 light = jam \? vec3\(1\.0\) : uPaper;/.test(pf) && /vec3 dark = jam \? uRed : uInk;/.test(pf) &&
      (pf.match(/uRed/g) ?? []).length === 2, '[R3] point red only when jammed');
    pts.setJam('AMM', 0.47); pts.update();
    const jamArr = jamR3.geometry.getAttribute('aJam').array;
    check(jamR3.visible && Math.abs(jamArr[0] - 21.1) < 1e-6 && Math.abs(jamArr[1] - 0.47) < 1e-6,
      '[R3] jam ring at r = 21.1 px around a hub (mockup 21), arc = share left');
    const jf = jamR3.material.fragmentShader;
    check(/atan\(vPx\.x, vPx\.y\)/.test(jf) && /vJam\.y \* 6\.2831853/.test(jf) && /mix\(mix\(uInk, uPaper, rim\), uRed, red\)/.test(jf),
      '[R3] jam: countdown arc (12 o\'clock, clockwise) on a light rim in a dark edge around the red-ringed point');
    rts.setRoutes([{ id: 'w', type: 'widebody', waypoints: [{ lon: 23.7, lat: 38 }, { lon: 35.9, lat: 31.9 }] },
      { id: 't', type: 'turboprop', waypoints: [{ lon: 20.5, lat: 44.8 }, { lon: 23.7, lat: 38 }] }], 1);
    const ribR3 = rts.group.children[0];
    const wR3 = ribR3.geometry.getAttribute('aWidth').array;
    const pairsR3 = new Set(); for (let i = 0; i < wR3.length; i += 2) pairsR3.add(wR3[i] + '/' + wR3[i + 1]);
    check(rts.stats.drawCalls === 1 && pairsR3.has('3.5/' + Math.fround(1.6)) && pairsR3.has('3/' + Math.fround(-1.6)),
      '[R3] routes: one ribbon draw; casing 7 / 6 px, core 3.2 px (negative = the dashed turboprop core)');
    const rf = ribR3.material.fragmentShader;
    check(/if \(vWidth\.y < 0\.0\)/.test(rf) && /mod\(along, 12\.0\)/.test(rf) && /mix\(uInk, uPaper, core\)/.test(rf) && !/uRed/.test(rf),
      '[R3] routes: dark casing, light core, widebody solid, turboprop dashed 7/5 px; no red');
    check(/mix\(uInk, uSign, core\)/.test(rf) && /length\(vec2\(mod\(along, 8\.0\) - 4\.0, px\)\)/.test(rf),
      '[R3] route being drawn: yellow grease pencil in a dark casing, round dots past the range');
    pv.update({ points: [{ lon: 32.9, lat: 39.9 }, { lon: 35.9, lat: 31.9 }], legDistancesKm: [973], rangeKm: 560, aircraft: 'turboprop' });
    const pvMesh = pv.object.children[0];
    const pvW = pvMesh.geometry.getAttribute('aWidth').array;
    check(pvMesh.visible && pvW[0] === 3.25 && pvW[1] === Math.fround(1.7) && pvMesh.material.uniforms.uDash.value === 1,
      '[R3] route being drawn: 6.5 px casing, 3.4 px yellow core');
    const plf = pls.material.fragmentShader;
    check(/31\.0/.test(plf) && /38\.0/.test(plf) && /awPlaneSdf/.test(plf) && /uShadow/.test(plf) && !/uRed|E8382E|3FD07A/i.test(plf) && !/barY/.test(plf),
      '[R3] planes: 31 / 38 px silhouettes from the shared atlas, dark outline, shadow, no navigation lights, no load bar');
    pls.setDaylight(1);
    const dayShadow = pls.uniforms.uShadow.value;
    pls.setDaylight(0);
    check(Math.abs(dayShadow - 0.38) < 1e-9 && pls.uniforms.uShadow.value < dayShadow && pls.uniforms.uShadow.value > 0,
      '[R3] plane shadow 0.38 by day, fainter by night');
    const objSrc = readFileSync(resolve(ROOT, 'src/render/objects.ts'), 'utf8');
    check(/import \{ EARTH_OBJECT_INKS, earthObjectStyle \} from '\.\/objects-earth'/.test(objSrc) && !/opts\.look/.test(objSrc),
      '[R6] objects.ts takes the earth style statically (one chunk with the layers), no look switch');
    const objEarthUsers = execGrep("from '(\\./|\\.\\./)*objects-earth'");
    check(objEarthUsers === 'src/render/objects.ts', '[R6] only objects.ts imports objects-earth (got ' + objEarthUsers + ')');
    const objectsUsers = execGrep("import\\('\\./objects'\\)|^import [^t].* from '(\\./|\\.\\./)*objects'"); // type imports aside
    check(objectsUsers === 'src/render/world.ts', '[R6] objects.ts is reached only through world.ts (got ' + objectsUsers + ')');
    pts.dispose(); rts.dispose(); pls.dispose(); pv.dispose();
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
