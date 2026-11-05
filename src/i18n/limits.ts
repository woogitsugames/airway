// [night-11ac] R7h, D-211: length budgets for text that sits in fixed-width UI. A budget is the longest text, in
// Unicode code points after placeholders are filled with `sample`, that the slot shows without cutting or wrapping
// into a second row. `test:i18n` fails when any catalog (and the pseudo-locale) goes over; the pseudo-locale fills a
// budgeted string up to its budget (the longest a translator may write) instead of stretching it past.
// The translator export (R7i) will carry `max` and `where` next to each key.
import type { TranslationKey, TranslationParams } from './index';

/** Split-flap cells on the departures board (src/ui/menu/menu.ts passes these as `maxCells`). Measured at 320×568,
 *  the narrowest board (9 px tiles): the title column holds 15 cells, the status column 8, a half row 11. The board
 *  used to allow 20/10, which a 320–412 px phone hid behind the column edge without the "…" cell. */
export const FLAP_CELLS = { title: 15, half: 10, status: 8, gate: 2 } as const;

export interface LengthBudget {
  /** Longest allowed text in code points. */
  readonly max: number;
  /** Where the text sits (for translators and the R7i export). */
  readonly where: string;
  /** Worst-case placeholder values the budget is measured with. */
  readonly sample?: TranslationParams;
}

const flapTitle = { max: FLAP_CELLS.title, where: 'departures board: split-flap title (15 cells)' };
const flapHalf = { max: FLAP_CELLS.half, where: 'departures board: half-row split-flap title (10 cells)' };
const flapStatus = { max: FLAP_CELLS.status, where: 'departures board: split-flap status (8 cells)' };
const dockTag = { max: 8, where: 'plane-tag dock: countdown on an empty tag' };
const passLabel = { max: 10, where: 'boarding pass: field label above a number' };
const crateField = { max: 10, where: 'weekly crate label: field name column' };
const selectOption = { max: 14, where: 'settings: option of a select (320 px wide screen keeps 8 px beside the arrow)' };
// [night-11aj] R2g: the home-region select in the Endless row's status cell (80 px at 320 px, 10 px mono, no arrow).
const regionCell = { max: 10, where: 'departures board: home-region select in the Endless status cell' };
// [night-12bc] R2h: the licence stamp select in the Endless row's gate cell (46 px at 320 px).
const licenceStamp = { max: 3, where: 'departures board: licence class stamp in the Endless gate cell' };
const logbookShort = { max: 4, where: 'logbook: narrow number column head' };
const logbookWide = { max: 6, where: 'logbook: column head' };

export const LENGTH_BUDGETS: Partial<Record<TranslationKey, LengthBudget>> = {
  'menu.continue': flapTitle,
  'menu.endless': flapTitle,
  'menu.puzzles': flapTitle,
  'menu.today': { ...flapTitle, sample: { date: '30.12' } },
  'menu.settings': flapHalf,
  'menu.logbook': flapHalf,
  'menu.boarding': flapStatus,
  'menu.onTime': flapStatus,
  'menu.new': flapStatus,
  'menu.gate': { max: 6, where: 'departures board: gate column head (46 px at 320 px)' },
  'menu.homeRegion.random': regionCell,
  'licence.short.1': licenceStamp,
  'licence.short.2': licenceStamp,
  'licence.short.3': licenceStamp,
  ...Object.fromEntries((['NAM', 'SAM', 'EUN', 'EUS', 'AFR', 'ME', 'ASI', 'OCE'] as const)
    .map((region) => [`region.short.${region}`, regionCell])),
  'menu.status': { max: 10, where: 'departures board: status column head (wraps)' },
  'action.back': { max: 6, where: 'settings, logbook, puzzle board: Back button beside the title' },
  'hud.week': passLabel,
  'hud.day': passLabel,
  'hud.time': passLabel,
  'hud.passengers': passLabel,
  'hud.crates.days': { ...dockTag, sample: { days: 6 } },
  'hud.crates.hours': { ...dockTag, sample: { hours: 23 } },
  'hud.crates.minutes': { ...dockTag, sample: { minutes: 59 } },
  'airport.new': { max: 5, where: 'airport tag: stub' },
  'airport.slot.label': { max: 5, where: 'airport tag: departure-slot stub' },
  'upgrade.freight': { max: 8, where: 'weekly crate: stencil code line' },
  'upgrade.field.range': crateField,
  'upgrade.field.seats': crateField,
  'upgrade.field.best': crateField,
  'upgrade.field.places': crateField,
  'upgrade.field.transfer': crateField,
  'upgrade.field.for': crateField,
  'upgrade.field.departures': crateField,
  'upgrade.stampCaption.hub': { max: 20, where: 'weekly crate: stamp caption' },
  'upgrade.stampCaption.slots': { max: 28, where: 'weekly crate: stamp caption (two lines)' },
  'upgrade.stampNone': { max: 14, where: 'weekly crate: stamp' },
  'upgrade.back': { max: 6, where: 'airport pick: Back tile' },
  'settings.on': { max: 4, where: 'settings: switch state' },
  'settings.off': { max: 4, where: 'settings: switch state' },
  'settings.auto': selectOption,
  'settings.saver': selectOption,
  'settings.low': selectOption,
  'settings.medium': selectOption,
  'settings.high': selectOption,
  'settings.globeMode.satellite': selectOption,
  'settings.globeMode.map': selectOption,
  'settings.airportLabels.code': selectOption,
  'settings.airportLabels.name': selectOption,
  'settings.airline.teal': selectOption,
  'settings.airline.sky': selectOption,
  'settings.airline.brick': selectOption,
  'settings.airline.ochre': selectOption,
  'settings.airline.rose': selectOption,
  'settings.airline.ink': selectOption,
  'language.english': selectOption,
  'language.polish': selectOption,
  'firstTime.ok': { max: 4, where: 'first-time card: OK tag' },
  'gameover.cancelled': { max: 10, where: 'game-over departures board: status cell' },
  'gameover.timeline.week': { max: 4, where: 'game-over timeline: week mark', sample: { week: 12 } },
  'logbook.col.date': logbookWide,
  'logbook.col.flight': logbookWide,
  'logbook.col.hub': logbookWide,
  'logbook.col.weeks': logbookShort,
  'logbook.col.pax': logbookShort,
  'puzzle.plane.turboprop': { max: 2, where: 'puzzle inventory: aircraft code' },
  'puzzle.plane.jet': { max: 2, where: 'puzzle inventory: aircraft code' },
  'tutorial.tag.aircraft': { max: 16, where: 'training flight: luggage tag' },
};

/** Text length as the budgets count it: Unicode code points of the NFC form (split-flap cells count the same way). */
export function textLength(text: string): number {
  return Array.from(text.normalize('NFC')).length;
}

/** The budget of a key, if it has one. */
export function lengthBudget(key: string): number | undefined {
  return (LENGTH_BUDGETS as Record<string, LengthBudget | undefined>)[key]?.max;
}
