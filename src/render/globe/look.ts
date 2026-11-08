// [ext-03, G2/G3] Globe looks (docs/mockups/globe-2026-11/). `satellite` is the shipped globe (D-170): its textures
// are in public/data/globe/ (G1). The other looks are DEV comparisons (`?globeLook=`), their textures served by the
// Vite dev server from dev/globe-look/assets/ (never in the build); `diorama` is the fallback when textures fail.
//   refined   A "Dopracowana diorama": same illustrated world, smooth mesh, muted biomes, tidy decorations.
//   satellite B "Realistyczny": NASA Blue Marble / Black Marble textures, ETOPO5 relief, cloud shell.
//   painted   C "Pomiędzy": Blue Marble colours simplified into painted areas, ETOPO5 relief, diorama clouds.
//   map       D-172 "Mapa" mode next to B: own cartographic palette, country borders, the same relief mesh.
import {
  BackSide, FrontSide, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, RepeatWrapping,
  ShaderMaterial, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3, type Texture,
} from 'three';
import type { QualityLevel, TerrainStyle } from './terrain';
import type { DecorOptions } from './decorations';
import { patchDayNightShader } from './daynight';

export type GlobeLook = 'diorama' | 'refined' | 'satellite' | 'painted' | 'map' | 'linoryt'; // [ext-04 E1] D-283
export const GLOBE_LOOKS: readonly GlobeLook[] = ['diorama', 'refined', 'satellite', 'painted', 'map'];

/**
 * [ext-04 E3] D-283: the globe a release build draws when no look is asked for. `satellite` until the flip (step U5 of
 * PLAN-LINORYT.md switches it to `linoryt` together with the Linoryt UI skin); the Linoryt look itself ships from E3.
 */
export const DEFAULT_GLOBE_LOOK = 'satellite' as 'satellite' | 'linoryt';

/** Parse a `?globeLook=` value; anything unknown is the diorama (the texture-free fallback; the shipped look is `satellite`, D-170). */
export function parseGlobeLook(value: string | null | undefined): GlobeLook {
  return (GLOBE_LOOKS as readonly string[]).includes(value ?? '') ? value as GlobeLook : 'diorama';
}

interface LookConfig {
  readonly terrain: 'refined' | 'textured';
  readonly decor: Omit<DecorOptions, 'style'>;
  /** Colour texture per preset (file name under the asset base), or none (vertex colours). */
  readonly day: Record<QualityLevel, string> | null;
  readonly night: Record<QualityLevel, string> | null;
  /** City-light gain on the night side (texture looks). */
  readonly nightGain: number;
  readonly clouds: string | null;
  /** [G2/G3] Files ship in `public/data/globe/` (production, D-170) rather than the dev-server experiment folder. */
  readonly production?: boolean;
  /** Ocean shell: tint alpha (how much it veils the sea floor colour) and glint strength. */
  readonly ocean: { readonly veil: number; readonly glint: number };
  /** [G8] Strength of the near-limb haze folded into the terrain (1 = satellite; the light Mapa takes less). */
  readonly haze?: number;
}

export const LOOKS: Record<Exclude<GlobeLook, 'diorama' | 'linoryt'>, LookConfig> = {
  refined: {
    terrain: 'refined',
    decor: { trees: .6, rocks: .25, clouds: .7, lights: 1, tidy: true },
    day: null, night: null, nightGain: 0, clouds: null,
    ocean: { veil: .16, glint: .55 },
  },
  satellite: {
    terrain: 'textured',
    decor: { trees: 0, rocks: 0, clouds: 0, lights: 0, tidy: true },
    // [G2/G3] The shipped globe (D-170): G1 files, 2048 + 1024 and no cloud shell on low/saver (D-173).
    production: true,
    day: { low: 'day-2048.jpg', medium: 'day-4096.jpg', high: 'day-4096.jpg' },
    night: { low: 'night-1024.jpg', medium: 'night-2048.jpg', high: 'night-2048.jpg' },
    nightGain: 1.6, clouds: 'clouds-2048.png',
    ocean: { veil: .1, glint: .8 },
  },
  painted: {
    terrain: 'textured',
    decor: { trees: 0, rocks: 0, clouds: .45, lights: 0, tidy: true },
    day: { low: 'painted-2048.jpg', medium: 'painted-4096.jpg', high: 'painted-4096.jpg' },
    night: { low: 'painted-night-1024.jpg', medium: 'painted-night-2048.jpg', high: 'painted-night-2048.jpg' },
    nightGain: 1.3, clouds: null,
    ocean: { veil: .12, glint: .5 },
  },
  map: {
    terrain: 'textured',
    decor: { trees: 0, rocks: 0, clouds: 0, lights: 0, tidy: true },
    // [G8] D-172: the shipped second globe mode; same night lights as the satellite (Black Marble).
    production: true,
    day: { low: 'map-2048.jpg', medium: 'map-4096.jpg', high: 'map-4096.jpg' },
    night: { low: 'night-1024.jpg', medium: 'night-2048.jpg', high: 'night-2048.jpg' },
    nightGain: 1.1, clouds: null,
    ocean: { veil: .05, glint: .3 }, haze: .35,
  },
};

