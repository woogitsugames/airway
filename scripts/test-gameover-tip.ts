// [night-11f] Game-over tip (src/game/gameoverTip.ts): every cause kind maps to its tip, the first cause with a
// tip wins, an unserved airport and a report of only "unavailable" get none, the region travels with the region
// tip, the first TIP_RUNS logged flights get tips, and both catalogs carry every tip text.
import assert from 'node:assert/strict';
import { buildCauseReport, type CauseFact, type CauseKind } from '../src/game/causes.ts';
import { TIP_RUNS, gameOverTip, tipsForFlight, unservedHint, type TipKind } from '../src/game/gameoverTip.ts';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const fact = (kind: CauseKind, extra: Partial<CauseFact> = {}): CauseFact => ({ kind, params: {}, ...extra });
const served = { unserved: false };

test('each cause kind has its tip', () => {
  const expected: Record<CauseKind, TipKind | null> = {
    'capacity': 'hub-overflow', 'congestion-duration': 'hub-overflow', 'long-wait': 'hub-overflow',
    'regional-demand': 'region', 'no-route': 'no-route', 'seat-shortage': 'seats', 'missed-transfer': 'transfer',
    'transfer-not-ready': 'transfer', 'slot-wait': 'slot-wait', 'unavailable': null,
  };
  for (const [kind, tip] of Object.entries(expected) as Array<[CauseKind, TipKind | null]>) {
    const extra = kind === 'regional-demand' ? { region: 'AFR' as const } : {};
    assert.equal(gameOverTip([fact(kind, extra)], served)?.kind ?? null, tip, kind);
  }
});
test('the leading cause with a tip wins; unavailable is skipped', () => {
  assert.equal(gameOverTip([fact('unavailable'), fact('slot-wait'), fact('capacity')], served)?.kind, 'slot-wait');
  assert.equal(gameOverTip([fact('seat-shortage'), fact('capacity')], served)?.kind, 'seats');
  assert.equal(gameOverTip([fact('unavailable'), fact('unavailable'), fact('unavailable')], served), null);
  assert.equal(gameOverTip([], served), null);
});
test('region tip names the region; a regional cause without one gets no tip', () => {
  assert.deepEqual(gameOverTip([fact('regional-demand', { region: 'NAM' })], served), { kind: 'region', region: 'NAM' });
  assert.equal(gameOverTip([fact('regional-demand')], served), null);
});
test('an unserved airport gets no tip (its board already says what would have helped)', () => {
  assert.equal(gameOverTip([fact('no-route'), fact('capacity')], { unserved: true }), null);
});
test('from a real ledger: full waiting area → hub tip; slot holds lead → slot tip', () => {
  assert.equal(gameOverTip(buildCauseReport({ waiting: 30, capacity: 24 }), served)?.kind, 'hub-overflow');
  assert.equal(gameOverTip(buildCauseReport({ waiting: 5, capacity: 24, slotWaitMinutes: 300 }), served)?.kind, 'slot-wait');
  assert.equal(gameOverTip(buildCauseReport({ waiting: 0, capacity: 0 }), served), null);
});
// [night-12y] R8b, D-187: with an empty reserve the unserved line names moves that need no spare aircraft.
test('unserved hint: no spare aircraft → extend or free a plane; a spare plane or unknown reserve → the old line', () => {
  assert.equal(unservedHint(0), 'gameover.unservedNoSpare');
  for (const spare of [1, 3, undefined]) assert.equal(unservedHint(spare), 'gameover.unservedHint', String(spare));
  for (const catalog of [en, pl] as Array<Record<string, string>>) {
    const text = catalog['gameover.unservedNoSpare'] ?? '';
    assert.ok(text.trim() && text !== catalog['gameover.unservedHint'] && !/\{/.test(text), 'both catalogs, no placeholder');
  }
});
test(`tips for the first ${TIP_RUNS} logged flights`, () => {
  assert.equal(TIP_RUNS, 10);
  for (const n of [0, 1, 5, TIP_RUNS]) assert.equal(tipsForFlight(n), true, String(n));
  for (const n of [TIP_RUNS + 1, 500, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(tipsForFlight(n), false, String(n));
});
test('both catalogs: label and every tip, {region} only in the region tip', () => {
  const keys: Record<TipKind, string> = { 'hub-overflow': 'hubOverflow', region: 'region', 'no-route': 'noRoute',
    seats: 'seats', transfer: 'transfer', 'slot-wait': 'slotWait' };
  for (const catalog of [en, pl] as Array<Record<string, string>>) {
    assert.ok(catalog['gameover.tip.label']?.trim());
    for (const [kind, key] of Object.entries(keys)) {
      const text = catalog[`gameover.tip.${key}`] ?? '';
      assert.ok(text.length > 20, `gameover.tip.${key}`);
      assert.equal(text.includes('{region}'), kind === 'region', `gameover.tip.${key} placeholder`);
    }
  }
});

console.log(`SUMMARY test:gameover-tip seed=0 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
