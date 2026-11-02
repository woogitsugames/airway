// Runs npm scripts in order, keeps going after a failure, and prints one line per step plus a SUMMARY.
//   node scripts/run-suite.mjs <name> <npm-script> [<npm-script> ...]
// Steps may carry arguments: "build:land -- --check".
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const [suite, ...steps] = process.argv.slice(2);
if (!suite || !steps.length) {
  console.error('usage: node scripts/run-suite.mjs <suite-name> <npm-script>...');
  process.exit(2);
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const results = [];
const started = performance.now();
for (const step of steps) {
  const [script, ...extra] = step.split(' ');
  const t0 = performance.now();
  const run = spawnSync(npm, ['run', '-s', script, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const seconds = (performance.now() - t0) / 1000;
  const output = (run.stdout ?? '') + (run.stderr ?? '');
  const ok = run.status === 0;
  const summary = output.split('\n').filter((line) => line.startsWith('SUMMARY')).pop() ?? '';
  results.push({ step, ok, seconds });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step.padEnd(24)} ${seconds.toFixed(1).padStart(6)}s  ${summary}`);
  if (!ok) {
    // Show the tail so a failure is diagnosable without rerunning.
    const tail = output.trimEnd().split('\n').slice(-15).map((line) => '     | ' + line).join('\n');
    console.log(tail);
  }
}
const failed = results.filter((r) => !r.ok);
console.log(`SUMMARY ${suite} seed=0xA1A1 steps=${results.length} passed=${results.length - failed.length} ` +
  `failed=${failed.length} durationS=${((performance.now() - started) / 1000).toFixed(1)}` +
  (failed.length ? ` failing=${failed.map((r) => r.step.replace(/ /g, '_')).join(',')}` : ''));
process.exitCode = failed.length ? 1 : 0;
