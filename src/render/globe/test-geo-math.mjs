// [task-03] Fixed-seed projection and analytic picking tests; no WebGL required.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('./geo-math.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const geo = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
let tests = 0, failed = 0;
const assert = (condition, label) => {
  tests++;
  if (!condition) { failed++; console.error('FAIL ' + label); }
};
const epsilon = 1e-8;
const longitudeError = (a, b) => Math.abs(geo.normalizeLon(a - b));
for (const [lon, lat] of [[0, 0], [90, 0], [-90, 0], [-180, 0], [180, 0],
  [0, 90], [0, -90], [-.1276, 51.5072], [-9.1393, 38.7223], [31.2357, 30.0444],
  [151.2093, -33.8688], [179.9, -12.1], [-179.9, 12.1]]) {
  const p = geo.latLonToVec3(lon, lat);
  const q = geo.vec3ToLatLon(p);
  assert(Math.abs(q.lat - lat) < epsilon, 'roundtrip latitude ' + lat);
  if (Math.abs(lat) < 89.999) assert(longitudeError(q.lon, lon) < epsilon, 'roundtrip longitude ' + lon);
  assert(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < epsilon, 'unit radius ' + lon);
}
{
  const out = { x: 0, y: 0, z: 0 };
  const same = geo.setLatLonVec3(out, -9.1393, 38.7223, 1.5);
  const ref = geo.latLonToVec3(-9.1393, 38.7223, 1.5);
  assert(same === out && Math.abs(out.x - ref.x) + Math.abs(out.y - ref.y) + Math.abs(out.z - ref.z) < epsilon,
    'setLatLonVec3 writes into the caller vector and matches latLonToVec3');
}
assert(geo.intersectUnitSphere({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: -1 })?.z === 1,
  'front-most intersection');
assert(geo.intersectUnitSphere({ x: 0, y: 0, z: 3 }, { x: 0, y: 1, z: 0 }) === null,
  'ray miss');
assert(geo.intersectUnitSphere({ x: 0, y: 0, z: 3 }, { x: 0, y: 0, z: 1 }) === null,
  'ray points away');
assert(geo.intersectUnitSphere({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })?.y === 1,
  'inside sphere');
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const unit = (a) => { const n = Math.hypot(a.x, a.y, a.z); return { x: a.x / n, y: a.y / n, z: a.z / n }; };
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
// A real three.js-compatible perspective matrix is not required to test the math:
 // the inverse projection and camera world matrices follow its column-major convention.
function testCamera(lon, lat) {
  const normal = geo.latLonToVec3(lon, lat);
  const z = normal, x = unit(cross({ x: 0, y: 1, z: 0 }, z));
  const y = cross(z, x);
  const position = { x: z.x * 3, y: z.y * 3, z: z.z * 3 };
  const matrixWorld = { elements: [x.x, x.y, x.z, 0, y.x, y.y, y.z, 0,
    z.x, z.y, z.z, 0, position.x, position.y, position.z, 1] };
  const f = 1 / Math.tan(48 * Math.PI / 360), near = .1, far = 10;
  const a = (far + near) / (near - far), b = 2 * far * near / (near - far);
  const projectionMatrixInverse = { elements: [1 / f, 0, 0, 0, 0, 1 / f, 0, 0,
    0, 0, 0, 1 / b, 0, 0, -1, a / b] };
  return { position, matrixWorld, projectionMatrixInverse, basis: { x, y, z }, f };
}
for (const [name, lon, lat] of [['London', -.1276, 51.5072], ['Lisbon', -9.1393, 38.7223],
  ['Cairo', 31.2357, 30.0444]]) {
  const camera = testCamera(lon, lat);
  const center = geo.pickSphereNdc(0, 0, camera);
  assert(center !== null && longitudeError(center.lon, lon) < .5 && Math.abs(center.lat - lat) < .5,
    name + ' center pick <0.5deg');
  const target = geo.latLonToVec3(lon + .7, lat + .45);
  const delta = sub(target, camera.position);
  const ndcX = (dot(delta, camera.basis.x) * camera.f) / -dot(delta, camera.basis.z);
  const ndcY = (dot(delta, camera.basis.y) * camera.f) / -dot(delta, camera.basis.z);
  const offCenter = geo.pickSphereNdc(ndcX, ndcY, camera);
  assert(offCenter !== null && longitudeError(offCenter.lon, lon + .7) < .5 &&
    Math.abs(offCenter.lat - lat - .45) < .5, name + ' off-center pick <0.5deg');
  assert(geo.pickSphereNdc(1, 1, camera) === null, name + ' screen corner miss');
}
try { geo.latLonToVec3(0, 100); assert(false, 'invalid latitude rejected'); } catch { assert(true, 'invalid latitude rejected'); }
try { geo.vec3ToLatLon({ x: 0, y: 0, z: 0 }); assert(false, 'zero-vector rejected'); } catch { assert(true, 'zero-vector rejected'); }
console.log('SUMMARY test:geo-math seed=0xA1A1 tests=' + tests + ' passed=' + (tests - failed) + ' failed=' + failed);
if (failed) process.exitCode = 1;