export interface LookAssets {
  readonly style: TerrainStyle;
  readonly decor: DecorOptions;
  readonly day: Texture | null;
  readonly night: Texture | null;
  readonly clouds: Texture | null;
  readonly config: LookConfig;
  /** Bytes fetched for this look (textures + elevation), for the mockup report. */
  readonly bytes: number;
}

async function fetchBytes(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('globe look asset ' + url + ': HTTP ' + response.status);
  return response.blob();
}

/** 8-bit sqrt-encoded elevation raster (dev/globe-look/bake.py) → bilinear metres sampler. */
async function loadElevation(blob: Blob): Promise<(lon: number, lat: number) => number> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas unavailable');
  context.drawImage(bitmap, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  const metres = new Float32Array(width * height);
  for (let i = 0; i < metres.length; i++) { const v = data[i * 4] / 255; metres[i] = v * v * 8000; }
  return (lon, lat) => {
    const x = ((lon + 180) / 360) * width - .5, y = ((90 - lat) / 180) * height - .5;
    const x0 = Math.floor(x), y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
    const y1 = Math.min(height - 1, y0 + 1), fx = x - x0, fy = Math.max(0, Math.min(1, y - y0));
    const xa = ((x0 % width) + width) % width, xb = (xa + 1) % width;
    const top = metres[y0 * width + xa] * (1 - fx) + metres[y0 * width + xb] * fx;
    const bottom = metres[y1 * width + xa] * (1 - fx) + metres[y1 * width + xb] * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

async function loadTexture(blob: Blob, srgb: boolean): Promise<Texture> {
  const url = URL.createObjectURL(blob);
  try {
    const texture = await new TextureLoader().loadAsync(url);
    texture.colorSpace = srgb ? SRGBColorSpace : '';
    texture.wrapS = RepeatWrapping;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = 4;
    return texture;
  } finally { URL.revokeObjectURL(url); }
}

/** Fetch everything a look needs before the terrain is built (heights must exist at build time). */
export async function loadLookAssets(look: Exclude<GlobeLook, 'diorama' | 'linoryt'>, preset: QualityLevel, devBase: string,
  signal?: AbortSignal, productionBase = 'data/globe/'): Promise<LookAssets> {
  const config = LOOKS[look];
  const base = config.production ? productionBase : devBase;
  let bytes = 0;
  const get = async (name: string): Promise<Blob> => {
    const blob = await fetchBytes(base + name, signal);
    bytes += blob.size;
    return blob;
  };
  let style: TerrainStyle = { id: 'refined', elevation: null };
  let day: Texture | null = null, night: Texture | null = null, clouds: Texture | null = null;
  if (config.terrain === 'textured') {
    const [elevation, dayBlob, nightBlob, cloudBlob] = await Promise.all([
      get('elevation-2048.png'), get(config.day![preset]),
      config.night ? get(config.night[preset]) : null,
      config.clouds && preset !== 'low' ? get(config.clouds) : null, // D-173: no cloud shell on low/saver
    ]);
    style = { id: 'textured', elevation: await loadElevation(elevation) };
    day = await loadTexture(dayBlob, true);
    if (nightBlob) night = await loadTexture(nightBlob, false);
    if (cloudBlob) clouds = await loadTexture(cloudBlob, false);
  }
  return { style, decor: { ...config.decor, style }, day, night, clouds, config, bytes };
}

/** Equirectangular lookup by surface direction, with seam-free mip selection at the antimeridian. */
const SAMPLE_GLSL = `
vec4 awSampleSphere(sampler2D tex, vec3 dir) {
  vec3 d = normalize(dir);
  vec2 uv = vec2(atan(d.x, d.z) / 6.28318531 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.14159265 + 0.5);
  vec2 uvB = vec2(fract(uv.x + 0.5), uv.y);
  vec2 dxA = dFdx(uv), dyA = dFdy(uv), dxB = dFdx(uvB), dyB = dFdy(uvB);
  bool useB = abs(dxA.x) + abs(dyA.x) > abs(dxB.x) + abs(dyB.x);
  return textureGrad(tex, uv, useB ? dxB : dxA, useB ? dyB : dyA);
}
`;

/**
 * Terrain material for the texture looks: the colour comes from the day texture by surface direction,
 * the day/night grade is the shipped one (daynight.ts), and the night side adds the city-light texture.
 */
/** [G8] Uniforms of the textured terrain, shared with the compiled program so a mode switch is a value swap. */
interface SurfaceUniforms {
  awDay: { value: Texture | null };
  awNightLights: { value: Texture | null };
  awNightGain: { value: number };
  awVeil: { value: number };
  awGlint: { value: number };
  awHaze: { value: number };
}

/** [G8] D-172: point the textured terrain at another surface (Satelita ↔ Mapa) without rebuilding anything. */
export function setSurface(material: MeshStandardMaterial, day: Texture, night: Texture | null, config: LookConfig): void {
  const u = material.userData['awSurface'] as SurfaceUniforms | undefined;
  if (!u) return;
  u.awDay.value = day;
  u.awNightLights.value = night;
  u.awNightGain.value = night ? config.nightGain : 0;
  u.awVeil.value = config.ocean.veil;
  u.awGlint.value = config.ocean.glint;
  u.awHaze.value = config.haze ?? 1;
}

/** [G8] One texture by URL (the cloud shell added later when switching Mapa → Satelita). */
export async function fetchTexture(url: string, srgb: boolean, signal?: AbortSignal): Promise<Texture> {
  return loadTexture(await fetchBytes(url, signal), srgb);
}

/** [G8] Day and night textures of a texture look for a preset (no elevation, no clouds). */
export async function loadSurfaceTextures(look: Exclude<GlobeLook, 'diorama' | 'linoryt'>, preset: QualityLevel, devBase: string,
  productionBase: string, signal?: AbortSignal): Promise<{ day: Texture; night: Texture | null; config: LookConfig }> {
  const config = LOOKS[look];
  const base = config.production ? productionBase : devBase;
  if (!config.day) throw new Error('look ' + look + ' has no surface texture');
  const [dayBlob, nightBlob] = await Promise.all([fetchBytes(base + config.day[preset], signal),
    config.night ? fetchBytes(base + config.night[preset], signal) : null]);
  return { day: await loadTexture(dayBlob, true), night: nightBlob ? await loadTexture(nightBlob, false) : null, config };
}

export function createTexturedTerrainMaterial(assets: LookAssets, sunDirection: Vector3): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .95, metalness: 0 });
  material.userData['awDayNight'] = true; // the grade is applied here, inside this material's own patch
  const sun = { value: sunDirection };
  const surface: SurfaceUniforms = {
    awDay: { value: assets.day }, awNightLights: { value: assets.night },
    awNightGain: { value: assets.night ? assets.config.nightGain : 0 },
    awVeil: { value: assets.config.ocean.veil }, awGlint: { value: assets.config.ocean.glint },
    awHaze: { value: assets.config.haze ?? 1 },
  };
  material.userData['awSurface'] = surface;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, surface);
    shader.vertexShader = 'varying vec3 vAwDir;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n  vAwDir = position;');
    shader.fragmentShader = 'uniform sampler2D awDay;\nuniform sampler2D awNightLights;\nuniform float awNightGain;\n' +
      'uniform float awVeil;\nuniform float awGlint;\nuniform float awHaze;\n' +
      'varying vec3 vAwDir;\n' + SAMPLE_GLSL + shader.fragmentShader.replace(
      '#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= awSampleSphere(awDay, vAwDir).rgb;');
    patchDayNightShader(shader, sun);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
  {
    float awLit = dot(normalize(vAwSurface), awSunDirection);
    float awDark = 1.0 - smoothstep(-0.14, 0.04, awLit);
    float awCity = awSampleSphere(awNightLights, vAwDir).r;
    outgoingLight += vec3(1.0, 0.70, 0.36) * awCity * awDark * awNightGain;
  }
  {
    // [G4] D-173: the sea surface (glint, fresnel sheen) and the near-limb haze, folded into the terrain pass
    // instead of two transparent full-screen shells. Same formulas as createOceanShell/createScatterAtmosphere,
    // tints converted to linear because this runs before tone mapping.
    vec3 awN = normalize(vAwSurface);
    vec3 awV = normalize(cameraPosition - vAwSurface);
    float awNs = dot(awN, awSunDirection);
    float awDay = smoothstep(-0.12, 0.2, awNs);
    float awSea = 1.0 - smoothstep(0.9995, 1.0002, length(vAwSurface));
    float awFacing = max(dot(awN, awV), 0.0);
    float awFresnel = pow(1.0 - awFacing, 4.0);
    vec3 awH = normalize(awSunDirection + awV);
    float awSpec = pow(max(dot(awN, awH), 0.0), 600.0) * 0.6 + pow(max(dot(awN, awH), 0.0), 60.0) * 0.05;
    vec3 awSky = mix(vec3(0.34, 0.6, 0.79), vec3(1.0, 0.49, 0.18), 1.0 - smoothstep(0.0, 0.25, awNs));
    vec3 awWater = mix(vec3(0.002, 0.013, 0.033), awSky, awFresnel) * (0.25 + 0.75 * awDay);
    outgoingLight = mix(outgoingLight, awWater, (awVeil + 0.45 * awFresnel * awDay) * awSea);
    outgoingLight += vec3(1.0, 0.78, 0.52) * awSpec * awGlint * awDay * awSea * 0.55;
    float awLitHaze = smoothstep(-0.3, 0.25, awNs);
    float awDuskHaze = 1.0 - smoothstep(0.0, 0.35, abs(awNs + 0.02));
    vec3 awTint = mix(vec3(0.21, 0.51, 0.91), vec3(1.0, 0.34, 0.11), awDuskHaze * 0.7);
    outgoingLight = mix(outgoingLight, awTint, pow(1.0 - awFacing, 2.4) * (0.04 + 0.34 * awLitHaze) * awHaze);
  }
  #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'aw-look-textured';
  return material;
}

