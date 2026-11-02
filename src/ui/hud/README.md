# HUD adapter (task 13)

`mountHud(gameSurface, actions)` creates one fixed DOM layer over the game canvas.
Call `controller.render(snapshot)` after each **authoritative** state change and
`controller.destroy()` when leaving gameplay. Rendering the same snapshot again
leaves existing text nodes and button elements intact.

`HudState` is a readonly, game-agnostic projection of the simulation snapshot:
week (1-based), day of the week (1..DAYS_PER_WEEK = 3, D-40; shown as "N/3"), minutes since midnight, served
passengers, pause, 1x/2x/4x speed, command undo availability, selected plane,
and inventory of turboprops / widebodies / hub upgrades.

No HUD callback directly modifies game state. The composition root translates
`onSelectPlane`, `onUndo`, `onTogglePause`, `onCycleSpeed`, `onUpgradeHub` and
`onAssignPlane(type, routeId)` into validated game commands. A press selects a
plane; a drag beyond 8 px, released over a route, emits `onAssignPlane`.
`routeAtPoint(x, y)` is the preferred input/renderer bridge; an element with
`data-route-id` under the pointer works as a fallback for HTML/SVG routes.

The HUD does **not** own airport queues or bubbles (task 06), hit testing of
Three.js arcs (tasks 07/09), simulation speed changes or an actual undo stack.
It intentionally has no fake production state wired to `src/main.ts`; the
composition root in a follow-on task mounts it when a game snapshot is ready.
The Playwright harness mounts an explicit deterministic preview state for QA.

CSS uses `env(safe-area-inset-*)`; `--hud-safe-{top,right,bottom,left}` variables
can be overridden in browser automation to simulate notches. The layout
observer only updates `data-layout` when crossing portrait / landscape /
foldable breakpoints (both dimensions >= 600dp for foldables).
