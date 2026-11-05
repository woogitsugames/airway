// KARTA v2 (night 11ay): shared stage, airport geometry and the dock symbol set for variants A/B/C.
// Frames: docs/mockups/ui-2026-11/v2/_frames (real game render, UI hidden, airport medallions removed by
// clean-frames.py). Everything drawn here is a design proposal; airport markers belong to src/render (ext session).
import { AIRPORTS, GLYPH, REGION, groups } from '../common/data.js';
export { AIRPORTS, GLYPH, REGION, groups };

export const VIEWS = {
  'game-p': { w: 412, h: 915, frame: 'game-p', key: 'p' },
  'game-l': { w: 915, h: 412, frame: 'game-l', key: 'l' },
  'jam': { w: 412, h: 412, frame: 'game-p', key: 'p', zoom: 1.7, center: [222, 522] },
  'menu-p': { w: 412, h: 915, frame: 'menu-p', key: 'm' },
};
// Discs removed from the frames (CSS px), same list as clean-frames.py.
export const MASK = {
  p: [[150, 290, 25, 23], [58, 367, 25, 23], [121, 430, 40, 37], [194, 413, 26, 25], [218, 488, 40, 37], [291, 474, 27, 26]],
  l: [[360, 129, 21, 16], [282, 183, 21, 17], [330, 229, 33, 29], [392, 215, 22, 19], [413, 275, 34, 31], [475, 263, 24, 21], [637, 320, 18, 22]],
};
// Menu frame pads (decorative network behind the menu), [x, y, hub].
export const MENU_PADS = [[314, 290, 0], [252, 336, 0], [291, 345, 1], [313, 368, 0], [289, 434, 1], [256, 450, 0], [269, 492, 0], [195, 667, 0]];
export const ROUTES = [['RIX', 'VCE'], ['VCE', 'ATH'], ['ATH', 'AMM'], ['ANK', 'AMM'], ['AMM', 'BGW'], ['BGW', 'KHI']];
const OFF_P = { KHI: [470, 520] };

export const byCode = (c) => AIRPORTS.find((a) => a.code === c);
export function pos(a, key) { return key === 'l' ? a.l : a.p || OFF_P[a.code]; }
/** Visual radius of the proposed marker (sized by capacity, hub bigger). */
export const rad = (a, key) => (a.hub ? 17 : 11) * (key === 'l' ? 0.92 : 1);

/** Redraw the game's dashed routes only inside the removed discs, so the routes still reach the new markers. */
export function routeStubs(key) {
  const m = MASK[key]; if (!m) return '';
  const clip = m.map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx + 1}" ry="${ry + 1}"/>`).join('');
  const lines = ROUTES.map(([a, b]) => { const p = pos(byCode(a), key), q = pos(byCode(b), key);
    return `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`; }).join('');
  return `<clipPath id="stub-${key}">${clip}</clipPath><g clip-path="url(#stub-${key})" stroke="#EDD98E" stroke-width="1.7" stroke-dasharray="5 4" fill="none" opacity=".95">${lines}</g>`;
}

/** Runway pattern (chart airport symbol). small: one runway; hub: two parallels + a crossing runway. */
export function runways(hub, r, { fill, halo, hw = 2.4, outline = false }) {
  const L = hub ? r * 1.25 : r * 1.35, W = hub ? 3.2 : 2.8;
  const rects = hub
    ? [[-4.2, 0, L, W, -25], [4.6, 1.5, L * 0.86, W, -25], [0, 0, L * 0.72, W * 0.9, 58]]
    : [[0, 0, L, W, -25]];
  const r1 = (st) => rects.map(([x, y, l, w, a]) => `<rect x="${x - w / 2}" y="${y - l / 2}" width="${w}" height="${l}" transform="rotate(${a})" ${st}/>`).join('');
  return `<g>${r1(`fill="${halo}" stroke="${halo}" stroke-width="${hw * 2}" stroke-linejoin="round"`)}${r1(outline ? `fill="none" stroke="${fill}" stroke-width="1.1"` : `fill="${fill}"`)}</g>`;
}

/** Ring of seat ticks: one per waiting place. Taken = a tick (with halo); free = a small dot, so capacity stays visible
 * without turning the marker into a cog. */
