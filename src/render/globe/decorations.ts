// [task-33] Instanced decorations driven by the same biome fields as the terrain: conifers and
// broadleaf trees where the land is green, sandstone rocks in deserts, boulders on mountain
// flanks, puffy clouds with a sun-projected ground shadow (works without shadow maps).
import {
  BufferAttribute, BufferGeometry, CircleGeometry, Color, ConeGeometry, DoubleSide, Group,
  IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, OctahedronGeometry,
  Points, ShaderMaterial, Vector3,
} from 'three';
import { createDecorativeRng } from '../../core/rng';
import { latLonToVec3 } from './geo-math';
import type { LandMask } from './land-mask';
import { airportFlatten, createSample, sampleAt, smoothstep } from './terrain';
import { DIORAMA_STYLE } from './terrain';
import type { QualityLevel, SurfaceSample, TerrainStyle } from './terrain';

/**
 * [ext-03] Experimental globe looks (DEV only): shares of the preset counts and the `tidy` placement
 * (fewer, larger, denser forests; rocks only on mountain flanks; smoother clouds). Default = the diorama.
 */
export interface DecorOptions {
  readonly trees: number;
  readonly rocks: number;
  readonly clouds: number;
  readonly lights: number;
  readonly tidy: boolean;
  readonly style: TerrainStyle;
}
export const DIORAMA_DECOR: DecorOptions = { trees: 1, rocks: 1, clouds: 1, lights: 1, tidy: false, style: DIORAMA_STYLE };

export const DECOR: Record<QualityLevel, { trees: number; rocks: number; clouds: number; lights: number }> = {
  low: { trees: 3500, rocks: 260, clouds: 30, lights: 350 },
  medium: { trees: 11000, rocks: 700, clouds: 60, lights: 1100 },
  high: { trees: 18000, rocks: 1200, clouds: 90, lights: 1800 },
};
const UP = new Vector3();
const NORTH = new Vector3();
const EAST = new Vector3();
const SOUTH = new Vector3();
const BASIS = new Matrix4();
const DEG = 180 / Math.PI;

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

/** Tree cover 0..1 from the terrain fields: none on beaches, deserts, ice, high mountains or airport pads. */
export function forestDensity(s: SurfaceSample): number {
  const a = Math.abs(s.lat);
  if (s.dist < .12 || s.dry > .55 || s.ice > .15 || s.mountain > .3 || a > 69) return 0;
  const patches = smoothstep(.36, .58, s.noise);
  let cover = a < 14 ? .55 + .45 * patches : .15 + .85 * patches;
  cover = Math.max(cover, smoothstep(48, 55, a) * (1 - smoothstep(62, 68, a)) * (.55 + .45 * patches)); // taiga
  cover *= 1 - smoothstep(.1, .5, s.dry);
  cover *= 1 - smoothstep(.12, .3, s.mountain) * .7;
  return airportFlatten(s.lon, s.lat) > .3 ? 0 : cover;
}

