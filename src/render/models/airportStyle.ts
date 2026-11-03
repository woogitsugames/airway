/**
 * [M1] Pure (three.js-free) airport look selection: regional roof/terminal style, climate dressing
 * (palms, snow) and small landmark archetypes next to selected big cities. Everything is a function
 * of the city id and its coordinates, so the same airport always looks the same (D-05 rich world).
 * Region comes from the dataset (`src/data/cities.ts`, read-only); unknown ids fall back to a coarse
 * lon/lat guess so fixtures and the menu network still get a style.
 */
import { CITIES } from '../../data/cities';
import type { RegionId } from '../../data/regions';

export type RoofShape = 'flat' | 'gable' | 'hip' | 'dome' | 'tiered';
export type Climate = 'tropical' | 'temperate' | 'snow';
export type LandmarkKind = 'lattice' | 'towers' | 'pagoda' | 'dome' | 'arch' | 'pyramid' | 'stepped';

export interface AirportStyle {
  readonly region: RegionId;
  readonly roof: RoofShape;
  /** Terminal walls. */
  readonly wall: string;
  /** City terminal roof; hubs keep the sea-green Diorama hub roof (diorama.md). */
  readonly roofColor: string;
  readonly climate: Climate;
  /** Palms around a tropical pad (0 elsewhere). */
  readonly palms: number;
  /** Deterministic 32-bit hash of the id: palm bearings, snow blob rotation. */
  readonly seed: number;
}

/** Local footprint radii in globe units at zoom scale 1 (radius 1); used by the layer and its tests. */
export const AIRPORT_FOOTPRINT = {
  /** Size factor of a city (1.2) and a hub (1.7): pad radius = 0.026 × factor. */
  cityScale: 1.2,
  hubScale: 1.7,
  padRadius: 0.026,
  /** Hub capacity ring and curfew barrier radii (airports.ts markers). */
  ringRadius: 0.055,
  barrierRadius: 0.066,
} as const;

export const HUB_ROOF = '#2A8F8A';
export const SNOW = '#F3F1EA';

interface RegionLook { readonly roof: RoofShape; readonly wall: string; readonly roofColor: string }
/** One roof archetype per region; colours stay inside the Diorama palette (earth, slate, terracotta). */
export const REGION_LOOK: Readonly<Record<RegionId, RegionLook>> = {
  NAM: { roof: 'flat', wall: '#ECE9E1', roofColor: '#5E7C8C' },
  SAM: { roof: 'hip', wall: '#F2EADB', roofColor: '#D2814E' },
  EUN: { roof: 'gable', wall: '#E6E3DA', roofColor: '#4F5B66' },
  EUS: { roof: 'hip', wall: '#F4EEE1', roofColor: '#C96F4A' },
  AFR: { roof: 'flat', wall: '#E8D6B0', roofColor: '#B9853F' },
  ME: { roof: 'dome', wall: '#E6CFA4', roofColor: '#A86B3C' },
  ASI: { roof: 'tiered', wall: '#F2EFE6', roofColor: '#B5483A' },
  OCE: { roof: 'gable', wall: '#F2EFE6', roofColor: '#D99A4E' },
};

const BY_CODE: ReadonlyMap<string, { lon: number; lat: number; region: RegionId }> =
  new Map(CITIES.map((c) => [c.code, c]));

/** FNV-1a 32-bit. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Coarse continent guess for ids outside the dataset (fixtures). */
export function regionFromLonLat(lon: number, lat: number): RegionId {
  if (lon < -30) return lat > 12 ? 'NAM' : 'SAM';
  if (lon < 60 && lat > 45) return 'EUN';
  if (lon < 45 && lat > 35) return 'EUS';
  if (lon < 52 && lat < 30 && !(lon > 32 && lat > 12)) return 'AFR';
  if (lon < 62) return 'ME';
  if (lat < -10 && lon > 110) return 'OCE';
  return 'ASI';
}

export function regionOf(id: string, lon: number, lat: number): RegionId {
  return BY_CODE.get(id)?.region ?? regionFromLonLat(lon, lat);
}

export const TROPIC_LAT = 23;
export const SNOW_LAT = 55;

export function climateAt(lat: number): Climate {
  const a = Math.abs(lat);
  return a < TROPIC_LAT ? 'tropical' : a > SNOW_LAT ? 'snow' : 'temperate';
}

export function airportStyle(id: string, lon: number, lat: number): AirportStyle {
  const region = regionOf(id, lon, lat);
  const look = REGION_LOOK[region];
  const seed = hashId(id);
  const climate = climateAt(lat);
  return {
    region, roof: look.roof, wall: look.wall,
    roofColor: climate === 'snow' ? SNOW : look.roofColor,
    climate, palms: climate === 'tropical' ? 3 + (seed % 3) : 0, seed,
  };
}

// ---- landmarks --------------------------------------------------------------------------------

export interface LandmarkSpec {
  readonly kind: LandmarkKind;
  /**
   * Compass bearing (degrees from north) of the landmark from its airport. Hand-picked per city so
   * the spot is on land and clear of every other dataset airport (checked by test:render-layers
   * against the Natural Earth land raster); south-ish where possible so it sits below the
   * passenger tag on screen.
   */
  readonly bearing: number;
  readonly color?: string;
}

