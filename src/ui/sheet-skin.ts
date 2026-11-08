/**
 * [night-77a] D-332 (docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md step T5): the slot through which a preview skin
 * re-sets the main menu and the game-over report in its own language. Empty in every release build: src/main.ts fills it
 * only in a DEV build with `?skin=board` (the departures board and the teleprinter print-out of
 * src/ui/skin/board-sheets.ts), so the preview code stays out of the release bundle and the shipped screens are untouched.
 * The screens hand over their own elements (buttons keep their listeners, test ids and spoken names) and plain read
 * models; the skin may move those elements and add aria-hidden drawing round them, but never acts on the run.
 */
import type { RegionId } from '../data/regions';
import type { TimelineWeek } from '../game/runTimeline';

/** One menu row as src/ui/menu/menu.ts words it (the router id, the title, the hint line, the board status). */
export interface SheetMenuFlight {
  readonly id: string;
  readonly title: string;
  readonly sub: string;
  readonly status: string;
  /** The row's gate on the departures board ("C2"). */
  readonly gate: string;
  /** The run-starting row (Continue, else Endless): the screen's one main action. */
  readonly hot?: boolean;
}

export interface SheetMenuParts {
  readonly root: HTMLElement;
  /** The departures board (nav) holding the rows. */
  readonly board: HTMLElement;
  /** The row buttons by router id. */
  readonly buttons: ReadonlyMap<string, HTMLButtonElement>;
  /** The Endless line's home-region and licence cells (absent without the choice). */
  readonly options: readonly HTMLElement[];
  readonly flights: readonly SheetMenuFlight[];
  readonly today: Date;
  readonly solved: number;
  readonly total: number;
}

/** What the print-out needs beyond the shipped report (all read once, when the run has ended). */
export interface SheetReport {
  readonly hubCode: string;
  readonly hubName: string;
  readonly hubIsHub: boolean;
  readonly mode: 'endless' | 'daily' | 'puzzle' | null;
  /** The calendar week and day and the home clock (0–1439) at the jam; null when the run did not say. */
  readonly clock: { readonly week: number; readonly day: number; readonly minute: number } | null;
  readonly delivered: number;
  readonly completedWeeks: number;
  readonly newRecord: boolean;
  readonly waiting: number;
  readonly capacity: number;
  /** Waiting passengers by destination region at the jam. */
  readonly queue: Readonly<Partial<Record<RegionId, number>>>;
  readonly network: { readonly routes: number; readonly aircraft: number; readonly hubs: readonly string[] } | null;
  readonly homeRegion: string | null;
  readonly licence: string | null;
  /** The weeks of the run (src/game/runTimeline.ts), loaded on demand; absent for puzzles. */
  readonly timeline?: () => Promise<{ readonly weeks: readonly TimelineWeek[] } | null>;
}

export interface SheetReportParts {
  readonly overlay: HTMLElement;
  readonly content: HTMLElement;
  /** The heading sign (h1 and the "Map" toggle). */
  readonly sign: HTMLElement;
  readonly map: HTMLButtonElement;
  /** The departures of the jammed airport, the incident strip (score, rows, causes) and the action bar. */
  readonly departures: HTMLElement;
  readonly strip: HTMLElement;
  readonly actions: HTMLElement;
  readonly same: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  readonly menu: HTMLButtonElement;
  readonly report: SheetReport;
}

export interface SheetSkin {
  /** Called when the menu is built and on every refresh (language, record, progress). */
  menu(parts: SheetMenuParts): void;
  /** Called once the report is built, before it is shown. */
  report(parts: SheetReportParts): void;
}

/** The active preview sheet skin (null = the shipped menu and report). */
export const sheetSkin: { current: SheetSkin | null } = { current: null };
