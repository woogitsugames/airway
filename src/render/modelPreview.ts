import * as THREE from 'three';
import type { UpgradeKind } from '../sim/upgrades'; // type-only: render never calls the sim
/**
 * Small procedural meshes for the model window; no network assets or simulation dependencies.
 * [task-35] Shapes ported from the Diorama mockup (mockups/diorama/scene3d.js planeModel/airport): high-wing
 * turboprop with props and a T-tail, swept widebody with four engines, hub = runway + terminal + tower,
 * departure slots = two parallel runways with hold bars. Pale pedestal as on the mockup.
 */
export function renderModel(kind: UpgradeKind): THREE.Group {
  const group = new THREE.Group();
  const mat = (color: string) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
  const white = mat('#f7f5ee');
  const dark = mat('#2a2f35');
  const teal = mat('#2a8f8a');
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const base = add(new THREE.CylinderGeometry(1.25, 1.3, 0.08, 40), mat('#d9d3c3'), 0, -0.36, 0);
  base.name = 'pedestal';
  if (kind === 'turboprop' || kind === 'widebody') {
    const plane = new THREE.Group();
    const L = kind === 'widebody' ? 1.5 : 1;
    const tail = kind === 'widebody' ? mat('#e2553b') : teal;
    plane.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06 * L, 0.05 * L, L, 8).rotateX(Math.PI / 2), white));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06 * L, 0.16 * L, 8).rotateX(Math.PI / 2), white);
    nose.position.z = 0.58 * L; plane.add(nose);
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); plane.add(mesh); return mesh;
    };
    if (kind === 'widebody') {
      const wing = new THREE.Shape();
      wing.moveTo(0, 0.12); wing.lineTo(0.9, -0.32); wing.lineTo(0.9, -0.44); wing.lineTo(0, -0.18);
      wing.lineTo(-0.9, -0.44); wing.lineTo(-0.9, -0.32); wing.closePath();
      part(new THREE.ExtrudeGeometry(wing, { depth: 0.03, bevelEnabled: false }).rotateX(Math.PI / 2), white, 0, -0.01, 0);
      for (const x of [-0.55, -0.3, 0.3, 0.55]) {
        part(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8).rotateX(Math.PI / 2), dark, x, -0.05, Math.abs(x) * -0.45 + 0.08);
      }
      part(new THREE.BoxGeometry(0.03, 0.34, 0.26), tail, 0, 0.2, -0.62).rotation.x = -0.35;
      part(new THREE.BoxGeometry(0.6, 0.02, 0.14), white, 0, 0.02, -0.66);
      plane.scale.setScalar(0.75);
    } else {
      part(new THREE.BoxGeometry(1.5, 0.03, 0.16), white, 0, 0.06, 0.08);
      const disc = new THREE.MeshStandardMaterial({ color: '#2a2f35', transparent: true, opacity: 0.45 });
      for (const x of [-0.32, 0.32]) {
        part(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8).rotateX(Math.PI / 2), tail, x, 0.03, 0.16);
        part(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 16).rotateX(Math.PI / 2), disc, x, 0.03, 0.28);
      }
      part(new THREE.BoxGeometry(0.03, 0.3, 0.2), tail, 0, 0.16, -0.42);
      part(new THREE.BoxGeometry(0.5, 0.02, 0.12), tail, 0, 0.3, -0.45);
    }
    group.add(plane);
  } else {
    const apron = mat('#efe9da');
    add(new THREE.CylinderGeometry(0.78, 0.8, 0.04, 28), apron, 0, -0.3, 0);
    const runway = (x: number) => {
      add(new THREE.BoxGeometry(0.2, 0.03, 1.3), mat('#3b4046'), x, -0.27, 0);
      add(new THREE.BoxGeometry(0.025, 0.032, 1.1), mat('#f5f1e6'), x, -0.268, 0);
    };
    if (kind === 'hub-expansion') {
      runway(-0.32);
      add(new THREE.BoxGeometry(0.62, 0.2, 0.32), mat('#f2efe6'), 0.3, -0.18, 0.16);
      add(new THREE.BoxGeometry(0.66, 0.05, 0.36), teal, 0.3, -0.06, 0.16);
      add(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 6), mat('#f2efe6'), 0.42, -0.07, -0.34);
      add(new THREE.CylinderGeometry(0.09, 0.06, 0.08, 8), teal, 0.42, 0.17, -0.34);
    } else {
      // Two runways, each with a yellow hold bar: more departures per hour.
      runway(-0.2); runway(0.2);
      const hold = mat('#ffc72c');
      add(new THREE.BoxGeometry(0.24, 0.036, 0.05), hold, -0.2, -0.265, 0.5);
      add(new THREE.BoxGeometry(0.24, 0.036, 0.05), hold, 0.2, -0.265, 0.5);
    }
  }
  return group;
}

/**
 * Draws a model on a pedestal into a 2D canvas using the world's WebGLRenderer
 * (one WebGL context for the whole game; upgrade cards get a still image).
 */
export interface ModelPreviewRenderer {
  draw(kind: UpgradeKind, target: HTMLCanvasElement): boolean;
  dispose(): void;
}

export function createModelPreviewRenderer(renderer: THREE.WebGLRenderer): ModelPreviewRenderer {
  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight('#fff4e0', 3);
  key.position.set(2, 4, 3);
  scene.add(key, new THREE.HemisphereLight('#cfe3ff', '#3a3f4a', 0.9));
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  camera.position.set(0, 2.1, 4.6);
  camera.lookAt(0, -0.15, 0);
  let target: THREE.WebGLRenderTarget | null = null;
  let pixels = new Uint8Array(0);
  const clear = new THREE.Color();
  return {
    draw(kind, canvas) {
      const width = Math.max(1, canvas.width);
      const height = Math.max(1, canvas.height);
      const context = canvas.getContext('2d');
      if (!context) return false;
      if (!target || target.width !== width || target.height !== height) {
        target?.dispose();
        target = new THREE.WebGLRenderTarget(width, height, { colorSpace: THREE.SRGBColorSpace });
        pixels = new Uint8Array(width * height * 4);
      }
      const model = renderModel(kind);
      model.rotation.y = kind === 'hub-expansion' ? 0.4 : 0.7; // [task-35] mockup framing
      model.scale.setScalar(1);
      scene.add(model);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const previousTarget = renderer.getRenderTarget();
      const previousAlpha = renderer.getClearAlpha();
      renderer.getClearColor(clear);
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(clear, previousAlpha);
      scene.remove(model);
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
      // WebGL rows are bottom-up; ImageData is top-down.
      const image = context.createImageData(width, height);
      const row = width * 4;
      for (let y = 0; y < height; y++) {
        image.data.set(pixels.subarray((height - 1 - y) * row, (height - y) * row), y * row);
      }
      context.putImageData(image, 0, 0);
      return true;
    },
    dispose() {
      target?.dispose();
      target = null;
      scene.clear();
    },
  };
}
