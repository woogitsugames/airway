// [night-07z] Opening camera framing (src/game/framing.ts): a compact network keeps the spherical-mean framing;
// airports on several continents frame the densest cluster, so the view never opens on an empty ocean.
import assert from 'node:assert/strict';
import { framingPoints, FRAME_RADIUS_DEG, type FramePoint } from '../src/game/framing.ts';
import { cityByCode } from '../src/data/index.ts';
import { createBalanceSession } from './balance-game-adapter.ts';
import { chooseBotAction } from '../src/game/dev/bot-policy.ts';

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

console.log(`SUMMARY test:framing seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
