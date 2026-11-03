// [task-15] Local high score is independent of save-game lifecycle (task 16).
export const BEST_RECORD_KEY = 'airway.gameover.best.v1';

export interface GameOverBest {
  readonly score: number;
  readonly weeks: number;
  readonly seed: number;
}

export interface BestStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function validRecord(value: unknown): value is GameOverBest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<GameOverBest>;
  return typeof record.score === 'number' && Number.isSafeInteger(record.score) && record.score >= 0
    && typeof record.weeks === 'number' && Number.isSafeInteger(record.weeks) && record.weeks >= 0
    && typeof record.seed === 'number' && Number.isSafeInteger(record.seed)
    && record.seed >= 0 && record.seed <= 0xffffffff;
}

export function readBestRecord(storage?: BestStorage): GameOverBest | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(BEST_RECORD_KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    return validRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function persistBestRecord(
  storage: BestStorage | undefined,
  current: GameOverBest,
): { readonly best: GameOverBest | null; readonly isNewRecord: boolean } {
  const prior = readBestRecord(storage);
  if (!validRecord(current)) return { best: prior, isNewRecord: false };
  // [night-11b] A flight that delivered nobody is no record: the first run of a fresh profile jamming with 0
  // passengers announced "New local record" and the menu then read "record 0".
  if (current.score === 0) return { best: prior, isNewRecord: false };
  const beatsPrior = !prior || current.score > prior.score
    || (current.score === prior.score && current.weeks > prior.weeks);
  if (!beatsPrior) return { best: prior, isNewRecord: false };
  try {
    storage?.setItem(BEST_RECORD_KEY, JSON.stringify(current));
    return { best: storage ? current : null, isNewRecord: Boolean(storage) };
  } catch {
    return { best: prior, isNewRecord: false };
  }
}
