// [task-35] Air-cargo label content for the weekly upgrade board.
// Every number comes from the simulation: plane specs from PLANE_TYPES, and the exact effect of each
// upgrade from a dry run of chooseUpgrade() on throwaway adapters (the same probe world.ts uses to
// validate a ChooseUpgrade command). Nothing here mutates the sim.
import { PLANE_TYPES } from '../../sim';
import { MIN_TRANSFER_TICKS } from '../../sim/params';
import { chooseUpgrade, mostLoadedHub } from '../../sim/upgrades';
import type { HubPressure, UpgradeKind } from '../../sim/upgrades';
import { localNumber, t } from '../../i18n';

/** What one pick of each upgrade actually does, read back from the simulation. */
export interface UpgradeFacts {
  readonly planes: Readonly<Record<'turboprop' | 'widebody', { readonly rangeKm: number; readonly seats: number; readonly count: number }>>;
  readonly hub: { readonly extraSeats: number; readonly transferFrom: number; readonly transferTo: number };
  readonly slots: { readonly count: number };
}

/** [task-32] Live departure-slot pressure of one airport (from CityView / hubCauseLedger). */
export interface SlotPressure {
  readonly cityId: string;
  readonly label: string;
  /** Aircraft held for a slot right now. */
  readonly held: number;
  /** Aircraft-minutes waited for a slot so far this run. */
  readonly waitMinutes: number;
}

/** Stable pick for the slot stamp: most waiting minutes, then most held aircraft, then lexical id. */
export function mostSlotStarved(airports: readonly SlotPressure[]): SlotPressure | undefined {
  return [...airports].filter((a) => a.waitMinutes > 0 || a.held > 0).sort((a, b) =>
    b.waitMinutes - a.waitMinutes || b.held - a.held || (a.cityId < b.cityId ? -1 : a.cityId > b.cityId ? 1 : 0))[0];
}

export interface CardRow { readonly label: string; readonly value: string }
export interface CardModel {
  readonly kind: UpgradeKind;
  /** Stencil header code, e.g. TP-48. */
  readonly code: string;
  /** "1/3" counter in the header. */
  readonly counter: string;
  readonly title: string;
  readonly rows: readonly CardRow[];
  /** Red context stamp; only the card the context is about carries one. */
  readonly stamp?: string;
  /** [night-11r] R5e: what the stamp measures ("fullest hub", "longest slot wait"); absent for "No hub yet". */
  readonly stampCaption?: string;
  /** True when the upgrade cannot be applied right now (e.g. hub expansion without any hub). */
  readonly unavailable: boolean;
}

let cached: UpgradeFacts | null = null;

/** Probes chooseUpgrade() once per kind and records what its effect adapters receive. */
export function upgradeFacts(): UpgradeFacts {
  if (cached) return cached;
  const probe = (upgrade: UpgradeKind) => {
    const seen = { planeCount: 0, hubExtra: 0, hubMct: 0, slots: 0 };
    const state = { week: 1, paused: true, offers: [{ id: upgrade, week: 1 }], pendingHub: false } as const;
    const targeted = upgrade === 'hub-expansion' || upgrade === 'departure-slots'; // [task-32]
    chooseUpgrade(state, { type: 'ChooseUpgrade', week: 1, upgrade, ...(targeted ? { hubId: 'probe' } : {}) }, {
      grantPlane: (_type, count) => { seen.planeCount = count; },
      expandHub: (_hub, extra, mct) => { seen.hubExtra = extra; seen.hubMct = mct; },
      addDepartureSlots: (count) => { seen.slots = count; },
    }, ['probe'], ['probe']);
    return seen;
  };
  const hub = probe('hub-expansion');
  cached = {
    planes: {
      turboprop: { rangeKm: PLANE_TYPES.turboprop.rangeKm, seats: PLANE_TYPES.turboprop.seats, count: probe('turboprop').planeCount },
      widebody: { rangeKm: PLANE_TYPES.widebody.rangeKm, seats: PLANE_TYPES.widebody.seats, count: probe('widebody').planeCount },
    },
    hub: { extraSeats: hub.hubExtra, transferFrom: MIN_TRANSFER_TICKS, transferTo: hub.hubMct },
    slots: { count: probe('departure-slots').slots },
  };
  return cached;
}

