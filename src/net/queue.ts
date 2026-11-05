// [night-06] Offline queue: a finished official daily run is stored until the server accepts or rejects it.
// One entry per day key (the official run is unique per day), persisted in local storage, bounded.
import type { DailySubmission } from './submission.ts';

export interface QueueStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void }
export interface QueuedRun { readonly submission: DailySubmission; readonly attempts: number; readonly nextAttemptAt: number }

export const QUEUE_KEY = 'aw-net-queue-v1';
export const MAX_QUEUED = 8;
const BACKOFF_MS = [0, 30_000, 120_000, 600_000, 3_600_000];

export type SendResult = 'accepted' | 'rejected' | 'retry';

/** One queued run: the same day, seed and journal length is the same run (a newer run of the day replaces it). */
function runKey(item: QueuedRun): string {
  const submission = item.submission;
  return `${submission.dateKey}|${submission.seed}|${submission.endTick}|${submission.claimedScore}|${(submission.journal ?? []).length}`;
}

export class SubmissionQueue {
  /** In-memory copy for when storage is missing or blocked: the run still goes out in this session. */
  private memory: QueuedRun[] = [];
  /**
   * [night-11ak] R7l: bumped by `clear()`. A flush that sees it change stops sending and writes nothing back, so an
   * objection or a deletion made while a request is in flight drops the waiting runs for good (D-186, D-237).
   */
  private generation = 0;

  constructor(private readonly storage: QueueStorage | null, private readonly now: () => number = () => Date.now()) {}

  list(): QueuedRun[] {
    if (!this.storage) return this.memory.slice();
    try {
      const raw = this.storage.getItem(QUEUE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object' && item.submission) : [];
    } catch { return this.memory.slice(); }
  }

  private write(items: readonly QueuedRun[]): void {
    this.memory = items.slice();
    try { this.storage?.setItem(QUEUE_KEY, JSON.stringify(items)); } catch { /* storage full or blocked: memory copy */ }
  }

  /** [night-12k] D-114: drop every queued run (the player deleted their leaderboard data). */
  clear(): void { this.generation++; this.write([]); }

  /** Newest run for a day replaces an older one; the oldest days drop out beyond MAX_QUEUED. */
  add(submission: DailySubmission): void {
    const items = this.list().filter((item) => item.submission.dateKey !== submission.dateKey);
    items.push({ submission, attempts: 0, nextAttemptAt: this.now() });
    items.sort((a, b) => (a.submission.dateKey < b.submission.dateKey ? -1 : 1));
    this.write(items.slice(-MAX_QUEUED));
  }

  /**
   * Try every due entry once; accepted and rejected entries leave the queue, others back off.
   * [night-11ak] The write-back merges with the queue as it is then: a run added while a request was in flight is
   * kept (it used to be overwritten), and after a `clear()` during the flush nothing more is sent or written.
   */
  async flush(send: (submission: DailySubmission) => Promise<SendResult>): Promise<{ sent: number; left: number }> {
    const generation = this.generation;
    let sent = 0;
    const outcome = new Map<string, QueuedRun | null>();
    for (const item of this.list()) {
      if (this.generation !== generation) return { sent, left: 0 };
      if (item.nextAttemptAt > this.now()) continue;
      const result = await send(item.submission).catch((): SendResult => 'retry');
      if (result === 'retry') {
        const attempts = item.attempts + 1;
        outcome.set(runKey(item), { ...item, attempts, nextAttemptAt: this.now() + BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] });
      } else { sent++; outcome.set(runKey(item), null); }
    }
    if (this.generation !== generation) return { sent, left: 0 };
    const remaining: QueuedRun[] = [];
    for (const item of this.list()) {
      const key = runKey(item);
      if (!outcome.has(key)) remaining.push(item);
      else if (outcome.get(key)) remaining.push(outcome.get(key)!);
    }
    this.write(remaining);
    return { sent, left: remaining.length };
  }
}
