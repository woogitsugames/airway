// [night-05] D-68 airport label setting: code by default, localized city name on request, applied to the
// hub/slot stamps that the run hands to the weekly upgrade card.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: (key) => { store.delete(key); },
};
const { airportLabel, readAirportLabelMode } = await import('../src/ui/airportLabel.ts');
const { setLanguage } = await import('../src/i18n/index.ts');
const { EndlessRun } = await import('../src/game/run.ts');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}
function setMode(mode) {
  const previous = JSON.parse(store.get('airway.settings') ?? '{}');
  store.set('airway.settings', JSON.stringify({ ...previous, airportLabels: mode }));
}

check('default is the airport code', () => {
  assert.equal(readAirportLabelMode(), 'code');
  assert.equal(airportLabel('WAW'), 'WAW');
});
check('name mode follows the language', () => {
  setMode('name');
  setLanguage('pl');
  assert.equal(airportLabel('WAW'), 'Warszawa');
  assert.equal(airportLabel('NYC'), 'Nowy Jork');
  setLanguage('en');
  assert.equal(airportLabel('WAW'), 'Warsaw');
  assert.equal(airportLabel('NYC'), 'New York');
});
// [night-12h] R4a: the screen shows the code travellers know; the sim id stays (KIV is still the Kyiv id).
check('code mode shows the display code, name mode the city', () => {
  setMode('code');
  assert.equal(airportLabel('KIV'), 'IEV');
  assert.equal(airportLabel('HCM'), 'SGN');
  assert.equal(airportLabel('ALX'), 'ALY');
  assert.equal(airportLabel('WAW'), 'WAW');
  setMode('name');
  setLanguage('en');
  assert.equal(airportLabel('KIV'), 'Kyiv');
});
check('unknown codes and corrupt storage fall back to the code', () => {
  assert.equal(airportLabel('ZZZ'), 'ZZZ');
  store.set('airway.settings', '{not json');
  assert.equal(readAirportLabelMode(), 'code');
  store.set('airway.settings', JSON.stringify({ airportLabels: 'banana' }));
  assert.equal(readAirportLabelMode(), 'code');
});
check('the run labels hub and slot pressure with the chosen mode', () => {
  const target = EndlessRun.create(0xA1A1);
  setMode('code');
  const codes = target.slotPressure().map((entry) => entry.label);
  assert.ok(codes.length > 0 && codes.every((label) => /^[A-Z]{3}$/.test(label)), codes.join(','));
  setMode('name');
  setLanguage('en');
  const names = target.slotPressure();
  for (const entry of names) assert.equal(entry.label, airportLabel(entry.cityId, 'name'));
  assert.ok(names.some((entry) => entry.label !== entry.cityId), 'names expected');
});
console.log(`SUMMARY test:airport-labels seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
