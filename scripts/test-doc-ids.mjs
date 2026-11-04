// [N12ae] D-205: decision and owner-question numbers stay unique.
// docs/DECISIONS.md: every "## D-NN" heading is used once and the headings ascend (a new decision goes in its place,
// not at the end). docs/OWNER-QUESTIONS.md: every "| Q-NN" table row is used once (✅ markers allowed).
// Two agents take numbers in parallel; this catches a clash in test:fast before it reaches dev.
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
  `decisions=${decisions.length} maxD=${Math.max(...decisions)} questions=${questions.length} maxQ=${Math.max(...questions)}`);
process.exitCode = failed ? 1 : 0;
