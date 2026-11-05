#!/usr/bin/env node
// [night-12ay] R3i (D-245): prints (never runs) the Firebase Test Lab game-loop command for the perf scenario on
// budget Android phones. The owner runs it in their own Firebase project (Q-07); docs/ANDROID.md "Test Lab".
//   npm run perf:testlab                                   -> model-list command + run template with placeholders
//   npm run perf:testlab -- --models a10:30,redmi:31 [--apk path] [--results-dir name]
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_APK = 'android/app/build/outputs/apk/release/app-release.apk';
/** Five budget GPU classes (R3f table, D-133 minSdk 29): pick one physical Test Lab model per class. */
export const DEVICE_CLASSES = [
  'Mali-G52 MC2 (Helio G85/G88 class: Redmi, Galaxy A1x)',
  'Mali-G57 MC2 (Dimensity 6xxx/Exynos 850 class)',
  'PowerVR GE8320 (Helio P35/G35 class)',
  'Adreno 610/613 (Snapdragon 662/680 class: Moto G, Galaxy A)',
  'Mali-G68 MC4 or a 2021 mid-range Pixel (reference)',
];

function parse(argv) {
  const options = { models: [], apk: DEFAULT_APK, resultsDir: 'airway-perf-' + new Date().toISOString().slice(0, 10) };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[++i];
    if (!value) throw new Error('Missing value for ' + flag);
    if (flag === '--models') options.models = value.split(',').map((item) => item.trim()).filter(Boolean);
    else if (flag === '--apk') options.apk = value;
    else if (flag === '--results-dir') options.resultsDir = value;
    else throw new Error('Unknown option: ' + flag);
  }
  for (const model of options.models) {
    if (!/^[A-Za-z0-9_.-]+:\d{2}$/.test(model)) throw new Error('Model must be MODEL_ID:API_LEVEL, got ' + model);
    if (Number(model.split(':')[1]) < 29) throw new Error('API level below minSdk 29 (D-133): ' + model);
  }
  return options;
}

/** The manifest's scenario count (`com.google.test.loops`), so the command never asks for a missing scenario. */
function scenarioCount() {
  const manifest = readFileSync(resolve(ROOT, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  return Number(manifest.match(/android:name="com\.google\.test\.loops"\s+android:value="(\d+)"/)?.[1] ?? 0);
}

export function testLabCommand({ apk, models, resultsDir, scenarios = 1 }) {
  const devices = (models.length ? models : DEVICE_CLASSES.map((_, i) => 'MODEL_ID_' + (i + 1) + ':API'))
    .map((model) => {
      const [id, version] = model.split(':');
      return '  --device model=' + id + ',version=' + version + ',locale=en,orientation=portrait \\';
    });
  return [
    'gcloud firebase test android run \\',
    '  --type=game-loop \\',
    '  --app=' + apk + ' \\',
    '  --scenario-numbers=' + Array.from({ length: scenarios }, (_, i) => i + 1).join(',') + ' \\',
    ...devices,
    '  --timeout=6m \\',
    '  --results-dir=' + resultsDir,
  ].join('\n');
}

try {
  const options = parse(process.argv.slice(2));
  const scenarios = scenarioCount();
  if (scenarios < 1) throw new Error('AndroidManifest.xml declares no com.google.test.loops scenarios');
  console.log('# 1. Physical models in your project (pick one per class below, API level >= 29):');
  console.log('gcloud firebase test android models list --filter="form=PHYSICAL"');
  console.log('#    Classes: ' + DEVICE_CLASSES.join('; '));
  if (!existsSync(resolve(ROOT, options.apk))) console.log('# APK not built yet: npm run android:release (docs/ANDROID.md).');
  console.log('# 2. Game-loop run (Spark plan: 5 physical device runs per day are free):');
  console.log(testLabCommand({ ...options, scenarios }));
  console.log('# 3. Each device folder in the results bucket has game_loop_results/ with the JSON report;');
  console.log('#    copy frames p50/p95, preset and adaptations into docs/PERFORMANCE.md "Test Lab game loop".');
  console.log('SUMMARY perf:testlab models=' + options.models.length + ' scenarios=' + scenarios + ' failed=0');
} catch (error) {
  console.error('perf:testlab: ' + (error instanceof Error ? error.message : String(error)));
  console.log('SUMMARY perf:testlab failed=1');
  process.exitCode = 1;
}
