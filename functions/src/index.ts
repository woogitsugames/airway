// [night-06b] D-66 leaderboards as callable Cloud Functions (2nd gen, europe-west1).
// submitDaily: replays the official daily run on the game's own Sim; first accepted run per player and day
// counts, and is added to the ISO-week total. getBoards: top 50 + the caller's own rank. Entries expire after
// 90 days (D-77, Firestore TTL on `expireAt`).
// Firestore is server-only (firestore.rules deny every client read and write).
// [night-12i] D-108: each board keeps its top 50 in one document, `boards/{id}/meta/top`, written by submitDaily
// inside its transaction; getBoards reads the two top documents and the caller's two entries (4 reads) and runs
// a `count()` only for a caller outside the top 50, instead of two 50-document queries per call.
import { initializeApp } from 'firebase-admin/app';
import {
  FieldValue, Timestamp, getFirestore, type DocumentSnapshot, type QuerySnapshot, type Transaction,
} from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  FUNCTION_OPTIONS, RATE_LIMITS, RateLimiter, TOP_ENTRIES, callSign, expiresAt, mergeTop, rankInTop, readTopRows,
  reviewSubmission, validBoardId, type TopEntry,
} from './logic.ts';

initializeApp();
const db = getFirestore();
// [night-12j] D-109: split caps per function and a per-player limit per instance, checked before any Firestore
// access or replay; over the limit the client keeps the run queued and retries later.
const limits = { getBoards: new RateLimiter(RATE_LIMITS.getBoards), submitDaily: new RateLimiter(RATE_LIMITS.submitDaily) };
function throttle(name: keyof typeof limits, uid: string): void {
  if (!limits[name].take(uid)) throw new HttpsError('resource-exhausted', 'Too many requests, try again in a minute');
}

function uidOf(request: { auth?: { uid: string } | null }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in anonymously first');
  return uid;
}

const entriesOf = (board: string) => db.collection(`boards/${board}/entries`);
const topRefOf = (board: string) => db.doc(`boards/${board}/meta/top`);
/** The pre-D-108 query: only for a board whose top document does not exist yet (written before the upgrade). */
const topQuery = (board: string) => entriesOf(board).orderBy('score', 'desc').limit(TOP_ENTRIES);
const rowsOfQuery = (snap: QuerySnapshot): TopEntry[] => snap.docs.map((doc) => ({
  uid: doc.id, callSign: String(doc.get('callSign')), score: Number(doc.get('score')),
}));

/** A board's stored top, or (first write after the upgrade) the old query's result, read inside the transaction. */
async function topInTx(tx: Transaction, board: string, doc: DocumentSnapshot): Promise<TopEntry[]> {
  return doc.exists ? readTopRows(doc.get('entries')) : rowsOfQuery(await tx.get(topQuery(board)));
}

