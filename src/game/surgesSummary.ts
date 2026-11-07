// [night-37a] D-295: one run's demand surges (D-249) counted the same way for the balance report
// (`scripts/balance-game-adapter.ts`, `balance:surges`) and the playtest record, so human runs compare with the bot.
// Pure and read-only: it reads the world's surge records, the tick and the failure (no Sim change, no hash change).
import type { SurgeRecord } from '../sim';

export interface SurgesSummary {
  /** Surges announced (shown on the globe) by `tick`, and those whose window opened by then. */
  readonly announced: number;
  readonly opened: number;
  /** Extra passengers the surges generated. */
  readonly extra: number;
  /** The run was lost at a surge airport during its window or within 6 game hours after it. */
  readonly lostAtSurge: boolean;
}

/** Game minutes after a window in which a loss at its airport still counts as lost at the surge. */
export const SURGE_LOSS_AFTER_MINUTES = 360;

export function surgesSummary(records: readonly SurgeRecord[], tick: number,
  failure: { readonly cityId: string } | null): SurgesSummary {
  const seen = records.filter((item) => item.announceTick <= tick);
  return {
    announced: seen.length,
    opened: seen.filter((item) => item.startTick <= tick).length,
    extra: seen.reduce((sum, item) => sum + item.extra, 0),
    lostAtSurge: !!failure && seen.some((item) => item.cityId === failure.cityId && tick >= item.startTick
      && tick < item.endTick + SURGE_LOSS_AFTER_MINUTES),
  };
}
