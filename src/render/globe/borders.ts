// [night-72a R2] D-327: country borders on the NASA globe (the NASA globe; PLAN-NOWY-KIERUNEK.md R2, UI-A spec §5).
// Natural Earth 1:50m land borders (`public/data/borders-50m.json`, built by scripts/build-borders.mjs from world-atlas)
// drawn as thin, translucent lines whose width is set in screen pixels, not degrees, so they neither swell when the
// camera zooms in nor break up into flickering dashes when it zooms out:
//   - one draw: a quad per segment (four vertices that all know both ends; not instanced, see `createBorderLayer`),
//     both ends projected in the vertex shader and pushed apart sideways by a fixed number of device pixels;
//   - anti-aliased by coverage: the quad is 1 px wider than the line on each side and the fragment's alpha is the share
//     of its pixel the line covers; a line thinner than one device pixel is drawn 1 px wide at proportionally lower
//     alpha (the stable way to draw a hairline: no sub-pixel line ever drops out between frames on a cheap GPU);
//   - hidden behind the horizon in the shader (no depth test: the terrain's relief would bite into the line), faded
//     over the last few degrees before the limb, a whole segment past it collapsed so it costs no fill;
//   - the colour follows the terminator per vertex: cool grey and fainter by night (K2), white by day (K1), as in the
//     mockup `makiety/ui-a/src/ui.css` (`.border`, `.day .border`).
// `borderHorizon` and `borderDaylight` mirror the shader for the headless tests.
import {
  BufferAttribute, BufferGeometry, Color, InterleavedBuffer, InterleavedBufferAttribute, Mesh,
  NoColorSpace, NormalBlending, ShaderMaterial, Vector2, type Vector3,
} from 'three';
import { setLatLonVec3 } from './geo-math';

/** File under public/data/ (scripts/build-borders.mjs; `npm run test:borders`). */
export const BORDERS_FILE = 'borders-50m.json';

/** The committed border data: lines of quantised lon/lat, delta-encoded (first pair absolute). */
export interface BorderData {
  readonly format: 'airway-borders-v1';
  readonly scale: number;
  readonly lines: readonly (readonly number[])[];
}

/**
 * Look of the border lines (sRGB as stored, like the globe shader). Width in CSS px (× the renderer's pixel ratio on
 * the GPU). Night: the mockup's #C9CED6 at 22 %; day: white at 38 %. `dayBand` is the sun-cosine band over which the
 * night colour turns into the day colour (≈ ±6° of sun elevation, inside the globe's own dusk band).
 */
export const BORDER_STYLE = {
  widthPx: 0.8,
  night: '#C9CED6',
  nightAlpha: 0.22,
  day: '#FFFFFF',
  dayAlpha: 0.38,
  dayBand: [-0.1, 0.1],
  /** Horizon fade: cosine margin past the limb (0 = on the horizon) over which a line fades in. */
  horizonFade: [0.0, 0.035],
  /** Lift above the terrain (globe radius = 1): keeps the line on the relief it is drawn over. */
  lift: 0.0006,
  /** Longer segments are split (in lon/lat) so straight borders follow their parallel, not a chord. */
  maxStepDeg: 1,
  renderOrder: 5,
} as const;

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Visibility (0..1) of a surface point `p` seen from the camera at `c` (world units, globe centre at the origin).
 * A point is in front of the horizon when the camera is above its tangent plane: p·c > |p|². The margin is that
 * difference as a cosine; the line fades in over `BORDER_STYLE.horizonFade`. Mirrors the vertex shader.
 */
export function borderHorizon(px: number, py: number, pz: number, cx: number, cy: number, cz: number): number {
  const r2 = px * px + py * py + pz * pz;
  const margin = (px * cx + py * cy + pz * cz - r2) / (Math.sqrt(r2) * Math.hypot(cx, cy, cz));
  return smooth(BORDER_STYLE.horizonFade[0], BORDER_STYLE.horizonFade[1], margin);
}

/** Share of the day colour (0 night … 1 day) for a point whose normal makes `sunCos` with the sun. Mirrors the shader. */
export function borderDaylight(sunCos: number): number {
  return smooth(BORDER_STYLE.dayBand[0], BORDER_STYLE.dayBand[1], sunCos);
}

