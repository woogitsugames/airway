// [night-06] D-66 online leaderboards facade: disabled without config, offline-first submission queue,
// read-only boards. The server (functions/) replays every run with the same Sim before it counts.
import { FirebaseRestClient, NetError, type Fetch, type Session, type TokenStore } from './client.ts';
import { readNetConfig, type NetConfig } from './config.ts';
import { SubmissionQueue, type QueueStorage, type SendResult } from './queue.ts';
import { selfCheck, type DailySubmission, type RejectReason } from './submission.ts';
import { boardsForDaily } from './boards.ts';

export { readNetConfig } from './config.ts';
export { boardsForDaily, dailyBoardId, weeklyBoardId, weekKeyForDate, todayKey } from './boards.ts';
export { buildDailySubmission, verifyDailySubmission, type DailySubmission, type Verdict } from './submission.ts';

export interface BoardEntry { readonly rank: number; readonly callSign: string; readonly score: number; readonly me: boolean }
export interface Board { readonly id: string; readonly entries: readonly BoardEntry[]; readonly me: BoardEntry | null }
export interface Boards { readonly daily: Board; readonly weekly: Board }
export interface SubmitResponse { readonly accepted: boolean; readonly reason?: RejectReason; readonly score?: number }

export type LeaderboardStatus = 'disabled' | 'idle' | 'queued' | 'sent' | 'rejected';

export interface Leaderboards {
  readonly enabled: boolean;
  /** Queue a finished official daily run and try to send it now; never throws. */
  submitDaily(submission: DailySubmission): Promise<LeaderboardStatus>;
  /** Retry queued runs (app start, back online). */
  flush(): Promise<void>;
  /** Daily + weekly boards for a Warsaw day key; null when disabled or offline. */
  boards(dateKey: string): Promise<Boards | null>;
}

const TOKEN_KEY = 'aw-net-session-v1';

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
  };
}

const DISABLED: Leaderboards = {
  enabled: false,
  submitDaily: async () => 'disabled',
  flush: async () => {},
  boards: async () => null,
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

  async function send(submission: DailySubmission): Promise<SendResult> {
    try {
      const response = await client.call<SubmitResponse>('submitDaily', { submission });
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
      if (!selfCheck(submission).ok) return 'rejected';
      queue.add(submission);
      last = 'queued';
      await queue.flush(send);
      return last;
    },
    async flush() { await queue.flush(send); },
    async boards(dateKey) {
      try {
        const ids = boardsForDaily(dateKey);
        return await client.call<Boards>('getBoards', { daily: ids.daily, weekly: ids.weekly });
      } catch { return null; }
    },
  };
}

/** Composition-root helper: config from Vite env, storage from the browser. */
export function createBrowserLeaderboards(env: Readonly<Record<string, string | boolean | undefined>>): Leaderboards {
  let storage: QueueStorage | null = null;
  try { storage = globalThis.localStorage ?? null; } catch { storage = null; }
  return createLeaderboards({ config: readNetConfig(env), storage });
}
