import {
  BufferAttribute, BufferGeometry, Color, ConeGeometry, DodecahedronGeometry,
  DoubleSide, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial,
  Object3D, Points, ShaderMaterial, Vector3,
} from 'three';
import { createDecorativeRng } from '../../core/rng';
import { latLonToVec3 } from './geo-math';
import type { LandMask } from './land-mask';
import { terrainHeight, terrainNoise } from './terrain';
import type { QualityLevel } from './terrain';

const DECOR: Record<QualityLevel, { trees: number; rocks: number; clouds: number; lights: number }> = {
  low: { trees: 450, rocks: 48, clouds: 28, lights: 350 },
  medium: { trees: 2200, rocks: 160, clouds: 58, lights: 1100 },
  high: { trees: 5100, rocks: 300, clouds: 95, lights: 1800 },
};
const UP = new Vector3();
const NORTH = new Vector3();
const EAST = new Vector3();
const SOUTH = new Vector3();
const BASIS = new Matrix4();

function onSurface(dummy: Object3D, lon: number, lat: number, altitude: number): void {
  const p = latLonToVec3(lon, lat, altitude);
  dummy.position.set(p.x, p.y, p.z);
  UP.set(p.x, p.y, p.z).normalize();
  NORTH.set(0, 1, 0).addScaledVector(UP, -UP.y);
  if (NORTH.lengthSq() < 1e-8) NORTH.set(0, 0, 1);
  NORTH.normalize();
  EAST.crossVectors(NORTH, UP).normalize();
  SOUTH.copy(NORTH).negate();
  BASIS.makeBasis(EAST, UP, SOUTH);
  dummy.quaternion.setFromRotationMatrix(BASIS);
}

function makeTrees(mask: LandMask, count: number, rand: () => number): InstancedMesh {
  const geometry = new ConeGeometry(.003, .011, 5);
  geometry.translate(0, .006, 0);
  const mesh = new InstancedMesh(geometry,
    new MeshStandardMaterial({ vertexColors: false, color: '#ffffff', flatShading: true, roughness: 1 }), count);
  const dummy = new Object3D(), color = new Color();
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 35; tries++) {
    const lat = Math.asin(2 * rand() - 1) * 180 / Math.PI;
    const lon = rand() * 360 - 180;
    if (!mask.isLand(lon, lat) || Math.abs(lat) > 64 || (lat > 14 && lat < 33 && lon > -17 && lon < 60)) continue;
    const p = latLonToVec3(lon, lat);
    if (terrainNoise(p) < .40) continue;
    onSurface(dummy, lon, lat, 1 + terrainHeight(lon, lat, mask));
    const scale = .7 + rand() * .8;
    dummy.scale.set(scale, scale * (Math.abs(lat) > 45 ? 1.3 : 1), scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.set(Math.abs(lat) > 45 ? '#2f6b45' : Math.abs(lat) < 15
      ? '#2f7a36' : rand() > .5 ? '#4f8a3f' : '#6a9a45');
    mesh.setColorAt(placed, color);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  return mesh;
}

function makeRocks(mask: LandMask, count: number, rand: () => number): InstancedMesh {
  const geometry = new DodecahedronGeometry(.006, 0);
  geometry.scale(1.6, .55, 1);
  const mesh = new InstancedMesh(geometry,
    new MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }), count);
  const dummy = new Object3D(), color = new Color();
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 40; tries++) {
    const lat = 14 + rand() * 19, lon = -16 + rand() * 75;
    if (!mask.isLand(lon, lat)) continue;
    onSurface(dummy, lon, lat, 1 + terrainHeight(lon, lat, mask) + .001);
    dummy.rotateY(rand() * Math.PI * 2);
    const scale = .35 + rand() * .7;
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    mesh.setColorAt(placed, color.set(rand() > .5 ? '#c99a5b' : '#e0b878'));
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  return mesh;
}

