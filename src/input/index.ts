// [task-04] Export the standalone pointer recognizer and the camera adapter.
export { attachPointerGestures, GestureRecognizer } from './gestures';
export type { GestureCallbacks, GestureHit, GestureMode, GesturePointerSample, AttachedGestures } from './gestures';
import type { GlobeOrbitCamera } from '../render/camera';
import type { GestureCallbacks } from './gestures';

/** Compose this with the globe's city/route hit tests in src/game (task 07). */
export function cameraGestureCallbacks(
  orbit: GlobeOrbitCamera,
  callbacks: Pick<GestureCallbacks, 'hitTest'> & Partial<GestureCallbacks>,
): GestureCallbacks {
  return {
    ...callbacks,
    onRotate: (dx, dy, dt) => { orbit.rotatePixels(dx, dy, dt); callbacks.onRotate?.(dx, dy, dt); },
    onZoom: (factor, x, y) => { orbit.zoomBy(factor); callbacks.onZoom?.(factor, x, y); },
    onInteractionChange: (active, inertia) => {
      if (active) orbit.beginInteraction();
      else orbit.endInteraction(inertia);
      callbacks.onInteractionChange?.(active, inertia);
    },
    getLimbEdgeFactor: (x, y) => callbacks.getLimbEdgeFactor?.(x, y) ?? orbit.getLimbEdgeFactor(x, y),
    onEdgeRotate: (degrees) => { orbit.rotateAtLimb(degrees); callbacks.onEdgeRotate?.(degrees); },
  };
}
