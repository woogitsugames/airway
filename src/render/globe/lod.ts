// [night-04] Globe LOD (D-73). The terrain is cut into spatial chunks (latitude bands split into
// longitude sectors, ~31° wide everywhere) and only the chunks the camera can see are drawn:
// a conservative horizon test (with each chunk's highest point) plus the view frustum. Chunks are
// stored in one vertex buffer in sector-major order, so a visible cap is a few contiguous index
// runs; each run is one draw call from a small pool of meshes sharing the buffer.
// Every preset above `low` also carries a coarser level for the zoomed-out globe, chosen by the
// on-screen size of the finest facet, so far views never pay for sub-pixel coastline detail.
import {
  BufferAttribute, BufferGeometry, Frustum, Group, Matrix4, Mesh, Sphere, Vector3,
  type Camera, type Material,
} from 'three';
import type { QualityLevel, TerrainArrays } from './terrain';

/** Near (preset) level first, then the coarser far level; `low` keeps one level (cheap build). */
export const TERRAIN_LOD_LEVELS: Record<QualityLevel, readonly QualityLevel[]> = {
  low: ['low'],
  medium: ['medium', 'low'],
  high: ['high', 'medium'],
};
/**
 * Switch to the near level when a finest far-level facet spans more than this many device
 * pixels, back to far below `FAR_FACET_PX` (hysteresis: no flicker while pinching).
 */
export const NEAR_FACET_PX = 5.5;
export const FAR_FACET_PX = 4.5;
/** Lowest terrain radius (deep sea floor is 1 - 0.0045): the occluder for the horizon test. */
const OCCLUDER_RADIUS = 0.995;
const BAND_DEG = 15;
const DEG = 180 / Math.PI;

export interface TerrainChunk {
  /** First vertex and vertex count inside the level's reordered buffer. */
  readonly start: number;
  readonly count: number;
  /** Unit direction of the chunk centre and the largest angle (rad) from it to any vertex. */
  readonly center: Vector3;
  readonly spread: number;
  readonly maxRadius: number;
  readonly sphere: Sphere;
}

export interface ChunkedLevel {
  readonly level: QualityLevel;
  readonly geometry: BufferGeometry;
  readonly chunks: readonly TerrainChunk[];
  readonly triangles: number;
  readonly finestDeg: number;
}

/** Chunk id of a lon/lat point: bands of 30°, each cut into sectors of roughly 30° of arc. */
export function chunkLayout(): { sectors: number[]; offsets: number[]; total: number } {
  const sectors: number[] = [];
  const offsets: number[] = [];
  let total = 0;
  for (let lat = -90; lat < 90; lat += BAND_DEG) {
    const mid = (lat + BAND_DEG / 2) / DEG;
    const count = Math.max(3, Math.round(360 / BAND_DEG * Math.cos(mid)));
    offsets.push(total);
    sectors.push(count);
    total += count;
  }
  return { sectors, offsets, total };
}
const LAYOUT = chunkLayout();

function chunkOf(lon: number, lat: number): number {
  const band = Math.min(LAYOUT.sectors.length - 1, Math.max(0, Math.floor((lat + 90) / BAND_DEG)));
  const n = LAYOUT.sectors[band];
  const sector = Math.min(n - 1, Math.max(0, Math.floor((lon + 180) / 360 * n)));
  return LAYOUT.offsets[band] + sector;
}

/**
 * Storage order of the chunks: by the longitude where the sector starts, then by band, so any
 * camera cap (which spans a longitude range at every latitude) is a few contiguous runs.
 */
function storageOrder(): number[] {
  const keyed: { id: number; lon: number; band: number }[] = [];
  for (let band = 0; band < LAYOUT.sectors.length; band++) {
    const n = LAYOUT.sectors[band];
    for (let s = 0; s < n; s++) keyed.push({ id: LAYOUT.offsets[band] + s, lon: (s + .5) / n * 360, band });
  }
  // Snap to 30° columns; serpentine within a column so neighbouring columns join at the ends.
  keyed.sort((a, b) => {
    const ca = Math.floor(a.lon / BAND_DEG), cb = Math.floor(b.lon / BAND_DEG);
    if (ca !== cb) return ca - cb;
    return ca % 2 ? b.band - a.band : a.band - b.band;
  });
  return keyed.map((entry) => entry.id);
}
const ORDER = storageOrder();

