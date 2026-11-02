// Diorama airport objects. Rendering-only state; no authoritative simulation mutations.
import {
  BoxGeometry, Color, DoubleSide, Group, InstancedMesh,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion,
  Scene, Vector3,
} from 'three';
import { setLatLonVec3 } from './globe/geo-math';
import { KIT_PIECES, kitGeometry, kitMaterial, type KitPiece } from './models/airportKit';
import {
  AIRPORT_FOOTPRINT, HUB_ROOF, LANDMARK_XZ, LANDMARK_Y, airportStyle, destination, landmarkFor, palmBearings,
  type AirportStyle, type LandmarkPlacement, type RoofShape,
} from './models/airportStyle';

const PAD_ALTITUDE = 1.0055;
const CLOSED = '#C8352A';
const BUSY = '#FF9A3D';
const EMPTY = '#F2EFE6';

const up = new Vector3();
const north = new Vector3();
const east = new Vector3();
const backward = new Vector3();
const basis = new Matrix4();

/** Mockup-compatible orientation: local Y is radial up, local -Z is north. */
export function place(object: Object3D, lon: number, lat: number, altitude = PAD_ALTITUDE): Object3D {
  setLatLonVec3(up, lon, lat);
  north.set(0, 1, 0).addScaledVector(up, -up.y);
  if (north.lengthSq() < 1e-10) north.set(0, 0, up.y > 0 ? -1 : 1);
  north.normalize();
  east.crossVectors(north, up).normalize();
  backward.copy(north).negate();
  object.position.copy(up).multiplyScalar(altitude);
  object.quaternion.setFromRotationMatrix(basis.makeBasis(east, up, backward));
  return object;
}

export interface AirportDefinition {
  id: string;
  lon: number;
  lat: number;
  hub?: boolean;
}

export interface AirportOptions {
  radius?: number;
  maxAirports?: number;
  maxHubSeats?: number;
}

interface AirportRecord {
  id: string;
  lon: number;
  lat: number;
  hub: boolean;
  pose: Object3D;
  used: number;
  cap: number;
  curfew: boolean;
  /** [M1] Kit instances (pad, terminal, roof, tower, palms, landmark) owned by this airport. */
  instances: KitInstance[];
  anchors: DecorAnchor[];
  style: AirportStyle;
  landmark: LandmarkPlacement | null;
}

// ---- [M1] regional airport layout and landmarks on the shared building kit ------------------

/** One kit instance of an airport: local matrix in the airport frame (pose × size factor) or in a decor anchor. */
interface KitInstance { piece: KitPiece; index: number; local: Matrix4; anchor: number }
/** A spot on the ground next to the pad (palm, landmark): bearing/distance scale with the zoom like the pad. */
interface DecorAnchor { bearing: number; distance: number; heading: number }

interface KitMesh { mesh: InstancedMesh; capacity: number }

/** Decorations stand on lowland (terrain ~1.0034-1.006): base at this radius, pieces reach below it. */
const DECOR_ALTITUDE = 1.0038;
const GROUND = -0.004;
const APRON = '#D9D4C6';
const LANDMARK_SCALE = new Matrix4().makeScale(LANDMARK_XZ, LANDMARK_Y, LANDMARK_XZ);
const STONE = '#B9B3A6';

/** Kit instances per airport and piece (hub + landmark worst case). */
const PER_AIRPORT: Readonly<Record<KitPiece, number>> = {
  airfield: 1, block: 14, gable: 2, hip: 6, dome: 2, tiered: 2, pyramid: 4, tower: 1, palm: 5, snow: 1, lattice: 1, arch: 1,
};

const tq = new Quaternion();
const tv = new Vector3();
const ts = new Vector3();
function localMatrix(x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0): Matrix4 {
  tq.setFromAxisAngle(Object3D.DEFAULT_UP, yaw);
  return new Matrix4().compose(tv.set(x, y, z), tq, ts.set(sx, sy, sz));
}

interface Piece { piece: KitPiece; local: Matrix4; color: string; anchor: number }

