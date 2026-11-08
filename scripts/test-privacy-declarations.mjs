// [night-12ak] R1f, D-220: docs/store/privacy-declarations.md must match what the code sends and stores.
// Records every request of the leaderboard layer against a fake network (build B) and of a build without Firebase
// config (build A, must be none), reads the fields the Cloud Functions write, the command journal's fields and the
// iOS privacy manifest, and compares each with the tables between the `<!-- privacy:* -->` markers in both directions.
import './ts-test-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const DOC_PATH = 'docs/store/privacy-declarations.md';
let doc = '';
try { doc = read(DOC_PATH); } catch { doc = ''; }

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}:`, error.message ?? error); }
}

/** Rows of the markdown table between `<!-- privacy:name -->` and `<!-- /privacy:name -->` (cells, header dropped). */
function section(name) {
  const match = doc.match(new RegExp(`<!-- privacy:${name} -->([\\s\\S]*?)<!-- /privacy:${name} -->`));
  assert.ok(match, `${DOC_PATH}: section privacy:${name} missing`);
  return match[1].trim();
}
function tableRows(name) {
  return section(name).split('\n').filter((line) => line.startsWith('|')).slice(2)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
}
const ticks = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const sorted = (items) => [...new Set(items)].sort();

// ---- Build B: record every request against a fake Firebase -------------------------------------------------------
const { createLeaderboards, readNetConfig, buildDailySubmission } = await import('../src/net/index.ts');
const bot = { ...(await import('./balance-game-adapter.ts')), ...(await import('./bot.ts')) };
const { dailySeedForKey } = await import('../src/core/daily.ts');
const DAY = '2026-11-04';
function playDaily(dateKey) {
  const session = bot.createBalanceSession(dailySeedForKey(dateKey), 'daily');
  for (let i = 0; i < 20_000 && session.snapshot().status !== 'finished'; i++) {
    const decision = bot.chooseBotAction(session.snapshot());
    if (decision) session.dispatch(decision.command);
    session.advance(30);
  }
  return session.simulation;
}
const submission = buildDailySubmission(playDaily(DAY), DAY);

/** Field paths of a JSON body: `a.b`; the command journal is one field (its commands are checked separately). */
function paths(value, prefix = '') {
  if (prefix === 'data.submission.journal') return [prefix];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return prefix ? [prefix] : [];
    return keys.flatMap((key) => paths(value[key], prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}
const endpointOf = (url) => {
  const { pathname } = new URL(url);
  const last = pathname.split('/').pop();
  return last;
};
function recorder() {
  const requests = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    requests.push({ url, method: init.method, headers: Object.keys(init.headers).sort(), body, endpoint: endpointOf(url) });
    const ok = (json) => ({ ok: true, status: 200, json: async () => json });
    if (url.includes('accounts:signUp')) return ok({ localId: 'uid-test', idToken: 'id-1', refreshToken: 'r-1', expiresIn: '3600' });
    if (url.includes('securetoken')) return ok({ user_id: 'uid-test', id_token: 'id-2', refresh_token: 'r-2', expires_in: '3600' });
    const name = endpointOf(url);
    if (name === 'submitDaily') return ok({ result: { accepted: true, score: submission.claimedScore } });
    if (name === 'getBoards') {
      const board = (id) => ({ id, entries: [], me: null });
      return ok({ result: { daily: board(body.data.daily), weekly: board(body.data.weekly) } });
    }
    if (name === 'deleteMyData') return ok({ result: { deleted: true } });
    return { ok: false, status: 404, json: async () => null };
  };
  return { requests, fetch };
}
function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, String(v)); }, removeItem: (k) => { map.delete(k); } };
}
const config = readNetConfig({ VITE_FIREBASE_API_KEY: 'public-key', VITE_FIREBASE_PROJECT_ID: 'airway-test' });
const B = recorder();
let clock = Date.UTC(2026, 10, 4, 12);
// [night-12az] D-246: record with an App Check provider, as on a phone with the plugin installed.
const leaderboards = createLeaderboards({ config, fetch: B.fetch, storage: memoryStorage(), now: () => clock,
  appCheck: async () => 'app-check-token' });
assert.equal(await leaderboards.submitDaily(submission), 'sent');
await leaderboards.boards(DAY);
clock += 2 * 3600_000; // the ID token expired: refresh
await leaderboards.boards(DAY);
assert.equal(await leaderboards.deleteMyData(), 'deleted');
const beforeOptOut = B.requests.length;
leaderboards.setSharing(false);
await leaderboards.submitDaily(submission);
await leaderboards.boards(DAY);
await leaderboards.flush();
const afterOptOut = B.requests.length - beforeOptOut;

const recordedFields = new Map();
for (const request of B.requests) {
  const set = recordedFields.get(request.endpoint) ?? new Set();
  for (const path of paths(request.body)) set.add(path);
  recordedFields.set(request.endpoint, set);
}

await check('every recorded endpoint is declared and every declared endpoint is used', () => {
  const declared = tableRows('endpoints').map((row) => ticks(row[0])[0]);
  assert.deepEqual(sorted(declared), sorted([...recordedFields.keys()]));
});
await check('every body field sent is declared, and nothing declared is no longer sent', () => {
  for (const row of tableRows('endpoints')) {
    const endpoint = ticks(row[0])[0];
    assert.deepEqual(sorted(ticks(row[3])), sorted([...(recordedFields.get(endpoint) ?? [])]), `fields of ${endpoint}`);
  }
});
await check('requests are HTTPS POST to the declared hosts; headers Content-Type, Authorization, declared App Check on callables', () => {
  const appCheckDeclared = /`X-Firebase-AppCheck: <App Check token>`/.test(read('docs/store/privacy-declarations.md'));
  const hosts = new Map(tableRows('endpoints').map((row) => [ticks(row[0])[0], ticks(row[1])[0]]));
  for (const request of B.requests) {
    const url = new URL(request.url);
    assert.equal(url.protocol, 'https:', request.url);
    assert.equal(request.method, 'POST');
    const host = hosts.get(request.endpoint).replace('<region>-<project>', `europe-west1-airway-test`);
    assert.equal(url.host, host, request.url);
    assert.deepEqual([...url.searchParams.keys()].filter((k) => k !== 'key'), [], request.url);
    const callable = request.endpoint === 'submitDaily' || request.endpoint === 'getBoards' || request.endpoint === 'deleteMyData';
    const allowed = ['Content-Type', 'Authorization', ...(callable && appCheckDeclared ? ['X-Firebase-AppCheck'] : [])];
    assert.ok(request.headers.every((h) => allowed.includes(h)), request.endpoint + ': ' + request.headers.join());
  }
});
await check('the "Send my daily results" switch off makes no request', () => assert.equal(afterOptOut, 0));
await check('callables: client calls = exported Cloud Functions = declared callables', () => {
  const client = sorted([...read('src/net/index.ts').matchAll(/client\.call<[^>]*>\('(\w+)'/g)].map((m) => m[1]));
  const server = sorted([...read('functions/src/index.ts').matchAll(/export const (\w+) = onCall\(/g)].map((m) => m[1]));
  const declared = sorted(tableRows('endpoints').map((row) => ticks(row[0])[0]).filter((name) => /^[a-zA-Z]+$/.test(name) && name !== 'token'));
  assert.deepEqual(client, server);
  assert.deepEqual(declared, client);
});

// ---- Build A: no Firebase config, no request at all ------------------------------------------------------------------
await check('build A (no Firebase config) makes no request', async () => {
  const A = recorder();
  const off = createLeaderboards({ config: readNetConfig({}), fetch: A.fetch, storage: memoryStorage() });
  assert.equal(off.enabled, false);
  await off.submitDaily(submission); await off.flush(); await off.boards(DAY); await off.deleteMyData();
  assert.equal(A.requests.length, 0);
});
await check('no other network path in src/: fetch only for bundled assets, no beacons/sockets, URLs only in net/config', () => {
  const files = [];
  const walk = (dir) => { for (const name of readdirSync(dir)) { const p = join(dir, name); statSync(p).isDirectory() ? walk(p) : /\.(ts|js)$/.test(name) && files.push(p); } };
  walk(join(ROOT, 'src'));
  const ASSET_FETCH = ['src/render/globe/land-mask.ts', 'src/render/globe/look.ts', 'src/render/globe/elevation.ts', // [ext-04] elevation-2048.png ([night-70a] shared)
    'src/render/globe/earth-globe.ts']; // [night-70a R1] D-325: bundled NASA textures (public/data/globe/)
  for (const file of files) {
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    const text = readFileSync(file, 'utf8');
    if (/(^|[^.\w])fetch\(/m.test(text)) assert.ok(ASSET_FETCH.includes(rel), `${rel} calls fetch`);
    assert.ok(!/sendBeacon|new WebSocket|XMLHttpRequest|new EventSource/.test(text), `${rel} opens another channel`);
    const urls = [...text.matchAll(/https?:\/\/[^\s'"`]*/g)].map((m) => m[0]).filter((u) => !u.startsWith('http://www.w3.org/'));
    if (rel !== 'src/net/config.ts') assert.deepEqual(urls, [], `${rel} has a URL`);
  }
  const deps = Object.keys(JSON.parse(read('package.json')).dependencies);
  assert.ok(!deps.some((d) => /firebase|analytics|ads|sentry|crash|tracking|purchases|billing/i.test(d)), deps.join());
});

