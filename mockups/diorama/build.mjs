// Direction "Diorama": low-poly 3D globe (three.js, rendered in the page) + HTML/SVG HUD.
// Info lives in the world: hub lounges are rings on the apron, bubbles sit above airports.
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePage, SAFE } from '../lib/page.mjs';
import { GLYPHS, PLANES, REGIONS, HUBS, CITIES_WAITING, CLOCK, TITLE, UPGRADES } from '../lib/scene.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
export const C = { panel: '#13302E', panel2: '#1C423F', line: '#2E5B56', paper: '#F7F3EA', dim: '#A9BDB8', accent: '#FF7A3D', warn: '#FFB23D', jam: '#C8352A', sky: '#BFE0EA', skyTop: '#8CC3D8' };
const DEST = { NAM: '#0072B2', EUN: '#009E73', EUS: '#E69F00', AFR: '#13302E', ME: '#CC79A7', SAM: '#56B4E9' }; // CVD-checked (min ΔE ≥ 16 in all three simulations)
const FONTS = [
  { family: 'Over', file: 'Overpass-800.ttf', weight: 800 }, { family: 'Over', file: 'Overpass-400.ttf', weight: 400 },
  { family: 'Atk', file: 'AtkinsonHyperlegibleNext-400.ttf', weight: 400 }, { family: 'Atk', file: 'AtkinsonHyperlegibleNext-700.ttf', weight: 700 },
];
const IMPORTMAP = `<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","d3-geo":"/node_modules/d3-geo/src/index.js","d3-array":"/node_modules/d3-array/src/index.js","internmap":"/node_modules/internmap/src/index.js","topojson-client":"/node_modules/topojson-client/src/index.js"}}</script>`;

const CSS = `
body{font-family:Atk,sans-serif;color:${C.paper};background:linear-gradient(${C.skyTop},${C.sky})}
canvas.world{position:absolute;inset:0;width:100%;height:100%}
.panel{position:absolute;background:${C.panel};border:1.5px solid ${C.line};border-radius:12px}
.hd{font-family:Over,sans-serif;font-weight:800}
.btn{position:absolute;width:56px;height:56px;border-radius:12px;background:${C.panel};border:1.5px solid ${C.line};display:flex;align-items:center;justify-content:center}
.chip{display:flex;align-items:center;gap:6px;height:56px;padding:0 12px;border-radius:12px;background:${C.panel2};border:1.5px solid ${C.line};font-family:Over;font-weight:800;font-size:20px}
.dock.v .chip{width:72px!important;justify-content:center;padding:0;height:58px}
.dock{position:absolute;display:flex;gap:8px;padding:8px;background:${C.panel};border:1.5px solid ${C.line};border-radius:16px}
.bubble{position:absolute;transform:translate(-50%,-100%);background:${C.paper};color:${C.panel};border-radius:10px;padding:5px 7px 4px;display:flex;align-items:center;gap:3px;border:1.5px solid ${C.panel}}
.bubble:after{content:'';position:absolute;left:50%;bottom:-7px;margin-left:-6px;border:6px solid transparent;border-top-color:${C.panel};border-bottom:0}
.bubble.jam{background:${C.jam};color:${C.paper}}
.bubble .t{font-family:Over;font-weight:800;font-size:13px;margin-left:3px}
.tag{position:absolute;background:${C.panel};border:1.5px solid ${C.jam};border-radius:10px;padding:6px 9px;font-size:12px;line-height:1.3}
.tag b{font-family:Over;font-weight:800;color:${C.warn};font-size:14px}
`;

const g = (name, size, fill) => `<svg width="${size}" height="${size}" viewBox="-7 -7 14 14"><path d="${GLYPHS[name]}" fill="${fill}" stroke="${C.paper}" stroke-width="1.2" paint-order="stroke"/></svg>`;
const p = (type, size, fill, rot = -90) => { const P = PLANES[type]; return `<svg width="${size}" height="${size}" viewBox="-13 -13 26 26"><g transform="rotate(${rot})" fill="${fill}"><path d="${P.wing}"/><path d="${P.tail}"/><path d="${P.body}"/><path d="${P.extra}"/></g></svg>`; };
const ICON = {
  undo: `<svg width="28" height="28" viewBox="-14 -14 28 28"><path d="M8 7 A8 8 0 1 0 -6 -2" fill="none" stroke="${C.paper}" stroke-width="2.6" stroke-linecap="round"/><path d="M-11 -8 L-5 1 L0 -7Z" fill="${C.paper}"/></svg>`,
  pause: `<svg width="24" height="24" viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.5" fill="${C.paper}"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="${C.paper}"/></svg>`,
  fast: `<svg width="28" height="28" viewBox="-14 -14 28 28"><path d="M-12 -8 L0 0 L-12 8Z M0 -8 L12 0 L0 8Z" fill="${C.paper}"/></svg>`,
  hub: `<svg width="26" height="26" viewBox="-13 -13 26 26">${Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return `<path d="M${Math.cos(a) * 6} ${Math.sin(a) * 6} L${Math.cos(a) * 11} ${Math.sin(a) * 11}" stroke="${C.dim}" stroke-width="3" stroke-linecap="round"/>`; }).join('')}</svg>`,
};

