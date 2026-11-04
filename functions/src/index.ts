// [night-06b] D-66 leaderboards as callable Cloud Functions (2nd gen, europe-west1).
// submitDaily: replays the official daily run on the game's own Sim; first accepted run per player and day
// counts, and is added to the ISO-week total. getBoards: top 50 + the caller's own rank. Entries expire after
// 90 days (D-77, Firestore TTL on `expireAt`).
// Firestore is server-only (firestore.rules deny every client read and write).
// [night-12i] D-108: each board keeps its top 50 in one document, `boards/{id}/meta/top`, written by submitDaily
// inside its transaction; getBoards reads the two top documents and the caller's two entries (4 reads) and runs
// a `count()` only for a caller outside the top 50, instead of two 50-document queries per call.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldValue, Timestamp, getFirestore, type DocumentSnapshot, type QuerySnapshot, type Transaction,
} from 'firebase-admin/firestore';
import { defineBoolean } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  FUNCTION_OPTIONS, PAUSED_SUBMIT, PAUSE_PARAM, RATE_LIMITS, RateLimiter, TOP_ENTRIES, callSign, dropFromTop, expiresAt,
  mergeTop, pausedBoards, rankInTop, readTopRows, retainedBoardIds, reviewSubmission, validBoardId, type TopEntry,
} from './logic.ts';

initializeApp();
const db = getFirestore();
// [night-12as] D-234 (R3d): the manual brake after a budget alert (docs/FIREBASE.md, "Gdy przyjdzie alert").
// A deploy-time param: `LEADERBOARDS_PAUSED=true` in functions/.env.<project>, then redeploy; default off.
const leaderboardsPaused = defineBoolean(PAUSE_PARAM, {
  default: false,
  description: 'Budget brake: submitDaily and getBoards answer without Firestore (runs stay queued on devices).',
});
// [night-12j] D-109: split caps per function and a per-player limit per instance, checked before any Firestore
// access or replay; over the limit the client keeps the run queued and retries later.
const limits = {
  getBoards: new RateLimiter(RATE_LIMITS.getBoards), submitDaily: new RateLimiter(RATE_LIMITS.submitDaily),
  deleteMyData: new RateLimiter(RATE_LIMITS.deleteMyData),
};
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
  // D-234: before the limiter, the request body and the replay; nothing is read or written.
  if (leaderboardsPaused.value()) return PAUSED_SUBMIT;
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
  if (leaderboardsPaused.value()) return pausedBoards(data.daily, data.weekly); // D-234: no Firestore read
  const [dailyTop, weeklyTop, dailyMine, weeklyMine] = await db.getAll(
    topRefOf(data.daily), topRefOf(data.weekly), entriesOf(data.daily).doc(uid), entriesOf(data.weekly).doc(uid));
  const [daily, weekly] = await Promise.all([
    board(data.daily, uid, dailyTop, dailyMine), board(data.weekly, uid, weeklyTop, weeklyMine)]);
  return { daily, weekly };
});

// [night-12k] D-114 (R1a, D-93): the player deletes their leaderboard data from the app. Every daily and weekly
// entry of the caller that can still exist (D-77 retention + margin) is deleted, the uid leaves each board's top
// document (a full top is refilled from the entries, as the old query would show), then the anonymous Auth account
// is deleted. Idempotent: a second call finds nothing and an account already gone is not an error.
const BOARD_BATCH = 20;
async function deleteFromBoard(board: string, uid: string): Promise<boolean> {
  const entryRef = entriesOf(board).doc(uid);
  const topRef = topRefOf(board);
  return db.runTransaction(async (tx) => {
    const [entry, topDoc] = await tx.getAll(entryRef, topRef);
    const top = topDoc.exists ? readTopRows(topDoc.get('entries')) : [];
    const listed = top.some((row) => row.uid === uid);
    if (!entry.exists && !listed) return false;
    // All reads before the first write: the refill rows come from the query as it is before the delete.
    const refill = listed && top.length >= TOP_ENTRIES
      ? rowsOfQuery(await tx.get(entriesOf(board).orderBy('score', 'desc').limit(TOP_ENTRIES + 1))) : [];
    const next = dropFromTop(top, uid, refill);
    if (next) tx.set(topRef, { entries: next, expireAt: topDoc.get('expireAt') ?? null });
    if (entry.exists) tx.delete(entryRef);
    return entry.exists;
  });
}

export const deleteMyData = onCall(FUNCTION_OPTIONS.deleteMyData, async (request) => {
  const uid = uidOf(request);
  throttle('deleteMyData', uid);
  const boards = retainedBoardIds(Date.now());
  // One cheap existence read per board first; transactions only where the player left something.
  const touched: string[] = [];
  for (let i = 0; i < boards.length; i += BOARD_BATCH) {
    const slice = boards.slice(i, i + BOARD_BATCH);
    const docs = await db.getAll(...slice.flatMap((board) => [entriesOf(board).doc(uid), topRefOf(board)]));
    slice.forEach((board, k) => {
      const entry = docs[2 * k];
      const top = docs[2 * k + 1];
      if (entry.exists || (top.exists && readTopRows(top.get('entries')).some((row) => row.uid === uid))) touched.push(board);
    });
  }
  let entries = 0;
  for (const board of touched) if (await deleteFromBoard(board, uid)) entries++;
  let account = true;
  try {
    await getAuth().deleteUser(uid);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw new HttpsError('internal', 'Account not deleted, try again');
    account = false;
  }
  return { deleted: true, entries, account };
});