/** Terminal roof of the regional archetype on a block of size w×d whose top is at y. */
function roof(out: Piece[], shape: RoofShape, color: string, x: number, y: number, z: number, w: number, d: number, anchor = -1): void {
  if (shape === 'flat') out.push({ piece: 'block', local: localMatrix(x, y, z, w * 1.06, .0018, d * 1.1), color, anchor });
  else if (shape === 'gable') out.push({ piece: 'gable', local: localMatrix(x, y, z, w * 1.04, .0056, d * 1.12), color, anchor });
  else if (shape === 'hip') out.push({ piece: 'hip', local: localMatrix(x, y, z, w * 1.08, .0042, d * 1.16), color, anchor });
  else if (shape === 'tiered') out.push({ piece: 'tiered', local: localMatrix(x, y, z, w * .92, .0072, d * .98), color, anchor });
  else {
    out.push({ piece: 'block', local: localMatrix(x, y, z, w * 1.04, .0012, d * 1.08), color: '#E3D6B8', anchor });
    out.push({ piece: 'dome', local: localMatrix(x, y + .0012, z, d * .8, .0044, d * .8), color, anchor });
  }
}

/** Every piece of one airport, in the airport frame (size-factor units) or a decor anchor. */
export function airportPieces(id: string, lon: number, lat: number, hub: boolean): { pieces: Piece[]; anchors: DecorAnchor[]; style: AirportStyle; landmark: LandmarkPlacement | null } {
  const style = airportStyle(id, lon, lat);
  const pieces: Piece[] = [];
  const anchors: DecorAnchor[] = [];
  const base = .0026;
  pieces.push({ piece: 'airfield', local: new Matrix4(), color: '#FFFFFF', anchor: -1 });
  if (style.climate === 'snow') {
    const r = AIRPORT_FOOTPRINT.padRadius * 1.5;
    pieces.push({ piece: 'snow', local: localMatrix(0, GROUND, 0, r, .0044, r, (style.seed % 360) * Math.PI / 180), color: '#FFFFFF', anchor: -1 });
  }
  // Main terminal (as the mockup) with the regional roof; a hub keeps the sea-green roof.
  const roofColor = hub ? HUB_ROOF : style.roofColor;
  const termH = style.roof === 'flat' ? .0062 : .0056;
  pieces.push({ piece: 'block', local: localMatrix(.011, base, .006, .018, termH, .009), color: style.wall, anchor: -1 });
  roof(pieces, style.roof, roofColor, .011, base + termH, .006, .018, .009);
  if (hub) {
    // Bigger apron, a second terminal block (pier) and the control tower.
    pieces.push({ piece: 'block', local: localMatrix(.012, base, .002, .02, .0006, .022), color: APRON, anchor: -1 });
    pieces.push({ piece: 'block', local: localMatrix(.012, base, -.0035, .016, .0036, .004), color: style.wall, anchor: -1 });
    pieces.push({ piece: 'block', local: localMatrix(.012, base + .0036, -.0035, .0168, .0009, .0046), color: HUB_ROOF, anchor: -1 });
    pieces.push({ piece: 'tower', local: localMatrix(.004, base, -.011, .62, .62, .62), color: '#FFFFFF', anchor: -1 });
  }
  const landmark = landmarkFor(id);
  if (landmark) {
    const anchor = anchors.length;
    anchors.push({ bearing: landmark.bearing, distance: landmark.distance, heading: (landmark.bearing + 90) * Math.PI / 180 });
    const first = pieces.length;
    landmarkPieces(pieces, landmark, anchor);
    // Landmarks read at gameplay zoom: wider and taller than the raw archetype (radius in airportStyle).
    for (let i = first; i < pieces.length; i++) pieces[i].local.premultiply(LANDMARK_SCALE);
  }
  const palmRadius = hub ? AIRPORT_FOOTPRINT.barrierRadius + .008 : AIRPORT_FOOTPRINT.padRadius * AIRPORT_FOOTPRINT.cityScale + .007;
  for (const bearing of palmBearings(style, landmark ? landmark.bearing : null)) {
    const anchor = anchors.length;
    anchors.push({ bearing, distance: palmRadius + ((style.seed >>> (bearing % 13)) & 3) * .0015, heading: bearing * .7 });
    const k = 1.45 + ((style.seed >>> (bearing % 7)) & 3) * .12;
    pieces.push({ piece: 'palm', local: localMatrix(0, GROUND + .003, 0, k, k, k), color: '#FFFFFF', anchor });
  }
  return { pieces, anchors, style, landmark };
}