/** One instanced draw call for all cloud puffs, including shadows. */
function makeClouds(count: number, rand: () => number): InstancedMesh {
  const geometry = new IcosahedronGeometry(.015, 0);
  geometry.scale(1, .55, 1);
  const mesh = new InstancedMesh(geometry,
    new MeshStandardMaterial({ color: '#f6f7f4', flatShading: true, roughness: 1, side: DoubleSide }), count * 5);
  const dummy = new Object3D();
  let placed = 0;
  for (let c = 0; c < count; c++) {
    const lat = Math.asin(rand() * 1.6 - .8) * 180 / Math.PI;
    const lon = rand() * 360 - 180;
    const altitude = 1.07 + rand() * .02;
    const puffs = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < puffs; j++) {
      onSurface(dummy, lon, lat, altitude);
      dummy.position.addScaledVector(EAST, (j - (puffs - 1) / 2) * .015);
      dummy.position.addScaledVector(NORTH, (rand() - .5) * .013);
      const s = .7 + rand() * .7;
      dummy.scale.set(s, s * (.8 + rand() * .2), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed++, dummy.matrix);
    }
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  return mesh;
}

// Fixed major-city anchors, supplemented with seeded land dots.
const CITIES: ReadonlyArray<readonly [number, number]> = [
  [-0.1276, 51.5072], [-9.1393, 38.7223], [2.3522, 48.8566], [13.405, 52.52],
  [12.4964, 41.9028], [4.9041, 52.3676], [30.5234, 50.4501], [37.6173, 55.7558],
  [31.2357, 30.0444], [28.0473, -26.2041], [3.3792, 6.5244], [39.2083, -6.7924],
  [-74.006, 40.7128], [-118.2437, 34.0522], [-87.6298, 41.8781], [-99.1332, 19.4326],
  [-46.6333, -23.5505], [-58.3816, -34.6037], [-77.0428, -12.0464], [-70.6693, -33.4489],
  [77.209, 28.6139], [72.8777, 19.076], [88.3639, 22.5726], [90.4125, 23.8103],
  [116.4074, 39.9042], [121.4737, 31.2304], [114.1694, 22.3193], [139.6917, 35.6895],
  [126.978, 37.5665], [100.5018, 13.7563], [103.8198, 1.3521], [106.8456, -6.2088],
  [151.2093, -33.8688], [144.9631, -37.8136], [174.7633, -36.8485],
];

export function makeCityLights(mask: LandMask, sunDirection: Vector3, count: number,
  rand: () => number): Points<BufferGeometry, ShaderMaterial> {
  const positions: number[] = [];
  const add = (lon: number, lat: number): void => {
    if (lat < -85 || lat > 85 || !mask.isLand(lon, lat)) return;
    const p = latLonToVec3(lon, lat, 1.011);
    positions.push(p.x, p.y, p.z);
  };
  for (const [lon, lat] of CITIES) {
    for (let n = 0; n < 18; n++) add(lon + (rand() - .5) * 3, lat + (rand() - .5) * 2.1);
  }
  for (let tries = 0, placed = 0; tries < count * 15 && placed < count; tries++) {
    const lon = rand() * 360 - 180, lat = (rand() * 125 - 55);
    if (!mask.isLand(lon, lat)) continue;
    add(lon, lat);
    placed++;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { sunDirection: { value: sunDirection } },
    vertexShader: `uniform vec3 sunDirection; varying float vNight;
      void main() {
        vNight = 1.0 - smoothstep(-0.16, 0.08, dot(normalize(position), normalize(sunDirection)));
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 3.5;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `varying float vNight;
      void main() {
        vec2 xy = gl_PointCoord - vec2(0.5);
        if (dot(xy, xy) > 0.22) discard;
        gl_FragColor = vec4(1.0, 0.78, 0.42, vNight * 0.90);
      }`,
  });
  return new Points(geometry, material);
}

export function createDecorations(mask: LandMask, level: QualityLevel, seed: number,
  sunDirection: Vector3): Group {
  const rand = createDecorativeRng(seed);
  const config = DECOR[level];
  const group = new Group();
  group.add(makeTrees(mask, config.trees, rand), makeRocks(mask, config.rocks, rand),
    makeClouds(config.clouds, rand), makeCityLights(mask, sunDirection, config.lights, rand));
  return group;
}
