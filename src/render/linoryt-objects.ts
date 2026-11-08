// [ext-04 E2] D-283 "Linoryt" world objects (docs/notes/linoryt-render-spec.md §5–§8): airport stamps and the jam
// zone (screen-constant SDF quads, one instanced draw each), routes as a double line (ink + paper core, one ribbon
// draw), the finger-drawn route as dashed ink, planes as cut silhouettes from one SDF atlas (one instanced draw).
// DEV-only until E3: `createWorldRenderer` picks these layers for `look: 'linoryt'` behind `import.meta.env.DEV`, so a
// release build drops this module. No allocation in the frame path; nothing here reads the simulation.
import {
  BufferAttribute, BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, DoubleSide, DynamicDrawUsage, Group,
  InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, LinearMipmapLinearFilter, Mesh, NoColorSpace,
  PlaneGeometry, RedFormat, Scene, ShaderMaterial, UnsignedByteType, Vector3, type Camera, type PerspectiveCamera,
  type WebGLRenderer,
} from 'three';
import { setLatLonVec3 } from './globe/geo-math';
import { LINORYT_INKS, objectScale, STAMP_SIZE_PX } from './globe/linoryt';
import type { AirportDefinition, AirportsLayer } from './airports';
import { interpolatePlaneDistance, planeProgressDistance, type PlaneRenderSnapshot, type PlaneRenderStats } from './planes';
import type { RoutePreviewLayer, RoutePreviewView } from './routePreview';
import {
  makeGreatCircleArc, prepareRoute, sampleGreatCircleArc, sampleRouteDistance, type AircraftKind,
  type MutableGreatCircleArc, type PreparedRoute, type RouteGeometryStats, type RouteRenderSpec,
} from './routes';

/** Stamps sit on the pads (same altitude as the medallions); `pick()` and `project()` use 1.01. */
const STAMP_ALTITUDE = 1.0055;
/** §5 Jam zone radius = 3 × half the stamp; the countdown arc runs 6 px outside its 3 px ring. */
export const JAM_ZONE_FACTOR = 3;
/** §6 Route widths in CSS px: [outer ink, paper core]. */
export const ROUTE_WIDTH_PX: Readonly<Record<AircraftKind, readonly [number, number]>> = {
  turboprop: [5, 2], widebody: [6.5, 2.5],
};
/**
 * §7 Plane silhouettes, CSS px; load bar length at a full plane. D-304: 28 / 32 px (spec 22 / 26) with a 2.5 px paper rim
 * (spec 1.5): at zoom 2 the smaller cut read as a cross between the route lines on the night hatch.
 */
export const PLANE_SIZE_PX: Readonly<Record<AircraftKind, number>> = { turboprop: 28, widebody: 32 };
export const PLANE_RIM_PX = 2.5;
export const PLANE_LOAD_BAR_PX = 18;
/** §6 A new route draws itself from start to end in this many ms (instant with reduce motion). */
export const ROUTE_REVEAL_MS = 200;
/** §7 Silhouettes from `docs/styles/kierunki-2026-11b/src/icons.js` (the dock symbols of the Linoryt skin). */
export const PLANE_PATHS: Readonly<Record<AircraftKind, string>> = {
  turboprop: 'M46 8 L54 8 L56 40 L92 44 L92 54 L56 56 L55 80 L68 86 L68 92 L32 92 L32 86 L45 80 L44 56 L8 54 L8 44 L44 40 Z ' +
    'M20 34 L30 34 L30 46 L20 46 Z M70 34 L80 34 L80 46 L70 46 Z',
  widebody: 'M47 6 L53 6 L56 36 L94 62 L94 70 L56 56 L55 80 L70 90 L70 95 L50 90 L30 95 L30 90 L45 80 L44 56 L6 70 L6 62 ' +
    'L44 36 Z M16 58 L22 55 L24 64 L18 66 Z M30 49 L36 46 L38 55 L32 57 Z M64 46 L70 49 L68 57 L62 55 Z M78 55 L84 58 L82 66 L76 64 Z',
};

// D-88: the one reduce-motion source is src/ui/motion.ts; it mirrors the choice on <html data-airway-motion>.
const reduceMotion = (): boolean => typeof document !== 'undefined' &&
  document.documentElement.dataset['airwayMotion'] === 'reduce';

// ---- Shared uniforms and GLSL -----------------------------------------------------------------------------------

interface SharedUniforms {
  [name: string]: { value: unknown };
  uViewport: { value: { x: number; y: number } };
  uDpr: { value: number };
  uTime: { value: number };
  uPxPerRad: { value: number };
  uScale: { value: number };
  uPaper: { value: Color };
  uInk: { value: Color };
  uRed: { value: Color };
}

const COMMON = /* glsl */ `
uniform vec2 uViewport;
uniform float uDpr;
uniform float uScale; // D-309: object scale from the disc radius (1 on the game globe)
vec4 awOffset(vec4 clip, vec2 px) { clip.xy += px * 2.0 / uViewport * clip.w; return clip; }
bool awFacing(vec3 p) { return dot(cameraPosition - p, p) > 0.0; }
// The segment camera → p passes through the globe (radius 1): p is behind the horizon.
bool awHidden(vec3 p) {
  vec3 d = p - cameraPosition;
  float t = clamp(-dot(cameraPosition, d) / max(dot(d, d), 1e-9), 0.0, 1.0);
  vec3 nearest = cameraPosition + d * t;
  return dot(nearest, nearest) < 1.0 && t < 0.999;
}
vec2 awRot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
`;