/** Passenger bubble: glyph queue + count; jam bubble red with countdown. */
const bubbleData = () => {
  const out = {};
  for (const [k, h] of Object.entries(HUBS)) out[k] = { list: h.waiting, cap: h.cap, jam: !!h.warn };
  for (const [k, l] of Object.entries(CITIES_WAITING)) if (l.length) out[k] = { list: l };
  return out;
};
const GLYPH_HTML = Object.fromEntries(Object.keys(REGIONS).map((r) => [r, g(REGIONS[r].glyph, 15, DEST[r])]));

/** Page script: build the 3D scene, then place bubbles by projecting airports. */
function script(cfg, { bubbles = true, tag = null } = {}) {
  return `${IMPORTMAP}<script type="module">
import { buildScene } from './scene3d.js';
import { CITIES } from '../lib/cities.mjs';
const cfg = ${JSON.stringify(cfg)};
const B = ${JSON.stringify(bubbles ? bubbleData() : {})}, G = ${JSON.stringify(GLYPH_HTML)};
const { project } = await buildScene({ canvas: document.querySelector('canvas.world'), ...cfg });
const layer = document.getElementById('bubbles');
for (const [code, b] of Object.entries(B)) {
  const c = CITIES[code], pt = project(c.lon, c.lat, b.cap ? 1.075 : 1.045);
  if (!pt.front || pt.x < 10 || pt.x > cfg.w - 10 || pt.y < (cfg.top ?? 90) || pt.y > cfg.h - (cfg.top ? 20 : 110)) continue;
  const el = document.createElement('div'); el.className = 'bubble' + (b.jam ? ' jam' : '');
  const show = b.list.slice(0, 6).map((r) => G[r]).join('');
  el.innerHTML = show + (b.list.length > 6 ? '<span class="t">+' + (b.list.length - 6) + '</span>' : '') + (b.jam ? '<span class="t">0:42</span>' : '');
  el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px'; layer.appendChild(el);
}
const tag = ${JSON.stringify(tag)};
if (tag) { const c = CITIES[tag.at], pt = project(c.lon, c.lat, 1.02); const el = document.getElementById('tag'); el.style.left = Math.max(12, Math.min(cfg.w - 300, pt.x + tag.dx)) + 'px'; el.style.top = (pt.y + tag.dy) + 'px'; el.style.display = 'block'; }
window.__ready = true;
</script>`;
}

const topBar = (x, y, w) => `
<div class="panel" style="left:${x}px;top:${y}px;height:56px;padding:6px 14px;display:flex;flex-direction:column;justify-content:center">
  <div class="hd" style="font-size:19px;line-height:1">Tydzień ${CLOCK.week} <span style="color:${C.dim};font-size:15px">· ${CLOCK.dayPl} ${CLOCK.time}</span></div>
  <div style="display:flex;gap:3px;margin-top:6px">${Array.from({ length: 7 }, (_, i) => `<div style="width:18px;height:5px;border-radius:3px;background:${i < 2 ? C.paper : i === 2 ? C.accent : C.line}"></div>`).join('')}</div>
</div>
<div class="panel" style="left:${x + w - 56 - 8 - 118}px;top:${y}px;width:118px;height:56px;display:flex;align-items:center;gap:8px;padding:0 12px">
  <svg width="22" height="22" viewBox="-7 -7 14 14"><path d="${GLYPHS.keyhole}" fill="${C.paper}"/></svg>
  <div><div class="hd" style="font-size:19px;line-height:1">1 284</div><div style="font-size:10.5px;color:${C.dim}">pasażerów</div></div></div>
<div class="btn" style="left:${x + w - 56}px;top:${y}px">${ICON.pause}</div>`;

const dockHtml = (style, vertical) => `<div class="dock${vertical ? ' v' : ''}" style="${style};${vertical ? 'flex-direction:column' : ''}">
  <div class="chip" style="width:56px;justify-content:center;padding:0">${ICON.undo}</div>
  <div class="chip">${p('turboprop', 34, '#FFD166')}<span>2</span></div>
  <div class="chip">${p('widebody', 36, C.paper)}<span>1</span></div>
  <div class="chip" style="color:${C.dim}">${ICON.hub}<span>0</span></div>
  <div class="chip" style="width:56px;justify-content:center;padding:0">${ICON.fast}</div></div>`;