function makeTrees(mask: LandMask, count: number, rand: () => number, opts: DecorOptions = DIORAMA_DECOR): InstancedMesh[] {
  const tidy = opts.tidy;
  // Conifer: an open five-sided cone. Broadleaf: a faceted octahedral crown. One draw call each.
  const conifer = new ConeGeometry(.003, .011, 5, 1, true);
  conifer.translate(0, .0054, 0);
  const crown = new OctahedronGeometry(.0038, 0);
  crown.scale(1, 1.15, 1);
  crown.translate(0, .0047, 0);
  const material = new MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, side: DoubleSide });
  const cones = new InstancedMesh(conifer, material, count);
  const crowns = new InstancedMesh(crown, material, count);
  cones.name = 'Conifers';
  crowns.name = 'BroadleafTrees';
  const dummy = new Object3D(), color = new Color(), s = createSample();
  let nCones = 0, nCrowns = 0;
  for (let tries = 0; nCones + nCrowns < count && tries < count * 40; tries++) {
    const lat = Math.asin(2 * rand() - 1) * DEG;
    const lon = rand() * 360 - 180;
    if (mask.distanceAt(lon, lat) < .12) continue;
    sampleAt(lon, lat, mask, s, opts.style);
    const cover = forestDensity(s);
    if (cover <= 0 || rand() > cover) continue;
    // [ext-03] tidy: only inside real forests (no lone trees on plains), in tight stands of 3-5.
    if (tidy && cover < .5) continue;
    // Small groves: each accepted spot plants 1-3 trees within ~0.25°.
    const grove = tidy ? 3 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 3);
    const spread = tidy ? .3 : .5;
    for (let g = 0; g < grove && nCones + nCrowns < count; g++) {
      const tlon = lon + (g ? (rand() - .5) * spread / Math.max(.3, Math.cos(lat / DEG)) : 0);
      const tlat = lat + (g ? (rand() - .5) * spread : 0);
      if (g) {
        if (mask.distanceAt(tlon, tlat) < .12) continue;
        sampleAt(tlon, tlat, mask, s, opts.style);
        if (forestDensity(s) <= 0) continue; // groves only thicken existing cover
      }
      const a = Math.abs(tlat);
      const coniferous = a > 50 || (a > 30 && s.noise > .5) || s.mountain > .12;
      onSurface(dummy, tlon, tlat, 1 + s.height - .0006);
      dummy.rotateY(rand() * Math.PI * 2);
      const scale = tidy ? .85 + rand() * .25 : .7 + rand() * .75;
      dummy.scale.set(scale, scale * (coniferous && a > 45 ? 1.3 : 1), scale);
      dummy.updateMatrix();
      if (coniferous) {
        cones.setMatrixAt(nCones, dummy.matrix);
        cones.setColorAt(nCones++, color.set(tidy ? (a > 45 ? (rand() > .5 ? '#3e6b4c' : '#466f50') : '#55804a')
          : a > 45 ? (rand() > .5 ? '#2f6b45' : '#3a7a4a') : '#4f8a3f'));
      } else {
        crowns.setMatrixAt(nCrowns, dummy.matrix);
        crowns.setColorAt(nCrowns++, color.set(tidy ? (a < 15 ? '#467d45' : rand() > .5 ? '#64904f' : '#6b9655')
          : a < 15 ? (rand() > .5 ? '#2f7a36' : '#3f8a3a') : rand() > .5 ? '#5f9a45' : '#6fa64a'));
      }
    }
  }
  for (const [mesh, n] of [[cones, nCones], [crowns, nCrowns]] as const) {
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
  }
  return [cones, crowns];
}

/** Sandstone rocks on deserts, grey boulders on mountain flanks (below the snowline). */
function makeRocks(mask: LandMask, count: number, rand: () => number, opts: DecorOptions = DIORAMA_DECOR): InstancedMesh {
  const geometry = new IcosahedronGeometry(.0055, 0);
  geometry.scale(1.5, .6, 1);
  const mesh = new InstancedMesh(geometry,
    new MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1 }), count);
  mesh.name = 'Rocks';
  const dummy = new Object3D(), color = new Color(), s = createSample();
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 120; tries++) {
    const lat = Math.asin(2 * rand() - 1) * DEG;
    const lon = rand() * 360 - 180;
    if (Math.abs(lat) > 62 || mask.distanceAt(lon, lat) < .2) continue;
    sampleAt(lon, lat, mask, s, opts.style);
    // [ext-03] tidy: no scattered desert rocks (they read as dirt specks), boulders on mountain flanks only.
    const desert = opts.tidy ? 0 : smoothstep(.55, .9, s.dry), rocky = smoothstep(.1, .22, s.mountain) * (1 - smoothstep(.3, .45, s.mountain));
    if (rand() > Math.max(desert, rocky * .8) || airportFlatten(lon, lat) > .2) continue;
    onSurface(dummy, lon, lat, 1 + s.height + .0004);
    dummy.rotateY(rand() * Math.PI * 2);
    dummy.scale.setScalar(.35 + rand() * .7);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    mesh.setColorAt(placed, desert >= rocky
      ? color.set(rand() > .5 ? '#c99a5b' : '#a8743f') : color.set(rand() > .5 ? '#8d8576' : '#b0a796'));
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  return mesh;
}

