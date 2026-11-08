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

/** [night-79a R4] Air (px) between the top of the menu globe frame (under the tagline) and the globe's limb. */
export const GLOBE_FRAME_GAP = 8;
/** [night-79a R4] Largest share of the disc's diameter that may stand behind the board (mockup ui-a-menu: ~0.2). */
export const GLOBE_FRAME_HIDDEN_MAX = 0.3;
/** [night-79a R4] Smallest radius (px) of a disc in the frame; a shorter frame shows the horizon instead. */
export const GLOBE_FRAME_DISC_MIN = 72;

/** [night-79a R4] The menu globe framed to the board skin's `[data-globe-frame="menu"]` box. */
export interface GlobeFrameFraming extends MenuFraming {
  readonly mode: 'horizon';
  /** `disc`: the disc stands in the frame (at most GLOBE_FRAME_HIDDEN_MAX of it behind the board or the screen's
   * bottom edge); `cap`: the frame is too short, only the top of a disc as wide as the board shows (the horizon). */
  readonly kind: 'disc' | 'cap';
  /** Screen y where the menu network's latitude should sit: the middle of the globe's visible part. */
  readonly anchorY: number;
}

/**
 * [night-79a R4] D-334 (PLAN-NOWY-KIERUNEK.md step R4; replaces D-286's `indexFraming` for the UI-A menu): the night
 * globe framed to the departures board's globe box `frame` (between the tagline and the board in portrait, left of
 * the board in landscape). `cover` is the opaque board under the frame (portrait), `null` when nothing is under it
 * (landscape: the screen's bottom edge cuts the disc, like a horizon). Rules, in order:
 * - the disc is centred on the frame's column and never wider than it (the board's edges in portrait);
 * - its limb starts GLOBE_FRAME_GAP under the frame's top (or the whole disc is centred when it fits);
 * - at most GLOBE_FRAME_HIDDEN_MAX of its diameter goes under `cover`/the bottom edge, and the part under `cover` is
 *   always inside the board's width (no sliver of globe beside or under the board);
 * - a frame too short for a disc of GLOBE_FRAME_DISC_MIN (320×568, 360×640) shows the top of a disc as wide as the
 *   board instead (`cap`), hidden behind the board below the frame.
 * Pure: the caller (src/game/world.ts) measures the boxes and solves the zoom, the view shift and the tilt.
 */
export function globeFrameFraming(
  width: number, height: number, frame: LayoutRect, cover: LayoutRect | null, base: SafeAreaInsets = {},
): GlobeFrameFraming {
  const top = Math.max(base.top ?? 0, frame.top) + GLOBE_FRAME_GAP;
  const bottomEdge = height - (base.bottom ?? 0);
  const coverTop = Math.min(bottomEdge, cover ? cover.top : bottomEdge);
  const visible = Math.max(1, coverTop - top);
  const centerX = (frame.left + frame.right) / 2;
  const half = Math.max(1, (frame.right - frame.left) / 2);
  // Half-width the cover hides around the column's centre (no cover: the screen edge hides everything below it).
  const pad = cover ? Math.max(0, Math.min(centerX - cover.left, cover.right - centerX)) : Infinity;
  // Largest radius whose part under `coverTop` stays inside the cover's width: a centre above the cover needs the
  // chord at coverTop within `pad` (2·h·r − h² ≤ pad²), a centre under it needs r ≤ pad.
  // ... and the disc's foot stays above the cover's bottom (nothing shows under the board either).
  const chordMax = pad === Infinity ? Infinity
    : Math.min(pad > visible ? pad : (pad * pad + visible * visible) / (2 * visible), (cover!.bottom - top) / 2);
  let radius = Math.min(half, visible / (2 * (1 - GLOBE_FRAME_HIDDEN_MAX)), chordMax);
  let kind: 'disc' | 'cap' = 'disc';
  if (radius < GLOBE_FRAME_DISC_MIN) {
    kind = 'cap';
    radius = Math.min(half, chordMax);
  }
  radius = Math.max(1, Math.floor(radius));
  const horizonY = kind === 'disc' && 2 * radius <= visible ? top + (visible - 2 * radius) / 2 : top;
  const visibleBottom = Math.min(horizonY + 2 * radius, coverTop);
  const insets = {
    top: Math.round(Math.max(base.top ?? 0, frame.top)),
    left: Math.round(Math.max(base.left ?? 0, frame.left)),
    right: Math.round(Math.max(base.right ?? 0, width - frame.right)),
    bottom: Math.round(Math.max(base.bottom ?? 0, height - coverTop)),
  };
  return { mode: 'horizon', kind, insets, horizonY, radius, anchorY: (horizonY + visibleBottom) / 2 };
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
