// [night-10j] The pause sheet's matter-of-fact network summary: what the player has built and where the pressure
// is, read once when the game pauses (nothing changes while paused). Pure: rows of translated label/value pairs.
import { t, type TranslationKey } from '../i18n';
import { localClock } from './surge';

export interface PauseSummaryInput {
  readonly routes: number;
  /** Aircraft flying a route. */
  readonly assigned: number;
  /** Aircraft in reserve, not yet on a route. */
  readonly spare: number;
  /** Interchange hubs with their terminal load; the fullest one is shown. */
  readonly hubs: readonly { readonly label: string; readonly waiting: number; readonly capacity: number }[];
  /** Game minutes until the next weekly board opens; null in a mode without weekly boards. */
  readonly minutesToBoard: number | null;
  /** [night-12ba] R2k, D-247: the running weekly contract (region ids), absent/null without one. */
  readonly contract?: { readonly regions: readonly [string, string]; readonly delivered: number; readonly target: number } | null;
  /** [night-12bb] R2i, D-249: the announced or running demand surge (airport label, local hours), absent/null without one. */
  readonly surge?: { readonly airport: string; readonly passengers: number; readonly startLocalHour: number;
    readonly endLocalHour: number; readonly active: boolean } | null;
}
export interface PauseSummaryRow { readonly key: 'network' | 'hub' | 'board' | 'contract' | 'surge'; readonly label: string; readonly value: string }

/** Fullest hub by share of capacity, ties by waiting count, then by label (stable). */
function busiestHub(hubs: PauseSummaryInput['hubs']): PauseSummaryInput['hubs'][number] | null {
  let best: PauseSummaryInput['hubs'][number] | null = null;
  for (const hub of hubs) {
    if (hub.capacity <= 0) continue;
    if (!best) { best = hub; continue; }
    const share = hub.waiting * best.capacity - best.waiting * hub.capacity;
    if (share > 0 || (share === 0 && (hub.waiting > best.waiting || (hub.waiting === best.waiting && hub.label < best.label)))) {
      best = hub;
    }
  }
  return best;
}

export function pauseSummary(input: PauseSummaryInput): PauseSummaryRow[] {
  const rows: PauseSummaryRow[] = [{
    key: 'network', label: t('pause.summary.network'),
    value: t(input.spare > 0 ? 'pause.summary.networkSpare' : 'pause.summary.networkValue',
      { routes: input.routes, aircraft: input.assigned, spare: input.spare }),
  }];
  const hub = busiestHub(input.hubs);
  rows.push({
    key: 'hub', label: t('pause.summary.hub'),
    // [night-11r] R5e: "MAD 0/36" read as a jam figure; with nobody waiting anywhere the row says "none yet".
    value: hub && hub.waiting > 0 ? t('pause.summary.hubValue', { hub: hub.label, waiting: hub.waiting, capacity: hub.capacity })
      : t('pause.summary.noHub'),
  });
  if (input.minutesToBoard !== null) {
    const minutes = Math.max(0, Math.floor(input.minutesToBoard));
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    rows.push({
      key: 'board', label: t('pause.summary.board'),
      value: days > 0 ? t('pause.summary.inDays', { days, hours }) : t('pause.summary.inHours', { hours, minutes: minutes % 60 }),
    });
  }
  if (input.contract) {
    // [night-12ba] R2k: progress of this week's contract, short region names (the sheet is one line per row).
    const { regions: [from, to], delivered, target } = input.contract;
    rows.push({
      key: 'contract', label: t('pause.summary.contract'),
      value: t(delivered >= target ? 'pause.summary.contractMet' : 'pause.summary.contractValue', {
        from: t(`region.short.${from}` as TranslationKey), to: t(`region.short.${to}` as TranslationKey), delivered, target }),
    });
  }
  if (input.surge) {
    // [night-12bb] R2i: the airport, its extra passengers and the window on its local clock.
    const { airport, passengers, startLocalHour, endLocalHour, active } = input.surge;
    rows.push({
      key: 'surge', label: t('pause.summary.surge'),
      value: t(active ? 'pause.summary.surgeActive' : 'pause.summary.surgeSoon',
        { airport, count: passengers, from: localClock(startLocalHour), to: localClock(endLocalHour) }),
    });
  }
  return rows;
}
