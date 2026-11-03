// [night-10l] Best result per puzzle: the widest margin over the target of a cleared run, beside the stars
// (stars stay in `airway.puzzles.v1`, read by the menu). Pure over a Storage-like object so it runs headless.

export const PUZZLE_BEST_KEY = 'airway.puzzles.margin.v1';
/** Largest margin kept: a run can beat its target several times over, but the board column has room for 4 digits. */
export const MAX_MARGIN = 9999;
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export type PuzzleMargins = Record<string, number>;

/** Margins of the given levels; anything malformed or unreadable is dropped (never throws). */
export function readPuzzleMargins(storage: StorageLike | undefined, levelIds: readonly string[]): PuzzleMargins {
  const result: PuzzleMargins = {};
  try {
    const raw = storage?.getItem(PUZZLE_BEST_KEY);
    if (!raw) return result;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return result;
    for (const id of levelIds) {
      const value = (parsed as Record<string, unknown>)[id];
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_MARGIN) result[id] = value;
    }
  } catch { /* Storage may be denied or hold garbage; the board then shows stars only. */ }
  return result;
}

/**
 * Record a cleared run. Returns 'first' for the first clear, 'better' for a wider margin, 'same' otherwise; the
 * margins object is updated in place and written back (a failed write keeps the session's value).
 */
export function recordPuzzleMargin(storage: StorageLike | undefined, margins: PuzzleMargins, levelId: string,
    marginPercent: number): 'first' | 'better' | 'same' {
  const margin = Math.max(0, Math.min(MAX_MARGIN, Math.floor(marginPercent)));
  const previous = margins[levelId];
  if (previous !== undefined && previous >= margin) return 'same';
  margins[levelId] = margin;
  try { storage?.setItem(PUZZLE_BEST_KEY, JSON.stringify(margins)); } catch { /* keep the session value */ }
  return previous === undefined ? 'first' : 'better';
}
