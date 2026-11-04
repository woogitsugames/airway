/** Diorama route geometry: the renderer's one great-circle arc model (routes, planes, preview). */
import {
  BackSide, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh,
  MeshStandardMaterial, ShaderMaterial, Vector3,
} from 'three';
import { setLatLonVec3 } from './globe/geo-math';

export type AircraftKind = 'turboprop' | 'widebody';

export interface GeoWaypoint {
  readonly lon: number;
  readonly lat: number;
}

/** One route can contain several connected city-to-city legs. */
export interface RouteRenderSpec {
  readonly id: string;
  readonly type: AircraftKind;
  readonly waypoints: readonly GeoWaypoint[];
}

export interface GreatCircleArc {
  readonly from: Vector3;
  readonly side: Vector3;
  readonly angle: number;
  readonly lift: number;
  readonly liftFactor: number;
}
/** Reusable arc storage for per-pointer-move paths such as the route preview. */
export interface MutableGreatCircleArc {
  from: Vector3;
  side: Vector3;
  angle: number;
  lift: number;
  liftFactor: number;
}

/** Cruise uplift: widebodies fly visibly higher than turboprops (shape, not only colour). */
export const CRUISE_LIFT: Readonly<Record<AircraftKind, number>> = { turboprop: 0.035, widebody: 0.09 };

export interface PreparedRoute {
  readonly id: string;
  readonly type: AircraftKind;
  readonly arcs: readonly GreatCircleArc[];
  readonly cumulative: readonly number[];
  readonly length: number;
}

export interface RouteGeometryStats {
  readonly routes: number;
  readonly segments: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly rebuilds: number;
}

const BASE_RADIUS = 1.008;
const SIDES = 6;
const MIN_ARC = 1e-7;
const LIGHT_TUBE = '#fffaf0';
const GOLD_DASH = '#ffd166';
const HORIZON_VERTEX = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const HORIZON_FRAGMENT = `
  varying vec3 vWorldPosition;
  uniform vec3 tint;
  void main() {
    // The surface hides the actual tube. Show only the occluded section as a ghost.
    vec3 towardCamera = cameraPosition - vWorldPosition;
    float t = clamp(-dot(vWorldPosition, towardCamera) /
      max(dot(towardCamera, towardCamera), 0.000001), 0.0, 1.0);
    vec3 nearest = vWorldPosition + towardCamera * t;
    if (dot(nearest, nearest) >= 1.002 * 1.002) discard;
    gl_FragColor = vec4(tint, 0.19);
  }
`;

export function makeGreatCircleArc(
  a: GeoWaypoint, b: GeoWaypoint, type: AircraftKind,
  out: MutableGreatCircleArc = { from: new Vector3(), side: new Vector3(), angle: 0, lift: 0, liftFactor: 0 },
): GreatCircleArc {
  const from = setLatLonVec3(out.from, a.lon, a.lat);
  const side = setLatLonVec3(out.side, b.lon, b.lat);
  const cosine = Math.max(-1, Math.min(1, from.dot(side)));
  const angle = Math.acos(cosine);
  side.addScaledVector(from, -cosine);
  if (side.lengthSq() < 1e-12) {
    // Antipodes have infinitely many arcs: choose a stable local north/east basis.
    side.set(0, Math.abs(from.y) < 0.9 ? 1 : 0, Math.abs(from.y) < 0.9 ? 0 : 1);
    side.addScaledVector(from, -side.dot(from));
  }
  side.normalize();
  out.angle = angle;
  out.lift = CRUISE_LIFT[type];
  out.liftFactor = Math.min(1, angle / 0.9);
  return out;
}

/** Evaluate position and optional forward tangent without allocating any vectors. */
export function sampleGreatCircleArc(
  arc: GreatCircleArc, progress: number, position: Vector3, tangent?: Vector3,
): Vector3 {
  const t = Math.max(0, Math.min(1, progress));
  const theta = arc.angle * t;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const uplift = arc.lift * arc.liftFactor;
  const radius = BASE_RADIUS + uplift * Math.sin(Math.PI * t);
  position.copy(arc.from).multiplyScalar(c).addScaledVector(arc.side, s).multiplyScalar(radius);
  if (tangent) {
    if (arc.angle < MIN_ARC) {
      tangent.copy(arc.side);
    } else {
      const radialRate = Math.PI * uplift * Math.cos(Math.PI * t);
      const angularRate = radius * arc.angle;
      tangent.copy(arc.from).multiplyScalar(-s * angularRate)
        .addScaledVector(arc.side, c * angularRate)
        .addScaledVector(arc.from, c * radialRate)
        .addScaledVector(arc.side, s * radialRate).normalize();
    }
  }
  return position;
}

