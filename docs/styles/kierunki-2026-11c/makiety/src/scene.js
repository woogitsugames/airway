// Shared game situation for the K1/K2 mockups (2026-11c): week 1, day 2 of 3, 34 passengers, eastern
// Mediterranean. Athens and Amman are hubs; Amman is jammed (0:42 to closure). Mockup data, not game code.
import { geoInterpolate, geoDistance } from 'd3-geo';

export const AIRPORTS = {
  RIX: { name: 'Ryga', lon: 23.97, lat: 56.92, wait: 2, cap: 12, pax: { EUS: 1, ME: 1 }, side: 'r' },
  BEG: { name: 'Belgrad', lon: 20.31, lat: 44.82, wait: 5, cap: 12, pax: { EUN: 3, ME: 2 }, side: 'r' },
  KBP: { name: 'Kijów', lon: 30.52, lat: 50.45, wait: 3, cap: 12, pax: { EUN: 2, AFR: 1 }, side: 'r' },
  ATH: { name: 'Ateny', lon: 23.94, lat: 37.94, wait: 14, cap: 24, hub: true, pax: { EUN: 6, ME: 5, AFR: 3 }, side: 'l' },
  ANK: { name: 'Ankara', lon: 32.99, lat: 40.13, wait: 4, cap: 12, pax: { EUS: 3, ME: 1 }, isNew: true, side: 'r' },
  CAI: { name: 'Kair', lon: 31.41, lat: 30.12, wait: 6, cap: 12, pax: { EUN: 4, EUS: 2 }, side: 'l' },
  AMM: { name: 'Amman', lon: 35.99, lat: 31.72, wait: 36, cap: 36, hub: true, jam: '0:42', pax: { EUN: 15, EUS: 12, AFR: 9 }, side: 'r' },
  BGW: { name: 'Bagdad', lon: 44.23, lat: 33.26, wait: 7, cap: 12, pax: { EUS: 4, EUN: 3 }, side: 'r' },
  KHI: { name: 'Karaczi', lon: 67.16, lat: 24.9, off: true },
};
// three routes with aircraft; kind decides the line (prop dashed white, jet solid accent)
export const ROUTES = [
  { a: 'BEG', b: 'ATH', kind: 'prop', planes: [0.7] },
  { a: 'ATH', b: 'AMM', kind: 'jet', planes: [0.58] },
  { a: 'AMM', b: 'BGW', kind: 'prop', planes: [0.36] },
];
export const PLANNED = { a: 'ANK', b: 'AMM' }; // the line the player is drawing right now

export const REGIONS = {
  NAM: { glyph: 'fin', color: '#0072B2' }, SAM: { glyph: 'bracket', color: '#56B4E9' },
  EUN: { glyph: 'chevron', color: '#009E73' }, EUS: { glyph: 'crescent', color: '#E69F00' },
  AFR: { glyph: 'keyhole', color: '#13302E' }, ME: { glyph: 'bowtie', color: '#CC79A7' },
};
// D-08 glyphs, 12x12 centred (same paths as src/data/regions.ts).
export const GLYPH = {
  chevron: 'M-6 -5 L0 1 L6 -5 L6 0 L0 6 L-6 0Z',
  bowtie: 'M-6 -5.5 L0 0 L-6 5.5Z M6 -5.5 L0 0 L6 5.5Z',
  crescent: 'M2.5 -5.45 A6 6 0 1 0 2.5 5.45 A6.6 6.6 0 0 1 2.5 -5.45Z',
  keyhole: 'M0 -6.2 A3.4 3.4 0 1 1 0 0.6 A3.4 3.4 0 1 1 0 -6.2Z M-1.7 -1 L1.7 -1 L3.4 6 L-3.4 6Z',
  fin: 'M-6 6 L6 6 L6 2.5 L-1 -6 L-6 -6Z',
  bracket: 'M-6 -6 L-1.5 -6 L-1.5 1.5 L6 1.5 L6 6 L-6 6Z',
};
// Our own aircraft silhouettes (from 2026-11b icons.js, drawn for Airway; 100x100 box, nose up).
export const ICON = {
  prop: 'M46 8 L54 8 L56 40 L92 44 L92 54 L56 56 L55 80 L68 86 L68 92 L32 92 L32 86 L45 80 L44 56 L8 54 L8 44 L44 40 Z M20 34 L30 34 L30 46 L20 46 Z M70 34 L80 34 L80 46 L70 46 Z',
  jet: 'M47 6 L53 6 L56 36 L94 62 L94 70 L56 56 L55 80 L70 90 L70 95 L50 90 L30 95 L30 90 L45 80 L44 56 L6 70 L6 62 L44 36 Z M16 58 L22 55 L24 64 L18 66 Z M30 49 L36 46 L38 55 L32 57 Z M64 46 L70 49 L68 57 L62 55 Z M78 55 L84 58 L82 66 L76 64 Z',
  hub: 'M44 6 L56 6 L56 94 L44 94 Z M12 22 L18 12 L88 78 L82 88 Z M82 12 L88 22 L18 88 L12 78 Z',
  undo: 'M78 70 L78 46 Q78 26 58 26 L30 26 L30 12 L8 32 L30 52 L30 38 L58 38 Q66 38 66 46 L66 70 Z',
  tempo: 'M8 46 L68 46 L68 30 L94 52 L68 74 L68 58 L8 58 Z M20 46 L12 22 L22 22 L30 46 Z',
};
// Map labels drawn into the world (atlas layer): countries in spaced caps, seas in italic.
export const COUNTRY_LABELS = [
  { t: 'TURCJA', lon: 37.6, lat: 39.0 }, { t: 'EGIPT', lon: 29.0, lat: 26.6 }, { t: 'IRAK', lon: 43.6, lat: 31.0 },
  { t: 'RUMUNIA', lon: 25.0, lat: 45.9 }, { t: 'POLSKA', lon: 19.5, lat: 52.2 },
  { t: 'LIBIA', lon: 20.5, lat: 27.5 },
];
export const SEA_LABELS = [
  { t: 'Morze Czarne', lon: 34.0, lat: 43.3 },
];

export const gc = (a, b) => geoInterpolate([a.lon, a.lat], [b.lon, b.lat]);
export const km = (a, b) => Math.round(geoDistance([a.lon, a.lat], [b.lon, b.lat]) * 6371);