const tagHtml = `<div class="tag" id="tag" style="display:none"><b>3 788 km</b> · za daleko dla turbośmigłowca<br>puść na mieście po drodze, aby dodać międzylądowanie</div>`;

function gameP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const cfg = { w, h, look: [7, 35], dist: 2.6, tilt: 21, fov: 30, offset: [0, 70] };
  const body = `<canvas class="world" width="${w * 2}" height="${h * 2}"></canvas><div id="bubbles"></div>${tagHtml}
  ${topBar(12, sf.t + 4, w - 24)}
  ${dockHtml(`left:12px;right:12px;bottom:${sf.b + 8}px;justify-content:space-between`)}
  ${script(cfg, { tag: { at: 'ACC', dx: -190, dy: -90 } })}`;
  writePage(dir, 'game-p', { w, h, title: 'Diorama — gra', fonts: FONTS, css: CSS, body });
}
function gameL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const cfg = { w, h, look: [6, 40], dist: 1.35, tilt: 18, fov: 30, offset: [-60, -30], top: 70 };
  const body = `<canvas class="world" width="${w * 2}" height="${h * 2}"></canvas><div id="bubbles"></div>${tagHtml}
  ${topBar(sf.l + 8, 12, 420)}
  ${dockHtml(`right:${sf.r + 8}px;top:12px;bottom:${sf.b + 8}px;justify-content:space-between`, true)}
  ${script(cfg, { tag: { at: 'ACC', dx: 20, dy: -70 } })}`;
  writePage(dir, 'game-l', { w, h, title: 'Diorama — gra (poziomo)', fonts: FONTS, css: CSS, body });
}

/** Upgrade: three 3D models on pedestals (hangar cards). */
function upgradeScript(cfg, sizes) {
  return `${IMPORTMAP}<script type="module">
import { buildScene, renderModel, planeModel, airportModel, THREE } from './scene3d.js';
await buildScene({ canvas: document.querySelector('canvas.world'), ...${JSON.stringify(cfg)} });
const S = ${JSON.stringify(sizes)};
const tp = planeModel('turboprop'), wb = planeModel('widebody'); wb.scale.setScalar(.75);
const hubG = new THREE.Group(); const a = airportModel('LON', true); a.position.set(0,0,0); a.quaternion.identity(); a.scale.setScalar(15); hubG.add(a); hubG.position.y = -.3;
[tp, wb, hubG].forEach((m, i) => renderModel(document.getElementById('m' + i), S[0], S[1], m, { rotY: [.7, .7, .4][i] }));
window.__ready = true;
</script>`;
}
const card = (u, i, style, mw, mh, compact) => `<div class="panel" style="${style};padding:0;overflow:hidden;display:flex;${compact ? 'flex-direction:column' : ''}">
  <canvas id="m${i}" width="${mw * 2}" height="${mh * 2}" style="width:${mw}px;height:${mh}px;background:${C.panel2};flex:none"></canvas>
  <div style="padding:${compact ? '10px 14px' : '14px 14px 12px 6px'};display:flex;flex-direction:column;gap:5px">
    <div style="font-size:11.5px;color:${C.warn};font-family:Over;font-weight:800;letter-spacing:.06em">${u.note.toUpperCase()}</div>
    <div class="hd" style="font-size:${u.pl.length > 15 ? 19 : 22}px;line-height:1.05">${u.pl}</div>
    <div style="font-size:13px;color:${C.dim}">${u.specPl.replace(' · ', '<br>')}</div>
  </div></div>`;