// ---- Journal and server storage ---------------------------------------------------------------------------------------
await check('the command journal carries only the declared game fields', () => {
  const union = read('src/sim/commands.ts').match(/export type Command =([\s\S]*?);\n/)[1];
  const fromTypes = sorted([...union.matchAll(/readonly (\w+)\??:/g)].map((m) => m[1]));
  const declared = sorted(ticks(section('journal')));
  assert.deepEqual(declared, fromTypes);
  const sent = sorted(submission.journal.flatMap(([, command]) => Object.keys(command)));
  assert.ok(sent.every((key) => declared.includes(key)), sent.join());
});
/** Top-level keys of an object literal source (shorthand or `key: value`), commas inside brackets ignored. */
function literalKeys(source) {
  const parts = [];
  let depth = 0; let current = '';
  for (const ch of source) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; } else current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim().match(/^(\w+)/)?.[1]).filter(Boolean);
}
await check('every field the Cloud Functions write is declared (entries, weekly totals, top documents)', () => {
  const server = read('functions/src/index.ts');
  const writes = new Map();
  for (const m of server.matchAll(/tx\.set\((\w+),\s*\{([^}]*)\}/g)) {
    const doc = /^daily(Ref)?$/.test(m[1]) ? 'd' : /^weekly(Ref)?$/.test(m[1]) ? 'w' : /top/i.test(m[1]) ? 'top' : m[1];
    writes.set(doc, sorted([...(writes.get(doc) ?? []), ...literalKeys(m[2])]));
  }
  assert.deepEqual(sorted([...writes.keys()]), ['d', 'top', 'w'], 'unknown write target');
  const rows = new Map(tableRows('stored').map((row) => {
    const path = ticks(row[0])[0];
    const key = path.includes('/d-') ? 'd' : path.includes('/w-') ? 'w' : path.endsWith('meta/top') ? 'top' : path;
    return [key, ticks(row[1])];
  }));
  for (const [key, fields] of writes) {
    const declared = rows.get(key) ?? [];
    const topFields = key === 'top' ? declared.filter((f) => !fields.includes(f)) : [];
    assert.deepEqual(sorted(declared.filter((f) => fields.includes(f))), fields, `fields of ${key}`);
    if (key === 'top') {
      const entry = read('functions/src/logic.ts').match(/export interface TopEntry \{([^}]*)\}/)[1];
      assert.deepEqual(sorted(topFields), sorted([...entry.matchAll(/readonly (\w+)/g)].map((m) => m[1])), 'top rows');
    } else assert.equal(declared.length, fields.length, `extra declared fields for ${key}`);
  }
});
await check('the journal is not stored and retention is the declared 90 days (D-77)', async () => {
  const server = read('functions/src/index.ts');
  assert.ok(!/journal/.test(server.replace(/\/\/.*$/gm, '').replace(/reviewSubmission\([^)]*\)/g, '')), 'journal written');
  const { RETENTION_DAYS } = await import('../functions/src/logic.ts');
  assert.ok(doc.includes(`TTL of ${RETENTION_DAYS} days`), `doc must say "TTL of ${RETENTION_DAYS} days"`);
});

