// Shared by the globe looks (Linoryt print, [night-70a R1] NASA earth): the 8-bit sqrt-encoded elevation raster
// (public/data/globe/elevation-2048.png, NOAA ETOPO5, m = (v/255)^2 * 8000), its decode, sampler and resampler.

/** 8-bit elevation raster → R channel bytes (the PNG is grey). */
export async function loadElevationBytes(url: string, signal?: AbortSignal): Promise<{ bytes: Uint8Array; width: number; height: number; size: number }> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Globe elevation ' + url + ': HTTP ' + response.status);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas unavailable');
  context.drawImage(bitmap, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  const bytes = new Uint8Array(width * height);
  for (let i = 0; i < bytes.length; i++) bytes[i] = data[i * 4];
  return { bytes, width, height, size: blob.size };
}

/** Bilinear metres sampler for the terrain heights (same encoding as look.ts `loadElevation`). */
export function elevationSampler(bytes: Uint8Array, width: number, height: number): (lon: number, lat: number) => number {
  const metres = new Float32Array(width * height);
  for (let i = 0; i < metres.length; i++) { const v = bytes[i] / 255; metres[i] = v * v * 8000; }
  return (lon, lat) => {
    const x = ((lon + 180) / 360) * width - .5, y = ((90 - lat) / 180) * height - .5;
    const x0 = Math.floor(x), y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
    const y1 = Math.min(height - 1, y0 + 1), fx = x - x0, fy = Math.max(0, Math.min(1, y - y0));
    const xa = ((x0 % width) + width) % width, xb = (xa + 1) % width;
    const top = metres[y0 * width + xa] * (1 - fx) + metres[y0 * width + xb] * fx;
    const bottom = metres[y1 * width + xa] * (1 - fx) + metres[y1 * width + xb] * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

/** Resample a raster to the mask grid (nearest) when the sizes differ. */
export function resample(bytes: Uint8Array, sw: number, sh: number, width: number, height: number): Uint8Array {
  if (sw === width && sh === height) return bytes;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(sh - 1, Math.floor((y + 0.5) * sh / height));
    for (let x = 0; x < width; x++) out[y * width + x] = bytes[sy * sw + Math.min(sw - 1, Math.floor((x + 0.5) * sw / width))];
  }
  return out;
}
