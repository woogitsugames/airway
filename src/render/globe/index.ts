// [ext-04 E4] D-283/D-285: the globe is the Linoryt print only. Satelita, Mapa, the diorama and the DEV comparison
// looks, their textures, the cloud/ocean/haze shells and the decorations are gone; `linoryt-globe.ts` (a lazy chunk)
// builds the terrain mesh, the print material and the paper sky band.
import { Color, DirectionalLight, Group, HemisphereLight, Scene, Vector3, type Camera, type Object3D } from 'three';
import type { QualityProfile } from '../quality';
import { setLatLonVec3 } from './geo-math';
import { loadLandMask } from './land-mask';
import type { TerrainLod } from './lod';
import type { GlobeLook } from './look';

export {
  latLonToVec3, setLatLonVec3, vec3ToLatLon, intersectUnitSphere, pickSphereNdc, normalizeLon,
} from './geo-math';
export type { LonLat, Vec3Like, MutableVec3 } from './geo-math';
export type { QualityLevel } from './terrain';
export type { TerrainLodStats } from './lod';
export type { GlobeLook } from './look';
export { DEFAULT_GLOBE_LOOK } from './look';

/** Decorations drawn (always 0 in print; kept for `WorldStats`). */
export interface DecorCullStats { drawn: number; total: number; repacks: number }

export interface GlobeOptions {
  /** Shared profile from `resolveQualityProfile()`; terrain density follows `preset`, `saver` the print's spacing. */
  readonly quality: QualityProfile;
  readonly seed?: number;
  readonly landUrl?: string;
  readonly signal?: AbortSignal;
  /** `SunLights.direction`; drives the night hatch. */
  readonly sunDirection: Vector3;
  /** The print (`linoryt`, default) or, DEV only, the NASA preview (`earth`, [night-70a R1]). */
  readonly look?: GlobeLook;
}
export interface GlobeInstance {
  readonly group: Group;
  readonly quality: QualityProfile;
  /** [night-04] Terrain chunks and level for this camera (D-73); call once per rendered frame. */
  update(camera: Camera, pixelsPerDegree: number): void;
  /** No decorations in print; kept for the adaptive-quality ladder. */
  setDecorDensity(density: number): void;
  readonly lod: TerrainLod;
  readonly decor: DecorCullStats;
  readonly surfaceLook: GlobeLook;
  /** [night-72a R2] D-327: the country-border layer (one draw), when the look draws one; for the contrast probe. */
  readonly borders?: Object3D | null;
  dispose(): void;
}

/** The scene's only lights: a subsolar sun and a sky fill. Created before the land loads. */
export interface SunLights {
  readonly group: Group;
  /** Unit vector toward the subsolar point; shared with the city-lights shader. */
  readonly direction: Vector3;
  setSun(lon: number, lat: number): void;
  applyQuality(profile: QualityProfile): void;
  dispose(): void;
}

/** [task-34] Intensity of the anti-solar fill light (sun is 3.2). */
export const MOON_INTENSITY = 0.6;

export function createSunLights(profile: QualityProfile): SunLights {
  const group = new Group();
  group.name = 'AirwaySunLights';
  const sunlight = new DirectionalLight(new Color('#fff4e0'), 3.2);
  sunlight.name = 'SubsolarSun';
  sunlight.shadow.camera.left = -1.35;
  sunlight.shadow.camera.right = 1.35;
  sunlight.shadow.camera.top = 1.35;
  sunlight.shadow.camera.bottom = -1.35;
  sunlight.shadow.camera.near = 2;
  sunlight.shadow.camera.far = 8;
  sunlight.shadow.bias = -0.0004;
  const hemisphere = new HemisphereLight('#bcd6ff', '#26324a', .55);
  // [task-34] Moonlight from the anti-solar side: cool, weak, no shadows. Gives the night hemisphere
  // relief shading and keeps land and sea apart without lifting the night to day brightness.
  const moonlight = new DirectionalLight(new Color('#9db4e6'), MOON_INTENSITY);
  moonlight.name = 'AntisolarMoon';
  const direction = new Vector3(0, 1, 0);
  group.add(sunlight, sunlight.target, hemisphere, moonlight, moonlight.target);
  const lights: SunLights = {
    group, direction,
    setSun(lon, lat) {
      setLatLonVec3(direction, lon, lat);
      sunlight.position.copy(direction).multiplyScalar(5);
      moonlight.position.copy(direction).multiplyScalar(-5);
    },
    applyQuality(next) {
      sunlight.castShadow = next.shadowEnabled;
      if (next.shadowEnabled && sunlight.shadow.mapSize.x !== next.shadowMapSize) {
        sunlight.shadow.mapSize.set(next.shadowMapSize, next.shadowMapSize);
        sunlight.shadow.map?.dispose();
        sunlight.shadow.map = null;
      }
    },
    dispose() {
      sunlight.shadow.dispose();
      group.clear();
    },
  };
  lights.applyQuality(profile);
  lights.setSun(5, 18);
  return lights;
}

/** The Linoryt globe: land mask, then the print chunk (terrain, material, sky band). */
export async function createGlobe(scene: Scene, opts: GlobeOptions): Promise<GlobeInstance> {
  const landUrl = opts.landUrl ?? `${import.meta.env.BASE_URL}data/land-50m.json`;
  const mask = await loadLandMask(landUrl, opts.signal);
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  // [night-70a R1] D-323: the NASA globe is a DEV preview; the release build drops this branch and its chunk.
  if (import.meta.env.DEV && opts.look === 'earth') {
    const { createEarthGlobe } = await import('./earth-globe');
    return createEarthGlobe(scene, mask, { quality: opts.quality, sunDirection: opts.sunDirection, signal: opts.signal });
  }
  const { createLinorytGlobe } = await import('./linoryt-globe');
  return createLinorytGlobe(scene, mask, { quality: opts.quality, sunDirection: opts.sunDirection, signal: opts.signal });
}