// ---- Store answers and the iOS manifest ----------------------------------------------------------------------------
await check('App Store answers = PrivacyInfo.xcprivacy collected data types', () => {
  const NAMES = { 'Identifiers → User ID': 'NSPrivacyCollectedDataTypeUserID', 'User Content → Gameplay Content': 'NSPrivacyCollectedDataTypeGameplayContent' };
  const PURPOSES = { 'App Functionality': 'NSPrivacyCollectedDataTypePurposeAppFunctionality', 'Analytics': 'NSPrivacyCollectedDataTypePurposeAnalytics',
    'Product Personalization': 'NSPrivacyCollectedDataTypePurposeProductPersonalization', 'Developer\'s Advertising or Marketing': 'NSPrivacyCollectedDataTypePurposeDeveloperAdvertising',
    'Third-Party Advertising': 'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising', 'Other Purposes': 'NSPrivacyCollectedDataTypePurposeOther' };
  const declared = tableRows('apple').map(([type, linked, tracking, purposes]) => ({
    type: NAMES[type] ?? type, linked: linked === 'Yes', tracking: tracking === 'Yes',
    purposes: sorted(purposes.split(';').map((p) => PURPOSES[p.trim()] ?? p.trim())),
  }));
  const manifest = read('ios/App/App/PrivacyInfo.xcprivacy');
  const block = manifest.match(/<key>NSPrivacyCollectedDataTypes<\/key>\s*<array>([\s\S]*?)\n    <\/array>/)?.[1] ?? '';
  const actual = [...block.matchAll(/<dict>([\s\S]*?)<\/dict>/g)].map(([, d]) => ({
    type: d.match(/<key>NSPrivacyCollectedDataType<\/key>\s*<string>([^<]+)</)[1],
    linked: /<key>NSPrivacyCollectedDataTypeLinked<\/key>\s*<true/.test(d),
    tracking: /<key>NSPrivacyCollectedDataTypeTracking<\/key>\s*<true/.test(d),
    purposes: sorted([...d.matchAll(/<string>(NSPrivacyCollectedDataTypePurpose\w+)</g)].map((m) => m[1])),
  }));
  const key = (e) => e.type;
  assert.deepEqual([...declared].sort((a, b) => key(a).localeCompare(key(b))), [...actual].sort((a, b) => key(a).localeCompare(key(b))));
  assert.ok(/<key>NSPrivacyTracking<\/key>\s*<false/.test(manifest), 'NSPrivacyTracking must be false');
});
await check('Play answers: identifiers + gameplay, not shared, both optional and not ephemeral', () => {
  const rows = tableRows('play');
  assert.deepEqual(rows.map((r) => r[0]), ['Device or other IDs', 'App activity → Other actions']);
  for (const row of rows) {
    assert.ok(row[1].startsWith('Yes'), row[0]);
    assert.equal(row[2], 'No', `${row[0]} shared`);
    assert.equal(row[3], 'No', `${row[0]} ephemeral`);
    assert.ok(row[4].startsWith('Optional'), `${row[0]} optional`);
  }
  // Optional is true only while the opt-out switch exists (D-135).
  assert.match(read('src/net/index.ts'), /setSharing\(on: boolean\): void/);
});

console.log(`SUMMARY test:privacy-declarations seed=0 cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
