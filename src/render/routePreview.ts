/** Route preview view model and layer contract; the Linoryt dashed preview lives in `linoryt-objects.ts` (D-299). */
import type { Group } from 'three';
import type { AircraftKind, GeoWaypoint } from './routes';

/** Structurally identical to `RoutePreviewModel` from `src/input/routeTool.ts`. */
export interface RoutePreviewView {
  readonly points: readonly GeoWaypoint[];
  readonly legDistancesKm: readonly number[];
  readonly rangeKm: number;
  readonly aircraft: AircraftKind;
}

export interface RoutePreviewLayer {
  readonly object: Group;
  update(model: RoutePreviewView | null): void;
  dispose(): void;
}
