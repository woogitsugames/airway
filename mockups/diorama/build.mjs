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
  { family: 'Mono', file: 'OverpassMono-700.ttf', weight: 700 },
];
const IMPORTMAP = `<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","d3-geo":"/node_modules/d3-geo/src/index.js","d3-array":"/node_modules/d3-array/src/index.js","internmap":"/node_modules/internmap/src/index.js","topojson-client":"/node_modules/topojson-client/src/index.js"}}</script>`;

// UI language (owner 2.11: "the menus look like AI slop"): no app panels. Every piece of chrome is a real airport object:
// boarding pass (top bar), luggage tags on a cord (dock, passenger bubbles), ATC flight strip (hints), air-cargo labels
// (weekly upgrade), split-flap departure board + yellow wayfinding sign (menu). Sharp or die-cut corners, no drop shadows.
const K = { ink: '#2A2420', pass: '#FBF8F1', passLine: '#D8CFBF', teal: '#1E6F6A', kraft: '#D6B88A', kraftDark: '#B8955F', board: '#1C1E20', flap: '#2C2F32', flapText: '#F2EFE6', sign: '#FFC72C', red: '#C8352A', strip: '#F4EBC9' };
const CSS = `
body{font-family:Atk,sans-serif;color:${K.ink};background:linear-gradient(${C.skyTop},${C.sky})}
canvas.world{position:absolute;inset:0;width:100%;height:100%}
.hd{font-family:Over,sans-serif;font-weight:800}
.lab{font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:#7A6F62;font-weight:700}
.val{font-family:Over;font-weight:800;font-size:21px;line-height:1}
/* boarding pass: notched where main part meets the stub */
.pass{position:absolute;display:flex;height:60px;background:${K.pass};
  -webkit-mask:radial-gradient(circle 7px at var(--cut) 0,#0000 98%,#000) top/100% 51% no-repeat,radial-gradient(circle 7px at var(--cut) 100%,#0000 98%,#000) bottom/100% 51% no-repeat}
.pass .band{width:8px;background:${K.teal}}
.pass .cell{display:flex;flex-direction:column;justify-content:center;gap:4px;padding:0 10px}
.pass .perf{border-left:2px dashed ${K.passLine};margin:9px 0}
/* luggage tag: die-cut corners + eyelet */
.tagx{position:relative;display:flex;align-items:center;justify-content:center;gap:5px;background:${K.kraft};color:${K.ink};
  clip-path:polygon(14px 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%,0 14px);font-family:Over;font-weight:800;font-size:21px}
.tagx:before{content:'';position:absolute;top:6px;left:50%;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:${C.skyTop};box-shadow:0 0 0 2px ${K.kraftDark}}
.tagx.on{background:${K.pass}}
.cord{position:absolute;height:2px;background:${K.ink};opacity:.7}
.dock{position:absolute;display:flex;gap:8px}
.dock .tagx{width:64px;height:62px;padding-top:12px}
.dock.v{flex-direction:column}.dock.v .tagx{width:72px;height:58px}
.string{position:absolute;width:1.5px;background:${K.ink};opacity:.7}
/* passenger bubble = small white luggage tag on a string from the airport */
.bubble{position:absolute;transform:translate(-50%,-100%);display:flex;align-items:center;gap:2px;padding:4px 7px 4px 16px;background:${K.pass};color:${K.ink};
  clip-path:polygon(9px 0,100% 0,100% 100%,9px 100%,0 50%)}
.bubble:before{content:'';position:absolute;left:7px;top:50%;width:5px;height:5px;margin-top:-2.5px;border-radius:50%;background:${K.ink};opacity:.5}
.bubble.jam{background:${K.red};color:${K.pass}}
.bubble .t{font-family:Over;font-weight:800;font-size:13px;margin-left:3px}
/* air-cargo label: kraft, stencil header, field grid, zigzag tear at the bottom */
.cargo{position:absolute;background:${K.kraft};color:${K.ink};display:flex;
  clip-path:polygon(0 0,100% 0,100% calc(100% - 8px),96% 100%,92% calc(100% - 8px),88% 100%,84% calc(100% - 8px),80% 100%,76% calc(100% - 8px),72% 100%,68% calc(100% - 8px),64% 100%,60% calc(100% - 8px),56% 100%,52% calc(100% - 8px),48% 100%,44% calc(100% - 8px),40% 100%,36% calc(100% - 8px),32% 100%,28% calc(100% - 8px),24% 100%,20% calc(100% - 8px),16% 100%,12% calc(100% - 8px),8% 100%,4% calc(100% - 8px),0 100%)}
.cargo .win{flex:none;background:#EADCC2;border:2px solid ${K.ink};margin:10px}
.cargo .head{font-family:Mono;font-weight:700;font-size:11px;letter-spacing:.16em;border-bottom:2px solid ${K.ink};padding-bottom:4px;display:flex;justify-content:space-between}
.cargo .grid{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:13px;margin-top:6px}
.cargo .grid span:nth-child(odd){font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;padding-top:3px;color:#5E4E3A}
.cargo .stamp{display:inline-block;margin-top:8px;border:2px solid ${K.red};color:${K.red};font-family:Mono;font-weight:700;font-size:11px;letter-spacing:.1em;padding:2px 6px;transform:rotate(-3deg)}
/* split-flap departure board */
.board{position:absolute;background:${K.board};padding:10px 10px 12px}
.board .bh{display:flex;font-family:Mono;font-weight:700;font-size:10px;letter-spacing:.16em;color:#8B8F93;padding:0 2px 8px}
.row{display:flex;align-items:center;gap:8px;height:58px;border-top:1px solid #000}
.row .st{margin-left:auto;font-family:Mono;font-weight:700;font-size:11px;letter-spacing:.08em}
.fl{display:inline-flex;gap:2px}.fl i{font-style:normal;display:inline-block;width:14px;height:24px;line-height:24px;text-align:center;font-family:Mono;font-weight:700;font-size:15px;color:${K.flapText};
  background:linear-gradient(${K.flap} 0 49%,#000 49% 52%,#25282B 52%)}
.fl.y i{color:${K.sign}}
.sub{font-size:11.5px;color:#9A9EA2;margin-top:3px}
/* yellow-on-black airport wayfinding sign with the game title */
.sign{position:absolute;display:flex;align-items:center;gap:14px;background:${K.sign};color:${K.board};padding:10px 18px 10px 12px}
.sign .pict{background:${K.board};display:flex;align-items:center;justify-content:center}
/* ATC flight progress strip */
.strip{position:absolute;display:flex;white-space:nowrap;background:${K.strip};font-size:12px;line-height:1.3;border-left:10px solid ${K.red}}
.strip .f{padding:6px 9px;border-right:1px solid #CDBF8F}.strip .f:last-child{border:0}
.strip b{font-family:Over;font-weight:800;font-size:15px;color:${K.red}}
`;
const g = (name, size, fill) => `<svg width="${size}" height="${size}" viewBox="-7 -7 14 14"><path d="${GLYPHS[name]}" fill="${fill}" stroke="${K.pass}" stroke-width="1" paint-order="stroke"/></svg>`;
const p = (type, size, fill, rot = -90) => { const P = PLANES[type]; return `<svg width="${size}" height="${size}" viewBox="-13 -13 26 26"><g transform="rotate(${rot})" fill="${fill}"><path d="${P.wing}"/><path d="${P.tail}"/><path d="${P.body}"/><path d="${P.extra}"/></g></svg>`; };
const ICON = {
  undo: `<svg width="28" height="28" viewBox="-14 -14 28 28"><path d="M8 7 A8 8 0 1 0 -6 -2" fill="none" stroke="${K.ink}" stroke-width="2.8"/><path d="M-11 -8 L-5 1 L0 -7Z" fill="${K.ink}"/></svg>`,
  pause: `<svg width="22" height="22" viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" fill="${K.ink}"/><rect x="14" y="4" width="5" height="16" fill="${K.ink}"/></svg>`,
  fast: `<svg width="28" height="28" viewBox="-14 -14 28 28"><path d="M-12 -8 L0 0 L-12 8Z M0 -8 L12 0 L0 8Z" fill="${K.ink}"/></svg>`,
  hub: `<svg width="26" height="26" viewBox="-13 -13 26 26">${Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return `<path d="M${Math.cos(a) * 6} ${Math.sin(a) * 6} L${Math.cos(a) * 11} ${Math.sin(a) * 11}" stroke="${K.ink}" stroke-width="3"/>`; }).join('')}</svg>`,
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
if (tag) { const c = CITIES[tag.at], pt = project(c.lon, c.lat, 1.02); const el = document.getElementById('tag'); el.style.left = Math.max(12, Math.min(cfg.w - 320, pt.x + tag.dx)) + 'px'; el.style.top = (pt.y + tag.dy) + 'px'; el.style.display = 'block'; }
window.__ready = true;
</script>`;
}

/** Boarding pass: week / day / time on the main part, passengers on the stub, pause as a separate ticket stub. */
const topBar = (x, y, w) => `
<div class="pass" style="left:${x}px;top:${y}px;width:${w - 64}px;--cut:${w - 64 - 104}px">
  <div class="band"></div>
  <div class="cell"><div class="lab">Tydzień</div><div class="val">${String(CLOCK.week).padStart(2, '0')}</div></div>
  <div class="cell"><div class="lab">Dzień</div><div class="val">${CLOCK.dayPl.toUpperCase()}</div><div style="display:flex;gap:2px">${Array.from({ length: 7 }, (_, i) => `<i style="width:6px;height:6px;background:${i < 2 ? K.ink : i === 2 ? K.red : K.passLine}"></i>`).join('')}</div></div>
  <div class="cell"><div class="lab">Godz.</div><div class="val">${CLOCK.time}</div></div>
  <div style="flex:1"></div><div class="perf"></div>
  <div class="cell" style="width:104px"><div class="lab">Pasażerów</div><div class="val">1 284</div></div>
</div>
<div class="pass" style="left:${x + w - 56}px;top:${y}px;width:56px;--cut:-20px;align-items:center;justify-content:center;border-top:6px solid ${K.teal}">${ICON.pause}</div>`;

/** Dock: luggage tags hanging from a cord (thumb row). Pale tag = the plane type currently selected for drawing. */
const dockHtml = (style, vertical, cord) => `${cord}<div class="dock${vertical ? ' v' : ''}" style="${style}">
  <div class="tagx">${ICON.undo}</div>
  <div class="tagx on">${p('turboprop', 32, K.ink)}2</div>
  <div class="tagx">${p('widebody', 34, K.ink)}1</div>
  <div class="tagx" style="opacity:.55">${ICON.hub}0</div>
  <div class="tagx">${ICON.fast}</div></div>`;

const tagHtml = `<div class="strip" id="tag" style="display:none"><div class="f"><b>3 788 km</b><br>LIS → ACC</div><div class="f">za daleko dla<br>turbośmigłowca</div><div class="f">wskaż miasto<br>po drodze</div></div>`;

function gameP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const cfg = { w, h, look: [7, 35], dist: 2.6, tilt: 21, fov: 30, offset: [0, 70] };
  const body = `<canvas class="world" width="${w * 2}" height="${h * 2}"></canvas><div id="bubbles"></div>${tagHtml}
  ${topBar(12, sf.t + 4, w - 24)}
  ${dockHtml(`left:14px;right:14px;bottom:${sf.b + 10}px;justify-content:space-between`, false, `<div class="cord" style="left:0;right:0;bottom:${sf.b + 74}px"></div>`)}
  ${script(cfg, { tag: { at: 'ACC', dx: -190, dy: -90 } })}`;
  writePage(dir, 'game-p', { w, h, title: 'Diorama — gra', fonts: FONTS, css: CSS, body });
}
function gameL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const cfg = { w, h, look: [6, 40], dist: 1.35, tilt: 18, fov: 30, offset: [-60, -30], top: 70 };
  const body = `<canvas class="world" width="${w * 2}" height="${h * 2}"></canvas><div id="bubbles"></div>${tagHtml}
  ${topBar(sf.l + 8, 12, 420)}
  ${dockHtml(`right:${sf.r + 10}px;top:14px;bottom:${sf.b + 10}px;justify-content:space-between`, true, `<div class="cord" style="top:0;bottom:0;right:${sf.r + 86}px;width:2px;height:auto"></div>`)}
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
/** Weekly upgrade = an air-cargo label stuck on the crate the hangar received. */
const SPEC = { turboprop: [['Zasięg', '2 500 km'], ['Miejsc', '48'], ['Najlepszy', 'krótkie trasy']], widebody: [['Zasięg', '11 000 km'], ['Miejsc', '300'], ['Najlepszy', 'przez ocean']], hub: [['Miejsca', '+6 w poczekalni'], ['Przesiadka', '25 → 15 min'], ['Dla', 'wybranego huba']] };
const card = (u, i, style, mw, mh, compact) => `<div class="cargo" style="${style};${compact ? 'flex-direction:column' : ''}">
  <canvas class="win" id="m${i}" width="${mw * 2}" height="${mh * 2}" style="width:${mw}px;height:${mh}px"></canvas>
  <div style="padding:${compact ? '0 14px 16px' : '12px 14px 14px 2px'};flex:1;min-width:0">
    <div class="head"><span>FRACHT · ${['TP-48', 'WB-300', 'HUB+6'][i]}</span><span>${i + 1}/3</span></div>
    <div class="hd" style="font-size:${u.pl.length > 15 ? 19 : 22}px;margin-top:7px;line-height:1.05">${u.pl}</div>
    <div class="grid">${SPEC[u.id].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('')}</div>
    ${i === 2 ? `<div class="stamp">LONDYN 11/12</div>` : ''}
  </div></div>`;
function upgradeP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const cfg = { w, h, look: [7, 35], dist: 2.6, tilt: 21, fov: 30, offset: [0, 70], drag: false, light: .55 };
  const cw = w - 24, mh = 150, mw = 150;
  const body = `<canvas class="world"></canvas>
  <div style="position:absolute;inset:0;background:${K.board};opacity:.6"></div>
  <div class="sign" style="left:12px;top:${sf.t + 10}px;right:12px"><div class="hd" style="font-size:30px">Tydzień ${CLOCK.week + 1}</div><div style="font-size:14px;font-weight:700">Hangar: przyszły trzy skrzynie.<br>Otwierasz jedną.</div></div>
  ${UPGRADES.map((u, i) => card(u, i, `left:12px;width:${cw}px;top:${sf.t + 108 + i * (mh + 38)}px;height:${mh + 24}px`, mw, mh)).join('')}
  ${upgradeScript(cfg, [mw, mh])}`;
  writePage(dir, 'upgrade-p', { w, h, title: 'Diorama — ulepszenie', fonts: FONTS, css: CSS, body });
}
function upgradeL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const cfg = { w, h, look: [6, 38], dist: 1.9, tilt: 14, fov: 30, drag: false, light: .55 };
  const cw = (w - sf.l - sf.r - 32 - 28) / 3, mh = 170;
  const body = `<canvas class="world"></canvas><div style="position:absolute;inset:0;background:${K.board};opacity:.6"></div>
  <div class="sign" style="left:${sf.l + 16}px;top:10px"><div class="hd" style="font-size:26px">Tydzień ${CLOCK.week + 1}</div><div style="font-size:14px;font-weight:700">Hangar: przyszły trzy skrzynie. Otwierasz jedną.</div></div>
  ${UPGRADES.map((u, i) => card(u, i, `left:${sf.l + 16 + i * (cw + 14)}px;width:${cw}px;top:72px;height:${h - 72 - sf.b - 4}px`, Math.round(cw - 24), 130, true)).join('')}
  ${upgradeScript(cfg, [Math.round(cw - 24), 130])}`;
  writePage(dir, 'upgrade-l', { w, h, title: 'Diorama — ulepszenie (poziomo)', fonts: FONTS, css: CSS, body });
}

