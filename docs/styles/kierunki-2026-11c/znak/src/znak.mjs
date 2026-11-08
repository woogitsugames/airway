// Airway app-mark sketches 2026-11c (D-323 palette, UI-A signage). Run: node docs/styles/kierunki-2026-11c/znak/src/znak.mjs
// Text is converted to outlines (Archivo 800, OFL) by glyphs.py, so the SVGs need no font. Tiles are full-bleed 1024x1024,
// all essential content sits inside the Android adaptive safe circle (66/108 -> diameter 626).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const here = dirname(fileURLToPath(import.meta.url)), out = join(here, '..');
const GL = JSON.parse(readFileSync(join(here, 'glyphs.json'), 'utf8'));
const K = '#0E0F0F', C = '#EFE7D3', Y = '#F3C317', ED = '#171818';
const GLYPH = {
  chevron: 'M-6 -5 L0 1 L6 -5 L6 0 L0 6 L-6 0Z',
  bowtie: 'M-6 -5.5 L0 0 L-6 5.5Z M6 -5.5 L0 0 L6 5.5Z',
  crescent: 'M2.5 -5.45 A6 6 0 1 0 2.5 5.45 A6.6 6.6 0 0 1 2.5 -5.45Z',
};
const f = (n) => +n.toFixed(2);
const svg = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><rect width="1024" height="1024" fill="${bg}"/>${body}</svg>\n`;
// text as outlines: centred on cx, cap height `cap` px, top of caps at y; tracking in px
function text(str, wd, cap, cx, top, fill, track = 0) {
  const s = cap / GL[`${wd}_cap`];
  const adv = [...str].map((c) => GL[`${wd}_${c}`].adv * s);
  const total = adv.reduce((a, b) => a + b, 0) + track * (str.length - 1);
  let x = cx - total / 2, parts = '';
  [...str].forEach((c, i) => {
    parts += `<path transform="translate(${f(x)} ${f(top + cap)}) scale(${f(s * 1e4) / 1e4} ${-f(s * 1e4) / 1e4})" d="${GL[`${wd}_${c}`].d}"/>`;
    x += adv[i] + track;
  });
  return { svg: `<g fill="${fill}">${parts}</g>`, w: total };
}
const ring = (cx, cy, r, sw, col) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
const bar = (x1, y1, x2, y2, w, col, cap = 'butt') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${w}" stroke-linecap="${cap}"/>`;
const pol = (cx, cy, r, deg) => [cx + r * Math.cos(deg * Math.PI / 180), cy + r * Math.sin(deg * Math.PI / 180)];
const glyph = (name, cx, cy, size, col, rot = 0) => `<path d="${GLYPH[name]}" fill="${col}" transform="translate(${cx} ${cy}) rotate(${rot}) scale(${size / 12})"/>`;
// the hub mark of the game (three bars crossing): vertical + two diagonals, bar width w, arm length L
const asterisk = (cx, cy, L, w, col, skip = []) => [90, 30, 150].flatMap((a) => [a, a + 180]).map((a, i) => skip.includes(a % 360) ? '' : bar(cx, cy, ...pol(cx, cy, L, a), w, col)).join('');

