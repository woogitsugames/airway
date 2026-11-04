// [night-06] D-66 online leaderboards facade: disabled without config, offline-first submission queue,
// read-only boards. The server (functions/) replays every run with the same Sim before it counts.
import { FirebaseRestClient, NetError, type Fetch, type Session, type TokenStore } from './client.ts';
import { readNetConfig, type NetConfig } from './config.ts';
import { QUEUE_KEY, SubmissionQueue, type QueueStorage, type SendResult } from './queue.ts';
import { selfCheck, type DailySubmission, type RejectReason } from './submission.ts';
import { boardsForDaily } from './boards.ts';

export { readNetConfig } from './config.ts';
export { boardsForDaily, dailyBoardId, weeklyBoardId, weekKeyForDate, todayKey } from './boards.ts';
export { buildDailySubmission, verifyDailySubmission, type DailySubmission, type Verdict } from './submission.ts';

export interface BoardEntry { readonly rank: number; readonly callSign: string; readonly score: number; readonly me: boolean }
export interface Board { readonly id: string; readonly entries: readonly BoardEntry[]; readonly me: BoardEntry | null }
export interface Boards { readonly daily: Board; readonly weekly: Board }
/** [night-12as] D-234: `paused` = the server's budget brake is on; the run stays queued (not a rejection). */
export interface SubmitResponse {
  readonly accepted: boolean; readonly reason?: RejectReason | 'duplicate' | 'paused'; readonly score?: number;
}

/** [night-12x] `opted-out`: the player objected (D-135, R7l); the run was not sent and nothing was queued. */
export type LeaderboardStatus = 'disabled' | 'idle' | 'queued' | 'sent' | 'rejected' | 'opted-out';
/**
 * [night-12k] D-114: outcome of an in-app data deletion. `deleted`: the server removed the entries and the anonymous
 * account (or found nothing left); `none`: this device never had an identity; `offline`: no connection, nothing
 * changed (never reported as done); `failed`: the server refused or failed, the identity is kept for a retry.
 */
export type DeleteResult = 'deleted' | 'none' | 'offline' | 'failed';

export interface Leaderboards {
  readonly enabled: boolean;
  /** Queue a finished official daily run and try to send it now; never throws. */
  submitDaily(submission: DailySubmission): Promise<LeaderboardStatus>;
  /** Retry queued runs (app start, back online). */
  flush(): Promise<void>;
  /** Daily + weekly boards for a Warsaw day key; null when disabled or offline. */
  boards(dateKey: string): Promise<Boards | null>;
  /** [night-12k] D-114: true once this device has an anonymous leaderboard identity or a queued run. */
  hasData(): boolean;
  /** [night-12k] D-114 (R1a): delete the player's entries and anonymous account; never throws. */
  deleteMyData(): Promise<DeleteResult>;
  /**
   * [night-12x] D-135, R7l: "Send my daily results" (default on, remembered on this device). The settings switch
   * reads and writes it here. Off: `submitDaily` answers `opted-out` without queueing, `flush` and `boards` make no
   * call, and turning it off drops the runs still waiting in the queue (the GDPR art. 21 objection takes effect at
   * once). The anonymous identity is kept; deleting it is `deleteMyData`.
   */
  isSharing(): boolean;
  setSharing(on: boolean): void;
}

const TOKEN_KEY = 'aw-net-session-v1';
/** [night-12x] D-135: '0' = the player objected to leaderboard processing; missing or anything else = on. */
export const SHARE_KEY = 'aw-net-share-v1';

function readSharing(storage: QueueStorage | null): boolean {
  try { return storage?.getItem(SHARE_KEY) !== '0'; } catch { return true; }
}
function writeSharing(storage: QueueStorage | null, on: boolean): void {
  try {
    if (on && storage?.removeItem) storage.removeItem(SHARE_KEY);
    else storage?.setItem(SHARE_KEY, on ? '1' : '0');
  } catch { /* blocked storage: the choice holds for this session */ }
}
/** Device-bound leaderboard state a backup restore must not carry to another phone (D-92). */
export const IDENTITY_KEYS: readonly string[] = [TOKEN_KEY, QUEUE_KEY];

