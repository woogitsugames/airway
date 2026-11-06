import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import ts from 'typescript';
import { analyse, countAt, decodeMappings } from './lib/coverage.mjs';

let passed = 0, failed = 0;
function check(name, fn) { try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL ${name}: ${e.stack}`); } }
check('source map decoder', () => assert.deepEqual(decodeMappings({ mappings: 'AAAA;AACA' }, 'a\nb').map((p) => p.line), [0, 1]));
check('nested zero overrides root', () => assert.equal(countAt([{ startOffset: 0, endOffset: 20, count: 1 }, { startOffset: 5, endOffset: 10, count: 0 }], 6), 0));
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
  const nativeRaw = join(root, 'native'); mkdirSync(nativeRaw);
  const native = spawnSync(process.execPath, ['--experimental-strip-types', file], { env: { ...process.env, NODE_V8_COVERAGE: nativeRaw }, encoding: 'utf8' });
  check('native type stripping runs', () => assert.equal(native.status, 0, native.stderr));
  check('native type stripping maps executed function', () => { const row = analyse(root, nativeRaw).find((r) => r.path.endsWith('/sample.ts')); assert.equal(row.coveredFunctions, 1); assert.ok(row.coveredLines > 0 && row.coveredLines < row.lines); });
} finally {
  if (dirname(resolve(root)) !== resolve(tmpdir())) throw new Error('Unexpected coverage fixture path');
  rmSync(root, { recursive: true, force: true });
}
console.log(`SUMMARY test:coverage seed=0xA1A1 passed=${passed} failed=${failed}`);
process.exitCode = failed ? 1 : 0;