function sharedUniforms(): SharedUniforms {
  return {
    uViewport: { value: { x: 412, y: 915 } }, uDpr: { value: 1 }, uTime: { value: 0 }, uPxPerRad: { value: 200 }, uScale: { value: 1 },
    uPaper: { value: new Color(LINORYT_INKS.paper) }, uInk: { value: new Color(LINORYT_INKS.ink) },
    uRed: { value: new Color(LINORYT_INKS.red) },
  };
}

/** Feed the shared uniforms from the renderer that draws `mesh` (viewport, DPR, time, px per radian at the centre). */
function feed(mesh: Mesh, uniforms: SharedUniforms): void {
  mesh.onBeforeRender = (renderer: WebGLRenderer, _scene, camera: Camera) => {
    const dpr = renderer.getPixelRatio();
    const canvas = renderer.domElement;
    const viewport = uniforms.uViewport.value;
    viewport.x = canvas.width / dpr;
    viewport.y = canvas.height / dpr;
    uniforms.uDpr.value = dpr;
    uniforms.uTime.value = performance.now() / 1000;
    const fov = (camera as PerspectiveCamera).fov;
    const distance = camera.position.length();
    if (fov && distance > 1) {
      uniforms.uPxPerRad.value = viewport.y / (2 * Math.tan(fov * Math.PI / 360)) / Math.sqrt(distance * distance - 1);
      uniforms.uScale.value = objectScale(uniforms.uPxPerRad.value);
    }
  };
}

function screenMaterial(uniforms: SharedUniforms, vertexShader: string, fragmentShader: string, name: string): ShaderMaterial {
  const material = new ShaderMaterial({
    // A shallow copy: the uniform objects are shared, per-material extras (uDash, uAtlas) stay per material.
    uniforms: { ...uniforms }, vertexShader: COMMON + vertexShader, fragmentShader: COMMON + fragmentShader,
    transparent: true, depthTest: false, depthWrite: false, side: DoubleSide, // ribbons wind either way on screen
  });
  material.name = name;
  return material;
}

// ---- Stamps and jam zone ----------------------------------------------------------------------------------------

// A function, not a constant: interpolated values would keep this module in a release build.
const STAMP_VERTEX = (): string => /* glsl */ `
attribute vec3 aCenter;
attribute vec4 aShape; // x: hub, y: closed by curfew, z: jam
varying vec2 vPx;
varying vec4 vShape;
void main() {
  float halfSide = aShape.x > 0.5 ? ${(STAMP_SIZE_PX.hub / 2).toFixed(1)} : ${(STAMP_SIZE_PX.airport / 2).toFixed(1)};
  vPx = position.xy * (halfSide + 5.0) * 2.0;
  vShape = aShape;
  if (!awFacing(aCenter)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = awOffset(projectionMatrix * viewMatrix * vec4(aCenter, 1.0), vPx * uScale);
}`;

