// [night-06] Offline queue: a finished official daily run is stored until the server accepts or rejects it.
// One entry per day key (the official run is unique per day), persisted in local storage, bounded.
import type { DailySubmission } from './submission.ts';

export interface QueueStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface QueuedRun { readonly submission: DailySubmission; readonly attempts: number; readonly nextAttemptAt: number }

export const QUEUE_KEY = 'aw-net-queue-v1';
export const MAX_QUEUED = 8;
const BACKOFF_MS = [0, 30_000, 120_000, 600_000, 3_600_000];

export type SendResult = 'accepted' | 'rejected' | 'retry';

export class SubmissionQueue {
  /** In-memory copy for when storage is missing or blocked: the run still goes out in this session. */
  private memory: QueuedRun[] = [];

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

  /** Newest run for a day replaces an older one; the oldest days drop out beyond MAX_QUEUED. */
  add(submission: DailySubmission): void {
    const items = this.list().filter((item) => item.submission.dateKey !== submission.dateKey);
    items.push({ submission, attempts: 0, nextAttemptAt: this.now() });
    items.sort((a, b) => (a.submission.dateKey < b.submission.dateKey ? -1 : 1));
    this.write(items.slice(-MAX_QUEUED));
  }

  /** Try every due entry once; accepted and rejected entries leave the queue, others back off. */
  async flush(send: (submission: DailySubmission) => Promise<SendResult>): Promise<{ sent: number; left: number }> {
    let sent = 0;
    const remaining: QueuedRun[] = [];
    for (const item of this.list()) {
      if (item.nextAttemptAt > this.now()) { remaining.push(item); continue; }
      const result = await send(item.submission).catch((): SendResult => 'retry');
      if (result === 'retry') {
        const attempts = item.attempts + 1;
        remaining.push({ ...item, attempts, nextAttemptAt: this.now() + BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] });
      } else sent++;
    }
    this.write(remaining);
    return { sent, left: remaining.length };
  }
}
