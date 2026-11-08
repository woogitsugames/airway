/**
 * [night-69a] D-324 (PLAN-NOWY-KIERUNEK.md step T1): the slot through which a preview skin draws the HUD's top band and
 * dock faces. Empty in every release build: src/main.ts fills it only in a DEV build with `?skin=board` (UI-A, the
 * split-flap board and the controller's console of src/ui/skin/board.ts), so the board helpers stay out of the release
 * bundle and the shipped Linoryt HUD is untouched. The HUD keeps its DOM, events, accessible names and state; the skin
 * only paints inside the elements it is handed.
 */
import type { HudState } from './types';

export type HudSkinTag = 'undo' | 'turboprop' | 'widebody' | 'hub' | 'speed';

export interface HudSkinTagState {
  /** The figure the dock shows: aircraft or hub stock, `2×` for the speed, '' for undo. */
  readonly count: string;
  readonly speed: number;
  /** Short wait for the next crates under an empty aircraft or hub ("1 dzień"), else null. */
  readonly wait: string | null;
  readonly empty: boolean;
  readonly selected: boolean;
}

export interface HudSkin {
  /** The top band: called on every HUD render with the boarding-pass section (the skin keeps its own nodes in it). */
  pass(section: HTMLElement, state: HudState): void;
  /** Inner HTML of the pause button (paused = the resume face). */
  pauseFace(paused: boolean): string;
  /** Inner HTML of one dock control, built once. */
  dockFace(tag: HudSkinTag): string;
  /** Called on every HUD render for each dock control. */
  dockState(button: HTMLElement, tag: HudSkinTag, state: HudSkinTagState): void;
}

/** The active preview skin (null = the shipped HUD). */
export const hudSkin: { current: HudSkin | null } = { current: null };