export const submitDaily = onCall(FUNCTION_OPTIONS.submitDaily, async (request) => {
  const uid = uidOf(request);
  throttle('submitDaily', uid);
  const reviewed = reviewSubmission((request.data as { submission?: unknown } | null)?.submission, Date.now());
  if (!reviewed.verdict.ok || !reviewed.daily || !reviewed.weekly) {
    return { accepted: false, reason: reviewed.verdict.ok ? 'malformed' : reviewed.verdict.reason };
  }
  const { score, weeks, hash } = reviewed.verdict;
  const dailyRef = db.doc(`boards/${reviewed.daily}/entries/${uid}`);
  const weeklyRef = db.doc(`boards/${reviewed.weekly}/entries/${uid}`);
  const sign = callSign(uid);
  // [night-09a] D-77: the TTL policy on `entries.expireAt` (firestore.indexes.json) deletes an entry 90 days
  // after its last write; a weekly total is refreshed by every accepted day of that week.
  const expireAt = Timestamp.fromMillis(expiresAt(Date.now()));
  const dailyTopRef = topRefOf(reviewed.daily);
  const weeklyTopRef = topRefOf(reviewed.weekly);
  const rank = await db.runTransaction(async (tx) => {
    const [existing, weeklyEntry, dailyTopDoc, weeklyTopDoc] =
      await tx.getAll(dailyRef, weeklyRef, dailyTopRef, weeklyTopRef);
    // The official run is unique per day (D-66): a second submission for the same day never counts.
    if (existing.exists) return false;
    // All reads before the first write (Firestore transactions).
    const dailyTop = await topInTx(tx, reviewed.daily!, dailyTopDoc);
    const weeklyTop = await topInTx(tx, reviewed.weekly!, weeklyTopDoc);
    const weekTotal = (weeklyEntry.exists ? Number(weeklyEntry.get('score')) || 0 : 0) + score;
    tx.set(dailyRef, { callSign: sign, score, weeks, hash, at: FieldValue.serverTimestamp(), expireAt });
    tx.set(weeklyRef, { callSign: sign, score: FieldValue.increment(score), days: FieldValue.increment(1),
      at: FieldValue.serverTimestamp(), expireAt }, { merge: true });
    // D-108: rewrite a top document only when the run changes it (a full list whose 50th place it does not beat
    // stays as it is). Its TTL (D-77) is fixed at its first write and never extended, so it never outlives the
    // entries it copies; a board read after that falls back to the old query.
    const nextDaily = mergeTop(dailyTop, { uid, callSign: sign, score });
    if (nextDaily || !dailyTopDoc.exists) {
      tx.set(dailyTopRef, { entries: nextDaily ?? dailyTop, expireAt: dailyTopDoc.get('expireAt') ?? expireAt });
    }
    const nextWeekly = mergeTop(weeklyTop, { uid, callSign: sign, score: weekTotal });
    if (nextWeekly || !weeklyTopDoc.exists) {
      tx.set(weeklyTopRef, { entries: nextWeekly ?? weeklyTop, expireAt: weeklyTopDoc.get('expireAt') ?? expireAt });
    }
    return rankInTop(nextDaily ?? dailyTop, uid);
  });
  if (rank === false) return { accepted: false, reason: 'duplicate', score };
  return rank === null ? { accepted: true, score } : { accepted: true, score, rank };
});

/** One board for the caller: the stored top (or the old query before the first post-upgrade write) + own rank. */
async function board(id: string, uid: string, topDoc: DocumentSnapshot, mine: DocumentSnapshot) {
  const rows = topDoc.exists ? readTopRows(topDoc.get('entries')) : rowsOfQuery(await topQuery(id).get());
  const list = rows.map((row, index) => ({ rank: index + 1, callSign: row.callSign, score: row.score, me: row.uid === uid }));
  let me = list.find((entry) => entry.me) ?? null;
  if (!me && mine.exists) {
    const score = Number(mine.get('score'));
    const ahead = await entriesOf(id).where('score', '>', score).count().get();
    me = { rank: ahead.data().count + 1, callSign: String(mine.get('callSign')), score, me: true };
  }
  return { id, entries: list, me };
}

export const getBoards = onCall(FUNCTION_OPTIONS.getBoards, async (request) => {
  const uid = uidOf(request);
  throttle('getBoards', uid);
  const data = request.data as { daily?: unknown; weekly?: unknown } | null;
  if (!validBoardId(data?.daily) || !validBoardId(data?.weekly)) throw new HttpsError('invalid-argument', 'Unknown board');
  const [dailyTop, weeklyTop, dailyMine, weeklyMine] = await db.getAll(
    topRefOf(data.daily), topRefOf(data.weekly), entriesOf(data.daily).doc(uid), entriesOf(data.weekly).doc(uid));
  const [daily, weekly] = await Promise.all([
    board(data.daily, uid, dailyTop, dailyMine), board(data.weekly, uid, weeklyTop, weeklyMine)]);
  return { daily, weekly };
});