export function prepareRoute(spec: RouteRenderSpec): PreparedRoute | null {
  if (!spec.id || spec.waypoints.length < 2) return null;
  const arcs: GreatCircleArc[] = [];
  const cumulative = [0];
  let length = 0;
  for (let i = 1; i < spec.waypoints.length; i++) {
    const a = spec.waypoints[i - 1];
    const b = spec.waypoints[i];
    if (!Number.isFinite(a.lon) || !Number.isFinite(a.lat) || !Number.isFinite(b.lon) || !Number.isFinite(b.lat)) return null;
    if (Math.abs(a.lat) > 90 || Math.abs(b.lat) > 90) return null;
    const arc = makeGreatCircleArc(a, b, spec.type);
    if (arc.angle < MIN_ARC) return null;
    arcs.push(arc);
    length += arc.angle;
    cumulative.push(length);
  }
  return { id: spec.id, type: spec.type, arcs, cumulative, length };
}

/** Absolute distance along the route, accounting for a reversing aircraft. */
export function distanceForSegment(
  route: PreparedRoute, segment: number, progress01: number, direction: 1 | -1,
): number {
  if (segment < 0 || segment >= route.arcs.length) return Number.NaN;
  const progress = Math.max(0, Math.min(1, progress01));
  const start = route.cumulative[segment];
  return start + route.arcs[segment].angle * (direction === 1 ? progress : 1 - progress);
}

/** Sample a multi-leg path with no gap at intermediate city positions. */
export function sampleRouteDistance(
  route: PreparedRoute, distance: number, position: Vector3, tangent?: Vector3,
): Vector3 {
  const d = Math.max(0, Math.min(route.length, distance));
  let segment = route.arcs.length - 1;
  for (let i = 0; i < route.arcs.length - 1; i++) {
    if (d < route.cumulative[i + 1]) { segment = i; break; }
  }
  return sampleGreatCircleArc(
    route.arcs[segment], (d - route.cumulative[segment]) / route.arcs[segment].angle,
    position, tangent,
  );
}

interface TubeData {
  positions: number[];
  normals: number[];
  indices: number[];
}

const curvePoint = new Vector3();
const curveTangent = new Vector3();
const radial = new Vector3();
const sideways = new Vector3();
const second = new Vector3();

function appendTube(
  out: TubeData, arc: GreatCircleArc, start: number, end: number,
  lengthSegments: number, radius: number,
): void {
  const base = out.positions.length / 3;
  for (let i = 0; i <= lengthSegments; i++) {
    sampleGreatCircleArc(arc, start + (end - start) * i / lengthSegments, curvePoint, curveTangent);
    radial.copy(curvePoint).normalize();
    sideways.crossVectors(radial, curveTangent).normalize();
    second.crossVectors(curveTangent, sideways).normalize();
    for (let j = 0; j < SIDES; j++) {
      const phase = j * Math.PI * 2 / SIDES;
      const ca = Math.cos(phase);
      const sa = Math.sin(phase);
      const nx = sideways.x * ca + second.x * sa;
      const ny = sideways.y * ca + second.y * sa;
      const nz = sideways.z * ca + second.z * sa;
      out.normals.push(nx, ny, nz);
      out.positions.push(curvePoint.x + nx * radius, curvePoint.y + ny * radius, curvePoint.z + nz * radius);
    }
  }
  for (let i = 0; i < lengthSegments; i++) {
    for (let j = 0; j < SIDES; j++) {
      const a = base + i * SIDES + j;
      const b = base + i * SIDES + (j + 1) % SIDES;
      const c = a + SIDES;
      const d = b + SIDES;
      out.indices.push(a, b, c, b, d, c);
    }
  }
}

