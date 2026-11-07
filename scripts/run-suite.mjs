// Runs npm scripts as one suite, keeps going after a failure, and prints one line per step plus a SUMMARY.
//   node scripts/run-suite.mjs [--jobs=N] <name> <npm-script> [<npm-script> ...] [--jobs=N]
// Steps may carry arguments: "build:land -- --check".
//
// [night-33b] D-289: steps run in a pool of `--jobs=N` processes (default: CPUs, at most 8 and at most one per
// 1.5 GiB of RAM; `AW_JOBS` overrides the default, `--jobs` overrides both). `--jobs=1` is the old sequential runner.
// The output is the same at every N: results are buffered and the `PASS|FAIL` lines print in step-list order, then
// the SUMMARY. Steps in SERIAL_STEPS run alone, with no other step beside them. With jobs > 1 the pool starts the
// slowest steps of the previous run first (durations cached in the ignored node_modules/.cache/run-suite/).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism, totalmem } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

/**
 * Steps that must not share the machine. Every other test:fast step is a self-contained Node/tsc process that writes
 * only to its own `mkdtemp` folder (audited in D-289); a step that binds a fixed port, writes a shared file, starts
 * Vite/Chromium or asserts wall-clock time belongs here.
 * - test:overlay-layout: edge-chip placement under 1 ms per frame (performance.now()).
 * - test:replay-cost: replay verification within 600 ms per game week and 5 s per dense journal.
 */
export const SERIAL_STEPS = new Set(['test:overlay-layout', 'test:replay-cost']);

/** Default pool size: `AW_JOBS`, else CPUs capped at 8 and at one job per 1.5 GiB of RAM. */
export function defaultJobs(env = process.env, cpus = availableParallelism(), memory = totalmem()) {
  const fromEnv = Number.parseInt(env.AW_JOBS ?? '', 10);
  if (fromEnv >= 1) return fromEnv;
  return Math.max(1, Math.min(cpus, 8, Math.floor(memory / (1.5 * 2 ** 30))));
}

/** Splits argv into `--jobs=N` and the positional suite/steps; the last `--jobs=N` wins, wherever it stands. */
export function parseArgs(argv, env = process.env) {
  let jobs = null;
  const positional = [];
  for (const arg of argv) {
    const m = arg.match(/^--jobs=(\d+)$/);
    if (m && Number(m[1]) >= 1) jobs = Number(m[1]);
    else if (arg.startsWith('--jobs')) throw new Error(`bad option ${arg} (expected --jobs=N with N ≥ 1)`);
    else positional.push(arg);
  }
  const [suite, ...steps] = positional;
  return { suite, steps, jobs: jobs ?? defaultJobs(env) };
}

/**
 * Start order of the pool (indices into steps): with one job the list order; otherwise the serial steps first (each
 * alone, on an idle machine), then the rest by previous duration, longest first (unknown steps first, list order).
 */
export function startOrder(steps, jobs, serial, previous = {}) {
  const index = steps.map((_, i) => i);
  if (jobs <= 1) return index;
  const known = (i) => previous[steps[i]] ?? Infinity;
  const first = index.filter((i) => serial.has(steps[i]));
  const rest = index.filter((i) => !serial.has(steps[i])).sort((a, b) => known(b) - known(a) || a - b);
  return [...first, ...rest];
}

/**
 * The pool. `run(step)` resolves {status, output, seconds}; `report(i, result)` is called once per step in list
 * order, as soon as that step and every step before it have finished. A serial step starts only on an idle pool and
 * nothing starts beside it.
 */
export async function runPool(steps, { jobs, serial, order, run, report }) {
  const results = new Array(steps.length);
  let printed = 0;
  let running = 0;
  let alone = false;
  const queue = [...order];
  await new Promise((finished) => {
    const pump = () => {
      while (queue.length && running < jobs && !alone) {
        const i = queue[0];
        const isSerial = serial.has(steps[i]);
        if (isSerial && running > 0) break;
        queue.shift();
        running++;
        alone = isSerial;
        run(steps[i]).then((result) => {
          results[i] = result;
          running--;
          if (isSerial) alone = false;
          while (printed < steps.length && results[printed]) report(printed, results[printed++]);
          if (printed === steps.length) finished();
          else pump();
        });
      }
    };
    if (!steps.length) finished();
    pump();
  });
  return results;
}

