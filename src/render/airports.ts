// Diorama airport objects. Rendering-only state; no authoritative simulation mutations.
import { UI_SELF_LIGHT } from './models/planes'; // [task-34]
import {
  BoxGeometry, Color, CylinderGeometry, DoubleSide, Group, InstancedMesh,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D,
  Scene, Vector3,
} from 'three';
import { setLatLonVec3 } from './globe/geo-math';

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

/**
 * [ext-03] D-175 variants: `medal` (the owner's pick, D-178; the default through `createWorldRenderer`) is the light
 * diorama pad with a thick dark outline; `current` the pre-D-178 object; `ink` a dark pad with a light runway;
 * `apron` an asphalt apron with a type-coloured rim (the last three only for DEV comparison, `?airportStyle=`).
 */
export type AirportStyle = 'current' | 'ink' | 'apron' | 'medal';

export interface AirportOptions {
  /** [ext-03] D-175 experiment; default `current`. */
  style?: AirportStyle;
  radius?: number;
  maxAirports?: number;
  maxHubSeats?: number;
}

interface AirportRecord {
  id: string;
  lon: number;
  lat: number;
  hub: boolean;
  index: number;
  pose: Object3D;
  used: number;
  cap: number;
  curfew: boolean;
}

type Part = { mesh: InstancedMesh; geometry: BoxGeometry | CylinderGeometry; material: MeshStandardMaterial };

function surfaceMaterial(color: string): MeshStandardMaterial {
  // [task-34] Self-lit share keeps airports readable on the night side (D-47).
  return new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: UI_SELF_LIGHT, flatShading: true, roughness: 0.88 });
}

function block(x: number, y: number, z: number, tx: number, ty: number, tz: number, angle = 0): BoxGeometry {
  return new BoxGeometry(x, y, z).rotateY(angle).translate(tx, ty, tz);
}

/** [ext-03] Pad, runway, centreline, terminal, roof colours per D-175 variant (`current` = shipped). */
const STYLE_COLOURS: Record<AirportStyle, (hub: boolean) => readonly [string, string, string, string, string]> = {
  current: (hub) => ['#EFE9DA', '#3B4046', '#F5F1E6', '#F2EFE6', hub ? '#2A8F8A' : '#C96F4A'],
  ink: (hub) => ['#1F2B2D', '#EDE7D8', '#1F2B2D', '#F2EFE6', hub ? '#37B3A8' : '#F0864E'],
  apron: (hub) => ['#565C61', '#2C3034', '#FFFFFF', '#E9E4D8', hub ? '#2A8F8A' : '#C96F4A'],
  medal: (hub) => ['#F4F0E6', '#3B4046', '#F5F1E6', '#F2EFE6', hub ? '#2A8F8A' : '#C96F4A'],
};

function createParts(group: Group, max: number, hub: boolean, style: AirportStyle = 'current'): Part[] {
  const s = hub ? 1.7 : 1.2;
  const [pad, runway, line, terminal, roof] = STYLE_COLOURS[style](hub);
  const parts: Array<{ geometry: BoxGeometry | CylinderGeometry; color: string }> = [
    { geometry: new CylinderGeometry(.026 * s, .028 * s, .004, 20).translate(0, .001, 0), color: pad },
    { geometry: block(.008 * s, .002, .046 * s, -.008 * s, .004, 0, .5), color: runway },
    { geometry: block(.0012, .0022, .04 * s, -.008 * s, .0054, 0, .5), color: line },
    { geometry: block(.018 * s, .006 * s, .009 * s, .011 * s, .006, .006 * s), color: terminal },
    { geometry: block(.019 * s, .0018, .010 * s, .011 * s, .0095 * s + .002, .006 * s), color: roof },
  ];
  // [ext-03] D-175: a rim under the pad — type-coloured (apron) or a dark outline (medal, ink).
  if (style === 'apron') {
    parts.push({ geometry: new CylinderGeometry(.031 * s, .032 * s, .003, 24).translate(0, .0003, 0), color: hub ? '#2FA39A' : '#E3743E' });
  } else if (style === 'medal' || style === 'ink') {
    parts.push({ geometry: new CylinderGeometry((style === 'medal' ? .037 : .0315) * s, (style === 'medal' ? .038 : .0325) * s, .003, 24)
      .translate(0, .0003, 0), color: style === 'ink' ? '#F4F0E6' : '#1B2427' });
  }
  if (hub) {
    parts.push(
      { geometry: new CylinderGeometry(.0018, .0024, .02, 6).translate(.02, .012, -.012), color: '#F2EFE6' },
      { geometry: new CylinderGeometry(.0042, .003, .004, 8).translate(.02, .023, -.012), color: '#2A8F8A' },
    );
  }
  return parts.map(({ geometry, color }) => {
    const material = surfaceMaterial(color);
    const mesh = new InstancedMesh(geometry, material, max);
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return { mesh, geometry, material };
  });
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
  const regular = createParts(group, maxAirports, false, options.style);
  const hubs = createParts(group, maxAirports, true, options.style);
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
  const byType = [0, 0];
  const scratch = new Object3D();
  const transform = new Matrix4();
  const color = new Color();
  let zoomScale = 1;
  let disposed = false;
  let markersDirty = false;

  function assertOpen(): void { if (disposed) throw new Error('Airport layer is disposed'); }
  function updateModel(record: AirportRecord): void {
    const parts = record.hub ? hubs : regular;
    record.pose.updateMatrix();
    for (const part of parts) {
      part.mesh.setMatrixAt(record.index, record.pose.matrix);
      part.mesh.instanceMatrix.needsUpdate = true;
    }
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
      const type = hub ? 1 : 0;
      const pose = place(new Object3D(), def.lon, def.lat, radius * PAD_ALTITUDE);
      pose.scale.setScalar(radius * zoomScale);
      const index = byType[type]++;
      const parts = hub ? hubs : regular;
      for (const part of parts) part.mesh.count = byType[type];
      const record: AirportRecord = { id: def.id, lon: def.lon, lat: def.lat, hub, index, pose, used: 0, cap: 0, curfew: false };
      records.set(record.id, record);
      updateModel(record);
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
      markersDirty = true;
    },
    has: (id) => records.has(id),
    isHub: (id) => records.get(id)?.hub === true,
    clear(): void {
      assertOpen();
      records.clear();
      byType[0] = 0;
      byType[1] = 0;
      for (const part of [...regular, ...hubs]) part.mesh.count = 0;
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
      for (const part of [...regular, ...hubs]) { part.geometry.dispose(); part.material.dispose(); }
      ringGeo.dispose(); ringMat.dispose();
      barGeo.dispose(); whiteMat.dispose(); redMat.dispose();
      records.clear();
    },
  };
}
