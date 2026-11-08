/**
 * [night-16a] D-262: the Róża menu entries (the board's flights on the western arc of the compass rose, roza.ts) must
 * never stand on a medallion of the decorative network behind the menu (src/render/menuNetwork.ts: London, Madrid,
 * Dakar...). D-259 tilted the menu view 16° south so the network rides above the entries; on a short phone Dakar still
 * sat under "Ustawienia" (store shot menu-phone, 360×640). The view now looks as much further south as it takes (up to
 * MENU_TILT_MAX) for every demo airport to clear every entry at every turn of the slow menu spin. Pure: no DOM, no
 * three.js; src/game/world.ts hands in the projection.
 */

export interface ClearRect { left: number; top: number; right: number; bottom: number }
export interface ClearPoint { x: number; y: number; visible: boolean }

/** Clearance in px between a demo airport's centre and a menu entry: the medallion (~14 px on a phone) and a margin. */
export const MENU_CLEAR_PX = 22;
/** Degrees south of the menu target D-259 starts from, and the most the view may look further south. */
export const MENU_TILT_BASE = 16;
export const MENU_TILT_MAX = 32;
/** Longitude step (degrees) that samples the menu spin, which turns the whole globe under the entries. */
const SPIN_STEP = 3;

/**
 * How many (airport, spin angle) samples bring a demo airport within `clear` px of an entry box. The spin turns the
 * camera round the polar axis, which is the same as shifting every airport's longitude, so the airports are sampled
 * all round their parallels. `project` writes the screen point of a lon/lat for the current camera.
 */
export function menuNetworkClashes(cities: readonly { lon: number; lat: number }[], entries: readonly ClearRect[],
  project: (lon: number, lat: number, out: ClearPoint) => ClearPoint, clear = MENU_CLEAR_PX): number {
  if (!cities.length || !entries.length) return 0;
  const point: ClearPoint = { x: 0, y: 0, visible: false };
  let clashes = 0;
  for (const city of cities) {
    for (let turn = 0; turn < 360; turn += SPIN_STEP) {
      project(city.lon + turn, city.lat, point);
      if (!point.visible) continue;
      for (const box of entries) {
        if (point.x > box.left - clear && point.x < box.right + clear && point.y > box.top - clear && point.y < box.bottom + clear) {
          clashes++;
          break;
        }
      }
    }
  }
  return clashes;
}

/**
 * The tilt (degrees south of the menu target) to use: the first from `base` to `max` with no clash; if none clears,
 * the one with the fewest clashes (the lowest such tilt). `clashesAt` sets the camera to a tilt and counts.
 */
export function menuTilt(clashesAt: (tilt: number) => number, base = MENU_TILT_BASE, max = MENU_TILT_MAX): number {
  let best = base;
  let fewest = Infinity;
  for (let tilt = base; tilt <= max; tilt++) {
    const clashes = clashesAt(tilt);
    if (clashes === 0) return tilt;
    if (clashes < fewest) { fewest = clashes; best = tilt; }
  }
  return best;
}

/** [night-29b] D-284 U4: the Linoryt index's framing (the same shape as src/render MenuFraming, horizon mode). */
export interface IndexFraming {
  readonly mode: 'horizon';
  readonly insets: { top: number; left: number; right: number; bottom: number };
  readonly horizonY: number;
  readonly radius: number;
}
/** Gap (px) kept between the printed globe and the index: the demo airports' clearance plus a margin. */
export const INDEX_GLOBE_GAP = MENU_CLEAR_PX + 6;
/** Gap (px) between the globe and the title or a screen edge (no clearance needed there, only air). */
export const INDEX_EDGE_GAP = 10;
/** Smallest disc radius (px) worth printing; below it the globe stays a horizon. */
export const INDEX_DISC_MIN_PX = 48;

/**
 * [night-29b] D-284, D-286, PLAN-LINORYT.md step U4: the Linoryt menu prints the globe as an engraving between the title
 * and the index (frame png/a-menu.png): the whole disc, centred in the free paper — under the title and over the index
 * in portrait, left of the index column in landscape — at least INDEX_GLOBE_GAP from the index (so no demo airport comes near
 * its rows at any turn of the spin: the disc holds them all) and INDEX_EDGE_GAP from the title and the screen edges.
 * The index is the board box (opaque paper). A short phone gets a smaller disc rather than the horizon: under a
 * horizon the demo network rides the index's top rule at every tilt (320×568, measured). Only a free area under
 * INDEX_DISC_MIN_PX returns null (the caller keeps the horizon framing and the menu tilt). Pure.
 */
export function indexFraming(width: number, height: number, sign: ClearRect | null, board: ClearRect | null,
  base: { top?: number; left?: number; right?: number; bottom?: number } = {}): IndexFraming | null {
  if (!board) return null;
  const beside = width > height;
  const left = base.left ?? 0;
  const right = beside ? Math.max(base.right ?? 0, Math.round(width - board.left)) : base.right ?? 0;
  const bottom = beside ? base.bottom ?? 0 : Math.max(base.bottom ?? 0, Math.round(height - board.top));
  const top = Math.max(base.top ?? 0, Math.round(sign ? sign.bottom : height * 0.12));
  const free = {
    w: width - left - right - 2 * (beside ? INDEX_GLOBE_GAP : INDEX_EDGE_GAP), // the disc is centred between the insets
    h: height - top - bottom - INDEX_EDGE_GAP - (beside ? INDEX_EDGE_GAP : INDEX_GLOBE_GAP),
  };
  const radius = Math.floor(Math.min(free.w, free.h) / 2);
  if (radius < INDEX_DISC_MIN_PX) return null;
  return { mode: 'horizon', insets: { top, left, right, bottom }, horizonY: top + INDEX_EDGE_GAP + (free.h - 2 * radius) / 2, radius };
}

/** [night-79a R4] D-334: the most the framed menu view may look south of the menu target (the cap on short phones). */
export const FRAME_TILT_MAX = 60;

/**
 * [night-79a R4] D-334: the tilt (whole degrees south of the menu target, 0…max) that puts the menu target's latitude
 * closest to `wantY` on screen, i.e. the demo network into the middle of the globe's visible part (above the board;
 * near the limb when only a horizon shows). `yAt` sets the camera to a tilt and returns the target's screen y, or null
 * when it is behind the globe. Replaces the D-262 clash search for the UI-A menu: its board is opaque, so a demo airport
 * behind it is simply hidden, and the search had pushed the network off the small globe (32° at 320×568). Pure.
 */
export function frameTilt(yAt: (tilt: number) => number | null, wantY: number, max = FRAME_TILT_MAX): number {
  let best = 0;
  let nearest = Infinity;
  for (let tilt = 0; tilt <= max; tilt++) {
    const y = yAt(tilt);
    if (y === null) continue;
    const off = Math.abs(y - wantY);
    if (off < nearest) { nearest = off; best = tilt; }
  }
  return best;
}
