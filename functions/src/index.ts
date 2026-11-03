// [night-06b] D-66 leaderboards as callable Cloud Functions (2nd gen, europe-west1).
// submitDaily: replays the official daily run on the game's own Sim; first accepted run per player and day
// counts, and is added to the ISO-week total. getBoards: top 50 + the caller's own rank.
// Firestore is server-only (firestore.rules deny every client read and write).
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { TOP_ENTRIES, callSign, reviewSubmission, validBoardId } from './logic.ts';

initializeApp();
const db = getFirestore();
const OPTIONS = { region: 'europe-west1', maxInstances: 10, memory: '512MiB' as const, timeoutSeconds: 60 };

function uidOf(request: { auth?: { uid: string } | null }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in anonymously first');
  return uid;
}

export const submitDaily = onCall(OPTIONS, async (request) => {
  const uid = uidOf(request);
  const reviewed = reviewSubmission((request.data as { submission?: unknown } | null)?.submission, Date.now());
  if (!reviewed.verdict.ok || !reviewed.daily || !reviewed.weekly) {
    return { accepted: false, reason: reviewed.verdict.ok ? 'malformed' : reviewed.verdict.reason };
  }
  const { score, weeks, hash } = reviewed.verdict;
  const dailyRef = db.doc(`boards/${reviewed.daily}/entries/${uid}`);
  const weeklyRef = db.doc(`boards/${reviewed.weekly}/entries/${uid}`);
  const sign = callSign(uid);
  const accepted = await db.runTransaction(async (tx) => {
    const existing = await tx.get(dailyRef);
    // The official run is unique per day (D-66): a second submission for the same day never counts.
    if (existing.exists) return false;
    tx.set(dailyRef, { callSign: sign, score, weeks, hash, at: FieldValue.serverTimestamp() });
    tx.set(weeklyRef, { callSign: sign, score: FieldValue.increment(score), days: FieldValue.increment(1),
      at: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  return accepted ? { accepted: true, score } : { accepted: false, reason: 'duplicate', score };
});

async function board(id: string, uid: string) {
  const entries = db.collection(`boards/${id}/entries`);
  const top = await entries.orderBy('score', 'desc').limit(TOP_ENTRIES).get();
  const list = top.docs.map((doc, index) => ({
    rank: index + 1, callSign: String(doc.get('callSign')), score: Number(doc.get('score')), me: doc.id === uid,
  }));
  let me = list.find((entry) => entry.me) ?? null;
  if (!me) {
    const mine = await entries.doc(uid).get();
    if (mine.exists) {
      const score = Number(mine.get('score'));
      const ahead = await entries.where('score', '>', score).count().get();
      me = { rank: ahead.data().count + 1, callSign: String(mine.get('callSign')), score, me: true };
    }
  }
  return { id, entries: list, me };
}

export const getBoards = onCall(OPTIONS, async (request) => {
  const uid = uidOf(request);
  const data = request.data as { daily?: unknown; weekly?: unknown } | null;
  if (!validBoardId(data?.daily) || !validBoardId(data?.weekly)) throw new HttpsError('invalid-argument', 'Unknown board');
  const [daily, weekly] = await Promise.all([board(data.daily, uid), board(data.weekly, uid)]);
  return { daily, weekly };
});