export function seatTicks(r, cap, n, { on, off, halo, len = 5, w = 1.8, start = -90, dot = 0.9 }) {
  let s = '';
  for (let i = 0; i < cap; i++) {
    const a = ((start + (i * 360) / cap) * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
    if (i < n) {
      const d = `M${(c * (r + 1)).toFixed(2)} ${(sn * (r + 1)).toFixed(2)}L${(c * (r + len)).toFixed(2)} ${(sn * (r + len)).toFixed(2)}`;
      s += `<path d="${d}" stroke="${halo}" stroke-width="${w + 2}"/><path d="${d}" stroke="${on}" stroke-width="${w}"/>`;
    } else if (off) {
      s += `<circle cx="${(c * (r + len * 0.6)).toFixed(2)}" cy="${(sn * (r + len * 0.6)).toFixed(2)}" r="${dot}" fill="${off}"/>`;
    }
  }
  return s;
}

/** Passenger glyph (D-08 shape + colour) with an outline that separates it from the ground. */
export function glyphAt(x, y, region, size = 13, ink = '#fff', inkW = 2.2) {
  const r = REGION[region];
  return `<g transform="translate(${x} ${y}) scale(${size / 13})"><path d="${GLYPH[r.g]}" fill="${r.c}" stroke="${ink}" stroke-width="${inkW}" paint-order="stroke" stroke-linejoin="round"/></g>`;
}
/** Glyph groups "glyph count" in a row; returns [svg, width]. */
export function glyphRow(x, y, wait, { size = 12, ink = '#fff', inkW = 2.2, text, gap = 7 }) {
  let s = '', cx = x;
  for (const g of groups(wait)) {
    s += glyphAt(cx + size / 2, y, g.id, size, ink, inkW);
    s += text(cx + size + 2, y + size * 0.38, String(g.n));
    cx += size + 4 + String(g.n).length * size * 0.58 + gap;
  }
  return [s, cx - x];
}

/** Text with a cartographic halo (stroke under fill). */
export function T(x, y, txt, o = {}) {
  const { size = 14, fam = 'Libre Franklin', w = 500, fill = '#111', anchor = 'start', halo = null, hw = 3, ls = 0, style = '', italic = false } = o;
  const h = halo ? `stroke="${halo}" stroke-width="${hw}" paint-order="stroke" stroke-linejoin="round"` : '';
  return `<text x="${x}" y="${y}" font-family="${fam}" font-weight="${w}" font-size="${size}" ${italic ? 'font-style="italic"' : ''} fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" font-variant-numeric="lining-nums tabular-nums" ${h} style="${style}">${txt}</text>`;
}

// ---- Dock symbols drawn for Airway (no icon pack). viewBox -20 -20 40 40, stroke-based so each variant can ink them.
// undo: a course line that turns back on itself; turboprop: straight wing with two prop discs; widebody: swept wing,
// four engine pods; hub: three-runway pattern in a ring; satellite: sheet corner with graticule; speed: track arrow
// whose barbs count the tempo (1 barb = 1x), like a wind barb; pause: two bars.
export const SYM = {
  undo: (k) => `<path d="M-12 10 H4 A8.5 8.5 0 0 0 4 -7 H-10" fill="none" stroke="${k}" stroke-width="3" stroke-linejoin="round"/><path d="M-5 -13 L-12 -7 L-5 -1" fill="none" stroke="${k}" stroke-width="3" stroke-linejoin="miter"/>`,
  turboprop: (k) => `<path d="M0 -16 V15 M-16 -3 H16 M-6 13 H6" fill="none" stroke="${k}" stroke-width="3"/><circle cx="-9" cy="-7" r="3.2" fill="none" stroke="${k}" stroke-width="2.4"/><circle cx="9" cy="-7" r="3.2" fill="none" stroke="${k}" stroke-width="2.4"/>`,
  widebody: (k) => `<path d="M0 -17 V16 M-18 6 L0 -4 L18 6 M-7 15 L0 11 L7 15" fill="none" stroke="${k}" stroke-width="3" stroke-linejoin="miter"/><path d="M-11 0 v5 M-6 -3 v5 M6 -3 v5 M11 0 v5" stroke="${k}" stroke-width="3"/>`,
  hub: (k) => `<circle r="15" fill="none" stroke="${k}" stroke-width="2.4"/><path d="M-5 -10 L3 10 M3 -10 L11 6 M-10 4 L9 -4" stroke="${k}" stroke-width="3.4"/>`,
  satellite: (k) => `<path d="M-16 16 V-16 H16" fill="none" stroke="${k}" stroke-width="3"/><path d="M-16 4 Q0 -2 16 4 M-16 -6 Q0 -11 16 -6 M-6 -16 Q-9 0 -6 16 M5 -16 Q2 0 5 16" fill="none" stroke="${k}" stroke-width="1.8"/>`,
  speed: (k, n = 1) => `<path d="M-16 0 H15 M8 -6 L15 0 L8 6" fill="none" stroke="${k}" stroke-width="3" stroke-linejoin="miter"/>${Array.from({ length: n }, (_, i) => `<path d="M${-14 + i * 6} 0 L${-19 + i * 6} -10" stroke="${k}" stroke-width="3"/>`).join('')}`,
  pause: (k) => `<path d="M-6 -12 V12 M6 -12 V12" stroke="${k}" stroke-width="4.5"/>`,
};
/** Symbol with an optional halo pass; `s` = size in px. */
export function sym(name, x, y, s, ink, { halo, hw = 3, arg } = {}) {
  const sc = s / 40;
  const h = halo ? `<g transform="translate(${x} ${y}) scale(${sc})" style="--h:1">${SYM[name](halo, arg).replace(/stroke-width="([\d.]+)"/g, (m, v) => `stroke-width="${Number(v) + hw / sc}"`)}</g>` : '';
  return h + `<g transform="translate(${x} ${y}) scale(${sc})">${SYM[name](ink, arg)}</g>`;
}

/** Mount a page: frame background + one full-size SVG. For the jam close-up the world SVG is zoomed. */
export function mount(view, worldSvg, hudSvg = '', extraHtml = '') {
  const V = VIEWS[view];
  document.body.style.width = V.w + 'px'; document.body.style.height = V.h + 'px';
  const z = V.zoom || 1;
  const [cx, cy] = V.center || [0, 0];
  const tx = V.zoom ? V.w / 2 - cx * z : 0, ty = V.zoom ? V.h / 2 - cy * z : 0;
  const fw = V.frame === 'game-l' ? 915 : 412, fh = V.frame === 'game-l' ? 412 : 915;
  document.body.innerHTML = `<div class="frame" style="background-image:url(/docs/mockups/ui-2026-11/v2/_frames/${V.frame}.png);background-size:${fw * z}px ${fh * z}px;background-position:${tx}px ${ty}px;background-repeat:no-repeat"></div>
  <svg class="abs" style="left:0;top:0" width="${V.w}" height="${V.h}" viewBox="0 0 ${V.w} ${V.h}"><g transform="translate(${tx} ${ty}) scale(${z})">${V.key !== 'm' ? routeStubs(V.key) : ''}${worldSvg}</g>${hudSvg}</svg>${extraHtml}`;
}
