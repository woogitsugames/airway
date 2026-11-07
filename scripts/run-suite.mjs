// Run npm scripts with ordered reporting. CI remains sequential; only test:fast uses the pool.
import { spawn } from 'node:child_process';
import { availableParallelism, cpus } from 'node:os';
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);
const jobArg = args.find((arg) => arg.startsWith('--jobs='));
if (jobArg) args.splice(args.indexOf(jobArg), 1);
const [suite, ...steps] = args;
const requested = jobArg?.slice(7) ?? process.env.AW_JOBS ?? String(Math.min(8, availableParallelism?.() ?? cpus().length));
if (!suite || !steps.length || !/^[1-9]\d*$/.test(requested) || !Number.isSafeInteger(Number(requested))) {
  console.error('usage: node scripts/run-suite.mjs <suite-name> <npm-script>... [--jobs=N]');
  process.exit(2);
}
const jobs = suite === 'test:fast' ? Number(requested) : 1;
// Wall-clock budgets need an idle machine; arch stays the final barrier.
const serial = new Set(['typecheck', 'test:overlay-layout', 'test:replay-cost', 'test:suite-runner', 'test:run-suite', 'test:arch']);
const results = new Array(steps.length);
const started = performance.now();
let next = 0;
let active = 0;
let printed = 0;
let serialActive = false;

function run(step) {
  return new Promise((resolve) => {
    const [script, ...extra] = step.split(' ');
    const t0 = performance.now();
    // npm_execpath identifies npm's JS entry point even on Windows, where .cmd files
    // cannot be spawned directly by modern Node without a command shell.
    const npmCli = process.env.npm_execpath;
    const command = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
    const argv = [...(npmCli ? [npmCli] : []), 'run', '-s', script, ...extra];
    let output = '';
    const shell = !npmCli && process.platform === 'win32';
    const safe = !shell || argv.every((arg) => /^[\w./:@=+-]+$/.test(arg));
    if (!safe) { resolve({ step, ok: false, seconds: 0, output: 'Unsafe argument for Windows npm.cmd fallback' }); return; }
    let child;
    try { child = spawn(command, argv, { shell, windowsHide: true }); }
    catch (error) { resolve({ step, ok: false, seconds: (performance.now() - t0) / 1000, output: String(error) }); return; }
    let tooLarge = false;
    const add = (chunk) => {
      output += chunk;
      if (output.length > 64 * 1024 * 1024) { output = output.slice(-64 * 1024 * 1024); tooLarge = true; }
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', add);
    child.stderr.on('data', add);
    child.on('error', (error) => { add(`\n${error.message}\n`); });
    child.on('close', (code) => {
      if (tooLarge) add('\nOutput exceeded 64 MiB\n');
      resolve({ step, ok: code === 0 && !tooLarge, seconds: (performance.now() - t0) / 1000, output });
    });
  });
}
function flush() {
  while (results[printed]) {
    const { step, ok, seconds, output } = results[printed++];
    const summary = output.split('\n').filter((line) => line.startsWith('SUMMARY')).pop() ?? '';
    console.log(`${ok ? 'PASS' : 'FAIL'} ${step.padEnd(24)} ${seconds.toFixed(1).padStart(6)}s  ${summary}`);
    if (!ok) console.log(output.trimEnd().split('\n').slice(-15).map((line) => '     | ' + line).join('\n'));
  }
}
await new Promise((done) => {
  function schedule() {
    if (next === steps.length && active === 0) return done();
    while (next < steps.length && active < jobs && !serialActive) {
      const isSerial = serial.has(steps[next]);
      if (isSerial && active) break;
      const index = next++;
      active++;
      serialActive = isSerial;
      run(steps[index]).then((result) => {
        results[index] = result;
        active--;
        if (isSerial) serialActive = false;
        flush();
        schedule();
      });
      if (isSerial) break;
    }
  }
  schedule();
});
const failed = results.filter((result) => !result.ok);
console.log(`SUMMARY ${suite} seed=0xA1A1 steps=${results.length} passed=${results.length - failed.length} ` +
  `failed=${failed.length} durationS=${((performance.now() - started) / 1000).toFixed(1)}` +
  (failed.length ? ` failing=${failed.map((r) => r.step.replace(/ /g, '_')).join(',')}` : ''));
process.exitCode = failed.length ? 1 : 0;
