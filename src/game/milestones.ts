// [night-12ax] R1n, D-242: run milestones in Endless. Intermediate goals for a first run, read from the sim's public
// views by the game layer; no new rule, no reward, nothing written into the Sim or its hash (D-13). The game-over
// report shows which were reached in this run, and the logbook keeps the run in which each was first reached.
// No i18n or DOM imports, so Node tests (and src/game/logbook.ts) load it directly.

/**
 * In the order the report lists them (roughly the order a run meets them). D-270 (owner, Q-81 → B): week 4 and
 * 750 passengers replace the D-242 stretch goals week 5 and 1 000 passengers, which almost no bot run reached.
 */
export const MILESTONES = ['first-hub', 'all-regions', 'week-2', 'week-3', 'week-4', 'passengers-500', 'passengers-750'] as const;
export type MilestoneId = typeof MILESTONES[number];

/**
 * D-270: ids a pre-D-270 logbook may hold, read as the goal that replaced them (a run that reached week 5 or
 * 1 000 passengers also reached week 4 or 750).
 */
export const LEGACY_MILESTONES: Readonly<Record<string, MilestoneId>> = Object.freeze({
  'week-5': 'week-4', 'passengers-1000': 'passengers-750',
});

/** "Every region served" needs at least this many regions open, so a one-region start cannot count. */
export const MIN_REGIONS_FOR_ALL = 2;

/** What the milestones read: counts from the sim view at one moment. */
export interface MilestoneView {
  /** Airports that are hubs right now (an airport on two routes or more). */
  readonly hubs: number;
  /** Regions with at least one open airport / with at least one airport on a route. */
  readonly regionsOpen: number;
  readonly regionsServed: number;
  /** Calendar week of the run (1 = the first week; week 2 starts when the first weekly board opens). */
  readonly week: number;
  /** Delivered passengers (the run's score). */
  readonly passengers: number;
}

interface CityLike { readonly id: string; readonly region: string; readonly hub: boolean }
interface RouteLike { readonly cityIds: readonly string[] }

/** The view from the run's read model (`EndlessRun.cityList()` / `routeList()`), a tick and the score. */
export function milestoneView(cities: readonly CityLike[], routes: readonly RouteLike[], tick: number, ticksPerWeek: number,
  passengers: number): MilestoneView {
  const onRoute = new Set<string>();
  for (const route of routes) for (const id of route.cityIds) onRoute.add(id);
  const open = new Set<string>();
  const served = new Set<string>();
  let hubs = 0;
  for (const city of cities) {
    open.add(city.region);
    if (onRoute.has(city.id)) served.add(city.region);
    if (city.hub) hubs++;
  }
  return { hubs, regionsOpen: open.size, regionsServed: served.size,
    week: Math.floor(Math.max(0, tick) / ticksPerWeek) + 1, passengers: Math.max(0, passengers) };
}

/**
 * Milestones true in this view. "Every region served" is checked only at a weekly board (`atBoard`): the week
 * closes with every region that has an open airport served by a route (and at least MIN_REGIONS_FOR_ALL of them).
 */
export function milestonesIn(view: MilestoneView, atBoard: boolean): MilestoneId[] {
  const hit: Record<MilestoneId, boolean> = {
    'first-hub': view.hubs > 0,
    'all-regions': atBoard && view.regionsOpen >= MIN_REGIONS_FOR_ALL && view.regionsServed === view.regionsOpen,
    'week-2': view.week >= 2,
    'week-3': view.week >= 3,
    'week-4': view.week >= 4,
    'passengers-500': view.passengers >= 500,
    'passengers-750': view.passengers >= 750,
  };
  return MILESTONES.filter((id) => hit[id]);
}

/** Keeps what a run has reached; a milestone once reached stays reached (a hub later closed still counted). */
export class MilestoneTracker {
  private readonly reached = new Set<MilestoneId>();
  observe(view: MilestoneView, atBoard = false): void {
    for (const id of milestonesIn(view, atBoard)) this.reached.add(id);
  }
  /** Reached so far, in MILESTONES order. */
  list(): MilestoneId[] { return MILESTONES.filter((id) => this.reached.has(id)); }
}

export function isMilestone(value: unknown): value is MilestoneId {
  return (MILESTONES as readonly unknown[]).includes(value);
}

/** One report item: reached in this run, and reached for the first time ever (the logbook had no run for it). */
export interface MilestoneItem { readonly id: MilestoneId; readonly reached: boolean; readonly first: boolean }

/** The report row: every milestone in order; `first` only for one reached now that the logbook lacked before. */
export function milestoneItems(reached: readonly MilestoneId[], first: readonly MilestoneId[]): MilestoneItem[] {
  return MILESTONES.map((id) => ({ id, reached: reached.includes(id), first: reached.includes(id) && first.includes(id) }));
}
