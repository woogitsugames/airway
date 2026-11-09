/**
 * Read-only aircraft snapshot and route-distance interpolation. [ext-04] The 3D plane models went with the satellite
 * look (D-302); the plane silhouettes are drawn by `objects.ts`.
 */
import { distanceForSegment, type AircraftKind, type PreparedRoute } from './routes';

/** progress01 is an integer from 0 to progressScale (default 10,000). */
export interface PlaneRenderSnapshot {
  readonly id: string;
  readonly routeId: string;
  readonly segment: number;
  readonly progress01: number;
  readonly direction?: 1 | -1;
  readonly type?: AircraftKind;
  readonly load: number;
  readonly capacity?: number;
}

export interface PlaneRenderStats {
  readonly planes: number;
  readonly turboprops: number;
  readonly widebodies: number;
  /** Geometry passes only; consult renderer.info.render.calls for measured WebGL draw calls. */
  readonly mainPassCalls: number;
  readonly triangles: number;
  readonly droppedPlanes: number;
}

const DEFAULT_PROGRESS_SCALE = 10_000;

export function planeProgressDistance(
  route: PreparedRoute, snapshot: PlaneRenderSnapshot, progressScale = DEFAULT_PROGRESS_SCALE,
): number {
  if (!Number.isFinite(snapshot.progress01) || progressScale <= 0) return Number.NaN;
  return distanceForSegment(route, snapshot.segment,
    snapshot.progress01 / progressScale, snapshot.direction === -1 ? -1 : 1);
}

/** Interpolating route distance instead of segment-local progress prevents waypoint jumps. */
export function interpolatePlaneDistance(fromDistance: number, toDistance: number, alpha: number): number {
  const weight = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 0;
  return fromDistance + (toDistance - fromDistance) * weight;
}
