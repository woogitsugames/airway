import {
  BackSide, Color, DirectionalLight, Group, HemisphereLight, InstancedMesh,
  Mesh, Points, Scene, ShaderMaterial, SphereGeometry, Vector3, type Camera,
} from 'three';
import type { QualityProfile } from '../quality';
import { applyDayNightGrading } from './daynight';
import { createDecorations } from './decorations';
import { createDecorCuller, type DecorCullStats } from './decor-cull';
import { setLatLonVec3 } from './geo-math';
import { loadLandMask } from './land-mask';
import { chunkTerrain, createTerrainLod, TERRAIN_LOD_LEVELS, type TerrainLod } from './lod';
import { buildTerrainArrays, createTerrainMaterial, DIORAMA_STYLE } from './terrain';
import {
  createCloudShell, createOceanShell, createScatterAtmosphere, createTexturedTerrainMaterial, fetchTexture,
  loadLookAssets, loadSurfaceTextures, LOOKS, setSurface, type GlobeLook, type LookAssets,
} from './look';
import type { MeshStandardMaterial, Texture } from 'three';

export {
  latLonToVec3, setLatLonVec3, vec3ToLatLon, intersectUnitSphere, pickSphereNdc, normalizeLon,
} from './geo-math';
export type { LonLat, Vec3Like, MutableVec3 } from './geo-math';
export type { QualityLevel } from './terrain';
export type { TerrainLodStats } from './lod';
export type { DecorCullStats } from './decor-cull';
export type { GlobeLook } from './look';
/** [night-04] Decorations thinned by `setDecorDensity` (clouds stay: they carry the sky). */
const THINNED = new Set(['Conifers', 'BroadleafTrees', 'Rocks']);

