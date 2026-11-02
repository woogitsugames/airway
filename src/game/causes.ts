// [task-15] Read-only diagnostics adapter for the hub ledger owned by task 08.
// The adapter does not infer causes when a counter is absent.
export const REGION_CODES = ['NAM', 'SAM', 'EUN', 'EUS', 'AFR', 'ME'] as const;
export type RegionCode = (typeof REGION_CODES)[number];

export interface HubCauseLedger {
  readonly waiting: number;
  readonly capacity: number;
  readonly waitingByRegion?: Readonly<Partial<Record<RegionCode, number>>>;
  readonly noRoute?: number;
  readonly seatsUnavailable?: number;
  readonly missedTransfers?: number;
  readonly transferNotReady?: number;
  readonly waitingTooLong?: number;
  readonly congestedSeconds?: number;
}

export type CauseKind =
  | 'no-route'
  | 'regional-demand'
  | 'seat-shortage'
  | 'missed-transfer'
  | 'transfer-not-ready'
  | 'long-wait'
  | 'capacity'
  | 'congestion-duration'
  | 'unavailable';

export interface CauseFact {
  readonly kind: CauseKind;
  readonly params: Readonly<Record<string, number>>;
  readonly region?: RegionCode;
}

interface RankedCause {
  readonly fact: CauseFact;
  readonly severity: number;
  readonly order: number;
}

function nonnegative(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function percentage(part: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((100 * part) / total)) : 0;
}

/**
 * Rank three grounded and distinct explanations, using only task-08 ledger
 * counters that actually exist. A missing counter is not evidence of zero.
 * Equal scores use a fixed tie-breaker; insertion order is deterministic.
 */
export function buildCauseReport(ledger: HubCauseLedger): readonly CauseFact[] {
  const waiting = nonnegative(ledger.waiting);
  const capacity = nonnegative(ledger.capacity);
  const candidates: RankedCause[] = [];
  let order = 0;
  const add = (kind: CauseKind, severity: number, params: Record<string, number>, region?: RegionCode): void => {
    candidates.push({ fact: { kind, params, ...(region ? { region } : {}) }, severity, order: order++ });
  };

  if (ledger.waitingByRegion && waiting > 0) {
    let largest: RegionCode | undefined;
    let largestCount = 0;
    let reportedCount = 0;
    for (const region of REGION_CODES) {
      const count = nonnegative(ledger.waitingByRegion[region]);
      reportedCount += count;
      if (count > largestCount) {
        largestCount = count;
        largest = region;
      }
    }
    // A corrupt total should not lead to a claim of more than 100%.
    const share = percentage(largestCount, Math.max(waiting, reportedCount));
    if (largest && largestCount >= 3 && share >= 35) {
      add('regional-demand', 50 + Math.floor(share / 2), { percent: share, count: largestCount }, largest);
    }
  }

  const noRoute = nonnegative(ledger.noRoute);
  if (noRoute > 0) add('no-route', 60 + Math.min(30, noRoute), { count: noRoute });

  const seatsUnavailable = nonnegative(ledger.seatsUnavailable);
  if (seatsUnavailable > 0) {
    add('seat-shortage', 45 + Math.min(30, seatsUnavailable), { count: seatsUnavailable });
  }

  const missedTransfers = nonnegative(ledger.missedTransfers);
  if (missedTransfers > 0) {
    add('missed-transfer', 44 + Math.min(30, missedTransfers), { count: missedTransfers });
  }

  const transferNotReady = nonnegative(ledger.transferNotReady);
  if (transferNotReady > 0) {
    add('transfer-not-ready', 48 + Math.min(30, transferNotReady), { count: transferNotReady });
  }

  const waitingTooLong = nonnegative(ledger.waitingTooLong);
  if (waitingTooLong > 0) add('long-wait', 43 + Math.min(30, waitingTooLong), { count: waitingTooLong });

  if (capacity > 0 && waiting >= capacity) {
    add('capacity', 55 + Math.min(20, Math.floor((20 * waiting) / capacity)), { waiting, capacity });
  }

  const congestedSeconds = nonnegative(ledger.congestedSeconds);
  if (congestedSeconds > 0) {
    add('congestion-duration', 30 + Math.min(30, Math.floor(congestedSeconds / 2)), {
      seconds: congestedSeconds,
    });
  }

  candidates.sort((a, b) => b.severity - a.severity || a.order - b.order);
  const facts = candidates.slice(0, 3).map((item) => item.fact);
  while (facts.length < 3) {
    // Never fabricate a reason when task 08 has not recorded enough data.
    facts.push({ kind: 'unavailable', params: {} });
  }
  return facts;
}
