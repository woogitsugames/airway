// [task-37] D-61 player-facing number format: PL groups thousands from four digits, EN unchanged.
import assert from 'node:assert/strict';
import { formatNumber } from '../src/core/format.ts';
import { localNumber, setLanguage, t } from '../src/i18n/index.ts';

const SEED = '0xA1A1';
let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}
const NBSP = ' ';
const intlGroup = new Intl.NumberFormat('pl-PL').format(11000).replace(/\d/g, '');

test('PL keeps three digits as they are', () => assert.equal(formatNumber(999, 'pl'), '999'));
test('PL groups four digits ("2 500")', () => assert.equal(formatNumber(2500, 'pl'), `2${NBSP}500`));
test('PL five digits match Intl ("11 000")', () => assert.equal(formatNumber(11000, 'pl'), `11${NBSP}000`));
test('PL seven digits', () => assert.equal(formatNumber(1234567, 'pl'), `1${NBSP}234${NBSP}567`));
test('PL four- and five-digit groups use the same separator as Intl', () => {
  assert.equal(intlGroup, NBSP);
  assert.equal(formatNumber(2500, 'pl').replace(/\d/g, ''), intlGroup);
});
test('PL negative and fractional four digits', () => {
  assert.equal(formatNumber(-2500, 'pl'), `-2${NBSP}500`);
  assert.equal(formatNumber(2500.5, 'pl', 1), `2${NBSP}500,5`);
});
test('EN unchanged', () => {
  assert.equal(formatNumber(999, 'en'), '999');
  assert.equal(formatNumber(2500, 'en'), '2,500');
  assert.equal(formatNumber(11000, 'en'), '11,000');
  assert.equal(formatNumber(1234567, 'en'), '1,234,567');
});
test('t() formats numeric parameters, strings stay verbatim', () => {
  setLanguage('pl');
  assert.equal(t('upgrade.value.km', { km: 2500 }), `2${NBSP}500 km`);
  assert.equal(t('upgrade.value.km', { km: '2500' }), '2500 km');
  assert.equal(localNumber(1284), `1${NBSP}284`);
  setLanguage('en');
  assert.equal(t('upgrade.value.km', { km: 2500 }), '2,500 km');
  assert.equal(localNumber(1284), '1,284');
});

console.log(`SUMMARY test:format seed=${SEED} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
