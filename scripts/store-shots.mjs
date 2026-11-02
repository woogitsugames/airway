// [task-26] Fail-closed Playwright captures of real, deterministic game scenes.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/store/shots');
const SEED = 41377; // 0xA1A1
// The weekly board needs a run that survives week 1. With the current balance the DEV autoplay bot
// (src/game/dev/autoplay.ts) does so from a clean start only on some seeds; 41386 is the nearest one.
const WEEK_SEED = 41386;
const seedFor = (scene) => (scene === 'upgrade' ? WEEK_SEED : SEED);
const LANGUAGES = ['pl', 'en'];
const SCENES = [
  ['game-dusk', '18:30'],
  ['upgrade', '18:30'],
  ['menu', '12:00'],
  ['failure', '18:30'],
  ['night', '22:30'],
];
const DEVICES = [
  { id: 'phone', w: 360, h: 640, dpr: 3 }, // 1080x1920; 9:16
  { id: 'foldable', w: 673, h: 841, dpr: 2 },
  { id: 'tablet', w: 768, h: 1024, dpr: 2 },
];
const EXPECTED = LANGUAGES.length * SCENES.length * DEVICES.length;
const args = process.argv.slice(2);
const validateOnly = args.includes('--validate');
const baseArg = args.find((arg) => arg.startsWith('--base-url='));
let browser, server, stageDir, captured = 0;

function field(markdown, heading) {
  const key = '## ' + heading + '\n';
  const index = markdown.indexOf(key);
  if (index < 0) throw new Error('Missing listing field: ' + heading);
  if (markdown.indexOf(key, index + key.length) >= 0) throw new Error('Duplicate listing field: ' + heading);
  const value = markdown.slice(index + key.length).split(/\n## /, 1)[0].trim();
  if (!value) throw new Error('Empty listing field: ' + heading);
  return value;
}

function checkCopy() {
  let fields = 0;
  for (const lang of LANGUAGES) {
    const md = readFileSync(resolve(ROOT, 'docs/store/' + lang + '.md'), 'utf8').replace(/\r\n/g, '\n');
    const approved = field(md, 'Approved full title');
    const name = field(md, 'Store title');
    const subtitle = field(md, 'App Store subtitle');
    const short = field(md, 'Google Play short description');
    const full = field(md, 'Full description');
    const keywords = field(md, 'App Store keywords');
    const ownerTitle = lang === 'pl' ?
      'Airway: Buduj siatkę lotów na globusie' : 'Airway: Globe Route Builder';
    if (approved !== ownerTitle) throw new Error(lang + ': D-18 title modified');
    if ([...name].length > 30) throw new Error(lang + ': title >30 characters');
    if ([...subtitle].length > 30) throw new Error(lang + ': subtitle >30 characters');
    if ([...short].length > 80) throw new Error(lang + ': short description >80 characters');
    if ([...full].length > 4000) throw new Error(lang + ': full description >4000 characters');
    if (Buffer.byteLength(keywords, 'utf8') > 100) throw new Error(lang + ': keyword field >100 UTF-8 bytes');
    if (/mini metro|mini airways|tiny airline|fly corp/i.test(
      [name, subtitle, short, full, keywords].join(' '))) {
      throw new Error(lang + ': competitor name used');
    }
    console.log('listing ' + lang + ' name=' + [...name].length + '/30 short=' +
      [...short].length + '/80 keywords=' + Buffer.byteLength(keywords, 'utf8') + '/100bytes');
    fields += 6;
  }
  if (new Set(SCENES.map((scene) => scene[0])).size !== SCENES.length) throw new Error('Duplicate scenes');
  if (new Set(DEVICES.map((d) => d.id)).size !== DEVICES.length) throw new Error('Duplicate devices');
  if (DEVICES[0].w * DEVICES[0].dpr !== 1080 ||
      DEVICES[0].h * DEVICES[0].dpr !== 1920) throw new Error('Invalid 9:16 phone dimensions');
  return fields;
}

async function choosePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('Cannot reserve a port');
  await new Promise((done) => socket.close(done));
  return address.port;
}

