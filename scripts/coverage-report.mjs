// Manual headless coverage: no instrumentation dependency, native V8 child-process coverage.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { analyse, countAt, decodeMappings } from './lib/coverage.mjs';

try {
assert.deepEqual(decodeMappings({ mappings: 'AAAA;AACA' }, 'a\nb').map((x) => x.line), [0, 1]);
assert.equal(countAt([{ startOffset: 0, endOffset: 20, count: 1 }, { startOffset: 5, endOffset: 10, count: 0 }], 6), 0);
assert.equal(countAt([{ startOffset: 0, endOffset: 20, count: 1 }, { startOffset: 5, endOffset: 10, count: 0 }], 12), 1);
const root = process.cwd();
const dir = resolve(root, '.coverage');
mkdirSync(dir, { recursive: true });
const raw = mkdtempSync(join(dir, 'run-'));
let status = 0;
{
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const args = [...(npmCli ? [npmCli] : []), 'run', 'test:fast'];
  const result = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, NODE_V8_COVERAGE: raw }, shell: !npmCli && process.platform === 'win32' });
  status = result.status ?? 1;
}
if (!readdirSync(raw).some((name) => name.endsWith('.json'))) {
  console.error('No V8 coverage files were produced');
  status = 1;
}
const results = analyse(root, raw);
const pct = (covered, total) => total ? `${(100 * covered / total).toFixed(1)}%` : 'n/a';
const table = ['| Module | Lines | Functions |', '| --- | ---: | ---: |', ...results.map((r) =>
  `| ${r.path} | ${pct(r.coveredLines, r.lines)} (${r.coveredLines}/${r.lines}) | ${pct(r.coveredFunctions, r.functions)} (${r.coveredFunctions}/${r.functions}) |`)];
const text = '# Headless coverage\n\nMapped executable source lines and function bodies covered at least once across all V8 processes.\n' +
  'Modules not loaded have zero coverage. Generated temporary copies of source modules are not attributed.\n' +
  'This is execution evidence, not branch coverage or a quality threshold.\n\n' + table.join('\n') + '\n';
writeFileSync(join(dir, 'summary.md'), text);
writeFileSync(join(dir, 'summary.json'), JSON.stringify(results, null, 2) + '\n');
console.log(table.join('\n'));
console.log(`SUMMARY coverage:fast seed=0xA1A1 modules=${results.length} passed=${status === 0 ? 1 : 0} failed=${status === 0 ? 0 : 1}`);
process.exitCode = status === 0 ? 0 : 1;
} catch (error) {
  console.error('Coverage report failed:', error);
  console.log('SUMMARY coverage:fast seed=0xA1A1 modules=0 passed=0 failed=1');
  process.exitCode = 1;
}