/** Generic landmark archetypes (world units around the anchor, base below ground level). */
function landmarkPieces(out: Piece[], landmark: LandmarkPlacement, anchor: number): void {
  const blk = (x: number, y: number, z: number, w: number, h: number, d: number, color: string): void => {
    out.push({ piece: 'block', local: localMatrix(x, y, z, w, h, d), color, anchor });
  };
  switch (landmark.kind) {
    case 'lattice':
      out.push({ piece: 'lattice', local: new Matrix4(), color: '#FFFFFF', anchor });
      break;
    case 'towers': { // a tight cluster of plain towers; the tallest carries a short spire
      const towers: Array<[number, number, number, number, string]> = [
        [0, 0, .0058, .026, '#D9DEE0'], [.0062, .0036, .0048, .019, '#9FB3BF'], [-.0056, .0046, .0046, .016, '#C9CFD2'],
        [.0042, -.0058, .0044, .013, '#B4C3CB'], [-.0058, -.0042, .004, .011, '#E4E1D8'],
      ];
      for (const [x, z, w, h, c] of towers) {
        blk(x, GROUND, z, w, h - GROUND, w, c);
        blk(x, h, z, w * 1.02, .0008, w * 1.02, '#5E6B73');
      }
      out.push({ piece: 'pyramid', local: localMatrix(0, .0268, 0, .0024, .007, .0024), color: '#9FB3BF', anchor });
      break;
    }
    case 'pagoda': { // stepped tower: four shrinking storeys, each under a flared roof
      blk(0, GROUND, 0, .0125, .0012 - GROUND, .0125, STONE);
      let y = .0012;
      for (let i = 0; i < 4; i++) {
        const w = .0078 - i * .0012;
        blk(0, y, 0, w, .0032, w, '#E9E1D0');
        out.push({ piece: 'hip', local: localMatrix(0, y + .0032, 0, w * 1.75, .0019, w * 1.75), color: '#B5483A', anchor });
        y += .0049;
      }
      out.push({ piece: 'pyramid', local: localMatrix(0, y - .0002, 0, .0012, .0055, .0012), color: '#3B4046', anchor });
      break;
    }
    case 'dome': { // domed hall on a plinth flanked by two slim towers
      blk(0, GROUND, 0, .018, .0016 - GROUND, .012, STONE);
      blk(0, .0016, 0, .011, .0058, .011, '#EFE9DA');
      out.push({ piece: 'dome', local: localMatrix(0, .0074, 0, .0118, .0082, .0118), color: '#8FB3A8', anchor });
      for (const x of [-.0085, .0085]) {
        blk(x, .0016, .0045, .0018, .0128, .0018, '#EFE9DA');
        out.push({ piece: 'pyramid', local: localMatrix(x, .0144, .0045, .0021, .0042, .0021), color: '#8FB3A8', anchor });
      }
      break;
    }
    case 'arch':
      out.push({ piece: 'arch', local: localMatrix(0, -.0012, 0, 1, 1, 1), color: landmark.color ?? '#8E969C', anchor });
      break;
    case 'pyramid':
      out.push({ piece: 'pyramid', local: localMatrix(-.002, GROUND + .002, -.002, .013, .0118, .013, .2), color: '#D8B98A', anchor });
      out.push({ piece: 'pyramid', local: localMatrix(.0068, GROUND + .002, .0042, .0095, .0092, .0095, .2), color: '#CFAE7E', anchor });
      out.push({ piece: 'pyramid', local: localMatrix(-.0062, GROUND + .002, .0068, .006, .0066, .006, .2), color: '#D8B98A', anchor });
      break;
    case 'stepped': { // stepped platform with a small shrine on top
      let y = GROUND;
      for (let i = 0; i < 4; i++) {
        const w = .016 - i * .0034;
        const h = i === 0 ? .0028 - GROUND : .0026;
        blk(0, y, 0, w, h, w, i % 2 ? '#B9A88C' : '#C7B79B');
        y += h;
      }
      blk(0, y, 0, .0042, .0034, .0042, '#A8977C');
      break;
    }
  }
}

function createKit(group: Group, maxAirports: number): Map<KitPiece, KitMesh> {
  const kit = new Map<KitPiece, KitMesh>();
  for (const piece of KIT_PIECES) {
    const capacity = maxAirports * PER_AIRPORT[piece];
    const mesh = new InstancedMesh(kitGeometry(piece), kitMaterial(piece), capacity);
    mesh.name = 'airport-' + piece;
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    // instanceColor is allocated up front so the per-instance tint exists before the first draw.
    mesh.setColorAt(0, new Color('#FFFFFF'));
    group.add(mesh);
    kit.set(piece, { mesh, capacity });
  }
  return kit;
}

export interface AirportsLayer {
  readonly group: Group;
  addAirport(def: AirportDefinition): void;
  setHubLoad(id: string, used: number, cap: number): void;
  setCurfew(id: string, on: boolean): void;
  setZoom(zoom: number): void;
  getPosition(id: string, out: Vector3): Vector3 | null;
  has(id: string): boolean;
  isHub(id: string): boolean;
  /** Remove every airport (new game). */
  clear(): void;
  /** Rebuild ring/barrier instances once per frame if any load, curfew or zoom changed. */
  update(): void;
  dispose(): void;
}

