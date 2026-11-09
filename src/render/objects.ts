// [ext-04 E2] D-283 world objects: airport points and the jam zone (screen-constant SDF quads, one instanced draw
// each), routes as one screen ribbon draw, the finger-drawn route as a second ribbon, planes as silhouettes from one
// SDF atlas (one instanced draw). A lazy chunk (D-300).
// [night-74a R3] D-329: the layers take an `ObjectStyle` (shaders, sizes, inks); [night-82a R6] D-337: the old print's
// style is gone, the NASA-globe style of `objects-earth.ts` (same chunk) is the only one. No allocation in the
// frame path; nothing here reads the simulation.
import {
  BufferAttribute, BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, DoubleSide, DynamicDrawUsage, Group,
  InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, LinearMipmapLinearFilter, Mesh, NoColorSpace,
  PlaneGeometry, RedFormat, Scene, ShaderMaterial, UnsignedByteType, Vector3, type Camera, type PerspectiveCamera,
  type WebGLRenderer,
} from 'three';
import { setLatLonVec3 } from './globe/geo-math';
import { objectScale } from './marks';
import { EARTH_OBJECT_INKS, earthObjectStyle } from './objects-earth';
import type { AirportDefinition, AirportsLayer } from './airports';
import { interpolatePlaneDistance, planeProgressDistance, type PlaneRenderSnapshot, type PlaneRenderStats } from './planes';
import type { RoutePreviewLayer, RoutePreviewView } from './routePreview';
import {
  makeGreatCircleArc, prepareRoute, sampleGreatCircleArc, sampleRouteDistance, type AircraftKind,
  type MutableGreatCircleArc, type PreparedRoute, type RouteGeometryStats, type RouteRenderSpec,
} from './routes';

/** Points sit just above the surface; `pick()` and `project()` use 1.01. */
const STAMP_ALTITUDE = 1.0055;
/** A new route draws itself from start to end in this many ms (instant with reduce motion). */
export const ROUTE_REVEAL_MS = 200;
/** Plane silhouettes (the dock symbols, `docs/styles/kierunki-2026-11b/src/icons.js`), drawn into the SDF atlas. */
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
  /** [R3] The sign yellow (the earth style's route preview) and the plane shadow strength (0 = none). */
  uSign: { value: Color };
  uShadow: { value: number };
}

/**
 * [night-74a R3] D-329: the look of the world objects: shaders, point and jam sizes, route widths and inks
 * (`objects-earth.ts`). Buffers, draws and the API live here.
 */