const number = (value: number) => localNumber(value); // [task-37] D-61

export function upgradeTitle(kind: UpgradeKind): string {
  return t(kind === 'turboprop' ? 'upgrade.turboprop' : kind === 'widebody' ? 'upgrade.widebody'
    : kind === 'hub-expansion' ? 'upgrade.hub' : 'upgrade.slots');
}

/** Builds the label for offer `index` of `total`; `hubs` is the live hub pressure for the context stamp. */
export function cardModel(kind: UpgradeKind, index: number, total: number, hubs: readonly HubPressure[],
  facts: UpgradeFacts = upgradeFacts(), airports: readonly SlotPressure[] = []): CardModel {
  const counter = t('upgrade.counter', { index: index + 1, total });
  const title = upgradeTitle(kind);
  if (kind === 'turboprop' || kind === 'widebody') {
    const plane = facts.planes[kind];
    return {
      kind, counter, title, unavailable: false,
      code: t(kind === 'turboprop' ? 'upgrade.code.turboprop' : 'upgrade.code.widebody', { seats: plane.seats }),
      rows: [
        { label: t('upgrade.field.range'), value: t('upgrade.value.km', { km: number(plane.rangeKm) }) },
        { label: t('upgrade.field.seats'), value: number(plane.seats) },
        { label: t('upgrade.field.best'), value: t(kind === 'turboprop' ? 'upgrade.value.turbopropBest' : 'upgrade.value.widebodyBest') },
      ],
    };
  }
  if (kind === 'hub-expansion') {
    const busiest = mostLoadedHub(hubs);
    return {
      kind, counter, title, unavailable: !busiest,
      code: t('upgrade.code.hub', { seats: facts.hub.extraSeats }),
      rows: [
        { label: t('upgrade.field.places'), value: t('upgrade.value.hubPlaces', { count: facts.hub.extraSeats }) },
        { label: t('upgrade.field.transfer'), value: t('upgrade.value.transfer', { from: facts.hub.transferFrom, to: facts.hub.transferTo }) },
        { label: t('upgrade.field.for'), value: t('upgrade.value.hubFor') },
      ],
      // [night-11r] R5e: a hub with nobody waiting is not "fullest" at 0/36: the stamp says "none yet".
      stamp: !busiest ? t('upgrade.noHub') : busiest.waiting > 0
        ? t('upgrade.stamp', { hub: busiest.label.toUpperCase(), waiting: busiest.waiting, capacity: busiest.capacity })
        : t('upgrade.stampNone'),
      ...(busiest ? { stampCaption: t('upgrade.stampCaption.hub') } : {}),
    };
  }
  // Departure slots (D-28/D-41, task 32): same label grid; the stamp names the airport whose aircraft
  // waited longest for a slot (only when one did).
  const starved = mostSlotStarved(airports);
  return {
    kind, counter, title, unavailable: false,
    ...(starved ? {
      stamp: t('upgrade.slotStamp', { airport: starved.label.toUpperCase(), minutes: number(starved.waitMinutes) }),
      stampCaption: t('upgrade.stampCaption.slots'),
    } : {}),
    code: t('upgrade.code.slots', { count: facts.slots.count }),
    rows: [
      { label: t('upgrade.field.departures'), value: t('upgrade.value.slots', { count: facts.slots.count }) },
      { label: t('upgrade.field.for'), value: t('upgrade.value.slotsFor') },
    ],
  };
}

/**
 * [night-12ba] R2k, D-247: the weekly contract as the board shows it: next week's contract (null when no pair of
 * regions qualifies), the one that just ended (null on the first board) and the card the met contract added.
 */
export interface ContractBoard {
  readonly next: { readonly regions: readonly [string, string]; readonly target: number } | null;
  readonly last: { readonly delivered: number; readonly target: number; readonly met: boolean } | null;
  readonly extraCrate: string | null;
}
