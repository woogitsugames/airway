// Shared mock game state so every visual direction shows the SAME moment of play (fair comparison),
// plus the game-specific glyph geometry (destination glyphs, plane planforms). Units: glyphs live in a
// 12×12 box centred on 0; planes point along +x, ~20 units long.

/** Destination regions → glyph. Passengers carry the glyph of the region they want to reach. */
export const REGIONS = {
  NAM: { glyph: 'fin', pl: 'Ameryka Płn.', en: 'North America' },
  EUN: { glyph: 'chevron', pl: 'Europa Płn.', en: 'Northern Europe' },
  EUS: { glyph: 'crescent', pl: 'Europa Płd.', en: 'Southern Europe' },
  AFR: { glyph: 'keyhole', pl: 'Afryka', en: 'Africa' },
  ME: { glyph: 'bowtie', pl: 'Bliski Wschód', en: 'Middle East' },
  SAM: { glyph: 'bracket', pl: 'Ameryka Płd.', en: 'South America' },
};
export const CITY_REGION = {
  NYC: 'NAM', MTL: 'NAM', LON: 'EUN', WAW: 'EUN', OSL: 'EUN', REK: 'EUN', KIV: 'EUN',
  LIS: 'EUS', MAD: 'EUS', ROM: 'EUS', IST: 'ME', CAI: 'ME', DKR: 'AFR', LOS: 'AFR', ACC: 'AFR', CMN: 'AFR',
  REC: 'SAM', BOG: 'SAM',
};

export const GLYPHS = {
  chevron: 'M-6 -5 L0 1 L6 -5 L6 0 L0 6 L-6 0Z',
  bowtie: 'M-6 -5.5 L0 0 L-6 5.5Z M6 -5.5 L0 0 L6 5.5Z',
  crescent: 'M2.5 -5.45 A6 6 0 1 0 2.5 5.45 A6.6 6.6 0 0 1 2.5 -5.45Z',
  keyhole: 'M0 -6.2 A3.4 3.4 0 1 1 0 0.6 A3.4 3.4 0 1 1 0 -6.2Z M-1.7 -1 L1.7 -1 L3.4 6 L-3.4 6Z',
  fin: 'M-6 6 L6 6 L6 2.5 L-1 -6 L-6 -6Z',
  bracket: 'M-6 -6 L-1.5 -6 L-1.5 1.5 L6 1.5 L6 6 L-6 6Z',
};

export const PLANES = {
  // Straight wing, two prop discs, T-tail: short-haul, slow, cheap, needs stops beyond its range.
  turboprop: {
    body: 'M9 0 L7 -1.3 L-7.5 -1.1 L-9 0 L-7.5 1.1 L7 1.3Z',
    wing: 'M1.2 -10 L3.4 -10 L3.4 10 L1.2 10Z',
    tail: 'M-8 -3.8 L-6.6 -3.8 L-6.6 3.8 L-8 3.8Z',
    extra: 'M5 -7.6 L5.6 -7.6 L5.6 -3.4 L5 -3.4Z M5 3.4 L5.6 3.4 L5.6 7.6 L5 7.6Z', // prop discs (edge-on)
  },
  // Swept wing, four engine pods, swept tail: long-haul, fast, big.
  widebody: {
    body: 'M11 0 L9 -1.7 L-9.5 -1.4 L-11 0 L-9.5 1.4 L9 1.7Z',
    wing: 'M3.5 -1.6 L-3.5 -12 L-5.6 -12 L-1.6 -1.6Z M3.5 1.6 L-3.5 12 L-5.6 12 L-1.6 1.6Z',
    tail: 'M-7.2 -1.2 L-10 -5 L-11.2 -5 L-9.6 -1.2Z M-7.2 1.2 L-10 5 L-11.2 5 L-9.6 1.2Z',
    extra: 'M1 -5.4 L3 -5.4 L3 -4.2 L1 -4.2Z M1 4.2 L3 4.2 L3 5.4 L1 5.4Z M-1.4 -8.6 L0.6 -8.6 L0.6 -7.4 L-1.4 -7.4Z M-1.4 7.4 L0.6 7.4 L0.6 8.6 L-1.4 8.6Z',
  },
};

