// Raster data is built once from Natural Earth 50m by scripts/build-land.mjs.
// At runtime only a compact RLE texture is decoded; no TopoJSON or polygon rasterization.
import { normalizeLon } from './geo-math';

interface LandRle {
  readonly format: 'airway-land-rle-v1';
  readonly width: number;
  readonly height: number;
  readonly rows: readonly (readonly number[])[];
}

export interface LandMask {
  readonly width: number;
  readonly height: number;
  isLand(lon: number, lat: number): boolean;
  /** 0 (open sea) .. 0.5 (coastline) .. 1 (inland), linear over ±1 degree. */
  coastAt(lon: number, lat: number): number;
  /** [task-33] Smooth signed distance to the coast in degrees of arc (+ land, - sea; raster metric, so
   * east-west distances are stretched toward the poles), clamped to ±MAX_DISTANCE_DEG. */
  distanceAt(lon: number, lat: number): number;
}

/** Distances beyond this (degrees) are clamped; enough for shelf colours and refinement bands. */
export const MAX_DISTANCE_DEG = 8;

/**
 * Two-pass 3-4 chamfer from the pixels that touch the other class, run twice so the
 * antimeridian wrap propagates. Result in pixels, signed, with the zero level on pixel edges.
 */
function signedDistance(mask: Uint8Array, width: number, height: number): Float32Array {
  const n = mask.length, maxPx = MAX_DISTANCE_DEG * width / 360;
  const dist = new Float32Array(n).fill(maxPx * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x, v = mask[i];
      const l = mask[y * width + (x + width - 1) % width], r = mask[y * width + (x + 1) % width];
      const u = y > 0 ? mask[i - width] : v, d = y < height - 1 ? mask[i + width] : v;
      if (l !== v || r !== v || u !== v || d !== v) dist[i] = 1.5; // half a pixel, in chamfer units of 3
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x, xl = (x + width - 1) % width, xr = (x + 1) % width;
        let best = dist[i];
        const left = dist[y * width + xl] + 3;
        if (left < best) best = left;
        if (y > 0) {
          const row = (y - 1) * width;
          const a = dist[row + x] + 3, b = dist[row + xl] + 4, c = dist[row + xr] + 4;
          if (a < best) best = a;
          if (b < best) best = b;
          if (c < best) best = c;
        }
        dist[i] = best;
      }
    }
    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        const i = y * width + x, xl = (x + width - 1) % width, xr = (x + 1) % width;
        let best = dist[i];
        const right = dist[y * width + xr] + 3;
        if (right < best) best = right;
        if (y < height - 1) {
          const row = (y + 1) * width;
          const a = dist[row + x] + 3, b = dist[row + xl] + 4, c = dist[row + xr] + 4;
          if (a < best) best = a;
          if (b < best) best = b;
          if (c < best) best = c;
        }
        dist[i] = best;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const px = Math.min(maxPx, dist[i] / 3);
    dist[i] = mask[i] ? px : -px;
  }
  return dist;
}

export function decodeLandMask(data: unknown): LandMask {
  if (typeof data !== 'object' || data === null) throw new Error('Invalid land raster');
  const obj = data as Partial<LandRle>;
  const width = obj.width, height = obj.height;
  if (obj.format !== 'airway-land-rle-v1' || !Number.isInteger(width) ||
      !Number.isInteger(height) || width === undefined || height === undefined ||
      width < 64 || height < 32 || width > 8192 || height > 4096 ||
      !Array.isArray(obj.rows) || obj.rows.length !== height) {
    throw new Error('Unsupported or corrupt land raster');
  }
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = obj.rows[y];
    if (!Array.isArray(row) || (row.length % 2) !== 0) throw new Error('Corrupt land row ' + y);
    let previous = 0;
    for (let i = 0; i < row.length; i += 2) {
      const start = row[i], end = row[i + 1];
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < previous || end <= start || end > width) {
        throw new Error('Invalid land run at row ' + y);
      }
      mask.fill(1, y * width + start, y * width + end);
      previous = end;
    }
  }
  // [task-33] Signed distance to the coastline (chamfer 3-4 on the raster, clamped). Bilinear
  // sampling of this field gives a smooth sub-pixel coast for vertex snapping, shelf depth and
  // refinement bands, instead of the stair-stepped raster edge.
  const sdf = signedDistance(mask, width, height);
  const pixelDeg = 360 / width;
  const offset = (lon: number, lat: number): number => {
    const x = Math.floor((normalizeLon(lon) + 180) / 360 * width) % width;
    const y = Math.max(0, Math.min(height - 1, Math.floor((90 - Math.max(-90, Math.min(90, lat))) / 180 * height)));
    return y * width + x;
  };
  const distanceAt = (lon: number, lat: number): number => {
    const fx = (normalizeLon(lon) + 180) / 360 * width - .5;
    const fy = Math.max(0, Math.min(height - 1.001, (90 - Math.max(-90, Math.min(90, lat))) / 180 * height - .5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const xa = (x0 + width) % width, xb = (x0 + 1) % width, ya = y0 * width, yb = Math.min(height - 1, y0 + 1) * width;
    const top = sdf[ya + xa] + (sdf[ya + xb] - sdf[ya + xa]) * tx;
    const bottom = sdf[yb + xa] + (sdf[yb + xb] - sdf[yb + xa]) * tx;
    return (top + (bottom - top) * ty) * pixelDeg;
  };
  return {
    width,
    height,
    isLand: (lon, lat) => mask[offset(lon, lat)] !== 0,
    coastAt: (lon, lat) => Math.max(0, Math.min(1, .5 + distanceAt(lon, lat) / 2)),
    distanceAt,
  };
}

export async function loadLandMask(url: string, signal?: AbortSignal): Promise<LandMask> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Land raster: HTTP ' + response.status);
  return decodeLandMask(await response.json() as unknown);
}
