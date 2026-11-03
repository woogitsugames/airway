// [night-07b] D-74: remember the adaptive quality downgrade between sessions, so a slow phone does not
// stutter through the same three detection windows (about 8 s under 24 fps) after every launch.
// Only the `auto` preference uses it; an explicit graphics choice in settings forgets it.
import type { AdaptiveStep } from '../render';

export const ADAPTIVE_MEMORY_KEY = 'airway.adaptiveQuality';
/** A record older than this is ignored: the phone, OS or game may have changed, so detect afresh. */
export const ADAPTIVE_MEMORY_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const STEPS: readonly AdaptiveStep[] = ['pixel-ratio', 'decorations', 'terrain'];

export interface AdaptiveMemory {
  readonly v: 1;
  readonly steps: readonly AdaptiveStep[];
  /** Epoch ms of the latest step. */
  readonly at: number;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStore(): Store | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Pure: validated record or null (bad JSON, unknown step, duplicates, expired, from the future). */
export function parseAdaptiveMemory(raw: string | null, now: number): AdaptiveMemory | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== 'object') return null;
  const record = value as { v?: unknown; steps?: unknown; at?: unknown };
  if (record.v !== 1 || !Array.isArray(record.steps) || typeof record.at !== 'number') return null;
  const steps = record.steps as unknown[];
  if (steps.length === 0 || steps.length > STEPS.length) return null;
  if (!steps.every((step, i) => STEPS.includes(step as AdaptiveStep) && steps.indexOf(step) === i)) return null;
  if (!(record.at <= now) || now - record.at > ADAPTIVE_MEMORY_MAX_AGE_MS) return null;
  return { v: 1, steps: steps as AdaptiveStep[], at: record.at };
}

export function readAdaptiveSteps(now = Date.now(), store: Store | null = defaultStore()): AdaptiveStep[] {
  try { return parseAdaptiveMemory(store?.getItem(ADAPTIVE_MEMORY_KEY) ?? null, now)?.steps.slice() ?? []; }
  catch { return []; }
}

export function writeAdaptiveSteps(steps: readonly AdaptiveStep[], now = Date.now(), store: Store | null = defaultStore()): void {
  try {
    if (steps.length === 0) store?.removeItem(ADAPTIVE_MEMORY_KEY);
    else store?.setItem(ADAPTIVE_MEMORY_KEY, JSON.stringify({ v: 1, steps, at: now } satisfies AdaptiveMemory));
  } catch { /* Storage may be full or denied; the next session simply detects again. */ }
}

export function forgetAdaptiveSteps(store: Store | null = defaultStore()): void {
  try { store?.removeItem(ADAPTIVE_MEMORY_KEY); } catch { /* see writeAdaptiveSteps */ }
}
