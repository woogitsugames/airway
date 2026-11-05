// [night-11al] R7c, D-241: one publisher block for the site, the game and the store consoles. The game's Settings →
// Help shows the `publisher.*` strings of site/i18n.js word for word, in the rows of site/publisher.js; the store
// README lists the same values; every release path refuses "[Q-01 …]" placeholders.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';
import { translations } from '../site/i18n.js';
import { PLACEHOLDER, PUBLISHER_FIELDS, PUBLISHER_KEYS, assertPublisherReady, publisherGaps } from '../site/publisher.js';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const site = translations as Record<'en' | 'pl', Record<string, string>>;
const games: Record<'en' | 'pl', Record<string, string>> = { en, pl };

test('site catalog: every publisher key in PL and EN', () => {
  for (const language of ['pl', 'en'] as const) {
    const missing = PUBLISHER_KEYS.filter((key) => !(site[language][key] ?? '').trim());
    assert.deepEqual(missing, [], language);
  }
});
for (const language of ['en', 'pl'] as const) {
  test(`${language}: the game shows the site's publisher strings word for word`, () => {
    const different = PUBLISHER_KEYS.filter((key) => games[language][key] !== site[language][key]);
    assert.deepEqual(different, [], `src/i18n/${language}.ts differs from site/i18n.js`);
  });
}
test('settings.ts: PUBLISHER_ROWS = PUBLISHER_FIELDS, block appended in Settings → Help', () => {
  const source = read('src/ui/settings/settings.ts');
  const rows = source.match(/PUBLISHER_ROWS=\[([^\]]+)\]/)?.[1]?.replace(/['\s]/g, '').split(',');
  assert.deepEqual(rows, PUBLISHER_FIELDS);
  const help = source.indexOf("group(t('settings.group.help')");
  const call = source.indexOf('host.append(publisherBlock())');
  assert.ok(help > 0 && call > help, 'publisherBlock() is appended after the help group starts');
});
test('docs/store/README.md: trader table = site strings', () => {
  const table = read('docs/store/README.md').match(/<!-- publisher:table -->([\s\S]*?)<!-- \/publisher:table -->/)?.[1] ?? '';
  const rows = table.trim().split('\n').slice(2).map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  assert.deepEqual(rows, PUBLISHER_FIELDS.map((field) => [field, site.pl[`publisher.${field}`], site.en[`publisher.${field}`]]));
});
test('trader status follows D-134 (trader in both stores)', () => {
  assert.match(site.pl['publisher.trader'] ?? '', /przedsiębiorc/i);
  assert.match(site.en['publisher.trader'] ?? '', /trader/i);
  assert.doesNotMatch(site.en['publisher.trader'] ?? '', /non-trader/i);
});
test('placeholders: only "[Q-…]" brackets, and the guard names each one', () => {
  const gaps = publisherGaps(site);
  for (const language of ['pl', 'en'] as const) for (const key of PUBLISHER_KEYS) {
    const value = site[language][key] ?? '';
    if (value.includes('[')) assert.ok(PLACEHOLDER.test(value) && gaps.includes(`${language}:${key}`), `${language}:${key}`);
  }
});
test('guard: refuses a placeholder, accepts filled details', () => {
  const filled = Object.fromEntries((['pl', 'en'] as const).map((language) => [language,
    Object.fromEntries(PUBLISHER_KEYS.map((key) => [key, `${key} value`]))]));
  assert.deepEqual(publisherGaps(filled), []);
  assert.doesNotThrow(() => assertPublisherReady(filled, 'test'));
  filled.en!['publisher.phone'] = '[Q-01: business phone]';
  assert.deepEqual(publisherGaps(filled), ['en:publisher.phone']);
  assert.throws(() => assertPublisherReady(filled, 'test'), /Q-01/);
});
test('release paths call the guard: build:site, Android release, AIRWAY_RELEASE=1 test:site', () => {
  assert.match(read('site/build.mjs'), /AIRWAY_RELEASE === '1'\) assertPublisherReady\(translations/);
  assert.match(read('scripts/build-android.mjs'), /startsWith\('--release-'\)\) assertPublisherReady\(siteTranslations/);
  assert.match(read('site/test.mjs'), /process\.env\.AIRWAY_RELEASE === '1'/);
});

console.log(`SUMMARY test:publisher seed=0 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
