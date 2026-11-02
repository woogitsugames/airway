import type { SimSpeed } from './clock.ts';

/** All input is an event with integer, already-precomputed travel times. */
export type Command =
  | { readonly type: 'AddRoute'; readonly routeId: string; readonly fromCityId: string; readonly toCityId: string; readonly flightTicks: number }
  | { readonly type: 'ExtendRoute'; readonly routeId: string; readonly cityId: string; readonly flightTicks: number }
  | { readonly type: 'RemoveRoute'; readonly routeId: string }
  | { readonly type: 'AssignPlane'; readonly planeId: string; readonly routeId: string }
  | { readonly type: 'UnassignPlane'; readonly planeId: string }
  | { readonly type: 'UpgradeHub'; readonly hubId: string }
  | { readonly type: 'ChooseUpgrade'; readonly upgradeId: string }
  | { readonly type: 'SetSpeed'; readonly speed: SimSpeed };

/** The command journal uses the [executionTick, command] replay format. */
export type CommandEntry = readonly [tick: number, command: Command];

/** Domain-specific validation will be implemented by the route/plane/hub tasks. */
export function validateCommand(_command: Command): boolean {
  return true;
}

export function isCommandType(value: unknown): value is Command['type'] {
  switch (value) {
    case 'AddRoute':
    case 'ExtendRoute':
    case 'RemoveRoute':
    case 'AssignPlane':
    case 'UnassignPlane':
    case 'UpgradeHub':
    case 'ChooseUpgrade':
    case 'SetSpeed': return true;
    default: return false;
  }
}
