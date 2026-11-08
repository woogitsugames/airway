import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import ts from 'typescript';
import { analyse, countAt, decodeMappings } from './lib/coverage.mjs';
import { coverageRun, withinBudget } from './lib/time-budget.mjs';

let passed = 0, failed = 0;
function check(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); } }
check('source map decoder', () => assert.deepEqual(decodeMappings({ mappings: 'AAAA;AACA' }, 'a\nb').map((p) => p.line), [0, 1]));
check('nested zero overrides root', () => assert.equal(countAt([{ startOffset: 0, endOffset: 20, count: 1 }, { startOffset: 5, endOffset: 10, count: 0 }], 6), 0));
// [night-52a] Wall-clock budgets: enforced on a plain run, reported as INFO (and not failed) under V8 coverage.
check('time budget enforced without coverage', () => {
  const lines = [];
  const log = (line) => lines.push(line);
  assert.equal(coverageRun({}), false);
  assert.equal(withinBudget('x', 0.5, 1, { strict: true, env: {}, log }), true);
  assert.equal(withinBudget('x', 1, 1, { strict: true, env: {}, log }), false);
  assert.equal(withinBudget('x', 1, 1, { env: {}, log }), true);
  assert.equal(withinBudget('x', 3.2, 1, { env: { NODE_V8_COVERAGE: '' }, log }), false);
  assert.deepEqual(lines, []);
});
check('time budget reported as info under coverage', () => {
  const lines = [];
  const env = { NODE_V8_COVERAGE: '/tmp/raw' };
  assert.equal(coverageRun(env), true);
  assert.equal(withinBudget('edge chips', 3.2, 1, { strict: true, env, log: (line) => lines.push(line) }), true);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^INFO edge chips: 3\.200 ms over the 1 ms budget, not enforced under V8 coverage/);
});
const root = mkdtempSync(join(tmpdir(), 'airway-coverage-'));
try {
  const src = join(root, 'src'), raw = join(root, 'raw'); mkdirSync(src); mkdirSync(raw);
  const file = join(src, 'sample.ts');
  const source = 'export function one(): number {\n  return 1;\n}\nexport function two(): number {\n  return 2;\n}\none();\n';
  writeFileSync(file, source);
  writeFileSync(join(src, 'unloaded.ts'), 'export function untouched(): number {\n  return 0;\n}\n');
  const generated = ts.transpileModule(source, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const one = generated.indexOf('function one'), two = generated.indexOf('function two');
  const end = (start) => generated.indexOf('}', start) + 1;
  const proc = (a, b) => ({ result: [{ url: pathToFileURL(file).href, functions: [
    { ranges: [{ startOffset: 0, endOffset: generated.length, count: 1 }] },
    { ranges: [{ startOffset: one, endOffset: end(one), count: a }] },
    { ranges: [{ startOffset: two, endOffset: end(two), count: b }] },
  ] }] });
  writeFileSync(join(raw, 'one.json'), JSON.stringify(proc(1, 0)));
  let rows = analyse(root, raw); let sample = rows.find((r) => r.path.endsWith('/sample.ts'));
  check('one executed of two functions', () => { assert.equal(sample.functions, 2); assert.equal(sample.coveredFunctions, 1); });
  check('unloaded module is zero', () => { const r = rows.find((r) => r.path.endsWith('/unloaded.ts')); assert.equal(r.coveredLines, 0); assert.equal(r.coveredFunctions, 0); });
  writeFileSync(join(raw, 'two.json'), JSON.stringify(proc(0, 1)));
  rows = analyse(root, raw); sample = rows.find((r) => r.path.endsWith('/sample.ts'));
  check('union across processes', () => assert.equal(sample.coveredFunctions, 2));
  check('union increases covered lines', () => assert.ok(sample.coveredLines > 3));
  const realRaw = join(root, 'real'); mkdirSync(realRaw);
  const actual = spawnSync(process.execPath, ['--import', pathToFileURL(resolve('scripts/ts-test-loader.mjs')).href, file], { env: { ...process.env, NODE_V8_COVERAGE: realRaw }, encoding: 'utf8' });
  check('real V8 fixture runs', () => assert.equal(actual.status, 0, actual.stderr));
  check('real V8 coverage maps executed function', () => { const row = analyse(root, realRaw).find((r) => r.path.endsWith('/sample.ts')); assert.equal(row.coveredFunctions, 1); assert.ok(row.coveredLines > 0 && row.coveredLines < row.lines); });
  const dataRaw = join(root, 'data'); mkdirSync(dataRaw);
  const dataUrl = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(generated);
  const dataRun = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(dataUrl)})`],
    { env: { ...process.env, NODE_V8_COVERAGE: dataRaw }, encoding: 'utf8' });
  check('real V8 data URL fixture runs', () => assert.equal(dataRun.status, 0, dataRun.stderr));
  check('data URL maps to its unique original source', () => {
    const row = analyse(root, dataRaw).find((r) => r.path.endsWith('/sample.ts'));
    assert.equal(row.functions, 2); assert.equal(row.coveredFunctions, 1);
    assert.ok(row.coveredLines > 0 && row.coveredLines < row.lines);
  });
  const duplicate = join(src, 'duplicate.ts'); writeFileSync(duplicate, source);
  check('ambiguous data URL is not attributed', () => {
    const rows = analyse(root, dataRaw).filter((r) => /\/(sample|duplicate)\.ts$/.test(r.path));
    assert.equal(rows.length, 2); assert.ok(rows.every((r) => r.coveredLines === 0 && r.coveredFunctions === 0));
  });
  unlinkSync(duplicate);
  const nativeRaw = join(root, 'native'); mkdirSync(nativeRaw);
  const native = spawnSync(process.execPath, ['--experimental-strip-types', file], { env: { ...process.env, NODE_V8_COVERAGE: nativeRaw }, encoding: 'utf8' });
  check('native type stripping runs', () => assert.equal(native.status, 0, native.stderr));
  check('native type stripping maps executed function', () => { const row = analyse(root, nativeRaw).find((r) => r.path.endsWith('/sample.ts')); assert.equal(row.coveredFunctions, 1); assert.ok(row.coveredLines > 0 && row.coveredLines < row.lines); });
  const empty = join(src, 'empty-arrows.ts');
  writeFileSync(empty, 'export const uncalled = () => {}; export const called = () => {}; called();\n');
  const emptyRaw = join(root, 'empty'); mkdirSync(emptyRaw);
  const emptyRun = spawnSync(process.execPath, ['--import', pathToFileURL(resolve('scripts/ts-test-loader.mjs')).href, empty], { env: { ...process.env, NODE_V8_COVERAGE: emptyRaw }, encoding: 'utf8' });
  check('empty arrow fixture runs', () => assert.equal(emptyRun.status, 0, emptyRun.stderr));
  check('empty arrow functions are counted', () => {
    const row = analyse(root, emptyRaw).find((r) => r.path.endsWith('/empty-arrows.ts'));
    assert.equal(row.functions, 2); assert.equal(row.coveredFunctions, 1);
  });
  const arrows = join(src, 'arrows.ts');
  writeFileSync(arrows, 'export const uncalled = () => 42; export const called = () => 1; called();\n');
  for (const [mode, args] of [
    ['loader', ['--import', pathToFileURL(resolve('scripts/ts-test-loader.mjs')).href, arrows]],
    ['native', ['--experimental-strip-types', arrows]],
  ]) {
    const directory = join(root, 'arrows-' + mode); mkdirSync(directory);
    const run = spawnSync(process.execPath, args, { env: { ...process.env, NODE_V8_COVERAGE: directory }, encoding: 'utf8' });
    check(`arrow fixture ${mode} runs`, () => assert.equal(run.status, 0, run.stderr));
    check(`arrow fixture ${mode} counts both functions`, () => {
      const row = analyse(root, directory).find((r) => r.path.endsWith('/arrows.ts'));
      assert.equal(row.functions, 2); assert.equal(row.coveredFunctions, 1);
    });
  }
} finally {
  if (dirname(resolve(root)) !== resolve(tmpdir())) throw new Error('Unexpected coverage fixture path');
  rmSync(root, { recursive: true, force: true });
}
console.log(`SUMMARY test:coverage seed=0xA1A1 passed=${passed} failed=${failed}`);
process.exitCode = failed ? 1 : 0;