// A function, not a constant: interpolated values would keep this module in a release build.
const STAMP_FRAGMENT = (): string => /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uRed;
varying vec2 vPx;
varying vec4 vShape;
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
// Regular octagon with apothem r (flat side up), Inigo Quilez.
float sdOctagon(vec2 p, float r) {
  const vec3 k = vec3(-0.9238795325, 0.3826834323, 0.4142135623);
  p = abs(p);
  p -= 2.0 * min(dot(vec2(k.x, k.y), p), 0.0) * vec2(k.x, k.y);
  p -= 2.0 * min(dot(vec2(-k.x, k.y), p), 0.0) * vec2(-k.x, k.y);
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}
void main() {
  float aa = max(fwidth(vPx.x), 1e-4);
  float outer, cuts;
  if (vShape.x > 0.5) {
    // Hub: an octagon around a circle of r = 15 with three cut runways (0°, 60°, 120°), 3.5 px wide.
    outer = sdOctagon(vPx, ${(STAMP_SIZE_PX.hub / 2).toFixed(1)});
    vec2 bar = vec2(1.75, 11.0);
    cuts = min(sdBox(vPx, bar), min(sdBox(awRot(vPx, 1.0471976), bar), sdBox(awRot(vPx, 2.0943951), bar)));
  } else {
    // Airport: a 22 px square with one cut runway at 45°, 4 px wide, 70 % of the diagonal.
    outer = sdBox(vPx, vec2(${(STAMP_SIZE_PX.airport / 2).toFixed(1)}));
    cuts = sdBox(awRot(vPx, 0.7853982), vec2(2.0, ${(STAMP_SIZE_PX.airport * Math.SQRT2 * 0.35).toFixed(2)}));
  }
  // Closed by curfew: the same shape as a 2.5 px outline (it does not fly); otherwise the block with its cuts.
  float body = vShape.y > 0.5 ? abs(outer + 1.25) - 1.25 : max(outer, -cuts);
  float ink = clamp(0.5 - body / aa, 0.0, 1.0);
  float paper = clamp(0.5 - (outer - 2.0) / aa, 0.0, 1.0); // 2 px paper outline (and the cuts)
  vec3 inkColour = vShape.z > 0.5 ? uRed : uInk;
  gl_FragColor = vec4(mix(uPaper, inkColour, ink), max(paper, ink));
  #include <colorspace_fragment>
}`;

// A function, not a constant: interpolated values would keep this module in a release build.
const JAM_VERTEX = (): string => /* glsl */ `
attribute vec3 aCenter;
attribute vec2 aJam; // x: zone radius px, y: share of the grace period left
varying vec2 vPx;
varying vec2 vJam;
void main() {
  vPx = position.xy * (aJam.x + 12.0) * 2.0;
  vJam = aJam;
  if (!awFacing(aCenter)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = awOffset(projectionMatrix * viewMatrix * vec4(aCenter, 1.0), vPx * uScale);
}`;

// A function, not a constant: interpolated values would keep this module in a release build.
const JAM_FRAGMENT = (): string => /* glsl */ `
uniform vec3 uRed;
uniform vec3 uPaper;
varying vec2 vPx;
varying vec2 vJam;
void main() {
  float aa = max(fwidth(vPx.x), 1e-4);
  float r = length(vPx), R = vJam.x;
  float inside = clamp((R - r) / aa + 0.5, 0.0, 1.0);
  // Red hatch at 45°: period 6 px, lines 2 px.
  float u = (vPx.x + vPx.y) * 0.70710678 / 6.0;
  float hatch = clamp((1.0 - abs(fract(u + 0.5) - 0.5) * 6.0) / aa + 0.5, 0.0, 1.0) * inside;
  float ring = clamp((1.5 - abs(r - R)) / aa + 0.5, 0.0, 1.0);
  // Countdown: from 12 o'clock clockwise, the share of the grace period left.
  float angle = atan(vPx.x, vPx.y);
  if (angle < 0.0) angle += 6.2831853;
  float band = clamp((3.0 - abs(r - R - 6.0)) / aa + 0.5, 0.0, 1.0);
  float arcOn = clamp((vJam.y * 6.2831853 - angle) * r / aa + 0.5, 0.0, 1.0);
  float arc = band * arcOn;
  // D-303: the ring and the arc sit on a 1.5 px paper rim (like the stamps), so they read on blue sea and night hatch.
  float rim = max(clamp((3.0 - abs(r - R)) / aa + 0.5, 0.0, 1.0),
    clamp((4.5 - abs(r - R - 6.0)) / aa + 0.5, 0.0, 1.0) * arcOn);
  float red = max(hatch, max(ring, arc));
  float alpha = max(red, rim);
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(mix(uPaper, uRed, red), alpha);
  #include <colorspace_fragment>
}`;

interface StampRecord {
  id: string;
  lon: number;
  lat: number;
  hub: boolean;
  curfew: boolean;
  jam: number | null;
  center: Vector3;
}

/** Airport stamps (§5): the `AirportsLayer` contract plus the jam zone and screen boxes for the overlay (§8). */
export interface StampLayer extends AirportsLayer {
  /** Share of the jam grace period left (0..1), or null when the airport is not jammed. */
  setJam(id: string, share: number | null): void;
  /** Half the stamp's side in CSS px as drawn now (× the disc-radius scale, D-309), or 0 for an unknown airport. */
  halfSize(id: string): number;
  readonly stats: { readonly stamps: number; readonly jams: number };
  /** The stamp and jam-zone meshes, measured separately by the D-177 contrast probe (D-303). */
  readonly stampMesh: Mesh;
  readonly jamMesh: Mesh;
}

function instancedQuad(maxInstances: number, attributes: Record<string, number>): {
  geometry: InstancedBufferGeometry; arrays: Record<string, Float32Array>; attrs: Record<string, InstancedBufferAttribute>;
} {
  const base = new PlaneGeometry(1, 1);
  const geometry = new InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.setAttribute('position', base.getAttribute('position'));
  const arrays: Record<string, Float32Array> = {};
  const attrs: Record<string, InstancedBufferAttribute> = {};
  for (const [name, size] of Object.entries(attributes)) {
    arrays[name] = new Float32Array(maxInstances * size);
    attrs[name] = new InstancedBufferAttribute(arrays[name], size);
    attrs[name].setUsage(DynamicDrawUsage);
    geometry.setAttribute(name, attrs[name]);
  }
  geometry.instanceCount = 0;
  return { geometry, arrays, attrs };
}

export function createStampLayer(scene: Scene, uniforms: SharedUniforms, maxAirports = 64): StampLayer {
  const group = new Group();
  group.name = 'linoryt-airports';
  scene.add(group);
  const stamps = instancedQuad(maxAirports, { aCenter: 3, aShape: 4 });
  const jams = instancedQuad(maxAirports, { aCenter: 3, aJam: 2 });
  const jamMesh = new Mesh(jams.geometry, screenMaterial(uniforms, JAM_VERTEX(), JAM_FRAGMENT(), 'LinorytJam'));
  const stampMesh = new Mesh(stamps.geometry, screenMaterial(uniforms, STAMP_VERTEX(), STAMP_FRAGMENT(), 'LinorytStamps'));
  jamMesh.renderOrder = 20;
  stampMesh.renderOrder = 21;
  for (const mesh of [jamMesh, stampMesh]) { mesh.frustumCulled = false; group.add(mesh); }
  feed(stampMesh, uniforms);
  const records = new Map<string, StampRecord>();
  let dirty = false;
  let disposed = false;
  let jamCount = 0;
  const rebuild = (): void => {
    let i = 0, j = 0;
    for (const record of records.values()) {
      const c = record.center;
      stamps.arrays.aCenter.set([c.x, c.y, c.z], i * 3);
      stamps.arrays.aShape.set([record.hub ? 1 : 0, record.curfew ? 1 : 0, record.jam !== null ? 1 : 0, 0], i * 4);
      i++;
      if (record.jam !== null) {
        jams.arrays.aCenter.set([c.x, c.y, c.z], j * 3);
        const half = (record.hub ? STAMP_SIZE_PX.hub : STAMP_SIZE_PX.airport) / 2;
        jams.arrays.aJam.set([half * JAM_ZONE_FACTOR, record.jam], j * 2);
        j++;
      }
    }
    stamps.geometry.instanceCount = i;
    jams.geometry.instanceCount = j;
    jamCount = j;
    jamMesh.visible = j > 0;
    for (const attr of [...Object.values(stamps.attrs), ...Object.values(jams.attrs)]) attr.needsUpdate = true;
  };
  const get = (id: string): StampRecord => {
    const record = records.get(id);
    if (!record) throw new RangeError('Unknown airport: ' + id);
    return record;
  };
  return {
    group,
    addAirport(def: AirportDefinition): void {
      if (disposed) throw new Error('Airport layer is disposed');
      if (!def.id || records.has(def.id) || !Number.isFinite(def.lon) || !Number.isFinite(def.lat) ||
        Math.abs(def.lat) > 90 || Math.abs(def.lon) > 180) throw new RangeError('Invalid or duplicate airport');
      if (records.size >= maxAirports) throw new RangeError('Airport instance capacity exceeded');
      const center = setLatLonVec3(new Vector3(), def.lon, def.lat, STAMP_ALTITUDE);
      records.set(def.id, { id: def.id, lon: def.lon, lat: def.lat, hub: def.hub === true, curfew: false, jam: null, center });
      dirty = true;
    },
    setHubLoad(id, used, cap): void {
      const record = get(id);
      if (!record.hub) throw new RangeError('Unknown hub: ' + id);
      if (!Number.isInteger(used) || !Number.isInteger(cap) || cap < 1 || used < 0) throw new RangeError('Invalid hub capacity or load');
      // The fill is printed in the note (DOM); the stamp only changes for a jam.
    },
    setCurfew(id, on): void {
      const record = get(id);
      if (record.curfew === on) return;
      record.curfew = on;
      dirty = true;
    },
    setJam(id, share): void {
      const record = records.get(id);
      if (!record) return;
      const next = share === null || !Number.isFinite(share) ? null : Math.max(0, Math.min(1, share));
      if (record.jam === next) return;
      record.jam = next;
      dirty = true;
    },
    setZoom(): void { /* stamps are constant on screen */ },
    getPosition(id, out) {
      const record = records.get(id);
      return record ? out.copy(record.center) : null;
    },
    halfSize(id) {
      const record = records.get(id);
      return record ? (record.hub ? STAMP_SIZE_PX.hub : STAMP_SIZE_PX.airport) / 2 * uniforms.uScale.value : 0;
    },
    has: (id) => records.has(id),
    isHub: (id) => records.get(id)?.hub === true,
    clear(): void { records.clear(); dirty = true; },
    update(): void {
      if (!dirty || disposed) return;
      dirty = false;
      rebuild();
    },
    get stats() { return { stamps: records.size, jams: jamCount }; },
    stampMesh, jamMesh,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      for (const mesh of [jamMesh, stampMesh]) { mesh.geometry.dispose(); (mesh.material as ShaderMaterial).dispose(); }
      records.clear();
    },
  };
}

// ---- Ribbons: routes and the route preview ----------------------------------------------------------------------

// A function, not a constant: interpolated values would keep this module in a release build.
const RIBBON_VERTEX = (): string => /* glsl */ `
attribute vec3 aPrev;
attribute vec3 aNext;
attribute float aSide;
attribute vec2 aWidth; // outer half width, core half width (CSS px); core 0 = no paper core
attribute vec3 aTrack; // x: 0..1 along the route, y: birth time (s), z: arc length (radians) for dashes
varying float vSide;
varying vec2 vWidth;
varying vec3 vTrack;
varying vec3 vWorld;
void main() {
  vec4 c = projectionMatrix * viewMatrix * vec4(position, 1.0);
  vec4 a = projectionMatrix * viewMatrix * vec4(aPrev, 1.0);
  vec4 b = projectionMatrix * viewMatrix * vec4(aNext, 1.0);
  vec2 d = (b.xy / b.w - a.xy / a.w) * uViewport;
  vec2 dir = dot(d, d) > 1e-12 ? normalize(d) : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);
  vSide = aSide;
  vWidth = aWidth;
  vTrack = aTrack;
  vWorld = position;
  gl_Position = awOffset(c, normal * aSide * (aWidth.x + 1.0));
}`;

// A function, not a constant: interpolated values would keep this module in a release build.
const RIBBON_FRAGMENT = (): string => /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uInk;
uniform float uTime;
uniform float uPxPerRad;
uniform float uDash; // 0 = solid double line; 1 = dashed ink (route preview)
varying float vSide;
varying vec2 vWidth;
varying vec3 vTrack;
varying vec3 vWorld;
void main() {
  if (awHidden(vWorld)) discard;
  if (vTrack.x > (uTime - vTrack.y) * ${(1000 / ROUTE_REVEAL_MS).toFixed(1)}) discard;
  float aa = 1.0 / uDpr;
  float px = abs(vSide) * (vWidth.x + 1.0);
  float alpha = clamp((vWidth.x - px) / aa + 0.5, 0.0, 1.0);
  float core = clamp((vWidth.y - px) / aa + 0.5, 0.0, 1.0);
  if (uDash > 0.5) {
    // 5 px ink, 4 px gap along the arc (beyond the plane's range: 2 px dots every 6 px, no red).
    float along = vTrack.z * uPxPerRad;
    float period = vTrack.y > 0.5 ? 8.0 : 9.0;
    float on = vTrack.y > 0.5 ? 2.0 : 5.0;
    float f = mod(along, period);
    alpha *= clamp((on - f) / max(fwidth(along), 1e-4) + 0.5, 0.0, 1.0) * clamp(f / max(fwidth(along), 1e-4) + 0.5, 0.0, 1.0);
    core = 0.0;
  }
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(mix(uInk, uPaper, core), alpha);
  #include <colorspace_fragment>
}`;