function upgradeP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const cfg = { w, h, look: [7, 35], dist: 2.6, tilt: 21, fov: 30, offset: [0, 70], drag: false, light: .55 };
  const cw = w - 24, mh = 150, mw = 170;
  const body = `<canvas class="world"></canvas>
  <div style="position:absolute;inset:0;background:${C.panel};opacity:.55"></div>
  <div style="position:absolute;left:20px;top:${sf.t + 16}px"><div class="hd" style="font-size:34px">Tydzień ${CLOCK.week + 1}</div><div style="font-size:15px;color:${C.paper};margin-top:4px">Hangar dostał jedną dostawę. Co bierzesz?</div></div>
  ${UPGRADES.map((u, i) => card(u, i, `left:12px;width:${cw}px;top:${sf.t + 104 + i * (mh + 14)}px;height:${mh}px`, mw, mh)).join('')}
  <div style="position:absolute;left:20px;right:20px;bottom:${sf.b + 70}px;font-size:13px;color:${C.paper};opacity:.85">Londyn ma 11 z 12 miejsc. Rozbudowa da mu oddech, nowy samolot rozładuje kolejkę szybciej.</div>
  ${upgradeScript(cfg, [mw, mh])}`;
  writePage(dir, 'upgrade-p', { w, h, title: 'Diorama — ulepszenie', fonts: FONTS, css: CSS, body });
}
function upgradeL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const cfg = { w, h, look: [6, 38], dist: 1.9, tilt: 14, fov: 30, drag: false, light: .55 };
  const cw = (w - sf.l - sf.r - 32 - 28) / 3, mh = 170;
  const body = `<canvas class="world"></canvas><div style="position:absolute;inset:0;background:${C.panel};opacity:.55"></div>
  <div style="position:absolute;left:${sf.l + 16}px;top:14px;display:flex;align-items:baseline;gap:16px"><div class="hd" style="font-size:30px">Tydzień ${CLOCK.week + 1}</div><div style="font-size:15px">Hangar dostał jedną dostawę. Co bierzesz?</div></div>
  ${UPGRADES.map((u, i) => card(u, i, `left:${sf.l + 16 + i * (cw + 14)}px;width:${cw}px;top:66px;height:${h - 66 - sf.b - 10}px`, cw, mh, true)).join('')}
  ${upgradeScript(cfg, [Math.round(cw), mh])}`;
  writePage(dir, 'upgrade-l', { w, h, title: 'Diorama — ulepszenie (poziomo)', fonts: FONTS, css: CSS, body });
}

const menuList = (style) => `<div style="position:absolute;${style};display:flex;flex-direction:column;gap:10px">
  <div class="panel" style="position:relative;background:${C.accent};border-color:${C.accent};height:68px;display:flex;align-items:center;gap:14px;padding:0 18px;color:${C.panel}">
    ${p('widebody', 40, C.panel, 0)}<div><div class="hd" style="font-size:22px;line-height:1">Lot bez końca</div><div style="font-size:12.5px;margin-top:3px">rekord: 2 914 pasażerów</div></div></div>
  ${[['Zadania', '12 z 40 rozwiązanych'], ['Wyzwanie dnia', '2 listopada · ten sam świat dla wszystkich'], ['Ustawienia', '']].map(([t, s]) => `<div class="panel" style="position:relative;height:56px;display:flex;flex-direction:column;justify-content:center;padding:0 18px"><div class="hd" style="font-size:18px;line-height:1">${t}</div>${s ? `<div style="font-size:12px;color:${C.dim};margin-top:3px">${s}</div>` : ''}</div>`).join('')}
</div>`;
function menuScript(cfg) { return `${IMPORTMAP}<script type="module">import { buildScene } from './scene3d.js'; await buildScene({ canvas: document.querySelector('canvas.world'), ...${JSON.stringify(cfg)} }); window.__ready = true;</script>`; }
const logo = (style, size) => `<div style="position:absolute;${style}"><div class="hd" style="font-size:${size}px;line-height:.9;color:${C.panel};letter-spacing:-.01em">${TITLE.main[0] + TITLE.main.slice(1).toLowerCase()}</div><div style="font-family:Over;font-weight:800;font-size:13px;color:${C.panel};opacity:.75;margin-top:8px;letter-spacing:.08em">${TITLE.sub.toUpperCase()}</div></div>`;
function menuP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const cfg = { w, h, look: [-22, 30], dist: 3.6, tilt: 12, fov: 30, offset: [0, -40], drag: false };
  const body = `<canvas class="world"></canvas>${logo(`left:22px;top:${sf.t + 22}px`, 64)}${menuList(`left:16px;right:16px;bottom:${sf.b + 16}px`)}${menuScript(cfg)}`;
  writePage(dir, 'menu-p', { w, h, title: 'Diorama — menu', fonts: FONTS, css: CSS, body });
}
function menuL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const cfg = { w, h, look: [-22, 30], dist: 3.2, tilt: 10, fov: 30, offset: [-200, 0], drag: false };
  const body = `<canvas class="world"></canvas>${logo(`left:${sf.l + 20}px;top:26px`, 56)}${menuList(`left:${sf.l + 16}px;width:330px;bottom:${sf.b + 12}px`).replace('gap:10px', 'gap:8px')}${menuScript(cfg)}`;
  writePage(dir, 'menu-l', { w, h, title: 'Diorama — menu (poziomo)', fonts: FONTS, css: CSS, body });
}

gameP(); gameL(); upgradeP(); upgradeL(); menuP(); menuL();
