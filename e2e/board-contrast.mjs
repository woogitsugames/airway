// [night-81a] D-336 (PLAN-NOWY-KIERUNEK.md step T6; D-47, D-177): contrast on real UI-A frames over the NASA globe, by
// day and by night (replaces [night-48a] U6's test:e2e:linoryt-contrast). The real renderer (SwiftShader) draws the DEV
// store-shot fixtures `game` with the sun high over the network (`storeSunDot=0.6`, day) and `night` (midnight under the
// camera), PL 412×915 and EN 915×412. Each frame is screenshotted and read pixel by pixel:
//   - every shown airport sign (`.bd-notes .airport-bubble`, not a jam): its letters against its own ground ≥ 4.5:1 (the
//     tenth of the sign's pixels farthest from its most common colour against that colour), and that ground is one of
//     the board's opaque inks (enamel, paper, red, sign yellow): the photo never shows through a sign;
//   - every visible airport point (`window.__awLinoryt.stamps()`, the overlay's projectAirport probe): the D-177 non-text
//     ratio inside the point (its cream core or ring against its black outline: the 85th against the 15th luminance
//     percentile of the disc) ≥ 3:1; the outline against the photo around it is reported;
//   - the world's own D-177 probe (`window.__awWorld.layerContrast()`, src/render/contrast.ts): routes ≥ 4.5:1, airports,
//     planes and a jam zone core ≥ 3:1 (OBJECT_PROBE of scripts/shots.mjs), the country borders' median against the globe
//     within 1.2–2:1 (BORDER_PROBE: it shows, and stays quieter than routes and signs) — with the night land lifted by
//     D-336's moonlight on the night land.
//   - [night-82b] T7: every atlas label (no ground of its own) on day, dusk (the terminator under the camera) and night:
//     its letters against what lies under them (a second shot with the letters transparent: their outline over the photo).
// PNGs to the git-ignored .e2e/board-contrast/. Prints PASS/FAIL lines and `SUMMARY test:e2e:board-contrast …`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { withBrowser, newGamePage, ARTIFACTS, SEED } from './browser.mjs';

const started = performance.now();
const OUT = resolve(ARTIFACTS, 'board-contrast');
const CASES = [
  { light: 'day', scene: 'game', sunDot: 0.6, language: 'pl', width: 412, height: 915 },
  { light: 'day', scene: 'game', sunDot: 0.6, language: 'en', width: 915, height: 412 },
  // [night-82b] T7: dusk, the terminator under the camera (half the network lit, half in the moonlit night).
  { light: 'dusk', scene: 'game', sunDot: 0.05, language: 'pl', width: 412, height: 915 },
  { light: 'dusk', scene: 'game', sunDot: 0.05, language: 'en', width: 915, height: 412 },
  { light: 'night', scene: 'night', language: 'pl', width: 412, height: 915 },
  { light: 'night', scene: 'night', language: 'en', width: 915, height: 412 },
];
/** The board's opaque grounds (board.css --board-enamel, --board-black, --board-paper, --board-red, --board-sign). */
const GROUNDS = { enamel: [0x0E, 0x0F, 0x0F], black: [0, 0, 0], paper: [0xED, 0xE3, 0xC8], red: [0xC0, 0x23, 0x1B], sign: [0xF3, 0xC3, 0x17] };
const TEXT = 4.5;
const NON_TEXT = 3;
const ROUTES = 4.5;
const BORDERS = { min: 1.2, max: 2 };

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
const nearest = (rgb) => Object.entries(GROUNDS).map(([name, ink]) => [name, Math.hypot(...ink.map((v, i) => v - rgb[i]))]).sort((p, q) => p[1] - q[1])[0];
const median = (values) => { const s = [...values].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };
const fromLum = (y) => { const v = Math.round(255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055)); return [v, v, v]; };
const percentile = (values, p) => { const s = [...values].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0; };
function ring(img, cx, cy, r0, r1, square) {
  const out = [];
  for (let y = Math.floor(cy - r1); y <= cy + r1; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
    const d = square ? Math.max(Math.abs(x - cx), Math.abs(y - cy)) : Math.hypot(x - cx, y - cy);
    if (d >= r0 && d < r1) out.push(img.at(x, y));
  }
  return out;
}

