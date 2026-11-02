import {
  BufferAttribute, BufferGeometry, Color, IcosahedronGeometry, Mesh, MeshStandardMaterial,
} from 'three';
import type { LandMask } from './land-mask';
import { vec3ToLatLon } from './geo-math';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface TerrainQuality { readonly detail: number; readonly coastDepth: number }
interface Position { readonly x: number; readonly y: number; readonly z: number }
const COLORS = {
  deep: new Color('#1f5f86'), sea: new Color('#2f86a8'), shallow: new Color('#4aa3b8'),
  sand: new Color('#e6cf91'), grass: new Color('#86b35a'), forest: new Color('#4f8a45'),
  jungle: new Color('#3d7a3c'), desert: new Color('#dcb36e'), rock: new Color('#9a8f7c'),
  snow: new Color('#f3f1ea'), tundra: new Color('#a9b48c'),
};
const COLOR_TMP = new Color();
const RESOLUTION: Record<QualityLevel, TerrainQuality> = {
  low: { detail: 10, coastDepth: 1 },
  medium: { detail: 21, coastDepth: 2 },
  high: { detail: 30, coastDepth: 2 },
};

function hash(x: number, y: number, z: number): number {
  let v = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  let result = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
    result += hash(ix + a, iy + b, iz + c) *
      (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
  }
  return result;
}
export function terrainNoise(v: Position): number {
  return noise(v.x * 3, v.y * 3, v.z * 3) * .55 +
    noise(v.x * 7, v.y * 7, v.z * 7) * .3 +
    noise(v.x * 17, v.y * 17, v.z * 17) * .15;
}

function unit(v: Position): Position {
  const m = 1 / Math.hypot(v.x, v.y, v.z);
  return { x: v.x * m, y: v.y * m, z: v.z * m };
}
function middle(a: Position, b: Position): Position {
  return unit({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
}
interface SurfaceSample {
  readonly point: Position;
  readonly lon: number;
  readonly lat: number;
  readonly land: boolean;
  readonly coast: number;
  readonly noise: number;
}
function sample(p: Position, mask: LandMask): SurfaceSample {
  const q = unit(p);
  const loc = vec3ToLatLon(q);
  return { point: q, ...loc, land: mask.isLand(loc.lon, loc.lat),
    coast: mask.coastAt(loc.lon, loc.lat), noise: terrainNoise(q) };
}
export function terrainHeight(lon: number, lat: number, mask: LandMask): number {
  const rad = Math.PI / 180;
  const q = { x: Math.cos(lat * rad) * Math.sin(lon * rad),
    y: Math.sin(lat * rad), z: Math.cos(lat * rad) * Math.cos(lon * rad) };
  const coast = mask.coastAt(lon, lat);
  return mask.isLand(lon, lat) ? .004 + Math.max(0, terrainNoise(q) - .56) * .09 * Math.min(1, coast * 1.4)
    : -.004 * (1 - coast);
}
function height(s: SurfaceSample): number {
  return s.land ? .004 + Math.max(0, s.noise - .56) * .09 * Math.min(1, s.coast * 1.4)
    : -.004 * (1 - s.coast);
}
function palette(s: SurfaceSample): Color {
  const a = Math.abs(s.lat), h = height(s), n = s.noise;
  if (!s.land) {
    const shallow = Math.max(0, Math.min(1, (s.coast - .2) / .6));
    return COLOR_TMP.copy(COLORS.deep).lerp(COLORS.sea, Math.min(1, s.coast * 1.8 + n * .2))
      .lerp(COLORS.shallow, shallow);
  }
  if (a > 66 || h > .022) return COLORS.snow;
  if (h > .015) return COLORS.rock;
  if (a > 58) return COLORS.tundra;
  const sahara = s.lat > 14 && s.lat < 33 && s.lon > -17 && s.lon < 60;
  if (sahara) return n > .62 ? COLORS.sand : COLORS.desert;
  if (a < 12) return COLORS.jungle;
  return n > .55 ? COLORS.forest : COLORS.grass;
}

export function createTerrain(mask: LandMask, level: QualityLevel): Mesh {
  const base = new IcosahedronGeometry(1, RESOLUTION[level].detail);
  const attr = base.getAttribute('position');
  const positions: number[] = [], colors: number[] = [];
  const maxDepth = RESOLUTION[level].coastDepth;
  let triangles = 0;
  const emit = (a: Position, b: Position, c: Position, depth: number): void => {
    const sa = sample(a, mask), sb = sample(b, mask), sc = sample(c, mask);
    const center = sample({ x: (a.x + b.x + c.x) / 3,
      y: (a.y + b.y + c.y) / 3, z: (a.z + b.z + c.z) / 3 }, mask);
    const near = [sa, sb, sc, center].some((s) => s.coast > .04 && s.coast < .96);
    const crossing = [sb, sc, center].some((s) => s.land !== sa.land);
    if (depth < maxDepth && (crossing || near)) {
      const ab = middle(a, b), bc = middle(b, c), ca = middle(c, a);
      emit(a, ab, ca, depth + 1); emit(ab, b, bc, depth + 1);
      emit(ca, bc, c, depth + 1); emit(ab, bc, ca, depth + 1);
      return;
    }
    const biome = palette(center), lightness = .92 + center.noise * .16;
    for (const s of [sa, sb, sc]) {
      const radius = 1 + height(s);
      positions.push(s.point.x * radius, s.point.y * radius, s.point.z * radius);
      colors.push(Math.min(1, biome.r * lightness), Math.min(1, biome.g * lightness),
        Math.min(1, biome.b * lightness));
    }
    triangles++;
  };
  for (let i = 0; i < attr.count; i += 3) {
    emit({ x: attr.getX(i), y: attr.getY(i), z: attr.getZ(i) },
      { x: attr.getX(i + 1), y: attr.getY(i + 1), z: attr.getZ(i + 1) },
      { x: attr.getX(i + 2), y: attr.getY(i + 2), z: attr.getZ(i + 2) }, 0);
  }
  base.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, new MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: .92, metalness: 0,
  }));
  mesh.receiveShadow = true;
  mesh.userData['triangles'] = triangles;
  return mesh;
}
