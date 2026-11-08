// [ext-04 E1] D-283 "Linoryt" globe material, paper sky and atmosphere lines (docs/notes/linoryt-render-spec.md
// §1–§4, §9). DEV-only until E3 (`?look=linoryt`): loaded with a dynamic import that a release build folds away.
//
// One field texture (RGBA8, 2048×1024, built here on the CPU from data the game already ships, D-298):
//   R  signed distance to the coast, ±3° → 0..255 (+ land), from the Natural Earth land raster (exact EDT)
//   G  Imhof shadow 1 − hillshade (light 315°/45°, 3×3 smoothed) from elevation-2048.png, land only
//   B  city-light dots (the game's cities), cut out of the night hatch
// so the fragment shader makes exactly one texture fetch. Hatching is computed in lat/lon (it does not swim), the
// octave per pixel from the screen derivative (spacing 4–8 px, cross-faded), widths ≥ 1.5 device px with box AA.
import {
  ClampToEdgeWrapping, Color, DataTexture, Group, LinearFilter, LinearMipmapLinearFilter, Mesh, NoColorSpace,
  PlaneGeometry, RepeatWrapping, RGBAFormat, Scene, ShaderMaterial, UnsignedByteType, Vector3, type Camera,
  type WebGLRenderer,
} from 'three';
import { CITIES } from '../../data/cities';
import type { QualityProfile } from '../quality';
import type { LandMask } from './land-mask';
import { chunkTerrain, createTerrainLod, TERRAIN_LOD_LEVELS } from './lod';
import { buildTerrainArrays, type TerrainStyle } from './terrain';
import {
  ATMOSPHERE_LINES, COAST_FIELD_RANGE_DEG, coastWidthCss, HATCH_ALIAS_FLOOR_DEVICE_PX, HATCH_BASE_PERIOD_DEG,
  HATCH_MIN_SPACING_PX, HATCH_MIN_WIDTH_DEVICE_PX, HATCH_RELIEF_MIN_CSS_PX, HATCH_RELIEF_MIN_DEVICE_PX, HATCH_SAVER_MIN_SPACING_PX, HATCH_SEA_MIN_SPACING_PX, LIMB_RING_PX, LINORYT_INKS,
  NIGHT_FULL_SUN_DEG, seaMinSpacingCss, WATER_LINES_PX, waterLineScale,
} from './linoryt';
import type { GlobeInstance } from './index';

const DEG = Math.PI / 180;
const f = (value: number): string => value.toFixed(5);

// ---- CPU field ------------------------------------------------------------------------------------------------

