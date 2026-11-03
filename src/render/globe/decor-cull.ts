// [night-07f] Decoration culling (D-75). Trees and rocks are instanced across the whole globe, so before
// this every frame drew all of them, about half behind the planet (medium: ~75 k tree triangles). The
// instances are sorted into the same spatial chunks as the terrain (lod.ts), keeping their random order
// inside each chunk, and whenever the set of visible chunks (horizon + frustum) or the density changes,
// the visible chunks are packed to the front of the instance buffer and `count` is set: still one draw
// call per mesh, and the upload happens only when a chunk enters or leaves the view, not per frame.
// Thinning (battery saver, adaptive quality) takes the same share of every chunk, so it stays even.
import {
  Frustum, Matrix4, Sphere, Vector3, type Camera, type InstancedMesh,
} from 'three';
import { chunkAboveHorizon, chunkLayout, chunkOf, ORDER, type TerrainChunk } from './lod';

const DEG = 180 / Math.PI;
/** Tallest decoration above its anchor (a stretched conifer is ~0.011 × 1.45 × 1.3). */
const DECOR_HEIGHT = 0.022;
const TOTAL = chunkLayout().total;

export interface DecorChunks {
  /** Instance index and instance count of each non-empty chunk, in storage order. */
  readonly chunks: readonly TerrainChunk[];
  /** Instance matrices / colours in storage order (the master copy the mesh buffer is packed from). */
  readonly matrices: Float32Array;
  readonly colors: Float32Array | null;
  readonly instances: number;
}

/** Pure: sort `count` instances (matrix + optional RGB) into chunk storage order and measure each chunk. */
export function chunkInstances(matrixArray: Float32Array, colorArray: Float32Array | null, count: number): DecorChunks {
  const ids = new Uint16Array(count);
  const counts = new Uint32Array(TOTAL);
  for (let i = 0; i < count; i++) {
    const o = i * 16;
    const x = matrixArray[o + 12], y = matrixArray[o + 13], z = matrixArray[o + 14];
    const lat = Math.asin(Math.max(-1, Math.min(1, y / Math.hypot(x, y, z)))) * DEG;
    const id = chunkOf(Math.atan2(x, z) * DEG, lat);
    ids[i] = id;
    counts[id]++;
  }
  const first = new Uint32Array(TOTAL);
  let running = 0;
  for (const id of ORDER) { first[id] = running; running += counts[id]; }
  const cursor = first.slice();
  const matrices = new Float32Array(count * 16);
  const colors = colorArray ? new Float32Array(count * 3) : null;
  for (let i = 0; i < count; i++) {
    const dst = cursor[ids[i]]++; // stable: random placement order survives inside a chunk
    matrices.set(matrixArray.subarray(i * 16, i * 16 + 16), dst * 16);
    if (colors && colorArray) colors.set(colorArray.subarray(i * 3, i * 3 + 3), dst * 3);
  }
  const chunks: TerrainChunk[] = [];
  const point = new Vector3();
  for (const id of ORDER) {
    const start = first[id], n = counts[id];
    if (n === 0) continue;
    const center = new Vector3();
    let maxRadius = 0;
    for (let i = start; i < start + n; i++) {
      point.set(matrices[i * 16 + 12], matrices[i * 16 + 13], matrices[i * 16 + 14]);
      const r = point.length();
      maxRadius = Math.max(maxRadius, r + DECOR_HEIGHT);
      center.addScaledVector(point, 1 / r);
    }
    center.normalize();
    let minDot = 1;
    for (let i = start; i < start + n; i++) {
      point.set(matrices[i * 16 + 12], matrices[i * 16 + 13], matrices[i * 16 + 14]);
      minDot = Math.min(minDot, point.dot(center) / point.length());
    }
    const spread = Math.acos(Math.max(-1, Math.min(1, minDot)));
    const sphere = new Sphere(center.clone().multiplyScalar(Math.cos(spread) * .5 + maxRadius * .5), 0);
    for (let i = start; i < start + n; i++) {
      point.set(matrices[i * 16 + 12], matrices[i * 16 + 13], matrices[i * 16 + 14]);
      sphere.radius = Math.max(sphere.radius, point.distanceTo(sphere.center) + DECOR_HEIGHT);
    }
    chunks.push({ start, count: n, center, spread, maxRadius, sphere });
  }
  return { chunks, matrices, colors, instances: count };
}

