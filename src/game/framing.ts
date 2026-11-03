// [night-07z] Which airports the opening camera frames (new run and Continue). The spherical mean of every open
// airport is right for a compact network, but once airports open on several continents the mean can fall in an
// empty ocean (found in a long play-through: Continue at week 3 showed only the Pacific, every airport an edge
// arrow, and the "+2 slots" pick had nothing to tap). Then the densest cluster is framed instead.
export interface FramePoint { readonly lon: number; readonly lat: number; readonly hub?: boolean }

const DEG = Math.PI / 180;
/** Angular radius (degrees) that the zoomed-in opening view shows around its centre on a phone. */
export const FRAME_RADIUS_DEG = 30;

function unit(point: FramePoint): [number, number, number] {
  const lat = point.lat * DEG;
  const lon = point.lon * DEG;
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
}

function angle(a: readonly number[], b: readonly number[]): number {
  return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / DEG;
}

/**
 * The points to pass to `fitNetwork`: all of them when every one lies within `radius` of their spherical mean
 * (unchanged framing), else the airports within `radius` of the airport whose neighbourhood holds the most
 * (hubs count double; ties keep the earlier airport, so the choice is deterministic).
 */
export function framingPoints<T extends FramePoint>(points: readonly T[], radius = FRAME_RADIUS_DEG): T[] {
  const valid = points.filter((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat));
  if (valid.length < 2) return [...valid];
  const units = valid.map(unit);
  const sum = units.reduce((acc, u) => [acc[0] + u[0], acc[1] + u[1], acc[2] + u[2]], [0, 0, 0]);
  const length = Math.hypot(sum[0], sum[1], sum[2]);
  if (length > 1e-6) {
    const mean = sum.map((value) => value / length);
    if (units.every((u) => angle(u, mean) <= radius)) return [...valid];
  }
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < units.length; i++) {
    let score = 0;
    for (let j = 0; j < units.length; j++) if (angle(units[i], units[j]) <= radius) score += valid[j].hub ? 2 : 1;
    if (score > bestScore) { best = i; bestScore = score; }
  }
  return valid.filter((_, j) => angle(units[best], units[j]) <= radius);
}
