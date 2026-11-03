// [night-10r] End-of-run timeline for the game-over report: what the player did in each week, read from the
// command journal. Commands the sim refused at their tick (CommandRejected) must not count, and the journal alone
// does not say which those were, so the run is re-simulated in a separate, throw-away Sim from its seed: the live
// run's state is never touched (D-13 determinism makes the copy exact). [night-10t] The live Sim now records each
// entry's outcome, so only a resumed save's unknown prefix is replayed (in slices); a long run in one sitting is
// read straight from those outcomes.
import { Sim, calendarWeekAt, type CommandEntry, type CommandOutcome, type GameConfig, type UpgradeKind, type UpgradeRecord } from '../sim';

export interface TimelineWeek {
  readonly week: number;
  /** New routes opened. */
  readonly routes: number;
  /** Existing routes lengthened by a stop. */
  readonly extended: number;
  /** Routes closed. */
  readonly removed: number;
  /** Aircraft put on a route (a new route with an aircraft counts too). */
  readonly aircraft: number;
  /** The weekly crate taken at the start of this week (the board after week N - 1). */
  readonly pick?: { readonly upgrade: UpgradeKind; readonly hubId?: string };
}

export interface TimelineInput {
  readonly seed: number;
  readonly config: GameConfig;
  readonly journal: readonly CommandEntry[];
  /** The sim tick at which the run ended. */
  readonly endTick: number;
  /** The final game minute (calendar week of the jam). */
  readonly endMinute: number;
  /** Authoritative weekly choices of the live run (`sim.world.upgrades`). */
  readonly upgrades: readonly UpgradeRecord[];
  /** [night-10t] `sim.getCommandOutcomes()` of the live run; null entries (a resumed save) are replayed. */
  readonly outcomes?: readonly (CommandOutcome | null)[];
}

type Counts = { routes: number; extended: number; removed: number; aircraft: number };
const ZERO = (): Counts => ({ routes: 0, extended: 0, removed: 0, aircraft: 0 });

function count(into: Counts, entry: CommandEntry): void {
  const command = entry[1];
  if (command.type === 'AddRoute') { into.routes++; if (command.aircraft) into.aircraft++; }
  else if (command.type === 'ExtendRoute') into.extended++;
  else if (command.type === 'RemoveRoute') into.removed++;
  else if (command.type === 'AssignPlane') into.aircraft++;
}

/** Weeks 1..last, in order; a quiet week has zero counts. Pure once the accepted commands are known. */
export function timelineFromAccepted(
  accepted: readonly { readonly minute: number; readonly entry: CommandEntry }[],
  endMinute: number,
  upgrades: readonly UpgradeRecord[],
): TimelineWeek[] {
  const last = calendarWeekAt(Math.max(0, endMinute));
  const weeks: Counts[] = Array.from({ length: last }, ZERO);
  for (const { minute, entry } of accepted) {
    const week = Math.min(last, calendarWeekAt(Math.max(0, minute)));
    count(weeks[week - 1]!, entry);
  }
  const picks = new Map<number, UpgradeRecord>();
  for (const record of upgrades) picks.set(record.week + 1, record);
  return weeks.map((counts, index) => {
    const pick = picks.get(index + 1);
    return { week: index + 1, ...counts,
      ...(pick ? { pick: { upgrade: pick.upgrade, ...(pick.hubId ? { hubId: pick.hubId } : {}) } } : {}) };
  });
}

const COUNTED = new Set(['AddRoute', 'ExtendRoute', 'RemoveRoute', 'AssignPlane']);
const SLICE_TICKS = 1500;

/**
 * Keep the network commands the sim accepted, with the game minute each ran at. [night-10t] The live Sim records
 * each journal entry's outcome as it ticks (`getCommandOutcomes()`), so a run played in one sitting needs no replay
 * at all, however long it lasted. Only the prefix whose outcomes are unknown (a run continued from a save) is
 * re-simulated in a fresh Sim, up to the last unknown entry and no further. `yieldEvery` lets the caller hand
 * control back during that replay (e.g. `() => new Promise(r => setTimeout(r))`); null when the journal cannot be
 * replayed.
 */
export async function buildRunTimeline(
  input: TimelineInput,
  yieldEvery: () => Promise<void> = () => Promise.resolve(),
): Promise<TimelineWeek[] | null> {
  try {
    const { journal } = input;
    const outcomes = input.outcomes && input.outcomes.length === journal.length ? input.outcomes : null;
    let unknown = journal.length - 1; // the last entry whose outcome must be replayed
    if (outcomes) while (unknown >= 0 && outcomes[unknown]) unknown--;
    const accepted: { minute: number; entry: CommandEntry }[] = [];
    if (unknown >= 0) {
      const untilTick = journal[unknown]![0];
      if (untilTick > input.endTick) return null;
      const sim = new Sim(input.seed, input.config);
      let index = 0;
      while (index <= unknown) {
        const nextTick = sim.tickCount + 1;
        const applied: CommandEntry[] = [];
        while (index < journal.length && journal[index]![0] === nextTick) {
          const entry = journal[index]!;
          if (sim.apply(entry[1])) applied.push(entry); // malformed input is never executed
          index++;
        }
        const minute = sim.world.minute; // commands run before the tick's minute advances
        sim.tick();
        const events = sim.drainEvents();
        if (applied.length) {
          // Rejections arrive in command order: match them one by one to keep the accepted ones.
          const rejected = events.filter((event) => event.type === 'CommandRejected').map((event) => JSON.stringify(event.command));
          let r = 0;
          for (const entry of applied) {
            if (r < rejected.length && rejected[r] === JSON.stringify(entry[1])) { r++; continue; }
            if (COUNTED.has(entry[1].type)) accepted.push({ minute, entry });
          }
        }
        if (nextTick % SLICE_TICKS === 0) await yieldEvery();
        if (sim.tickCount >= untilTick && index <= unknown) return null; // entries out of order or before tick 1
      }
    }
    for (let i = unknown + 1; i < journal.length; i++) {
      const outcome = outcomes![i]!;
      const entry = journal[i]!;
      if (entry[0] > input.endTick) return null;
      if (outcome.accepted && COUNTED.has(entry[1].type)) accepted.push({ minute: outcome.minute, entry });
    }
    return timelineFromAccepted(accepted, input.endMinute, input.upgrades);
  } catch {
    return null;
  }
}
