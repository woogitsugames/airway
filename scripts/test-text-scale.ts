// [night-11ap] R1g: text scale follows the system on first launch and goes to 150 %. The system factor maps to the
// nearest step (Android font scale, iOS Dynamic Type body / 17 px, browser `medium` / 16 px); the preset runs only
// while no text size is stored, so an explicit choice in Settings always wins; a failed read stores nothing; the
// 150 % step is stored, offered in Settings and scales the reading text through the theme tokens (titles at 40 %
// of the step, dense tables capped at 130 %); Android registers the plugin before the bridge starts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const read = (path: string): string => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, String(value)); },
  removeItem: (key: string) => { store.delete(key); },
};
const KEY = 'airway.settings';
const root = () => ({ dataset: {} as Record<string, string>, style: { props: new Map<string, string>(),
  setProperty(name: string, value: string) { this.props.set(name, value); } } });

const a11y = await import('../src/ui/a11y.ts');
const platform = await import('../src/platform/textScale.ts');
function fresh(initial?: Record<string, unknown>): void {
  store.clear();
  if (initial) store.set(KEY, JSON.stringify(initial));
  a11y.resetAccessibilityCache();
}
const saved = (): Record<string, unknown> => JSON.parse(store.get(KEY) ?? '{}') as Record<string, unknown>;

await test('steps: 100/115/130/150; 150 is valid when stored, anything else reads as 100', () => {
  assert.deepEqual([...a11y.TEXT_SCALES], [100, 115, 130, 150]);
  fresh({ textScale: 150 });
  assert.equal(a11y.readAccessibilitySettings().textScale, 150);
  for (const bad of [140, '150', 200, null]) {
    fresh({ textScale: bad });
    assert.equal(a11y.readAccessibilitySettings().textScale, 100, String(bad));
  }
});

await test('system factor -> nearest step (Android font scales, iOS Dynamic Type sizes)', () => {
  const cases: [number | null, number][] = [[null, 100], [Number.NaN, 100], [0.85, 100], [1, 100], [1.05, 100],
    [1.1, 115], [1.15, 115], [19 / 17, 115], [21 / 17, 130], [1.3, 130], [23 / 17, 130], [1.5, 150], [1.8, 150],
    [2, 150], [53 / 17, 150]];
  for (const [factor, step] of cases) assert.equal(a11y.textScaleForSystem(factor), step, `factor ${factor}`);
  assert.equal(platform.factorFromProbe(17, 17), 1);
  assert.equal(platform.factorFromProbe(23, 17), 1.35);
  assert.equal(platform.factorFromProbe(20, 16), 1.25);
  assert.equal(platform.factorFromProbe(null, 16), null);
  assert.equal(platform.factorFromProbe(500, 16), null, 'implausible probe ignored');
});

await test('first launch: the system size becomes the stored step and marks the root', async () => {
  fresh({ language: 'pl', sound: false });
  const el = root();
  const step = await a11y.presetTextScaleFromSystem(async () => 1.5, el as unknown as HTMLElement);
  assert.equal(step, 150);
  assert.deepEqual({ language: saved().language, sound: saved().sound, textScale: saved().textScale },
    { language: 'pl', sound: false, textScale: 150 }, 'other settings kept');
  assert.equal(el.dataset.airwayTextScale, '150');
  assert.equal(el.style.props.get('--airway-text-scale'), '1.5');
});

await test('an explicit choice wins: a stored size (even 100) is never overwritten by the system', async () => {
  for (const choice of [100, 115, 130]) {
    fresh({ textScale: choice });
    let asked = false;
    assert.equal(await a11y.presetTextScaleFromSystem(async () => { asked = true; return 1.5; }), null);
    assert.equal(asked, false, 'the system is not even asked');
    assert.equal(saved().textScale, choice);
  }
  fresh();
  a11y.updateAccessibilitySettings({ textScale: 115 });
  assert.equal(await a11y.presetTextScaleFromSystem(async () => 2), null, 'a choice made in this session');
  assert.equal(saved().textScale, 115);
  fresh();
  const pending = a11y.presetTextScaleFromSystem(async () => { a11y.updateAccessibilitySettings({ textScale: 100 }); return 2; });
  assert.equal(await pending, null, 'a choice made while the system was being read');
  assert.equal(saved().textScale, 100);
});

await test('a failed or empty read stores nothing (the next launch asks again)', async () => {
  for (const reader of [async () => null, async () => { throw new Error('no plugin'); }]) {
    fresh();
    assert.equal(await a11y.presetTextScaleFromSystem(reader), null);
    assert.equal(store.has(KEY), false);
  }
  fresh();
  assert.equal(await platform.systemTextScale(), null, 'Node: no DOM, no native platform');
});

await test('wiring: settings offer every step, main presets once, Android registers the plugin first', () => {
  const settings = read('src/ui/settings/settings.ts');
  assert.match(settings, /selectField\(t\('a11y\.textScale'\),String\(values\.textScale\),TEXT_SCALES\.map/);
  assert.match(read('src/main.ts'), /initializeAccessibility\(\);\nvoid presetTextScaleFromSystem\(systemTextScale\);/);
  const activity = read('android/app/src/main/java/pl/samsufi/airway/MainActivity.java');
  const at = activity.indexOf('registerPlugin(TextScalePlugin.class)');
  assert.ok(at > 0 && at < activity.indexOf('super.onCreate('), 'registerPlugin before super.onCreate');
  const plugin = read('android/app/src/main/java/pl/samsufi/airway/TextScalePlugin.java');
  assert.match(plugin, /@CapacitorPlugin\(name = "AirwayTextScale"\)/);
  assert.match(plugin, /getConfiguration\(\)\.fontScale/);
  assert.match(read('src/platform/textScale.ts'), /export const TEXT_SCALE_PLUGIN = 'AirwayTextScale';/);
});

await test('stylesheets: reading text scales through the tokens; titles and dense tables are bounded', () => {
  const theme = read('src/ui/theme/theme.css');
  assert.match(theme, /--airway-text-scale-title: calc\(1 \+ \(var\(--airway-text-scale\) - 1\) \* \.4\);/);
  assert.match(theme, /--airway-text-scale-dense: min\(var\(--airway-text-scale\), 1\.3\);/);
  const scaled = (path: string) => (read(path).match(/var\(--airway-text-scale(?:-title|-dense)?\)/g) ?? []).length;
  for (const [path, min] of [['src/ui/menu/menu.css', 15], ['src/ui/logbook/logbook.css', 8], ['src/ui/gameover/gameover.css', 15],
    ['src/ui/puzzles/board.css', 15], ['src/ui/upgrade/upgrade.css', 10], ['src/ui/tutorial/tutorial.css', 8],
    ['src/ui/leaderboard/leaderboard.css', 3]] as const) {
    assert.ok(scaled(path) >= min, `${path}: ${scaled(path)} scaled sizes, expected >= ${min}`);
  }
  assert.doesNotMatch(read('src/ui/menu/menu.css'), /\.flap-tile \{[^}]*--airway-text-scale/, 'split-flap cells keep their size');
  assert.match(read('src/ui/menu/menu.css'), /:root\[data-airway-text-scale="150"\] \.airway-setting \{ grid-template-columns:minmax\(0,1fr\)/);
});

console.log(`SUMMARY test:text-scale seed=0 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
