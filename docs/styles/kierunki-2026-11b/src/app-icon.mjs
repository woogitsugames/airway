// [ext-04] App mark sketches in the Linoryt technique (U7, owner review; not the shipped launcher icons).
// One block of ink on paper, the aircraft cut out of it with the dock silhouettes of `icons.js`, gouge lines left by
// the cutter. Three variants, 1024×1024 full-bleed SVG + PNG, and a sheet with launcher masks and small sizes.
// Usage: node docs/styles/kierunki-2026-11b/src/app-icon.mjs   (Playwright 1.63 + Chromium from the environment)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ICON } from './icons.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/workspace/airway/')('playwright')); }
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'znak');
mkdirSync(out, { recursive: true });

// Spec §1 inks only (red is for a jam and never appears in the mark).
const INK = { paper: '#ECE3CC', ink: '#1E1C1F', blue: '#2B4A66', ochre: '#D29C47' };
const S = 1024;

// Deterministic value noise: the irregular edge of a hand-cut line.
let seed = 0xA1A1;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const smoothNoise = (n) => { const v = Array.from({ length: n + 2 }, rand); return (t) => {
  const x = t * n, i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return v[i] + (v[i + 1] - v[i]) * s; }; };
const fmt = (v) => v.toFixed(1);

/** A gouge stroke along an arc: a polygon whose width wobbles and tapers at both ends. */
function gougeArc(cx, cy, r, a0, a1, width, { taper = 0.12, wobble = 0.35 } = {}) {
  const steps = Math.max(24, Math.round(Math.abs(a1 - a0) * r / 8));
  const noise = smoothNoise(Math.max(3, Math.round(steps / 10)));
  const left = [], right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = a0 + (a1 - a0) * t;
    const end = Math.min(1, t / taper, (1 - t) / taper);
    const w = width * (1 - wobble + wobble * 2 * noise(t)) * Math.sqrt(Math.max(0, end)) / 2;
    const ux = Math.cos(a), uy = Math.sin(a);
    left.push(`${fmt(cx + ux * (r + w))} ${fmt(cy + uy * (r + w))}`);
    right.push(`${fmt(cx + ux * (r - w))} ${fmt(cy + uy * (r - w))}`);
  }
  return `M${left.join(' L')} L${right.reverse().join(' L')} Z`;
}

/** Concentric gouge lines (parallels of a globe whose centre lies off the block), broken into hand-length runs. */
function parallels(cx, cy, r0, r1, spacing, a0, a1, width, colour) {
  const paths = [];
  for (let r = r0; r <= r1; r += spacing) {
    let a = a0 + rand() * 0.04;
    while (a < a1) {
      const len = (0.22 + rand() * 0.5) * 900 / r;
      paths.push(gougeArc(cx, cy, r, a, Math.min(a1, a + len), width * (0.85 + rand() * 0.3)));
      a += len + (8 + rand() * 18) / r;
    }
  }
  return `<path fill="${colour}" d="${paths.join(' ')}"/>`;
}

/** The aircraft cut out: an ink clearance around the silhouette, then the paper shape. */
function plane(kind, x, y, scale, heading, { fill = INK.paper, clearance = INK.ink, gap = 26 } = {}) {
  const t = `translate(${x} ${y}) rotate(${heading}) scale(${scale}) translate(-50 -50)`;
  const d = ICON[kind];
  return `<g transform="${t}"><path d="${d}" fill="${clearance}" stroke="${clearance}" stroke-width="${fmt(gap * 2 / scale)}" ` +
    `stroke-linejoin="round"/><path d="${d}" fill="${fill}"/></g>`;
}

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">` +
  `<defs><clipPath id="c"><rect width="${S}" height="${S}"/></clipPath></defs><g clip-path="url(#c)">${body}</g></svg>`;

