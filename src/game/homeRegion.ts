// [night-11aj] R2g: the Endless home region the player picked on the menu (Random by default). Kept as one field of
// the settings record ('airway.settings', device only); a run carries its own copy in its GameConfig (D-236).
import type { RegionId } from '../data/regions';
import { HOME_REGIONS } from '../sim';

const KEY = 'airway.settings';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The menu's choices in order: Random first, then every region with a start cluster. */
export const HOME_REGION_CHOICES: readonly ('random' | RegionId)[] = Object.freeze(['random', ...HOME_REGIONS]);

export function isHomeRegion(value: unknown): value is RegionId {
  return (HOME_REGIONS as readonly unknown[]).includes(value);
}

function record(storage: StorageLike | undefined): Record<string, unknown> {
  try {
    const raw = storage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

/** The stored choice; null = Random (also for a missing, unreadable or no longer offered region). Never throws. */
export function readHomeRegion(storage: StorageLike | undefined): RegionId | null {
  const value = record(storage).homeRegion;
  return isHomeRegion(value) ? value : null;
}

/** Store the choice (null = Random) next to the other settings; a blocked storage keeps it for this session only. */
export function writeHomeRegion(storage: StorageLike | undefined, region: RegionId | null): void {
  const next = { ...record(storage) };
  if (region && isHomeRegion(region)) next.homeRegion = region;
  else delete next.homeRegion;
  try { storage?.setItem(KEY, JSON.stringify(next)); } catch { /* Storage denied. */ }
}