function geometryFor(data: TubeData): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(data.normals, 3));
  geometry.setIndex(data.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/** [ext-03] D-175 experiment: a dark ink outline around the route tubes (inflated back faces). */
const OUTLINE_VERTEX = `
  uniform float inflate;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * inflate, 1.0);
  }
`;
const OUTLINE_FRAGMENT = `
  uniform vec3 ink;
  void main() { gl_FragColor = vec4(ink, 1.0); }
`;

/** Rebuild exclusively when the network changes. Frame updates only move the camera. */
export class RouteLayer {
  readonly group = new Group();
  /** [ext-03] D-175 (DEV `?airportStyle=`): ink outline on, turboprop colour override. */
  private readonly outline: ShaderMaterial | null;
  constructor(style?: { outline: boolean; turboprop?: string }) {
    this.outline = style?.outline ? new ShaderMaterial({
      vertexShader: OUTLINE_VERTEX, fragmentShader: OUTLINE_FRAGMENT, side: BackSide,
      uniforms: { inflate: { value: 0.0019 }, ink: { value: new Vector3(0.09, 0.13, 0.14) } },
    }) : null;
    if (style?.turboprop) {
      this.dashedMaterial.color.set(style.turboprop);
      this.dashedMaterial.emissive.set(style.turboprop);
    }
  }
  private readonly routes = new Map<string, PreparedRoute>();
  // [task-34] Mostly self-lit: routes keep their colour on the night side (D-47).
  private readonly litMaterial = new MeshStandardMaterial({ color: LIGHT_TUBE, emissive: LIGHT_TUBE, emissiveIntensity: 0.72, roughness: 0.5 });
  private readonly dashedMaterial = new MeshStandardMaterial({ color: GOLD_DASH, emissive: GOLD_DASH, emissiveIntensity: 0.72, roughness: 0.5 });
  private readonly ghosts = [
    new ShaderMaterial({ vertexShader: HORIZON_VERTEX, fragmentShader: HORIZON_FRAGMENT,
      uniforms: { tint: { value: new Vector3(0.97, 0.96, 0.88) } },
      transparent: true, depthTest: false, depthWrite: false, side: DoubleSide }),
    new ShaderMaterial({ vertexShader: HORIZON_VERTEX, fragmentShader: HORIZON_FRAGMENT,
      uniforms: { tint: { value: new Vector3(0.94, 0.82, 0.59) } },
      transparent: true, depthTest: false, depthWrite: false, side: DoubleSide }),
  ];
  private revision: number | string | undefined;
  private initialized = false;
  private rebuilds = 0;
  private routeCount = 0;
  private segmentCount = 0;
  private triangles = 0;
  private drawCalls = 0;

  getRoute(id: string): PreparedRoute | undefined { return this.routes.get(id); }

  setRoutes(specs: readonly RouteRenderSpec[], revision?: number | string): void {
    if (this.initialized && revision !== undefined && revision === this.revision) return;
    for (let i = this.group.children.length - 1; i >= 0; i--) {
      const mesh = this.group.children[i] as Mesh;
      this.group.remove(mesh);
      mesh.geometry.dispose();
      // Ghost and visible mesh share geometry; dispose() is idempotent.
    }
    this.routes.clear();
    this.triangles = 0;
    this.drawCalls = 0;
    this.segmentCount = 0;
    const continuous: TubeData = { positions: [], normals: [], indices: [] };
    const dashed: TubeData = { positions: [], normals: [], indices: [] };
    for (let i = 0; i < specs.length; i++) {
      const route = prepareRoute(specs[i]);
      if (!route || this.routes.has(route.id)) continue;
      this.routes.set(route.id, route);
      for (let leg = 0; leg < route.arcs.length; leg++) {
        const arc = route.arcs[leg];
        this.segmentCount++;
        if (route.type === 'widebody') {
          appendTube(continuous, arc, 0, 1, Math.max(10, Math.ceil(arc.angle * 80)), 0.0032);
        } else {
          const dashes = Math.max(6, Math.ceil(arc.angle / 0.022));
          for (let dash = 0; dash < dashes; dash++) {
            appendTube(dashed, arc, dash / dashes, (dash + 0.55) / dashes, 3, 0.0026);
          }
        }
      }
    }
    const batches: readonly [TubeData, MeshStandardMaterial, ShaderMaterial][] = [
      [continuous, this.litMaterial, this.ghosts[0]],
      [dashed, this.dashedMaterial, this.ghosts[1]],
    ];
    for (let i = 0; i < batches.length; i++) {
      const [data, material, ghost] = batches[i];
      if (!data.indices.length) continue;
      const geometry = geometryFor(data);
      const visible = new Mesh(geometry, material);
      visible.frustumCulled = false;
      this.group.add(visible);
      if (this.outline) {
        const ink = new Mesh(geometry, this.outline);
        ink.frustumCulled = false;
        this.group.add(ink);
        this.drawCalls++;
      }
      const beyondHorizon = new Mesh(geometry, ghost);
      beyondHorizon.frustumCulled = false;
      beyondHorizon.renderOrder = 100;
      this.group.add(beyondHorizon);
      this.triangles += data.indices.length / 3;
      this.drawCalls += 2;
    }
    this.rebuilds++;
    this.routeCount = this.routes.size;
    this.revision = revision;
    this.initialized = true;
  }

  get stats(): RouteGeometryStats {
    return { routes: this.routeCount, segments: this.segmentCount, drawCalls: this.drawCalls,
      triangles: this.triangles, rebuilds: this.rebuilds };
  }

  dispose(): void {
    for (let i = this.group.children.length - 1; i >= 0; i--) {
      const child = this.group.children[i] as Mesh;
      this.group.remove(child);
      child.geometry.dispose();
    }
    this.litMaterial.dispose();
    this.dashedMaterial.dispose();
    this.outline?.dispose();
    this.ghosts[0].dispose();
    this.ghosts[1].dispose();
    this.routes.clear();
  }
}
