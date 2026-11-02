// Small SVG helpers shared by the style builders.
import { GLYPHS, PLANES } from './scene.mjs';
import { CITIES } from './geo.mjs';
import { geoDistance } from 'd3-geo';

export const glyph = (name, x, y, s, attrs = '') => `<path d="${GLYPHS[name]}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})" ${attrs}/>`;
export const plane = (type, x, y, deg, s, attrs = '') => {
  const p = PLANES[type];
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${s})" ${attrs}><path d="${p.wing}"/><path d="${p.tail}"/><path d="${p.body}"/><path d="${p.extra}"/></g>`;
};
export const km = (a, b) => Math.round(geoDistance([CITIES[a].lon, CITIES[a].lat], [CITIES[b].lon, CITIES[b].lat]) * 6371);
export const nf = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** Arc segment (SVG) from angle a0 to a1 (degrees, 0 = north, clockwise) on circle (cx, cy, r). */
export const sector = (cx, cy, r, a0, a1) => {
  const p = (a) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};
export const polar = (cx, cy, r, a) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
