// [night-72a R2] D-327: the one lon/lat → screen projection behind `WorldRenderer.project`, `projectAirport` and
// `projectLonLat` (CSS px from the canvas' top-left corner). Pure and allocation-free (the caller owns the scratch
// vectors and the output), so the headless tests run it against the real orbit camera.
import type { Camera, Vector3 } from 'three';
import { setLatLonVec3 } from './globe/geo-math';

/** Writable screen point (structurally `ScreenPoint` of world.ts). */
export interface ScreenPointLike { x: number; y: number; visible: boolean }

/**
 * Altitude (globe radius = 1) of every surface anchor the DOM reads: airport stamps (`projectAirport`), the tap
 * point (`pick`) and atlas labels (`projectLonLat`). One value, so a label and a stamp at the same place agree.
 */
export const SURFACE_ANCHOR_ALTITUDE = 1.01;

/**
 * Projects `lon/lat` at `altitude` with `camera` (its world matrix must be current) into a `width` × `height` CSS-px
 * viewport. `visible` is false behind the horizon (the camera is below the point's tangent plane) or outside the
 * depth range.
 */
export function projectToScreen(
  camera: Camera, width: number, height: number, lon: number, lat: number, altitude: number,
  scratch: Vector3, toCamera: Vector3, out: ScreenPointLike,
): ScreenPointLike {
  setLatLonVec3(scratch, lon, lat, altitude);
  toCamera.copy(camera.position).sub(scratch);
  // Front-facing test against the local surface normal (radius-normalised position).
  const facing = toCamera.dot(scratch) > 0;
  scratch.project(camera);
  out.x = (scratch.x + 1) / 2 * width;
  out.y = (1 - scratch.y) / 2 * height;
  out.visible = facing && scratch.z >= -1 && scratch.z <= 1;
  return out;
}
