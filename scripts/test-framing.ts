// [night-07z] Opening camera framing (src/game/framing.ts): a compact network keeps the spherical-mean framing;
// airports on several continents frame the densest cluster, so the view never opens on an empty ocean.
import assert from 'node:assert/strict';
import { framingPoints, FRAME_RADIUS_DEG, type FramePoint } from '../src/game/framing.ts';
import { cityByCode } from '../src/data/index.ts';
import { createBalanceSession } from './balance-game-adapter.ts';
import { chooseBotAction } from '../src/game/dev/bot-policy.ts';
import { AUTO_FRAME_QUIET_MS, AutoFrameGate, framingReason, gameDay, planNetworkFrame, sphericalMean } from '../src/game/autoFrame.ts';
import { GlobeOrbitCamera, easeCameraGlide, type PerspectiveCameraPort } from '../src/render/camera.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const DEG = Math.PI / 180;
const unit = (p: FramePoint) => [Math.cos(p.lat * DEG) * Math.sin(p.lon * DEG), Math.sin(p.lat * DEG), Math.cos(p.lat * DEG) * Math.cos(p.lon * DEG)];
/** Spherical mean, as GlobeOrbitCamera.fitNetwork computes it. */
function mean(points: readonly FramePoint[]): number[] {
  const s = points.map(unit).reduce((a, u) => [a[0] + u[0], a[1] + u[1], a[2] + u[2]], [0, 0, 0]);
  const n = Math.hypot(s[0], s[1], s[2]);
  return s.map((v) => v / n);
}
const angle = (a: number[], b: number[]) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / DEG;
const nearestToFrame = (all: readonly FramePoint[]) => {
  const centre = mean(framingPoints(all));
  return Math.min(...all.map((p) => angle(unit(p), centre)));
};
const city = (code: string): FramePoint => { const c = cityByCode(code)!; return { lon: c.lon, lat: c.lat }; };

test('a compact network keeps every airport in the frame', () => {
  const europe = ['LON', 'PAR', 'ROM', 'MAD', 'BER'].map(city);
  assert.deepEqual(framingPoints(europe), europe);
});

test('the long play-through case (Americas + Asia/Africa) frames a cluster, not the ocean between', () => {
  const codes = ['SFO', 'HOU', 'ATL', 'PHX', 'HAV', 'MDE', 'UIO', 'LIM', 'LPB', 'SIN', 'HYD', 'NBO', 'LUS', 'JNB', 'HCM'];
  const all = codes.filter((code) => cityByCode(code)).map(city);
  assert.ok(all.length >= 12, `cities found: ${all.length}`);
  assert.ok(Math.min(...all.map((p) => angle(unit(p), mean(all)))) > FRAME_RADIUS_DEG / 2, 'the plain mean is far from every airport');
  assert.ok(nearestToFrame(all) <= FRAME_RADIUS_DEG / 2, `framed centre ${nearestToFrame(all).toFixed(1)}° from the nearest airport`);
  assert.deepEqual(framingPoints(all), framingPoints([...all]), 'deterministic');
});

test('a hub tips a tie between two equal clusters', () => {
  const a = [{ lon: 0, lat: 0 }, { lon: 5, lat: 0 }];
  const b = [{ lon: 120, lat: 0 }, { lon: 125, lat: 0, hub: true }];
  assert.deepEqual(framingPoints([...a, ...b]), b);
});

test('real Sim, 40 seeds × 30 min: the opening frame always has an airport within half the view radius', () => {
  let worst = 0;
  for (let i = 0; i < 40; i++) {
    const session = createBalanceSession(0xA1A1 + i);
    for (let step = 0; step < 600; step++) {
      const snap = session.snapshot();
      if (snap.status === 'finished') break;
      const decision = chooseBotAction(snap);
      if (decision) session.dispatch(decision.command);
      session.advance(30);
      if (step % 20) continue;
      const all = session.simulation.world.cities().map((view) => ({ ...city(view.id), hub: view.isHub }));
      worst = Math.max(worst, nearestToFrame(all));
    }
  }
  assert.ok(worst <= FRAME_RADIUS_DEG / 2, `worst ${worst.toFixed(1)}°`);
});

// ---- [night-86b] D-344 (P-1): the camera follows the network, at most once a game day --------------------------------
const rect = { left: 0, top: 84, right: 412, bottom: 819 };
const at = (x: number, y: number, extra: Partial<{ visible: boolean; connected: boolean; fresh: boolean }> = {}) =>
  ({ x, y, visible: true, connected: false, fresh: false, ...extra });

test('D-344 reason: a new airport outside the frame, a network airport at its edge, else none', () => {
  assert.equal(framingReason([at(200, 400, { connected: true }), at(100, 300)], rect), null);
  assert.equal(framingReason([at(200, 400, { fresh: true })], rect), null, 'a new airport in view needs nothing');
  assert.equal(framingReason([at(-30, 400, { fresh: true })], rect), 'new');
  assert.equal(framingReason([at(200, 400, { fresh: true, visible: false })], rect), 'new', 'behind the globe');
  assert.equal(framingReason([at(20, 400, { connected: true })], rect), 'edge', '20 px from the left edge fades');
  assert.equal(framingReason([at(200, 100, { connected: true })], rect), 'edge', 'under the top band');
  assert.equal(framingReason([at(20, 400)], rect), null, 'an airport off the network may sit at the edge');
});