interface RibbonBuffers {
  position: Float32Array; prev: Float32Array; next: Float32Array; side: Float32Array; width: Float32Array;
  track: Float32Array; index: Uint32Array;
}

function ribbonBuffers(vertices: number): RibbonBuffers {
  return {
    position: new Float32Array(vertices * 3), prev: new Float32Array(vertices * 3), next: new Float32Array(vertices * 3),
    side: new Float32Array(vertices), width: new Float32Array(vertices * 2), track: new Float32Array(vertices * 3),
    index: new Uint32Array(Math.max(0, vertices / 2 - 1) * 6),
  };
}

function ribbonGeometry(buffers: RibbonBuffers, dynamic: boolean): BufferGeometry {
  const geometry = new BufferGeometry();
  const add = (name: string, array: Float32Array, size: number): void => {
    const attr = new BufferAttribute(array, size);
    if (dynamic) attr.setUsage(DynamicDrawUsage);
    geometry.setAttribute(name, attr);
  };
  add('position', buffers.position, 3);
  add('aPrev', buffers.prev, 3);
  add('aNext', buffers.next, 3);
  add('aSide', buffers.side, 1);
  add('aWidth', buffers.width, 2);
  add('aTrack', buffers.track, 3);
  const index = new BufferAttribute(buffers.index, 1);
  if (dynamic) index.setUsage(DynamicDrawUsage);
  geometry.setIndex(index);
  return geometry;
}

