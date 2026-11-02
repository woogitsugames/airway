/** Fixed-buffer 3D great-circle route ghost while the finger draws, in globe coordinates. */
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Group, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import {
  makeGreatCircleArc, sampleGreatCircleArc, type AircraftKind, type GeoWaypoint,
  type MutableGreatCircleArc,
} from './routes';

const SAMPLES_PER_LEG = 64;
const MAX_PREVIEW_LEGS = 32;
const VALID_RGB: readonly [number, number, number] = [1, 0.97, 0.88];
const INVALID_RGB: readonly [number, number, number] = [0.78, 0.13, 0.10];

/** Structurally identical to `RoutePreviewModel` from `src/input/routeTool.ts`. */
export interface RoutePreviewView {
  readonly points: readonly GeoWaypoint[];
  readonly legDistancesKm: readonly number[];
  readonly rangeKm: number;
  readonly aircraft: AircraftKind;
}

export interface RoutePreviewLayer {
  readonly object: Group;
  update(model: RoutePreviewView | null): void;
  dispose(): void;
}

export function createRoutePreview(parent?: Group): RoutePreviewLayer {
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
  line.visible = false;
  const object = new Group();
  object.name = 'airway-route-preview';
  object.add(line);
  parent?.add(object);
  const arc: MutableGreatCircleArc = { from: new Vector3(), side: new Vector3(), angle: 0, lift: 0, liftFactor: 0 };
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
  const update = (model: RoutePreviewView | null): void => {
    count = 0;
    if (!model || model.points.length < 2 || !Number.isFinite(model.rangeKm) || model.rangeKm <= 0) {
      geometry.setDrawRange(0, 0);
      line.visible = false;
      return;
    }
    const legs = Math.min(MAX_PREVIEW_LEGS, model.points.length - 1, model.legDistancesKm.length);
    for (let leg = 0; leg < legs; leg++) {
      const km = model.legDistancesKm[leg];
      if (!Number.isFinite(km) || km < 0) continue;
      // Same arc (and cruise lift) the committed route tube will use.
      makeGreatCircleArc(model.points[leg], model.points[leg + 1], model.aircraft, arc);
      const cutoff = km === 0 ? 1 : Math.max(0, Math.min(1, model.rangeKm / km));
      for (let segment = 0; segment < SAMPLES_PER_LEG; segment++) {
        if (model.aircraft === 'turboprop' && segment % 4 === 3) continue; // dashed lower-altitude ghost
        const t0 = segment / SAMPLES_PER_LEG;
        const t1 = (segment + 1) / SAMPLES_PER_LEG;
        sampleGreatCircleArc(arc, t0, p0);
        if (cutoff > t0 && cutoff < t1) {
          // The exact part beyond the plane range is red, not merely a whole sample.
          sampleGreatCircleArc(arc, cutoff, p1);
          emit(p0, p1, true);
          p0.copy(p1);
          sampleGreatCircleArc(arc, t1, p1);
          emit(p0, p1, false);
        } else {
          sampleGreatCircleArc(arc, t1, p1);
          emit(p0, p1, t1 <= cutoff);
        }
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
