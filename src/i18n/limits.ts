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

/** [night-69a] D-324: cells of the UI-A HUD board (`?skin=board`): the clock "19:05", the week (1–999), the day "2/3", the
 *  passengers (padded to 3 digits, at most 5; more shows the "…" cell) and an aircraft count on a console plate. */
export const BOARD_CELLS = { clock: 5, week: 3, day: 3, passengers: 5, count: 2 } as const;

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
const boardLabel = { max: 6, where: 'UI-A board: label over a figure (abbreviated, full text in board.label)' };
const consoleLong = { max: 12, where: 'UI-A console: caption under an aircraft plate (92 px)' };
const consoleShort = { max: 7, where: 'UI-A console: caption under a key (52 px at 320 px), also the short plate form' };
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
  // [night-12bi] D-195: the airport sign under the logo (mono, nowrap); the old "AIRWAY.GAMES · TERMINAL 1" length.
  'menu.sign': { max: 25, where: 'menu: airport sign under the logo (one row, no wrap)' },
  'menu.homeRegion.random': regionCell,
  'licence.short.1': licenceStamp,
  'licence.short.2': licenceStamp,
  'licence.short.3': licenceStamp,
  ...Object.fromEntries((['NAM', 'SAM', 'EUN', 'EUS', 'AFR', 'ME', 'ASI', 'OCE'] as const)
    .map((region) => [`region.short.${region}`, regionCell])),
  'menu.status': { max: 10, where: 'departures board: status column head (wraps)' },
  'action.back': { max: 6, where: 'settings, logbook, puzzle board: Back button beside the title' },
  // [night-11az] D-257; [night-46a] D-301 Linoryt: the HUD's paper margin, the dock captions, the airport note (one line).
  'hud.weekLine': { max: 14, where: 'HUD margin: week line beside the clock (Besley 20 px)', sample: { week: 999 } },
  'hud.passengerLine': { max: 18, where: 'HUD margin: passenger part of the line under the week', sample: { count: '123 456' } },
  'hud.dayOf': { max: 14, where: 'HUD margin: day part of the line under the week', sample: { day: 3, days: 3 } },
  'note.fill': { max: 10, where: 'airport note: taken of capacity', sample: { taken: 120, capacity: 120 } },
  'note.jam': { max: 34, where: 'airport note: jam line under the note (fits a 320 px screen)', sample: { seconds: 45 } },
  // [night-60a] D-321: a refused Undo on the ATC strip, the red reason field alone (two rows at 320 px, Linoryt stacks).
  'route.atc.undoRefused': { max: 52, where: 'ATC strip: refused Undo notice (at most two rows at 320 px)', sample: { code: 'DEL', time: '23:59' } },
  'dock.undo': { max: 10, where: 'dock: caption under a symbol (a 52 px cell at 320 px)' },
  'dock.turboprop': { max: 10, where: 'dock: caption under a symbol (a 52 px cell at 320 px)' },
  'dock.widebody': { max: 10, where: 'dock: caption under a symbol (a 52 px cell at 320 px)' },
  'dock.hub': { max: 10, where: 'dock: caption under a symbol (a 52 px cell at 320 px)' },
  'dock.speed': { max: 10, where: 'dock: caption under a symbol (a 52 px cell at 320 px)', sample: { speed: 4 } },
  'dock.in': { max: 12, where: 'dock: wait for the next crates under an empty symbol', sample: { when: '2 godz.' } },
  'menu.tagline': { max: 40, where: 'menu: tagline under the title' },
  // [night-69a] D-324: the UI-A board labels over the flaps (Archivo 8.5 px caps) and the console captions (Archivo 9.5 px
  // caps under a 92 px plate; the short forms under a 52 px key at 320 px or at text ≥ 120 %).
  'board.localTime': { max: 14, where: 'UI-A board: label over the clock flaps' },
  'board.week': boardLabel,
  'board.day': boardLabel,
  'board.passengers': boardLabel,
  'board.stop': { max: 6, where: 'UI-A board: caption under the pause key' },
  'board.go': { max: 6, where: 'UI-A board: caption under the pause key' },
  'board.dock.undo': consoleShort,
  'board.dock.turboprop': consoleLong,
  'board.dock.turbopropShort': consoleShort,
  'board.dock.widebody': consoleLong,
  'board.dock.widebodyShort': consoleShort,
  'board.dock.hub': consoleShort,
  'board.dock.speed': consoleShort,
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
  // [night-33a] D-271: on short screens the title shares one line with up to 20 squares at 320 px.
  'gameover.contracts.title': { max: 22, where: 'game-over report: weekly contracts row title (one line beside the squares)', sample: { met: 12, offered: 24 } },
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
