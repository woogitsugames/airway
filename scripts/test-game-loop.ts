// [night-12ay] R3i (D-245): Firebase Test Lab game loop. SDK-free: the manifest intent filter and scenario
// meta-data, the native bridge (static), scenario selection, the JS launch port, frame statistics, the report and
// the perf:testlab command. Fixed inputs, no clock, no browser.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FrameRecorder, GAME_LOOP_ACTION, GAME_LOOP_BUDGETS_MS, GAME_LOOP_SCENARIOS, gameLoopReport, gameLoopScenario,
} from '../src/game/gameLoop.ts';
import { GAME_LOOP_PLUGIN, readGameLoop, type GameLoopPluginPort } from '../src/platform/gameLoop.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');
const JAVA = 'android/app/src/main/java/pl/samsufi/airway/';
let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const manifest = read('android/app/src/main/AndroidManifest.xml').replace(/<!--[\s\S]*?-->/g, '');
const activity = manifest.match(/<activity\b[\s\S]*?<\/activity>/)?.[0] ?? '';

await test('manifest: MainActivity takes the TEST_LOOP intent (DEFAULT, application/javascript)', () => {
  assert.match(activity, /android:name="\.MainActivity"/);
  const filters = activity.match(/<intent-filter>[\s\S]*?<\/intent-filter>/g) ?? [];
  const loop = filters.find((filter) => filter.includes(`<action android:name="${GAME_LOOP_ACTION}"`));
  assert.ok(loop, 'no intent-filter with ' + GAME_LOOP_ACTION);
  assert.match(loop!, /<category android:name="android\.intent\.category\.DEFAULT"\s*\/>/);
  assert.match(loop!, /<data android:mimeType="application\/javascript"\s*\/>/);
  assert.ok(filters.some((filter) => filter.includes('android.intent.category.LAUNCHER')), 'launcher filter kept');
});

await test('manifest: scenario count and labels = GAME_LOOP_SCENARIOS', () => {
  const meta = Object.fromEntries([...manifest.matchAll(/<meta-data android:name="(com\.google\.test\.loops[^"]*)"\s+android:value="([^"]+)"/g)]
    .map((match) => [match[1], match[2]]));
  assert.equal(Number(meta['com.google.test.loops']), GAME_LOOP_SCENARIOS.length);
  GAME_LOOP_SCENARIOS.forEach((scenario, index) => {
    assert.equal(scenario.number, index + 1, 'scenario numbers are 1..n');
    assert.ok((meta['com.google.test.loops.' + scenario.label] ?? '').split(',').includes(String(scenario.number)),
      'label ' + scenario.label);
  });
});