let passed = 0, failed = 0, notes = 0, points = 0, layers = 0, atlas = 0;
const lines = [];
const gate = (ok, line) => { if (ok) passed++; else failed++; lines.push(`${ok ? 'PASS' : 'FAIL'} ${line}`); };
try {
  mkdirSync(OUT, { recursive: true });
  await withBrowser(async ({ browser, url }) => {
    for (const { light, scene, sunDot, language, width, height } of CASES) {
      const tag = `${light}-${language}-${width}x${height}`;
      const target = new URL(url);
      target.searchParams.set('storeShot', scene);
      target.searchParams.set('seed', String(0xA1A1));
      if (sunDot !== undefined) target.searchParams.set('storeSunDot', String(sunDot));
      const { page, errors } = await newGamePage(browser, target.href, language, { width, height });
      try {
        await page.waitForFunction(() => document.documentElement.dataset.storeShotReady, null, { timeout: 900000 });
        await page.evaluate(() => new Promise((done) => { let n = 8; const step = () => (--n <= 0 ? done() : requestAnimationFrame(step)); requestAnimationFrame(step); }));
        const layout = await page.evaluate(() => {
          const covered = (r) => document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
            .some((el) => el.closest('.airway-pass, .airway-dock, .airway-strip-bay, .airway-upgrade-open, .airway-go-overlay'));
          const bubbles = [...document.querySelectorAll('.bd-notes .airport-bubble')].filter((el) => {
            const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
            return r.width > 8 && r.height > 8 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.99 &&
              !el.hidden && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && !covered(r) &&
              !el.classList.contains('airport-bubble--jam');
          }).map((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, id: el.closest('[data-airport]')?.dataset.airport ?? '' }; });
          const stamps = (window.__awLinoryt?.stamps() ?? []).filter((s) => s.visible && s.half > 0 &&
            s.x - s.half > 12 && s.y - s.half > 12 && s.x + s.half < innerWidth - 12 && s.y + s.half < innerHeight - 12 &&
            !document.elementsFromPoint(s.x, s.y).some((el) => el.closest('.airport-bubble, .airway-pass, .airway-dock, .airway-strip-bay')));
          // [night-82b] T7: the atlas labels (no ground of their own: a hard dark outline round cream or blue letters).
          const atlas = [...document.querySelectorAll('.bd-atlas__label')].filter((el) => {
            const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
            return r.width > 8 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.99 && !el.hidden &&
              r.left >= 2 && r.top >= 2 && r.right <= innerWidth - 2 && r.bottom <= innerHeight - 2 && !covered(r) &&
              !document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).some((hit) => hit.closest('.airport-bubble'));
          }).map((el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el).color.match(/\d+/g).slice(0, 3).map(Number);
            return { x: r.left, y: r.top, w: r.width, h: r.height, text: el.textContent, ink: c }; });
          const probe = window.__awWorld;
          return { bubbles, stamps, atlas, skin: document.documentElement.dataset.skin, sun: document.documentElement.dataset.storeShotSun,
            world: probe?.layerContrast ? probe.layerContrast() : null, disc: probe?.disc?.() ?? null };
        });
        const png = await page.screenshot({ animations: 'disabled' });
        writeFileSync(resolve(OUT, `${tag}.png`), png);
        const img = decodePng(png);
        if (layout.skin !== 'board') throw new Error(`data-skin=${layout.skin}`);
        if (errors.length) throw new Error(`browser errors: ${errors.join('; ')}`);
        if (!layout.stamps.length) throw new Error('no visible airport point');
        // Airport signs: letters on their own opaque ground.
        for (const b of layout.bubbles) {
          const inside = [];
          for (let y = Math.ceil(b.y + 1); y < b.y + b.h - 1; y++) for (let x = Math.ceil(b.x + 1); x < b.x + b.w - 1; x++) inside.push(img.at(x, y));
          if (inside.length < 40) continue;
          const counts = new Map();
          for (const p of inside) { const k = p.map((v) => v >> 3).join(','); counts.set(k, (counts.get(k) ?? 0) + 1); }
          const groundKey = [...counts].sort((p, q) => q[1] - p[1])[0][0];
          const ground = groundKey.split(',').map((v) => Number(v) * 8 + 4);
          const g = lum(ground);
          const far = inside.map(lum).sort((p, q) => Math.abs(q - g) - Math.abs(p - g));
          const text = fromLum(median(far.slice(0, Math.max(3, Math.floor(far.length / 10)))));
          const textRatio = ratio(text, ground);
          const [inkName, inkDistance] = nearest(ground);
          notes++;
          gate(textRatio >= TEXT && inkDistance <= 24,
            `${tag} sign ${b.id}: letters ${textRatio.toFixed(2)}:1 on its ${inkDistance <= 24 ? inkName : 'photo (not opaque)'} ground`);
        }
        // [night-82b] T7: atlas labels have no ground of their own. The frame is shot again with the letters transparent
        // (only their outline and halo over the photo): under every letter pixel lies its real background. The letters'
        // median against the brighter quarter of that background ≥ 4.5:1, on day, dusk and night alike (a quarter, not
        // the brightest pixels: the planes fly on between the two shots and may pass under a label).
        if (layout.atlas.length) {
          const hide = await page.addStyleTag({ content: '.bd-atlas__label { color: transparent !important; }' });
          const settle = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
          await settle();
          const bare = decodePng(await page.screenshot({ animations: 'disabled' }));
          // The planes fly on between the shots: a third shot with the letters back, and only pixels that match the
          // first shot (nothing moved over them) count.
          await hide.evaluate((node) => node.remove());
          await settle();
          const again = decodePng(await page.screenshot({ animations: 'disabled' }));
          for (const a of layout.atlas) {
            const core = [], under = [];
            for (let y = Math.ceil(a.y); y < a.y + a.h; y++) for (let x = Math.ceil(a.x); x < a.x + a.w; x++) {
              const p = img.at(x, y), q = bare.at(x, y);
              if (Math.hypot(...p.map((v, i) => v - a.ink[i])) > 36 || Math.hypot(...p.map((v, i) => v - q[i])) < 48) continue; // a letter pixel, not the photo's own cream
              if (Math.hypot(...p.map((v, i) => v - again.at(x, y)[i])) > 24) continue; // something moved here
              core.push(lum(p));
              under.push(lum(bare.at(x, y)));
            }
            if (core.length < 12) continue;
            atlas++;
            const value = ratio(fromLum(median(core)), fromLum(percentile(under, 0.75)));
            gate(value >= TEXT, `${tag} atlas "${a.text}": letters ${value.toFixed(2)}:1 on their outline (median ground ${ratio(fromLum(median(core)), fromLum(median(under))).toFixed(2)})`);
          }
        }
        // Airport points: core against outline (D-177 non-text), the outline against the photo reported.
        for (const s of layout.stamps) {
          const disc = ring(img, s.x, s.y, 0, Math.max(2, s.half - 0.5), false).map(lum);
          const around = ring(img, s.x, s.y, s.half + 3, s.half + 7, false).map(lum);
          const hi = fromLum(percentile(disc, 0.85)), lo = fromLum(percentile(disc, 0.15)), world = fromLum(median(around));
          const inner = ratio(hi, lo), edge = ratio(lo, world);
          points++;
          gate(inner >= NON_TEXT, `${tag} point ${s.id}${s.hub ? ' (hub)' : ''}: core/outline ${inner.toFixed(2)}:1, outline/photo ${edge.toFixed(2)}:1`);
        }
        // The world's own D-177 probe (routes, points, planes, jam zone, borders).
        const w = layout.world;
        if (!w) throw new Error('no world probe (window.__awWorld.layerContrast)');
        for (const [name, min] of [['routes', ROUTES], ['airports', NON_TEXT], ['planes', NON_TEXT], ['jam', NON_TEXT]]) {
          const c = w[name];
          if (!c) { if (name === 'routes' || name === 'airports') gate(false, `${tag} layer ${name}: nothing measured`); continue; }
          layers++;
          const value = name === 'routes' ? c.ratio : (c.core ?? c.ratio);
          gate(value >= min, `${tag} layer ${name}: ${name === 'routes' ? 'ratio' : 'core'} ${value}:1 (edge ${c.edge ?? '-'}, ≥ ${min})`);
        }
        const borders = w.borders;
        if (!borders) gate(false, `${tag} layer borders: nothing measured`);
        else {
          layers++;
          const m = borders.median ?? borders.ratio;
          gate(m >= BORDERS.min && m <= BORDERS.max, `${tag} layer borders: median ${m}:1 (edge ${borders.edge ?? '-'}; band ${BORDERS.min}–${BORDERS.max})`);
        }
        lines.push(`INFO ${tag} sun=${layout.sun} signs=${layout.bubbles.length} atlas=${layout.atlas.length} points=${layout.stamps.length}`);
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
if (!notes) { failed++; console.error('FAIL no sign measured'); }
console.log(`SUMMARY test:e2e:board-contrast seed=0x${SEED.toString(16).toUpperCase()} frames=${CASES.length} signs=${notes} atlas=${atlas} points=${points} ` +
  `layers=${layers} passed=${passed} failed=${failed} durationMs=${Math.round(performance.now() - started)}`);
if (failed) process.exitCode = 1;