/** Menu = departure board: each game mode is a "flight" with a gate and a status. Rows are 58 dp touch targets. */
const flaps = (t, y) => `<span class="fl${y ? ' y' : ''}">${[...t].map((c) => `<i>${c === ' ' ? '' : c}</i>`).join('')}</span>`;
const menuList = (style) => `<div class="board" style="${style}">
  <div class="bh"><span style="flex:1">ODLOTY</span><span style="width:64px">BRAMKA</span><span style="width:70px">STATUS</span></div>
  ${[['LOT BEZ KOŃCA', 'rekord 2 914 pasażerów', 'A1', 'WEJŚCIE', true], ['ZADANIA', '12 z 40 rozwiązanych', 'B4', 'PLANOWO'], ['DZIŚ 02.11', 'ten sam świat dla wszystkich', 'C2', 'NOWY'], ['USTAWIENIA', '', 'D0', '']]
    .map(([t, sub, gate, st, hot]) => `<div class="row"><div>${flaps(t, hot)}${sub ? `<div class="sub">${sub}</div>` : ''}</div><span class="st" style="color:#8B8F93">${flaps(gate)}</span><span class="st" style="margin-left:6px;width:64px;color:${hot ? K.sign : '#C9CCCF'}">${st}</span></div>`).join('')}
</div>`;
function menuScript(cfg) { return `${IMPORTMAP}<script type="module">import { buildScene } from './scene3d.js'; await buildScene({ canvas: document.querySelector('canvas.world'), ...${JSON.stringify(cfg)} }); window.__ready = true;</script>`; }
/** Title on a yellow wayfinding sign with our own pictogram (the widebody planform), like a terminal sign. */
const logo = (style, size) => `<div class="sign" style="${style}"><div class="pict" style="width:${size * 1.1}px;height:${size * 1.1}px">${p('widebody', size, K.sign, -45)}</div>
  <div><div class="hd" style="font-size:${size}px;line-height:.9">${TITLE.main[0] + TITLE.main.slice(1).toLowerCase()}</div><div style="font-family:Mono;font-weight:700;font-size:12px;letter-spacing:.14em;margin-top:6px">${TITLE.sub.toUpperCase()} · TERMINAL 1</div></div></div>`;