const VARIANTS = {
  // A — "Odbitka": the whole tile is the ink block; parallels cut from it, the widebody cut out across them (heading NE).
  a: () => {
    seed = 0xA1A1;
    return svg(`<rect width="${S}" height="${S}" fill="${INK.ink}"/>` +
      parallels(-260, 1320, 640, 2000, 58, -1.75, 0.2, 16, INK.paper) +
      plane('jet', 512, 512, 5.0, 40, { gap: 30 }));
  },
  // B — "Nad kulą": paper tile, the blue print of the globe with paper parallels and an inked limb; the turboprop in ink
  // with a paper rim, exactly the game's plane sprite (D-304), crossing the limb.
  b: () => {
    seed = 0xB2B2;
    const cx = 540, cy = 552, r = 250;
    return svg(`<rect width="${S}" height="${S}" fill="${INK.paper}"/>` +
      `<clipPath id="g"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK.blue}"/>` +
      `<g clip-path="url(#g)">${parallels(cx, cy + 1400, 1400 - r, 1400 + r, 36, -1.85, -1.25, 11, INK.paper)}</g>` +
      `<circle cx="${cx}" cy="${cy}" r="${r + 9}" fill="none" stroke="${INK.ink}" stroke-width="18"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r + 32}" fill="none" stroke="${INK.blue}" stroke-width="6"/>` +
      plane('prop', 392, 404, 3.0, 35, { fill: INK.ink, clearance: INK.paper, gap: 18 }));
  },
  // C — "Trasa": the ink block, one paper route (a great-circle arc) from an airport stamp to the aircraft: the game's
  // core act (draw a route, the plane flies it) in one cut.
  c: () => {
    seed = 0xC3C3;
    const stamp = (x, y, s) => `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" fill="${INK.paper}"/>` +
      `<rect x="${x - s / 2 + 20}" y="${y - s / 2 + 20}" width="${s - 40}" height="${s - 40}" fill="${INK.ink}"/>` +
      `<path d="M${x - s / 2 + 32} ${y + s / 2 - 32} L${x + s / 2 - 32} ${y - s / 2 + 32}" stroke="${INK.paper}" stroke-width="16"/>`;
    // The route: a circle through the stamp (lower left) and the aircraft (upper right), centre to the lower right.
    const [sx, sy, px, py] = [380, 650, 630, 400];
    const [mx, my] = [(sx + px) / 2, (sy + py) / 2], len = Math.hypot(px - sx, py - sy);
    const [nx, ny] = [-(py - sy) / len, (px - sx) / len];
    const cx = mx + nx * 330, cy = my + ny * 330, r = Math.hypot(sx - cx, sy - cy);
    const aS = Math.atan2(sy - cy, sx - cx), aP = Math.atan2(py - cy, px - cx);
    // Travel from the stamp to the aircraft: the angle runs aS → aP the short way round.
    let span = aP - aS; if (span > Math.PI) span -= 2 * Math.PI; if (span < -Math.PI) span += 2 * Math.PI;
    const dir = Math.sign(span), tx = -Math.sin(aP) * dir, ty = Math.cos(aP) * dir;
    const heading = Math.atan2(tx, -ty) * 180 / Math.PI;
    return svg(`<rect width="${S}" height="${S}" fill="${INK.ink}"/>` +
      parallels(cx, cy, r + 110, r + 800, 60, Math.min(aS, aS + span) - 0.5, Math.max(aS, aS + span) + 0.5, 11, INK.ochre) +
      `<path fill="${INK.paper}" d="${gougeArc(cx, cy, r, aS + 0.16 * dir, aS + span - 0.24 * dir, 30, { taper: 0.05, wobble: 0.12 })}"/>` +
      stamp(sx, sy, 140) +
      plane('jet', px, py, 3.2, heading, { gap: 24 }));
  },
};

// Launcher previews: iOS rounded square (the system mask), Android adaptive circle (inner 66/108 safe zone), sizes.
const sheet = (files) => `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:${INK.paper};font:600 26px/1.3 serif;color:${INK.ink}}
  .row{display:flex;align-items:center;gap:40px;padding:36px 48px;border-bottom:3px solid ${INK.ink}}
  .k{width:60px;font-size:64px}
  img{display:block} .ios{border-radius:22.37%} .and{border-radius:50%;object-fit:cover}
  .dark{background:${INK.ink};padding:20px;display:flex;gap:28px;align-items:center}
</style>${files.map(([k, f]) => `<div class="row"><div class="k">${k.toUpperCase()}</div>
  <img class="ios" src="${f}" width="300" height="300">
  <div style="position:relative;width:300px;height:300px;overflow:hidden;border-radius:50%"><img src="${f}" width="450" height="450" style="position:absolute;left:-75px;top:-75px"></div>
  <img class="ios" src="${f}" width="120" height="120"><img class="ios" src="${f}" width="72" height="72">
  <img class="ios" src="${f}" width="48" height="48"><img class="ios" src="${f}" width="29" height="29">
  <div class="dark"><img class="ios" src="${f}" width="96" height="96"><img class="ios" src="${f}" width="48" height="48"></div>
</div>`).join('')}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
const files = [];
for (const [key, build] of Object.entries(VARIANTS)) {
  const markup = build();
  writeFileSync(join(out, `znak-${key}.svg`), markup + '\n');
  await page.setContent(`<!doctype html><body style="margin:0">${markup}</body>`);
  const png = await page.locator('svg').screenshot();
  writeFileSync(join(out, `znak-${key}.png`), png);
  files.push([key, `data:image/png;base64,${png.toString('base64')}`]);
}
const board = await browser.newPage({ viewport: { width: 1600, height: 100 }, deviceScaleFactor: 1 });
await board.setContent(sheet(files));
writeFileSync(join(out, 'zestawienie-znak.png'), await board.screenshot({ fullPage: true }));
await browser.close();
console.log(`SUMMARY app-icon variants=${files.length} out=${out}`);