test('D-344 gate: once a game day, never while busy, never within the quiet time after the player moved the camera', () => {
  const gate = new AutoFrameGate(0);
  assert.equal(gate.allowed(600, 100_000, false), false, 'the opening day is framed already');
  assert.equal(gate.allowed(1440, 100_000, false), true, 'day 2');
  assert.equal(gate.allowed(1440, 100_000, true), false, 'a drag or a held finger blocks it');
  gate.fired(1500);
  assert.equal(gate.allowed(2000, 200_000, false), false, 'the day is used up');
  assert.equal(gate.allowed(2880, 200_000, false), true, 'the next day');
  gate.noteUserCamera(200_000);
  assert.equal(gate.allowed(2880, 200_000 + AUTO_FRAME_QUIET_MS - 1, false), false, 'the player moved the camera lately');
  assert.equal(gate.allowed(2880, 200_000 + AUTO_FRAME_QUIET_MS, false), true);
  gate.fired(2900);
  gate.rewind(1500);
  assert.equal(gate.allowed(2880, 400_000, false), true, 'an undo into an earlier day lets the next day frame again');
  assert.equal(gameDay(1439), 0);
  assert.equal(gameDay(1440), 1);
});

test('D-344 plan: the centre of the network and the closest zoom that holds it, pulling back only', () => {
  const pts = ['LON', 'PAR', 'ROM'].map(city);
  const tried: number[] = [];
  const target = planNetworkFrame(pts, 3, { fits: (_lon, _lat, zoom) => { tried.push(zoom); return zoom <= 2.2; } })!;
  assert.ok(target.zoom <= 2.2 && target.zoom > 2.2 * 0.9 - 1e-9, `zoom ${target.zoom}`);
  assert.equal(tried[0], 3, 'starts at the zoom it may not exceed');
  assert.ok(tried.every((z, i) => i === 0 || z < tried[i - 1]), 'only pulls back');
  const centre = sphericalMean(pts)!;
  assert.ok(Math.abs(target.lon - centre.lon) < 1e-9 && Math.abs(target.lat - centre.lat) < 1e-9);
  let given = 0;
  const far = planNetworkFrame([...pts, city('SYD')], 3, { fits: (_lon, _lat, zoom, framed) => { given = framed.length; return zoom <= 2.2; } }, false)!;
  assert.equal(given, 3, 'an airport on the far side keeps its direction sign instead of forcing zoom 1');
  assert.ok(far.zoom > 2, `zoom ${far.zoom}`);
  const never = planNetworkFrame(pts, 3, { fits: () => false })!;
  assert.equal(never.zoom, 1, 'nothing fits: the whole disc');
  assert.equal(planNetworkFrame([], 3, { fits: () => true }), null);
});

function fakeCamera(): PerspectiveCameraPort {
  return {
    fov: 30, aspect: 1,
    position: { set: () => undefined }, up: { set: () => undefined },
    lookAt: () => undefined, setViewOffset: () => undefined, updateProjectionMatrix: () => undefined,
  };
}

test('D-344 camera glide: eased (no overshoot), the short way round, cancelled by the finger, instant at 0 s', () => {
  for (let i = 0; i <= 20; i++) {
    const k = easeCameraGlide(i / 20);
    assert.ok(k >= 0 && k <= 1, 'no overshoot');
    if (i) assert.ok(k >= easeCameraGlide((i - 1) / 20), 'monotonic');
  }
  const orbit = new GlobeOrbitCamera(fakeCamera(), { longitude: 170, latitude: 10, zoom: 3 });
  orbit.glideTo(-170, 20, 1.5, 1);
  assert.ok(orbit.gliding);
  orbit.update(0.05);
  const lon = orbit.getState().longitude;
  assert.ok(lon > 170 || lon < -170, `the short way over the date line (${lon})`);
  for (let i = 0; i < 30; i++) orbit.update(0.05);
  const done = orbit.getState();
  assert.ok(!orbit.gliding && Math.abs(done.longitude + 170) < 1e-6 && Math.abs(done.latitude - 20) < 1e-6 && done.zoom === 1.5);
  orbit.glideTo(0, 0, 3, 1);
  orbit.update(0.05);
  orbit.beginInteraction();
  assert.ok(!orbit.gliding, 'a pointer-down stops it where it is');
  orbit.endInteraction();
  orbit.glideTo(0, 0, 3, 1);
  orbit.zoomBy(1.1);
  assert.ok(!orbit.gliding, 'a pinch or wheel stops it');
  orbit.glideTo(10, 5, 2, 0);
  assert.ok(!orbit.gliding && orbit.getState().zoom === 2 && Math.abs(orbit.getState().longitude - 10) < 1e-9, 'reduce motion: a cut');
});

console.log(`SUMMARY test:framing seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