/**
 * Decodes the border file into segments `[lon0, lat0, lon1, lat1, …]` (degrees). Segments longer than
 * `maxStepDeg` are split along lon/lat, so the 49th parallel stays a parallel on the sphere.
 */
export function decodeBorders(data: BorderData, maxStepDeg: number = BORDER_STYLE.maxStepDeg): Float32Array {
  if (data.format !== 'airway-borders-v1' || !(data.scale > 0)) throw new TypeError('Expected airway-borders-v1 data');
  const out: number[] = [];
  for (const line of data.lines) {
    let qx = 0, qy = 0, lon0 = 0, lat0 = 0;
    for (let i = 0; i + 1 < line.length; i += 2) {
      qx += line[i]; qy += line[i + 1];
      const lon = qx / data.scale, lat = qy / data.scale;
      if (i > 0) {
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lon - lon0), Math.abs(lat - lat0)) / maxStepDeg));
        for (let s = 0; s < steps; s++) {
          out.push(lon0 + (lon - lon0) * s / steps, lat0 + (lat - lat0) * s / steps,
            lon0 + (lon - lon0) * (s + 1) / steps, lat0 + (lat - lat0) * (s + 1) / steps);
        }
      }
      lon0 = lon; lat0 = lat;
    }
  }
  return new Float32Array(out);
}

