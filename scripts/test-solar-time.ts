// [night-11aw] R4b, D-27: Settings → Help says, in PL and EN, that airport clocks keep solar time (one hour per 15°
// of longitude), not official time zones or summer time. The sentence must stay true: every city's clock offset is
// round(longitude / 15) clamped to ±12, so a switch to real time zones fails here before the help text lies.
// Fails on the code before R4b: no `settings.solarTime` key and no line in the help group.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { en } from '../src/i18n/en.ts';
import { pl } from '../src/i18n/pl.ts';
import { CITY_RECORDS } from '../src/data/index.ts';

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const catalogs = { en, pl } as Record<'en' | 'pl', Record<string, string>>;

test('en: one sentence on solar time, 15° per hour, not time zones or summer time', () => {
  const text = catalogs.en['settings.solarTime'] ?? '';
  assert.match(text, /solar time/);
  assert.match(text, /15°/);
  assert.match(text, /not official time zones/);
  assert.match(text, /summer time/);
  assert.equal(text.split(/[.!?](?:\s|$)/).filter((part) => part.trim()).length, 1, 'one sentence');
});
test('pl: the same sentence (czas słoneczny, 15°, nie strefy czasowe ani czas letni)', () => {
  const text = catalogs.pl['settings.solarTime'] ?? '';
  assert.match(text, /czas słoneczny/);
  assert.match(text, /15°/);
  assert.match(text, /nie urzędowe strefy czasowe/);
  assert.match(text, /czas letni/);
  assert.equal(text.split(/[.!?](?:\s|$)/).filter((part) => part.trim()).length, 1, 'one sentence');
});
test('the sentence is true: every city clock is round(lon / 15) h, within ±12', () => {
  const wrong = CITY_RECORDS.filter((city) => city.utcOffsetH !== Math.max(-12, Math.min(12, Math.round(city.lon / 15))))
    .map((city) => `${city.code} ${city.utcOffsetH}`);
  assert.deepEqual(wrong, []);
  assert.ok(CITY_RECORDS.length > 0);
});
test('settings.ts: hint line with testid in Settings → Help, styled by the shared hint class', () => {
  const source = read('src/ui/settings/settings.ts');
  const help = source.indexOf("group(t('settings.group.help')");
  const line = source.indexOf("e('p','airway-setting__hint',t('settings.solarTime'))");
  const keys = source.indexOf('host.append(shortcutList())');
  assert.ok(help > 0 && line > help, 'the line is appended after the help group starts');
  assert.ok(keys > line, 'the line sits before the keyboard list (which touch screens hide)');
  assert.match(source, /dataset\.testid='settings-solar-time'/);
});

console.log(`SUMMARY test:solar-time seed=0 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
