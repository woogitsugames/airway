# Camera and pointer integration (task 04)

The globe renderer (task 03) is not on `dev` yet. The input module is independent of its geometry and does not mutate simulation state.

Wire at the game composition root after `createGlobe(...)` creates a `PerspectiveCamera`:

```ts
const orbit = new GlobeOrbitCamera(perspectiveCamera, { latitude: 49, longitude: 14 });
const attached = attachPointerGestures(canvas, cameraGestureCallbacks(orbit, {
  hitTest(x, y, radiusDp) {
    // Project city centres to CSS pixels and accept distance <= radiusDp.
    // Next, check any 48 dp route handle and route body.
    return { kind: 'empty' };
  },
  onRouteStart: (hit, x, y) => routeTool.start(hit, x, y),
  onRouteMove: (x, y) => routeTool.move(x, y),
  onRouteEnd: (x, y) => routeTool.end(x, y),
  onRouteCancel: () => routeTool.cancel(),
  onContextMenu: (hit, x, y) => routeTool.openContext(hit, x, y),
  onDoubleTap: (hit) => {
    // When `hit.kind === 'city'`, centre the camera on that city's coordinates.
  },
}));

function resize(width: number, height: number, safeTop: number, dockBottom: number): void {
  orbit.setViewport(width, height, { top: safeTop, bottom: dockBottom });
  renderer.setPixelRatio(clampCameraDpr(window.devicePixelRatio));
}

function frame(dtSeconds: number): void {
  orbit.update(dtSeconds);
  renderer.render(scene, perspectiveCamera);
}

// The future HUD's 48+ dp Fit action calls orbit.fitNetwork(cityCoordinates).
// Dispose via attached.dispose() when the canvas is destroyed.
```

The bridge never scales gesture coordinates by DPR. `getLimbEdgeFactor()` provides a default globe-silhouette 40 dp band; the route tool may replace it with an exact globe-picking callback. Edge rotation never carries inertia. The far side of a 3D globe cannot be visible in the same frame; Fit recentres on the spherical mean and reveals the entire visible globe disk.

No game strings or buttons are created here: task 07 owns routes and task 13 owns Fit UI. When task 03 is merged, attach this controller to its actual camera and replace the placeholder hit test.