export function createAirports(scene: Scene, options: AirportOptions = {}): AirportsLayer {
  const radius = options.radius ?? 1;
  const maxAirports = options.maxAirports ?? 48;
  const maxHubSeats = options.maxHubSeats ?? 48;
  if (!(radius > 0) || !Number.isInteger(maxAirports) || maxAirports < 1 || !Number.isInteger(maxHubSeats) || maxHubSeats < 1) {
    throw new RangeError('Invalid airport layer capacity or radius');
  }
  const group = new Group();
  group.name = 'airports';
  scene.add(group);
  const kit = createKit(group, maxAirports);
  const ringGeo = new BoxGeometry(1, 1, 1);
  const ringMat = new MeshBasicMaterial({ color: '#FFFFFF', side: DoubleSide });
  const rings = new InstancedMesh(ringGeo, ringMat, maxAirports * maxHubSeats);
  rings.count = 0;
  rings.frustumCulled = false;
  group.add(rings);
  const barGeo = new BoxGeometry(.006, .004, .002);
  const whiteMat = new MeshBasicMaterial({ color: '#F2EFE6' });
  const redMat = new MeshBasicMaterial({ color: '#E5483B' });
  const barriers = [new InstancedMesh(barGeo, whiteMat, maxAirports * 8), new InstancedMesh(barGeo, redMat, maxAirports * 8)];
  for (const mesh of barriers) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  const records = new Map<string, AirportRecord>();
  const scratch = new Object3D();
  const transform = new Matrix4();
  const color = new Color();
  let zoomScale = 1;
  let disposed = false;
  let markersDirty = false;

  function assertOpen(): void { if (disposed) throw new Error('Airport layer is disposed'); }
  const frame = new Matrix4();
  const sized = new Matrix4();
  const anchorPose = new Object3D();
  const anchorMatrices: Matrix4[] = [];
  const dirtyMeshes = new Set<InstancedMesh>();
  function updateModel(record: AirportRecord): void {
    record.pose.updateMatrix();
    const s = record.hub ? AIRPORT_FOOTPRINT.hubScale : AIRPORT_FOOTPRINT.cityScale;
    sized.makeScale(s, s, s).premultiply(record.pose.matrix);
    for (let i = 0; i < record.anchors.length; i++) {
      const a = record.anchors[i];
      // Decorations stand on their own spot of the sphere (no floating over the curvature); the
      // distance grows with the zoom scale exactly like the pad, so they never slide under it.
      const spot = destination(record.lon, record.lat, a.bearing, a.distance * zoomScale);
      place(anchorPose, spot.lon, spot.lat, radius * DECOR_ALTITUDE);
      anchorPose.rotateY(a.heading);
      anchorPose.scale.setScalar(radius * zoomScale);
      anchorPose.updateMatrix();
      (anchorMatrices[i] ??= new Matrix4()).copy(anchorPose.matrix);
    }
    for (const inst of record.instances) {
      const mesh = kit.get(inst.piece)!.mesh;
      frame.multiplyMatrices(inst.anchor < 0 ? sized : anchorMatrices[inst.anchor], inst.local);
      mesh.setMatrixAt(inst.index, frame);
      dirtyMeshes.add(mesh);
    }
  }
  function flushModels(): void {
    for (const mesh of dirtyMeshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    dirtyMeshes.clear();
  }

  function rebuildMarkers(): void {
    let ringIndex = 0;
    let whiteIndex = 0;
    let redIndex = 0;
    for (const record of records.values()) {
      if (record.hub && record.cap > 0) {
        const load = record.used / record.cap;
        const occupiedColor = load > .8 ? CLOSED : BUSY;
        const segment = Math.max(.0035, 2 * Math.PI * .055 / record.cap - .003);
        for (let i = 0; i < record.cap; i++) {
          const angle = i * 2 * Math.PI / record.cap;
          scratch.position.set(Math.cos(angle) * .055, .007, Math.sin(angle) * .055);
          scratch.quaternion.setFromAxisAngle(Object3D.DEFAULT_UP, -Math.PI / 2 - angle);
          scratch.scale.set(segment, .002, .006);
          scratch.updateMatrix();
          transform.multiplyMatrices(record.pose.matrix, scratch.matrix);
          rings.setMatrixAt(ringIndex, transform);
          rings.setColorAt(ringIndex, color.set(i < record.used ? occupiedColor : EMPTY));
          ringIndex++;
        }
      }
      if (record.curfew) {
        for (let i = 0; i < 16; i++) {
          const angle = i * Math.PI / 8;
          scratch.position.set(Math.cos(angle) * .066, .004, Math.sin(angle) * .066);
          scratch.quaternion.setFromAxisAngle(Object3D.DEFAULT_UP, -Math.PI / 2 - angle);
          scratch.scale.setScalar(1);
          scratch.updateMatrix();
          transform.multiplyMatrices(record.pose.matrix, scratch.matrix);
          if (i % 2) barriers[1].setMatrixAt(redIndex++, transform);
          else barriers[0].setMatrixAt(whiteIndex++, transform);
        }
      }
    }
    rings.count = ringIndex;
    rings.instanceMatrix.needsUpdate = true;
    if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    barriers[0].count = whiteIndex;
    barriers[1].count = redIndex;
    barriers[0].instanceMatrix.needsUpdate = true;
    barriers[1].instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    addAirport(def): void {
      assertOpen();
      if (!def.id || records.has(def.id) || !Number.isFinite(def.lon) || !Number.isFinite(def.lat) || Math.abs(def.lat) > 90 || Math.abs(def.lon) > 180) {
        throw new RangeError('Invalid or duplicate airport');
      }
      if (records.size >= maxAirports) throw new RangeError('Airport instance capacity exceeded');
      const hub = def.hub === true;
      const pose = place(new Object3D(), def.lon, def.lat, radius * PAD_ALTITUDE);
      pose.scale.setScalar(radius * zoomScale);
      const layout = airportPieces(def.id, def.lon, def.lat, hub);
      const instances: KitInstance[] = [];
      for (const piece of layout.pieces) {
        const entry = kit.get(piece.piece)!;
        if (entry.mesh.count >= entry.capacity) throw new RangeError('Airport kit capacity exceeded: ' + piece.piece);
        const index = entry.mesh.count++;
        entry.mesh.setColorAt(index, color.set(piece.color));
        instances.push({ piece: piece.piece, index, local: piece.local, anchor: piece.anchor });
      }
      const record: AirportRecord = {
        id: def.id, lon: def.lon, lat: def.lat, hub, pose, used: 0, cap: 0, curfew: false,
        instances, anchors: layout.anchors, style: layout.style, landmark: layout.landmark,
      };
      records.set(record.id, record);
      updateModel(record);
      flushModels();
    },
    setHubLoad(id, used, cap): void {
      assertOpen();
      const record = records.get(id);
      if (!record || !record.hub) throw new RangeError('Unknown hub: ' + id);
      if (!Number.isInteger(used) || !Number.isInteger(cap) || cap < 1 || cap > maxHubSeats || used < 0) {
        throw new RangeError('Invalid hub capacity or load');
      }
      const nextUsed = Math.min(used, cap);
      if (record.used === nextUsed && record.cap === cap) return;
      record.used = nextUsed;
      record.cap = cap;
      markersDirty = true;
    },
    setCurfew(id, on): void {
      assertOpen();
      const record = records.get(id);
      if (!record) throw new RangeError('Unknown airport: ' + id);
      if (record.curfew === on) return;
      record.curfew = on;
      markersDirty = true;
    },
    setZoom(zoom): void {
      assertOpen();
      if (!(zoom > 0) || !Number.isFinite(zoom)) throw new RangeError('Invalid zoom');
      // Mockup size at the gameplay zoom (~3.3); larger in the overview so pads stay tappable-looking.
      const nextScale = Math.max(1, Math.min(1.6, 1.8 / Math.sqrt(zoom)));
      if (nextScale === zoomScale) return;
      zoomScale = nextScale;
      for (const record of records.values()) {
        record.pose.scale.setScalar(radius * zoomScale);
        updateModel(record);
      }
      flushModels();
      markersDirty = true;
    },
    has: (id) => records.has(id),
    isHub: (id) => records.get(id)?.hub === true,
    clear(): void {
      assertOpen();
      records.clear();
      for (const { mesh } of kit.values()) mesh.count = 0;
      markersDirty = true;
    },
    update(): void {
      if (!markersDirty || disposed) return;
      markersDirty = false;
      rebuildMarkers();
    },
    getPosition(id, out): Vector3 | null {
      const record = records.get(id);
      return record ? out.copy(record.pose.position) : null;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      for (const { mesh } of kit.values()) { mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose(); mesh.dispose(); }
      ringGeo.dispose(); ringMat.dispose();
      barGeo.dispose(); whiteMat.dispose(); redMat.dispose();
      records.clear();
    },
  };
}
