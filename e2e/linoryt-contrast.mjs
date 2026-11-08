// [night-48a] PLAN-LINORYT.md U6 (D-47, D-177): contrast on real Linoryt frames, harness side only (the world's own
// probe, `measureLayerContrast` in src/render/contrast.ts, belongs to the ext session). The real renderer (SwiftShader)
// draws the DEV store-shot fixtures `game` (week 1, evening: land, sea and the night hatch on one globe) and `night`
// (midnight under the camera), PL 412×915 and EN 915×412. Each frame is screenshotted and read pixel by pixel:
//   - every shown airport note (`.airport-bubble`): its text against its own ground ≥ 4.5:1 (the darkest tenth of the
//     note's pixels against its most common colour), and that ground is the paper (no world showing through). The world
//     right around the note (a 6 px ring) is classed as ochre land, blue sea, night hatch or paper sky, so the report
//     says which grounds the notes were read on;
//   - every visible stamp (`window.__awLinoryt.stamps()`): the D-177 non-text ratio, the better of (a) its paper outline
//     (the ring just outside the stamp) against the world around it and (b) its ink core against that outline. Day
//     grounds (ochre, blue) gate at 3:1; a stamp on the night hatch is reported (WARN) and counted, not gated: E4's probe
//     measures the night stamps at 2.8:1 and the fix (a wider paper outline at night) is render work for the ext session.
// PNGs to the git-ignored .e2e/linoryt-contrast/. Prints PASS/WARN/FAIL lines and `SUMMARY test:e2e:linoryt-contrast …`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, ARTIFACTS, SEED } from './browser.mjs';

const started = performance.now();
const OUT = resolve(ARTIFACTS, 'linoryt-contrast');
const CASES = [
  { scene: 'game', language: 'pl', width: 412, height: 915 },
  { scene: 'game', language: 'en', width: 915, height: 412 },
  { scene: 'night', language: 'pl', width: 412, height: 915 },
];
const INKS = { paper: [0xEC, 0xE3, 0xCC], ink: [0x1E, 0x1C, 0x1F], blue: [0x2B, 0x4A, 0x66], ochre: [0xD2, 0x9C, 0x47], red: [0xB3, 0x38, 0x23] };
const TEXT = 4.5;
const NON_TEXT = 3;

function decodePng(buffer) {
  let pos = 8, width = 0, height = 0, channels = 4;
  const idat = [];
  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    const body = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      channels = { 2: 3, 6: 4 }[body[9]];
      if (body[8] !== 8 || !channels) throw new Error('unsupported PNG');
    } else if (type === 'IDAT') idat.push(body);
    pos += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const v = raw[y * (stride + 1) + 1 + i];
      const a = i >= channels ? data[y * stride + i - channels] : 0;
      const b = y ? data[(y - 1) * stride + i] : 0;
      const c = y && i >= channels ? data[(y - 1) * stride + i - channels] : 0;
      let out = v;
      if (filter === 1) out = v + a;
      else if (filter === 2) out = v + b;
      else if (filter === 3) out = v + ((a + b) >> 1);
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      data[y * stride + i] = out & 255;
    }
  }
  return { width, height, channels, at: (x, y) => { const o = (Math.round(y) * width + Math.round(x)) * channels; return [data[o], data[o + 1], data[o + 2]]; } };
}
const lum = (rgb) => rgb.map((v) => v / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const nearest = (rgb) => Object.entries(INKS).map(([name, ink]) => [name, Math.hypot(...ink.map((v, i) => v - rgb[i]))]).sort((p, q) => p[1] - q[1])[0][0];
const median = (values) => { const s = [...values].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };
const fromLum = (y) => { const v = Math.round(255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055)); return [v, v, v]; };
/** The class of the world in a set of pixels: night hatch when ink lines take ≥ 15 % of an ochre/blue ground. */
function worldClass(pixels) {
  const count = {};
  for (const p of pixels) { const n = nearest(p); count[n] = (count[n] ?? 0) + 1; }
  const total = pixels.length || 1;
  const ground = ['ochre', 'blue', 'paper'].sort((p, q) => (count[q] ?? 0) - (count[p] ?? 0))[0];
  const night = (count.ink ?? 0) / total >= 0.15 && ground !== 'paper';
  return night ? `night hatch on ${ground === 'ochre' ? 'land' : 'sea'}` : ({ ochre: 'ochre land', blue: 'blue sea', paper: 'paper sky' })[ground];
}
function ring(img, cx, cy, r0, r1, square) {
  const out = [];
  for (let y = Math.floor(cy - r1); y <= cy + r1; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
    const d = square ? Math.max(Math.abs(x - cx), Math.abs(y - cy)) : Math.hypot(x - cx, y - cy);
    if (d >= r0 && d < r1) out.push(img.at(x, y));
  }
  return out;
}

