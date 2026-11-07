import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

let passed = 0, failed = 0;
function check(name, fn) { try { fn(); passed++; } catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); } }
const root = mkdtempSync(join(tmpdir(), 'airway-run-suite-'));
try {
  writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true, scripts: {
    fixture: `node -e "console.log('SUMMARY fixture passed=1 failed=0')"`,
  } }));
  const runner = resolve('scripts/run-suite.mjs');
  for (const mode of ['npm', 'direct']) {
    const env = { ...process.env };
    if (mode === 'direct') delete env.npm_execpath;
    const run = spawnSync(process.execPath, [runner, 'fixture-suite', 'fixture', 'missing-fixture'], { cwd: root, env, encoding: 'utf8' });
    check(`${mode}: exit and failure report`, () => { assert.equal(run.status, 1); assert.match(run.stdout, /steps=2 passed=1 failed=1 .*failing=missing-fixture/); });
    check(`${mode}: successful step and ordered output`, () => { assert.match(run.stdout, /PASS fixture\s+\S+s\s+SUMMARY fixture passed=1 failed=0/); assert.ok(run.stdout.indexOf('PASS fixture') < run.stdout.indexOf('FAIL missing-fixture')); });
  }
} finally {
  if (dirname(resolve(root)) !== resolve(tmpdir())) throw new Error('Unexpected runner fixture path');
  rmSync(root, { recursive: true, force: true });
}
console.log(`SUMMARY test:suite-runner seed=0xA1A1 passed=${passed} failed=${failed}`);
process.exitCode = failed ? 1 : 0;