/** 1D squared Euclidean distance transform (Felzenszwalb & Huttenlocher) of `src` into `dst` (length n). */
function edt1d(src: Float64Array, dst: Float64Array, n: number, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    if (src[q] === Infinity) continue;
    if (src[v[k]] === Infinity) { v[k] = q; continue; }
    let s = ((src[q] + q * q) - (src[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((src[q] + q * q) - (src[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const d = q - v[k];
    dst[q] = src[v[k]] === Infinity ? Infinity : d * d + src[v[k]];
  }
}

/**
 * Distance in pixels (north–south pixel units, east–west scaled by cos(lat), wrapping at the antimeridian) from every
 * pixel to the nearest pixel where `target` is 1, up to `maxPx`.
 */
function distanceTo(target: Uint8Array, width: number, height: number, maxPx: number): Float32Array {
  const column = new Float64Array(width * height);
  const n = Math.max(width * 3, height);
  const src = new Float64Array(n), dst = new Float64Array(n), z = new Float64Array(n + 1);
  const v = new Int32Array(n);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) src[y] = target[y * width + x] ? 0 : Infinity;
    edt1d(src, dst, height, v, z);
    for (let y = 0; y < height; y++) column[y * width + x] = dst[y];
  }
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const c = Math.max(0.02, Math.cos((90 - (y + 0.5) * 180 / height) * DEG));
    const pad = Math.min(width, Math.ceil(maxPx / c) + 2);
    const len = width + 2 * pad;
    const c2 = c * c;
    // d(q) = min_p c²(q−p)² + col(p)  ⇔  d/c² = min_p (q−p)² + col(p)/c²
    for (let i = 0; i < len; i++) {
      const x = ((i - pad) % width + width) % width;
      const value = column[y * width + x];
      src[i] = value === Infinity ? Infinity : value / c2;
    }
    edt1d(src, dst, len, v, z);
    for (let x = 0; x < width; x++) out[y * width + x] = Math.sqrt(dst[x + pad] * c2);
  }
  return out;
}

export interface LinorytField {
  readonly data: Uint8Array<ArrayBuffer>;
  readonly width: number;
  readonly height: number;
  readonly buildMs: number;
}

/**
 * Build the RGBA field from the land mask and the 8-bit sqrt-encoded elevation raster (same grid as the mask:
 * 2048×1024 equirectangular, row 0 = north).
 */
export function buildLinorytField(isLand: (lon: number, lat: number) => boolean, elevation: Uint8Array,
  width: number, height: number): LinorytField {
  const started = Date.now();
  const pixelDeg = 360 / width;
  const land = new Uint8Array(width * height), sea = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const lat = 90 - (y + 0.5) * 180 / height;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      land[i] = isLand(-180 + (x + 0.5) * pixelDeg, lat) ? 1 : 0;
      sea[i] = 1 - land[i];
    }
  }
  const maxPx = COAST_FIELD_RANGE_DEG / pixelDeg + 2;
  const toLand = distanceTo(land, width, height, maxPx), toSea = distanceTo(sea, width, height, maxPx);
  // 3×3 box blur of the elevation (sqrt units 0..1) before the hillshade, so slopes do not read as noise.
  const raw = new Float32Array(width * height);
  for (let i = 0; i < raw.length; i++) raw[i] = elevation[i] / 255;
  const smooth = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) { sum += raw[yy * width + (x + dx + width) % width]; count++; }
      }
      smooth[y * width + x] = sum / count;
    }
  }
  // Imhof light from the north-west (azimuth 315°, altitude 45°) in the local east/north/up frame.
  const lx = -0.5, ly = 0.5, lz = Math.SQRT1_2, exaggeration = 31;
  const data = new Uint8Array(width * height * 4);
  const lights = new Uint8Array(width * height);
  const dot = 0.22 / pixelDeg; // city dot radius in pixels (≈ 2 px on screen at the game zoom)
  for (const city of CITIES) {
    const cx = (city.lon + 180) / pixelDeg - 0.5, cy = (90 - city.lat) / pixelDeg - 0.5;
    const k = 1 / Math.max(0.1, Math.cos(city.lat * DEG));
    for (let y = Math.floor(cy - dot - 1); y <= Math.ceil(cy + dot + 1); y++) {
      if (y < 0 || y >= height) continue;
      for (let x = Math.floor(cx - dot * k - 1); x <= Math.ceil(cx + dot * k + 1); x++) {
        const d = Math.hypot((x - cx) / k, y - cy);
        const value = Math.max(0, Math.min(1, dot + 0.5 - d));
        const i = y * width + ((x % width) + width) % width;
        lights[i] = Math.max(lights[i], Math.round(value * 255));
      }
    }
  }
  const shade = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const c = Math.max(0.2, Math.cos((90 - (y + 0.5) * 180 / height) * DEG));
    const up = Math.max(0, y - 1) * width, down = Math.min(height - 1, y + 1) * width;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const signedPx = land[i] ? toSea[i] - 0.5 : -(toLand[i] - 0.5);
      const signedDeg = Math.max(-COAST_FIELD_RANGE_DEG, Math.min(COAST_FIELD_RANGE_DEG, signedPx * pixelDeg));
      data[i * 4] = Math.round(127.5 + signedDeg / COAST_FIELD_RANGE_DEG * 127.5);
      let shadow = 0;
      if (land[i]) {
        const xl = y * width + (x + width - 1) % width, xr = y * width + (x + 1) % width;
        const dzdx = (smooth[xr] - smooth[xl]) * exaggeration / c;
        const dzdy = (smooth[up + x] - smooth[down + x]) * exaggeration;
        const hs = Math.max(0, (-dzdx * lx - dzdy * ly + lz) / Math.hypot(dzdx, dzdy, 1));
        shadow = Math.max(0, Math.min(1, 1 - hs / lz));
      }
      shade[i] = shadow;
      data[i * 4 + 2] = lights[i];
      data[i * 4 + 3] = 255;
    }
  }
  // D-307: the shadow is smoothed once more (5×5, land only) so the hatch prints coherent slopes, not speckle.
  const blurred = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!land[i]) continue;
      let sum = 0, count = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -2; dx <= 2; dx++) { const j = yy * width + (x + dx + width) % width; if (land[j]) { sum += shade[j]; count++; } }
      }
      blurred[i] = count ? sum / count : 0;
    }
  }
  for (let i = 0; i < blurred.length; i++) data[i * 4 + 1] = Math.round(Math.min(1, blurred[i]) * 255);
  return { data, width, height, buildMs: Date.now() - started };
}

