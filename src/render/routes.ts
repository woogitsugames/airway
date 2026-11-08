/**
 * The renderer's one great-circle arc model (routes, planes, preview). [ext-04] The route tubes went with the
 * satellite look (D-302); the Linoryt ribbon is drawn by `linoryt-objects.ts`.
 */
import { Vector3 } from 'three';
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
const MIN_ARC = 1e-7;
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
