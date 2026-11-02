/**
 * [task-34] Camera framing from the live layout. The HUD and the menu are HTML; their boxes decide
 * how much of the canvas the globe may use, so camera insets are measured, never hard-coded.
 * Pure functions (no DOM, no three.js) so `test:render-layers` checks them headless.
 */
import type { SafeAreaInsets } from './camera';

/** A box in CSS pixels relative to the canvas' top-left corner (DOMRect-compatible). */
export interface LayoutRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

type Edge = 'top' | 'right' | 'bottom' | 'left';

/** Gap kept between an HTML panel and the globe framing, in CSS px. */
export const FRAMING_GAP = 8;

/**
 * Turn panel boxes into per-edge insets. Each box is attributed to the viewport edge whose inset
 * costs the least free area (a top bar → top, a right rail → right, a bottom dock → bottom). The
 * result is the larger of the measured and the `base` (safe-area) insets per edge.
 */
export function insetsFromLayout(
  width: number, height: number, rects: readonly LayoutRect[], base: SafeAreaInsets = {}, gap = FRAMING_GAP,
): Required<SafeAreaInsets> {
  const out = { top: base.top ?? 0, right: base.right ?? 0, bottom: base.bottom ?? 0, left: base.left ?? 0 };
  if (!(width > 0) || !(height > 0)) return out;
  for (const rect of rects) {
    const left = Math.max(0, rect.left);
    const right = Math.min(width, rect.right);
    const top = Math.max(0, rect.top);
    const bottom = Math.min(height, rect.bottom);
    if (right - left < 1 || bottom - top < 1) continue; // hidden or off-screen
    const cost: Record<Edge, number> = {
      top: (bottom + gap) / height,
      bottom: (height - top + gap) / height,
      left: (right + gap) / width,
      right: (width - left + gap) / width,
    };
    let edge: Edge = 'top';
    for (const candidate of ['right', 'bottom', 'left'] as const) if (cost[candidate] < cost[edge]) edge = candidate;
    const inset = edge === 'top' ? bottom + gap : edge === 'bottom' ? height - top + gap
      : edge === 'left' ? right + gap : width - left + gap;
    out[edge] = Math.max(out[edge], Math.round(inset));
  }
  return out;
}

export interface MenuFraming {
  /** `horizon`: a giant globe whose curved horizon sits under the sign (portrait, mockup menu-p);
   * `disc`: the whole globe beside the departures board (landscape, mockup menu-l). */
  readonly mode: 'horizon' | 'disc';
  readonly insets: Required<SafeAreaInsets>;
  /** Wanted screen y of the top of the globe's limb (horizon mode only). */
  readonly horizonY: number;
  /** Wanted screen radius of the globe in horizon mode (0 in disc mode: fit the free area). */
  readonly radius: number;
}

/** Share of the free band between sign and board that stays sky above the horizon (mockup: 0.18). */
export const MENU_SKY_SHARE = 0.18;

/** Menu framing from the sign (title) and departures-board boxes. */
export function menuFraming(
  width: number, height: number, sign: LayoutRect | null, board: LayoutRect | null, base: SafeAreaInsets = {},
): MenuFraming {
  const boardBeside = board !== null && board.right - board.left < width * 0.6 && width > height;
  if (boardBeside && board) {
    // Landscape: the board column is the left inset; the whole disc stands in the remaining sky.
    const insets = insetsFromLayout(width, height, [], { ...base, left: Math.max(base.left ?? 0, board.right + 16) });
    insets.top = Math.max(insets.top, Math.round(height * 0.04));
    insets.bottom = Math.max(insets.bottom, Math.round(height * 0.04));
    return { mode: 'disc', insets, horizonY: insets.top, radius: 0 };
  }
  const top = Math.max(base.top ?? 0, sign ? sign.bottom : height * 0.12);
  const boardTop = board ? board.top : height * 0.65;
  const insets = {
    top: Math.round(top), left: base.left ?? 0, right: base.right ?? 0,
    bottom: Math.round(Math.max(base.bottom ?? 0, height - boardTop)),
  };
  const free = Math.max(1, height - insets.top - insets.bottom);
  const horizonY = insets.top + free * MENU_SKY_SHARE;
  // Mockup: the globe is wider than the phone and its centre sits near the top of the board.
  const radius = Math.max(width * 0.92, boardTop - horizonY);
  return { mode: 'horizon', insets, horizonY, radius };
}

/**
 * Zoom in [lo, hi] at which the increasing function `radiusAt(zoom)` (the globe's screen radius)
 * reaches `target`; clamped to the range; bisection, 24 steps.
 */
export function solveZoomForRadius(radiusAt: (zoom: number) => number, target: number, lo = 1, hi = 4): number {
  if (radiusAt(lo) >= target) return lo;
  if (radiusAt(hi) <= target) return hi;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (radiusAt(mid) < target) lo = mid; else hi = mid;
  }
  return hi;
}

/** [task-39] D-62: the menu globe turns slowly, about 1.2° per second (camera orbit; routes stay on their cities). */
export const MENU_SPIN_DEG_PER_S = 1.2;

/** [task-39] Menu rotation rate: 0 outside the menu, while it is hidden, or with reduced motion. */
export function menuSpinRate(state: {
  readonly menuActive: boolean; readonly menuShown: boolean; readonly reducedMotion: boolean; readonly hidden?: boolean;
}): number {
  if (!state.menuActive || !state.menuShown || state.reducedMotion || state.hidden) return 0;
  return MENU_SPIN_DEG_PER_S;
}
