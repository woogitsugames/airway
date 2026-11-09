// [night-70a R1] D-323: the realistic NASA globe, loaded with a dynamic import as a chunk of its own ([night-82a R6]
// D-337: the one globe since the old print went). One fragment shader on the terrain mesh, after the K1/K2 mockup shader
// (docs/styles/kierunki-2026-11c/makiety/src/globe.js):
//   - Blue Marble NG July 2004 (D-176) day image with our own grading (less saturation, lifted mids, cooler deep water);
//   - Black Marble 2016 at night, the city lights split from its blue base (lights keep their sodium colour);
//   - the terminator from the shared sun direction (`SunLights.direction`, moved by the game day clock in `sun.ts`):
//     a narrow warm dusk band that only tints the lit colour, no glow on the night side;
//   - relief from the ETOPO5 raster as a perturbed normal for the direct light (follows the sun);
//   - limb haze on the lit side only; on `high` also the sun glint on the sea and a thin atmosphere shell.
// Textures start at 2048/1024 and are swapped for 4096/2048 after the first frame (medium/high), decoded off the
// render thread with `createImageBitmap`. After a WebGL context loss three.js re-uploads them from the kept bitmaps.
import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, Group,
  LinearFilter, LinearMipmapLinearFilter, Mesh, NoColorSpace, Points, PointsMaterial, RepeatWrapping, RGFormat, Scene,
  ShaderMaterial, SphereGeometry, Texture, UnsignedByteType, Vector3,
} from 'three';
import type { QualityProfile } from '../quality';
import { BORDERS_FILE, createBorderLayer, loadBorders } from './borders';
import { EARTH_LOOK, EARTH_TEXTURES, earthPreset, type EarthPreset } from './earth';
import { elevationSampler, loadElevationBytes } from './elevation';
import type { GlobeInstance } from './index';
import type { LandMask } from './land-mask';
import { chunkTerrain, createTerrainLod, TERRAIN_LOD_LEVELS } from './lod';
import { buildTerrainArrays, createSample, sampleAt, type TerrainStyle } from './terrain';

const DEG = Math.PI / 180;

// ---- Textures -------------------------------------------------------------------------------------------------

async function loadBitmap(url: string, signal?: AbortSignal): Promise<{ bitmap: ImageBitmap; bytes: number }> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Earth texture ' + url + ': HTTP ' + response.status);
  const blob = await response.blob();
  // Decoded off the render thread; rows stay north-first (the shader samples v = 0.5 − lat/π).
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  return { bitmap, bytes: blob.size };
}

