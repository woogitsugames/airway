// [ext-02] R6h, D-162: puzzle packs after the first 30 levels. A pack starts at `firstLevel` and runs to the next
// pack (or the last level); the puzzle board draws its name above the first flap. Levels 01–30 are the base set.
export interface PuzzlePack {
  readonly id: string;
  readonly firstLevel: string;
  readonly nameKey: `puzzle.pack.${string}`;
  /** [night-11u] D-193 (Q-74 → B): left out of release builds until it ships as a store event; DEV builds show it. */
  readonly hiddenInRelease?: boolean;
}
export const PUZZLE_PACKS: readonly PuzzlePack[] = [
  // D-131: T+4 weeks after launch, 31–40 as the "Major update" event; until then release builds show 01–30 (D-193).
  { id: 'longHaul', firstLevel: '31', nameKey: 'puzzle.pack.longHaul', hiddenInRelease: true },
];

/**
 * [night-11u] D-193: the levels a build exposes. A pack runs from its first level to the next pack's first level (or
 * the end); a `hiddenInRelease` pack is dropped unless `showHidden` (DEV builds, or `VITE_AW_ALL_PACKS=1`).
 */
export function releasedLevels<T extends { readonly id: string }>(
  levels: readonly T[], showHidden: boolean, packs: readonly PuzzlePack[] = PUZZLE_PACKS,
): readonly T[] {
  if (showHidden) return levels;
  const starts = packs.map((pack) => levels.findIndex((level) => level.id === pack.firstLevel));
  const hidden = new Set<number>();
  packs.forEach((pack, i) => {
    if (!pack.hiddenInRelease || starts[i] < 0) return;
    const end = starts.filter((start) => start > starts[i]).sort((a, b) => a - b)[0] ?? levels.length;
    for (let index = starts[i]; index < end; index++) hidden.add(index);
  });
  return levels.filter((_level, index) => !hidden.has(index));
}
