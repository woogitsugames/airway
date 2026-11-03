// [task-15] Fixed-seed regression for three independent congestion scenarios.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// [task-15] Load these pure TS modules on Node 18+ without a custom loader.
async function loadPureTypeScript(relative) {
  const file = resolve(dirname(fileURLToPath(import.meta.url)), relative);
  const source = readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import('data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64'));
}
const [{ buildCauseReport }, { sameWorldIdentity, nextWorldSeed },
  { persistBestRecord, readBestRecord }] = await Promise.all([
  loadPureTypeScript('../src/game/causes.ts'),
  loadPureTypeScript('../src/ui/gameover/seed.ts'),
  loadPureTypeScript('../src/ui/gameover/storage.ts'),
]);

const SEED = '0xA1A1';
let passed = 0;
let failed = 0;

const scenarios = [
  {
    label: 'continental demand / aircraft shortage',
    ledger: {
      waiting: 100, capacity: 100, waitingByRegion: { NAM: 62, EUN: 16, AFR: 22 },
      seatsUnavailable: 18,
    },
    expected: ['regional-demand', 'capacity', 'seat-shortage'],
  },
  {
    label: 'missing routes / missed transfers',
    ledger: {
      waiting: 20, capacity: 40, waitingByRegion: { NAM: 5, SAM: 5, EUN: 5, ME: 5 },
      noRoute: 16, missedTransfers: 12, waitingTooLong: 8,
    },
    expected: ['no-route', 'missed-transfer', 'long-wait'],
  },
  {
    label: 'minimum connection time / prolonged congestion',
    ledger: {
      waiting: 15, capacity: 12, waitingByRegion: { EUS: 3, AFR: 3, ME: 3, EUN: 3, SAM: 3 },
      transferNotReady: 20, congestedSeconds: 45,
    },
    expected: ['transfer-not-ready', 'capacity', 'congestion-duration'],
  },
];

for (const scenario of scenarios) {
  try {
    const a = buildCauseReport(scenario.ledger);
    const b = buildCauseReport(scenario.ledger);
    assert.deepEqual(a, b, 'diagnostics must be reproducible');
    assert.equal(a.length, 3, 'exactly three report lines');
    const kinds = a.map(({ kind }) => kind);
    assert.equal(new Set(kinds).size, 3, 'all three lines are distinct');
    assert.deepEqual([...kinds].sort(), [...scenario.expected].sort());
    if (scenario.label.startsWith('continental')) {
      const regional = a.find((fact) => fact.kind === 'regional-demand');
      assert.equal(regional.params.percent, 62);
      assert.equal(regional.region, 'NAM');
    }
    console.log('PASS ' + scenario.label);
    passed++;
  } catch (error) {
    console.error('FAIL ' + scenario.label, error);
    failed++;
  }
}

try {
  const damaged = buildCauseReport({
    waiting: 8, capacity: 8, waitingByRegion: { NAM: 100 },
    seatsUnavailable: Number.NaN, noRoute: -1,
  });
  assert.equal(damaged.find((fact) => fact.kind === 'regional-demand')?.params.percent, 100);
  assert.equal(damaged.length, 3);
  assert.ok(damaged.some((fact) => fact.kind === 'unavailable'));
  console.log('PASS missing/corrupt evidence');
  passed++;
} catch (error) {
  console.error('FAIL missing/corrupt evidence', error);
  failed++;
}

try {
  const identity = { seed: 0xa1a1, initialHash: 'initial-world-0xa1a1' };
  assert.deepEqual(sameWorldIdentity(identity), identity);
  assert.notEqual(nextWorldSeed(identity.seed, identity.seed), identity.seed);
  assert.equal(nextWorldSeed(identity.seed, 0xb2b2), 0xb2b2);
  console.log('PASS same-world restart identity and distinct new seed');
  passed++;
} catch (error) {
  console.error('FAIL world identity', error);
  failed++;
}

try {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  // [night-11b] Zero delivered is never a record, not even on an empty profile.
  assert.equal(persistBestRecord(storage, { score: 0, weeks: 1, seed: 25 }).isNewRecord, false);
  assert.equal(readBestRecord(storage), null);
  const old = { score: 140, weeks: 2, seed: 25 };
  assert.equal(persistBestRecord(storage, old).isNewRecord, true);
  assert.deepEqual(readBestRecord(storage), old);
  assert.equal(persistBestRecord(storage, { score: 60, weeks: 8, seed: 9 }).isNewRecord, false);
  assert.deepEqual(readBestRecord(storage), old);
  const improved = { score: 200, weeks: 3, seed: 25 };
  assert.equal(persistBestRecord(storage, improved).isNewRecord, true);
  assert.deepEqual(readBestRecord(storage), improved);
  values.set('airway.gameover.best.v1', '{');
  assert.equal(readBestRecord(storage), null);
  assert.equal(persistBestRecord({ getItem: () => null, setItem: () => { throw new Error('disabled'); } }, old).isNewRecord, false);
  console.log('PASS local high score and blocked/corrupt storage');
  passed++;
} catch (error) {
  console.error('FAIL local high score', error);
  failed++;
}

console.log('SUMMARY test:causes seed=' + SEED + ' scenarios=' + scenarios.length
  + ' passed=' + passed + ' failed=' + failed);
if (failed) process.exitCode = 1;
