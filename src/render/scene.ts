// Own the three.js scene, GPU canvas, and viewport resizing without game simulation.
import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

const DIORAMA_SKY = '#8CC3D8';

export function mountEmptyScene(host: HTMLElement): {
  canvas: HTMLCanvasElement;
  dispose: () => void;
} {
  const scene = new Scene();
  scene.background = new Color(DIORAMA_SKY);
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 2;

  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  host.appendChild(canvas);

  const resize = (): void => {
    const width = Math.max(1, host.clientWidth || window.innerWidth);
    const height = Math.max(1, host.clientHeight || window.innerHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(host);
  window.addEventListener('resize', resize);
  resize();

  return {
    canvas,
    dispose: () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      renderer.dispose();
      canvas.remove();
    },
  };
}
