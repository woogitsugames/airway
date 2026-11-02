/**
 * [task-34] Night readability probe. Renders the frame twice per gameplay layer (with and without
 * it) into the canvas' drawing buffer and compares, pixel by pixel, the layer's colour with the globe
 * behind it (WCAG relative luminance). Diagnostic only: called by `scripts/shots-34.mjs`, never per frame.
 */
import type { Camera, Object3D, Scene, WebGLRenderer } from 'three';

/** WCAG 2.x relative luminance of an 8-bit sRGB colour. */
export function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export interface LayerContrast { readonly ratio: number; readonly pixels: number }
/** CSS-pixel rectangle relative to the canvas' top-left corner. */
export interface PixelRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export function contrastRatio(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Median contrast of the pixels a layer changes. `withLayer`/`without` are RGBA buffers of the same
 * frame; pixels whose colour moved by less than `minDelta` (8-bit, summed RGB) are not the layer.
 * Returns `null` when the layer covers fewer than `minPixels` pixels.
 */
export function layerContrast(
  withLayer: Uint8Array, without: Uint8Array, minDelta = 24, minPixels = 20,
): LayerContrast | null {
  const ratios: number[] = [];
  for (let i = 0; i + 3 < withLayer.length; i += 4) {
    const d = Math.abs(withLayer[i] - without[i]) + Math.abs(withLayer[i + 1] - without[i + 1]) +
      Math.abs(withLayer[i + 2] - without[i + 2]);
    if (d < minDelta) continue;
    ratios.push(contrastRatio(
      relativeLuminance(withLayer[i], withLayer[i + 1], withLayer[i + 2]),
      relativeLuminance(without[i], without[i + 1], without[i + 2]),
    ));
  }
  if (ratios.length < minPixels) return null;
  ratios.sort((x, y) => x - y);
  return { ratio: Math.round(ratios[ratios.length >> 1] * 100) / 100, pixels: ratios.length };
}

function grab(renderer: WebGLRenderer, scene: Scene, camera: Camera, out: Uint8Array): void {
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  // Same task as the draw, so the drawing buffer is still intact without preserveDrawingBuffer.
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, out);
}

/** Median contrast of every named layer against the scene rendered without it. */
export function measureLayerContrast(
  renderer: WebGLRenderer, scene: Scene, camera: Camera, layers: Readonly<Record<string, Object3D>>,
): Record<string, LayerContrast | null> {
  const gl = renderer.getContext();
  const size = gl.drawingBufferWidth * gl.drawingBufferHeight * 4;
  const full = new Uint8Array(size);
  const bare = new Uint8Array(size);
  const result: Record<string, LayerContrast | null> = {};
  for (const [name, object] of Object.entries(layers)) {
    const visible = object.visible;
    // Hide all other layers so overlapping layers do not count against each other.
    const others = Object.values(layers).filter((o) => o !== object).map((o) => [o, o.visible] as const);
    for (const [o] of others) o.visible = false;
    object.visible = true;
    grab(renderer, scene, camera, full);
    object.visible = false;
    grab(renderer, scene, camera, bare);
    object.visible = visible;
    for (const [o, v] of others) o.visible = v;
    result[name] = layerContrast(full, bare);
  }
  renderer.render(scene, camera);
  return result;
}

/** Median luminance of the current frame inside each rect (`cssWidth` maps CSS px to buffer px). */
export function sampleLuminance(
  renderer: WebGLRenderer, scene: Scene, camera: Camera, rects: readonly PixelRect[], cssWidth: number,
): (number | null)[] {
  const gl = renderer.getContext();
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const buffer = new Uint8Array(w * h * 4);
  grab(renderer, scene, camera, buffer);
  const scale = w / Math.max(1, cssWidth);
  return rects.map((rect) => {
    const values: number[] = [];
    const x0 = Math.max(0, Math.floor(rect.x * scale));
    const x1 = Math.min(w, Math.ceil((rect.x + rect.width) * scale));
    // Canvas rows run top-down, GL rows bottom-up.
    const y0 = Math.max(0, Math.floor(rect.y * scale));
    const y1 = Math.min(h, Math.ceil((rect.y + rect.height) * scale));
    for (let y = y0; y < y1; y++) {
      const row = (h - 1 - y) * w;
      for (let x = x0; x < x1; x++) {
        const i = (row + x) * 4;
        values.push(relativeLuminance(buffer[i], buffer[i + 1], buffer[i + 2]));
      }
    }
    if (!values.length) return null;
    values.sort((a, b) => a - b);
    return values[values.length >> 1];
  });
}
