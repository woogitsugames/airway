// [night-33a] D-271: the weekly contracts a run was offered and met, for the Endless game-over report row.
// Pure and read-only (no Sim change, no hash change): it reads the world's closed contracts and the running one.
import { isMet, type ContractRecord, type WeeklyContract } from '../sim/contracts';

export interface ContractsSummary {
  /** Contracts met: closed ones recorded as met, plus the running one if it already reached its target. */
  readonly met: number;
  /** Contracts offered: every closed one plus the running one. */
  readonly offered: number;
  /** One mark per offered contract in week order: true = met (filled square), false = missed or open (hollow). */
  readonly marks: readonly boolean[];
}

/**
 * The summary of a run's weekly contracts, or null when the run never saw one (it ended before the first board with
 * a contract, or it has no contracts at all: Daily, puzzles, older Endless saves).
 */
export function contractsSummary(current: Readonly<WeeklyContract> | null, history: readonly ContractRecord[]): ContractsSummary | null {
  const weeks = history.map((record) => ({ week: record.week, met: record.met }));
  if (current) weeks.push({ week: current.week, met: isMet(current) });
  if (!weeks.length) return null;
  const marks = weeks.sort((a, b) => a.week - b.week).map((item) => item.met);
  return { met: marks.filter(Boolean).length, offered: marks.length, marks };
}