/** Writes one polyline (points flat xyz) as a ribbon at vertex `start`; returns the next free vertex. */
function writeRibbon(out: RibbonBuffers, start: number, indexStart: number, points: Float32Array, count: number,
  outer: number, core: number, born: number, t0: number, t1: number, arc0: number, arcLength: number): number {
  for (let i = 0; i < count; i++) {
    const p = Math.max(0, i - 1), n = Math.min(count - 1, i + 1);
    for (let s = 0; s < 2; s++) {
      const v = start + i * 2 + s;
      out.position.set([points[i * 3], points[i * 3 + 1], points[i * 3 + 2]], v * 3);
      out.prev.set([points[p * 3], points[p * 3 + 1], points[p * 3 + 2]], v * 3);
      out.next.set([points[n * 3], points[n * 3 + 1], points[n * 3 + 2]], v * 3);
      out.side[v] = s ? 1 : -1;
      out.width[v * 2] = outer;
      out.width[v * 2 + 1] = core;
      const f = count > 1 ? i / (count - 1) : 0;
      out.track.set([t0 + (t1 - t0) * f, born, arc0 + arcLength * f], v * 3);
    }
  }
  for (let i = 0; i < count - 1; i++) {
    const a = start + i * 2, k = indexStart + i * 6;
    out.index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k);
  }
  return start + count * 2;
}

/** The parts of `RouteLayer` the world renderer and the plane layer use. */
export interface RouteLayerLike {
  readonly group: Group;
  getRoute(id: string): PreparedRoute | undefined;
  setRoutes(specs: readonly RouteRenderSpec[], revision?: number | string): void;
  readonly stats: RouteGeometryStats;
  dispose(): void;
}

/** §6 Routes as one screen-constant ribbon: ink outer line, paper core (widebody wider), drawn on in 200 ms. */
export class LinorytRouteLayer implements RouteLayerLike {
  readonly group = new Group();
  private readonly routes = new Map<string, PreparedRoute>();
  private readonly born = new Map<string, number>();
  private readonly material: ShaderMaterial;
  private mesh: Mesh | null = null;
  private revision: number | string | undefined;
  private initialized = false;
  private rebuilds = 0;
  private triangles = 0;
  private segments = 0;
  private readonly sample = new Vector3();

  constructor(private readonly uniforms: SharedUniforms) {
    this.group.name = 'linoryt-routes';
    this.material = screenMaterial(uniforms, RIBBON_VERTEX(), RIBBON_FRAGMENT(), 'LinorytRoutes');
    this.material.uniforms['uDash'] = { value: 0 };
  }

  getRoute(id: string): PreparedRoute | undefined { return this.routes.get(id); }

  setRoutes(specs: readonly RouteRenderSpec[], revision?: number | string): void {
    if (this.initialized && revision !== undefined && revision === this.revision) return;
    const now = this.initialized && !reduceMotion() ? performance.now() / 1000 : -1e6;
    const prepared: PreparedRoute[] = [];
    this.routes.clear();
    for (const spec of specs) {
      const route = prepareRoute(spec);
      if (!route || this.routes.has(route.id)) continue;
      this.routes.set(route.id, route);
      prepared.push(route);
    }
    for (const id of [...this.born.keys()]) if (!this.routes.has(id)) this.born.delete(id);
    for (const route of prepared) if (!this.born.has(route.id)) this.born.set(route.id, now);
    let vertices = 0, quads = 0;
    const counts: number[][] = prepared.map((route) => route.arcs.map((arc) => Math.max(12, Math.ceil(arc.angle * 160))));
    for (const legs of counts) for (const n of legs) { vertices += n * 2; quads += n - 1; }
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; }
    this.segments = 0;
    this.triangles = quads * 2;
    if (vertices) {
      const buffers = ribbonBuffers(vertices);
      buffers.index = new Uint32Array(quads * 6);
      let vertex = 0, index = 0;
      prepared.forEach((route, r) => {
        const [outer, core] = ROUTE_WIDTH_PX[route.type];
        const born = this.born.get(route.id) ?? -1e6;
        route.arcs.forEach((arc, leg) => {
          const n = counts[r][leg];
          const points = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) {
            sampleGreatCircleArc(arc, i / (n - 1), this.sample);
            points.set([this.sample.x, this.sample.y, this.sample.z], i * 3);
          }
          const t0 = route.cumulative[leg] / route.length, t1 = route.cumulative[leg + 1] / route.length;
          vertex = writeRibbon(buffers, vertex, index, points, n, outer / 2, core / 2, born, t0, t1,
            route.cumulative[leg], arc.angle);
          index += (n - 1) * 6;
          this.segments++;
        });
      });
      this.mesh = new Mesh(ribbonGeometry(buffers, false), this.material);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = 10;
      feed(this.mesh, this.uniforms);
      this.group.add(this.mesh);
    }
    this.rebuilds++;
    this.revision = revision;
    this.initialized = true;
  }

  get stats(): RouteGeometryStats {
    return { routes: this.routes.size, segments: this.segments, drawCalls: this.mesh ? 1 : 0,
      triangles: this.triangles, rebuilds: this.rebuilds };
  }

  dispose(): void {
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; }
    this.material.dispose();
    this.routes.clear();
    this.born.clear();
  }
}

