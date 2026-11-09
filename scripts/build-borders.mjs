// [night-72a R2] D-327: country borders for the NASA globe (the NASA globe), from Natural Earth 1:50m admin-0 via
// world-atlas (ISC; data public domain). Land borders only: the TopoJSON mesh of arcs shared by two different
// countries (coasts are not drawn; the photo shows them). Douglas–Peucker at 0.02° (~2 km, below one screen pixel at
// the closest game zoom), quantised to 0.01° and delta-encoded per line, so the file stays ~50 kB.
// Three lines are left out on purpose (D-327): the Crimean isthmus (world-atlas 2.0.2 assigns Crimea to Russia), and
// the lines that cut off Northern Cyprus and Somaliland (entities no UN member but one recognises). The game makes no
// border claims; the owner can revisit the list.
//   node scripts/build-borders.mjs          -> write public/data/borders-50m.json
//   node scripts/build-borders.mjs --check  -> fail when the committed file is stale (test:borders)
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { mesh } = require('topojson-client');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = require.resolve('world-atlas/countries-50m.json');
export const BORDERS_DEST = resolve(ROOT, 'public/data/borders-50m.json');
export const BORDERS_FORMAT = 'airway-borders-v1';
/** Quantisation: integer hundredths of a degree. */
export const BORDERS_SCALE = 100;
const TOLERANCE_DEG = 0.02;
/** Pairs whose shared line is not drawn (see the header). */
const DROPPED_PAIRS = [['N. Cyprus', 'Cyprus'], ['Somaliland', 'Somalia']];
/** The Russia–Ukraine line inside this box is the Crimean isthmus (lon/lat). */
const CRIMEA = { west: 32.4, east: 36.7, south: 44.3, north: 46.3 };

const inCrimeaBox = (lon, lat) => lon >= CRIMEA.west && lon <= CRIMEA.east && lat >= CRIMEA.south && lat <= CRIMEA.north;

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy) || 1e-12;
    let worst = 0, index = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((points[i][0] - ax) * dy - (points[i][1] - ay) * dx) / length;
      if (d > worst) { worst = d; index = i; }
    }
    if (worst > tolerance) { keep[index] = 1; stack.push([a, index], [index, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

export function buildBorders(topo) {
  const name = (g) => g.properties?.name ?? '';
  const pair = (a, b, p, q) => (name(a) === p && name(b) === q) || (name(a) === q && name(b) === p);
  const dropped = (a, b) => DROPPED_PAIRS.some(([p, q]) => pair(a, b, p, q));
  const russiaUkraine = (a, b) => pair(a, b, 'Russia', 'Ukraine');
  const all = mesh(topo, topo.objects.countries, (a, b) => a !== b && !dropped(a, b) && !russiaUkraine(a, b)).coordinates;
  const inCrimea = ([lon, lat]) => lon >= CRIMEA.west && lon <= CRIMEA.east && lat >= CRIMEA.south && lat <= CRIMEA.north;
  const ruUa = mesh(topo, topo.objects.countries, (a, b) => russiaUkraine(a, b)).coordinates;
  const kept = ruUa.filter((line) => !line.every(inCrimea));
  const lines = [];
  let points = 0;
  for (const line of [...all, ...kept]) {
    const simple = simplify(line, TOLERANCE_DEG);
    const encoded = [];
    let px = 0, py = 0;
    for (const [lon, lat] of simple) {
      const qx = Math.round(lon * BORDERS_SCALE), qy = Math.round(lat * BORDERS_SCALE);
      if (encoded.length && qx === px && qy === py) continue;
      encoded.push(qx - px, qy - py);
      px = qx; py = qy;
    }
    if (encoded.length >= 4) { lines.push(encoded); points += encoded.length / 2; }
  }
  return {
    data: {
      format: BORDERS_FORMAT,
      source: 'Natural Earth 1:50m admin-0 countries via world-atlas 2.0.2 (countries-50m.json); public domain',
      scale: BORDERS_SCALE, lines,
    },
    stats: { lines: lines.length, points, droppedCrimea: ruUa.length - kept.length },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { data, stats } = buildBorders(JSON.parse(readFileSync(SOURCE, 'utf8')));
    const contents = JSON.stringify(data) + '\n';
    const check = process.argv.includes('--check');
    let failed = 0;
    if (check) {
      if (readFileSync(BORDERS_DEST, 'utf8') !== contents) { failed++; console.error('FAIL public/data/borders-50m.json is stale (npm run build:borders)'); }
      if (stats.droppedCrimea !== 1) { failed++; console.error('FAIL expected exactly one Crimean isthmus line, got ' + stats.droppedCrimea); }
      // [night-85a] D-340 (provisional, owner may change): no border vertex anywhere across the Perekop isthmus / Crimea box.
      const inBox = data.lines.some((line) => {
        let x = 0, y = 0;
        for (let k = 0; k < line.length; k += 2) {
          x += line[k]; y += line[k + 1];
          if (inCrimeaBox(x / BORDERS_SCALE, y / BORDERS_SCALE)) return true;
        }
        return false;
      });
      if (inBox) { failed++; console.error('FAIL a border line crosses the Perekop isthmus (D-340)'); }
      if (Buffer.byteLength(contents) > 60_000) { failed++; console.error('FAIL borders file over 60 kB'); }
    } else {
      mkdirSync(dirname(BORDERS_DEST), { recursive: true });
      writeFileSync(BORDERS_DEST, contents, 'utf8');
    }
    console.log(`SUMMARY build-borders lines=${stats.lines} points=${stats.points} bytes=${Buffer.byteLength(contents)} ` +
      `checked=${check ? 1 : 0} failed=${failed}`);
    if (failed) process.exitCode = 1;
  } catch (error) {
    console.error(error);
    console.log('SUMMARY build-borders failed=1');
    process.exitCode = 1;
  }
}
