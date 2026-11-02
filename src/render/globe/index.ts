import {
  BackSide, Color, DirectionalLight, Group, HemisphereLight,
  Mesh, Points, Scene, ShaderMaterial, SphereGeometry, Vector3,
} from 'three';
import type { QualityProfile } from '../quality';
import { applyDayNightGrading } from './daynight';
import { createDecorations } from './decorations';
import { setLatLonVec3 } from './geo-math';
import { loadLandMask } from './land-mask';
import { createTerrain } from './terrain';

export {
  latLonToVec3, setLatLonVec3, vec3ToLatLon, intersectUnitSphere, pickSphereNdc, normalizeLon,
} from './geo-math';
export type { LonLat, Vec3Like, MutableVec3 } from './geo-math';
export type { QualityLevel } from './terrain';

export interface GlobeOptions {
  /** Shared profile from `resolveQualityProfile()`; terrain/decor density follows `preset`. */
  readonly quality: QualityProfile;
  readonly seed?: number;
  readonly landUrl?: string;
  readonly signal?: AbortSignal;
  /** `SunLights.direction`; drives the night-side city lights. */
  readonly sunDirection: Vector3;
}
export interface GlobeInstance {
  readonly group: Group;
  readonly quality: QualityProfile;
  dispose(): void;
}

/** A lightweight atmosphere shell: alpha only at the limb, with no bloom/postprocessing. */
function createAtmosphere(): Mesh<SphereGeometry, ShaderMaterial> {
  const material = new ShaderMaterial({
    side: BackSide, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vNormal; varying vec3 vEye;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vEye = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `varying vec3 vNormal; varying vec3 vEye;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vEye))), 2.7);
        gl_FragColor = vec4(0.62, 0.82, 0.92, rim * 0.22);
      }`,
  });
  return new Mesh(new SphereGeometry(1.095, 48, 32), material);
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

/** Terrain, decorations and atmosphere. Lighting comes from `createSunLights()`. */
export async function createGlobe(scene: Scene, opts: GlobeOptions): Promise<GlobeInstance> {
  const quality = opts.quality.preset;
  const landUrl = opts.landUrl ?? `${import.meta.env.BASE_URL}data/land-50m.json`;
  const mask = await loadLandMask(landUrl, opts.signal);
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const group = new Group();
  group.name = 'AirwayDioramaGlobe';
  const terrain = createTerrain(mask, quality);
  group.add(terrain, createDecorations(mask, quality, opts.seed ?? 7, opts.sunDirection),
    createAtmosphere());
  // [task-34] Warm terminator and cool night palette on the world (not on gameplay layers).
  group.traverse((object) => {
    if (object instanceof Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) applyDayNightGrading(material, opts.sunDirection);
    }
  });
  scene.add(group);
  let disposed = false;
  return {
    group, quality: opts.quality,
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      group.traverse((object) => {
        if (object instanceof Mesh || object instanceof Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      group.clear();
    },
  };
}
