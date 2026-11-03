// [ext-02] R6h, D-162: puzzle packs after the first 30 levels. A pack starts at `firstLevel` and runs to the next
// pack (or the last level); the puzzle board draws its name above the first flap. Levels 01–30 are the base set.
export interface PuzzlePack {
  readonly id: string;
  readonly firstLevel: string;
  readonly nameKey: `puzzle.pack.${string}`;
}
export const PUZZLE_PACKS: readonly PuzzlePack[] = [
  { id: 'longHaul', firstLevel: '31', nameKey: 'puzzle.pack.longHaul' }, // D-131: T+4 weeks
];
