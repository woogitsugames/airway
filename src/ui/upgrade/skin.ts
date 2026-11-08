/**
 * [night-76a] D-331 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T4): the slot through which a preview skin
 * draws the weekly board (src/ui/upgrade/index.ts). Empty in every release build: src/main.ts fills it only in a DEV
 * build with `?skin=board` (UI-A "take one strip", src/ui/skin/board-week.ts), so the sheet code stays out of the release
 * bundle and the shipped Linoryt board is untouched. The view keeps the state, the commands, the airport-pick mode and
 * the scroll reset; the skin only builds the sheet it is handed the facts for.
 */
import type { UpgradeKind, WeeklyUpgradeState } from '../../sim/upgrades';
import type { CardModel, ContractBoard, UpgradeFacts, WeekFigures } from './cards';

export interface UpgradeSkinInput {
  readonly state: WeeklyUpgradeState;
  /** The board's offers as the shipped labels describe them (same order as `state.offers`). */
  readonly models: readonly CardModel[];
  /** What one pick of each upgrade does, read back from the sim (cards.ts upgradeFacts). */
  readonly facts: UpgradeFacts;
  /** The offer a met contract added to this board, or null. */
  readonly extraCrate: UpgradeKind | null;
  readonly contract: ContractBoard | null;
  readonly figures: WeekFigures | null;
  /** `crates`: choose a strip; `pick-hub` / `pick-airport`: the player taps an airport on the globe. */
  readonly mode: 'crates' | 'pick-hub' | 'pick-airport';
  /** Take an offer (the view sends ChooseUpgrade). */
  take(kind: UpgradeKind): void;
  /** Back from the airport pick to the strips (null when the host gives no way back). */
  readonly back: (() => void) | null;
}

export interface UpgradeSkin {
  /** The sheet for one render of the board (the view appends it to its host). */
  sheet(input: UpgradeSkinInput): HTMLElement;
}

/** The active preview skin (null = the shipped weekly board). */
export const upgradeSkin: { current: UpgradeSkin | null } = { current: null };
