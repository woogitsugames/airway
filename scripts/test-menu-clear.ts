// [night-16a] D-262: the Róża menu tilt (src/game/menu-clear.ts). A demo-network airport may never come near a menu entry
// at any turn of the menu spin; the view looks further south until none does. Headless, with an orthographic globe as
// the projection; the real renderer is checked by `npm run test:e2e:menu-clear`.
import assert from 'node:assert/strict';
import { MENU_CLEAR_PX, MENU_TILT_BASE, MENU_TILT_MAX, menuNetworkClashes, menuTilt, frameTilt, FRAME_TILT_MAX, type ClearPoint, type ClearRect } from '../src/game/menu-clear.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const DEG = Math.PI / 180;
/** An orthographic globe of radius R centred at (cx, cy), looking at (lon0, lat0). */
function globe(cx: number, cy: number, R: number, lon0: number, lat0: number) {
  return (lon: number, lat: number, out: ClearPoint): ClearPoint => {
    const d = (lon - lon0) * DEG, p = lat * DEG, p0 = lat0 * DEG;
    out.x = cx + R * Math.cos(p) * Math.sin(d);
    out.y = cy - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(d));
    out.visible = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(d) > 0;
    return out;
  };
}
// The menu at 360×640: the demo network (London, Madrid, Lisbon, Casablanca, Dakar, New York) and the entries on the
// rose in the lower right (store shot menu-phone, docs/store/shots/pl/menu-phone.png before D-262).
const NETWORK = [{ lon: -0.1, lat: 51.5 }, { lon: -3.7, lat: 40.4 }, { lon: -9.1, lat: 38.7 }, { lon: -7.6, lat: 33.6 },
  { lon: -17.4, lat: 14.7 }, { lon: -74, lat: 40.7 }];
const ENTRIES: ClearRect[] = [
  { left: 16, top: 330, right: 268, bottom: 356 }, // Ustawienia
  { left: 16, top: 382, right: 268, bottom: 408 }, // Dziennik
  { left: 16, top: 425, right: 268, bottom: 465 }, // Dziś 05.11
  { left: 16, top: 478, right: 236, bottom: 518 }, // Zadania
  { left: 16, top: 530, right: 200, bottom: 570 }, // Lot bez końca
  { left: 250, top: 520, right: 342, bottom: 616 }, // the rose
];
const view = (tilt: number) => globe(180, 284, 330, -16, 40 - tilt);

test('16° south (D-259) leaves Dakar on "Ustawienia" on a short phone', () => {
  assert(menuNetworkClashes(NETWORK, ENTRIES, view(MENU_TILT_BASE)) > 0);
  assert(menuNetworkClashes([NETWORK[4]], [ENTRIES[0]], view(MENU_TILT_BASE)) > 0, 'Dakar touches the first entry');
});
test('the tilt grows until no demo airport comes near an entry at any spin angle', () => {
  const tilt = menuTilt((t) => menuNetworkClashes(NETWORK, ENTRIES, view(t)));
  assert(tilt > MENU_TILT_BASE && tilt <= MENU_TILT_MAX, `tilt ${tilt}`);
  assert.equal(menuNetworkClashes(NETWORK, ENTRIES, view(tilt)), 0);
  // ... and it is the first such tilt.
  assert(menuNetworkClashes(NETWORK, ENTRIES, view(tilt - 1)) > 0);
});
test('the spin is sampled all round: an airport far east of the entries still clashes when its parallel crosses them', () => {
  const far = [{ lon: 120, lat: 14.7 }]; // behind the globe now, on Dakar's parallel
  assert(menuNetworkClashes(far, ENTRIES, view(MENU_TILT_BASE)) > 0);
});
test('hidden points, no entries or no airports never clash; a roomy screen keeps the D-259 tilt', () => {
  assert.equal(menuNetworkClashes([{ lon: 164, lat: -80 }], ENTRIES, view(MENU_TILT_BASE)), 0, 'never on the near side');
  assert.equal(menuNetworkClashes(NETWORK, [], view(MENU_TILT_BASE)), 0);
  assert.equal(menuNetworkClashes([], ENTRIES, view(MENU_TILT_BASE)), 0);
  const tall = ENTRIES.map((r) => ({ ...r, top: r.top + 260, bottom: r.bottom + 260 }));
  assert.equal(menuTilt((t) => menuNetworkClashes(NETWORK, tall, view(t))), MENU_TILT_BASE);
});
test('the clearance counts the medallion: just outside it clears, just inside it clashes', () => {
  const point = (x: number, y: number) => (_lon: number, _lat: number, out: ClearPoint): ClearPoint => Object.assign(out, { x, y, visible: true });
  const box = [{ left: 100, top: 100, right: 200, bottom: 120 }];
  assert(menuNetworkClashes([{ lon: 0, lat: 0 }], box, point(150, 100 - MENU_CLEAR_PX + 1)) > 0);
  assert.equal(menuNetworkClashes([{ lon: 0, lat: 0 }], box, point(150, 100 - MENU_CLEAR_PX)), 0);
});
test('no tilt clears: the one with the fewest clashes, the lowest of equals', () => {
  assert.equal(menuTilt((t) => Math.abs(t - 20) + 1), 20);
  assert.equal(menuTilt(() => 5), MENU_TILT_BASE);
});
// [night-29b] D-286's Linoryt index framing (indexFraming) and its cases went with Linoryt ([night-81a] D-336, T6).
// [night-79a R4] D-334: the UI-A menu tilt puts the menu target's latitude at the middle of the globe's visible part.
test('R4 frame tilt: the network sits in the middle of the visible part (disc and horizon)', () => {
  const ys = (cx: number, cy: number, R: number) => (tilt: number): number | null => {
    const out: ClearPoint = { x: 0, y: 0, visible: false };
    globe(cx, cy, R, -16, 40 - tilt)(-16, 40, out);
    return out.visible ? out.y : null;
  };
  // A whole disc (anchor at the centre): no tilt.
  assert.equal(frameTilt(ys(206, 319, 196), 319), 0);
  // 412×915: the anchor 41 px above the centre → asin(41/196) ≈ 12°.
  const t412 = frameTilt(ys(206, 319, 196), 278);
  assert(t412 >= 11 && t412 <= 13, 'tilt ' + t412);
  // 320×568 horizon (r 150, limb at 109, anchor 136): the target near the limb, a large tilt within the cap.
  const t320 = frameTilt(ys(160, 259, 150), 136);
  assert(t320 > 40 && t320 <= FRAME_TILT_MAX, 'tilt ' + t320);
  // Every tilt hidden: no tilt.
  assert.equal(frameTilt(() => null, 100), 0);
});
console.log(`SUMMARY test:menu-clear passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
