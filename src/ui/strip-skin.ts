/**
 * [night-75a] D-330 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T3): the slot through which a preview skin
 * mounts the bay of hub flight strips at the bottom of the game screen. src/main.ts fills it at boot with the UI-A
 * strips (src/ui/skin/board-strips.ts). The session hands the bay the hubs' read model after every
 * sync; the bay owns its DOM, its placement over the console and the "+N" tile, and asks the session to open the full
 * strip (the hub cause board, src/ui/hubBoard.ts) for a hub.
 */
import type { RegionId } from '../data/regions';

/** One hub (or a jammed airport) as the bay shows it (read model only; nothing goes back into the run). */
export interface StripHub {
  readonly id: string;
  /** IATA code and the localized city name (D-68 labels). */
  readonly code: string;
  readonly name: string;
  /** A hub; false for an ordinary airport, which gets a strip only while it is jammed. */
  readonly hub: boolean;
  readonly waiting: readonly RegionId[];
  readonly capacity: number;
  /** Seconds to the jam's end of the run, or null when the hub is not jammed. */
  readonly jamSeconds: number | null;
}

export interface StripBay {
  /** The hubs now (deduplicated inside: an unchanged list touches no DOM). */
  update(hubs: readonly StripHub[]): void;
  /** The bay's box in the layer (null while no strip shows): notes keep off it like the open hub board. */
  readonly box: { readonly l: number; readonly t: number; readonly r: number; readonly b: number } | null;
  dispose(): void;
}

export interface StripSkin {
  mount(layer: HTMLElement, callbacks: { open(id: string): void }): StripBay;
}

/** The active preview strip skin (null = the shipped game screen, no bay). */
export const stripSkin: { current: StripSkin | null } = { current: null };
