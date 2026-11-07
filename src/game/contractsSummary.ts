import { isMet, type ContractRecord, type WeeklyContract } from '../sim/contracts';

/** Read-only report of all offers in chronological order, including the current offer. */
export function contractsSummary(history: readonly ContractRecord[], current: WeeklyContract | null) {
  const marks = [...history.map(({ week, met }) => ({ week, met })), ...(current ? [{ week: current.week, met: isMet(current) }] : [])]
    .sort((a, b) => a.week - b.week).map(({ met }) => met);
  return { met: marks.filter(Boolean).length, offered: marks.length, marks };
}
