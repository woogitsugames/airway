// [task-33] Hand-entered relief: real mountain ranges, desert regions and ice, sampled as smooth
// fields so terrain, biomes and decorations agree. Coordinates are rounded public-domain
// geography (ridge lines traced by hand from general knowledge), not copied map data.

/** Ridge polyline: [lon, lat] points, relative peak height 0..1, half-width in degrees. */
interface Range { readonly peak: number; readonly width: number; readonly line: readonly (readonly [number, number])[] }

const RANGES: readonly Range[] = [
  // Europe
  { peak: .55, width: 1.1, line: [[5.8, 44.2], [7, 45.8], [8.5, 46.4], [10.5, 46.6], [12.5, 47], [15, 47.3]] }, // Alps
  { peak: .4, width: .7, line: [[-1.8, 43], [.5, 42.7], [2.8, 42.5]] }, // Pyrenees
  { peak: .22, width: .8, line: [[-8, 42.8], [-5, 43], [-3, 43.1]] }, // Cantabrian
  { peak: .25, width: .7, line: [[-5, 37.2], [-3, 37.1]] }, // Sierra Nevada (ES)
  { peak: .42, width: 1.6, line: [[6, 58.8], [7.5, 61], [9, 62.5], [12.5, 64.5], [15, 67], [18, 68.8], [21, 69.8]] }, // Scandes
  { peak: .3, width: .9, line: [[18, 49.3], [21, 49.3], [24, 48], [26, 46.5], [25, 45.5], [22.5, 45.3]] }, // Carpathians
  { peak: .25, width: 1, line: [[15, 45], [18, 43.5], [20, 42], [22, 40]] }, // Dinaric / Pindus
  { peak: .22, width: .7, line: [[8.5, 44.3], [11, 44], [13.5, 42], [15.8, 40.5], [16, 38.5]] }, // Apennines
  { peak: .5, width: .9, line: [[38, 44], [42, 43.2], [45, 42.4], [48.5, 41.2]] }, // Caucasus
  { peak: .3, width: 1.2, line: [[30, 37], [33, 36.8], [36, 37.5], [40, 38.5], [43, 39.5]] }, // Taurus / Anatolia
  { peak: .18, width: .9, line: [[59, 51], [59, 55], [59.5, 60], [60, 64], [63, 67.5], [66, 68.5]] }, // Urals
  // Africa
  { peak: .45, width: 1.3, line: [[-9.5, 30.6], [-6.5, 31.8], [-4, 33], [0, 34.2], [3.5, 35.5], [8, 35.6]] }, // Atlas
  { peak: .42, width: 2, line: [[37, 14], [38.5, 11], [39, 9], [38, 7]] }, // Ethiopian Highlands
  { peak: .45, width: .7, line: [[36.8, -.2], [37.3, -3.1]] }, // Kenya / Kilimanjaro
  { peak: .3, width: 1, line: [[27, -31], [29.2, -29.5], [30.5, -27]] }, // Drakensberg
  { peak: .2, width: 1, line: [[48.5, -13.5], [47, -19], [46.5, -24]] }, // Madagascar
  // Asia
  { peak: .38, width: 1.5, line: [[44, 37], [47, 34], [51, 30.5], [56, 27.5]] }, // Zagros
  { peak: .42, width: 1.1, line: [[48.5, 37], [52, 36], [56, 37], [62, 35], [67, 35], [71, 36]] }, // Elburz / Hindu Kush
  { peak: .8, width: 1.5, line: [[71, 38.5], [73.5, 37], [76, 36], [78, 35]] }, // Pamir / Karakoram
  { peak: 1, width: 1.5, line: [[73.5, 35], [76, 33.5], [79, 31], [82, 29.8], [84, 28.5], [87, 27.9], [90, 28], [92, 27.8], [95, 28.8]] }, // Himalaya
  { peak: .52, width: 4, line: [[80, 33], [86, 32.5], [92, 32.5], [98, 33]] }, // Tibetan Plateau
  { peak: .6, width: 1.2, line: [[78, 36], [84, 35.8], [90, 36], [96, 35.5]] }, // Kunlun
  { peak: .55, width: 1.4, line: [[69, 42], [75, 41.5], [80, 42], [86, 43], [90, 43.5]] }, // Tian Shan
  { peak: .38, width: 1.3, line: [[85, 50], [88, 49.5], [91, 48.5], [95, 47], [99, 46]] }, // Altai
  { peak: .45, width: 1.3, line: [[98, 33], [99, 28], [100, 25]] }, // Hengduan
  { peak: .3, width: 2, line: [[128, 61], [132, 66], [140, 67], [150, 66]] }, // Verkhoyansk / Chersky
  { peak: .35, width: .8, line: [[156, 51.5], [158.5, 54], [160, 56.5], [161, 58]] }, // Kamchatka
  { peak: .3, width: .7, line: [[130.5, 32], [133, 34.5], [136, 35.5], [138, 36], [140, 38.5], [141, 40.5], [143, 43.5]] }, // Japan
  { peak: .28, width: .8, line: [[101, 19], [99, 16], [98.5, 12]] }, // Indochina hills
  { peak: .4, width: 1, line: [[134, -3.5], [138, -4], [141, -5], [144, -6], [147, -8]] }, // New Guinea
  { peak: .22, width: 1.2, line: [[73.5, 18], [74.5, 14], [76.5, 10]] }, // Western Ghats
  // Oceania
  { peak: .2, width: 1.2, line: [[145.5, -17], [147, -22], [150.5, -28], [150, -33], [148.5, -36.5], [146, -37.5]] }, // Great Dividing Range
  { peak: .4, width: .6, line: [[167, -46], [169.5, -44], [172, -42.3]] }, // Southern Alps
  // Americas
  { peak: .85, width: 1.5, line: [[-75, 10], [-74, 7], [-76.5, 3], [-78.5, -1], [-77, -9], [-73, -14], [-69, -17], [-68, -22],
    [-68.5, -27], [-70, -32], [-70.5, -36], [-71.3, -41], [-72.5, -46], [-73.3, -50], [-72, -53]] }, // Andes
  { peak: .6, width: 2.2, line: [[-69.5, -15], [-67.5, -20], [-67, -23]] }, // Altiplano
  { peak: .5, width: 2, line: [[-120, 61], [-124, 57], [-118, 52], [-115, 48], [-111, 45], [-108, 42], [-106, 39], [-106, 35]] }, // Rockies
  { peak: .32, width: .7, line: [[-122, 49], [-121.7, 46], [-122, 42.5]] }, // Cascades
  { peak: .4, width: .8, line: [[-120.5, 40], [-118.5, 36.5]] }, // Sierra Nevada (US)
  { peak: .6, width: 1.2, line: [[-153, 61], [-150, 63], [-145, 63], [-141, 61.5], [-137, 60]] }, // Alaska Range
  { peak: .35, width: 1.3, line: [[-108, 29], [-105, 24], [-103, 20]] }, // Sierra Madre Occidental
  { peak: .3, width: 1, line: [[-101, 26], [-99, 22], [-97, 19]] }, // Sierra Madre Oriental
  { peak: .18, width: 1.3, line: [[-84.5, 34.5], [-82, 36], [-79.5, 38], [-77, 40.5], [-74, 42.5], [-71.5, 44.3], [-69, 45.5]] }, // Appalachians
  { peak: .15, width: 2, line: [[-46, -19], [-43, -21.5]] }, // Brazilian Highlands
  // Ice domes
  { peak: .42, width: 6, line: [[-42, 64], [-40, 72], [-40, 78]] }, // Greenland ice sheet
];