export interface ObjectStyle {
  readonly name: 'earth';
  readonly inks: { readonly paper: string; readonly ink: string; readonly red: string; readonly sign: string };
  readonly stampVertex: () => string;
  readonly stampFragment: () => string;
  readonly jamVertex: () => string;
  readonly jamFragment: () => string;
  readonly ribbonFragment: () => string;
  readonly planeVertex: () => string;
  readonly planeFragment: () => string;
  /** Half the point's size in CSS px (what `projectAirport` reports, × the disc-radius scale). */
  readonly stampHalf: { readonly airport: number; readonly hub: number };
  /** Jam zone radius in CSS px from the point's half size. */
  readonly jamRadius: (half: number) => number;
  /** Route ribbon [outer, core] widths in CSS px per aircraft (a negative core = dashed core). */
  readonly routeWidth: Readonly<Record<AircraftKind, readonly [number, number]>>;
  /** The route preview's [outer, core] widths in CSS px. */
  readonly previewWidth: readonly [number, number];
  /** Plane shadow strength from the daylight at the view centre (0..1); absent = no shadow. */
  readonly shadow?: (daylight: number) => number;
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

function sharedUniforms(style: ObjectStyle): SharedUniforms {
  return {
    uViewport: { value: { x: 412, y: 915 } }, uDpr: { value: 1 }, uTime: { value: 0 }, uPxPerRad: { value: 200 }, uScale: { value: 1 },
    uPaper: { value: new Color(style.inks.paper) }, uInk: { value: new Color(style.inks.ink) },
    uRed: { value: new Color(style.inks.red) }, uSign: { value: new Color(style.inks.sign) }, uShadow: { value: 0 },
  };
}

/** Material name prefix from the style ('Earth…'). */
const materialPrefix = (style: ObjectStyle): string => style.name[0].toUpperCase() + style.name.slice(1);

/** Shared uniforms with defaults for the extras (`uSign`, `uShadow`) when a caller (a test) passes an older set. */
function withExtras(uniforms: SharedUniforms): SharedUniforms {
  if (!uniforms.uSign) uniforms.uSign = { value: new Color(EARTH_OBJECT_INKS.sign) };
  if (!uniforms.uShadow) uniforms.uShadow = { value: 0 };
  return uniforms;
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

interface StampRecord {
  id: string;
  lon: number;
  lat: number;
  hub: boolean;
  curfew: boolean;
  jam: number | null;
  center: Vector3;
}

/** Airport points: the `AirportsLayer` contract plus the jam zone and screen boxes for the overlay. */
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

export function createStampLayer(scene: Scene, uniforms: SharedUniforms, maxAirports = 64,
  style: ObjectStyle = defaultStyle()): StampLayer {
  withExtras(uniforms);
  const group = new Group();
  group.name = style.name + '-airports';
  scene.add(group);
  const stamps = instancedQuad(maxAirports, { aCenter: 3, aShape: 4 });
  const jams = instancedQuad(maxAirports, { aCenter: 3, aJam: 2 });
  const label = materialPrefix(style);
  const jamMesh = new Mesh(jams.geometry, screenMaterial(uniforms, style.jamVertex(), style.jamFragment(), label + 'Jam'));
  const stampMesh = new Mesh(stamps.geometry, screenMaterial(uniforms, style.stampVertex(), style.stampFragment(), label + 'Stamps'));
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
        const half = record.hub ? style.stampHalf.hub : style.stampHalf.airport;
        jams.arrays.aJam.set([style.jamRadius(half), record.jam], j * 2);
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
      return record ? (record.hub ? style.stampHalf.hub : style.stampHalf.airport) * uniforms.uScale.value : 0;
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

/** Routes as one screen-constant ribbon: dark casing, light core (turboprop dashed), drawn on in 200 ms. */
export class RouteRibbonLayer implements RouteLayerLike {
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

  constructor(private readonly uniforms: SharedUniforms, private readonly style: ObjectStyle = defaultStyle()) {
    withExtras(uniforms);
    this.group.name = style.name + '-routes';
    this.material = screenMaterial(uniforms, RIBBON_VERTEX(), style.ribbonFragment(), materialPrefix(style) + 'Routes');
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
        const [outer, core] = this.style.routeWidth[route.type];
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

/** The finger-drawn route: one ribbon, the part past the range marked for the style's dots. */
export function createRoutePreviewRibbon(uniforms: SharedUniforms, style: ObjectStyle = defaultStyle()): RoutePreviewLayer {
  withExtras(uniforms);
  const [previewOuter, previewCore] = style.previewWidth;
  // Two ribbons per leg at most (inside / beyond the range), fixed buffers: nothing is allocated per pointer move.
  const perLeg = (PREVIEW_SAMPLES + 2) * 2;
  const buffers = ribbonBuffers(PREVIEW_LEGS * perLeg * 2);
  buffers.index = new Uint32Array(PREVIEW_LEGS * 2 * (PREVIEW_SAMPLES + 2) * 6);
  const geometry = ribbonGeometry(buffers, true);
  geometry.setDrawRange(0, 0);
  const material = screenMaterial(uniforms, RIBBON_VERTEX(), style.ribbonFragment(), materialPrefix(style) + 'RoutePreview');
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
      vertex = writeRibbon(buffers, vertex, index, points, n, previewOuter / 2, previewCore / 2, beyond ? 1 : 0, 0, 0,
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

/** Planes as silhouettes: one instanced sprite draw from one SDF atlas, turned along the course, no bobbing. */
export class PlaneSpriteLayer implements PlaneLayerLike {
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

  private readonly style: ObjectStyle;

  constructor(private readonly routes: Pick<RouteLayerLike, 'getRoute'>, private readonly uniforms: SharedUniforms,
    private readonly options: { maxPlanes?: number; progressScale?: number; style?: ObjectStyle } = {}) {
    withExtras(uniforms);
    this.style = options.style ?? defaultStyle();
    const max = Math.max(1, Math.floor(options.maxPlanes ?? 100));
    this.quad = instancedQuad(max, { aPos: 3, aFwd: 3, aMeta: 2 });
    // Headless (tests, no DOM): a blank 1×1 atlas; the browser always rasterises the silhouettes.
    this.atlas = typeof document !== 'undefined' ? buildPlaneAtlas()
      : new DataTexture(new Uint8Array([255]), 1, 1, RedFormat, UnsignedByteType);
    this.material = screenMaterial(uniforms, this.style.planeVertex(), this.style.planeFragment(),
      materialPrefix(this.style) + 'Planes');
    this.material.uniforms['uAtlas'] = { value: this.atlas };
    this.mesh = new Mesh(this.quad.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 15;
    feed(this.mesh, uniforms);
    this.group.name = this.style.name + '-planes';
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

  /** The plane shadow fades with the daylight at the view centre (a style without `shadow` casts none). */
  setDaylight(daylight: number): void {
    this.uniforms.uShadow.value = this.style.shadow ? this.style.shadow(Number.isFinite(daylight) ? daylight : 1) : 0;
  }

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

// ---- Styles and composition -------------------------------------------------------------------------------------

/**
 * [night-74a R3] The plane SDF lookup as GLSL (`awPlaneSdf(q, size, wide)` → signed CSS px, + outside) into the atlas
 * of `buildPlaneAtlas`. `q` is the screen offset turned onto the icon (nose up).
 */
export const ATLAS_SDF_GLSL = (): string => /* glsl */ `
float awPlaneSdf(vec2 q, float size, bool wide) {
  vec2 icon = vec2(q.x / size * 100.0 + 50.0, 50.0 - q.y / size * 100.0);
  vec2 texel = icon * ${ATLAS_SCALE.toFixed(4)} + ${(ATLAS_CELL * 0.05).toFixed(2)};
  if (any(lessThan(texel, vec2(0.0))) || any(greaterThan(texel, vec2(${ATLAS_CELL.toFixed(1)})))) return 1e3;
  vec2 uv = vec2((texel.x + (wide ? ${ATLAS_CELL.toFixed(1)} : 0.0)) / ${(ATLAS_CELL * 2).toFixed(1)}, texel.y / ${ATLAS_CELL.toFixed(1)});
  return (texture2D(uAtlas, uv).r - 0.5) * ${(2 * ATLAS_RANGE).toFixed(1)} * size / ${(100 * ATLAS_SCALE).toFixed(3)};
}`;

/** The one object style (built on first use: the shaders take the atlas lookup and the draw-on time from here). */
let earthStyle: ObjectStyle | null = null;
function defaultStyle(): ObjectStyle {
  earthStyle ??= earthObjectStyle({ atlasSdf: ATLAS_SDF_GLSL, revealMs: ROUTE_REVEAL_MS });
  return earthStyle;
}

export interface WorldObjects {
  readonly airports: StampLayer;
  readonly routes: RouteRibbonLayer;
  readonly planes: PlaneSpriteLayer;
  readonly preview: RoutePreviewLayer;
  readonly style: ObjectStyle['name'];
}

export interface WorldObjectsOptions {
  maxAirports?: number;
  maxPlanes?: number;
  progressScale?: number;
}

/** The world's object layers (points, jam zone, routes, planes, route preview) in one style. */
export function createObjects(scene: Scene, opts: WorldObjectsOptions, style: ObjectStyle = defaultStyle()): WorldObjects {
  const uniforms = sharedUniforms(style);
  const airports = createStampLayer(scene, uniforms, opts.maxAirports ?? 64, style);
  const routes = new RouteRibbonLayer(uniforms, style);
  const planes = new PlaneSpriteLayer(routes, uniforms, { maxPlanes: opts.maxPlanes, progressScale: opts.progressScale, style });
  const preview = createRoutePreviewRibbon(uniforms, style);
  return { airports, routes, planes, preview, style: style.name };
}