async function startVite() {
  const bin = resolve(ROOT, 'node_modules/vite/bin/vite.js');
  if (!existsSync(bin)) throw new Error('Vite not installed; run npm ci');
  const port = await choosePort();
  let output = '';
  server = spawn(process.execPath, [
    bin, '--host', '127.0.0.1', '--port', String(port), '--strictPort',
  ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on('data', (data) => { output = (output + data.toString()).slice(-6000); });
  }
  const url = 'http://127.0.0.1:' + port + '/';
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error('Vite exited: ' + output);
    try {
      const response = await fetch(url);
      if (response.ok) return url;
    } catch { /* Wait for dev server. */ }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error('Vite startup timeout: ' + output);
}

async function capture(page, baseUrl, lang, scene, hour, destination) {
  const url = new URL(baseUrl);
  url.searchParams.set('storeShot', scene);
  const seed = seedFor(scene);
  url.searchParams.set('seed', String(seed));
  url.searchParams.set('lang', lang);
  url.searchParams.set('storeHour', hour);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Use real app i18n settings, not translated HTML injected by this script.
  await page.addInitScript((language) => {
    try {
      const key = 'airway.settings';
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({ ...value, language }));
    } catch { /* Browser privacy mode can block storage. */ }
  }, lang);
  await page.goto(url.href, { waitUntil: 'networkidle', timeout: 30000 });
  // Never treat the empty sky scaffold or a static mockup as a store screenshot.
  await page.waitForFunction(({ id, seed }) =>
    document.documentElement.dataset.storeShotReady === id &&
    document.documentElement.dataset.storeShotSeed === String(seed),
  { id: scene, seed }, { timeout: 30000 }).catch(() => {
    // [integration-tooling] Name the missing contract instead of a bare Playwright timeout.
    throw new Error('Scene "' + scene + '" never set <html data-store-shot-ready="' + scene +
      '" data-store-shot-seed="' + seed + '"> (scene not reached or ?storeShot fixture missing in src/main.ts)');
  });
  await page.evaluate(() => document.fonts.ready);
  const state = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    overflow: document.documentElement.scrollWidth > innerWidth + 2,
    canvas: [...document.querySelectorAll('#app canvas')].some((canvas) => {
      const box = canvas.getBoundingClientRect();
      return box.width > 150 && box.height > 150;
    }),
  }));
  if (state.lang !== lang) throw new Error('Incorrect scene language: ' + scene + '/' + lang);
  if (state.overflow) throw new Error('Horizontal overflow: ' + scene);
  if (!state.canvas) throw new Error('No visible globe canvas: ' + scene);
  if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
  await page.screenshot({ path: destination, animations: 'disabled', fullPage: false });
}

try {
  const unknown = args.filter((arg) => arg !== '--validate' && !arg.startsWith('--base-url='));
  if (unknown.length) throw new Error('Unknown options: ' + unknown.join(', '));
  const fields = checkCopy();
  if (validateOnly) {
    console.log('SUMMARY test:store-shots seed=0xA1A1 listings=2 fields=' + fields +
      ' scenes=5 devices=3 passed=1 failed=0');
  } else {
    const require = createRequire(import.meta.url);
    const { chromium } = require('playwright');
    const url = baseArg ? baseArg.slice('--base-url='.length) : await startVite();
    stageDir = mkdtempSync(join(tmpdir(), 'airway-store-shots-'));
    browser = await chromium.launch({ headless: true, args: [
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    ] });
    for (const lang of LANGUAGES) {
      for (const [scene, hour] of SCENES) {
        for (const device of DEVICES) {
          const page = await browser.newPage({
            viewport: { width: device.w, height: device.h }, deviceScaleFactor: device.dpr,
            locale: lang === 'pl' ? 'pl-PL' : 'en-GB', reducedMotion: 'reduce',
          });
          const filename = scene + '-' + device.id + '.png';
          const target = resolve(stageDir, lang, filename);
          mkdirSync(dirname(target), { recursive: true });
          try { await capture(page, url, lang, scene, hour, target); }
          finally { await page.close(); }
          captured++;
          console.log('shot ' + lang + '/' + filename + ' ' +
            device.w * device.dpr + 'x' + device.h * device.dpr);
        }
      }
    }
    if (captured !== EXPECTED) throw new Error('Incomplete capture ' + captured + '/' + EXPECTED);
    // Publish only a complete matrix; do not leave partial store screenshots.
    for (const lang of LANGUAGES) {
      mkdirSync(resolve(OUT, lang), { recursive: true });
      for (const file of readdirSync(resolve(stageDir, lang))) {
        copyFileSync(resolve(stageDir, lang, file), resolve(OUT, lang, file));
      }
    }
    console.log('SUMMARY store:shots seed=0xA1A1 expected=' + EXPECTED +
      ' captured=' + captured + ' passed=1 failed=0');
  }
} catch (error) {
  console.error('FAIL ' + (error instanceof Error ? error.message : String(error)));
  console.log('SUMMARY ' + (validateOnly ? 'test:store-shots' : 'store:shots') +
    ' seed=0xA1A1 captured=' + captured + ' passed=0 failed=1');
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((done) => {
      server.once('exit', done);
      setTimeout(done, 3000).unref();
    });
  }
  if (stageDir) rmSync(stageDir, { recursive: true, force: true });
}