/** Routes of the frozen moment: [from, to, plane type]. */
export const ROUTES = [
  ['LON', 'NYC', 'widebody'], ['LIS', 'REC', 'widebody'], ['NYC', 'MTL', 'turboprop'],
  ['LON', 'WAW', 'turboprop'], ['LON', 'LIS', 'turboprop'], ['LON', 'REK', 'turboprop'], ['LON', 'OSL', 'turboprop'],
  ['WAW', 'IST', 'turboprop'], ['IST', 'CAI', 'turboprop'], ['IST', 'KIV', 'turboprop'],
  ['LIS', 'DKR', 'turboprop'], ['LIS', 'CMN', 'turboprop'], ['LIS', 'MAD', 'turboprop'],
];
/** Planes in flight: [from, to, fraction along, load 0..1]. */
export const FLIGHTS = [
  ['LON', 'NYC', 0.42, 0.9, 'widebody'], ['LIS', 'REC', 0.3, 0.6, 'widebody'], ['LON', 'WAW', 0.55, 1, 'turboprop'],
  ['LIS', 'LON', 0.35, 0.5, 'turboprop'], ['IST', 'CAI', 0.6, 0.7, 'turboprop'], ['LIS', 'DKR', 0.5, 0.4, 'turboprop'],
  ['LON', 'REK', 0.7, 0.3, 'turboprop'], ['NYC', 'MTL', 0.5, 0.8, 'turboprop'], ['WAW', 'IST', 0.25, 0.6, 'turboprop'],
];
/** Hubs: capacity, waiting passengers (region codes), transfer passengers on the connection dial. */
export const HUBS = {
  LON: { cap: 12, waiting: ['NAM', 'NAM', 'EUS', 'NAM', 'ME', 'EUN', 'NAM', 'AFR', 'SAM', 'NAM', 'EUS'], dial: 3, warn: true, jamIn: 0.35 },
  LIS: { cap: 8, waiting: ['SAM', 'AFR', 'EUN'], dial: 1 },
  IST: { cap: 8, waiting: ['EUN', 'ME', 'EUN', 'EUN', 'AFR'], dial: 2 },
};
/** Plain cities with waiting passengers (no hub). ACC just appeared. */
export const CITIES_WAITING = {
  WAW: ['EUS', 'NAM'], NYC: ['EUN', 'EUN', 'ME'], MTL: ['EUS'], REK: [], OSL: ['NAM'], CAI: ['EUN', 'EUN'],
  DKR: ['SAM'], CMN: ['EUN'], MAD: ['NAM', 'AFR'], KIV: ['ME'], REC: ['EUN'], ROM: ['NAM', 'ME', 'EUN'], LOS: ['EUN', 'NAM'], ACC: [],
};
export const NEW_CITY = 'ACC';
/** Curfew: these cities are inside the night zone and closed 23:00–06:00 local. */
export const CURFEW = ['CAI', 'KIV'];
/** Subsolar point for the frozen moment (UTC ~16:10, November). */
export const SUN = { lon: -62, lat: -15 };

export const CLOCK = { week: 6, dayPl: 'Śr', dayEn: 'Wed', time: '16:10', pax: 1284 };
/** Working title used on menus until the owner picks one (see docs/RESEARCH.md §Titles). */
export const TITLE = { main: 'AIRWAY', sub: 'airway.games' }; // owner decision D-12

/** Weekly upgrade offer (pick one). */
export const UPGRADES = [
  { id: 'turboprop', pl: 'Turbośmigłowiec', en: 'Turboprop', specPl: 'zasięg 2 500 km · 48 miejsc', note: '+1 samolot' },
  { id: 'widebody', pl: 'Szerokokadłubowiec', en: 'Widebody', specPl: 'zasięg 11 000 km · 300 miejsc', note: '+1 samolot' },
  { id: 'hub', pl: 'Rozbudowa huba', en: 'Hub expansion', specPl: '+6 miejsc · przesiadka 25 → 15 min', note: 'wybierz hub' },
];