/**
 * Desert / dry steppe regions: centre lon/lat, radii in degrees, dryness 0..1, superellipse
 * exponent (2 = ellipse, 4 = rounded box for the wide Sahara band).
 */
const DESERTS: readonly (readonly [number, number, number, number, number, number])[] = [
  [8, 23, 28, 11, 1, 4], // Sahara
  [46, 23, 10, 8, 1, 2], [56, 30, 8, 4, .8, 2], [71, 27, 4, 3, .8, 2], // Arabia, Iran, Thar
  [83, 39, 8, 3, .9, 2], [103, 42.5, 12, 4, .85, 2], [62, 44, 10, 4, .55, 2], // Taklamakan, Gobi, Kazakh steppe
  [128, -25, 15, 8, .9, 3], [18, -24, 6, 5, .75, 2], [15, -22, 2, 6, .9, 2], // Australia, Kalahari, Namib
  [-70, -24, 2.5, 6, .9, 2], [-68, -44, 3, 6, .5, 2], [-113, 34, 6, 5, .75, 2], [-105, 29, 4, 4, .6, 2], // Atacama, Patagonia, US SW
  [45, 6, 6, 5, .6, 2], // Horn of Africa
];

const SEGMENTS: { ax: number; ay: number; bx: number; by: number; peak: number; width: number }[] = [];
const BOXES: { minLon: number; maxLon: number; minLat: number; maxLat: number; first: number; last: number }[] = [];
for (const range of RANGES) {
  const first = SEGMENTS.length;
  let minLon = 999, maxLon = -999, minLat = 999, maxLat = -999;
  for (let i = 0; i < range.line.length; i++) {
    const [lon, lat] = range.line[i];
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    const [blon, blat] = range.line[Math.min(range.line.length - 1, i + 1)];
    if (i + 1 < range.line.length || range.line.length === 1) {
      SEGMENTS.push({ ax: lon, ay: lat, bx: blon, by: blat, peak: range.peak, width: range.width });
    }
  }
  const pad = range.width;
  BOXES.push({ minLon: minLon - pad / Math.max(.2, Math.cos((Math.abs(maxLat) + pad) * Math.PI / 180)) - .5,
    maxLon: maxLon + pad / Math.max(.2, Math.cos((Math.abs(maxLat) + pad) * Math.PI / 180)) + .5,
    minLat: minLat - pad, maxLat: maxLat + pad, first, last: SEGMENTS.length });
}

