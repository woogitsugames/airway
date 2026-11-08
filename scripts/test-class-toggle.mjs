// [night-59a] D-322: `classList.toggle(name, force)` and `toggleAttribute(name, force)` FLIP the token when `force` is
// `undefined` (the weekly board opened in airport-pick mode for `pendingHub` missing from an e2e fixture). Every
// conditional class or flag attribute in src/ goes through `setClass` / `setFlagAttribute` (src/ui/classes.ts), which
// coerce. This TS-AST guard fails on any two-argument `.toggle(...)` or `.toggleAttribute(...)` call in src/ outside
// that file (a one-argument flip is allowed: it means "flip"), and checks the helpers on a fake element: undefined,
// null, 0 and '' clear the token, true sets it, and nothing ever flips.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { setClass, setFlagAttribute } from '../src/ui/classes.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HELPER = 'src/ui/classes.ts';
const METHODS = new Set(['toggle', 'toggleAttribute']);
let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ' — ' + detail}`);
}

/** "line:col .method(...)" for each forced toggle call in `text`. */
export function forcedToggles(text, file = 'snippet.ts') {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found = [];
  const walk = (node) => {
    if (ts.isCallExpression(node) && node.arguments.length >= 2) {
      const callee = node.expression;
      const name = ts.isPropertyAccessExpression(callee) ? callee.name.text
        : ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression) ? callee.argumentExpression.text : null;
      if (name && METHODS.has(name)) {
        const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        found.push(`${line + 1}:${character + 1} .${name}(…, ${node.arguments[1].getText(sf)})`);
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return found;
}

function sources(folder) {
  const out = [];
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    const file = resolve(folder, item.name);
    if (item.isDirectory()) out.push(...sources(file));
    else if (item.isFile() && ['.ts', '.tsx', '.mts'].includes(extname(file)) && !file.endsWith('.d.ts')) out.push(file);
  }
  return out;
}

// Self-checks of the detector.
check('detector: forced classList.toggle', forcedToggles("el.classList.toggle('a', x);").length === 1);
check('detector: optional chain and alias', forcedToggles("el?.classList?.toggle('a', x); const l = el.classList; l.toggle('b', y);").length === 2);
check('detector: element access and toggleAttribute', forcedToggles("el.classList['toggle']('a', x); host?.toggleAttribute('data-x', open);").length === 2);
check('detector: one-argument flip allowed', forcedToggles("el.classList.toggle('a'); el.toggleAttribute('hidden');").length === 0);
check('detector: setClass allowed', forcedToggles("setClass(el, 'a', on); setFlagAttribute(el, 'b', on);").length === 0);

// The helpers never flip.
function fakeElement(initial) {
  const tokens = new Set(initial);
  const attrs = new Set(initial);
  const apply = (set, name, force) => { const on = force === undefined ? !set.has(name) : force; if (on) set.add(name); else set.delete(name); return on; };
  return { tokens, attrs, classList: { toggle: (name, force) => apply(tokens, name, force) }, toggleAttribute: (name, force) => apply(attrs, name, force) };
}
const values = [[undefined, false], [null, false], [0, false], ['', false], [false, false], [true, true], [1, true]];
let helperOk = true;
const helperBad = [];
for (const [value, want] of values) for (const start of [[], ['x']]) {
  const el = fakeElement(start);
  setClass(el, 'x', value);
  setFlagAttribute(el, 'x', value);
  if (el.tokens.has('x') !== want || el.attrs.has('x') !== want) { helperOk = false; helperBad.push(`${String(value)} from ${start.length ? 'on' : 'off'}`); }
}
check('setClass / setFlagAttribute coerce (undefined/null/0/"" clear, true sets, never flip)', helperOk, helperBad.join(', '));
const sanity = fakeElement(['x']);
sanity.classList.toggle('x', undefined);
check('fake element reproduces the DOM flip on undefined', !sanity.tokens.has('x'));

// The source sweep.
const files = sources(resolve(ROOT, 'src'));
const offenders = [];
for (const file of files) {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  if (rel === HELPER) continue;
  for (const hit of forcedToggles(readFileSync(file, 'utf8'), file)) offenders.push(`${rel}:${hit}`);
}
check(`src/: no forced toggle outside ${HELPER} (use setClass / setFlagAttribute)`, offenders.length === 0, offenders.join('; '));
check('src/: the helper is in use', files.some((file) => !file.endsWith('classes.ts') && /\bsetClass\(/.test(readFileSync(file, 'utf8'))));

console.log(`SUMMARY test:class-toggle seed=0xA1A1 files=${files.length} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
