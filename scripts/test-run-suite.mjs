import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'airway-suite-'));
let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; } catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ private: true, scripts: {
    slow: 'node fixture.cjs slow', pass: 'node fixture.cjs pass', fail: 'node fixture.cjs fail',
    'test:replay-cost': 'node fixture.cjs serial'
  }}));
  writeFileSync(join(dir, 'fixture.cjs'), `const fs = require('node:fs');\nconst name = process.argv[2];\nfs.appendFileSync('events', 'start ' + name + '\\n');\nconst bytes = Buffer.from(String.fromCodePoint(380)); process.stdout.write(bytes.subarray(0, 1)); setTimeout(() => { process.stdout.write(bytes.subarray(1)); process.stdout.write(String.fromCharCode(10)); }, 10);\nsetTimeout(() => { fs.appendFileSync('events', 'end ' + name + '\\n'); console.log('SUMMARY fixture ' + name); process.exitCode = name === 'fail' ? 1 : 0; }, name === 'slow' ? 300 : 40);\n`);
  for (const jobs of [1, 4]) {
    writeFileSync(join(dir, 'events'), '');
    const run = spawnSync(process.execPath, [resolve('scripts/run-suite.mjs'), 'test:fast', 'slow', 'pass', 'test:replay-cost', 'fail', `--jobs=${jobs}`], { cwd: dir, encoding: 'utf8' });
    const events = readFileSync(join(dir, 'events'), 'utf8').trim().split('\n');
    check(`exit and summary jobs=${jobs}`, () => { assert.equal(run.status, 1); assert.match(run.stdout, /steps=4 passed=3 failed=1 .*failing=fail/); });
    check(`UTF-8 output jobs=${jobs}`, () => assert.match(run.stdout, /\u017c/));
    check(`ordered output jobs=${jobs}`, () => assert.deepEqual([...run.stdout.matchAll(/^(?:PASS|FAIL) (\S+)/gm)].map((m) => m[1]), ['slow', 'pass', 'test:replay-cost', 'fail']));
    check(`failure tail jobs=${jobs}`, () => assert.match(run.stdout, /FAIL fail[\s\S]*\| SUMMARY fixture fail/));
    if (jobs === 4) check('parallel overlap', () => assert.ok(events.indexOf('start pass') < events.indexOf('end slow')));
    const success = spawnSync(process.execPath, [resolve('scripts/run-suite.mjs'), 'test:fast', 'pass', `--jobs=${jobs}`], { cwd: dir, encoding: 'utf8' });
    check(`success exit jobs=${jobs}`, () => { assert.equal(success.status, 0); assert.match(success.stdout, /steps=1 passed=1 failed=0/); });
    check(`serial barrier jobs=${jobs}`, () => { const start = events.indexOf('start serial'); const end = events.indexOf('end serial'); assert.ok(start > events.indexOf('end slow') && start > events.indexOf('end pass')); assert.ok(end < events.indexOf('start fail')); });
  }
  writeFileSync(join(dir, 'events'), '');
  const ci = spawnSync(process.execPath, [resolve('scripts/run-suite.mjs'), 'test:ci', 'slow', 'pass', '--jobs=4'], { cwd: dir, encoding: 'utf8' });
  const ciEvents = readFileSync(join(dir, 'events'), 'utf8').trim().split('\n');
  check('CI remains serial', () => { assert.equal(ci.status, 0); assert.ok(ciEvents.indexOf('start pass') > ciEvents.indexOf('end slow')); });
  check('CI ordered summary', () => assert.match(ci.stdout, /steps=2 passed=2 failed=0/));
} finally {
  if (dirname(resolve(dir)) !== resolve(tmpdir())) throw new Error('Unexpected runner fixture path');
  rmSync(dir, { recursive: true, force: true });
}
console.log(`SUMMARY test:run-suite seed=0xA1A1 passed=${passed} failed=${failed}`);
process.exitCode = failed ? 1 : 0;