const PREVIEW_SAMPLES = 64;
const PREVIEW_LEGS = 32;

/** §6 The finger-drawn route: 3 px ink dashed 5/4 px, no core, no red (past the range: 2 px dots). */
export function createLinorytRoutePreview(uniforms: SharedUniforms): RoutePreviewLayer {
  // Two ribbons per leg at most (inside / beyond the range), fixed buffers: nothing is allocated per pointer move.
  const perLeg = (PREVIEW_SAMPLES + 2) * 2;
  const buffers = ribbonBuffers(PREVIEW_LEGS * perLeg * 2);
  buffers.index = new Uint32Array(PREVIEW_LEGS * 2 * (PREVIEW_SAMPLES + 2) * 6);
  const geometry = ribbonGeometry(buffers, true);
  geometry.setDrawRange(0, 0);
  const material = screenMaterial(uniforms, RIBBON_VERTEX(), RIBBON_FRAGMENT(), 'LinorytRoutePreview');
  material.uniforms['uDash'] = { value: 1 };
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 12;
  mesh.visible = false;
  feed(mesh, uniforms);
  const object = new Group();
  object.name = 'airway-route-preview';
  object.add(mesh);
  const arc: MutableGreatCircleArc = { from: new Vector3(), side: new Vector3(), angle: 0, lift: 0, liftFactor: 0 };
  const point = new Vector3();
  const points = new Float32Array((PREVIEW_SAMPLES + 2) * 3);
  const update = (model: RoutePreviewView | null): void => {
    if (!model || model.points.length < 2 || !Number.isFinite(model.rangeKm) || model.rangeKm <= 0) {
      geometry.setDrawRange(0, 0);
      mesh.visible = false;
      return;
    }
    let vertex = 0, index = 0, along = 0;
    const legs = Math.min(PREVIEW_LEGS, model.points.length - 1, model.legDistancesKm.length);
    const ribbon = (from: number, to: number, beyond: boolean): void => {
      if (to - from <= 1e-6) return;
      const n = Math.max(2, Math.round(PREVIEW_SAMPLES * (to - from)) + 1);
      for (let i = 0; i < n; i++) {
        sampleGreatCircleArc(arc, from + (to - from) * i / (n - 1), point);
        points[i * 3] = point.x; points[i * 3 + 1] = point.y; points[i * 3 + 2] = point.z;
      }
      // aTrack.y > 0.5 marks the part beyond the range (dots); the preview never animates in.
      vertex = writeRibbon(buffers, vertex, index, points, n, 1.5, 0, beyond ? 1 : 0, 0, 0,
        along + arc.angle * from, arc.angle * (to - from));
      index += (n - 1) * 6;
    };
    for (let leg = 0; leg < legs; leg++) {
      const km = model.legDistancesKm[leg];
      if (!Number.isFinite(km) || km < 0) continue;
      makeGreatCircleArc(model.points[leg], model.points[leg + 1], model.aircraft, arc);
      const cutoff = km === 0 ? 1 : Math.max(0, Math.min(1, model.rangeKm / km));
      ribbon(0, cutoff, false);
      ribbon(cutoff, 1, true);
      along += arc.angle;
    }
    for (const name of ['position', 'aPrev', 'aNext', 'aSide', 'aWidth', 'aTrack']) geometry.getAttribute(name).needsUpdate = true;
    geometry.index!.needsUpdate = true;
    geometry.setDrawRange(0, index);
    mesh.visible = index > 0;
  };
  return { object, update, dispose: () => { geometry.dispose(); material.dispose(); } };
}

// ---- Planes -----------------------------------------------------------------------------------------------------

const ATLAS_CELL = 128;
const ATLAS_RANGE = 16; // ± texels encoded in the SDF
const ATLAS_SCALE = 0.9 * ATLAS_CELL / 100; // icon units → texels (5 % margin each side)

/** 1D squared EDT (Felzenszwalb & Huttenlocher). */
function edt1d(f: Float64Array, d: Float64Array, n: number, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}

