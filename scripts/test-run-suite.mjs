// [night-33b] D-289: self-test of the suite runner (scripts/run-suite.mjs). Pure checks of the option parser, the
// start order and the pool with fake steps, then the real CLI on a throwaway npm package with synthetic steps
// (pass, fail, slow, a serial step that checks it runs alone) at --jobs=1 and --jobs=4: same lines in list order,
// the failure tail, `failing=`, the exit code and the serial step never sharing the machine.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERIAL_STEPS, defaultJobs, parseArgs, runPool, startOrder, stepLine } from './run-suite.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; } catch (error) { failed++; console.log(`FAIL ${name}: ${error.message}`); }
}
const eq = (a, b, what = '') => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what} ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
};
const ok = (value, what) => { if (!value) throw new Error(what); };

await check('parseArgs: --jobs anywhere, last wins, env default, bad values refused', () => {
  eq(parseArgs(['s', 'a', 'b'], { AW_JOBS: '3' }), { suite: 's', steps: ['a', 'b'], jobs: 3 });
  eq(parseArgs(['--jobs=1', 's', 'a', '--jobs=5'], { AW_JOBS: '3' }), { suite: 's', steps: ['a'], jobs: 5 });
  eq(parseArgs(['s', 'a -- --check'], {}).steps, ['a -- --check']);
  for (const bad of ['--jobs=0', '--jobs', '--jobs=x']) {
    let threw = false;
    try { parseArgs(['s', 'a', bad], {}); } catch { threw = true; }
    ok(threw, `${bad} accepted`);
  }
});

await check('defaultJobs: CPUs capped at 8 and by RAM, AW_JOBS overrides', () => {
  const gib = 2 ** 30;
  eq(defaultJobs({}, 4, 16 * gib), 4);
  eq(defaultJobs({}, 32, 64 * gib), 8);
  eq(defaultJobs({}, 8, 4 * gib), 2);
  eq(defaultJobs({}, 8, 0.5 * gib), 1);
  eq(defaultJobs({ AW_JOBS: '2' }, 8, 64 * gib), 2);
  eq(defaultJobs({ AW_JOBS: 'junk' }, 3, 64 * gib), 3);
});

await check('startOrder: list order at 1 job; serial first, then longest previous first', () => {
  const steps = ['a', 'b', 's', 'c', 'd'];
  const serial = new Set(['s']);
  eq(startOrder(steps, 1, serial, { a: 1, b: 9 }), [0, 1, 2, 3, 4]);
  eq(startOrder(steps, 4, serial, { a: 1, b: 9, c: 5 }), [2, 4, 1, 3, 0]); // d unknown → first of the rest
});

await check('SERIAL_STEPS names real test:fast steps', async () => {
  const { readFileSync } = await import('node:fs');
  const fast = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts['test:fast'].split(/\s+/);
  for (const step of SERIAL_STEPS) ok(fast.includes(step), `${step} not in test:fast`);
});

await check('runPool: reports in list order, ≤ jobs at once, a serial step alone', async () => {
  const steps = ['slow', 'quick', 'alone', 'mid', 'tail'];
  const time = { slow: 40, quick: 5, alone: 10, mid: 20, tail: 5 };
  let running = 0, peak = 0, aloneShared = false;
  const reported = [];
  await runPool(steps, {
    jobs: 3, serial: new Set(['alone']), order: [2, 0, 3, 1, 4],
    report: (i, result) => reported.push([steps[i], result.status]),
    run: (step) => new Promise((done) => {
      running++;
      peak = Math.max(peak, running);
      const check = () => { if (step === 'alone' && running !== 1) aloneShared = true; };
      check();
      setTimeout(() => { check(); running--; done({ status: step === 'mid' ? 1 : 0, seconds: 0, output: '' }); },
        time[step]);
    }),
  });
  eq(reported, [['slow', 0], ['quick', 0], ['alone', 0], ['mid', 1], ['tail', 0]], 'report order');
  ok(peak === 3, `peak ${peak}`);
  ok(!aloneShared, 'serial step shared the pool');
});

