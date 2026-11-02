import * as THREE from 'three';
import type { UpgradeKind } from '../sim/upgrades'; // type-only: render never calls the sim
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
      model.rotation.y = 0.8;
      model.scale.setScalar(1.25);
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
