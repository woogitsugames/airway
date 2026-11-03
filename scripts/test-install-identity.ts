// [night-12c] D-92: a backup restored onto another phone keeps the game but drops the leaderboard identity
// (src/platform/install.ts). Pure: in-memory marker and storage.
import assert from 'node:assert/strict';
import { forgetIdentityOnNewInstall, type InstallMarker } from '../src/platform/install.ts';
import { IDENTITY_KEYS } from '../src/net/index.ts';
import { LOGBOOK_KEY } from '../src/game/logbook.ts';

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) {
    failed++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
function memory(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return { removeItem: (key: string) => { data.delete(key); }, data };
}
function marker(present: boolean, options: { readFails?: boolean; writeFails?: boolean } = {}) {
  const state = { present, writes: 0 };
  const port: InstallMarker = {
    exists: async () => { if (options.readFails) throw new Error('read'); return state.present; },
    write: async () => { if (options.writeFails) throw new Error('write'); state.writes++; state.present = true; },
  };
  return { port, state };
}
const restored = () => memory({
  'aw-net-session-v1': '{"uid":"u1","refreshToken":"r"}',
  'aw-net-queue-v1': '[{"day":"2026-11-02"}]',
  [LOGBOOK_KEY]: '{"flights":3}',
  'aw-settings-v1': '{"language":"pl"}',
});

await test('identity keys are the session token and the offline queue', async () => {
  assert.deepEqual([...IDENTITY_KEYS].sort(), ['aw-net-queue-v1', 'aw-net-session-v1']);
});
await test('restored phone (no marker): identity and queue gone, logbook and settings kept, marker written', async () => {
  const storage = restored();
  const { port, state } = marker(false);
  assert.equal(await forgetIdentityOnNewInstall(port, storage, IDENTITY_KEYS), 'new-install');
  assert.deepEqual([...storage.data.keys()].sort(), [LOGBOOK_KEY, 'aw-settings-v1'].sort());
  assert.equal(state.writes, 1);
});
await test('same phone (marker present): nothing removed, nothing written', async () => {
  const storage = restored();
  const { port, state } = marker(true);
  assert.equal(await forgetIdentityOnNewInstall(port, storage, IDENTITY_KEYS), 'same-install');
  assert.equal(storage.data.size, 4);
  assert.equal(state.writes, 0);
});
await test('second launch after a restore keeps the new identity', async () => {
  const storage = restored();
  const { port } = marker(false);
  await forgetIdentityOnNewInstall(port, storage, IDENTITY_KEYS);
  storage.data.set('aw-net-session-v1', '{"uid":"u2","refreshToken":"r2"}');
  assert.equal(await forgetIdentityOnNewInstall(port, storage, IDENTITY_KEYS), 'same-install');
  assert.ok(storage.data.has('aw-net-session-v1'));
});
await test('marker cannot be written: identity kept (no reset on every launch)', async () => {
  const storage = restored();
  assert.equal(await forgetIdentityOnNewInstall(marker(false, { writeFails: true }).port, storage, IDENTITY_KEYS), 'unknown');
  assert.equal(storage.data.size, 4);
});
await test('marker cannot be read, web build (no marker), blocked storage: never throws', async () => {
  const storage = restored();
  assert.equal(await forgetIdentityOnNewInstall(marker(false, { readFails: true }).port, storage, IDENTITY_KEYS), 'unknown');
  assert.equal(await forgetIdentityOnNewInstall(null, storage, IDENTITY_KEYS), 'unknown');
  assert.equal(storage.data.size, 4);
  const blocked = { removeItem: () => { throw new Error('SecurityError'); } };
  assert.equal(await forgetIdentityOnNewInstall(marker(false).port, blocked, IDENTITY_KEYS), 'new-install');
  assert.equal(await forgetIdentityOnNewInstall(marker(false).port, null, IDENTITY_KEYS), 'new-install');
});

console.log(`SUMMARY test:install-identity seed=0 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
