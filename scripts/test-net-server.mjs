// [night-06b] Pure server rules of functions/src/logic.ts (no Firebase): call signs, accepted days around
// Warsaw midnight, request size cap and the boards an accepted run counts for.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { allowedDays, callSign, reviewSubmission, validBoardId, MAX_REQUEST_BYTES, RETENTION_DAYS, expiresAt,
  TOP_ENTRIES, compareTop, mergeTop, rankInTop, readTopRows, RateLimiter, RATE_LIMITS, RATE_LIMIT_KEYS, FUNCTION_OPTIONS,
} = await import('../functions/src/logic.ts');

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
// [night-09a] D-77: 90-day retention through a Firestore TTL policy on entries.expireAt.
check('entries expire 90 days after their write, and the TTL policy is declared', () => {
  assert.equal(RETENTION_DAYS, 90);
  assert.equal(expiresAt(Date.UTC(2026, 10, 3)), Date.UTC(2027, 1, 1));
  const indexes = JSON.parse(readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8'));
  const ttl = indexes.fieldOverrides.find((item) => item.collectionGroup === 'entries' && item.fieldPath === 'expireAt');
  assert.ok(ttl?.ttl === true && Array.isArray(ttl.indexes) && ttl.indexes.length === 0, JSON.stringify(ttl));
});
// [night-12i] D-108: the one-document top 50 per board (R3a) must equal the old 50-document query.
/** The old query: every entry sorted by score desc, ties by document id desc (Firestore's implicit __name__). */
function oldQuery(entries) {
  return [...entries.values()].sort((a, b) => b.score - a.score || (a.uid < b.uid ? 1 : -1)).slice(0, TOP_ENTRIES);
}
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
check('the stored top after 60 submissions equals the old top-50 query (scores with ties)', () => {
  const rand = lcg(0xa1a1);
  const entries = new Map();
  let top = [];
  let writes = 0;
  for (let i = 0; i < 60; i++) {
    const uid = `uid-${Math.floor(rand() * 1e6).toString(36)}-${i}`;
    const entry = { uid, callSign: callSign(uid), score: Math.floor(rand() * 40) * 5 };
    entries.set(uid, entry);
    const next = mergeTop(top, entry);
    if (next) { top = next; writes++; }
  }
  assert.deepEqual(top, oldQuery(entries));
  assert.equal(top.length, TOP_ENTRIES);
  assert.ok(writes < 60, `writes skipped for runs below the 50th place (${writes}/60)`);
});
check('a weekly total replaces the same player, never duplicates, and ranks', () => {
  const rand = lcg(0xa1a2);
  const totals = new Map();
  let top = [];
  for (let day = 0; day < 7; day++) {
    for (let p = 0; p < 70; p++) {
      if (rand() < 0.4) continue;
      const uid = `p${p}`;
      const entry = { uid, callSign: callSign(uid), score: (totals.get(uid)?.score ?? 0) + Math.floor(rand() * 120) };
      totals.set(uid, entry);
      top = mergeTop(top, entry) ?? top;
    }
  }
  assert.deepEqual(top, oldQuery(totals));
  assert.equal(new Set(top.map((row) => row.uid)).size, top.length);
  const first = oldQuery(totals)[0];
  assert.equal(rankInTop(top, first.uid), 1);
  assert.equal(rankInTop(top, 'nobody'), null);
});
check('a full top skips the write below its 50th place; ties follow the document-id order', () => {
  const full = Array.from({ length: TOP_ENTRIES }, (_, i) => ({ uid: `m${String(i).padStart(2, '0')}`, callSign: 'AW-0000', score: 100 + i }))
    .sort(compareTop);
  assert.equal(mergeTop(full, { uid: 'zz', callSign: 'AW-0001', score: 99 }), null);
  assert.equal(mergeTop(full, { uid: 'a', callSign: 'AW-0001', score: 100 }), null, 'tie with a smaller id stays out');
  const tie = mergeTop(full, { uid: 'zz', callSign: 'AW-0001', score: 100 });
  assert.equal(tie?.length, TOP_ENTRIES);
  assert.equal(tie[TOP_ENTRIES - 1].uid, 'zz', 'tie with a larger id enters at the last place');
  assert.equal(mergeTop(full, full[3]), null, 'an unchanged row is not a write');
});
check('stored top rows are validated and re-sorted; the top document has the TTL policy too', () => {
  const rows = readTopRows([{ uid: 'b', callSign: 'AW-0002', score: 5 }, null, { uid: 'x', score: 'bad' },
    { uid: 'a', callSign: 'AW-0001', score: 9 }]);
  assert.deepEqual(rows.map((row) => row.uid), ['a', 'b']);
  assert.deepEqual(readTopRows('nope'), []);
  const indexes = JSON.parse(readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8'));
  const ttl = indexes.fieldOverrides.find((item) => item.collectionGroup === 'meta' && item.fieldPath === 'expireAt');
  assert.ok(ttl?.ttl === true && Array.isArray(ttl.indexes) && ttl.indexes.length === 0, JSON.stringify(ttl));
});
// [night-12j] D-109 (R3b): per-player token bucket and split function caps.
check('the rate limiter allows a burst of the per-minute limit, then refills evenly', () => {
  let clock = 1_000_000;
  const limiter = new RateLimiter(RATE_LIMITS.submitDaily, () => clock);
  assert.deepEqual(Array.from({ length: 7 }, () => limiter.take('a')), [true, true, true, true, true, true, false]);
  assert.equal(limiter.take('b'), true, 'players do not share a bucket');
  clock += 9_999;
  assert.equal(limiter.take('a'), false, 'one token takes 10 s at 6/min');
  clock += 1;
  assert.equal(limiter.take('a'), true);
  assert.equal(limiter.take('a'), false);
  clock += 10 * 60_000;
  assert.equal(Array.from({ length: 8 }, () => limiter.take('a')).filter(Boolean).length, 6, 'refill is capped at the burst');
});
check('a refused call spends nothing and limits match R3b (getBoards 20/min, submitDaily 6/min)', () => {
  let clock = 0;
  const limiter = new RateLimiter(RATE_LIMITS.getBoards, () => clock);
  for (let i = 0; i < 20; i++) assert.ok(limiter.take('u'));
  for (let i = 0; i < 50; i++) assert.equal(limiter.take('u'), false, 'hammering does not dig a deeper hole');
  clock += 3_000;
  assert.equal(limiter.take('u'), true, 'one token after 3 s at 20/min');
  assert.deepEqual(RATE_LIMITS, { getBoards: 20, submitDaily: 6 });
});
check('the limiter forgets the least recently used player beyond its key bound', () => {
  let clock = 0;
  const limiter = new RateLimiter(1, () => clock, 3);
  for (const key of ['a', 'b', 'c']) assert.ok(limiter.take(key));
  assert.equal(limiter.take('a'), false, 'a touched again (most recent now)');
  assert.ok(limiter.take('d'));
  assert.equal(limiter.size, 3);
  assert.equal(limiter.take('a'), false, 'a is still remembered');
  assert.equal(limiter.take('b'), true, 'b (least recently used) was forgotten');
  assert.equal(RATE_LIMIT_KEYS, 10_000);
});
check('function caps are split: getBoards 3 instances, submitDaily 5 instances x 4 concurrent on 1 vCPU', () => {
  assert.equal(FUNCTION_OPTIONS.getBoards.maxInstances, 3);
  assert.deepEqual([FUNCTION_OPTIONS.submitDaily.maxInstances, FUNCTION_OPTIONS.submitDaily.concurrency,
    FUNCTION_OPTIONS.submitDaily.cpu], [5, 4, 1]);
  for (const options of Object.values(FUNCTION_OPTIONS)) assert.equal(options.region, 'europe-west1');
  const source = readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
  assert.match(source, /onCall\(FUNCTION_OPTIONS\.submitDaily,[^]*?throttle\('submitDaily', uid\);\n\s+const reviewed/);
  assert.match(source, /onCall\(FUNCTION_OPTIONS\.getBoards,[^]*?throttle\('getBoards', uid\);\n\s+const data/);
});
console.log(`SUMMARY test:net-server seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
