// [ext-04 E1] D-283/D-289 spec §9: the Linoryt motion strip and its flicker score (`npm run shots -- linoryt-motion`).
// SwiftShader renders 8 frames of the printed globe while the camera turns 0.15° per frame. Flicker = share of pixels
// in edge-free tiles of the disc whose luminance changes by more than 25 % between consecutive frames, measured on
// the frames box-filtered over one hatch window (8 CSS px): a well anti-aliased hatch that only moves keeps its local
// mean, while shimmer and moiré (lines popping, beat bands sweeping) change it. Budget: ≤ 2 %. The unfiltered
// per-pixel share is logged too (it counts honest motion of the lines, so it has no budget).
import { writeFileSync } from 'node:fs';

export const MOTION = { frames: 8, stepDeg: 0.15, budget: 0.02, threshold: 0.25 };

async function frame(page) {
  // Two display frames so the renderer has drawn the new camera.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  return (await page.screenshot({ type: 'png' })).toString('base64');
}

/** Run on a page already showing dev/globe.html?look=linoryt…; returns a log line, throws over budget. */
export async function linorytMotion(page, outPath, view = { lon: 24, lat: 38 }) {
  const shots = [];
  for (let i = 0; i < MOTION.frames; i++) {
    await page.evaluate(([lon, lat]) => window.__globeWorld.orbit.setTarget(lon, lat), [view.lon + i * MOTION.stepDeg, view.lat]);
    shots.push(await frame(page));
  }
  const result = await page.evaluate(async ({ shots, threshold }) => {
    const world = window.__globeWorld;
    const dpr = window.devicePixelRatio || 1;
    const disc = world.orbit.getScreenDisc();
    const images = [];
    for (const data of shots) {
      const image = new Image();
      image.src = 'data:image/png;base64,' + data;
      await image.decode();
      images.push(image);
    }
    const w = images[0].width, h = images[0].height;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const box = Math.max(3, Math.round(8 * dpr) | 1);
    const half = box >> 1;
    const lum = [], blur = [];
    for (const image of images) {
      context.drawImage(image, 0, 0);
      const px = context.getImageData(0, 0, w, h).data;
      const l = new Float32Array(w * h);
      for (let i = 0; i < l.length; i++) l[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
      const sum = new Float64Array((w + 1) * (h + 1));
      for (let y = 0; y < h; y++) {
        let row = 0;
        for (let x = 0; x < w; x++) { row += l[y * w + x]; sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row; }
      }
      const b = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        const y0 = Math.max(0, y - half), y1 = Math.min(h, y + half + 1);
        for (let x = 0; x < w; x++) {
          const x0 = Math.max(0, x - half), x1 = Math.min(w, x + half + 1);
          const s = sum[y1 * (w + 1) + x1] - sum[y0 * (w + 1) + x1] - sum[y1 * (w + 1) + x0] + sum[y0 * (w + 1) + x0];
          b[y * w + x] = s / ((y1 - y0) * (x1 - x0));
        }
      }
      lum.push(l); blur.push(b);
    }
    const cx = disc.x * dpr, cy = disc.y * dpr, r = disc.radius * dpr * 0.92;
    const tile = Math.round(16 * dpr);
    let counted = 0, flicker = 0, raw = 0, tiles = 0, edgeFree = 0, f5 = 0, f10 = 0;
    for (let ty = 0; ty + tile <= h; ty += tile) {
      for (let tx = 0; tx + tile <= w; tx += tile) {
        const corners = [[tx, ty], [tx + tile, ty], [tx, ty + tile], [tx + tile, ty + tile]];
        if (corners.some(([x, y]) => Math.hypot(x - cx, y - cy) > r)) continue;
        tiles++;
        // Edge-free: the filtered frame is flat inside the tile in every frame (no coast, no relief edge, no limb).
        let flat = true;
        for (const b of blur) {
          let min = 1, max = 0;
          for (let y = ty; y < ty + tile; y++) for (let x = tx; x < tx + tile; x++) { const v = b[y * w + x]; if (v < min) min = v; if (v > max) max = v; }
          if (max - min > 0.12) { flat = false; break; }
        }
        if (!flat) continue;
        edgeFree++;
        for (let f = 0; f + 1 < blur.length; f++) {
          for (let y = ty; y < ty + tile; y++) for (let x = tx; x < tx + tile; x++) {
            const i = y * w + x;
            counted++;
            const change = Math.abs(blur[f + 1][i] - blur[f][i]) / Math.max(blur[f][i], 0.02);
            if (change > threshold) flicker++;
            if (change > 0.05) f5++;
            if (change > 0.10) f10++;
            if (Math.abs(lum[f + 1][i] - lum[f][i]) / Math.max(lum[f][i], 0.02) > threshold) raw++;
          }
        }
      }
    }
    // Strip: the 8 frames side by side at half size.
    const strip = document.createElement('canvas');
    strip.width = Math.round(w / 2) * images.length; strip.height = Math.round(h / 2);
    const sc = strip.getContext('2d');
    images.forEach((image, i) => sc.drawImage(image, i * Math.round(w / 2), 0, Math.round(w / 2), Math.round(h / 2)));
    return { f5: f5 / Math.max(1, counted), f10: f10 / Math.max(1, counted), flicker: counted ? flicker / counted : 1, raw: counted ? raw / counted : 1, tiles, edgeFree,
      strip: strip.toDataURL('image/png').split(',')[1] };
  }, { shots, threshold: MOTION.threshold });
  writeFileSync(outPath, Buffer.from(result.strip, 'base64'));
  const line = `flicker=${(result.flicker * 100).toFixed(2)}% (budget ${MOTION.budget * 100}%) ` +
    `over5=${(result.f5 * 100).toFixed(2)}% over10=${(result.f10 * 100).toFixed(2)}% rawPixelChange=${(result.raw * 100).toFixed(1)}% edgeFreeTiles=${result.edgeFree}/${result.tiles}`;
  if (result.edgeFree < 8) throw new Error('too few edge-free tiles to judge flicker: ' + line);
  if (result.flicker > MOTION.budget) throw new Error('Linoryt flicker over budget: ' + line);
  return line;
}
