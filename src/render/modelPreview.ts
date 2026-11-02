import * as THREE from 'three';
import type { UpgradeKind } from '../sim/upgrades';
/** Small procedural meshes for the model window; no network assets or simulation dependencies. */
export function renderModel(kind: UpgradeKind): THREE.Group {
  const group = new THREE.Group();
  const cargo = new THREE.MeshStandardMaterial({ color: 0xf5eee2, flatShading: true });
  const accent = new THREE.MeshStandardMaterial({ color: kind === 'widebody' ? 0xc8352a : 0x1e6f6a, flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.95, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x9e7f53 }));
  base.position.y = -0.45; group.add(base);
  if (kind === 'hub-expansion') {
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 0.48), cargo);
    terminal.position.y = -0.17; group.add(terminal);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.09, 0.6), accent);
    roof.position.y = 0.06; group.add(roof);
  } else if (kind === 'departure-slots') {
    for (let i = 0; i < 2; i++) {
      const runway = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 1.12), accent);
      runway.position.set(i ? 0.27 : -0.27, -0.34, 0); group.add(runway);
    }
  } else {
    const length = kind === 'widebody' ? 1.5 : 1.12;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, length, 8), cargo);
    body.rotation.x = Math.PI / 2; body.position.y = -0.05; group.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(kind === 'widebody' ? 1.7 : 1.25, 0.035, 0.18), cargo);
    wing.position.y = -0.04; group.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.23, 0.22), accent);
    tail.position.set(0, 0.08, -length / 2 + 0.09); group.add(tail);
  }
  return group;
}