/** 8-bit elevation raster → R channel bytes (the PNG is grey). */
async function loadElevationBytes(url: string, signal?: AbortSignal): Promise<{ bytes: Uint8Array; width: number; height: number; size: number }> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Linoryt elevation ' + url + ': HTTP ' + response.status);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas unavailable');
  context.drawImage(bitmap, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  const bytes = new Uint8Array(width * height);
  for (let i = 0; i < bytes.length; i++) bytes[i] = data[i * 4];
  return { bytes, width, height, size: blob.size };
}

/** Bilinear metres sampler for the terrain heights (same encoding as look.ts `loadElevation`). */
function elevationSampler(bytes: Uint8Array, width: number, height: number): (lon: number, lat: number) => number {
  const metres = new Float32Array(width * height);
  for (let i = 0; i < metres.length; i++) { const v = bytes[i] / 255; metres[i] = v * v * 8000; }
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

/** Resample a raster to the mask grid (nearest) when the sizes differ. */
function resample(bytes: Uint8Array, sw: number, sh: number, width: number, height: number): Uint8Array {
  if (sw === width && sh === height) return bytes;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(sh - 1, Math.floor((y + 0.5) * sh / height));
    for (let x = 0; x < width; x++) out[y * width + x] = bytes[sy * sw + Math.min(sw - 1, Math.floor((x + 0.5) * sw / width))];
  }
  return out;
}

// ---- Shaders --------------------------------------------------------------------------------------------------

/** Shared uniforms of the terrain and the sky ring (one object, so a frame never recompiles anything). */
export interface LinorytUniforms {
  [name: string]: { value: unknown };
  awField: { value: DataTexture };
  awSunDirection: { value: Vector3 };
  awDpr: { value: number };
  awWaterScale: { value: number };
  awCoastWidth: { value: number };
  awSeaMin: { value: number };
  awDiscFull: { value: number };
  awPaper: { value: Color };
  awInk: { value: Color };
  awBlue: { value: Color };
  awOchre: { value: Color };
}

const VERTEX = /* glsl */ `
varying vec3 vAwWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vAwWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

/** Shared GLSL: line coverage and the two-octave hatch (mirrors `hatchOctaves` in linoryt.ts). */
function hatchGlsl(minSpacingPx: number): string {
  return /* glsl */ `
