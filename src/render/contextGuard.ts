// [night-11h] R3g, D-118: WebGL context loss. A phone drops the GPU context under memory pressure, after a driver reset
// or when another app takes the GPU; without handling the globe froze on its last frame (or went black) while the run
// kept going underneath. The guard keeps the "lost" state, lets the browser restore the context (preventDefault),
// and tells its listeners both ways. No three.js import, so `test:webgl-context` runs it under Node.
export interface ContextEventTarget {
  addEventListener(type: string, listener: (event: Event) => void, options?: boolean): void;
  removeEventListener(type: string, listener: (event: Event) => void, options?: boolean): void;
}
export interface ContextGuard {
  /** True from `webglcontextlost` until `webglcontextrestored`. */
  lost(): boolean;
  /** Called with `true` on loss and `false` after a restore (after `onRestored`). */
  onChange(listener: (lost: boolean) => void): () => void;
  dispose(): void;
}

export function createContextGuard(target: ContextEventTarget, onRestored?: () => void): ContextGuard {
  let isLost = false;
  let disposed = false;
  const listeners = new Set<(lost: boolean) => void>();
  const tell = (value: boolean): void => { listeners.forEach((listener) => listener(value)); };
  const lostListener = (event: Event): void => {
    event.preventDefault(); // without it the browser never fires webglcontextrestored
    if (disposed || isLost) return;
    isLost = true;
    tell(true);
  };
  const restoredListener = (): void => {
    if (disposed || !isLost) return;
    isLost = false;
    onRestored?.();
    tell(false);
  };
  target.addEventListener('webglcontextlost', lostListener, false);
  target.addEventListener('webglcontextrestored', restoredListener, false);
  return {
    lost: () => isLost,
    onChange(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      target.removeEventListener('webglcontextlost', lostListener, false);
      target.removeEventListener('webglcontextrestored', restoredListener, false);
    },
  };
}

interface GlLike {
  getParameter(name: number): unknown;
  getExtension(name: string): unknown;
}
interface CanvasLike { getContext(kind: string): unknown }
const GL_RENDERER = 0x1F01;
const UNMASKED_RENDERER_WEBGL = 0x9246;

/** The renderer string a player can quote in a support mail ("unknown" when no context or no answer). */
export function gpuRendererString(createCanvas: () => CanvasLike): string {
  for (const kind of ['webgl2', 'webgl', 'experimental-webgl']) {
    let gl: GlLike | null = null;
    try { gl = createCanvas().getContext(kind) as GlLike | null; } catch { gl = null; }
    if (!gl) continue;
    try {
      const unmasked = gl.getExtension('WEBGL_debug_renderer_info') ? gl.getParameter(UNMASKED_RENDERER_WEBGL) : null;
      const value = typeof unmasked === 'string' && unmasked.trim() ? unmasked : gl.getParameter(GL_RENDERER);
      release(gl);
      if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160);
    } catch { /* fall through to the next kind */ }
  }
  return 'unknown';
}

/** The probe context is released at once (a page has a small budget of live contexts). */
function release(gl: GlLike): void {
  try { (gl.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null)?.loseContext?.(); } catch { /* best effort */ }
}

/** Whether this browser can create the WebGL 2 context three.js r170 needs. */
export function webgl2Available(createCanvas: () => CanvasLike): boolean {
  try {
    const gl = createCanvas().getContext('webgl2') as GlLike | null;
    if (gl) release(gl);
    return !!gl;
  } catch {
    return false;
  }
}
