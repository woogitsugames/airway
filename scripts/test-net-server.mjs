// [night-06b] Pure server rules of functions/src/logic.ts (no Firebase): call signs, accepted days around
// Warsaw midnight, request size cap and the boards an accepted run counts for.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
const { allowedDays, callSign, reviewSubmission, validBoardId, MAX_REQUEST_BYTES } = await import('../functions/src/logic.ts');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}
check('call signs are stable, short and non-identifying', () => {
  assert.equal(callSign('uid-1'), callSign('uid-1'));
  assert.match(callSign('uid-1'), /^AW-[0-9A-F]{4}$/);
  assert.notEqual(callSign('uid-1'), callSign('uid-2'));
});
check('accepted days follow Warsaw midnight (CET, UTC+1 in November)', () => {
  assert.deepEqual(allowedDays(Date.UTC(2026, 10, 3, 22, 59)), ['2026-11-03', '2026-11-02']);
  assert.deepEqual(allowedDays(Date.UTC(2026, 10, 3, 23, 1)), ['2026-11-04', '2026-11-03']);
});
check('oversized and malformed requests are refused before replay', () => {
  const huge = { v: 1, journal: [[1, { pad: 'x'.repeat(MAX_REQUEST_BYTES) }]] };
  assert.deepEqual(reviewSubmission(huge, Date.now()).verdict, { ok: false, reason: 'too_long' });
  assert.deepEqual(reviewSubmission(undefined, Date.now()).verdict, { ok: false, reason: 'malformed' });
  const cyclic = {}; cyclic.self = cyclic;
  assert.deepEqual(reviewSubmission(cyclic, Date.now()).verdict, { ok: false, reason: 'malformed' });
});
check('only daily/weekly board ids are valid', () => {
  assert.ok(validBoardId('d-2026-11-03') && validBoardId('w-2026-W45'));
  assert.ok(!validBoardId('boards') && !validBoardId(42) && !validBoardId('d-2026-11-03/../x'));
});
console.log(`SUMMARY test:net-server seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