uniform float awDpr;
// Box-filtered coverage of lines at integer u; g = |grad u| per device px; hw = half width in device px.
float awLines(float u, float g, float hw) {
  float d = abs(fract(u + 0.5) - 0.5) / max(g, 1e-7);
  return clamp(hw + 0.5 - d, 0.0, 1.0);
}
// u0, g0: the pattern in base periods (${HATCH_BASE_PERIOD_DEG}°). wCss: line width in CSS px. extra: fine-octave cap.
float awHatchMin(float u0, float g0, float wCss, float extra, float minCss) {
  float minPx = minCss * awDpr;
  float s0 = 1.0 / max(g0, 1e-7);
  float halvings = max(0.0, floor(log2(s0 / minPx)));
  float k = exp2(halvings);
  float sf = s0 / k;
  float wf = clamp(log2(sf / minPx), 0.0, 1.0) * extra;
  float hw = 0.5 * max(${f(HATCH_MIN_WIDTH_DEVICE_PX)}, wCss * awDpr);
  float fine = awLines(u0 * k, g0 * k, hw);
  float coarse = awLines(u0 * k * 0.5, g0 * k * 0.5, hw);
  float lines = mix(coarse, fine, wf);
  float mean = min(1.0, 2.0 * hw / (2.0 * sf));
  return mix(mean, lines, smoothstep(${f(HATCH_ALIAS_FLOOR_DEVICE_PX)}, ${f(HATCH_ALIAS_FLOOR_DEVICE_PX * 2)}, 2.0 * sf));
}
float awHatch(float u0, float g0, float wCss, float extra) { return awHatchMin(u0, g0, wCss, extra, ${f(minSpacingPx)}); }
// D-307: an engraver's tone: the line width is a share of its own period (tone 0..1), so the mean ink is the tone at
// every zoom (the coarse octave's lines are as thick as two fine ones), never thinner than the device floor.
float awHatchToneMin(float u0, float g0, float tone, float minPx) {
  float s0 = 1.0 / max(g0, 1e-7);
  float halvings = max(0.0, floor(log2(s0 / minPx)));
  float k = exp2(halvings);
  float sf = s0 / k;
  float wf = clamp(log2(sf / minPx), 0.0, 1.0);
  float floorHalf = ${f(HATCH_MIN_WIDTH_DEVICE_PX / 2)};
  // D-314: a line thinner than the device floor is printed at the floor width but lighter (same mean ink), so faint
  // tones stay faint instead of turning into even full strokes.
  float fineHalf = 0.5 * tone * sf, coarseHalf = tone * sf;
  float fine = awLines(u0 * k, g0 * k, max(floorHalf, fineHalf)) * min(1.0, fineHalf / floorHalf);
  float coarse = awLines(u0 * k * 0.5, g0 * k * 0.5, max(floorHalf, coarseHalf)) * min(1.0, coarseHalf / floorHalf);
  float lines = mix(coarse, fine, wf);
  return mix(tone, lines, smoothstep(${f(HATCH_ALIAS_FLOOR_DEVICE_PX)}, ${f(HATCH_ALIAS_FLOOR_DEVICE_PX * 2)}, 2.0 * sf));
}
// Relief spacing is set on the device grid: ≥ ${HATCH_RELIEF_MIN_DEVICE_PX} device px and ≥ ${HATCH_RELIEF_MIN_CSS_PX} CSS px.
float awHatchTone(float u0, float g0, float tone) {
  return awHatchToneMin(u0, g0, tone, max(${f(HATCH_RELIEF_MIN_DEVICE_PX)}, ${f(HATCH_RELIEF_MIN_CSS_PX)} * awDpr));
}`;
}

function terrainFragment(saver: boolean): string {
  const [w0, w1, w2] = WATER_LINES_PX;
  return /* glsl */ `
uniform sampler2D awField;
uniform vec3 awSunDirection;
uniform float awWaterScale;
uniform float awCoastWidth;
uniform float awDiscFull; // D-314: 0 on a small disc (≤ 160 px radius, the menu) → 1 on the game globe (≥ 320 px)
uniform float awSeaMin; // D-309: open-sea spacing, CSS px (6 on the game globe, the relief's grid on a small disc)
uniform vec3 awPaper;
uniform vec3 awInk;
uniform vec3 awBlue;
uniform vec3 awOchre;
varying vec3 vAwWorld;
${hatchGlsl(saver ? HATCH_SAVER_MIN_SPACING_PX : HATCH_MIN_SPACING_PX)}
const float AW_PI = 3.14159265;
const float AW_TO_BASE = ${f(180 / Math.PI / HATCH_BASE_PERIOD_DEG)}; // radians → base periods

