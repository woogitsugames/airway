// [night-11p] R6a / D-130: one-time "first time" cards in the real game. The pre-run training flight keeps three
// steps (route, aircraft, transfer); everything else is explained once, at the moment it first happens. This file is
// the registry (one storage key, one flag per card, versioned) and the pure triggers; first-time-card.ts draws them.
import type { TutorialStorage } from './controller';

export const FIRST_TIME_KEY = 'aw-first-time';
export const FIRST_TIME_VERSION = 1;
/** [task-32] The departure-slot hint predates the registry and keeps its own flag, read and written here. */
export const LEGACY_SLOT_KEY = 'aw-tutorial-slots';
/**
 * [night-35a] D-272: 'surge' joins the list without a version bump: the saved `seen` list keeps every card already
 * shown, and a card id missing from it simply has not been shown yet, so nothing seen comes back.
 */
export const FIRST_TIME_CARDS = ['slots', 'hub-full', 'out-of-range', 'curfew', 'weekly-board', 'surge'] as const;
export type FirstTimeCard = (typeof FIRST_TIME_CARDS)[number];
/** A hub at or above this share of its waiting places shows the "hub filling up" card. */
export const HUB_FULL_SHARE = 0.7;

function isCard(value: unknown): value is FirstTimeCard {
  return typeof value === 'string' && (FIRST_TIME_CARDS as readonly string[]).includes(value);
}

export class FirstTimeRegistry {
  private readonly storage: TutorialStorage | null;
  private readonly seenCards = new Set<FirstTimeCard>();

  constructor(storage: TutorialStorage | null) {
    this.storage = storage;
    try {
      const raw = storage?.getItem(FIRST_TIME_KEY);
      const data: unknown = raw ? JSON.parse(raw) : null;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const saved = data as { v?: unknown; seen?: unknown };
        // An unknown version is ignored, so a later registry can re-introduce a reworded card.
        if (saved.v === FIRST_TIME_VERSION && Array.isArray(saved.seen)) {
          for (const card of saved.seen) if (isCard(card)) this.seenCards.add(card);
        }
      }
    } catch { /* Malformed or blocked storage: every card may show once this session. */ }
    try { if (storage?.getItem(LEGACY_SLOT_KEY) === '1') this.seenCards.add('slots'); } catch { /* optional */ }
  }

  seen(card: FirstTimeCard): boolean { return this.seenCards.has(card); }

  /** Marks a card as shown; it never shows again on this install. */
  mark(card: FirstTimeCard): void {
    if (this.seenCards.has(card)) return;
    this.seenCards.add(card);
    try {
      if (card === 'slots') this.storage?.setItem(LEGACY_SLOT_KEY, '1');
      else this.storage?.setItem(FIRST_TIME_KEY, JSON.stringify({
        v: FIRST_TIME_VERSION, seen: FIRST_TIME_CARDS.filter((id) => id !== 'slots' && this.seenCards.has(id)),
      }));
    } catch { /* Storage is optional. */ }
  }
}

/** [night-11r] D-192 (Q-76 → B): "Replay tutorial" brings every first-time card back, the slot hint included. */
export function clearFirstTimeCards(storage: TutorialStorage | null): void {
  try {
    storage?.setItem(FIRST_TIME_KEY, JSON.stringify({ v: FIRST_TIME_VERSION, seen: [] }));
    storage?.setItem(LEGACY_SLOT_KEY, '0');
  } catch { /* Storage is optional. */ }
}

export interface FirstTimeCity {
  readonly id: string;
  readonly hub: boolean;
  readonly waiting: number;
  readonly capacity: number;
  readonly curfewClosed?: boolean;
}

/** The fullest hub at or above HUB_FULL_SHARE of its waiting places, or null. */
export function fillingHub<T extends FirstTimeCity>(cities: readonly T[]): T | null {
  let best: T | null = null;
  let bestShare = HUB_FULL_SHARE;
  for (const city of cities) {
    if (!city.hub || city.capacity <= 0) continue;
    const share = city.waiting / city.capacity;
    if (share >= bestShare) { best = city; bestShare = share; }
  }
  return best;
}

/** Distance from a newly opened airport to its nearest open airport, when that is beyond `rangeKm`; else null. */
export function beyondRange(
  cityId: string, openIds: readonly string[], rangeKm: number, distanceKm: (a: string, b: string) => number,
): number | null {
  let nearest = Infinity;
  for (const other of openIds) {
    if (other === cityId) continue;
    const km = distanceKm(cityId, other);
    if (km > 0 && km < nearest) nearest = km;
  }
  return Number.isFinite(nearest) && nearest > rangeKm ? nearest : null;
}

/** The first airport closed by the night curfew, or null. */
export function curfewAirport<T extends { readonly curfewClosed?: boolean }>(cities: readonly T[]): T | null {
  return cities.find((city) => city.curfewClosed) ?? null;
}

/**
 * [night-35a] D-272: the demand surge the "first time" card and its sound announce: an announced surge (hollow
 * pennant, not yet running) on an airport the player can see, in Endless only (Daily and puzzles never have one,
 * D-249; the mode check keeps it that way even if a later rule set turned surges on there).
 */
export function surgeAnnouncement<T extends { readonly cityId: string; readonly active: boolean }>(
  mode: string, view: T | null, visible: (cityId: string) => boolean,
): T | null {
  return mode === 'endless' && view && !view.active && visible(view.cityId) ? view : null;
}