/**
 * Generic archetypes, not replicas: a lattice tower, a cluster of towers, a stepped pagoda-like
 * tower, a domed hall, an arch bridge, pyramids and a stepped platform. Only big dataset cities
 * with room around them (dense Europe mostly has none at this scale).
 */
export const LANDMARKS: Readonly<Record<string, LandmarkSpec>> = {
  PAR: { kind: 'lattice', bearing: 200 },
  CHI: { kind: 'towers', bearing: 200 },
  SHA: { kind: 'towers', bearing: 220 },
  HKG: { kind: 'towers', bearing: 320 },
  SIN: { kind: 'towers', bearing: 180 },
  DXB: { kind: 'towers', bearing: 200 },
  TYO: { kind: 'pagoda', bearing: 10 },
  PEK: { kind: 'pagoda', bearing: 200 },
  BKK: { kind: 'pagoda', bearing: 30 },
  DEL: { kind: 'dome', bearing: 200 },
  DCA: { kind: 'dome', bearing: 250 },
  SYD: { kind: 'arch', bearing: 300, color: '#8E969C' },
  SFO: { kind: 'arch', bearing: 80, color: '#C2503A' },
  CAI: { kind: 'pyramid', bearing: 200 },
  MEX: { kind: 'stepped', bearing: 120 },
};

/** Horizontal and vertical scale of the archetype geometry (airports.ts) so it reads at gameplay zoom. */
export const LANDMARK_XZ = 1.35;
export const LANDMARK_Y = 1.7;
const RAW_RADIUS: Readonly<Record<LandmarkKind, number>> = {
  lattice: 0.0086, towers: 0.011, pagoda: 0.010, dome: 0.0112, arch: 0.018, pyramid: 0.015, stepped: 0.012,
};
/** Footprint radius of each archetype after scaling (globe units, zoom scale 1); geometry stays inside it. */
export const LANDMARK_RADIUS: Readonly<Record<LandmarkKind, number>> = Object.fromEntries(
  Object.entries(RAW_RADIUS).map(([kind, r]) => [kind, r * LANDMARK_XZ])) as Record<LandmarkKind, number>;
/** Centre distance from its own airport: outside the curfew barrier with a gap. */
export function landmarkDistance(kind: LandmarkKind): number {
  return AIRPORT_FOOTPRINT.barrierRadius + 0.004 + LANDMARK_RADIUS[kind];
}
/** Minimum centre distance from every other dataset airport: a hub pad + footprint + gap. */
export function landmarkClearance(kind: LandmarkKind): number {
  return AIRPORT_FOOTPRINT.padRadius * AIRPORT_FOOTPRINT.hubScale + LANDMARK_RADIUS[kind] + 0.003;
}

export interface LandmarkPlacement {
  readonly kind: LandmarkKind;
  readonly lon: number;
  readonly lat: number;
  /** Bearing from the airport, degrees from north; the landmark's local frame faces the airport. */
  readonly bearing: number;
  /** Centre distance from the airport (radians at zoom scale 1). */
  readonly distance: number;
  readonly color?: string;
}

const DEG = Math.PI / 180;

/** Point at `distance` radians along `bearing` from lon/lat (spherical destination formula). */
export function destination(lon: number, lat: number, bearing: number, distance: number): { lon: number; lat: number } {
  const p1 = lat * DEG, l1 = lon * DEG, b = bearing * DEG;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(distance) + Math.cos(p1) * Math.sin(distance) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(distance) * Math.cos(p1), Math.cos(distance) - Math.sin(p1) * Math.sin(p2));
  return { lon: ((l2 / DEG + 540) % 360) - 180, lat: p2 / DEG };
}

/** Great-circle angle in radians. */
export function angularDistance(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const p1 = aLat * DEG, p2 = bLat * DEG, dl = (bLon - aLon) * DEG;
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Landmark next to a dataset city, or null. Deterministic and independent of the active airports. */
export function landmarkFor(id: string): LandmarkPlacement | null {
  const spec = LANDMARKS[id];
  const city = BY_CODE.get(id);
  if (!spec || !city) return null;
  const distance = landmarkDistance(spec.kind);
  const spot = destination(city.lon, city.lat, spec.bearing, distance);
  return { kind: spec.kind, lon: spot.lon, lat: spot.lat, bearing: spec.bearing, distance, color: spec.color };
}

/** Palm bearings (degrees) around a pad, spread evenly with jitter, skipping ±45° around the landmark. */
export function palmBearings(style: AirportStyle, landmarkBearing: number | null): number[] {
  const start = landmarkBearing === null ? 0 : landmarkBearing + 45;
  const span = landmarkBearing === null ? 360 : 270;
  const slot = span / Math.max(1, style.palms);
  const out: number[] = [];
  let s = style.seed || 1;
  for (let i = 0; i < style.palms; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out.push(Math.round((start + slot * (i + 0.2 + 0.6 * (s / 0x100000000))) % 360));
  }
  return out;
}
