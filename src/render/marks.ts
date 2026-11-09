// [night-82a R6] D-337: what is left of the D-283 print's pure data (formerly in `globe/`) once the print is
// gone: sizes and rules the world objects, the overlay and the session share. Pure data and math, no three.js, so the
// UI and the headless tests import it without the renderer.

/**
 * The airport box the overlay anchors a sign to before the renderer has measured one (`projectAirport` reports the
 * drawn point's half size once the object layers are up; the DEV stub world always uses this box), CSS px, side.
 */
export const STAMP_SIZE_PX = { airport: 22, hub: 30 } as const;

/**
 * [ext-04] D-88: the jam countdown arc's share of the grace period left. With reduce motion the arc steps once per
 * game second (whole seconds left, rounded up like the "0:42" text) instead of shrinking every tick.
 */
export function jamArcShare(ticksLeft: number | null, graceTicks: number, ticksPerSecond: number, reduced: boolean): number | null {
  if (ticksLeft === null || !(graceTicks > 0)) return null;
  const left = reduced ? Math.ceil(ticksLeft / ticksPerSecond) * ticksPerSecond : ticksLeft;
  return Math.max(0, Math.min(1, left / graceTicks));
}

/**
 * [ext-04] D-309: points, the jam zone and planes keep their CSS size on the game globe and shrink with a small disc
 * (the menu globe): scale = disc radius / 320 px, 0.55…1.
 */
export const OBJECT_SCALE_FULL_RADIUS_PX = 320;
export const OBJECT_SCALE_MIN = 0.55;
export function objectScale(discRadiusCss: number): number {
  return Math.max(OBJECT_SCALE_MIN, Math.min(1, discRadiusCss / OBJECT_SCALE_FULL_RADIUS_PX));
}