const V = {};
// I-1 "Wezel": double hub ring (the airport pin of the game, enlarged) with one D-08 glyph, the bow-tie, in direction yellow
{
  const c = 512;
  V['I-1'] = { name: 'Węzeł', bg: K, body:
    ring(c, c, 262, 44, C) + ring(c, c, 176, 16, C) + glyph('bowtie', c, c, 196, Y) };
}
// I-2 "Tarcza": double ring as a dial; the six D-08 glyphs (chevron, bow-tie, crescent, keyhole, tail-fin, bracket) sit in the gap
{
  const c = 512;
  const order = [['chevron', '#009E73'], ['bowtie', '#CC79A7'], ['crescent', '#E69F00'], ['keyhole', '#56B4E9'], ['fin', '#0072B2'], ['bracket', '#EFE7D3']];
  GLYPH.keyhole = 'M0 -6.2 A3.4 3.4 0 1 1 0 0.6 A3.4 3.4 0 1 1 0 -6.2Z M-1.7 -1 L1.7 -1 L3.4 6 L-3.4 6Z';
  GLYPH.fin = 'M-6 6 L6 6 L6 2.5 L-1 -6 L-6 -6Z';
  GLYPH.bracket = 'M-6 -6 L-1.5 -6 L-1.5 1.5 L6 1.5 L6 6 L-6 6Z';
  V['I-2'] = { name: 'Tarcza', bg: K, body:
    ring(c, c, 296, 14, C) + ring(c, c, 112, 36, C) + `<circle cx="${c}" cy="${c}" r="40" fill="${C}"/>` +
    order.map(([g, col], i) => { const [x, y] = pol(c, c, 208, -90 + i * 60); return glyph(g, f(x), f(y), 118, col); }).join('') };
}
// I-3 "Hub w A": yellow direction-sign tile; the letter A is two routes meeting, its crossbar is the hub double ring
{
  const c = 512;
  V['I-3'] = { name: 'Hub w A', bg: Y, body:
    `<path fill-rule="evenodd" fill="${K}" d="M452 262 L572 262 L702 762 L582 762 L526 548 L498 548 L442 762 L322 762Z"/>` +
    `<circle cx="${c}" cy="640" r="112" fill="${Y}"/>` + ring(c, 640, 80, 32, K) + `<circle cx="${c}" cy="640" r="28" fill="${K}"/>` };
}
// II-1 "Tabliczka": black tile, cream-keyline enamel plate with the code AW, yellow route arrow under it
{
  const c = 512, w = 520, h = 290, x = c - w / 2, y = 292;
  const t = text('AW', 82, 184, c, y + (h - 184) / 2, C, 10);
  V['II-1'] = { name: 'Tabliczka', bg: K, body:
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="${ED}" stroke="${C}" stroke-width="16"/>` +
    `<rect x="${x + 30}" y="${y + 30}" width="${w - 60}" height="${h - 60}" rx="8" fill="none" stroke="${C}" stroke-width="5" stroke-opacity=".75"/>` +
    t.svg +
    bar(c - 170, 700, c + 130, 700, 36, Y) + `<path d="M${c + 96} 648 L${c + 196} 700 L${c + 96} 752Z" fill="${Y}"/>` };
}
// II-2 "Kierunek": yellow tile, black direction sign AIR with an arrow
{
  const c = 512;
  const t = text('AIR', 78, 215, c, 318, K, 14);
  V['II-2'] = { name: 'Kierunek', bg: Y, body:
    `<rect x="64" y="64" width="896" height="896" rx="48" fill="none" stroke="${K}" stroke-width="20"/>` + t.svg +
    bar(c - 180, 650, c + 150, 650, 34, K) + `<path d="M${c + 120} 598 L${c + 220} 650 L${c + 120} 702Z" fill="${K}"/>` };
}
// II-3 "Stos znakow": black tile, location plate AW (cream) over a yellow direction bar with AIR and arrow
{
  const c = 512;
  const t1 = text('AW', 82, 128, c, 292, C, 10), t2 = text('AIR', 82, 78, c - 36, 558, K, 12);
  V['II-3'] = { name: 'Stos znaków', bg: K, body:
    `<rect x="312" y="262" width="400" height="190" rx="22" fill="${ED}" stroke="${C}" stroke-width="13"/>` + t1.svg +
    `<rect x="312" y="500" width="400" height="162" rx="22" fill="${Y}"/>` + t2.svg +
    bar(c + 96, 581, c + 134, 581, 22, K) + `<path d="M${c + 124} 548 L${c + 190} 581 L${c + 124} 614Z" fill="${K}"/>` };
}
for (const [id, v] of Object.entries(V)) writeFileSync(join(out, `znak-${id.toLowerCase()}.svg`), svg(v.body, v.bg));
writeFileSync(join(here, 'variants.json'), JSON.stringify(Object.fromEntries(Object.entries(V).map(([k, v]) => [k, { name: v.name }]))));

// ---- PNG + zestawienie via Playwright
let chromium; try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/')('playwright')); }
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
for (const id of Object.keys(V)) {
  const file = join(out, `znak-${id.toLowerCase()}.svg`);
  await pg.setContent(`<body style="margin:0">${readFileSync(file, 'utf8')}</body>`);
  await pg.screenshot({ path: join(out, `znak-${id.toLowerCase()}.png`), clip: { x: 0, y: 0, width: 1024, height: 1024 } });
}
const uri = (id) => `data:image/svg+xml;base64,${readFileSync(join(out, `znak-${id.toLowerCase()}.svg`)).toString('base64')}`;
const ids = Object.keys(V);
const fonts = join(here, '..', '..', 'makiety', 'ui-a', 'fonts');
const cell = (id, size, shape, bg) => {
  const r = shape === 'ios' ? size * 0.2237 : 0;
  if (shape === 'circle') { const sc = 1024 / 683; return `<div style="flex:none;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;position:relative;background:${bg}"><img src="${uri(id)}" style="position:absolute;width:${size * sc}px;left:${-size * (sc - 1) / 2}px;top:${-size * (sc - 1) / 2}px"></div>`; }
  return `<img src="${uri(id)}" style="width:${size}px;height:${size}px;border-radius:${r}px;display:block">`;
};
const rows = ids.map((id) => `<div class="row"><div class="nm"><b>${id}</b><br>${V[id].name}</div>
<div class="c dk">${cell(id, 168, 'ios')}<div class="sm">${cell(id, 48, 'ios')}${cell(id, 29, 'ios')}</div></div>
<div class="c lt">${cell(id, 168, 'ios')}<div class="sm">${cell(id, 48, 'ios')}${cell(id, 29, 'ios')}</div></div>
<div class="c dk">${cell(id, 168, 'circle', '#000')}<div class="sm">${cell(id, 48, 'circle', '#000')}${cell(id, 29, 'circle', '#000')}</div></div>
<div class="c lt">${cell(id, 168, 'circle', '#fff')}<div class="sm">${cell(id, 48, 'circle', '#fff')}</div></div></div>`).join('');
const html = `<style>@font-face{font-family:A;src:url(file://${fonts}/Archivo-VF.ttf);font-weight:100 900;font-stretch:62% 125%}
body{margin:0;background:#0E0F0F;font:600 13px A;color:#EFE7D3;width:1310px}
.h,.row{display:grid;grid-template-columns:150px 290px 290px 290px 290px;gap:0;align-items:stretch}
.h div{padding:14px 18px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#B9B2A2}
.row{border-top:1px solid #2A2E2B}.nm{padding:22px 18px;line-height:1.5}.nm b{font-size:18px;font-weight:800}
.c{display:flex;gap:16px;align-items:center;padding:20px}.dk{background:#2F3431}.lt{background:#EDE3C8}.sm{display:flex;flex-direction:column;gap:10px;align-items:flex-start}</style>
<div class="h"><div>Wariant</div><div>Ciemne tło · iOS</div><div>Jasne tło · iOS</div><div>Android koło (72/108)</div><div>Jasne tło · koło</div></div>${rows}`;
const p2 = await browser.newPage({ viewport: { width: 1310, height: 800 } });
await p2.setContent(html); await p2.waitForTimeout(400);
await p2.screenshot({ path: join(out, 'zestawienie-znak-2026-11c.png'), fullPage: true });
await browser.close();
