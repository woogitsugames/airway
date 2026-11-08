// Airport layer contract (read-only render state). [ext-04] The medallion pads, hub seat rings and curfew barriers
// went with the satellite look (D-302); the Linoryt stamps implement this interface in `objects.ts`.
import type { Group, Vector3 } from 'three';

export interface AirportDefinition {
  id: string;
  lon: number;
  lat: number;
  hub?: boolean;
}

export interface AirportsLayer {
  readonly group: Group;
  addAirport(def: AirportDefinition): void;
  setHubLoad(id: string, used: number, cap: number): void;
  setCurfew(id: string, on: boolean): void;
  setZoom(zoom: number): void;
  getPosition(id: string, out: Vector3): Vector3 | null;
  has(id: string): boolean;
  isHub(id: string): boolean;
  /** Remove every airport (new game). */
  clear(): void;
  /** Rebuild ring/barrier instances once per frame if any load, curfew or zoom changed. */
  update(): void;
  dispose(): void;
}
