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
  coastAt(lon: number, lat: number): number;
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
  // A separable box filter gives shelf tint and coastal LOD hints without extra asset bytes.
  const radius = Math.max(2, Math.round(width / 400));
  const kernel = 2 * radius + 1;
  const horizontal = new Uint16Array(mask.length);
  const coast = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    const off = y * width;
    let sum = 0;
    for (let i = -radius; i <= radius; i++) sum += mask[off + ((i + width) % width)];
    for (let x = 0; x < width; x++) {
      horizontal[off + x] = sum;
      sum += mask[off + ((x + radius + 1) % width)] - mask[off + ((x - radius + width) % width)];
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let i = -radius; i <= radius; i++) sum += horizontal[Math.max(0, Math.min(height - 1, i)) * width + x];
    for (let y = 0; y < height; y++) {
      coast[y * width + x] = Math.round(sum * 255 / (kernel * kernel));
      sum += horizontal[Math.min(height - 1, y + radius + 1) * width + x] -
        horizontal[Math.max(0, y - radius) * width + x];
    }
  }
  const offset = (lon: number, lat: number): number => {
    const x = Math.floor((normalizeLon(lon) + 180) / 360 * width) % width;
    const y = Math.max(0, Math.min(height - 1, Math.floor((90 - Math.max(-90, Math.min(90, lat))) / 180 * height)));
    return y * width + x;
  };
  return {
    width,
    height,
    isLand: (lon, lat) => mask[offset(lon, lat)] !== 0,
    coastAt: (lon, lat) => coast[offset(lon, lat)] / 255,
  };
}

export async function loadLandMask(url: string, signal?: AbortSignal): Promise<LandMask> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Land raster: HTTP ' + response.status);
  return decodeLandMask(await response.json() as unknown);
}
