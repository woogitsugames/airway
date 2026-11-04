// [night-11f] R1j: one matter-of-fact tip on the game-over report, chosen by the run's leading cause from the hub
// ledger (src/game/causes.ts). Shown only in the player's first TIP_RUNS logged flights (src/game/logbook.ts) and
// never during play. Pure, so it runs headless (test:gameover-tip).
import type { CauseFact, CauseKind, RegionCode } from './causes';

/** Flights in the logbook (this one included) that still get a tip. */
export const TIP_RUNS = 10;

export type TipKind = 'hub-overflow' | 'region' | 'no-route' | 'seats' | 'transfer' | 'slot-wait';
export interface GameOverTip {
  readonly kind: TipKind;
  readonly region?: RegionCode;
}

const TIP_FOR: Readonly<Record<CauseKind, TipKind | null>> = {
  'capacity': 'hub-overflow',
  'congestion-duration': 'hub-overflow',
  'long-wait': 'hub-overflow',
  'regional-demand': 'region',
  'no-route': 'no-route',
  'seat-shortage': 'seats',
  'missed-transfer': 'transfer',
  'transfer-not-ready': 'transfer',
  'slot-wait': 'slot-wait',
  'unavailable': null,
};

/**
 * The tip for the report's ranked causes: the first cause that has one. An airport no route served gets no tip
 * here, because its departures board already says what would have helped (N11b), and a second line would repeat it.
 */
export function gameOverTip(facts: readonly CauseFact[], options: { readonly unserved: boolean }): GameOverTip | null {
  if (options.unserved) return null;
  for (const fact of facts) {
    const kind = TIP_FOR[fact.kind];
    if (!kind) continue;
    if (kind === 'region') return fact.region ? { kind, region: fact.region } : null;
    return { kind };
  }
  return null;
}

/** Tips are for learning the game: the first TIP_RUNS logged flights (0 = storage unavailable, still a first run). */
export function tipsForFlight(loggedFlights: number): boolean {
  return Number.isFinite(loggedFlights) && loggedFlights <= TIP_RUNS;
}

/**
 * [night-12y] R8b, D-187: the action line under "no route served {hub}". With a plane in the reserve the old line
 * ("connect a new airport…") is something the player could do; with none it was not (99 % of losses had an empty
 * reserve), so the line names the two moves that work without a spare aircraft. Unknown reserve = the old line.
 */
export type UnservedHint = 'gameover.unservedHint' | 'gameover.unservedNoSpare';
export function unservedHint(spareAircraft: number | undefined): UnservedHint {
  return spareAircraft === 0 ? 'gameover.unservedNoSpare' : 'gameover.unservedHint';
}