function photoTexture(bitmap: ImageBitmap): Texture {
  const texture = new Texture(bitmap);
  texture.flipY = false;
  texture.colorSpace = NoColorSpace; // the shader grades the stored sRGB values (as the mockup), no decode
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Relief gradient (RG8, same grid as the elevation raster): east and north slope of the sqrt-encoded ETOPO5 heights,
 * box-smoothed 3×3, signed around 128. The shader tilts the normal by it for the direct light only.
 */
export function buildReliefGradient(bytes: Uint8Array, width: number, height: number): Uint8Array<ArrayBuffer> {
  const h = new Float32Array(width * height);
  for (let i = 0; i < h.length; i++) h[i] = bytes[i] / 255;
  const out = new Uint8Array(width * height * 2);
  const gain = 9; // sqrt units per pixel → a slope that reads at phone size (the true slope is ~1 % of this)
  for (let y = 0; y < height; y++) {
    const c = Math.max(0.15, Math.cos((90 - (y + 0.5) * 180 / height) * DEG));
    const up = Math.max(0, y - 1) * width, down = Math.min(height - 1, y + 1) * width, row = y * width;
    for (let x = 0; x < width; x++) {
      const l = (x + width - 1) % width, r = (x + 1) % width;
      let gx = 0, gy = 0;
      for (const base of [up, row, down]) gx += h[base + r] - h[base + l];
      for (const dx of [l, x, r]) gy += h[up + dx] - h[down + dx];
      gx = gx / 6 * gain / c;
      gy = gy / 6 * gain;
      const i = (row + x) * 2;
      out[i] = Math.round(128 + 127 * Math.max(-1, Math.min(1, gx)));
      out[i + 1] = Math.round(128 + 127 * Math.max(-1, Math.min(1, gy)));
    }
  }
  return out;
}

// ---- Shaders --------------------------------------------------------------------------------------------------

const VERTEX = /* glsl */ `
varying vec3 vAwWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vAwWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

/** Globe fragment. Weights mirror `earthNightWeight`, `earthDuskWeight` and `earthDayLight` in earth.ts. */
const FRAGMENT = /* glsl */ `
uniform sampler2D awDay;
uniform sampler2D awNight;
uniform sampler2D awReliefMap;
uniform vec3 awSunDirection;
uniform vec3 awAtmosphere;
uniform float awNightGain;
uniform float awMoon;
uniform float awMoonLand;
uniform float awMoonLandFloor;
uniform float awGrade;
uniform float awHaze;
uniform float awReliefGain;
varying vec3 vAwWorld;
const float AW_PI = 3.14159265;
vec3 awSat(vec3 c, float s) { float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return mix(vec3(l), c, s); }
void main() {
  vec3 n = normalize(vAwWorld);
  vec3 ndx = dFdx(n), ndy = dFdy(n);
  float lambda = atan(n.x, n.z);
  float phi = asin(clamp(n.y, -1.0, 1.0));
  float cphi = max(cos(phi), 1e-4);
  float r2 = max(n.x * n.x + n.z * n.z, 1e-8);
  // Seam-free screen derivatives of longitude and latitude, so the mip level does not jump at the antimeridian.
  vec2 dLambda = vec2(n.z * ndx.x - n.x * ndx.z, n.z * ndy.x - n.x * ndy.z) / r2;
  vec2 dPhi = vec2(ndx.y, ndy.y) / cphi;
  vec2 uv = vec2(lambda / (2.0 * AW_PI) + 0.5, 0.5 - phi / AW_PI);
  vec2 gx = vec2(dLambda.x, -dPhi.x * 2.0) / (2.0 * AW_PI);
  vec2 gy = vec2(dLambda.y, -dPhi.y * 2.0) / (2.0 * AW_PI);
  vec3 day = textureGrad(awDay, uv, gx, gy).rgb;
  vec3 nightTex = textureGrad(awNight, uv, gx, gy).rgb;
  vec2 slope = textureGrad(awReliefMap, uv, gx, gy).rg - 0.50196;

  // Own grading: a touch less saturation, lifted mids, cooler deep water (not a wallpaper photo).
  float lum = dot(day, vec3(0.2126, 0.7152, 0.0722));
  float water = smoothstep(0.02, 0.10, day.b - day.r) * (1.0 - smoothstep(0.30, 0.45, lum));
  day = awSat(day, mix(0.84, 0.80, water));
  day = pow(max(day, vec3(0.0)), vec3(awGrade));
  day = mix(day, day * vec3(0.80, 0.95, 1.02), water * 0.7);

  // Relief: tilt the normal along the ETOPO5 slope (east, north) for the direct light only.
  vec3 east = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0));
  vec3 north = cross(n, east);
  vec3 nr = normalize(n - awReliefGain * (slope.x * east + slope.y * north) * (1.0 - water));

  vec3 V = normalize(cameraPosition - vAwWorld);
  float ndl = dot(n, awSunDirection);
  float light = pow(clamp(dot(nr, awSunDirection) * 2.2 + 0.1, 0.0, 1.0), 0.6);
  // Keep the relief from lighting anything past the terminator.
  light *= smoothstep(-0.12, 0.02, ndl);
  vec3 colour = day * (0.035 + 1.08 * light);
  #ifdef AW_GLINT
  vec3 H = normalize(awSunDirection + V);
  colour += vec3(1.0, 0.93, 0.80) * pow(max(dot(n, H), 0.0), 70.0) * 0.30 * water * smoothstep(0.0, 0.2, ndl);
  #endif
  // Dusk: warm, narrow, physical; it tints the lit colour and adds nothing to the night side.
  float dusk = smoothstep(-0.20, -0.01, ndl) * (1.0 - smoothstep(-0.01, 0.16, ndl));
  colour = mix(colour, colour * vec3(1.25, 0.82, 0.62) + vec3(0.035, 0.012, 0.0) * light, dusk * 0.55);
  // Night: Black Marble lights split from its blue base (base neutral and dim, lights keep their sodium colour).
  float nightW = 1.0 - smoothstep(-0.14, 0.06, ndl);
  float nlum = dot(nightTex, vec3(0.2126, 0.7152, 0.0722));
  float lm = smoothstep(0.16, 0.42, nlum);
  vec3 base = vec3(nlum) * vec3(0.62, 0.68, 0.76) * 0.55;
  vec3 lights = mix(base, pow(nightTex, vec3(1.15)) * vec3(1.06, 0.98, 0.86), lm) * awNightGain;
  // [night-81a] D-336: moonlight, a little stronger on land (and a flat floor there), so continents and coasts read at
  // night; the sea keeps the old moonlight, the city lights stay far brighter (earthMoonlight in earth.ts).
  float land = 1.0 - water;
  float moon = dot(day, vec3(0.3, 0.55, 0.15)) * (awMoon + awMoonLand * land) + awMoonLandFloor * land;
  colour += nightW * (lights + vec3(moon) * vec3(0.70, 0.78, 0.86));
  // Limb haze, lit side only.
  float fr = pow(1.0 - max(dot(n, V), 0.0), 2.6);
  float hz = fr * awHaze * smoothstep(-0.25, 0.35, ndl);
  colour = mix(colour, awAtmosphere * (0.35 + 0.75 * light), clamp(hz, 0.0, 0.85));
  gl_FragColor = vec4(colour, 1.0);
}`;

const SHELL_VERTEX = /* glsl */ `
varying vec3 vAwWorld;
void main() { vAwWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SHELL_FRAGMENT = /* glsl */ `
uniform vec3 awSunDirection;
uniform vec3 awAtmosphere;
uniform float awStrength;
uniform float awShellRadius;
varying vec3 vAwWorld;
void main() {
  vec3 V = normalize(cameraPosition - vAwWorld);
  // Impact parameter of the view ray: 1 = the planet's limb, awShellRadius = the top of the shell.
  float b = length(cross(vAwWorld, V));
  float t = clamp((b - 1.0) / (awShellRadius - 1.0), 0.0, 1.0);
  float rim = pow(1.0 - t, 2.4);
  float sl = dot(normalize(vAwWorld), awSunDirection);
  float lit = smoothstep(-0.30, 0.30, sl);
  vec3 c = mix(vec3(0.78, 0.60, 0.52), awAtmosphere, smoothstep(-0.18, 0.15, sl));
  gl_FragColor = vec4(c * rim * lit * awStrength, 1.0);
}`;

export function createEarthMaterial(uniforms: Record<string, { value: unknown }>, preset: EarthPreset): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, defines: preset.glint ? { AW_GLINT: '' } : {},
  });
  material.name = 'EarthGlobe';
  return material;
}