/** Transparent sea surface just above the coast cut: sun glint, fresnel sheen, night-side darkening. */
export function createOceanShell(look: LookConfig, sunDirection: Vector3, segments: number): Mesh {
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, side: FrontSide,
    uniforms: { sunDirection: { value: sunDirection }, veil: { value: look.ocean.veil }, glint: { value: look.ocean.glint } },
    vertexShader: `varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `uniform vec3 sunDirection; uniform float veil; uniform float glint; varying vec3 vWorld;
      void main() {
        vec3 n = normalize(vWorld);
        vec3 v = normalize(cameraPosition - vWorld);
        vec3 s = normalize(sunDirection);
        float ns = dot(n, s);
        float day = smoothstep(-0.12, 0.2, ns);
        float fresnel = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        vec3 h = normalize(s + v);
        float spec = pow(max(dot(n, h), 0.0), 600.0) * 0.6 + pow(max(dot(n, h), 0.0), 60.0) * 0.05;
        vec3 sky = mix(vec3(0.62, 0.80, 0.90), vec3(1.0, 0.72, 0.45), 1.0 - smoothstep(0.0, 0.25, ns));
        vec3 colour = mix(vec3(0.03, 0.12, 0.2), sky, fresnel) * (0.25 + 0.75 * day);
        float alpha = veil + 0.45 * fresnel * day;
        vec3 sun = vec3(1.0, 0.9, 0.75) * spec * glint * day;
        gl_FragColor = vec4(colour * alpha + sun, clamp(alpha + dot(sun, vec3(0.33)), 0.0, 0.9));
        gl_FragColor.rgb /= max(gl_FragColor.a, 0.001);
      }`,
  });
  const mesh = new Mesh(new SphereGeometry(1.0002, segments, Math.round(segments * .6)), material);
  mesh.name = 'LookOcean';
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * Sun-aware limb glow (blue by day, warm at the terminator, none at night) plus a thin haze over the land.
 * [G4] Texture looks fold the haze into the terrain shader and use only the outer halo (`haloOnly`).
 */
export function createScatterAtmosphere(sunDirection: Vector3, haloOnly = false): Mesh[] {
  const common = `uniform vec3 sunDirection; varying vec3 vNormal; varying vec3 vWorld;`;
  const vertexShader = `${common}
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(mat3(modelMatrix) * normal);
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`;
  const colour = `
    vec3 n = normalize(vWorld);
    float ns = dot(n, normalize(sunDirection));
    float lit = smoothstep(-0.3, 0.25, ns);
    float dusk = 1.0 - smoothstep(0.0, 0.35, abs(ns + 0.02));
    vec3 tint = mix(vec3(0.50, 0.74, 0.96), vec3(1.0, 0.62, 0.36), dusk * 0.7);`;
  const halo = new ShaderMaterial({
    side: BackSide, transparent: true, depthWrite: false, uniforms: { sunDirection: { value: sunDirection } },
    vertexShader,
    fragmentShader: `${common}
      void main() {
        ${colour}
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(cameraPosition - vWorld))), 3.2);
        gl_FragColor = vec4(tint, rim * (0.06 + 0.42 * lit));
      }`,
  });
  const haze = new ShaderMaterial({
    side: FrontSide, transparent: true, depthWrite: false, uniforms: { sunDirection: { value: sunDirection } },
    vertexShader,
    fragmentShader: `${common}
      void main() {
        ${colour}
        float edge = pow(1.0 - max(dot(normalize(vNormal), normalize(cameraPosition - vWorld)), 0.0), 2.4);
        gl_FragColor = vec4(tint, edge * (0.04 + 0.34 * lit));
      }`,
  });
  const outer = new Mesh(new SphereGeometry(1.07, 64, 40), halo);
  outer.name = 'LookAtmosphere';
  const inner = new Mesh(new SphereGeometry(1.0125, 96, 60), haze);
  inner.name = 'LookHaze';
  inner.renderOrder = 3;
  if (haloOnly) { inner.geometry.dispose(); haze.dispose(); return [outer]; }
  return [outer, inner];
}

/** Cloud cover just above the lowlands (under the airport pads, so clouds never hide an airport). */
export function createCloudShell(texture: Texture, sunDirection: Vector3, segments: number): Mesh {
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { sunDirection: { value: sunDirection }, clouds: { value: texture } },
    vertexShader: `varying vec3 vWorld; varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `uniform vec3 sunDirection; uniform sampler2D clouds; varying vec3 vWorld; varying vec3 vDir;
      ${SAMPLE_GLSL}
      void main() {
        float c = awSampleSphere(clouds, vDir).r;
        float ns = dot(normalize(vWorld), normalize(sunDirection));
        float day = smoothstep(-0.15, 0.2, ns);
        float dusk = 1.0 - smoothstep(0.0, 0.3, abs(ns));
        vec3 lit = mix(vec3(0.97, 0.98, 1.0), vec3(1.0, 0.74, 0.52), dusk * 0.8);
        vec3 colour = mix(vec3(0.16, 0.2, 0.3), lit, day);
        gl_FragColor = vec4(colour, c * (0.22 + 0.5 * day));
      }`,
  });
  const mesh = new Mesh(new SphereGeometry(1.0048, segments, Math.round(segments * .6)), material);
  mesh.name = 'LookClouds';
  mesh.renderOrder = 2;
  return mesh;
}