const CLOUD_LIFT = .075;
/** Puffy clouds (one instanced draw call) plus their ground shadows (a second one). */
function makeClouds(mask: LandMask, count: number, rand: () => number, sunDirection: Vector3,
  tidy = false): InstancedMesh[] {
  // [ext-03] tidy: one subdivision more, so a puff reads as a soft cloud, not a crystal.
  const geometry = new IcosahedronGeometry(.015, tidy ? 1 : 0);
  geometry.scale(1, .55, 1);
  const mesh = new InstancedMesh(geometry,
    new MeshStandardMaterial({ color: '#f6f7f4', flatShading: true, roughness: 1 }), count * 6);
  mesh.name = 'Clouds';
  // Shadow blob: a flat seven-sided disc on the tangent plane, stretched along the cloud.
  const blob = new CircleGeometry(.024, 7);
  blob.rotateX(-Math.PI / 2);
  const shadowMaterial = new ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { sunDirection: { value: sunDirection }, lift: { value: CLOUD_LIFT } },
    vertexShader: `uniform vec3 sunDirection; uniform float lift; varying float vAlpha;
      void main() {
        vec3 anchor = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 n = normalize(anchor);
        vec3 s = normalize(sunDirection);
        float ns = dot(n, s);
        // Project the cloud onto the ground along the sun ray (clamped near the terminator).
        vec3 shift = -(s - n * ns) * lift / max(ns, 0.35);
        float len = length(shift);
        if (len > 0.03) shift *= 0.03 / len;
        vec4 local = instanceMatrix * vec4(position, 1.0);
        vec3 p = normalize(local.xyz + shift) * length(local.xyz);
        vAlpha = smoothstep(0.02, 0.25, ns);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `varying float vAlpha;
      void main() { gl_FragColor = vec4(0.04, 0.09, 0.14, 0.42 * vAlpha); }`,
  });
  const shadows = new InstancedMesh(blob, shadowMaterial, count);
  shadows.name = 'CloudShadows';
  const dummy = new Object3D(), s = createSample();
  let placed = 0;
  for (let c = 0; c < count; c++) {
    const lat = Math.asin(rand() * 1.6 - .8) * DEG;
    const lon = rand() * 360 - 180;
    const altitude = 1.07 + rand() * .02;
    const puffs = 3 + Math.floor(rand() * 4);
    const heading = (rand() - .5) * .6;
    for (let j = 0; j < puffs; j++) {
      onSurface(dummy, lon, lat, altitude);
      dummy.rotateY(heading);
      dummy.translateX((j - (puffs - 1) / 2) * .014);
      dummy.translateZ((rand() - .5) * .012);
      dummy.translateY(rand() * .004);
      const size = .65 + rand() * .7;
      dummy.scale.set(size, size * (.8 + rand() * .25), size);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed++, dummy.matrix);
    }
    const ground = Math.max(.0012, sampleAt(lon, lat, mask, s).height);
    onSurface(dummy, lon, lat, 1 + ground + .0015);
    dummy.rotateY(heading);
    dummy.scale.set(.45 + puffs * .2, 1, .8);
    dummy.updateMatrix();
    shadows.setMatrixAt(c, dummy.matrix);
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  shadows.instanceMatrix.needsUpdate = true;
  // The projected blob stands in for a shadow map, so clouds never double-shadow in `high`.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  shadows.frustumCulled = false;
  return [mesh, shadows];
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
  sunDirection: Vector3, opts: DecorOptions = DIORAMA_DECOR): Group {
  const rand = createDecorativeRng(seed);
  const config = DECOR[level];
  const group = new Group();
  group.name = 'GlobeDecorations';
  if (opts === DIORAMA_DECOR) {
    group.add(...makeTrees(mask, config.trees, rand), makeRocks(mask, config.rocks, rand),
      ...makeClouds(mask, config.clouds, rand, sunDirection), makeCityLights(mask, sunDirection, config.lights, rand));
    return group;
  }
  // [ext-03] Experimental looks: a layer whose share is 0 is left out entirely (no empty draw call).
  const n = (full: number, share: number): number => Math.round(full * share);
  if (opts.trees > 0) group.add(...makeTrees(mask, n(config.trees, opts.trees), rand, opts));
  if (opts.rocks > 0) group.add(makeRocks(mask, n(config.rocks, opts.rocks), rand, opts));
  if (opts.clouds > 0) group.add(...makeClouds(mask, n(config.clouds, opts.clouds), rand, sunDirection, opts.tidy));
  if (opts.lights > 0) group.add(makeCityLights(mask, sunDirection, n(config.lights, opts.lights), rand));
  return group;
}