/** Reorders a non-indexed terrain into chunk order and measures every chunk. Pure (no GL). */
export function chunkTerrain(arrays: TerrainArrays, level: QualityLevel): ChunkedLevel {
  const { positions, colors } = arrays;
  const triangles = positions.length / 9;
  const ids = new Uint16Array(triangles);
  const counts = new Uint32Array(LAYOUT.total);
  for (let t = 0; t < triangles; t++) {
    const o = t * 9;
    const x = positions[o] + positions[o + 3] + positions[o + 6];
    const y = positions[o + 1] + positions[o + 4] + positions[o + 7];
    const z = positions[o + 2] + positions[o + 5] + positions[o + 8];
    const lat = Math.asin(Math.max(-1, Math.min(1, y / Math.hypot(x, y, z)))) * DEG;
    const lon = Math.atan2(x, z) * DEG;
    const id = chunkOf(lon, lat);
    ids[t] = id;
    counts[id]++;
  }
  // Counting sort into storage order.
  const firstTri = new Uint32Array(LAYOUT.total);
  let running = 0;
  for (const id of ORDER) { firstTri[id] = running; running += counts[id]; }
  const cursor = firstTri.slice();
  const outPositions = new Float32Array(positions.length);
  const outColors = new Uint16Array(colors.length);
  for (let t = 0; t < triangles; t++) {
    const dst = cursor[ids[t]]++ * 9;
    outPositions.set(positions.subarray(t * 9, t * 9 + 9), dst);
    outColors.set(colors.subarray(t * 9, t * 9 + 9), dst);
  }
  const chunks: TerrainChunk[] = [];
  const point = new Vector3();
  for (const id of ORDER) {
    const startTri = firstTri[id], n = counts[id];
    if (n === 0) continue;
    const center = new Vector3();
    let maxRadius = 0;
    for (let v = startTri * 3; v < (startTri + n) * 3; v++) {
      point.fromArray(outPositions, v * 3);
      const r = point.length();
      if (r > maxRadius) maxRadius = r;
      center.addScaledVector(point, 1 / r);
    }
    center.normalize();
    let minDot = 1;
    const sphere = new Sphere(center.clone(), 0);
    for (let v = startTri * 3; v < (startTri + n) * 3; v++) {
      point.fromArray(outPositions, v * 3);
      minDot = Math.min(minDot, point.dot(center) / point.length());
    }
    // Frustum sphere: around the chord midpoint of the cap, generous by construction.
    const spread = Math.acos(Math.max(-1, Math.min(1, minDot)));
    sphere.center.multiplyScalar(Math.cos(spread) * .5 + maxRadius * .5);
    for (let v = startTri * 3; v < (startTri + n) * 3; v++) {
      point.fromArray(outPositions, v * 3);
      sphere.radius = Math.max(sphere.radius, point.distanceTo(sphere.center));
    }
    chunks.push({ start: startTri * 3, count: n * 3, center, spread, maxRadius, sphere });
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(outPositions, 3));
  geometry.setAttribute('color', new BufferAttribute(outColors, 3, true));
  geometry.boundingSphere = new Sphere(new Vector3(), 1.05);
  return { level, geometry, chunks, triangles, finestDeg: arrays.finestDeg };
}

/**
 * Conservative visibility of a chunk from a camera at `eye` (world space, globe at the origin):
 * some point of the chunk may rise above the horizon of the lowest terrain sphere.
 */
export function chunkAboveHorizon(chunk: TerrainChunk, eye: Vector3): boolean {
  const d = eye.length();
  if (d <= OCCLUDER_RADIUS) return true;
  const toEye = Math.acos(Math.max(-1, Math.min(1, chunk.center.dot(eye) / d)));
  const limit = Math.acos(OCCLUDER_RADIUS / d) + Math.acos(Math.min(1, OCCLUDER_RADIUS / chunk.maxRadius));
  return toEye - chunk.spread <= limit;
}

