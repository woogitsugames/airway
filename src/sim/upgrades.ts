/**
 * Weekly upgrade selection is independent of the host simulation.
 * The kernel world (world.ts) calls it at each week boundary and on ChooseUpgrade commands.
 * All random numbers come from the kernel's 'upgrades' RNG stream.
 */
import { TICKS_PER_WEEK } from './clock.ts';
import { DEPARTURE_SLOT_UPGRADE } from './params.ts';
// [task-31] The week length comes from params.ts via clock.ts (D-40).
export { TICKS_PER_WEEK };
export type UpgradeKind = 'turboprop' | 'widebody' | 'hub-expansion' | 'departure-slots';
export interface UpgradeOffer { readonly id: UpgradeKind; readonly week: number }
export interface UpgradeRng { nextInt(maxExclusive: number): number }
export interface HubPressure { readonly hubId: string; readonly waiting: number; readonly capacity: number; readonly label: string }
/**
 * `hubId` names the target airport of a targeted upgrade: the hub for 'hub-expansion' and (task 32,
 * D-41) any active airport for 'departure-slots'. It may arrive in a second command.
 */
export interface UpgradeCommand { readonly type: 'ChooseUpgrade'; readonly week: number; readonly upgrade: UpgradeKind; readonly hubId?: string }
export interface UpgradeEffects { grantPlane?: (type: 'turboprop' | 'widebody', count: number) => void; expandHub?: (hubId: string, extraCapacity: number, minimumConnectionMinutes: number) => void; addDepartureSlots?: (count: number, cityId: string) => void }
/** `pendingHub` = an airport pick is pending; `selected` tells which upgrade it is for. */
export interface WeeklyUpgradeState { readonly week: number; readonly paused: boolean; readonly offers: readonly UpgradeOffer[]; readonly pendingHub: boolean; readonly selected?: UpgradeKind; readonly lastChoice?: UpgradeCommand;
  /** [night-12ba] R2k: the card a met weekly contract added to this board (absent on every other board). */
  readonly extraCrate?: UpgradeKind }
const POOL: readonly UpgradeKind[] = ['turboprop', 'widebody', 'hub-expansion', 'departure-slots'];
/**
 * [night-12v] R8a, D-150: which targeted cards can act this week. "+2 slots" only after the run's first departure
 * hold, the hub expansion only while the network has a hub; a card that cannot act is not drawn, so its place goes
 * to the other aircraft card (a board may then show only the two aircraft). Omitted = both eligible (old pool).
 */
export interface UpgradeEligibility { readonly hub: boolean; readonly slots: boolean }
/**
 * [night-12ba] R2k, D-247: `extraCrate` (a met weekly contract) adds one more card, drawn after the usual ones from
 * the cards not on the board that can act at all: the hub card needs a hub; "+2 slots" can always target an airport,
 * so here it ignores the first-hold rule. Without `extraCrate` the RNG calls are exactly the old ones.
 * Returns fewer cards than asked only when no card is left (the caller then keeps the crate for a later board).
 */
