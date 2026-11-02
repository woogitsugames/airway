/** November sun and smoothly interpolated visual-only day/night terminator. */
export const NOVEMBER_SUBSOLAR_LATITUDE_DEG = -18.5 as const;
const DEG = Math.PI / 180;
const MINUTES_PER_DAY = 1_440;

export interface SunTarget {
  setSun(longitudeDeg: number, latitudeDeg: number): void;
}
export interface ExposureTarget {
  toneMappingExposure: number;
}
export interface SunController {
  /** Call each render frame with the last authoritative tick and fraction until the next. */
  update(tick: number, fraction?: number): void;
  setViewCenter(longitudeDeg: number, latitudeDeg: number): void;
  setSeasonDeclination(latitudeDeg: number): void;
  /** [task-34] Daylight at the view centre after the last `update()`: 0 night … 1 day. */
  readonly daylight: number;
}

function validTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0) throw new RangeError('Invalid render tick');
}
function validFraction(fraction: number): void {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new RangeError('Render interpolation must be in [0, 1]');
  }
}
function validLat(lat: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new RangeError('Invalid latitude');
}
function validLon(lon: number): void {
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new RangeError('Invalid longitude');
}
/** At UTC noon the sun is over 0°; at midnight it is opposite Greenwich. */
export function subsolarLongitudeAt(tick: number, fraction = 0): number {
  validTick(tick);
  validFraction(fraction);
  // Use tick modulo before adding the fractional interpolation for safe large ticks.
  const raw = 180 - ((tick % MINUTES_PER_DAY) + fraction) / 4;
  return ((raw + 180) % 360 + 360) % 360 - 180;
}

/** No new objects, Three.js geometry or shader recompiles in the render-frame path. */
export function createSunController(
  globe: SunTarget,
  renderer?: ExposureTarget,
  initialDeclination = NOVEMBER_SUBSOLAR_LATITUDE_DEG,
): SunController {
  let declination: number = initialDeclination;
  let viewLon = 0;
  let viewSinLat = 0;
  let viewCosLat = 1;
  let daylight = 1;
  const baseExposure = renderer?.toneMappingExposure ?? 1.05;
  function setDeclination(lat: number): void {
    if (!Number.isFinite(lat) || lat < -23.5 || lat > 23.5) {
      throw new RangeError('Solar declination must be within the terrestrial range');
    }
    declination = lat;
  }
  setDeclination(initialDeclination);
  return {
    update(tick, fraction = 0) {
      const lon = subsolarLongitudeAt(tick, fraction);
      globe.setSun(lon, declination);
      const sunLat = declination * DEG;
      const dot = viewSinLat * Math.sin(sunLat) +
        viewCosLat * Math.cos(sunLat) * Math.cos((viewLon - lon) * DEG);
      const day = Math.max(0, Math.min(1, (dot + 0.25) / 1.25));
      // [task-34] Smooth 0..1 around the terminator (plane shadows fade out at night).
      const t = Math.max(0, Math.min(1, (dot + 0.15) / 0.35));
      daylight = t * t * (3 - 2 * t);
      if (renderer) renderer.toneMappingExposure = baseExposure * (0.94 + 0.08 * day);
    },
    setViewCenter(lon, lat) {
      validLon(lon);
      validLat(lat);
      viewLon = lon;
      viewSinLat = Math.sin(lat * DEG);
      viewCosLat = Math.cos(lat * DEG);
    },
    setSeasonDeclination: setDeclination,
    get daylight() { return daylight; },
  };
}

/** Pushes curfew changes from a read model into a barrier layer (e.g. AirportsLayer). No sim import. */
export interface CurfewBarrierLayer {
  setCurfew(cityId: string, closed: boolean): void;
}
export interface CurfewReadModel {
  isClosed(cityId: string, tick: number): boolean;
}
export function createCurfewBarrierPresenter(layer: CurfewBarrierLayer, cityIds: readonly string[]) {
  const last = new Map<string, boolean>();
  if (new Set(cityIds).size !== cityIds.length) throw new RangeError('Duplicate airport IDs');
  return {
    sync(tick: number, curfews: CurfewReadModel): void {
      for (const cityId of cityIds) {
        const closed = curfews.isClosed(cityId, tick);
        if (last.get(cityId) !== closed) {
          layer.setCurfew(cityId, closed);
          last.set(cityId, closed);
        }
      }
    },
    dispose(): void {
      for (const [cityId, closed] of last) if (closed) layer.setCurfew(cityId, false);
      last.clear();
    },
  };
}