void main() {
  vec3 n = normalize(vAwWorld);
  vec3 ndx = dFdx(n), ndy = dFdy(n);
  float lambda = atan(n.x, n.z);
  float phi = asin(clamp(n.y, -1.0, 1.0));
  float cphi = max(cos(phi), 1e-4);
  float r2 = max(n.x * n.x + n.z * n.z, 1e-8);
  // Seam-free screen derivatives of longitude and latitude (radians per device px).
  vec2 dLambda = vec2(n.z * ndx.x - n.x * ndx.z, n.z * ndy.x - n.x * ndy.z) / r2;
  vec2 dPhi = vec2(ndx.y, ndy.y) / cphi;
  vec2 uv = vec2(lambda / (2.0 * AW_PI) + 0.5, 0.5 - phi / AW_PI);
  vec4 field = textureGrad(awField, uv, vec2(dLambda.x, -dPhi.x * 2.0) / (2.0 * AW_PI),
    vec2(dLambda.y, -dPhi.y * 2.0) / (2.0 * AW_PI));
  float coast = (field.r - 0.5) * ${f(COAST_FIELD_RANGE_DEG * 2)}; // degrees, + land
  vec2 dCoast = vec2(dFdx(coast), dFdy(coast));
  float coastGrad = max(length(dCoast), 1e-6); // degrees per device px
  float sunCos = dot(n, awSunDirection);
  float day = clamp(sunCos, 0.0, 1.0);

  // Rhumb lines at ±45° in the local east/north frame: lambda ∓ Mercator y (no seam: periods divide 360°).
  float mercY = log(tan(AW_PI * 0.25 + clamp(phi, -1.48, 1.48) * 0.5));
  vec2 dMerc = dPhi / cphi;

  vec3 colour;
  float coastPx = coast / coastGrad;
  if (coast > 0.0) {
    colour = awOchre;
    #ifndef AW_SAVER
    // D-307: relief as tone (the engraved share of each period), up to 80 % ink on the steepest shaded slopes.
    // D-314: from a shadow of 0.12 (flat and gently lit land stays clean), up to 80 % ink on the game globe and 50 % on
    // a small disc (the menu, where the tone would close into blotches).
    float relief = smoothstep(0.12, 0.6, field.g) * mix(0.5, 0.8, awDiscFull);
    if (relief > 0.02) {
      float u = (lambda - mercY) * AW_TO_BASE;
      float g = length(dLambda - dMerc) * AW_TO_BASE;
      float lines = awHatchTone(u, g, relief) * smoothstep(0.02, 0.12, relief);
      colour = mix(colour, awInk, lines);
    }
    #endif
  } else {
    colour = awBlue;
    float dist = -coast;
    float scale = awWaterScale;
    float hw = 0.5 * max(${f(HATCH_MIN_WIDTH_DEVICE_PX)}, 1.5 * awDpr);
    float water = max(max(
      clamp(hw + 0.5 - abs(dist - ${f(w0)} * scale) / coastGrad, 0.0, 1.0),
      clamp(hw + 0.5 - abs(dist - ${f(w1)} * scale) / coastGrad, 0.0, 1.0)),
      clamp(hw + 0.5 - abs(dist - ${f(w2)} * scale) / coastGrad, 0.0, 1.0));
    // Water lines closer together than the alias floor are left out (open blue, the coast line carries the shore).
    float spacing = ${f(w1 - w0)} * scale / coastGrad;
    // D-314: water lines need room (≥ 5 device px apart, full from 9): on a small disc they would read as thick waves.
    water *= smoothstep(5.0, 9.0, spacing);
    // Open sea starts past the last water line (and always inside the field, which saturates at ±3°).
    float open = clamp((dist - min(${f(w2 + 3)} * scale, ${f(COAST_FIELD_RANGE_DEG - 0.15)})) / coastGrad + 0.5, 0.0, 1.0);
    float u = phi * AW_TO_BASE;
    float g = length(dPhi) * AW_TO_BASE;
    // D-300: the open-sea parallels print one step sparser (≥ 6 px) so stamps and notes stay on top of the sea.
    float parallels = awHatchToneMin(u, g, mix(0.13, 0.37, day) * mix(0.6, 1.0, awDiscFull), awSeaMin * awDpr);
    colour = mix(colour, awPaper, max(water * (1.0 - open), parallels * open));
  }
  // Printed coast: an ink line centred on the shore, constant on screen.
  colour = mix(colour, awInk, clamp(awCoastWidth * awDpr * 0.5 + 0.5 - abs(coastPx), 0.0, 1.0));

  // Night: an ink cross-hatch at −45° whose coverage grows from the terminator to ${NIGHT_FULL_SUN_DEG}°. Near the
  // terminator only the coarser octave prints; the finer one comes in as the night deepens.
  float night = clamp(-sunCos / ${f(Math.sin(-NIGHT_FULL_SUN_DEG * DEG))}, 0.0, 1.0);
  if (night > 0.0) {
    float u = (lambda + mercY) * AW_TO_BASE;
    float g = length(dLambda + dMerc) * AW_TO_BASE;
    // D-314: night as tone too: from nothing at the terminator to 45 % ink at ${NIGHT_FULL_SUN_DEG}°.
    float lines = awHatchToneMin(u, g, 0.45 * night * night * (3.0 - 2.0 * night), ${f(HATCH_MIN_SPACING_PX)} * awDpr);
    colour = mix(colour, awInk, lines);
    // City lights: paper dots cut out of the night hatch.
    colour = mix(colour, awPaper, smoothstep(0.35, 0.75, field.b) * smoothstep(0.3, 0.6, night));
  }
  // D-315: the inked limb starts half a device px inside the silhouette, so the edge of the terrain polygons meets
  // ink on both sides and needs no multisampling (the sky band carries the ring outward).
  vec3 awRay = normalize(vAwWorld - cameraPosition);
  float awD = length(cross(cameraPosition, awRay));
  float awDg = max(length(vec2(dFdx(awD), dFdy(awD))), 1e-7);
  colour = mix(colour, awInk, clamp((awD - 1.0) / awDg + 1.5, 0.0, 1.0));
  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}`;
}

const SKY_FRAGMENT = /* glsl */ `
uniform float awDpr;
uniform vec3 awPaper;
uniform vec3 awInk;
uniform vec3 awBlue;
varying vec3 vAwWorld;
float awRing(float d, float at, float halfPx, float g) {
  return clamp(halfPx + 0.5 - abs(d - at) / g, 0.0, 1.0);
}
void main() {
  vec3 ray = normalize(vAwWorld - cameraPosition);
  float d = length(cross(cameraPosition, ray)); // closest approach of the view ray to the globe centre
  float g = max(length(vec2(dFdx(d), dFdy(d))), 1e-7); // radius units per device px
  float limbHalf = ${f(LIMB_RING_PX)} * awDpr * 0.5;
  float limbEnd = 1.0 + 2.0 * limbHalf * g;
  if (d < 0.985 || d > 1.0 + ${f(ATMOSPHERE_LINES[2].offset + 0.004)} + 2.0 * g) discard;
  float ink = d < limbEnd ? 1.0 : clamp(1.0 - (d - limbEnd) / g, 0.0, 1.0);
  float blue = max(max(
    awRing(d, 1.0 + ${f(ATMOSPHERE_LINES[0].offset)}, max(0.5, ${f(ATMOSPHERE_LINES[0].widthPx / 2)} * awDpr), g),
    awRing(d, 1.0 + ${f(ATMOSPHERE_LINES[1].offset)}, max(0.5, ${f(ATMOSPHERE_LINES[1].widthPx / 2)} * awDpr), g)),
    awRing(d, 1.0 + ${f(ATMOSPHERE_LINES[2].offset)}, max(0.5, ${f(ATMOSPHERE_LINES[2].widthPx / 2)} * awDpr), g));
  vec3 colour = mix(mix(awPaper, awBlue, blue), awInk, ink);
  gl_FragColor = vec4(colour, 1.0);
  #include <colorspace_fragment>
}`;

export function createLinorytUniforms(field: LinorytField, sunDirection: Vector3): LinorytUniforms {
  const texture = new DataTexture(field.data, field.width, field.height, RGBAFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = NoColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return {
    awField: { value: texture }, awSunDirection: { value: sunDirection }, awDpr: { value: 1 },
    awWaterScale: { value: waterLineScale(6) }, awCoastWidth: { value: 1.5 }, awSeaMin: { value: HATCH_SEA_MIN_SPACING_PX }, awDiscFull: { value: 1 },
    awPaper: { value: new Color(LINORYT_INKS.paper) }, awInk: { value: new Color(LINORYT_INKS.ink) },
    awBlue: { value: new Color(LINORYT_INKS.blue) }, awOchre: { value: new Color(LINORYT_INKS.ochre) },
  };
}

export function createLinorytTerrainMaterial(uniforms: LinorytUniforms, saver: boolean): ShaderMaterial {
  const material = new ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: terrainFragment(saver),
    defines: saver ? { AW_SAVER: '' } : {},
  });
  material.name = 'LinorytTerrain';
  return material;
}

/**
 * Paper sky band around the limb: the inked limb ring and three blue atmosphere lines (§4), on one camera-facing
 * quad through the globe centre, drawn first without depth writes (the terrain overwrites the inner part). It also
 * feeds the per-frame uniforms (device pixel ratio, water-line scale, coast width) from the renderer it is drawn by.
 */
export function createLinorytSky(uniforms: LinorytUniforms): Mesh {
  const material = new ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: SKY_FRAGMENT, depthWrite: false, depthTest: false,
  });
  material.name = 'LinorytSky';
  const mesh = new Mesh(new PlaneGeometry(2.3, 2.3), material);
  mesh.name = 'LinorytSky';
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  const size = { x: 0, y: 0 };
  mesh.onBeforeRender = (renderer: WebGLRenderer, _scene, camera: Camera) => {
    mesh.quaternion.copy(camera.quaternion);
    mesh.updateMatrixWorld();
    const dpr = renderer.getPixelRatio();
    uniforms.awDpr.value = dpr;
    const perspective = camera as Camera & { fov?: number; zoom?: number };
    const element = renderer.domElement;
    size.y = element.height / dpr;
    const distance = camera.position.length();
    if (perspective.fov && distance > 1) {
      const radiusPx = size.y / (2 * Math.tan(perspective.fov * DEG / 2)) / Math.sqrt(distance * distance - 1);
      uniforms.awWaterScale.value = waterLineScale(radiusPx * DEG);
      uniforms.awSeaMin.value = seaMinSpacingCss(radiusPx, dpr);
      uniforms.awDiscFull.value = Math.max(0, Math.min(1, (radiusPx - 160) / 160));
      // Zoom ≥ 3 ⇔ the disc radius past ~3× the fitted one; the CSS radius at zoom 3 on a phone is ~520 px.
      uniforms.awCoastWidth.value = coastWidthCss(radiusPx * DEG >= 9 ? 3 : 1);
    }
  };
  return mesh;
}

// ---- Globe ----------------------------------------------------------------------------------------------------

export interface LinorytGlobeOptions {
  readonly quality: QualityProfile;
  readonly sunDirection: Vector3;
  readonly signal?: AbortSignal;
  readonly elevationUrl?: string;
}

/** The Linoryt globe: textured-relief terrain mesh (same triangles as the satellite look), print material, sky band. */
export async function createLinorytGlobe(scene: Scene, mask: LandMask, opts: LinorytGlobeOptions): Promise<GlobeInstance> {
  const quality = opts.quality.preset;
  const elevation = await loadElevationBytes(opts.elevationUrl ?? `${import.meta.env.BASE_URL}data/globe/elevation-2048.png`,
    opts.signal);
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const style: TerrainStyle = { id: 'textured', elevation: elevationSampler(elevation.bytes, elevation.width, elevation.height) };
  const field = buildLinorytField(mask.isLand, resample(elevation.bytes, elevation.width, elevation.height,
    mask.width, mask.height), mask.width, mask.height);
  const uniforms = createLinorytUniforms(field, opts.sunDirection);
  const material = createLinorytTerrainMaterial(uniforms, opts.quality.batterySaver);
  const lod = createTerrainLod(
    TERRAIN_LOD_LEVELS[quality].map((level) => chunkTerrain(buildTerrainArrays(mask, level, style), level)), material);
  const sky = createLinorytSky(uniforms);
  const group = new Group();
  group.name = 'AirwayLinorytGlobe';
  group.add(sky, lod.group);
  group.userData['lookBytes'] = elevation.size;
  group.userData['fieldMs'] = field.buildMs;
  scene.add(group);
  let disposed = false;
  return {
    group, quality: opts.quality, lod,
    decor: { drawn: 0, total: 0, repacks: 0 },
    surfaceLook: 'linoryt',
    update(camera, pixelsPerDegree) { lod.update(camera, pixelsPerDegree); },
    setDecorDensity() { /* no decorations in print */ },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      lod.dispose();
      uniforms.awField.value.dispose();
      sky.geometry.dispose();
      (sky.material as ShaderMaterial).dispose();
      material.dispose();
      group.clear();
    },
  };
}