const VERTEX = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aEnd;
uniform vec2 awViewport;
uniform float awWidth;
uniform vec3 awSunDirection;
uniform vec3 awNightColour;
uniform vec3 awDayColour;
uniform vec2 awAlpha;
uniform vec2 awDayBand;
uniform vec2 awHorizonFade;
varying vec3 vAwColour;
varying float vAwAlpha;
varying float vAwAcross;
varying float vAwHalf;
float awHorizon(vec3 p) {
  float r2 = dot(p, p);
  return smoothstep(awHorizonFade.x, awHorizonFade.y, (dot(p, cameraPosition) - r2) / (sqrt(r2) * length(cameraPosition)));
}
void main() {
  bool atStart = position.x < 0.5;
  vec3 p = atStart ? aStart : aEnd;
  vec4 c0 = projectionMatrix * viewMatrix * vec4(aStart, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(aEnd, 1.0);
  vec2 s0 = c0.xy / c0.w * 0.5 * awViewport;
  vec2 s1 = c1.xy / c1.w * 0.5 * awViewport;
  vec2 d = s1 - s0;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  // Lines under one device pixel are drawn one pixel wide at lower alpha (no sub-pixel dropout, no flicker).
  float core = max(awWidth, 1.0);
  float outer = core * 0.5 + 1.0;
  vec4 clip = atStart ? c0 : c1;
  clip.xy += nrm * position.y * outer / (0.5 * awViewport) * clip.w;
  vAwAcross = position.y * outer;
  vAwHalf = core * 0.5;
  float vis = awHorizon(p);
  float sunCos = dot(normalize(p), awSunDirection);
  float day = smoothstep(awDayBand.x, awDayBand.y, sunCos);
  vAwColour = mix(awNightColour, awDayColour, day);
  vAwAlpha = mix(awAlpha.x, awAlpha.y, day) * vis * min(awWidth, 1.0);
  // A segment wholly past the horizon is collapsed off screen (no fill cost).
  if (awHorizon(aStart) <= 0.0 && awHorizon(aEnd) <= 0.0) clip = vec4(2.0, 2.0, 2.0, 1.0);
  gl_Position = clip;
}`;

const FRAGMENT = /* glsl */ `
varying vec3 vAwColour;
varying float vAwAlpha;
varying float vAwAcross;
varying float vAwHalf;
void main() {
  float coverage = clamp(vAwHalf + 0.5 - abs(vAwAcross), 0.0, 1.0);
  gl_FragColor = vec4(vAwColour, vAwAlpha * coverage);
}`;

export interface BorderLayer {
  readonly mesh: Mesh;
  /** Number of segments (quads of the one draw). */
  readonly segments: number;
  dispose(): void;
}

const srgb = (hex: string): Color => new Color().setRGB(
  (parseInt(hex.slice(1, 3), 16)) / 255, (parseInt(hex.slice(3, 5), 16)) / 255, (parseInt(hex.slice(5, 7), 16)) / 255, NoColorSpace);

/**
 * The border mesh: one `BufferGeometry` (a quad per segment) and one transparent material, drawn after the
 * globe and before the map objects (`renderOrder` 5; the world objects start at 10). `heightAt(lon, lat)` lifts each
 * end onto the terrain (default: the unit sphere).
 */
export function createBorderLayer(
  segments: Float32Array, sunDirection: Vector3, heightAt?: (lon: number, lat: number) => number,
): BorderLayer {
  const count = segments.length >> 2;
  const ends = new Float32Array(count * 6);
  const v = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < count; i++) {
    for (let e = 0; e < 2; e++) {
      const lon = segments[i * 4 + e * 2], lat = segments[i * 4 + e * 2 + 1];
      setLatLonVec3(v, lon, lat, 1 + Math.max(0, heightAt ? heightAt(lon, lat) : 0) + BORDER_STYLE.lift);
      ends[i * 6 + e * 3] = v.x; ends[i * 6 + e * 3 + 1] = v.y; ends[i * 6 + e * 3 + 2] = v.z;
    }
  }
  // A plain (not instanced) mesh: four vertices per segment. Software rasterisers (SwiftShader, some cheap Android
  // drivers) run an instanced draw instance by instance, so 8,000 one-quad instances cost far more than one batch.
  // position: x = 0 at the start end, 1 at the end end; y = −1/+1 the side of the line. aStart/aEnd: both ends.
  const geometry = new BufferGeometry();
  const corners = new Float32Array(count * 12);
  const both = new Float32Array(count * 24);
  const index = new (count * 4 > 65535 ? Uint32Array : Uint16Array)(count * 6);
  const QUAD = [0, -1, 1, -1, 1, 1, 0, 1];
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 4; k++) {
      corners.set([QUAD[k * 2], QUAD[k * 2 + 1], 0], (i * 4 + k) * 3);
      both.set(ends.subarray(i * 6, i * 6 + 6), (i * 4 + k) * 6);
    }
    index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  geometry.setAttribute('position', new BufferAttribute(corners, 3));
  const buffer = new InterleavedBuffer(both, 6);
  geometry.setAttribute('aStart', new InterleavedBufferAttribute(buffer, 3, 0));
  geometry.setAttribute('aEnd', new InterleavedBufferAttribute(buffer, 3, 3));
  geometry.setIndex(new BufferAttribute(index, 1));
  const viewport = new Vector2(1, 1);
  const uniforms = {
    awViewport: { value: viewport },
    awWidth: { value: BORDER_STYLE.widthPx as number },
    awSunDirection: { value: sunDirection },
    awNightColour: { value: srgb(BORDER_STYLE.night) },
    awDayColour: { value: srgb(BORDER_STYLE.day) },
    awAlpha: { value: new Vector2(BORDER_STYLE.nightAlpha, BORDER_STYLE.dayAlpha) },
    awDayBand: { value: new Vector2(BORDER_STYLE.dayBand[0], BORDER_STYLE.dayBand[1]) },
    awHorizonFade: { value: new Vector2(BORDER_STYLE.horizonFade[0], BORDER_STYLE.horizonFade[1]) },
  };
  const material = new ShaderMaterial({
    uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
    transparent: true, depthTest: false, depthWrite: false, blending: NormalBlending,
  });
  material.name = 'EarthBorders';
  const mesh = new Mesh(geometry, material);
  mesh.name = 'EarthBorders';
  mesh.frustumCulled = false;
  mesh.renderOrder = BORDER_STYLE.renderOrder;
  // Width in device pixels: the drawing buffer size and pixel ratio of the renderer drawing this frame (no allocation).
  mesh.onBeforeRender = (renderer) => {
    renderer.getDrawingBufferSize(viewport);
    uniforms.awWidth.value = BORDER_STYLE.widthPx * renderer.getPixelRatio();
  };
  return {
    mesh, segments: count,
    dispose() { geometry.dispose(); material.dispose(); },
  };
}

/** Loads and decodes the border file (null when it is missing or malformed: the globe draws without borders). */
export async function loadBorders(url: string, signal?: AbortSignal): Promise<Float32Array | null> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    return decodeBorders(await response.json() as BorderData);
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}
