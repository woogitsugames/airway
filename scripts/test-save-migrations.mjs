import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeSave, loadSavedSimChecked, readGame } from '../src/game/save.ts';
import { GAME_SAVE_KEY } from '../src/platform/storage.ts';
const fixture = name => { const obj = JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')); return obj.save ?? JSON.stringify(obj); };
const cases = [
  ['save-envelope-v0-synthetic.json', 0, 'c82b0120', false, null],
  ['save-golden.json', 1, 'c82b0120', false, null],
  ['save-golden-v4.json', 1, null, null, 'old-rules'],
  ['save-golden-v5.json', 1, '3c77f6e6', true, null],
  ['save-envelope-v2.json', 2, 'c221978a', false, null],
  ['save-envelope-v3.json', 3, 'ffe7c805', false, null],
  ['save-envelope-v4.json', 4, '7bab00e9', false, null],
  ['eus-pre-v2-save.json', 5, '7fb3af0d', false, null],
  ['save-envelope-v6.json', 6, null, null, 'unsupported'],
  ['save-envelope-v7.json', 7, 'b0c16d9e', false, null],
];
let passed = 0, failed = 0;
async function check(name, fn) { try { await fn(); passed++; console.log(`PASS ${name}`); } catch(e) { failed++; console.error(`FAIL ${name}`, e); } }
for (const [name, version, hash, replayed, issue] of cases) await check(name, async () => {
  const text = fixture(name), raw = JSON.parse(text);
  assert.equal(raw.v, version);
  const decoded = decodeSave(text);
  if (version === 6) assert.deepEqual(decoded, {status:'error',issue:'unsupported'});
  else { assert.equal(decoded.status, 'ok'); assert.equal(decoded.save.v, version === 7 ? 7 : 5); assert.equal(decoded.migrated, version === 0); }
  const writes = [], store = { get: async key => { assert.equal(key,GAME_SAVE_KEY); return text; }, set: async (key,value) => writes.push([key,value]), remove: async () => { throw Error('must not delete'); } };
  const result = await loadSavedSimChecked(store);
  assert.equal(result.issue, issue);
  if (hash) { assert.equal(result.restored.sim.hash(), hash); assert.equal(result.restored.replayed, replayed); }
  else assert.equal(result.restored, null);
  assert.equal(writes.length, replayed === true ? 1 : 0);
});
await check('damaged and future envelopes report a notice and remain untouched', async () => {
  for (const [text, issue] of [['{"v":1,', 'corrupt'], ['{"v":8}', 'unsupported']]) {
    let writes = 0; const s = {get:async()=>text,set:async()=>{writes++;},remove:async()=>{writes++;}};
    assert.deepEqual(await loadSavedSimChecked(s), {restored:null,issue}); assert.equal(writes,0);
  }
});
await check('unavailable storage has a typed read error and is silent at the menu boundary', async () => {
  const s = {get:async()=>{throw Error('permission denied');},set:async()=>{throw Error('unexpected');},remove:async()=>{throw Error('unexpected');}};
  assert.deepEqual(await readGame(s), {status:'error',issue:'storage-unavailable'});
  assert.deepEqual(await loadSavedSimChecked(s), {restored:null,issue:null});
});
console.log(`SUMMARY test:save-migrations seed=0xA1A1 passed=${passed} failed=${failed}`);
if (failed) process.exitCode=1;