export interface GlobeOptions {
  /** Shared profile from `resolveQualityProfile()`; terrain/decor density follows `preset`. */
  readonly quality: QualityProfile;
  readonly seed?: number;
  readonly landUrl?: string;
  readonly signal?: AbortSignal;
  /** `SunLights.direction`; drives the night-side city lights. */
  readonly sunDirection: Vector3;
  /** [G2/G3] Globe look; default `satellite` (D-170). Other looks are DEV comparisons; `diorama` is the fallback. */
  readonly look?: GlobeLook;
  /** [ext-03] Where the experimental textures live (default: the dev server's dev/globe-look/assets/). */
  readonly lookAssetBase?: string;
}
export interface GlobeInstance {
  readonly group: Group;
  readonly quality: QualityProfile;
  /** [night-04] Terrain chunks and level for this camera (D-73); call once per rendered frame. */
  update(camera: Camera, pixelsPerDegree: number): void;
  /** [night-04] 0..1 share of trees, rocks and city lights drawn (battery saver, adaptive quality). */
  setDecorDensity(density: number): void;
  readonly lod: TerrainLod;
  /** [night-07f] Trees and rocks drawn after chunk culling (D-75). */
  readonly decor: DecorCullStats;
  /**
   * [G8] D-172: swap the surface of a texture globe (`satellite` ↔ `map`) without rebuilding the terrain. Resolves
   * false when this globe is not textured (diorama fallback) or the textures cannot be loaded.
   */
  setSurfaceLook(look: 'satellite' | 'map'): Promise<boolean>;
  /** [G8] The surface currently drawn (`diorama` for the fallback). */
  readonly surfaceLook: GlobeLook;
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
  // [G2/G3] D-170: the satellite globe (Blue Marble, Black Marble, ETOPO5; public/data/globe/). If its textures cannot
  // be loaded the diorama is built instead, so the game never starts without a world. refined/painted/map are
  // DEV comparisons served from dev/globe-look/assets/.
  const look = opts.look ?? 'satellite';
  let assets: LookAssets | null = null;
  if (look !== 'diorama') {
    try {
      assets = await loadLookAssets(look, quality,
        opts.lookAssetBase ?? `${import.meta.env.BASE_URL}dev/globe-look/assets/`, opts.signal,
        `${import.meta.env.BASE_URL}data/globe/`);
    } catch (error) {
      if (opts.signal?.aborted) throw error;
      console.warn('Globe textures unavailable; drawing the diorama globe.', error);
    }
  }
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const style = assets?.style ?? DIORAMA_STYLE;
  let cloudShell: Mesh | null = null;
  let cloudTexture: Texture | null = assets?.clouds ?? null;
  let surfaceLook: GlobeLook = assets ? look : 'diorama';
  let day = assets?.day ?? null, night = assets?.night ?? null;
  let swap = 0;
  const group = new Group();
  group.name = 'AirwayDioramaGlobe';
  // [night-04] D-73: near (preset) level plus a coarser far level, both chunked for culling.
  const terrainMaterial = assets?.config.terrain === 'textured'
    ? createTexturedTerrainMaterial(assets, opts.sunDirection) : createTerrainMaterial(style);
  const lod = createTerrainLod(
    TERRAIN_LOD_LEVELS[quality].map((level) => chunkTerrain(buildTerrainArrays(mask, level, style), level)),
    terrainMaterial);
  const textured = assets?.config.terrain === 'textured';
  const devBase = opts.lookAssetBase ?? `${import.meta.env.BASE_URL}dev/globe-look/assets/`;
  const productionBase = `${import.meta.env.BASE_URL}data/globe/`;
  const decorations = createDecorations(mask, quality, opts.seed ?? 7, opts.sunDirection, assets?.decor);
  group.add(lod.group, decorations);
  if (assets) {
    const segments = quality === 'low' ? 96 : quality === 'medium' ? 128 : 160;
    // [G4] Texture looks carry the sea surface and haze in the terrain shader: only the halo (and clouds) stay layers.
    if (assets.config.terrain === 'textured') group.add(...createScatterAtmosphere(opts.sunDirection, true));
    else group.add(createOceanShell(assets.config, opts.sunDirection, segments), ...createScatterAtmosphere(opts.sunDirection));
    if (assets.clouds) {
      cloudShell = createCloudShell(assets.clouds, opts.sunDirection, segments);
      group.add(cloudShell);
    }
    group.userData['lookBytes'] = assets.bytes;
  } else group.add(createAtmosphere());
  // Instances are placed in random order, so any prefix is an even thinning of the whole set.
  // [night-07f] Trees and rocks: chunk-culled and thinned per chunk (decor-cull.ts); city lights: a prefix.
  const culled: InstancedMesh[] = [];
  const thinned: { object: Points; full: number }[] = [];
  decorations.traverse((object) => {
    if (object instanceof InstancedMesh && THINNED.has(object.name)) culled.push(object);
    else if (object instanceof Points) thinned.push({ object, full: object.geometry.getAttribute('position').count });
  });
  const culler = createDecorCuller(culled);
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
    group, quality: opts.quality, lod, decor: culler.stats,
    get surfaceLook() { return surfaceLook; },
    async setSurfaceLook(next) {
      if (!textured || disposed) return false;
      if (next === surfaceLook) return true;
      const mine = ++swap;
      try {
        const loaded = await loadSurfaceTextures(next, quality, devBase, productionBase);
        if (disposed || mine !== swap) { loaded.day.dispose(); loaded.night?.dispose(); return false; }
        const oldDay = day, oldNight = night;
        setSurface(terrainMaterial as MeshStandardMaterial, loaded.day, loaded.night, loaded.config);
        day = loaded.day; night = loaded.night;
        oldDay?.dispose(); if (oldNight !== night) oldNight?.dispose();
        surfaceLook = next;
        // Clouds belong to the satellite view (D-173: never on low); the map stays clear.
        const wantClouds = !!loaded.config.clouds && quality !== 'low';
        if (wantClouds && !cloudShell) {
          cloudTexture = await fetchTexture(productionBase + LOOKS.satellite.clouds, false);
          if (disposed) { cloudTexture.dispose(); return false; }
          const segments = quality === 'medium' ? 128 : 160;
          cloudShell = createCloudShell(cloudTexture, opts.sunDirection, segments);
          group.add(cloudShell);
        }
        if (cloudShell) cloudShell.visible = wantClouds;
        return true;
      } catch (error) {
        console.warn('Globe surface ' + next + ' unavailable; keeping ' + surfaceLook + '.', error);
        return false;
      }
    },
    update(camera, pixelsPerDegree) {
      lod.update(camera, pixelsPerDegree);
      culler.update(camera);
    },
    setDecorDensity(density) {
      const share = Math.max(0, Math.min(1, density));
      culler.setDensity(share);
      for (const { object, full } of thinned) object.geometry.setDrawRange(0, Math.round(full * share));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      lod.dispose();
      for (const texture of [day, night, cloudTexture]) texture?.dispose();
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
