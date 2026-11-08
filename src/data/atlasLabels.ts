// [night-72a R2] D-327: atlas labels on the globe (UI-A spec §5–§6, PLAN-NOWY-KIERUNEK.md R2/T2): countries and seas,
// placed by the DOM over `WorldRenderer.projectLonLat`. Static data, no imports; the names are i18n keys
// (`atlas.country.<name>`, `atlas.sea.<name>`, PL + EN). Anchors are the visual middle of the area as a cartographer
// would letter it (not a capital, not the polygon centroid), on land for countries and on open water for seas.
//
// `weight` decides at which zoom a label may show (1 = from the whole-globe view, 4 = only close in); T2 hides
// heavier labels first when they collide with airport signs. Oceans are seas of weight 1. Disputed areas get no label.

export type AtlasLabelKind = 'country' | 'sea';
/** 1 = always eligible … 4 = only at the closest zoom. */
export type AtlasLabelWeight = 1 | 2 | 3 | 4;

export interface AtlasLabel {
  /** Unique id (a name can have several anchors, e.g. the Atlantic north and south). */
  readonly id: string;
  readonly kind: AtlasLabelKind;
  /** i18n name: `atlas.<kind>.<name>`. */
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
  readonly weight: AtlasLabelWeight;
}

/**
 * Widest visible frame (km across the screen's shorter side) at which a label of each weight may show. Weight 4 matches
 * UI-A's close zoom ("frame < ~1,500 km" for the full airport signs) with some margin.
 */
export const ATLAS_WEIGHT_MAX_SPAN_KM: Readonly<Record<AtlasLabelWeight, number>> = Object.freeze({
  1: Infinity, 2: 9000, 3: 5000, 4: 2500,
});

/** May a label of this weight show when the frame spans `frameSpanKm`? */
export function atlasLabelEligible(label: Pick<AtlasLabel, 'weight'>, frameSpanKm: number): boolean {
  return frameSpanKm <= ATLAS_WEIGHT_MAX_SPAN_KM[label.weight];
}

/** The i18n key of a label's name (`t(atlasLabelKey(label))`). */
export function atlasLabelKey(label: Pick<AtlasLabel, 'kind' | 'name'>): string {
  return 'atlas.' + label.kind + '.' + label.name;
}

const c = (name: string, lon: number, lat: number, weight: AtlasLabelWeight): AtlasLabel =>
  ({ id: 'country-' + name, kind: 'country', name, lon, lat, weight });
const s = (name: string, lon: number, lat: number, weight: AtlasLabelWeight, id = name): AtlasLabel =>
  ({ id: 'sea-' + id, kind: 'sea', name, lon, lat, weight });

