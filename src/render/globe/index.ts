import {
  ACESFilmicToneMapping, BackSide, Color, DirectionalLight, Group, HemisphereLight,
  Mesh, Points, PCFSoftShadowMap, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace,
  Vector3, WebGLRenderer,
} from 'three';
import type { Camera } from 'three';
import { createDecorations } from './decorations';
import { latLonToVec3 as cartesian, pickSphereNdc } from './geo-math';
import type { LonLat } from './geo-math';
import { loadLandMask } from './land-mask';
import { createTerrain } from './terrain';
import type { QualityLevel } from './terrain';

export { vec3ToLatLon, intersectUnitSphere, pickSphereNdc } from './geo-math';
/** Renderer-friendly cartesian position, with THREE.Vector3 semantics for overlays. */
export function latLonToVec3(lon: number, lat: number, radius = 1): Vector3 {
  const p = cartesian(lon, lat, radius);
  return new Vector3(p.x, p.y, p.z);
}
export type { LonLat } from './geo-math';
export type { QualityLevel } from './terrain';

export type QualitySetting = QualityLevel | 'auto';
export interface GlobeOptions {
  readonly canvas?: HTMLCanvasElement;
  readonly renderer?: WebGLRenderer;
  readonly quality?: QualitySetting;
  readonly seed?: number;
  readonly landUrl?: string;
  readonly signal?: AbortSignal;
  readonly viewport?: () => { readonly left: number; readonly top: number;
    readonly width: number; readonly height: number };
}
export interface GlobeInstance {
  readonly group: Group;
  readonly quality: QualityLevel;
  readonly dpr: number;
  setSun(lon: number, lat: number): void;
  pick(screenX: number, screenY: number, camera: Camera): LonLat | null;
  dispose(): void;
}

export function chooseGlobeQuality(preference: QualitySetting = 'auto'): QualityLevel {
  if (preference !== 'auto') return preference;
  if (typeof navigator === 'undefined') return 'medium';
  const hardware = navigator as Navigator & { deviceMemory?: number };
  const memory = hardware.deviceMemory ?? 4;
  const threads = navigator.hardwareConcurrency ?? 4;
  if (memory <= 2 || threads <= 2) return 'low';
  if (memory >= 8 && threads >= 8) return 'high';
  return 'medium';
}
export function qualityDpr(level: QualityLevel, deviceDpr = 1): number {
  return Math.min(level === 'low' ? 1 : level === 'medium' ? 1.5 : 2,
    Math.max(1, deviceDpr));
}
export function configureGlobeRenderer(renderer: WebGLRenderer, level: QualityLevel): number {
  const dpr = qualityDpr(level, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = level !== 'low';
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return dpr;
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

export async function createGlobe(scene: Scene, opts: GlobeOptions = {}): Promise<GlobeInstance> {
  const quality = chooseGlobeQuality(opts.quality);
  const dpr = opts.renderer ? configureGlobeRenderer(opts.renderer, quality)
    : qualityDpr(quality, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  const landUrl = opts.landUrl ?? `${import.meta.env.BASE_URL}data/land-50m.json`;
  const mask = await loadLandMask(landUrl, opts.signal);
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const group = new Group();
  group.name = 'AirwayDioramaGlobe';
  const sunlight = new DirectionalLight(new Color('#fff4e0'), 3.2);
  sunlight.name = 'SubsolarSun';
  sunlight.castShadow = quality !== 'low';
  sunlight.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
  sunlight.shadow.camera.left = -1.35;
  sunlight.shadow.camera.right = 1.35;
  sunlight.shadow.camera.top = 1.35;
  sunlight.shadow.camera.bottom = -1.35;
  sunlight.shadow.camera.near = 2;
  sunlight.shadow.camera.far = 8;
  sunlight.shadow.bias = -0.0004;
  const hemisphere = new HemisphereLight('#bcd6ff', '#26324a', .55);
  const terrain = createTerrain(mask, quality);
  const sunDirection = new Vector3(0, 1, 0);
  group.add(terrain, createDecorations(mask, quality, opts.seed ?? 7, sunDirection),
    createAtmosphere(), sunlight, hemisphere);
  scene.add(group);
  let disposed = false;
  const instance: GlobeInstance = {
    group, quality, dpr,
    setSun(lon, lat) {
      const p = cartesian(lon, lat);
      sunDirection.set(p.x, p.y, p.z);
      sunlight.position.copy(sunDirection).multiplyScalar(5);
      sunlight.target.position.set(0, 0, 0);
      sunlight.target.updateMatrixWorld();
    },
    pick(screenX, screenY, camera) {
      if (disposed) return null;
      const rect = opts.viewport?.() ?? opts.canvas?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      const x = (screenX - rect.left) / rect.width * 2 - 1;
      const y = 1 - (screenY - rect.top) / rect.height * 2;
      return pickSphereNdc(x, y, camera);
    },
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
      sunlight.shadow.dispose();
      group.clear();
    },
  };
  instance.setSun(5, 18);
  return instance;
}
