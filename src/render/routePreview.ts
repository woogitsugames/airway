/** Fixed-buffer 3D great-circle route ghost, in local globe coordinates. */
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Group, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import type { GeoPoint, RoutePreviewModel } from '../input/routeTool';

const SAMPLES_PER_LEG = 64;
const MAX_PREVIEW_LEGS = 32;
const CRUISE_BASE_RADIUS = 1.008;
const CRUISE_LIFT = { turboprop: 0.035, widebody: 0.09 } as const;
const VALID_RGB: readonly [number, number, number] = [1, 0.97, 0.88];
const INVALID_RGB: readonly [number, number, number] = [0.78, 0.13, 0.10];

export interface RoutePreviewView {
  readonly object: Group;
  update(model: RoutePreviewModel | null): void;
  dispose(): void;
}

/** Matches Diorama scene3d.js: vec(lon, lat) and routeCurve()'s sinusoidal cruise lift. */
function unitVector(point: GeoPoint, result: Vector3): void {
  const lon = point.lon * Math.PI / 180;
  const lat = point.lat * Math.PI / 180;
  const y = Math.sin(lat);
  const horizontal = Math.cos(lat);
  result.set(horizontal * Math.sin(lon), y, horizontal * Math.cos(lon));
}

/** No temporary allocations; robust when endpoints are coincident or antipodal. */
function greatCircleAt(a: Vector3, b: Vector3, angle: number, sinAngle: number,
  perpendicular: Vector3, fraction: number, lift: number, result: Vector3): void {
  if (angle < 1e-7) {
    result.copy(a);
  } else if (Math.abs(sinAngle) < 1e-7) {
    result.copy(a).multiplyScalar(Math.cos(angle * fraction))
      .addScaledVector(perpendicular, Math.sin(angle * fraction));
  } else {
    result.copy(a).multiplyScalar(Math.sin((1 - fraction) * angle) / sinAngle)
      .addScaledVector(b, Math.sin(fraction * angle) / sinAngle);
  }
  const altitude = CRUISE_BASE_RADIUS + lift * Math.sin(Math.PI * fraction) * Math.min(1, angle / 0.9);
  result.normalize().multiplyScalar(altitude);
}

export function createRoutePreview(parent?: Group): RoutePreviewView {
  // At most one split per leg at the range boundary. Never recreate geometry on pointer movement.
  const segmentBudget = MAX_PREVIEW_LEGS * (SAMPLES_PER_LEG + 1);
  const positions = new Float32Array(segmentBudget * 2 * 3);
  const colors = new Float32Array(segmentBudget * 2 * 3);
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(positions, 3);
  const color = new BufferAttribute(colors, 3);
  position.setUsage(DynamicDrawUsage);
  color.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('color', color);
  geometry.setDrawRange(0, 0);
  const material = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.96,
    depthTest: true, depthWrite: false });
  const line = new LineSegments(geometry, material);
  line.frustumCulled = false;
  const object = new Group();
  object.name = 'airway-route-preview';
  object.add(line);
  parent?.add(object);
  const from = new Vector3();
  const to = new Vector3();
  const perp = new Vector3();
  const p0 = new Vector3();
  const p1 = new Vector3();
  let count = 0;
  const emit = (a: Vector3, b: Vector3, valid: boolean): void => {
    if (count >= segmentBudget) return;
    const offset = count * 6;
    positions[offset] = a.x;
    positions[offset + 1] = a.y;
    positions[offset + 2] = a.z;
    positions[offset + 3] = b.x;
    positions[offset + 4] = b.y;
    positions[offset + 5] = b.z;
    const rgb = valid ? VALID_RGB : INVALID_RGB;
    colors.set(rgb, offset);
    colors.set(rgb, offset + 3);
    count++;
  };
  const update = (model: RoutePreviewModel | null): void => {
    count = 0;
    if (!model || model.points.length < 2 || !Number.isFinite(model.rangeKm) || model.rangeKm <= 0) {
      geometry.setDrawRange(0, 0);
      line.visible = false;
      return;
    }
    const lift = CRUISE_LIFT[model.aircraft];
    const legs = Math.min(MAX_PREVIEW_LEGS, model.points.length - 1, model.legDistancesKm.length);
    for (let leg = 0; leg < legs; leg++) {
      const km = model.legDistancesKm[leg];
      if (!Number.isFinite(km) || km < 0) continue;
      unitVector(model.points[leg], from);
      unitVector(model.points[leg + 1], to);
      const dot = Math.max(-1, Math.min(1, from.dot(to)));
      const angle = Math.acos(dot);
      const sinAngle = Math.sin(angle);
      perp.set(0, Math.abs(from.y) < 0.9 ? 1 : 0, Math.abs(from.y) < 0.9 ? 0 : 1);
      perp.addScaledVector(from, -perp.dot(from)).normalize();
      const cutoff = km === 0 ? 1 : Math.max(0, Math.min(1, model.rangeKm / km));
      for (let segment = 0; segment < SAMPLES_PER_LEG; segment++) {
        if (model.aircraft === 'turboprop' && segment % 4 === 3) continue; // dashed lower-altitude ghost
        const t0 = segment / SAMPLES_PER_LEG;
        const t1 = (segment + 1) / SAMPLES_PER_LEG;
        greatCircleAt(from, to, angle, sinAngle, perp, t0, lift, p0);
        greatCircleAt(from, to, angle, sinAngle, perp, t1, lift, p1);
        if (cutoff > t0 && cutoff < t1) {
          // The exact part beyond the plane range is red, not merely a whole sample.
          greatCircleAt(from, to, angle, sinAngle, perp, cutoff, lift, p1);
          emit(p0, p1, true);
          p0.copy(p1);
          greatCircleAt(from, to, angle, sinAngle, perp, t1, lift, p1);
          emit(p0, p1, false);
        } else emit(p0, p1, t1 <= cutoff);
      }
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    geometry.setDrawRange(0, count * 2);
    line.visible = count > 0;
  };
  return { object, update, dispose: () => {
    parent?.remove(object);
    geometry.dispose();
    material.dispose();
  } };
}