/** Planar Euclidean distance (px) from every pixel to the nearest pixel where `target` is 1. */
function planarDistance(target: Uint8Array, w: number, h: number): Float32Array {
  const big = 1e10, n = Math.max(w, h);
  const grid = new Float64Array(w * h);
  const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = target[y * w + x] ? 0 : big;
    edt1d(f, d, h, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, d, w, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}

/** Signed distance atlas of the two silhouettes (R8, 256×128, + outside), drawn with Path2D. */
export function buildPlaneAtlas(): DataTexture {
  const w = ATLAS_CELL * 2, h = ATLAS_CELL;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas unavailable');
  context.fillStyle = '#fff';
  (['turboprop', 'widebody'] as const).forEach((kind, i) => {
    context.setTransform(ATLAS_SCALE, 0, 0, ATLAS_SCALE, i * ATLAS_CELL + ATLAS_CELL * 0.05, ATLAS_CELL * 0.05);
    context.fill(new Path2D(PLANE_PATHS[kind]), 'nonzero');
  });
  const pixels = context.getImageData(0, 0, w, h).data;
  const inside = new Uint8Array(w * h), outside = new Uint8Array(w * h);
  for (let i = 0; i < inside.length; i++) { inside[i] = pixels[i * 4 + 3] > 127 ? 1 : 0; outside[i] = 1 - inside[i]; }
  const toInside = planarDistance(inside, w, h), toOutside = planarDistance(outside, w, h);
  const data = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) {
    const signed = inside[i] ? -(toOutside[i] - 0.5) : toInside[i] - 0.5;
    data[i] = Math.round(Math.max(0, Math.min(1, 0.5 + signed / (2 * ATLAS_RANGE))) * 255);
  }
  const texture = new DataTexture(data, w, h, RedFormat, UnsignedByteType);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// A function, not a constant: interpolated values would keep this module in a release build.
const PLANE_VERTEX = (): string => /* glsl */ `
attribute vec3 aPos;
attribute vec3 aFwd;
attribute vec2 aMeta; // x: widebody, y: load share
varying vec2 vPx;
varying vec2 vMeta;
varying float vAngle;
void main() {
  vec4 c = projectionMatrix * viewMatrix * vec4(aPos, 1.0);
  vec4 f = projectionMatrix * viewMatrix * vec4(aPos + aFwd * 0.01, 1.0);
  vec2 d = (f.xy / f.w - c.xy / c.w) * uViewport;
  vAngle = atan(d.y, d.x);
  vMeta = aMeta;
  vPx = position.xy * 56.0;
  if (!awFacing(aPos)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = awOffset(c, vPx * uScale);
}`;

// A function, not a constant: interpolated values would keep this module in a release build.
const PLANE_FRAGMENT = (): string => /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uPaper;
uniform vec3 uInk;
varying vec2 vPx;
varying vec2 vMeta;
varying float vAngle;
void main() {
  float aa = max(fwidth(vPx.x), 1e-4);
  float size = vMeta.x > 0.5 ? ${PLANE_SIZE_PX.widebody.toFixed(1)} : ${PLANE_SIZE_PX.turboprop.toFixed(1)};
  // The icon's nose points up (+y on screen); turn it onto the course.
  vec2 q = awRot(vPx, 1.5707963 - vAngle);
  vec2 icon = vec2(q.x / size * 100.0 + 50.0, 50.0 - q.y / size * 100.0);
  vec2 texel = icon * ${ATLAS_SCALE.toFixed(4)} + ${(ATLAS_CELL * 0.05).toFixed(2)};
  float d = 1e3;
  if (all(greaterThanEqual(texel, vec2(0.0))) && all(lessThanEqual(texel, vec2(${ATLAS_CELL.toFixed(1)})))) {
    vec2 uv = vec2((texel.x + (vMeta.x > 0.5 ? ${ATLAS_CELL.toFixed(1)} : 0.0)) / ${(ATLAS_CELL * 2).toFixed(1)},
      texel.y / ${ATLAS_CELL.toFixed(1)});
    d = (texture2D(uAtlas, uv).r - 0.5) * ${(2 * ATLAS_RANGE).toFixed(1)} * size / ${(100 * ATLAS_SCALE).toFixed(3)};
  }
  float ink = clamp(0.5 - d / aa, 0.0, 1.0);
  float paper = clamp(0.5 - (d - ${PLANE_RIM_PX.toFixed(1)}) / aa, 0.0, 1.0); // paper rim (D-304)
  // Load: a 2 px ink bar under the silhouette, load/capacity × ${PLANE_LOAD_BAR_PX} px (screen-aligned).
  float barY = -size * 0.5 - 5.0;
  float len = vMeta.y * ${PLANE_LOAD_BAR_PX.toFixed(1)};
  vec2 b = vPx - vec2(-${(PLANE_LOAD_BAR_PX / 2).toFixed(1)} + len * 0.5, barY);
  vec2 e = abs(b) - vec2(len * 0.5, 1.0);
  float bar = len > 0.0 ? length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) : 1e3;
  ink = max(ink, clamp(0.5 - bar / aa, 0.0, 1.0));
  paper = max(paper, clamp(0.5 - (bar - 1.5) / aa, 0.0, 1.0));
  float alpha = max(paper, ink);
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(mix(uPaper, uInk, ink), alpha);
  #include <colorspace_fragment>
}`;

/** The parts of `PlaneLayer` the world renderer uses. */
export interface PlaneLayerLike {
  readonly group: Group;
  setSnapshots(previous: readonly PlaneRenderSnapshot[], current: readonly PlaneRenderSnapshot[]): void;
  update(alpha: number, camera: PerspectiveCamera): void;
  setDaylight(daylight: number): void;
  readonly stats: PlaneRenderStats;
  dispose(): void;
}

interface SpriteTrack { route: PreparedRoute; type: AircraftKind; from: number; to: number; direction: 1 | -1; load: number }

/** §7 Planes as cut silhouettes: one instanced sprite draw from one SDF atlas, turned along the course, no bobbing. */
export class LinorytPlaneLayer implements PlaneLayerLike {
  readonly group = new Group();
  private readonly mesh: Mesh;
  private readonly quad: ReturnType<typeof instancedQuad>;
  private readonly atlas: DataTexture;
  private readonly material: ShaderMaterial;
  private readonly tracks: SpriteTrack[] = [];
  private readonly pool: SpriteTrack[] = [];
  private readonly prior = new Map<string, PlaneRenderSnapshot>();
  private readonly position = new Vector3();
  private readonly forward = new Vector3();
  private dropped = 0;
  private turboprops = 0;
  private widebodies = 0;

  constructor(private readonly routes: Pick<RouteLayerLike, 'getRoute'>, uniforms: SharedUniforms,
    private readonly options: { maxPlanes?: number; progressScale?: number } = {}) {
    const max = Math.max(1, Math.floor(options.maxPlanes ?? 100));
    this.quad = instancedQuad(max, { aPos: 3, aFwd: 3, aMeta: 2 });
    // Headless (tests, no DOM): a blank 1×1 atlas; the browser always rasterises the silhouettes.
    this.atlas = typeof document !== 'undefined' ? buildPlaneAtlas()
      : new DataTexture(new Uint8Array([255]), 1, 1, RedFormat, UnsignedByteType);
    this.material = screenMaterial(uniforms, PLANE_VERTEX(), PLANE_FRAGMENT(), 'LinorytPlanes');
    this.material.uniforms['uAtlas'] = { value: this.atlas };
    this.mesh = new Mesh(this.quad.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 15;
    feed(this.mesh, uniforms);
    this.group.name = 'linoryt-planes';
    this.group.add(this.mesh);
  }

  setSnapshots(previous: readonly PlaneRenderSnapshot[], current: readonly PlaneRenderSnapshot[]): void {
    const max = this.quad.arrays.aMeta.length / 2;
    const scale = this.options.progressScale ?? 10_000;
    this.prior.clear();
    for (const snapshot of previous) this.prior.set(snapshot.id, snapshot);
    this.tracks.length = 0;
    this.dropped = 0; this.turboprops = 0; this.widebodies = 0;
    for (const now of current) {
      const route = this.routes.getRoute(now.routeId);
      const to = route ? planeProgressDistance(route, now, scale) : Number.NaN;
      if (!route || !Number.isFinite(to) || this.tracks.length >= max) { this.dropped++; continue; }
      const type = now.type ?? route.type;
      const before = this.prior.get(now.id);
      let from = to;
      if (before && before.routeId === now.routeId) {
        const prior = planeProgressDistance(route, before, scale);
        if (Number.isFinite(prior)) from = prior;
      }
      const capacity = Math.max(1, now.capacity ?? (type === 'widebody' ? 300 : 48));
      const load = Math.max(0, Math.min(1, (Number.isFinite(now.load) ? now.load : 0) / capacity));
      let track = this.pool[this.tracks.length];
      if (!track) { track = { route, type, from, to, direction: 1, load }; this.pool.push(track); }
      track.route = route; track.type = type; track.from = from; track.to = to;
      track.direction = now.direction === -1 ? -1 : 1; track.load = load;
      const i = this.tracks.length;
      this.quad.arrays.aMeta[i * 2] = type === 'widebody' ? 1 : 0;
      this.quad.arrays.aMeta[i * 2 + 1] = load;
      this.tracks.push(track);
      if (type === 'widebody') this.widebodies++; else this.turboprops++;
    }
    this.quad.geometry.instanceCount = this.tracks.length;
    this.quad.attrs.aMeta.needsUpdate = true;
  }

  update(alpha: number): void {
    const pos = this.quad.arrays.aPos, fwd = this.quad.arrays.aFwd;
    for (let i = 0; i < this.tracks.length; i++) {
      const track = this.tracks[i];
      sampleRouteDistance(track.route, interpolatePlaneDistance(track.from, track.to, alpha), this.position, this.forward);
      if (track.direction === -1) this.forward.negate();
      pos[i * 3] = this.position.x; pos[i * 3 + 1] = this.position.y; pos[i * 3 + 2] = this.position.z;
      fwd[i * 3] = this.forward.x; fwd[i * 3 + 1] = this.forward.y; fwd[i * 3 + 2] = this.forward.z;
    }
    if (this.tracks.length) { this.quad.attrs.aPos.needsUpdate = true; this.quad.attrs.aFwd.needsUpdate = true; }
  }

  setDaylight(): void { /* print: no shadows */ }

  get stats(): PlaneRenderStats {
    return { planes: this.tracks.length, turboprops: this.turboprops, widebodies: this.widebodies,
      mainPassCalls: this.tracks.length ? 1 : 0, triangles: this.tracks.length * 2, droppedPlanes: this.dropped };
  }

  dispose(): void {
    this.quad.geometry.dispose();
    this.material.dispose();
    this.atlas.dispose();
    this.group.clear();
    this.tracks.length = 0;
    this.prior.clear();
  }
}

// ---- Composition ------------------------------------------------------------------------------------------------

export interface LinorytObjects {
  readonly airports: StampLayer;
  readonly routes: LinorytRouteLayer;
  readonly planes: LinorytPlaneLayer;
  readonly preview: RoutePreviewLayer;
}

export function createLinorytObjects(scene: Scene, opts: { maxAirports?: number; maxPlanes?: number; progressScale?: number }): LinorytObjects {
  const uniforms = sharedUniforms();
  const airports = createStampLayer(scene, uniforms, opts.maxAirports ?? 64);
  const routes = new LinorytRouteLayer(uniforms);
  const planes = new LinorytPlaneLayer(routes, uniforms, { maxPlanes: opts.maxPlanes, progressScale: opts.progressScale });
  const preview = createLinorytRoutePreview(uniforms);
  return { airports, routes, planes, preview };
}