function menuP() {
  const [w, h] = [412, 915], sf = SAFE.p;
  const cfg = { w, h, look: [-22, 30], dist: 3.6, tilt: 12, fov: 30, offset: [0, -40], drag: false };
  const body = `<canvas class="world"></canvas>${logo(`left:16px;top:${sf.t + 16}px`, 50)}${menuList(`left:12px;right:12px;bottom:${sf.b + 12}px`)}${menuScript(cfg)}`;
  writePage(dir, 'menu-p', { w, h, title: 'Diorama — menu', fonts: FONTS, css: CSS, body });
}
function menuL() {
  const [w, h] = [915, 412], sf = SAFE.l;
  const cfg = { w, h, look: [-22, 30], dist: 3.2, tilt: 10, fov: 30, offset: [-200, 0], drag: false };
  const body = `<canvas class="world"></canvas>${logo(`left:${sf.l + 16}px;top:14px`, 40)}${menuList(`left:${sf.l + 16}px;width:390px;bottom:${sf.b + 8}px`)}${menuScript(cfg)}`;
  writePage(dir, 'menu-l', { w, h, title: 'Diorama — menu (poziomo)', fonts: FONTS, css: CSS, body });
}

gameP(); gameL(); upgradeP(); upgradeL(); menuP(); menuL();
