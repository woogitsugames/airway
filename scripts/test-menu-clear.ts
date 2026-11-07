// [night-16a] D-262: the Róża menu tilt (src/game/menu-clear.ts). A demo-network airport may never come near a menu entry
// at any turn of the menu spin; the view looks further south until none does. Headless, with an orthographic globe as
// the projection; the real renderer is checked by `npm run test:e2e:menu-clear`.
import assert from 'node:assert/strict';
import { INDEX_DISC_MIN_PX, INDEX_EDGE_GAP, INDEX_GLOBE_GAP, MENU_CLEAR_PX, MENU_TILT_BASE, MENU_TILT_MAX, indexFraming, menuNetworkClashes, menuTilt, type ClearPoint, type ClearRect } from '../src/game/menu-clear.ts';

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
// [night-29b] D-284, PLAN-LINORYT.md step U4: the Linoryt menu prints the whole globe between the title and the index
// (the board box), or keeps the horizon when the screen is too short; boxes measured on the preview (docs/shots/29b/).
const SIGN_412: ClearRect = { left: 0, top: 0, right: 412, bottom: 118 };
const INDEX_412: ClearRect = { left: 0, top: 612, right: 412, bottom: 915 };
test('Linoryt 412×915: the whole disc between title and index, the gap kept to both, centred', () => {
  const f = indexFraming(412, 915, SIGN_412, INDEX_412);
  assert(f, 'a disc fits');
  const top = f.horizonY, bottom = f.horizonY + 2 * f.radius;
  assert(top >= SIGN_412.bottom + INDEX_EDGE_GAP - 0.5, `limb top ${top}`);
  assert(bottom <= INDEX_412.top - INDEX_GLOBE_GAP + 0.5, `limb bottom ${bottom}`);
  assert(2 * f.radius <= 412 - 2 * INDEX_EDGE_GAP, 'disc narrower than the screen');
  assert.deepEqual(f.insets, { top: 118, left: 0, right: 0, bottom: 303 });
  // With the disc there, a demo airport (anywhere on the disc) never comes within the clearance of an index row.
  const disc = (lon: number, lat: number, out: ClearPoint) => globe(206, top + f.radius, f.radius, -16, 24)(lon, lat, out);
  assert.equal(menuNetworkClashes(NETWORK, [{ left: 20, top: INDEX_412.top + 14, right: 392, bottom: 700 }], disc), 0);
});
test('Linoryt landscape 915×412: the disc left of the index column, under the title', () => {
  const f = indexFraming(915, 412, { left: 0, top: 0, right: 300, bottom: 86 }, { left: 475, top: 0, right: 915, bottom: 412 });
  assert(f, 'a disc fits');
  assert.equal(f.insets.right, 915 - 475);
  assert(f.horizonY >= 86 + INDEX_EDGE_GAP - 0.5 && f.horizonY + 2 * f.radius <= 412 - INDEX_EDGE_GAP + 0.5, `disc ${f.horizonY}+${2 * f.radius}`);
  assert(2 * f.radius <= 475 - 2 * INDEX_GLOBE_GAP);
});
test('Linoryt 320×568 with Continue: a smaller disc, never the horizon that rides the index rule; no room or no board → null', () => {
  const sign = { left: 0, top: 0, right: 320, bottom: 98 }, board = { left: 0, top: 300, right: 320, bottom: 568 };
  const f = indexFraming(320, 568, sign, board);
  assert(f && f.radius >= INDEX_DISC_MIN_PX, `radius ${f?.radius}`);
  assert(f.horizonY + 2 * f.radius <= board.top - INDEX_GLOBE_GAP + 0.5);
  // The horizon framing it replaces: a 294 px globe whose limb sits 18 % into the band — Dakar's parallel crosses the rule.
  const horizon = (tilt: number) => globe(160, 98 + 0.18 * 202 + 294, 294, -16, 40 - tilt);
  const rows = [{ left: 20, top: 300, right: 300, bottom: 360 }];
  assert(menuNetworkClashes(NETWORK, rows, horizon(MENU_TILT_MAX)) > 0, 'the horizon cannot clear the rule even at the largest tilt');
  assert.equal(indexFraming(320, 568, sign, { ...board, top: 98 + 2 * INDEX_DISC_MIN_PX }), null);
  assert.equal(indexFraming(412, 915, SIGN_412, null), null);
});
test('Linoryt safe areas: the notch and the home bar push the free paper', () => {
  const f = indexFraming(390, 844, { left: 0, top: 0, right: 390, bottom: 160 }, { left: 0, top: 540, right: 390, bottom: 844 }, { top: 47, bottom: 34, left: 0, right: 0 });
  assert(f && f.insets.top === 160 && f.insets.bottom === 304);
});
console.log(`SUMMARY test:menu-clear passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
