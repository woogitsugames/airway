// [night-12bg] The harness fixture (e2e/fixtures/airway.html) must expose exactly the window.aw contract of the real
// DEV handle (src/game/devHandle.ts). The fixture fell behind once (no `autoplay`: test:e2e:fixture smoke 4/9) without
// any fast test noticing; this compares the member names statically so the drift fails test:fast instead.
// Sources compared:
//   1. the `AwDevAdapter` + `AwDevHandle` interfaces (the typed contract),
//   2. the handle object literal in `installDevHandle()` (what the real window.aw has),
//   3. the `window.aw = Object.freeze({ ... })` literal in the fixture,
//   4. every `window.aw.<name>` that e2e/ and scripts/ call without optional chaining.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ' — ' + detail}`);
}

/** The text between the brace that opens at `start` (index of "{") and its matching close. */
function braceBody(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(start + 1, i);
  }
  throw new Error('unbalanced braces');
}
/** Keys declared at the top level of a brace body (nested braces and parameter lists are skipped). */
export function topLevelKeys(body) {
  let flat = '';
  let depth = 0;
  for (const ch of body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')) {
    if (ch === '{' || ch === '(') depth++;
    if (depth === 0 || (depth === 1 && ch === '(')) flat += ch;
    if (ch === '}' || ch === ')') depth--;
  }
  // Comments are gone; now read "name(", "name:", "name?(", "get name(" at the start of a statement.
  const keys = new Set();
  for (const m of flat.matchAll(/(?:^|[,;\n])\s*(?:readonly\s+|get\s+|async\s+)?([A-Za-z_$][\w$]*)\??\s*[(:,]/g)) keys.add(m[1]);
  return keys;
}
export function interfaceKeys(source, name) {
  const at = source.search(new RegExp(`export interface ${name}\\b[^{]*\\{`));
  if (at < 0) throw new Error(`interface ${name} not found`);
  return topLevelKeys(braceBody(source, source.indexOf('{', at)));
}
export function literalKeys(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`${marker} not found`);
  return topLevelKeys(braceBody(source, source.indexOf('{', at + marker.length - 1)));
}
const diff = (a, b) => [...a].filter((key) => !b.has(key)).sort();

// Self-check of the readers on synthetic text.
const fakeTs = 'export interface X extends Y {\n  readonly a: number;\n  b(n: { c: 1 }, o?: number): void;\n  /** d( */\n  e?(): void;\n}\n';
check('reader: interface members (nested braces and comments ignored)', [...interfaceKeys(fakeTs, 'X')].join() === 'a,b,e');
const fakeLit = 'window.aw = Object.freeze({\n  version: 1,\n  get ready() { return true; },\n  state,\n  go(x) { if (x) { y: 1; } },\n});';
check('reader: object literal keys (getters, shorthand, methods)',
  [...literalKeys(fakeLit, 'window.aw = Object.freeze({')].join() === 'version,ready,state,go');

const handleTs = readFileSync(resolve(ROOT, 'src/game/devHandle.ts'), 'utf8');
const contract = new Set([...interfaceKeys(handleTs, 'AwDevAdapter'), ...interfaceKeys(handleTs, 'AwDevHandle')]);
const real = literalKeys(handleTs, 'const handle: AwDevHandle = {');
const fixtureHtml = readFileSync(resolve(ROOT, 'e2e/fixtures/airway.html'), 'utf8');
const fixture = literalKeys(fixtureHtml, 'window.aw = Object.freeze({');

check(`contract has the task-28 core (${contract.size} members)`,
  ['version', 'ready', 'state', 'prepareSeed', 'advanceTicks', 'gesture', 'forceHubOverload', 'autoplay']
    .every((key) => contract.has(key)), [...contract].join(','));
check('real handle implements every contract member', diff(contract, real).length === 0,
  'missing: ' + diff(contract, real).join(','));
check('real handle has no member outside the contract', diff(real, contract).length === 0,
  'extra: ' + diff(real, contract).join(','));
check('fixture implements every real handle member', diff(real, fixture).length === 0,
  'missing in e2e/fixtures/airway.html: ' + diff(real, fixture).join(','));
check('fixture has no member the real handle lacks', diff(fixture, real).length === 0,
  'extra in e2e/fixtures/airway.html: ' + diff(fixture, real).join(','));

// Every window.aw.<name>(…) the harness scripts call unconditionally must exist on the real handle.
const used = new Map();
for (const dir of ['e2e', 'scripts']) {
  for (const file of readdirSync(resolve(ROOT, dir))) {
    if (!/\.(mjs|js|ts)$/.test(file)) continue;
    const text = readFileSync(resolve(ROOT, dir, file), 'utf8');
    for (const m of text.matchAll(/window\.aw\??\.([A-Za-z_$][\w$]*)(\?\.)?/g)) {
      if (!m[2]) used.set(m[1], `${dir}/${file}`);
    }
  }
}
const unknown = [...used].filter(([key]) => !real.has(key)).map(([key, file]) => `${key} (${file})`);
check(`harness scripts call only real handle members (${used.size} names)`, unknown.length === 0, unknown.join(', '));

console.log(`SUMMARY test:fixture-adapter members=${real.size} fixture=${fixture.size} passed=${passed} failed=${failed}`);
process.exitCode = failed ? 1 : 0;