await check('stepLine: PASS line with the last SUMMARY, FAIL line with the output tail', () => {
  eq(stepLine('test:x', { status: 0, seconds: 1.23, output: 'SUMMARY a\nnoise\nSUMMARY b passed=1\n' }),
    `PASS ${'test:x'.padEnd(24)}    1.2s  SUMMARY b passed=1`);
  const fail = stepLine('test:y', { status: 1, seconds: 0, output: Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n') });
  ok(fail.startsWith('FAIL test:y') && fail.includes('     | l19') && fail.includes('     | l5') && !fail.includes('| l4\n'),
    'tail of 15 lines');
});

// The CLI on a throwaway package: each step leaves a marker while it runs, the serial step fails if it sees another.
const dir = mkdtempSync(join(tmpdir(), 'aw-run-suite-'));
try {
  const node = (code) => `node -e ${JSON.stringify(code)}`;
  const busy = (ms, exit = 0, text = '') => node(
    `const f=require('fs'),m='run-'+process.pid;f.writeFileSync(m,'');` +
    `setTimeout(()=>{f.unlinkSync(m);${text ? `console.log(${JSON.stringify(text)});` : ''}process.exit(${exit})},${ms})`);
  const serial = [...SERIAL_STEPS][0];
  const scripts = {
    'test:slow': busy(900, 0, 'SUMMARY test:slow passed=1 failed=0'),
    'test:pass': busy(50, 0, 'SUMMARY test:pass passed=1 failed=0'),
    'test:fail': busy(50, 1, 'boom on stdout\nSUMMARY test:fail passed=0 failed=1'),
    [serial]: node(
      `const f=require('fs'),m='run-'+process.pid;const others=()=>f.readdirSync('.').filter(x=>x.startsWith('run-')&&x!==m);` +
      `f.writeFileSync(m,'');let seen=others().length;` +
      `const t=setInterval(()=>{seen+=others().length},10);` +
      `setTimeout(()=>{clearInterval(t);f.unlinkSync(m);console.log('SUMMARY serial seen='+seen);process.exit(seen?1:0)},300)`),
    'test:args': 'node args.cjs',
  };
  writeFileSync(join(dir, 'args.cjs'), "console.log('SUMMARY args ' + process.argv.slice(2).join(','));\n");
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'aw-run-suite-fixture', private: true, scripts }));
  const steps = ['test:slow', 'test:pass', serial, 'test:fail', 'test:pass', 'test:args -- --x'];
  const run = (jobs) => spawnSync(process.execPath, [join(ROOT, 'scripts/run-suite.mjs'), 'fixture', ...steps, `--jobs=${jobs}`],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, AW_JOBS: '' } });
  const lines = (out) => out.split('\n').filter((l) => /^(PASS|FAIL) /.test(l)).map((l) => l.split(/\s+/).slice(0, 2).join(' '));
  const expected = ['PASS test:slow', 'PASS test:pass', `PASS ${serial}`, 'FAIL test:fail', 'PASS test:pass', 'PASS test:args'];
  const outputs = {};
  for (const jobs of [1, 4]) {
    await check(`CLI --jobs=${jobs}: list order, failure tail, failing=, exit 1, serial alone`, () => {
      const r = run(jobs);
      outputs[jobs] = r.stdout;
      eq(lines(r.stdout), expected, 'lines');
      ok(r.status === 1, `exit ${r.status}`);
      ok(r.stdout.includes('     | boom on stdout'), 'failure tail');
      ok(r.stdout.includes('SUMMARY args --x'), 'step arguments');
      const summary = r.stdout.trimEnd().split('\n').pop();
      ok(new RegExp(`^SUMMARY fixture seed=0xA1A1 steps=6 passed=5 failed=1 durationS=[\\d.]+ jobs=${jobs} failing=test:fail$`)
        .test(summary), summary);
    });
  }
  await check('CLI: --jobs=4 is faster than --jobs=1 and both print the same SUMMARY fields', () => {
    const duration = (out) => Number(out.match(/durationS=([\d.]+)/)[1]);
    ok(duration(outputs[4]) < duration(outputs[1]), `${duration(outputs[4])} ≥ ${duration(outputs[1])}`);
    const strip = (out) => out.trimEnd().split('\n').pop().replace(/durationS=\S+ jobs=\d+/, '');
    eq(strip(outputs[4]), strip(outputs[1]));
  });
  await check('CLI: a green suite exits 0 without failing=', () => {
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts/run-suite.mjs'), '--jobs=2', 'green', 'test:pass', serial],
      { cwd: dir, encoding: 'utf8' });
    ok(r.status === 0, `exit ${r.status}`);
    ok(/SUMMARY green seed=0xA1A1 steps=2 passed=2 failed=0 durationS=[\d.]+ jobs=2$/.test(r.stdout.trimEnd()), r.stdout);
  });
  await check('CLI: usage error exits 2', () => {
    eq(spawnSync(process.execPath, [join(ROOT, 'scripts/run-suite.mjs'), 'only-name'], { cwd: dir }).status, 2);
    eq(spawnSync(process.execPath, [join(ROOT, 'scripts/run-suite.mjs'), 's', 'a', '--jobs=0'], { cwd: dir }).status, 2);
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`SUMMARY test:run-suite seed=0xA1A1 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
