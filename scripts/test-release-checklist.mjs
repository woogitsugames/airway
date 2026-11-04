// [night-12at] R1l, D-235: docs/RELEASE.md is one checklist whose every line names who does it and links a decision
// or owner question that exists; the version names in package.json and both native projects agree (RL-30).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error.message); }
}

const PATH = 'docs/RELEASE.md';
const doc = existsSync(new URL(`../${PATH}`, import.meta.url)) ? read(PATH) : '';
const decisions = new Set([...read('docs/DECISIONS.md').matchAll(/^## (D-\d+)\b/gm)].map((m) => m[1]));
const questions = new Set([...read('docs/OWNER-QUESTIONS.md').matchAll(/^\| (Q-\d+)\b/gm)].map((m) => m[1]));
/** Checklist rows: `| RL-NN | item | who | state | refs | where |`. */
const rows = doc.split('\n').filter((line) => /^\| RL-\d+ \|/.test(line))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
  .map(([id, item, who, state, refs, where]) => ({ id, item, who, state, refs, where }));

check(`${PATH} exists and has checklist lines (${rows.length})`, () => {
  assert.ok(doc, `${PATH} missing`);
  assert.ok(rows.length >= 25, `only ${rows.length} lines`);
});
check('every D-/Q- reference in RELEASE.md exists', () => {
  const refs = [...new Set([...doc.matchAll(/\b([DQ]-\d+)\b/g)].map((m) => m[1]))];
  assert.ok(refs.length > 0, 'no references');
  const missing = refs.filter((ref) => !(ref.startsWith('D-') ? decisions : questions).has(ref));
  assert.deepEqual(missing, [], `unknown: ${missing.join(', ')}`);
});
check('every line: unique id, owner/agent, a state and at least one D-/Q- reference', () => {
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, 'duplicate RL id');
  for (const row of rows) {
    assert.ok(['owner', 'agent', 'owner + agent'].includes(row.who), `${row.id} who="${row.who}"`);
    assert.ok(['done', 'ready', 'open'].includes(row.state), `${row.id} state="${row.state}"`);
    assert.match(row.refs, /^[DQ]-\d+(, [DQ]-\d+)*$/, `${row.id} refs="${row.refs}"`);
    assert.ok(row.item && row.where, `${row.id} empty cell`);
  }
});
check('the RESEARCH R1 items are all on the list', () => {
  const text = rows.map((row) => row.item).join('\n');
  for (const topic of [/Google Play \*\*organisation\*\* account/, /Apple Developer Program/, /Closed test/, /Privacy policy online/,
    /\*\*Data safety\*\*/, /\*\*App Privacy\*\*/, /IARC/, /Apple age/, /DSA \*\*trader\*\*/, /Export compliance/,
    /\*\*accessibility labels\*\*/, /iPhone 6\.9" 1320×2868/, /iPad 13" 2064×2752/, /Version bump in \*\*both\*\* native projects/,
    /Account deletion/, /target API/, /Distribution/, /Trademark/]) {
    assert.match(text, topic);
  }
});
check('RL-30: package.json version = Android versionName = iOS MARKETING_VERSION (every configuration)', () => {
  const version = JSON.parse(read('package.json')).version;
  const gradle = read('android/app/build.gradle');
  assert.equal(gradle.match(/versionName\s*=?\s*['"]([^'"]+)['"]/)?.[1], version, 'Android versionName');
  assert.match(gradle, /versionCode\s*=?\s*\d+/, 'Android versionCode');
  const marketing = [...read('ios/App/App.xcodeproj/project.pbxproj').matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1]);
  assert.ok(marketing.length >= 2, 'MARKETING_VERSION missing');
  assert.deepEqual([...new Set(marketing)], [version], 'iOS MARKETING_VERSION');
});

console.log(`SUMMARY test:release-checklist lines=${rows.length} passed=${passed} failed=${failed}`);
if (failed) process.exit(1);
