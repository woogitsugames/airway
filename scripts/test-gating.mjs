// Fixed-seed smoke test for the deliberately disabled monetization boundary.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = '0xA1A1';
const failures = [];
let passed = 0;

async function check(label, fn) {
  try {
    await fn();
    passed++;
  } catch (error) {
    failures.push(label);
    console.error(`FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function source(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

async function load(path) {
  const output = ts.transpileModule(source(path), {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      isolatedModules: true,
    },
  });
  const errors = (output.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert.equal(errors.length, 0, `transpile diagnostics: ${path}`);
  const url = `data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`;
  return import(url);
}

let store;
let ads;
let gating;
await check('ES2022 adapter modules transpile', async () => {
  [store, ads, gating] = await Promise.all([
    load('src/platform/store.ts'),
    load('src/platform/ads.ts'),
    load('src/game/gating.ts'),
  ]);
});

await check('free entitlements unlock arbitrary and future content', () => {
  assert.equal(Object.isFrozen(store.freeEntitlements), true);
  for (const id of ['', 'endless', 'daily', 'puzzle:01', 'future-dlc', '__proto__']) {
    assert.equal(store.freeEntitlements.isUnlocked(id), true);
  }
});

await check('purchase is an inert already-unlocked result', async () => {
  assert.equal(await store.freeEntitlements.purchase('full-game'), 'already-unlocked');
  assert.equal(await store.freeEntitlements.purchase('any-content'), 'already-unlocked');
});

await check('restore is inert and does not simulate a purchase', async () => {
  assert.equal(await store.freeEntitlements.restore(), 'not-required');
});

await check('advertising stays disabled', async () => {
  assert.equal(Object.isFrozen(ads.disabledAds), true);
  assert.equal(ads.disabledAds.isEnabled(), false);
  assert.equal(await ads.disabledAds.showRewarded?.(), false);
  assert.equal(await ads.disabledAds.showInterstitialBetweenRuns?.(), false);
});

await check('gate is hard-disabled and does not inspect locked entitlements', () => {
  assert.equal(gating.GATING_ENABLED, false);
  const deny = { isUnlocked: () => { throw new Error('Store accessed while gating disabled'); } };
  const restrictive = { requiredEntitlements: Object.freeze({
    endless: 'full-game', 'puzzle:01': 'all-puzzles', daily: 'premium-daily',
  }) };
  for (const id of ['endless', 'puzzle:01', 'daily', 'other', 'constructor', '__proto__']) {
    assert.equal(gating.canAccessContent(id, deny, restrictive), true);
    assert.equal(gating.canAccessContent(id, deny), true);
  }
  assert.equal(Object.keys(gating.DEFAULT_GATING_CONFIG.requiredEntitlements).length, 0);
});

await check('adapters contain no native SDK imports or dynamic imports', () => {
  for (const path of ['src/platform/store.ts', 'src/platform/ads.ts', 'src/game/gating.ts']) {
    const sf = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true);
    assert.equal(sf.parseDiagnostics.length, 0, `invalid TS: ${path}`);
    function visit(node) {
      if (ts.isImportDeclaration(node)) {
        assert.equal(node.importClause?.isTypeOnly, true, `runtime import in ${path}`);
        assert.ok(node.moduleSpecifier.text.startsWith('.'), `external import in ${path}`);
      }
      if (ts.isCallExpression(node)) {
        assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword, `dynamic import in ${path}`);
        assert.notEqual(ts.isIdentifier(node.expression) && node.expression.text, 'require', `require in ${path}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
});

await check('package has no advertising, IAP, or tracking SDK dependencies', () => {
  const pkg = JSON.parse(source('package.json'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const monetizationSdk = /(?:admob|adsense|applovin|ad-service|in-app-purchase|native-purchases|purchases-capacitor|cordova-plugin-purchase|revenuecat|iap|billing|firebase|analytics|tracking)/i;
  const unexpected = Object.keys(allDeps).filter((name) => monetizationSdk.test(name));
  assert.deepEqual(unexpected, []);
  assert.equal(pkg.scripts['test:gating'], 'node scripts/test-gating.mjs');
  // [integration-tooling] test:fast is a run-suite step list, not an `npm run` chain.
  assert.ok(pkg.scripts['test:fast'].split(/\s+/).includes('test:gating'));
});

console.log(`SUMMARY test:gating seed=${SEED} passed=${passed} failed=${failures.length}`);
if (failures.length) process.exitCode = 1;
