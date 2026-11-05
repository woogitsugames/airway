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
