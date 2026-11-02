/** The HUD only reads snapshots. All mutations go through caller-owned command callbacks. */
export type PlaneType = 'turboprop' | 'widebody';
export type GameSpeed = 1 | 2 | 4;

export interface HudState {
  /** One-based week and day; day 1 is Monday. */
  readonly week: number;
  readonly day: number;
  /** Minutes since midnight, clamped to 0..1439 for presentation. */
  readonly timeMinutes: number;
  readonly passengers: number;
  readonly paused: boolean;
  readonly speed: GameSpeed;
  readonly canUndo: boolean;
  readonly selectedPlane: PlaneType | null;
  readonly stock: Readonly<{ turboprop: number; widebody: number; hub: number }>;
}

export interface HudActions {
  onUndo?(): void;
  onTogglePause?(): void;
  onCycleSpeed?(): void;
  onSelectPlane?(type: PlaneType): void;
  /** Signals an intent to select an airport for a hub upgrade. */
  onUpgradeHub?(): void;
  /** The game adapter translates this intent to a validated AssignPlane command. */
  onAssignPlane?(type: PlaneType, routeId: string): void;
  /** Resolve the underlying rendered route after pointer capture; no hit-test implementation belongs in HUD. */
  routeAtPoint?(clientX: number, clientY: number): string | null;
}

export interface HudController {
  render(state: HudState): void;
  destroy(): void;
  readonly element: HTMLElement;
}