function storageTokens(storage: QueueStorage | null): TokenStore {
  return {
    load: () => {
      try {
        const raw = storage?.getItem(TOKEN_KEY);
        const parsed = raw ? JSON.parse(raw) as Session : null;
        return parsed && typeof parsed.uid === 'string' && typeof parsed.refreshToken === 'string' ? parsed : null;
      } catch { return null; }
    },
    save: (session) => { try { storage?.setItem(TOKEN_KEY, JSON.stringify(session)); } catch { /* blocked */ } },
    clear: () => {
      try { if (storage?.removeItem) storage.removeItem(TOKEN_KEY); else storage?.setItem(TOKEN_KEY, ''); } catch { /* blocked */ }
    },
  };
}

const DISABLED: Leaderboards = {
  enabled: false,
  submitDaily: async () => 'disabled',
  flush: async () => {},
  boards: async () => null,
  hasData: () => false,
  deleteMyData: async () => 'none',
  isSharing: () => false,
  setSharing: () => {},
};

export function createLeaderboards(options: {
  config: NetConfig | null;
  fetch?: Fetch;
  storage?: QueueStorage | null;
  now?: () => number;
}): Leaderboards {
  const { config } = options;
  // Bound: browsers throw "Illegal invocation" when fetch is called as a method of another object.
  const fetcher = options.fetch ?? (typeof fetch === 'function' ? (fetch.bind(globalThis) as unknown as Fetch) : undefined);
  if (!config || !fetcher) return DISABLED;
  const storage = options.storage ?? null;
  const now = options.now ?? (() => Date.now());
  const client = new FirebaseRestClient(config, fetcher, storageTokens(storage), now);
  const queue = new SubmissionQueue(storage, now);
  let last: LeaderboardStatus = 'idle';
  let sharing = readSharing(storage);

  async function send(submission: DailySubmission): Promise<SendResult> {
    try {
      const response = await client.call<SubmitResponse>('submitDaily', { submission });
      if (!response.accepted && response.reason === 'paused') { last = 'queued'; return 'retry'; }
      last = response.accepted ? 'sent' : 'rejected';
      return response.accepted ? 'accepted' : 'rejected';
    } catch (error) {
      // Offline, auth hiccups and server errors retry later; a structural rejection does not.
      if (error instanceof NetError && error.code === 'rejected') { last = 'rejected'; return 'rejected'; }
      last = 'queued';
      return 'retry';
    }
  }

  return {
    enabled: true,
    async submitDaily(submission) {
      if (!sharing) return 'opted-out';
      if (!selfCheck(submission).ok) return 'rejected';
      queue.add(submission);
      last = 'queued';
      await queue.flush(send);
      return last;
    },
    async flush() { if (sharing) await queue.flush(send); },
    async boards(dateKey) {
      if (!sharing) return null;
      try {
        const ids = boardsForDaily(dateKey);
        return await client.call<Boards>('getBoards', { daily: ids.daily, weekly: ids.weekly });
      } catch { return null; }
    },
    hasData: () => client.uid !== null || queue.list().length > 0,
    async deleteMyData() {
      if (client.uid === null) { queue.clear(); return 'none'; }
      try {
        await client.call<{ deleted: boolean }>('deleteMyData', {});
      } catch (error) {
        if (error instanceof NetError && error.code === 'offline') return 'offline';
        // The account is already gone (an earlier deletion whose answer was lost): nothing is left to delete.
        if (!(error instanceof NetError && /USER_NOT_FOUND|USER_DISABLED/.test(error.message))) return 'failed';
      }
      client.forget();
      queue.clear();
      last = 'idle';
      return 'deleted';
    },
    isSharing: () => sharing,
    setSharing(on) {
      sharing = on;
      writeSharing(storage, on);
      if (!on) { queue.clear(); last = 'idle'; }
    },
  };
}

/** Composition-root helper: config from Vite env, storage from the browser. */
export function createBrowserLeaderboards(env: Readonly<Record<string, string | boolean | undefined>>): Leaderboards {
  let storage: QueueStorage | null = null;
  try { storage = globalThis.localStorage ?? null; } catch { storage = null; }
  return createLeaderboards({ config: readNetConfig(env), storage });
}
