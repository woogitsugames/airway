// [night-09c] D-80 airline colour setting: house teal by default, stored choice read back, unknown values
// ignored, every palette entry named in PL and EN, and the render hook painted on subscribe and on change.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: (key) => { store.delete(key); },
};
const colours = await import('../src/ui/airlineColour.ts');
const { pl } = await import('../src/i18n/pl.ts');
const { en } = await import('../src/i18n/en.ts');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error); }
}
check('default is the house teal', () => {
  assert.equal(colours.readAirlineColour(), 'teal');
  assert.equal(colours.airlineColourHex('teal').toLowerCase(), '#1e6f6a');
});
check('a stored choice is read back; unknown or malformed values fall back', () => {
  store.set('airway.settings', JSON.stringify({ airlineColour: 'ochre', sound: false }));
  assert.equal(colours.readAirlineColour(), 'ochre');
  store.set('airway.settings', JSON.stringify({ airlineColour: 'purple' }));
  assert.equal(colours.readAirlineColour(), 'teal');
  store.set('airway.settings', '{not json');
  assert.equal(colours.readAirlineColour(), 'teal');
  assert.ok(!colours.isAirlineColour('constructor') && !colours.isAirlineColour(7));
});
check('every colour has a PL and EN name', () => {
  assert.ok(colours.AIRLINE_COLOURS.length >= 4);
  for (const id of colours.AIRLINE_COLOURS) {
    assert.ok(pl[`settings.airline.${id}`] && en[`settings.airline.${id}`], id);
  }
  assert.ok(pl['settings.airline'] && en['settings.airline']);
});
check('the render hook paints on subscribe and on every change, until unsubscribed', () => {
  store.set('airway.settings', JSON.stringify({ airlineColour: 'sky' }));
  const seen = [];
  const stop = colours.onAirlineColour((hex, id) => seen.push([id, hex]));
  colours.applyAirlineColour('brick');
  stop();
  colours.applyAirlineColour('ink');
  assert.deepEqual(seen.map(([id]) => id), ['sky', 'brick']);
  assert.equal(seen[1][1], colours.airlineColourHex('brick'));
});
console.log(`SUMMARY test:airline-colour seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
