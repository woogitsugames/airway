// [ext-01] R6f, D-160/D-161: puzzle packs need no hand-kept import list. A 31st NN.json added to a copy of the
// puzzle folder must reach PUZZLES after `build:puzzles` (no edit of index.ts); gaps, odd file names and > 99
// levels are refused; the committed generated index matches the folder; puzzle:report has one row per level.
// Fixed seed 0xA1A1 (no gameplay randomness; levels carry their own demand seeds).
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'src/data/puzzles');
const BUILD = resolve(ROOT, 'scripts/build-puzzles.mjs');
let checked = 0;
let passed = 0;
const failures = [];
async function check(name, fn) {
  checked++;
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(name);
    console.error(`FAIL ${name}: ${message}`);
  }
}
function assert(condition, message) { if (!condition) throw new Error(message); }
const temps = [];
/** A copy of the real puzzle folder (every file, so the old hand-kept index.ts is copied too). */
function copyFolder() {
  const dir = mkdtempSync(join(tmpdir(), 'airway-puzzles-'));
  temps.push(dir);
  for (const name of readdirSync(SOURCE)) copyFileSync(resolve(SOURCE, name), resolve(dir, name));
  return dir;
}
const levelFiles = (dir) => readdirSync(dir).filter((name) => /^\d{2}\.json$/.test(name)).sort();
function addLevel(dir, id) {
  const last = levelFiles(dir).at(-1);
  const level = JSON.parse(readFileSync(resolve(dir, last), 'utf8'));
  writeFileSync(resolve(dir, `${id}.json`), JSON.stringify({ ...level, id, titleKey: `puzzle.${id}.title` }, null, 2));
}
/** Runs the generator on `dir` when it exists (the old code has none, so the folder keeps its own index.ts). */
function build(dir, ...extra) {
  if (!existsSync(BUILD)) return { status: null, output: 'scripts/build-puzzles.mjs missing' };
  const run = spawnSync(process.execPath, [BUILD, '--dir', dir, ...extra], { encoding: 'utf8' });
  return { status: run.status, output: (run.stdout + run.stderr).trim() };
}

await import('./ts-test-loader.mjs');
const realCount = levelFiles(SOURCE).length;
const next = String(realCount + 1).padStart(2, '0');

await check(`level file ${next}.json reaches PUZZLES without editing index.ts`, async () => {
  const dir = copyFolder();
  addLevel(dir, next);
  build(dir);
  const { PUZZLES } = await import(pathToFileURL(resolve(dir, 'index.ts')).href + '?add');
  assert(PUZZLES.length === realCount + 1, `PUZZLES has ${PUZZLES.length} levels, the folder ${realCount + 1}`);
  assert(PUZZLES.at(-1).id === next, `last level is ${PUZZLES.at(-1).id}, want ${next}`);
  assert(PUZZLES.every((level, i) => level.id === String(i + 1).padStart(2, '0')), 'PUZZLES out of folder order');
});
await check('a gap in the numbering is refused', () => {
  const dir = copyFolder();
  addLevel(dir, String(realCount + 2).padStart(2, '0'));
  const run = build(dir);
  assert(run.status === 1 && /contiguous/.test(run.output), `gap accepted: ${run.output}`);
});
await check('a level file not named NN.json is refused', () => {
  const dir = copyFolder();
  writeFileSync(resolve(dir, '100.json'), '{}');
  const run = build(dir);
  assert(run.status === 1 && /two digits/.test(run.output), `odd file accepted: ${run.output}`);
});
await check('more than 99 levels are refused', async () => {
  const { puzzleIds } = await import('./puzzle-index.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'airway-puzzles-'));
  temps.push(dir);
  for (let i = 1; i <= 99; i++) writeFileSync(resolve(dir, `${String(i).padStart(2, '0')}.json`), '{}');
  assert(puzzleIds(dir).length === 99, '99 levels must be accepted');
  writeFileSync(resolve(dir, '00.json'), '{}');
  let refused = false;
  try { puzzleIds(dir); } catch { refused = true; }
  assert(refused, '100 level files accepted');
});
await check('the committed levels.generated.ts matches the folder', () => {
  const run = build(SOURCE, '--check');
  assert(run.status === 0, run.output);
});
await check('index.ts keeps no hand-written level import', () => {
  const index = readFileSync(resolve(SOURCE, 'index.ts'), 'utf8');
  assert(!/from '\.\/\d{2}\.json'/.test(index), 'index.ts imports level JSON by hand');
});
await check('puzzle:report has one won row per level with its margin and star thresholds', async () => {
  const { puzzleReportRows, loadLevels, reportTable } = await import('./puzzle-report.mjs');
  const rows = await puzzleReportRows(loadLevels());
  assert(rows.length === realCount, `${rows.length} rows for ${realCount} levels`);
  for (const row of rows) {
    assert(row.status === 'won' && row.marginPercent >= 15, `${row.id}: reference ${row.status} +${row.marginPercent}%`);
    assert(row.twoStars > row.target && row.threeStars > row.twoStars, `${row.id}: star thresholds ${row.twoStars}/${row.threeStars}`);
    assert(row.actions > 0 && /^\d+:\d\d$/.test(row.at1x), `${row.id}: actions ${row.actions}, time ${row.at1x}`);
  }
  const table = reportTable(rows);
  assert(table.split('\n').filter((line) => /^\| \d{2} \|/.test(line)).length === realCount, 'table rows');
});

for (const dir of temps) rmSync(dir, { recursive: true, force: true });
console.log(`SUMMARY test:puzzle-packs seed=0xA1A1 levels=${realCount} cases=${checked} passed=${passed} failed=${failures.length}`);
if (failures.length) process.exitCode = 1;