/** Runs one npm script; resolves with its exit status, its output (stdout then stderr) and seconds. */
function runStep(step, npmCli) {
  const [script, ...extra] = step.split(' ');
  const t0 = performance.now();
  // npm provides its JavaScript entry point when it runs us as a package script; running it with this Node
  // executable also works on Windows, where a .cmd file cannot be spawned directly.
  const command = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const args = [...(npmCli ? [npmCli] : []), 'run', '-s', script, ...extra];
  // A direct invocation on Windows needs cmd.exe for npm.cmd; only plain arguments are accepted there, so shell
  // metacharacters cannot be interpreted as commands.
  const shell = !npmCli && process.platform === 'win32';
  if (shell && !args.every((arg) => /^[\w./:@=+-]+$/.test(arg))) {
    return Promise.resolve({ status: null, seconds: 0, output: 'Unsafe argument for Windows npm.cmd fallback\n' });
  }
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell, windowsHide: true });
    const out = [];
    const err = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    let settled = false;
    const settle = (status) => {
      if (settled) return;
      settled = true;
      done({ status, seconds: (performance.now() - t0) / 1000,
        output: Buffer.concat(out).toString('utf8') + Buffer.concat(err).toString('utf8') });
    };
    child.on('error', (error) => { err.push(Buffer.from(String(error))); settle(null); });
    child.on('close', settle);
  });
}

/** One result line: `PASS|FAIL <step> <seconds>s  <last SUMMARY line>`, plus the output tail on a failure. */
export function stepLine(step, { status, seconds, output }) {
  const ok = status === 0;
  const summary = output.split('\n').filter((line) => line.startsWith('SUMMARY')).pop() ?? '';
  let line = `${ok ? 'PASS' : 'FAIL'} ${step.padEnd(24)} ${seconds.toFixed(1).padStart(6)}s  ${summary}`;
  // Show the tail so a failure is diagnosable without rerunning.
  if (!ok) line += '\n' + output.trimEnd().split('\n').slice(-15).map((l) => '     | ' + l).join('\n');
  return line;
}

// The package being tested (npm runs us from its root); its node_modules is ignored by git.
const CACHE = resolve('node_modules/.cache/run-suite');
const cacheFile = (suite) => resolve(CACHE, `${suite.replace(/[^\w.-]/g, '_')}.json`);

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exit(2); }
  const { suite, steps, jobs } = args;
  if (!suite || !steps.length) {
    console.error('usage: node scripts/run-suite.mjs [--jobs=N] <suite-name> <npm-script>...');
    process.exit(2);
  }
  const npmCli = process.env.npm_execpath;
  const started = performance.now();
  let previous = {};
  try { previous = JSON.parse(readFileSync(cacheFile(suite), 'utf8')); } catch { /* first run: list order */ }
  const results = await runPool(steps, {
    jobs, serial: SERIAL_STEPS, order: startOrder(steps, jobs, SERIAL_STEPS, previous),
    run: (step) => runStep(step, npmCli),
    report: (i, result) => console.log(stepLine(steps[i], result)),
  });
  try {
    mkdirSync(CACHE, { recursive: true });
    const times = Object.fromEntries(steps.map((step, i) => [step, Number(results[i].seconds.toFixed(1))]));
    writeFileSync(cacheFile(suite), JSON.stringify({ ...previous, ...times }, null, 1) + '\n');
  } catch { /* the cache only orders the next run */ }
  const failed = steps.filter((_, i) => results[i].status !== 0);
  console.log(`SUMMARY ${suite} seed=0xA1A1 steps=${steps.length} passed=${steps.length - failed.length} ` +
    `failed=${failed.length} durationS=${((performance.now() - started) / 1000).toFixed(1)} jobs=${jobs}` +
    (failed.length ? ` failing=${failed.map((step) => step.replace(/ /g, '_')).join(',')}` : ''));
  process.exitCode = failed.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
