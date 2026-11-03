/** Procedural low-poly aircraft derived from the selected Diorama mockup. */
import {
  BoxGeometry, BufferGeometry, CylinderGeometry, ConeGeometry, DynamicDrawUsage,
  ExtrudeGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4,
  MeshStandardMaterial, Shape,
} from 'three';
import type { AircraftKind } from '../routes';

interface Part {
  geometry: BufferGeometry;
  position?: readonly [number, number, number];
}

export interface InstancedPlaneModel {
  readonly group: Group;
  readonly meshes: readonly InstancedMesh[];
  readonly trianglesPerPlane: number;
  readonly capacity: number;
  setMatrix(index: number, matrix: Matrix4): void;
  setCount(count: number): void;
  finishFrame(): void;
  dispose(): void;
}

function unite(parts: readonly Part[]): BufferGeometry {
  let count = 0;
  const normalized: BufferGeometry[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.position) part.geometry.translate(...part.position);
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    normalized.push(geometry);
    count += geometry.getAttribute('position').count;
  }
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  let offset = 0;
  for (let i = 0; i < normalized.length; i++) {
    const geo = normalized[i];
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    for (let j = 0; j < p.count * 3; j++) {
      positions[offset + j] = p.array[j] as number;
      normals[offset + j] = n.array[j] as number;
    }
    offset += p.count * 3;
  }
  for (let i = 0; i < normalized.length; i++) normalized[i].dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** [task-34] Emissive share of gameplay materials (planes, airports, routes); lighting-independent floor. */
export const UI_SELF_LIGHT = 0.5;

function standard(color: string): MeshStandardMaterial {
  // [task-34] Self-lit share keeps planes readable on the night side (D-47).
  return new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: UI_SELF_LIGHT, flatShading: true, roughness: 0.6 });
}

function wingWidebody(): BufferGeometry {
  const wing = new Shape();
  wing.moveTo(0, 0.12);
  wing.lineTo(0.9, -0.32);
  wing.lineTo(0.9, -0.44);
  wing.lineTo(0, -0.18);
  wing.lineTo(-0.9, -0.44);
  wing.lineTo(-0.9, -0.32);
  wing.closePath();
  return new ExtrudeGeometry(wing, { depth: 0.03, bevelEnabled: false }).rotateX(Math.PI / 2);
}

/** Three shared instanced draw calls per type, not one draw call per airplane. */
export function createInstancedPlaneModel(type: AircraftKind, capacity: number): InstancedPlaneModel {
  const wide = type === 'widebody';
  const L = wide ? 1.5 : 1;
  const white: Part[] = [
    { geometry: new CylinderGeometry(0.06 * L, 0.05 * L, L, 8).rotateX(Math.PI / 2) },
    { geometry: new ConeGeometry(0.06 * L, 0.16 * L, 8).rotateX(Math.PI / 2), position: [0, 0, 0.58 * L] },
  ];
  const colored: Part[] = [];
  const dark: Part[] = [];
  if (wide) {
    white.push({ geometry: wingWidebody(), position: [0, -0.01, 0] });
    white.push({ geometry: new BoxGeometry(0.6, 0.02, 0.14), position: [0, 0.02, -0.66] });
    for (const x of [-0.55, -0.3, 0.3, 0.55]) {
      dark.push({ geometry: new CylinderGeometry(0.045, 0.045, 0.16, 8).rotateX(Math.PI / 2),
        position: [x, -0.05, Math.abs(x) * -0.45 + 0.08] });
    }
    const tail = new BoxGeometry(0.03, 0.34, 0.26);
    tail.rotateX(-0.35);
    colored.push({ geometry: tail, position: [0, 0.2, -0.62] });
    // [M1] Livery: a cheat line along both sides in the tail colour (no registration, no numbers).
    for (const x of [-0.088, 0.088]) colored.push({ geometry: new BoxGeometry(0.012, 0.03, 1.12), position: [x, 0.012, -0.02] });
  } else {
    white.push({ geometry: new BoxGeometry(1.5, 0.03, 0.16), position: [0, 0.06, 0.08] });
    colored.push({ geometry: new BoxGeometry(0.03, 0.3, 0.2), position: [0, 0.16, -0.42] });
    colored.push({ geometry: new BoxGeometry(0.5, 0.02, 0.12), position: [0, 0.3, -0.45] });
    // [M1] Livery: cheat line in the tail colour along both sides of the fuselage.
    for (const x of [-0.058, 0.058]) colored.push({ geometry: new BoxGeometry(0.01, 0.022, 0.74), position: [x, 0.006, -0.02] });
    for (const x of [-0.32, 0.32]) {
      colored.push({ geometry: new CylinderGeometry(0.05, 0.05, 0.22, 8).rotateX(Math.PI / 2),
        position: [x, 0.03, 0.16] });
      // Two unmistakable low-poly propeller blades instead of a translucent disc.
      dark.push({ geometry: new BoxGeometry(0.035, 0.32, 0.014), position: [x, 0.03, 0.28] });
    }
  }
  // [M1] Dark windscreen band on the nose (reads as a cockpit, not a flight number).
  dark.push({ geometry: new BoxGeometry(0.1 * L, 0.03 * L, 0.06 * L), position: [0, 0.045 * L, 0.44 * L] });
  const geometries = [unite(white), unite(colored), unite(dark)];
  const materials = [standard('#f7f5ee'), standard(wide ? '#e2553b' : '#2a8f8a'), standard('#2a2f35')];
  const group = new Group();
  const meshes: InstancedMesh[] = [];
  let trianglesPerPlane = 0;
  for (let i = 0; i < geometries.length; i++) {
    const mesh = new InstancedMesh(geometries[i], materials[i], capacity);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    meshes.push(mesh);
    group.add(mesh);
    trianglesPerPlane += geometries[i].getAttribute('position').count / 3;
  }
  return {
    group, meshes, capacity, trianglesPerPlane,
    setMatrix(index, matrix) {
      for (let i = 0; i < meshes.length; i++) meshes[i].setMatrixAt(index, matrix);
    },
    setCount(count) {
      for (let i = 0; i < meshes.length; i++) meshes[i].count = count;
    },
    finishFrame() {
      for (let i = 0; i < meshes.length; i++) meshes[i].instanceMatrix.needsUpdate = true;
    },
    dispose() {
      for (let i = 0; i < meshes.length; i++) meshes[i].dispose();
      for (let i = 0; i < geometries.length; i++) geometries[i].dispose();
      for (let i = 0; i < materials.length; i++) materials[i].dispose();
      group.clear();
    },
  };
}