export interface TerrainLodStats {
  /** Index into the level list (0 = near / preset). */
  readonly level: number;
  readonly levelName: QualityLevel;
  readonly visibleChunks: number;
  readonly chunks: number;
  readonly runs: number;
  readonly triangles: number;
}

export interface TerrainLod {
  readonly group: Group;
  readonly levels: readonly ChunkedLevel[];
  /** `pixelsPerDegree`: device pixels per degree of arc at the globe centre (0 = unknown → near). */
  update(camera: Camera, pixelsPerDegree: number): void;
  /** Pin a level (tests, shots); `null` restores the automatic choice. */
  forceLevel(index: number | null): void;
  readonly stats: TerrainLodStats;
  dispose(): void;
}

export function createTerrainLod(levels: readonly ChunkedLevel[], material: Material): TerrainLod {
  const group = new Group();
  group.name = 'AirwayTerrain';
  const maxRuns = Math.max(...levels.map((l) => l.chunks.length));
  // One pool of meshes per level, so a level switch never re-binds attributes.
  const pools = levels.map((lvl) => {
    const meshes: Mesh[] = [];
    for (let i = 0; i < maxRuns; i++) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', lvl.geometry.getAttribute('position'));
      geometry.setAttribute('color', lvl.geometry.getAttribute('color'));
      geometry.boundingSphere = lvl.geometry.boundingSphere;
      const mesh = new Mesh(geometry, material);
      mesh.name = `AirwayTerrain.${lvl.level}.${i}`;
      mesh.frustumCulled = false; // culled per chunk below
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.visible = false;
      group.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  });
  const frustum = new Frustum();
  const viewProjection = new Matrix4();
  const eye = new Vector3();
  const lastView = new Matrix4();
  let current = 0;
  let forced: number | null = null;
  let dirty = true;
  const stats = { level: 0, levelName: levels[0].level, visibleChunks: 0, chunks: levels[0].chunks.length, runs: 0, triangles: 0 };

  const chooseLevel = (pixelsPerDegree: number): number => {
    if (forced !== null) return Math.max(0, Math.min(levels.length - 1, forced));
    if (levels.length < 2 || !(pixelsPerDegree > 0)) return 0;
    const facetPx = levels[1].finestDeg * pixelsPerDegree;
    if (current === 1) return facetPx > NEAR_FACET_PX ? 0 : 1;
    return facetPx < FAR_FACET_PX ? 1 : 0;
  };

  return {
    group, levels, stats,
    update(camera, pixelsPerDegree) {
      const next = chooseLevel(pixelsPerDegree);
      if (next !== current) { current = next; dirty = true; }
      camera.updateMatrixWorld();
      if (!dirty && lastView.equals(camera.matrixWorld)) return;
      dirty = false;
      lastView.copy(camera.matrixWorld);
      viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
      eye.setFromMatrixPosition(camera.matrixWorld);
      const lvl = levels[current];
      let runStart = -1, runEnd = -1, runs = 0, visible = 0, triangles = 0;
      const meshes = pools[current];
      const flush = (): void => {
        if (runStart < 0) return;
        meshes[runs++].geometry.setDrawRange(runStart, runEnd - runStart);
        triangles += (runEnd - runStart) / 3;
        runStart = -1;
      };
      for (const chunk of lvl.chunks) {
        if (!chunkAboveHorizon(chunk, eye) || !frustum.intersectsSphere(chunk.sphere)) { flush(); continue; }
        visible++;
        if (runStart >= 0 && runEnd === chunk.start) runEnd += chunk.count;
        else { flush(); runStart = chunk.start; runEnd = chunk.start + chunk.count; }
      }
      flush();
      for (let p = 0; p < pools.length; p++) {
        const pool = pools[p];
        for (let i = 0; i < pool.length; i++) pool[i].visible = p === current && i < runs;
      }
      stats.level = current;
      stats.levelName = lvl.level;
      stats.visibleChunks = visible;
      stats.chunks = lvl.chunks.length;
      stats.runs = runs;
      stats.triangles = triangles;
    },
    forceLevel(index) { forced = index; dirty = true; },
    dispose() {
      for (const lvl of levels) lvl.geometry.dispose();
      for (const pool of pools) for (const mesh of pool) mesh.geometry.dispose();
      group.clear();
    },
  };
}