/** Every atlas label (≤ 120; `npm run test:atlas-labels`). Countries by ISO 3166-1 alpha-2, seas by English name. */
export const ATLAS_LABELS: readonly AtlasLabel[] = Object.freeze([
  // Oceans.
  s('atlantic', -40, 32, 1, 'atlantic-north'), s('atlantic', -18, -22, 1, 'atlantic-south'),
  s('pacific', -150, 22, 1, 'pacific-north'), s('pacific', -118, -28, 1, 'pacific-south'),
  s('indian', 78, -22, 1), s('arctic', 20, 83, 1), s('southern', 60, -60, 1),
  // Seas, gulfs and bays.
  s('mediterranean', 19, 34.5, 2), s('black', 34, 43.3, 2), s('caspian', 50.5, 42, 2), s('red', 38.5, 20.5, 2),
  s('caribbean', -75, 15, 2), s('gulfOfMexico', -90, 25, 2), s('arabian', 64, 15, 2), s('bengal', 88, 15, 2),
  s('southChina', 114, 13, 2), s('philippine', 132, 18, 2), s('japan', 134.5, 40.5, 2), s('okhotsk', 150, 54, 2),
  s('bering', -178, 58, 2), s('coral', 155, -17, 2), s('tasman', 160, -38, 2), s('hudson', -86, 60, 2),
  s('north', 3.5, 56, 3), s('baltic', 19.5, 57, 3), s('norwegian', 3, 68, 3), s('barents', 40, 73, 3),
  s('labrador', -55, 58, 3), s('guinea', 2, 2, 3), s('persian', 51, 27, 3), s('eastChina', 126, 29, 3),
  s('alaska', -145, 56.5, 3),
  s('aden', 48, 12.5, 4), s('adriatic', 15.5, 43, 4), s('aegean', 25, 38.5, 4), s('tyrrhenian', 12, 40, 4),
  s('biscay', -5, 45.5, 4),
  // Countries: the largest from the whole-globe view.
  c('ru', 95, 62, 1), c('ca', -100, 58, 1), c('us', -99, 39, 1), c('cn', 103, 34, 1), c('br', -52, -10, 1),
  c('au', 134, -25, 1), c('in', 79, 22, 1),
  c('ar', -65, -35, 2), c('kz', 68, 48, 2), c('dz', 2.5, 28, 2), c('cd', 23.5, -2.5, 2), c('sa', 45, 24, 2),
  c('mx', -102, 24, 2), c('id', 113.5, -1.5, 2), c('sd', 30, 15.5, 2), c('ly', 18, 27.5, 2), c('ir', 54, 32.5, 2),
  c('mn', 103, 46.5, 2), c('pe', -75, -9.5, 2), c('eg', 29, 26.6, 2), c('tr', 35, 39, 2), c('ua', 31.5, 49, 2),
  c('fr', 2.5, 46.8, 2), c('es', -3.7, 40, 2), c('de', 10.3, 51, 2), c('pl', 19.5, 52.2, 2), c('jp', 138.5, 36.5, 2),
  c('za', 24, -30, 2), c('gl', -41, 74, 2), c('ng', 8, 9.5, 2), c('et', 39.5, 8.5, 2), c('pk', 69.5, 29.5, 2),
  c('td', 18.5, 15.5, 3), c('ne', 9.5, 17.5, 3), c('ao', 17.5, -12.5, 3), c('ml', -2, 18, 3), c('co', -73, 4, 3),
  c('bo', -64.5, -17, 3), c('cl', -70.5, -30, 3), c('ve', -66, 7.5, 3), c('th', 101, 15.5, 3), c('mm', 96, 21.5, 3),
  c('af', 66, 34, 3), c('iq', 43.6, 32.5, 3), c('ma', -6.5, 32, 3), c('ke', 37.8, 0.5, 3), c('tz', 34.8, -6.3, 3),
  c('mr', -10.5, 20.5, 3), c('na', 17.5, -22, 3), c('mz', 35.5, -17.5, 3), c('gb', -2, 53.5, 3), c('it', 12.8, 42.8, 3),
  c('no', 9, 61.5, 3), c('se', 15.5, 62.5, 3), c('fi', 26, 63.5, 3), c('ro', 25, 45.9, 3), c('vn', 105.5, 16, 3),
  c('ph', 121, 16.5, 3), c('my', 102, 4.2, 3), c('nz', 172, -42, 3), c('kr', 127.8, 36.3, 3), c('uz', 64, 41.5, 3),
  c('mg', 46.8, -19.5, 3),
  c('gr', 22, 39.5, 4), c('bg', 25.3, 42.7, 4), c('by', 28, 53.5, 4), c('cz', 15.5, 49.8, 4), c('at', 14.3, 47.5, 4),
  c('ch', 8.2, 46.8, 4), c('nl', 5.6, 52.3, 4), c('be', 4.6, 50.6, 4), c('pt', -8, 39.7, 4), c('ie', -8, 53.2, 4),
  c('dk', 9.3, 56, 4), c('hu', 19.4, 47.1, 4), c('rs', 20.8, 44, 4), c('sy', 38.5, 35, 4), c('jo', 36.8, 30.8, 4),
  c('ye', 47.5, 15.5, 4), c('om', 56.5, 20.5, 4), c('cu', -79.5, 22.2, 4), c('bd', 90.3, 23.8, 4),
]);