export function drawUpgradeOffers(week: number, rng: UpgradeRng, eligible: UpgradeEligibility = { hub: true, slots: true },
  extraCrate = false): UpgradeOffer[] {
  return drawUpgradeBoard(week, rng, eligible, extraCrate).offers;
}
/** As drawUpgradeOffers, also naming the extra (contract) card when one was drawn. */
export function drawUpgradeBoard(week: number, rng: UpgradeRng, eligible: UpgradeEligibility = { hub: true, slots: true },
  extraCrate = false): { offers: UpgradeOffer[]; extraCrate?: UpgradeKind } {
  if (!Number.isSafeInteger(week) || week < 1) throw new RangeError('Invalid week');
  const airplane = rng.nextInt(2);
  if (!Number.isInteger(airplane) || airplane < 0 || airplane > 1) throw new RangeError('Invalid RNG draw');
  const remaining = POOL.filter((id, index) => index !== airplane &&
    (id !== 'hub-expansion' || eligible.hub) && (id !== 'departure-slots' || eligible.slots));
  const result: UpgradeKind[] = [POOL[airplane]];
  let extra: UpgradeKind | undefined;
  for (let i = 0; i < 2 && remaining.length > 0; i++) {
    const index = rng.nextInt(remaining.length);
    if (!Number.isInteger(index) || index < 0 || index >= remaining.length) throw new RangeError('Invalid RNG draw');
    result.push(remaining.splice(index, 1)[0]!);
  }
  if (extraCrate) {
    const spare = POOL.filter((id) => !result.includes(id) && (id !== 'hub-expansion' || eligible.hub));
    if (spare.length > 0) {
      const index = rng.nextInt(spare.length);
      if (!Number.isInteger(index) || index < 0 || index >= spare.length) throw new RangeError('Invalid RNG draw');
      extra = spare[index]!;
      result.push(extra);
    }
  }
  // Shuffle to avoid always presenting the guaranteed aircraft first.
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new RangeError('Invalid RNG draw');
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  const offers = result.map(id => ({ id, week }));
  return extra === undefined ? { offers } : { offers, extraCrate: extra };
}
export function startWeeklyUpgrade(tick: number, rng: UpgradeRng, eligible?: UpgradeEligibility, extraCrate = false): WeeklyUpgradeState | null {
  if (!Number.isSafeInteger(tick) || tick <= 0 || tick % TICKS_PER_WEEK !== 0) return null;
  const week = tick / TICKS_PER_WEEK;
  const board = drawUpgradeBoard(week, rng, eligible, extraCrate);
  return board.extraCrate === undefined ? { week, paused: true, offers: board.offers, pendingHub: false }
    : { week, paused: true, offers: board.offers, pendingHub: false, extraCrate: board.extraCrate };
}
/** Stable tie-breaking: larger fill ratio, then more waiting, then lexical ID. */
export function mostLoadedHub(hubs: readonly HubPressure[]): HubPressure | undefined {
  return [...hubs].filter(h => h.capacity > 0 && h.waiting >= 0).sort((a, b) =>
    b.waiting * a.capacity - a.waiting * b.capacity || b.waiting - a.waiting ||
    (a.hubId < b.hubId ? -1 : a.hubId > b.hubId ? 1 : 0))[0];
}
export function chooseUpgrade(state: WeeklyUpgradeState, command: UpgradeCommand, effects: UpgradeEffects, validHubIds: readonly string[],
  validSlotCityIds: readonly string[] = validHubIds): WeeklyUpgradeState {
  if (!state.paused || state.lastChoice || command.week !== state.week || !state.offers.some(o => o.id === command.upgrade)) throw new Error('Upgrade choice rejected');
  if (command.upgrade === 'hub-expansion') {
    if (!command.hubId) return { ...state, pendingHub: true, selected: command.upgrade };
    if (!validHubIds.includes(command.hubId)) throw new Error('Unknown hub');
    if (!effects.expandHub) throw new Error('Hub upgrade adapter unavailable');
    effects.expandHub(command.hubId, 6, 15);
  } else if (command.upgrade === 'departure-slots') {
    // [task-32] D-41: +2 hourly departures for one airport the player picks (same flow as the hub pick).
    if (!command.hubId) return { ...state, pendingHub: true, selected: command.upgrade };
    if (!validSlotCityIds.includes(command.hubId)) throw new Error('Unknown airport');
    if (!effects.addDepartureSlots) throw new Error('Departure slot adapter unavailable');
    effects.addDepartureSlots(DEPARTURE_SLOT_UPGRADE, command.hubId);
  } else if (command.hubId !== undefined) throw new Error('Unexpected hub');
  else {
    if (!effects.grantPlane) throw new Error('Plane upgrade adapter unavailable');
    effects.grantPlane(command.upgrade, 1);
  }
  return { ...state, paused: false, pendingHub: false, selected: command.upgrade, lastChoice: command };
}
/**
 * [task-39] D-49: undo the first half of a two-step targeted choice (hub expansion, "+2 slots") before
 * the airport is picked. Returns exactly the state the week's offer had before the card was chosen
 * (no `selected` key), so pick -> cancel -> choose another card equals choosing that card directly.
 */
export function cancelUpgradePick(state: WeeklyUpgradeState, week: number): WeeklyUpgradeState {
  if (!state.paused || state.lastChoice || !state.pendingHub || week !== state.week) throw new Error('No airport pick to cancel');
  const back: WeeklyUpgradeState = { week: state.week, paused: true, offers: state.offers.map((offer) => ({ ...offer })), pendingHub: false };
  return state.extraCrate === undefined ? back : { ...back, extraCrate: state.extraCrate };
}