/**
 * Smoothed relative mountain elevation 0..1 at a point: the highest range bump wins, so
 * ranges overlap without stacking. Lon/lat in degrees; lon in [-180, 180].
 */
export function mountainAt(lon: number, lat: number): number {
  let best = 0;
  const k = Math.cos(lat * Math.PI / 180);
  for (const box of BOXES) {
    if (lat < box.minLat || lat > box.maxLat || lon < box.minLon || lon > box.maxLon) continue;
    for (let s = box.first; s < box.last; s++) {
      const g = SEGMENTS[s];
      const ax = g.ax * k, bx = g.bx * k, px = lon * k;
      const dx = bx - ax, dy = g.by - g.ay;
      const len = dx * dx + dy * dy;
      const t = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (lat - g.ay) * dy) / len)) : 0;
      const ex = px - (ax + dx * t), ey = lat - (g.ay + dy * t);
      const q = (ex * ex + ey * ey) / (g.width * g.width);
      if (q >= 1) continue;
      const bump = (1 - q) * (1 - q) * g.peak;
      if (bump > best) best = bump;
    }
  }
  return best;
}

const DESERT_FLAT = Float64Array.from(DESERTS.flat());

/** Dryness 0..1 (1 = sand sea). `jitter` (0..1 noise) frays the region edges. */
export function drynessAt(lon: number, lat: number, jitter: number): number {
  let best = 0;
  const fray = (jitter - .5) * .4;
  for (let i = 0; i < DESERT_FLAT.length; i += 6) {
    const dx = Math.abs(lon - DESERT_FLAT[i]) / DESERT_FLAT[i + 2];
    if (dx > 1.25) continue;
    const dy = Math.abs(lat - DESERT_FLAT[i + 1]) / DESERT_FLAT[i + 3];
    if (dy > 1.25) continue;
    const power = DESERT_FLAT[i + 5];
    const r = (power === 2 ? Math.sqrt(dx * dx + dy * dy) : (dx ** power + dy ** power) ** (1 / power)) + fray;
    if (r >= 1) continue;
    const w = r < .5 ? 1 : 1 - (r - .5) / .5;
    const v = w * w * (3 - 2 * w) * DESERT_FLAT[i + 4];
    if (v > best) best = v;
  }
  return best;
}
