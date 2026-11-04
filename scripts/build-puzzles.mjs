// [ext-01] R6f, D-160: write src/data/puzzles/levels.generated.ts from the NN.json files in the folder.
// Usage: node scripts/build-puzzles.mjs [--dir <folder>] [--check]
//   --dir    another puzzle folder (test:puzzle-packs uses a temporary copy)
//   --check  do not write; exit 1 when the generated file is missing or stale
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GENERATED_NAME, PUZZLE_DIR, puzzleIds, puzzleIndexSource } from './puzzle-index.mjs';

const args = process.argv.slice(2);
const dirAt = args.indexOf('--dir');
const dir = dirAt >= 0 ? resolve(args[dirAt + 1]) : PUZZLE_DIR;
const file = resolve(dir, GENERATED_NAME);
try {
  const ids = puzzleIds(dir);
  const source = puzzleIndexSource(ids);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (args.includes('--check')) {
    if (current !== source) {
      console.error(`FAIL ${GENERATED_NAME} is stale (${ids.length} levels in the folder): run npm run build:puzzles`);
      process.exitCode = 1;
    } else console.log(`OK ${GENERATED_NAME} lists ${ids.length} levels (01–${ids.at(-1)})`);
  } else {
    if (current !== source) writeFileSync(file, source);
    console.log(`${current === source ? 'unchanged' : 'wrote'} ${GENERATED_NAME}: ${ids.length} levels (01–${ids.at(-1)})`);
  }
} catch (error) {
  console.error('FAIL build:puzzles: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
