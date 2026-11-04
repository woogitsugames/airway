// Shared game state for every UI direction: the same real frame (seed 0xA1A1, store-shot "game" fixture),
// the same airports, the same numbers. Glyph paths and colours copied from src/data/regions.ts (D-08).
export const GLYPH = {
  chevron: 'M-6 -5 L0 1 L6 -5 L6 0 L0 6 L-6 0Z',
  bowtie: 'M-6 -5.5 L0 0 L-6 5.5Z M6 -5.5 L0 0 L6 5.5Z',
  crescent: 'M2.5 -5.45 A6 6 0 1 0 2.5 5.45 A6.6 6.6 0 0 1 2.5 -5.45Z',
  keyhole: 'M0 -6.2 A3.4 3.4 0 1 1 0 0.6 A3.4 3.4 0 1 1 0 -6.2Z M-1.7 -1 L1.7 -1 L3.4 6 L-3.4 6Z',
  fin: 'M-6 6 L6 6 L6 2.5 L-1 -6 L-6 -6Z',
  bracket: 'M-6 -6 L-1.5 -6 L-1.5 1.5 L6 1.5 L6 6 L-6 6Z',
};
export const REGION = {
  NAM: { g: 'fin', c: '#0072B2' }, SAM: { g: 'bracket', c: '#56B4E9' }, EUN: { g: 'chevron', c: '#009E73' },
  EUS: { g: 'crescent', c: '#E69F00' }, AFR: { g: 'keyhole', c: '#13302E' }, ME: { g: 'bowtie', c: '#CC79A7' },
};
/** One destination glyph as inline SVG; `ink` is the outline that separates it from the tag. */
export function glyph(region, size = 14, ink = '#FBF8F1', fill) {
  const r = REGION[region];
  return `<svg class="glyph" width="${size}" height="${size}" viewBox="-7 -7 14 14"><path d="${GLYPH[r.g]}" fill="${fill || r.c}" stroke="${ink}" stroke-width="1.1" paint-order="stroke" stroke-linejoin="round"/></svg>`;
}
/** Waiting passengers grouped per region, in display order. */
export function groups(wait) {
  const out = [];
  for (const id of wait) { const g = out.find((x) => x.id === id); if (g) g.n++; else out.push({ id, n: 1 }); }
  return out;
}
const rep = (id, n) => Array(n).fill(id);
// Screen positions (CSS px) of the airport pads in the captured frames: p = 412×915, l = 915×412.
export const AIRPORTS = [
  { code: 'RIX', city: 'Ryga', p: [150, 290], l: [360, 129], r: 19, cap: 12, wait: [] },
  { code: 'VCE', city: 'Wenecja', p: [58, 367], l: [282, 183], r: 19, cap: 12, wait: ['ME'] },
  { code: 'ATH', city: 'Ateny', hub: true, p: [121, 430], l: [330, 229], r: 33, cap: 24, wait: [...rep('EUN', 9), ...rep('EUS', 4), 'ME'], trend: 'up' },
  { code: 'ANK', city: 'Ankara', p: [194, 413], l: [392, 215], r: 21, cap: 12, wait: ['AFR', 'EUN'] },
  { code: 'AMM', city: 'Amman', hub: true, jam: true, timer: '42 s', p: [218, 488], l: [413, 275], r: 33, cap: 24,
    wait: [...rep('EUN', 10), ...rep('EUS', 7), ...rep('ME', 4), ...rep('AFR', 3)], trend: 'up' },
  { code: 'BGW', city: 'Bagdad', p: [291, 474], l: [475, 263], r: 21, cap: 12, wait: ['EUS', 'EUS', 'ME'], trend: null },
  { code: 'KHI', city: 'Karaczi', p: null, edge: { side: 'right', y: 505 }, l: [637, 320], r: 19, cap: 12, wait: [...rep('EUS', 5), ...rep('ME', 2), 'EUN'], trend: 'up' },
];
export const HUD = { week: '01', day: 2, days: 3, time: '17:06', pax: 34, speed: 1, turboprop: 1, widebody: 0, hub: 1, widebodyIn: '1 dzień' };
export const PL = { week: 'Tydzień', day: 'Dzień', time: 'Godz.', pax: 'Pasażerów' };