function createShell(sunDirection: Vector3, atmosphere: Color): Mesh {
  const material = new ShaderMaterial({
    uniforms: {
      awSunDirection: { value: sunDirection }, awAtmosphere: { value: atmosphere },
      awStrength: { value: EARTH_LOOK.shellStrength }, awShellRadius: { value: EARTH_LOOK.shellRadius },
    },
    vertexShader: SHELL_VERTEX, fragmentShader: SHELL_FRAGMENT,
    side: BackSide, blending: AdditiveBlending, transparent: true, depthWrite: false,
  });
  material.name = 'EarthAtmosphere';
  const mesh = new Mesh(new SphereGeometry(EARTH_LOOK.shellRadius, 96, 48), material);
  mesh.name = 'EarthAtmosphere';
  mesh.renderOrder = -1;
  return mesh;
}

/** A faint, fixed star field far behind the globe (deterministic, one opaque point draw). */
function createStars(): Points {
  const count = 420;
  const positions = new Float32Array(count * 3);
  let s = 7;
  const random = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
  const v = new Vector3();
  for (let i = 0; i < count; i++) {
    v.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize().multiplyScalar(20);
    positions[i * 3] = v.x; positions[i * 3 + 1] = v.y; positions[i * 3 + 2] = v.z;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const material = new PointsMaterial({ color: new Color('#4a5466'), size: 1.3, sizeAttenuation: false });
  material.name = 'EarthStars';
  const points = new Points(geometry, material);
  points.name = 'EarthStars';
  points.renderOrder = -2;
  return points;
}

// ---- Globe ----------------------------------------------------------------------------------------------------

export interface EarthGlobeOptions {
  readonly quality: QualityProfile;
  readonly sunDirection: Vector3;
  readonly signal?: AbortSignal;
  readonly baseUrl?: string;
  /** [night-72a R2] Border file URL (default `data/borders-50m.json`). */
  readonly bordersUrl?: string;
}

/** The NASA globe: terrain mesh (`terrain.ts`, `lod.ts`), photo material, optional shell and stars. */
export async function createEarthGlobe(scene: Scene, mask: LandMask, opts: EarthGlobeOptions): Promise<GlobeInstance> {
  const base = opts.baseUrl ?? `${import.meta.env.BASE_URL}data/globe/`;
  const preset = earthPreset(opts.quality);
  const [elevation, day, night, borderSegments] = await Promise.all([
    loadElevationBytes(base + 'elevation-2048.png', opts.signal),
    loadBitmap(base + EARTH_TEXTURES.day[preset.startDay], opts.signal),
    loadBitmap(base + EARTH_TEXTURES.night[preset.startNight], opts.signal),
    // [night-72a R2] D-327: country borders (data/, beside the land mask); a missing file only leaves them out.
    loadBorders(opts.bordersUrl ?? `${import.meta.env.BASE_URL}data/${BORDERS_FILE}`, opts.signal),
  ]);
  if (opts.signal?.aborted) {
    day.bitmap.close(); night.bitmap.close();
    throw new DOMException('Aborted', 'AbortError');
  }
  const style: TerrainStyle = { id: 'textured', elevation: elevationSampler(elevation.bytes, elevation.width, elevation.height) };
  const relief = new DataTexture(buildReliefGradient(elevation.bytes, elevation.width, elevation.height),
    elevation.width, elevation.height, RGFormat, UnsignedByteType);
  relief.wrapS = RepeatWrapping;
  relief.wrapT = ClampToEdgeWrapping;
  relief.minFilter = LinearMipmapLinearFilter;
  relief.magFilter = LinearFilter;
  relief.generateMipmaps = true;
  relief.colorSpace = NoColorSpace;
  relief.unpackAlignment = 2;
  relief.needsUpdate = true;
  // The shader works on stored sRGB values, so the colour goes in unconverted.
  const atmosphere = new Color().setRGB(...hexRgb(EARTH_LOOK.atmosphere), NoColorSpace);
  const uniforms = {
    awDay: { value: photoTexture(day.bitmap) }, awNight: { value: photoTexture(night.bitmap) }, awReliefMap: { value: relief },
    awSunDirection: { value: opts.sunDirection }, awAtmosphere: { value: atmosphere },
    awNightGain: { value: EARTH_LOOK.nightGain }, awMoon: { value: EARTH_LOOK.moon }, awMoonLand: { value: EARTH_LOOK.moonLand },
    awMoonLandFloor: { value: EARTH_LOOK.moonLandFloor }, awGrade: { value: EARTH_LOOK.grade },
    awHaze: { value: EARTH_LOOK.haze }, awReliefGain: { value: EARTH_LOOK.relief as number },
  } as Record<string, { value: unknown }>;
  const material = createEarthMaterial(uniforms, preset);
  const lod = createTerrainLod(TERRAIN_LOD_LEVELS[opts.quality.preset]
    .map((level) => chunkTerrain(buildTerrainArrays(mask, level, style), level)), material);
  const group = new Group();
  group.name = 'AirwayEarthGlobe';
  const shell = preset.shell ? createShell(opts.sunDirection, atmosphere) : null;
  const stars = preset.stars ? createStars() : null;
  if (stars) group.add(stars);
  group.add(lod.group);
  if (shell) group.add(shell);
  // [night-72a R2] D-327: one draw (a plain quad batch) of screen-width border lines, lifted onto the same relief as the mesh.
  const surface = createSample();
  const borders = borderSegments
    ? createBorderLayer(borderSegments, opts.sunDirection, (lon, lat) => sampleAt(lon, lat, mask, surface, style).height)
    : null;
  if (borders) group.add(borders.mesh);
  let bitmaps: ImageBitmap[] = [day.bitmap, night.bitmap];
  group.userData['lookBytes'] = elevation.size + day.bytes + night.bytes;
  group.userData['earthTextures'] = `${preset.startDay}/${preset.startNight}`;
  scene.add(group);
  // Space behind the globe: the renderer starts on EARTH_LOOK.space (world.ts), so the background is never swapped here.

  let disposed = false;
  let upgrade: 'pending' | 'loading' | 'done' = preset.day !== preset.startDay || preset.night !== preset.startNight ? 'pending' : 'done';
  const upgradeAbort = new AbortController();
  /** After the first frame: decode the finer textures off the render thread, then swap them in. */
  const startUpgrade = (): void => {
    upgrade = 'loading';
    Promise.all([
      loadBitmap(base + EARTH_TEXTURES.day[preset.day], upgradeAbort.signal),
      loadBitmap(base + EARTH_TEXTURES.night[preset.night], upgradeAbort.signal),
    ]).then(([nextDay, nextNight]) => {
      if (disposed) { nextDay.bitmap.close(); nextNight.bitmap.close(); return; }
      const oldDay = uniforms['awDay'].value as Texture, oldNight = uniforms['awNight'].value as Texture;
      uniforms['awDay'].value = photoTexture(nextDay.bitmap);
      uniforms['awNight'].value = photoTexture(nextNight.bitmap);
      oldDay.dispose(); oldNight.dispose();
      for (const bitmap of bitmaps) bitmap.close();
      bitmaps = [nextDay.bitmap, nextNight.bitmap];
      group.userData['lookBytes'] = elevation.size + nextDay.bytes + nextNight.bytes;
      group.userData['earthTextures'] = `${preset.day}/${preset.night}`;
      upgrade = 'done';
    }).catch(() => { upgrade = 'done'; /* keep the start textures (offline, aborted) */ });
  };

  return {
    group, quality: opts.quality, lod,
    decor: { drawn: 0, total: 0, repacks: 0 },
    surfaceLook: 'earth',
    borders: borders?.mesh ?? null,
    update(camera, pixelsPerDegree) {
      lod.update(camera, pixelsPerDegree);
      if (upgrade === 'pending') setTimeout(() => { if (!disposed && upgrade === 'pending') startUpgrade(); }, 0);
    },
    setDecorDensity() { /* no decorations */ },
    dispose() {
      if (disposed) return;
      disposed = true;
      upgradeAbort.abort();
      scene.remove(group);
      lod.dispose();
      (uniforms['awDay'].value as Texture).dispose();
      (uniforms['awNight'].value as Texture).dispose();
      relief.dispose();
      for (const bitmap of bitmaps) bitmap.close();
      material.dispose();
      if (shell) { shell.geometry.dispose(); (shell.material as ShaderMaterial).dispose(); }
      borders?.dispose();
      if (stars) { stars.geometry.dispose(); (stars.material as PointsMaterial).dispose(); }
      group.clear();
    },
  };
}

function hexRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
}
