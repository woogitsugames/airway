/**
 * [night-73a] D-328 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T2): the slot through which a preview skin
 * draws the airport notes, the edge chips and the atlas labels of the overlay (src/ui/overlay.ts). src/main.ts fills it at
 * boot with the UI-A airport signs of src/ui/skin/board-notes.ts. The overlay keeps its
 * DOM, layout engine (D-262…D-268, D-280, D-281), events and accessible names; the skin only builds the note's children,
 * reports its size, prints the edge chip and places the atlas labels after the notes.
 */
import type { DestinationRegion } from './glyphs';
import type { TagBounds, TagSlot } from './overlay-layout';

/** A note's full and compact layout box (px), as the Linoryt `NoteSize`. */
export interface NoteSkinSize { width: number; height: number; compactWidth: number; compactHeight: number }

/** What the overlay hands the skin's note builder (the nodes are the entry's: stubs, trend, timer, glyph pool). */
export interface NoteSkinInput {
  code: string;
  /** Text of the sign (code or city name per the D-68 setting) and the localized city name. */
  label: string;
  name: string;
  hub: boolean;
  waiting: readonly DestinationRegion[];
  connecting: number;
  capacity: number;
  jamSeconds: number | null;
  isNew: boolean;
  /** Curfew barrier, surge and front stubs and their total width; the fill trend chevron and its width. */
  stubs: readonly Node[];
  stubsWidth: number;
  trend: Node | null;
  trendWidth: number;
  /** The entry's countdown node (its text set by the overlay). */
  timer: HTMLElement;
  glyph: (region: DestinationRegion, hollow: boolean) => SVGSVGElement;
}

/** What the overlay knows about the frame before it lays out the notes. */
export interface NoteSkinView {
  /** Ground distance (km) across the screen's shorter side at the globe's centre; Infinity when unknown. */
  spanKm: number;
  /** Airports on screen last frame. */
  visible: number;
}

/** An obstacle box in the layer's coordinates. */
export interface NoteSkinBox { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

/** The frame after the note layout: what the atlas labels must keep off. */
export interface NoteSkinFrame {
  readonly layer: HTMLElement;
  readonly bounds: TagBounds;
  readonly spanKm: number;
  /** Every layout slot (notes, stamps, board, margins): placed/active ones are obstacles. */
  readonly slots: readonly TagSlot[];
  /** Any surface point to the layer (`WorldRenderer.projectLonLat`); null where the overlay has no projection. */
  readonly project: ((lon: number, lat: number, out: { x: number; y: number; visible: boolean }) => unknown) | null;
  /** Shown edge chips, their boxes and what decides which keep the yellow (fill, new, jam). */
  readonly edges: readonly { el: HTMLElement; box: NoteSkinBox; jam: boolean; fresh: boolean; fill: number }[];
}

export interface NoteSkin {
  /** Called once with the overlay's layer. */
  mount(layer: HTMLElement): void;
  /** Starts a frame; true when the level of detail changed (the overlay then rebuilds every note). */
  frame(view: NoteSkinView): boolean;
  /** Rewrites the note's child list in `want` and returns its size. */
  children(bubble: HTMLElement, want: Node[], input: NoteSkinInput): NoteSkinSize;
  /** The note's size from its last rebuild. */
  size(bubble: HTMLElement): NoteSkinSize;
  /** Distance (px) from the note's top to the middle of the sign row (level with the airport's point). */
  lineMid(bubble: HTMLElement): number;
  /**
   * Prints an off-screen airport's chip (the direction sign) and returns its width. [night-86b] D-344: `compact` = the
   * 48 × 48 form (code + arrow) of a portrait phone; the city and distance show after a tap.
   */
  edge(edge: HTMLElement, input: { code: string; name: string; km: number; taken: number; capacity: number; compact?: boolean }): number;
  /** After the layout: the atlas labels and the edge signs' yellow budget. */
  frameEnd(frame: NoteSkinFrame): void;
}

/** The active preview note skin (null = the shipped Linoryt notes). */
export const noteSkin: { current: NoteSkin | null } = { current: null };
