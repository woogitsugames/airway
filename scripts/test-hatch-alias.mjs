// [ext-04 E1] D-283/D-298: the Linoryt hatch never reaches the screen under the alias floor (spec §9).
// Headless: the octave rules of src/render/globe/linoryt.ts (mirrored by `awHatch` in the shader) checked for every
// preset DPR, zoom 1…4 in 0.25 steps, both orientations, foreshortening toward the limb and the three line families.
// Draft by the self-hosted Qwen (Free.AI MCP trial), fixed and tightened by hand.
const {
  hatchOctaves, hatchWidthPx, HATCH_MIN_SPACING_PX, HATCH_SAVER_MIN_SPACING_PX, HATCH_ALIAS_FLOOR_DEVICE_PX,
  HATCH_MIN_WIDTH_DEVICE_PX, HATCH_BASE_PERIOD_DEG, seaLineWidthCss, nightLineWidthCss, reliefLineWidthCss,
  nightCoverage, waterLineScale, reliefMinSpacingCss, WATER_LINES_PX, WATER_LINES_MAX_DEG, COAST_FIELD_RANGE_DEG,
} = await import('../src/render/globe/linoryt.ts');
const { GlobeOrbitCamera } = await import('../src/render/camera.ts');
const { PerspectiveCamera } = await import('three');

let passed = 0, failed = 0;
const failures = [];
const check = (label, condition) => { if (condition) passed++; else { failed++; if (failures.length < 20) failures.push(label); } };
const EPS = 1e-9;
let minFine = Infinity, cases = 0;

// 1. Octaves on real camera geometry.
for (const [w, h] of [[412, 915], [915, 412]]) {
  const orbit = new GlobeOrbitCamera(new PerspectiveCamera(30, 1, 0.05, 30), { longitude: 0, latitude: 0, zoom: 1 });
  orbit.setViewport(w, h);
  for (let zoom = 1; zoom <= 4 + EPS; zoom += 0.25) {
    orbit.setZoom(zoom);
    const disc = orbit.getScreenDisc();
    check(`disc ${w}x${h} z${zoom}`, !!disc);
    if (!disc) continue;
    for (const dpr of [1, 1.5, 2]) {
      const pxPerDeg = disc.radius * dpr * Math.PI / 180;
      // foreshortening toward the limb × family scale: parallels, ±45° rhumb at the equator and at 50° N
      for (const f of [1, 0.7, 0.4, 0.2, 0.05]) for (const c of [1, Math.SQRT1_2, Math.SQRT1_2 * Math.cos(50 * Math.PI / 180)]) {
        for (const min of [HATCH_MIN_SPACING_PX, HATCH_SAVER_MIN_SPACING_PX, reliefMinSpacingCss(dpr)]) { // D-307: relief on the device grid
          const basePx = HATCH_BASE_PERIOD_DEG * pxPerDeg * f * c;
          const o = hatchOctaves(basePx, dpr, min);
          const at = `${w}x${h} z${zoom} dpr${dpr} f${f} c${c.toFixed(2)} min${min}`;
          cases++;
          check(`weights sum to 1 ${at}`, Math.abs(o.fineWeight + o.coarseWeight - 1) < EPS);
          check(`fine weight in [0,1] ${at}`, o.fineWeight >= 0 && o.fineWeight <= 1);
          check(`periods close on 360° ${at}`, Number.isInteger(360 / o.fineDeg) && Number.isInteger(360 / o.coarseDeg));
          // Lines that print (visibility > 0) are never under the floor; a fine octave with weight is ≥ min spacing.
          check(`coarse ≥ floor when visible ${at}`, o.lineVisibility === 0 || o.coarsePx >= HATCH_ALIAS_FLOOR_DEVICE_PX);
          if (o.fineWeight > 0) check(`fine ≥ min spacing ${at}`, o.finePx >= min * dpr - EPS);
          if (basePx >= 2 * min * dpr) check(`fine in [min, 2·min) ${at}`, o.finePx >= min * dpr - EPS && o.finePx < 2 * min * dpr + EPS);
          if (o.lineVisibility > 0) minFine = Math.min(minFine, o.fineWeight > 0 ? o.finePx : o.coarsePx);
        }
      }
    }
  }
}

// 2. The cross-fade is continuous: the printed density never jumps when the zoom crosses an octave.
for (const dpr of [1, 1.5, 2]) {
  let previous = null;
  for (let basePx = 10; basePx < 4000; basePx *= 1.001) {
    const o = hatchOctaves(basePx, dpr);
    const density = o.fineWeight / o.finePx + o.coarseWeight / o.coarsePx;
    if (previous !== null) check(`density continuous dpr${dpr} at ${basePx.toFixed(1)}px`, Math.abs(density - previous) / previous < 0.02);
    previous = density;
  }
}

// 3. No line thinner than 1.5 device px.
for (let i = 0; i <= 20; i++) {
  const x = i / 20;
  for (const dpr of [1, 1.5, 2]) {
    for (const [name, width] of [['sea', seaLineWidthCss(x)], ['night', nightLineWidthCss(x)], ['relief', reliefLineWidthCss(x)]]) {
      check(`${name} width ≥ floor x${x} dpr${dpr}`, hatchWidthPx(width, dpr) >= HATCH_MIN_WIDTH_DEVICE_PX);
    }
  }
}

// 4. Night density: none by day, monotonic past the terminator, full at −12°.
let last = Infinity;
for (let i = -100; i <= 100; i++) {
  const s = i / 100, coverage = nightCoverage(s);
  check(`night monotonic at sin ${s}`, coverage <= last + EPS);
  if (s >= 0) check(`no night by day at sin ${s}`, coverage === 0);
  last = coverage;
}
check('night full at −12°', Math.abs(nightCoverage(Math.sin(-12 * Math.PI / 180)) - 1) < EPS);
check('night full below −12°', nightCoverage(-0.5) === 1);

// 5. Water lines stay inside the coast field (±3°).
for (let p = 1; p <= 40; p += 0.5) {
  const last = waterLineScale(p) * WATER_LINES_PX[WATER_LINES_PX.length - 1];
  check(`water lines inside the field at ${p} px/°`, last <= WATER_LINES_MAX_DEG + EPS && last < COAST_FIELD_RANGE_DEG);
}

for (const line of failures) console.error('FAIL ' + line);
console.log(`SUMMARY test:hatch-alias cases=${cases} minPrintedPeriodPx=${minFine.toFixed(2)} checks=${passed + failed} ` +
  `passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