/** Pure: how many instances of a chunk of `n` are drawn at `density` (same share in every chunk). */
export function thinnedCount(n: number, density: number): number {
  return Math.round(n * Math.max(0, Math.min(1, density)));
}

export interface DecorCullStats {
  /** Instances drawn / all instances, over every culled mesh. */
  drawn: number;
  total: number;
  /** Buffer repacks so far (only when the visible chunk set or the density changes). */
  repacks: number;
}

export interface DecorCuller {
  readonly stats: DecorCullStats;
  update(camera: Camera): void;
  setDensity(density: number): void;
}

/** Take over `meshes` (already filled): reorder their buffers and cull them per chunk from now on. */
export function createDecorCuller(meshes: readonly InstancedMesh[]): DecorCuller {
  const entries = meshes.map((mesh) => {
    const data = chunkInstances(mesh.instanceMatrix.array as Float32Array,
      (mesh.instanceColor?.array as Float32Array | undefined) ?? null, mesh.count);
    // The renderer would otherwise compute a bounding sphere once from whatever subset is packed.
    mesh.boundingSphere = new Sphere(new Vector3(), 1.05);
    mesh.frustumCulled = false;
    return { mesh, data, visible: new Uint8Array(data.chunks.length), packed: -1 };
  });
  const frustum = new Frustum();
  const viewProjection = new Matrix4();
  const eye = new Vector3();
  const lastView = new Matrix4();
  let density = 1;
  let dirty = true;
  const stats: DecorCullStats = { drawn: 0, total: entries.reduce((sum, e) => sum + e.data.instances, 0), repacks: 0 };

  function pack(entry: (typeof entries)[number]): number {
    const { mesh, data, visible } = entry;
    const matrices = mesh.instanceMatrix.array as Float32Array;
    const colors = mesh.instanceColor?.array as Float32Array | undefined;
    let n = 0;
    for (let c = 0; c < data.chunks.length; c++) {
      if (!visible[c]) continue;
      const chunk = data.chunks[c];
      const take = thinnedCount(chunk.count, density);
      if (take === 0) continue;
      matrices.set(data.matrices.subarray(chunk.start * 16, (chunk.start + take) * 16), n * 16);
      if (colors && data.colors) colors.set(data.colors.subarray(chunk.start * 3, (chunk.start + take) * 3), n * 3);
      n += take;
    }
    mesh.count = n;
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, n * 16);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.clearUpdateRanges();
      mesh.instanceColor.addUpdateRange(0, n * 3);
      mesh.instanceColor.needsUpdate = true;
    }
    stats.repacks++;
    return n;
  }

  return {
    stats,
    setDensity(next) {
      const clamped = Math.max(0, Math.min(1, next));
      if (clamped !== density) { density = clamped; dirty = true; }
    },
    update(camera) {
      camera.updateMatrixWorld();
      if (!dirty && lastView.equals(camera.matrixWorld)) return;
      const force = dirty;
      dirty = false;
      lastView.copy(camera.matrixWorld);
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
      eye.setFromMatrixPosition(camera.matrixWorld);
      let drawn = 0;
      for (const entry of entries) {
        let changed = force;
        const { chunks } = entry.data;
        for (let c = 0; c < chunks.length; c++) {
          const v = chunkAboveHorizon(chunks[c], eye) && frustum.intersectsSphere(chunks[c].sphere) ? 1 : 0;
          if (v !== entry.visible[c]) { entry.visible[c] = v; changed = true; }
        }
        if (changed) entry.packed = pack(entry);
        drawn += entry.packed;
      }
      stats.drawn = drawn;
    },
  };
}
