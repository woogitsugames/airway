// [night-11e] The in-app privacy policy (settings → Privacy policy) shows the same text as the website's
// site/privacy.html: every `privacy.*` key that page uses exists in both game catalogs with the exact site wording,
// the sections are the page's sections in order, and the settings row has its label.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';
import { translations } from '../site/i18n.js';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const html = readFileSync(new URL('../site/privacy.html', import.meta.url), 'utf8');
// Website-only keys: navigation back to the landing page has no meaning inside the app.
const SITE_ONLY = new Set(['privacy.back']);
const pageKeys = [...html.matchAll(/data-i18n="(privacy\.[^"]+)"/g)].map((match) => match[1] as string)
  .filter((key, index, all) => !SITE_ONLY.has(key) && all.indexOf(key) === index);
const games: Record<'en' | 'pl', Record<string, string>> = { en, pl };
const site = translations as Record<'en' | 'pl', Record<string, string>>;

test('privacy.html uses the expected keys', () => {
  assert.ok(pageKeys.includes('privacy.title') && pageKeys.includes('privacy.date'), pageKeys.join(','));
  assert.ok(pageKeys.length >= 13, `${pageKeys.length} keys`);
});
for (const language of ['en', 'pl'] as const) {
  test(`${language}: every site privacy text is in the game catalog, word for word`, () => {
    const missing = pageKeys.filter((key) => !(key in games[language]));
    assert.deepEqual(missing, [], `missing in src/i18n/${language}.ts`);
    const different = pageKeys.filter((key) => games[language][key] !== site[language][key]);
    assert.deepEqual(different, [], `differs from site/i18n.js`);
  });
  test(`${language}: settings row label and offline note`, () => {
    assert.ok((games[language]['settings.privacy'] ?? '').trim().length > 0);
    assert.ok((games[language]['privacy.offline'] ?? '').trim().length > 0);
  });
}
test('sections: the page has s1…s5 in order, as PRIVACY_SECTIONS in settings.ts', () => {
  const sections = [...html.matchAll(/data-i18n="privacy\.s(\d+)\.title"/g)].map((match) => Number(match[1]));
  const source = readFileSync(new URL('../src/ui/settings/settings.ts', import.meta.url), 'utf8');
  const declared = source.match(/PRIVACY_SECTIONS=\[([\d,]+)\]/)?.[1]?.split(',').map(Number);
  assert.deepEqual(declared, sections);
});

console.log(`SUMMARY test:privacy-text seed=0 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
