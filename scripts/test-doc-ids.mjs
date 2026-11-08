// [N12ae] D-205: decision and owner-question numbers stay unique.
// docs/DECISIONS.md: every "## D-NN" heading is used once and the headings ascend (a new decision goes in its place,
// not at the end). docs/OWNER-QUESTIONS.md: every "| Q-NN" table row is used once (✅ markers allowed).
// Two agents take numbers in parallel; this catches a clash in test:fast before it reaches dev.
// [night-13c] docs/TESTING.md: every "| `npm run X` |" row is used once (parallel merges kept an old and a new row),
// every test:fast step in package.json has a row, and the test:fast row's "steps=N" equals the real step count.
// [night-40a] GPT-07: the Commands table also has to match package.json: every test:ci step has a row, every
// `test:*` / `perf:*` script has a row, every row names an existing script, every row has five cells (an unescaped
// "|" inside a cell splits it), and the Suite column says where the script really runs: "fast" for a test:fast step,
// "ci" for any other test:ci step, "manual" or "tool" for the rest.
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ' — ' + detail}`);
}

/** "## D-NN" heading numbers in file order. */
export function decisionIds(text) {
  return [...text.matchAll(/^## D-(\d+)\b/gm)].map((m) => Number(m[1]));
}
/** "| Q-NN" table-row numbers in file order. */
export function questionIds(text) {
  return [...text.matchAll(/^\|\s*Q-(\d+)\b/gm)].map((m) => Number(m[1]));
}
function duplicates(ids) {
  const seen = new Set();
  const dup = new Set();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}
function outOfOrder(ids) {
  const bad = [];
  for (let i = 1; i < ids.length; i++) if (ids[i] <= ids[i - 1]) bad.push(`D-${ids[i]} after D-${ids[i - 1]}`);
  return bad;
}

// Self-check on synthetic text: the readers see a clash and a step back.
const fakeDecisions = '# Decisions\n## D-01 — a\ntext D-03\n## D-03 — b\n## D-02 — c\n## D-03 — d\n';
check('reader finds a duplicate decision', duplicates(decisionIds(fakeDecisions)).join() === '3');
check('reader finds a decision out of order', outOfOrder(decisionIds(fakeDecisions)).join() === 'D-2 after D-3');
const fakeQuestions = '| ID | P |\n|---|---|\n| Q-01 | P1 |\n| Q-02 ✅ D-9 | P2 |\n| Q-01 | P3 |\nsee Q-02\n';
check('reader finds a duplicate question', duplicates(questionIds(fakeQuestions)).join() === '1');

/** Script names of "| `npm run X …` |" table rows in file order. */
export function testingRows(text) {
  return [...text.matchAll(/^\|\s*`npm run ([^\s`]+)/gm)].map((m) => m[1]);
}
/** The step list of a run-suite script: "node scripts/run-suite.mjs [--jobs=N] <suite> step…" (D-289 options). */
export function suiteSteps(command) {
  const words = command.trim().split(/\s+/);
  return words.slice(words.indexOf('scripts/run-suite.mjs') + 1).filter((word) => !word.startsWith('--jobs')).slice(1);
}
/** "steps=N" in the expected summary of the `npm run <suite>` row, or null. */
export function documentedSteps(text, suite) {
  const row = text.split('\n').find((l) => testingRows(l)[0] === suite);
  const m = row && row.match(/\bsteps=(\d+)/);
  return m ? Number(m[1]) : null;
}
const fakeTesting = '| `npm run a` | fast |\n| `npm run b -- --x` | fast |\nsee `npm run a`\n| `npm run a` | new |\n' +
  '| `npm run test:fast` | — | `SUMMARY test:fast … steps=3 passed=3` |\n';
check('reader finds a duplicate TESTING.md row', duplicates(testingRows(fakeTesting)).join() === 'a');
check('reader reads a suite step list',
  suiteSteps('node scripts/run-suite.mjs test:fast typecheck test:a test:arch').join() === 'typecheck,test:a,test:arch' &&
  suiteSteps('node scripts/run-suite.mjs --jobs=1 test:ci test:fast build').join() === 'test:fast,build');
check('reader reads the documented step count', documentedSteps(fakeTesting, 'test:fast') === 3);

/** The rows of the "## Commands" table: {name, cells} (cells split on unescaped "|"). */
export function commandRows(text) {
  const section = text.split(/^## /m).find((part) => part.startsWith('Commands')) ?? '';
  return section.split('\n').filter((line) => testingRows(line).length).map((line) => ({
    name: testingRows(line)[0],
    cells: line.split(/(?<!\\)\|/).slice(1, -1).map((cell) => cell.trim()),
  }));
}
/** The Suite column a script must have: "fast", "ci", or null for "manual"/"tool". */
export function expectedColumn(name, fast, ci) {
  return fast.includes(name) ? 'fast' : ci.includes(name) ? 'ci' : null;
}
/** Problems of the Commands table against package.json (empty = consistent). */
export function commandProblems(text, scripts) {
  const fast = suiteSteps(scripts['test:fast']);
  const ci = suiteSteps(scripts['test:ci']);
  const table = commandRows(text);
  const named = new Set(testingRows(text));
  const problems = [];
  for (const { name, cells } of table) {
    if (!(name in scripts)) problems.push(`row ${name}: no such npm script`);
    if (cells.length !== 5) { problems.push(`row ${name}: ${cells.length} cells, expected 5 (escape "|" as "\\|")`); continue; }
    const column = cells[1].split(/[\s(]/)[0];
    const want = expectedColumn(name, fast, ci);
    if (want ? column !== want : !['manual', 'tool'].includes(column)) {
      problems.push(`row ${name}: column "${cells[1]}", expected ${want ?? 'manual or tool'}`);
    }
  }
  for (const step of ci) if (!named.has(step)) problems.push(`test:ci step ${step}: no row`);
  for (const name of Object.keys(scripts)) {
    if (/^(test|perf):/.test(name) && !named.has(name)) problems.push(`script ${name}: no row`);
  }
  return problems;
}
const fakeScripts = {
  'test:fast': 'node scripts/run-suite.mjs test:fast test:a test:arch',
  'test:ci': 'node scripts/run-suite.mjs --jobs=1 test:ci test:fast test:b',
  'test:a': 'x', 'test:arch': 'x', 'test:b': 'x', 'perf:c': 'x', tool: 'x',
};
const fakeTable = (rows) => '# T\n## Commands\n| Command | Suite | ~Time | What | Summary |\n| --- | --- | --- | --- | --- |\n' +
  rows.join('\n') + '\n## Next\n| `npm run gone` | x |\n';
const goodRows = ['| `npm run test:fast` | ci | 1 s | a | s |', '| `npm run test:ci` | manual | 1 s | a | s |',
  '| `npm run test:a` | fast | 1 s | a | s |', '| `npm run test:arch` | fast (last) | 1 s | a \\| b | s |',
  '| `npm run test:b` | ci | 1 s | a | s |', '| `npm run perf:c` | manual | 1 s | a | s |',
  '| `npm run tool -- --x` | tool | 1 s | a | s |'];
check('Commands table: a consistent table passes', commandProblems(fakeTable(goodRows), fakeScripts).length === 0,
  commandProblems(fakeTable(goodRows), fakeScripts).join('; '));
check('Commands table: finds a test:ci step without a row',
  commandProblems(fakeTable(goodRows.filter((r) => !r.includes('test:b'))), fakeScripts).join('; ') === 'test:ci step test:b: no row; script test:b: no row');
check('Commands table: finds a perf:* script without a row',
  commandProblems(fakeTable(goodRows.filter((r) => !r.includes('perf:c'))), fakeScripts).join() === 'script perf:c: no row');
check('Commands table: finds a row naming a missing script',
  commandProblems(fakeTable([...goodRows, '| `npm run test:old` | manual | 1 s | a | s |']), fakeScripts).join() ===
  'row test:old: no such npm script');
check('Commands table: finds a wrong Suite column',
  commandProblems(fakeTable(goodRows.map((r) => r.replace('test:b` | ci', 'test:b` | manual')
    .replace('perf:c` | manual', 'perf:c` | ci'))), fakeScripts).join('; ') ===
  'row test:b: column "manual", expected ci; row perf:c: column "ci", expected manual or tool');
check('Commands table: finds an unescaped "|" in a cell',
  commandProblems(fakeTable(goodRows.map((r) => r.replace('a \\| b', 'a | b'))), fakeScripts).join() ===
  'row test:arch: 6 cells, expected 5 (escape "|" as "\\|")');

const testingText = readFileSync('docs/TESTING.md', 'utf8');
const rows = testingRows(testingText);
const packageScripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
const fastSteps = suiteSteps(packageScripts['test:fast']);
const ciSteps = suiteSteps(packageScripts['test:ci']);
const missingRows = fastSteps.filter((step) => !rows.includes(step));
const fastDocumented = documentedSteps(testingText, 'test:fast');
check(`TESTING.md has command rows (${rows.length})`, rows.length > 100);
check('TESTING.md: every `npm run` row once', duplicates(rows).length === 0, duplicates(rows).join(', '));
check(`TESTING.md: every test:fast step has a row (${fastSteps.length})`, missingRows.length === 0,
  missingRows.join(', '));
check('TESTING.md: test:fast steps=N equals package.json', fastDocumented === fastSteps.length,
  `documented ${fastDocumented}, real ${fastSteps.length}`);
const ciDocumented = documentedSteps(testingText, 'test:ci');
check('TESTING.md: test:ci steps=N equals package.json', ciDocumented === ciSteps.length,
  `documented ${ciDocumented}, real ${ciSteps.length}`);
const tableProblems = commandProblems(testingText, packageScripts);
check(`TESTING.md: Commands table matches package.json (${commandRows(testingText).length} rows, ${ciSteps.length} ci steps)`,
  tableProblems.length === 0, tableProblems.join('; '));

const decisions = decisionIds(readFileSync('docs/DECISIONS.md', 'utf8'));
const questions = questionIds(readFileSync('docs/OWNER-QUESTIONS.md', 'utf8'));
check(`DECISIONS.md has decisions (${decisions.length})`, decisions.length > 100);
check('DECISIONS.md: every D-number once', duplicates(decisions).length === 0,
  duplicates(decisions).map((n) => 'D-' + n).join(', '));
check('DECISIONS.md: decisions in ascending order', outOfOrder(decisions).length === 0,
  outOfOrder(decisions).slice(0, 5).join('; '));
check(`OWNER-QUESTIONS.md has questions (${questions.length})`, questions.length > 50);
check('OWNER-QUESTIONS.md: every Q-number once', duplicates(questions).length === 0,
  duplicates(questions).map((n) => 'Q-' + n).join(', '));

console.log(`SUMMARY test:doc-ids seed=0 cases=${passed + failed} passed=${passed} failed=${failed} ` +
  `decisions=${decisions.length} maxD=${Math.max(...decisions)} questions=${questions.length} maxQ=${Math.max(...questions)} rows=${rows.length} fastSteps=${fastSteps.length} ciSteps=${ciSteps.length}`);
process.exitCode = failed ? 1 : 0;