await test('native bridge: plugin registered before the bridge, reads the scenario, writes the result URI, finishes', () => {
  const main = read(JAVA + 'MainActivity.java');
  const plugin = read(JAVA + 'GameLoopPlugin.java');
  const register = main.indexOf('registerPlugin(GameLoopPlugin.class)');
  assert.ok(register > 0 && register < main.indexOf('super.onCreate('), 'registerPlugin before super.onCreate');
  assert.ok(plugin.includes(`@CapacitorPlugin(name = "${GAME_LOOP_PLUGIN}")`), 'plugin name');
  assert.ok(plugin.includes(`"${GAME_LOOP_ACTION}"`), 'action string');
  assert.match(plugin, /getIntExtra\("scenario", 1\)/);
  assert.match(plugin, /openAssetFileDescriptor\(result, "w"\)/);
  assert.match(plugin, /getIntent\(\)\.getData\(\)/);
  assert.match(plugin, /getActivity\(\)\.finish\(\)/);
  assert.match(plugin, /postDelayed\(\(\) -> writeAndFinish\(TIMEOUT_REPORT\), WATCHDOG_MS\)/, 'watchdog');
  assert.match(plugin, /if \(!isGameLoop\(getActivity\(\)\.getIntent\(\)\)\) \{\s*call\.reject/, 'finish only in a game loop');
  const watchdog = Number(plugin.match(/WATCHDOG_MS = ([\d_]+)L/)?.[1].replaceAll('_', '') ?? 0);
  assert.ok(watchdog > Math.max(...GAME_LOOP_SCENARIOS.map((s) => s.durationMs)) + 60_000, 'watchdog after the longest scenario');
});

await test('scenario selection: 1 is the 120 s autoplay perf run, unknown numbers are null', () => {
  const perf = gameLoopScenario(1);
  assert.deepEqual(perf && { id: perf.id, seed: perf.seed, durationMs: perf.durationMs, speed: perf.speed, decisionTicks: perf.decisionTicks },
    { id: 'autoplay-endless', seed: 0xA1A1, durationMs: 120_000, speed: 4, decisionTicks: 30 });
  for (const number of [0, 2, -1, Number.NaN]) assert.equal(gameLoopScenario(number), null);
});

function port(launch: () => Promise<{ active: boolean; scenario?: number }>, finish?: () => Promise<void>) {
  const reports: string[] = [];
  const value: GameLoopPluginPort = {
    launch,
    finish: async ({ report }) => { reports.push(report); if (finish) await finish(); },
  };
  return { value, reports };
}

await test('launch port: only an active launch starts a game loop; never throws', async () => {
  assert.equal(await readGameLoop(null), null, 'web / iOS');
  assert.equal(await readGameLoop(port(async () => ({ active: false })).value), null, 'normal launch');
  assert.equal(await readGameLoop(port(async () => { throw new Error('bridge'); }).value), null, 'plugin error');
  assert.equal((await readGameLoop(port(async () => ({ active: true, scenario: 1 })).value))?.launch.scenario, 1);
  assert.equal((await readGameLoop(port(async () => ({ active: true })).value))?.launch.scenario, 1, 'default 1');
  assert.equal((await readGameLoop(port(async () => ({ active: true, scenario: 7 })).value))?.launch.scenario, 7);
  const failing = port(async () => ({ active: true, scenario: 1 }), async () => { throw new Error('write'); });
  const bridge = await readGameLoop(failing.value);
  await bridge!.finish('{"x":1}');
  assert.deepEqual(failing.reports, ['{"x":1}']);
});

await test('frame recorder: p50/p95/max, mean fps, frames over 33 ms, pauses not ranked', () => {
  const recorder = new FrameRecorder();
  let at = 1000;
  recorder.push(at);
  for (let i = 0; i < 90; i++) recorder.push(at += 16);
  for (let i = 0; i < 10; i++) recorder.push(at += 50);
  recorder.push(at += 5000); // app in the background
  recorder.push(at += 16);
  const s = recorder.summarize();
  assert.equal(s.frames, 101);
  assert.equal(s.p50FrameIntervalMs, 16);
  assert.equal(s.p95FrameIntervalMs, 50);
  assert.equal(s.maxFrameIntervalMs, 50);
  assert.equal(s.framesOverLowEndBudget, 10);
  assert.equal(s.pauses, 1);
  assert.equal(s.meanDeliveredFps, Math.round(101 * 1000 / (91 * 16 + 500) * 100) / 100);
  assert.deepEqual(new FrameRecorder().summarize().p95FrameIntervalMs, null);
});

const device = {
  userAgent: 'Mozilla/5.0 (Linux; Android 13) Chrome/140', renderer: 'Mali-G52 MC2',
  viewport: { width: 360, height: 800, dpr: 2.5 }, graphics: 'auto', preset: 'low', adaptations: ['pixel-ratio'], appVersion: '0.1.0',
};
await test('report: perf:scene frame fields + device, preset path and run', () => {
  const recorder = new FrameRecorder();
  [0, 20, 40, 60].forEach((t) => recorder.push(t));
  const report = gameLoopReport({
    scenarioNumber: 1, scenario: gameLoopScenario(1), measuredMs: 120_004.4, frames: recorder.summarize(), device,
    run: { week: 3, passengers: 410, routes: 7, commands: 55, failed: false },
  });
  const json = JSON.parse(JSON.stringify(report));
  assert.equal(json.kind, 'game-loop');
  assert.equal(json.seed, 0xA1A1);
  assert.equal(json.durationRequestedMs, 120_000);
  assert.equal(json.durationMeasuredMs, 120_004);
  assert.deepEqual(json.budgetsMs, GAME_LOOP_BUDGETS_MS);
  assert.equal(json.summary.p95FrameIntervalMs, 20);
  assert.equal(json.browser.renderer, 'Mali-G52 MC2');
  assert.equal(json.preset, 'low');
  assert.deepEqual(json.adaptations, ['pixel-ratio']);
  assert.equal(json.run.routes, 7);
  assert.equal('error' in json, false);
  const unknown = gameLoopReport({ scenarioNumber: 9, scenario: null, measuredMs: 0, frames: new FrameRecorder().summarize(), device, run: null, error: 'unknown-scenario' });
  assert.equal(unknown.scenarioId, null);
  assert.equal(unknown.error, 'unknown-scenario');
});

await test('main.ts: the game loop runs in release builds (not DEV-gated), real session, bot chunk, report', () => {
  const main = read('src/main.ts');
  const line = main.split('\n').find((text) => text.includes('readGameLoop(nativeGameLoopPort())')) ?? '';
  assert.ok(line && !line.includes('import.meta.env.DEV'), 'launch read outside DEV');
  const body = main.slice(main.indexOf('async function runGameLoop'), main.indexOf('// Store screenshots'));
  assert.match(body, /const bot = await import\('\.\/game\/dev\/autoplay'\);/);
  assert.match(body, /startEndless\(scenario\.seed, null\)/);
  assert.match(body, /session\?\.setSpeed\(scenario\.speed\)/);
  assert.match(body, /run\.queue\(command\)/);
  assert.match(body, /await loop\.finish\(/);
  assert.ok(!body.includes('advance('), 'real time: no fast-forward');
});

await test('perf:testlab prints the game-loop command, never below minSdk 29', () => {
  const run = (args: string[]) => spawnSync(process.execPath, [resolve(ROOT, 'scripts/perf-testlab.mjs'), ...args], { encoding: 'utf8' });
  const ok = run(['--models', 'a10:30,oriole:33', '--apk', 'app.apk']);
  assert.equal(ok.status, 0, ok.stderr);
  for (const piece of ['--type=game-loop', '--app=app.apk', '--scenario-numbers=1', 'model=a10,version=30', 'model=oriole,version=33', 'models list'])
    assert.ok(ok.stdout.includes(piece), piece);
  const template = run([]);
  assert.equal(template.status, 0);
  assert.equal((template.stdout.match(/--device model=MODEL_ID_/g) ?? []).length, 5);
  assert.notEqual(run(['--models', 'old:28']).status, 0);
});

console.log(`SUMMARY test:game-loop seed=0xA1A1 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