let passed = 0, failed = 0, warned = 0, notes = 0, stamps = 0;
const grounds = new Set();
const lines = [];
try {
  mkdirSync(OUT, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const { scene, language, width, height } of CASES) {
      const tag = `${scene}-${language}-${width}x${height}`;
      const target = new URL(url);
      target.searchParams.set('storeShot', scene);
      target.searchParams.set('seed', String(0xA1A1));
      const { page, errors } = await newGamePage(browser, target.href, language, { width, height });
      try {
        await page.waitForFunction(() => document.documentElement.dataset.storeShotReady, null, { timeout: 900000 });
        await page.evaluate(() => new Promise((done) => { let n = 8; const step = () => (--n <= 0 ? done() : requestAnimationFrame(step)); requestAnimationFrame(step); }));
        const layout = await page.evaluate(() => {
          const covered = (r) => document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
            .some((el) => el.closest('.airway-pass, .airway-dock, .airway-upgrade-open, .airway-go-overlay'));
          const bubbles = [...document.querySelectorAll('.airport-bubble')].filter((el) => {
            const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
            return r.width > 8 && r.height > 8 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.99 &&
              r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && !covered(r) &&
              !el.classList.contains('airport-bubble--jam');
          }).map((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, id: el.closest('[data-airport]')?.dataset.airport ?? '' }; });
          const stamps = (window.__awLinoryt?.stamps() ?? []).filter((s) => s.visible && s.half > 0 &&
            s.x - s.half > 12 && s.y - s.half > 12 && s.x + s.half < innerWidth - 12 && s.y + s.half < innerHeight - 12);
          return { bubbles, stamps, skin: document.documentElement.dataset.skin };
        });
        const png = await page.screenshot({ animations: 'disabled' });
        writeFileSync(resolve(OUT, `${tag}.png`), png);
        const img = decodePng(png);
        if (layout.skin !== 'linoryt') throw new Error(`data-skin=${layout.skin}`);
        if (errors.length) throw new Error(`browser errors: ${errors.join('; ')}`);
        if (!layout.stamps.length) throw new Error('no visible stamp (is the Linoryt world on?)');
        const stampBoxes = layout.stamps.map((s) => ({ x0: s.x - s.half - 3, y0: s.y - s.half - 3, x1: s.x + s.half + 3, y1: s.y + s.half + 3 }));
        for (const b of layout.bubbles) {
          const inside = [];
          for (let y = Math.ceil(b.y + 1); y < b.y + b.h - 1; y++) for (let x = Math.ceil(b.x + 1); x < b.x + b.w - 1; x++) inside.push(img.at(x, y));
          if (inside.length < 40) continue;
          const counts = new Map();
          for (const p of inside) { const k = p.map((v) => v >> 3).join(','); counts.set(k, (counts.get(k) ?? 0) + 1); }
          const groundKey = [...counts].sort((p, q) => q[1] - p[1])[0][0];
          const ground = groundKey.split(',').map((v) => Number(v) * 8 + 4);
          const dark = inside.map(lum).sort((p, q) => p - q);
          const text = fromLum(median(dark.slice(0, Math.max(3, Math.floor(dark.length / 10)))));
          const textRatio = ratio(text, ground);
          const around = [];
          for (let x = Math.floor(b.x - 6); x <= b.x + b.w + 6; x += 2) for (const y of [b.y - 6, b.y + b.h + 6]) if (x >= 0 && y >= 0 && x < img.width && y < img.height) around.push([x, y]);
          for (let y = Math.floor(b.y); y <= b.y + b.h; y += 2) for (const x of [b.x - 6, b.x + b.w + 6]) if (x >= 0 && x < img.width && y < img.height) around.push([x, y]);
          const world = worldClass(around.filter(([x, y]) => !stampBoxes.some((s) => x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1)).map(([x, y]) => img.at(x, y)));
          grounds.add(world);
          notes++;
          const ok = textRatio >= TEXT && nearest(ground) === 'paper';
          if (ok) passed++; else failed++;
          lines.push(`${ok ? 'PASS' : 'FAIL'} ${tag} note ${b.id} on ${world}: text ${textRatio.toFixed(2)}:1 on its ${nearest(ground)} ground`);
        }
        for (const s of layout.stamps) {
          const outline = ring(img, s.x, s.y, s.half + 0.5, s.half + 2, !s.hub).map(lum);
          const worldPx = ring(img, s.x, s.y, s.half + 5, s.half + 9, !s.hub);
          const core = ring(img, s.x, s.y, s.half - 3, s.half - 1, !s.hub).map(lum);
          const world = worldClass(worldPx);
          const o = fromLum(median(outline)), w = fromLum(median(worldPx.map(lum))), c = fromLum(median(core));
          const edge = ratio(o, w), inner = ratio(c, o), best = Math.max(edge, inner);
          stamps++;
          const night = world.startsWith('night');
          const status = best >= NON_TEXT ? 'PASS' : night ? 'WARN' : 'FAIL';
          if (status === 'PASS') passed++; else if (status === 'WARN') warned++; else failed++;
          lines.push(`${status} ${tag} stamp ${s.id}${s.hub ? ' (hub)' : ''} on ${world}: edge ${edge.toFixed(2)} core ${inner.toFixed(2)} -> ${best.toFixed(2)}:1`);
        }
      } catch (error) {
        failed++;
        lines.push(`FAIL ${tag}: ${String(error?.message ?? error).split('\n')[0]}`);
      } finally {
        await page.close();
      }
    }
  });
} catch (error) {
  failed++;
  lines.push(`FAIL harness: ${String(error?.message ?? error).split('\n')[0]}`);
}
for (const line of lines) console[line.startsWith('FAIL') ? 'error' : 'log'](line);
if (!notes) { failed++; console.error('FAIL no note measured'); }
console.log(`SUMMARY test:e2e:linoryt-contrast seed=0x${SEED.toString(16).toUpperCase()} frames=${CASES.length} notes=${notes} stamps=${stamps} ` +
  `grounds=${[...grounds].sort().join('|').replace(/ /g, '-')} passed=${passed} warned=${warned} failed=${failed} ` +
  `durationMs=${Math.round(performance.now() - started)}`);
if (failed) process.exitCode = 1;
