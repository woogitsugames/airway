// Globe coordinates use +Y north, +Z Greenwich and +X 90 degrees east.
// Kept independent of three.js so hit-testing can be tested without WebGL.
export interface Vec3Like { readonly x: number; readonly y: number; readonly z: number }
export interface LonLat { readonly lon: number; readonly lat: number }
export interface MatrixLike { readonly elements: ArrayLike<number> }
export interface CameraLike {
  readonly position: Vec3Like;
  readonly matrixWorld: MatrixLike;
  readonly projectionMatrixInverse: MatrixLike;
  readonly isOrthographicCamera?: boolean;
  updateMatrixWorld?: (force?: boolean) => void;
}

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function normalizeLon(lon: number): number {
  if (!Number.isFinite(lon)) throw new RangeError('Longitude must be finite');
  return ((lon + 180) % 360 + 360) % 360 - 180;
}

export function latLonToVec3(lon: number, lat: number, radius = 1): Vec3Like {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new RangeError('Invalid latitude');
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Invalid radius');
  const longitude = normalizeLon(lon) * DEG;
  const latitude = lat * DEG;
  const c = Math.cos(latitude) * radius;
  return { x: Math.sin(longitude) * c, y: Math.sin(latitude) * radius, z: Math.cos(longitude) * c };
}

export function vec3ToLatLon(vector: Vec3Like): LonLat {
  const { x, y, z } = vector;
  if (![x, y, z].every(Number.isFinite) || (x === 0 && y === 0 && z === 0)) {
    throw new RangeError('Expected a non-zero finite vector');
  }
  return { lon: normalizeLon(Math.atan2(x, z) * RAD), lat: Math.atan2(y, Math.hypot(x, z)) * RAD };
}

function transform(matrix: ArrayLike<number>, x: number, y: number, z: number, w = 1): Vec3Like {
  const q = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w;
  if (Math.abs(q) < 1e-12) throw new RangeError('Singular homogeneous transform');
  return {
    x: (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w) / q,
    y: (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w) / q,
    z: (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w) / q,
  };
}

/** Analytic front-most ray/sphere hit, independent of terrain, clouds and decoration. */
export function intersectUnitSphere(origin: Vec3Like, direction: Vec3Like, radius = 1): Vec3Like | null {
  const dx = direction.x, dy = direction.y, dz = direction.z;
  const a = dx * dx + dy * dy + dz * dz;
  if (!Number.isFinite(a) || a <= 0 || radius <= 0) return null;
  const b = 2 * (origin.x * dx + origin.y * dy + origin.z * dz);
  const c = origin.x ** 2 + origin.y ** 2 + origin.z ** 2 - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(Math.max(0, discriminant));
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  const t = first >= 0 ? first : second >= 0 ? second : -1;
  if (t < 0) return null;
  return { x: origin.x + dx * t, y: origin.y + dy * t, z: origin.z + dz * t };
}

/** Coordinates are NDC (-1..1), not CSS pixels; caller handles its canvas rectangle. */
export function pickSphereNdc(ndcX: number, ndcY: number, camera: CameraLike): LonLat | null {
  if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY) || Math.abs(ndcX) > 1 || Math.abs(ndcY) > 1) return null;
  camera.updateMatrixWorld?.(true);
  const eye = transform(camera.projectionMatrixInverse.elements, ndcX, ndcY, .5);
  const target = transform(camera.matrixWorld.elements, eye.x, eye.y, eye.z);
  let origin: Vec3Like = camera.position;
  let direction: Vec3Like = {
    x: target.x - origin.x,
    y: target.y - origin.y,
    z: target.z - origin.z,
  };
  if (camera.isOrthographicCamera) {
    const near = transform(camera.projectionMatrixInverse.elements, ndcX, ndcY, -1);
    origin = transform(camera.matrixWorld.elements, near.x, near.y, near.z);
    const m = camera.matrixWorld.elements;
    direction = { x: -m[8], y: -m[9], z: -m[10] };
  }
  const hit = intersectUnitSphere(origin, direction);
  return hit === null ? null : vec3ToLatLon(hit);
}
