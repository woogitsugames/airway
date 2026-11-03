// [night-06b] D-66 server test: builds functions/, starts the Auth/Functions/Firestore emulators (demo project,
// no credentials, no network to Google) and runs scripts/emulator-checks.mjs against them.
// Needs `npm install --prefix functions --package-lock=false` and Java 11+ (Firestore emulator).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const firebase = resolve(ROOT, 'functions/node_modules/.bin/firebase');
if (!existsSync(firebase)) {
  console.error('functions/node_modules missing: run `npm install --prefix functions --package-lock=false --no-audit --no-fund`');
  console.log('SUMMARY test:firebase passed=0 failed=1 (setup)');
  process.exit(1);
}
const run = (command, args) => spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' }).status ?? 1;
if (run('npm', ['--prefix', 'functions', 'run', 'build']) !== 0) process.exit(1);
process.exit(run(firebase, ['emulators:exec', '--project', 'demo-airway', '--only', 'auth,functions,firestore',
  'node scripts/emulator-checks.mjs']));
