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
export interface WeeklyUpgradeState { readonly week: number; readonly paused: boolean; readonly offers: readonly UpgradeOffer[]; readonly pendingHub: boolean; readonly selected?: UpgradeKind; readonly lastChoice?: UpgradeCommand }
const POOL: readonly UpgradeKind[] = ['turboprop', 'widebody', 'hub-expansion', 'departure-slots'];
export function drawUpgradeOffers(week: number, rng: UpgradeRng): UpgradeOffer[] {
  if (!Number.isSafeInteger(week) || week < 1) throw new RangeError('Invalid week');
  const airplane = rng.nextInt(2);
  if (!Number.isInteger(airplane) || airplane < 0 || airplane > 1) throw new RangeError('Invalid RNG draw');
  const remaining = POOL.filter((_, index) => index !== airplane);
  const result: UpgradeKind[] = [POOL[airplane]];
  for (let i = 0; i < 2; i++) {
    const index = rng.nextInt(remaining.length);
    if (!Number.isInteger(index) || index < 0 || index >= remaining.length) throw new RangeError('Invalid RNG draw');
    result.push(remaining.splice(index, 1)[0]!);
  }
  // Shuffle to avoid always presenting the guaranteed aircraft first.
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new RangeError('Invalid RNG draw');
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result.map(id => ({ id, week }));
}
export function startWeeklyUpgrade(tick: number, rng: UpgradeRng): WeeklyUpgradeState | null {
  if (!Number.isSafeInteger(tick) || tick <= 0 || tick % TICKS_PER_WEEK !== 0) return null;
  const week = tick / TICKS_PER_WEEK;
  return { week, paused: true, offers: drawUpgradeOffers(week, rng), pendingHub: false };
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
