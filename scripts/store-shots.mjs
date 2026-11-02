// [task-26] Fail-closed Playwright captures of real, deterministic game scenes.
// [task-36] Every PNG is checked (size, not blank/white, no dev text, passenger glyphs only from the six
// D-08 shapes) and a contact sheet is rendered. `--validate` re-checks the committed PNGs + manifest.
// Preview one scene without publishing: `node scripts/store-shots.mjs --only=night --out=/some/dir`.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/store/shots');
const SEED = 41377; // 0xA1A1
// [task-31] The weekly board needs a run that survives week 1; with 3-day weeks (D-40) the DEV autoplay bot
// (src/game/dev/autoplay.ts) does so from a clean start on the ordinary seed 0xA1A1.
const WEEK_SEED = SEED;
const seedFor = (scene) => (scene === 'upgrade' ? WEEK_SEED : SEED);
const LANGUAGES = ['pl', 'en'];
// [task-36] The light is chosen by the fixture in src/main.ts (sun hour angle over the camera centre).
// [task-40] D-63: store order night, game, upgrade, failure, menu (SCENES order = contact sheet columns,
// manifest order, listing order in docs/store/{pl,en}.md). `game` is lit by golden low sun (was game-dusk).
const SCENES = ['night', 'game', 'upgrade', 'failure', 'menu'];
// [task-40] D-63 warmth gate for the `game` scene: share of golden pixels on the globe (see globeWarmth).
// Measured on seed 0xA1A1, phone: noon 0.005, mid-afternoon 0.029, old −95° shot 0.015, golden 0.079.
const WARM_SCENE = 'game';
const GOLD_MIN = 0.045;
const CONTRAST_MIN = 4.5; // D-47
const DEVICES = [
  { id: 'phone', w: 360, h: 640, dpr: 3 }, // 1080x1920; 9:16
  { id: 'foldable', w: 673, h: 841, dpr: 2 },
  { id: 'tablet', w: 768, h: 1024, dpr: 2 },
];
const EXPECTED = LANGUAGES.length * SCENES.length * DEVICES.length;
const args = process.argv.slice(2);
const validateOnly = args.includes('--validate');
const baseArg = args.find((arg) => arg.startsWith('--base-url='));
const onlyArg = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
const outArg = args.find((arg) => arg.startsWith('--out='))?.slice('--out='.length);
const MANIFEST = resolve(OUT, 'manifest.json');
const CONTACT = resolve(ROOT, 'docs/store/contact-sheet.png');
// D-08: the six approved passenger glyphs. The provisional Asia/Oceania glyphs must not reach a store image.
const D08_GLYPHS = ['chevron', 'bowtie', 'crescent', 'keyhole', 'fin', 'bracket'];
// Developer-only text that must never be visible in a store image (raw i18n keys, debug words, NaN...).
const DEV_TEXT = /\b(?:DEV|debug|TODO|FIXME|undefined|NaN|null|fps|lorem|storeShot|localhost|127\.0\.0\.1)\b|\{[A-Za-z]+\}|\b[a-z]+\.[a-z]+[A-Z][A-Za-z]*\b|\b(?:hud|menu|action|pause|upgrade|gameover|settings|tutorial|canvas)\.[a-z][A-Za-z.]*\b/;
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
  if (new Set(SCENES).size !== SCENES.length) throw new Error('Duplicate scenes');
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

/** Minimal PNG reader (8-bit RGB/RGBA, non-interlaced: what Chromium writes). Returns RGBA pixels. */
export function readPng(file) {
  const data = readFileSync(file);
  if (data.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG: ' + file);
  let offset = 8, width = 0, height = 0, type = 0;
  const idat = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const kind = data.toString('latin1', offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4); type = body[9];
      if (body[8] !== 8 || (type !== 2 && type !== 6) || body[12] !== 0) {
        throw new Error('Unsupported PNG format (need 8-bit RGB/RGBA, no interlace): ' + file);
      }
    } else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    offset += 12 + length;
  }
  const channels = type === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = (line[x] + add) & 255;
    }
    for (let x = 0; x < width; x++) {
      out[(y * width + x) * 4] = line[x * channels];
      out[(y * width + x) * 4 + 1] = line[x * channels + 1];
      out[(y * width + x) * 4 + 2] = line[x * channels + 2];
      out[(y * width + x) * 4 + 3] = channels === 4 ? line[x * channels + 3] : 255;
    }
    previous = line;
  }
  return { width, height, pixels: out };
}

/** Pixel statistics on a 4-px grid: luminance spread, white share, dominant colour share, colour count. */
export function pngStats(file) {
  const { width, height, pixels } = readPng(file);
  let n = 0, sum = 0, sq = 0, white = 0;
  const buckets = new Map();
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      n++; sum += l; sq += l * l;
      if (r > 245 && g > 245 && b > 245) white++;
      const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  const mean = sum / n;
  return {
    width, height,
    meanLuma: Math.round(mean * 10) / 10,
    lumaStd: Math.round(Math.sqrt(Math.max(0, sq / n - mean * mean)) * 10) / 10,
    whiteShare: Math.round(white / n * 1000) / 1000,
    dominantShare: Math.round(Math.max(...buckets.values()) / n * 1000) / 1000,
    colours: buckets.size,
  };
}

/** Throws unless a captured PNG is a full-size, non-blank, non-white frame. */
function checkPixels(file, device, where) {
  const stats = pngStats(file);
  if (stats.width !== device.w * device.dpr || stats.height !== device.h * device.dpr) {
    throw new Error(where + ': ' + stats.width + 'x' + stats.height + ' instead of ' +
      device.w * device.dpr + 'x' + device.h * device.dpr);
  }
  if (stats.whiteShare > 0.6) throw new Error(where + ': white frame (' + stats.whiteShare + ' white)');
  if (stats.dominantShare > 0.85 || stats.lumaStd < 8 || stats.colours < 60) {
    throw new Error(where + ': empty frame (dominant ' + stats.dominantShare + ', luma std ' + stats.lumaStd +
      ', colours ' + stats.colours + ')');
  }
  return stats;
}

/**
 * [task-40] D-63: the `game` scene must read as golden low sun, not daylight; D-47: in the lit `game` and
 * `night` scenes routes, airports and planes keep >= 4.5:1 against the globe behind them.
 */
function checkWarmth(id, scene, record) {
  if (scene === 'game' || scene === 'night') {
    for (const layer of ['routes', 'airports', 'planes']) {
      const ratio = record.contrast?.[layer];
      if (typeof ratio !== 'number') throw new Error(id + ': no ' + layer + ' contrast recorded');
      if (ratio < CONTRAST_MIN) throw new Error(id + ': ' + layer + ' contrast ' + ratio + ' < ' + CONTRAST_MIN);
    }
  }
  if (scene !== WARM_SCENE) return;
  const gold = record.warmth?.gold;
  if (typeof gold !== 'number') throw new Error(id + ': no globe warmth recorded (DEV world probe missing?)');
  if (gold < GOLD_MIN) throw new Error(id + ': globe does not read as golden low sun (gold ' + gold + ' < ' + GOLD_MIN + ')');
}

/** Throws on developer text or a non-D-08 passenger glyph recorded from the page. */
function checkPageRecord(id, record) {
  const hit = DEV_TEXT.exec(record.text);
  if (hit) throw new Error(id + ': developer text visible: "' + hit[0] + '"');
  const bad = record.glyphs.filter((glyph) => !D08_GLYPHS.includes(glyph));
  if (bad.length) throw new Error(id + ': passenger glyph outside D-08: ' + bad.join(', '));
  if (record.devOverlay) throw new Error(id + ': Vite/dev overlay visible');
}

async function capture(page, baseUrl, lang, scene, destination) {
  const url = new URL(baseUrl);
  url.searchParams.set('storeShot', scene);
  const seed = seedFor(scene);
  url.searchParams.set('seed', String(seed));
  url.searchParams.set('lang', lang);
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
  { id: scene, seed }, { timeout: 120000 }).catch(() => {
    // [integration-tooling] Name the missing contract instead of a bare Playwright timeout.
    throw new Error('Scene "' + scene + '" never set <html data-store-shot-ready="' + scene +
      '" data-store-shot-seed="' + seed + '"> (scene not reached or ?storeShot fixture missing in src/main.ts)');
  });
  await page.evaluate(() => document.fonts.ready);
  const state = await page.evaluate(() => {
    return {
      lang: document.documentElement.lang,
      overflow: document.documentElement.scrollWidth > innerWidth + 2,
      canvas: [...document.querySelectorAll('#app canvas')].some((canvas) => {
        const box = canvas.getBoundingClientRect();
        return box.width > 150 && box.height > 150;
      }),
      text: document.body.innerText.replace(/\s+/g, ' ').trim(),
      devOverlay: !!document.querySelector('vite-error-overlay'),
    };
  });
  // A glyph counts only when it is painted on top: hit-test its centre with pointer events forced on.
  state.glyphs = await page.evaluate(() => {
    const force = document.createElement('style');
    force.textContent = '*{pointer-events:auto!important}';
    document.head.append(force);
    try {
      return [...document.querySelectorAll('svg.airport-region-glyph')].filter((svg) => {
        const box = svg.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return false;
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return !!hit && (svg === hit || svg.contains(hit) || !!hit.closest('.airport-bubble')?.contains(svg));
      }).map((svg) => svg.dataset.airwayDestination ?? '?');
    } finally { force.remove(); }
  });
  if (state.lang !== lang) throw new Error('Incorrect scene language: ' + scene + '/' + lang);
  if (state.overflow) throw new Error('Horizontal overflow: ' + scene);
  if (!state.canvas) throw new Error('No visible globe canvas: ' + scene);
  if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
  // [task-40] Sun hour angle@camera latitude chosen by the fixture (game and night scenes).
  state.sun = await page.evaluate(() => document.documentElement.dataset.storeShotSun ?? null);
  await page.screenshot({ path: destination, animations: 'disabled', fullPage: false });
  if (scene !== 'menu') {
    // [task-40] D-47 contrast probe (src/render/contrast.ts via the DEV world probe) and D-63 warmth of the
    // globe alone (DOM overlay hidden), both recorded in the manifest.
    state.contrast = await page.evaluate(() => window.__awWorld?.nightContrast?.() ?? null);
    const disc = await page.evaluate(() => window.__awWorld?.disc?.() ?? null);
    const hide = await page.addStyleTag({ content: '#app *:not(canvas){visibility:hidden!important}' });
    const probe = resolve(stageDir, 'globe-probe.png');
    try { await page.screenshot({ path: probe, animations: 'disabled', fullPage: false }); }
    finally { await hide.evaluate((node) => node.remove()); }
    state.warmth = disc ? globeWarmth(probe, disc, page.viewportSize().width) : null;
    rmSync(probe, { force: true });
  }
  return state;
}

/**
 * [task-40] Globe light of a PNG with the DOM overlay hidden, inside the projected disc (rim excluded):
 * `gold` = share of clearly orange pixels (R > 1.3 G, G > 1.05 B, R > 50), which daylight sand and green
 * land do not reach but the warm terminator band does; `ratio` = mean R / mean B (recorded only).
 */
export function globeWarmth(file, disc, cssWidth) {
  const { width, height, pixels } = readPng(file);
  const scale = width / cssWidth;
  const cx = disc.x * scale, cy = disc.y * scale, radius = disc.radius * scale * 0.96;
  let red = 0, blue = 0, gold = 0, n = 0;
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
      const i = (y * width + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      red += r; blue += b; n++;
      if (r > g * 1.3 && g > b * 1.05 && r > 50) gold++;
    }
  }
  if (n < 1000) return null;
  return { gold: Math.round(gold / n * 1000) / 1000, ratio: Math.round(red / Math.max(1, blue) * 1000) / 1000 };
}

/** Region id -> glyph name, read from the single source of truth (src/data/regions.ts). */
function regionGlyphs() {
  const source = readFileSync(resolve(ROOT, 'src/data/regions.ts'), 'utf8');
  const map = {};
  for (const match of source.matchAll(/^\s+([A-Z]{2,3}): \{ glyph: '([a-z]+)'/gm)) map[match[1]] = match[2];
  if (Object.keys(map).length < 6) throw new Error('Cannot read region glyphs from src/data/regions.ts');
  return map;
}

/** Contact sheet: per language one row per device, one column per scene, rendered in Chromium. */
async function renderContactSheet(browser, dir, target) {
  const thumbH = 420, gap = 18;
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  try {
    await page.route('http://store.local/**', (route) => {
      const path = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
      return route.fulfill({ path: path.startsWith('fonts/') ? resolve(ROOT, 'public', path) : resolve(dir, path) });
    });
    const blocks = LANGUAGES.map((lang) => '<h2>' + lang.toUpperCase() + '</h2>' + DEVICES.map((device) =>
      '<div class="row"><div class="dev">' + device.id + '<br><small>' + device.w * device.dpr + '×' +
      device.h * device.dpr + '</small></div>' + SCENES.map((scene) =>
        '<figure><img style="width:' + Math.round(thumbH * device.w / device.h) + 'px" src="http://store.local/' +
        lang + '/' + scene + '-' + device.id + '.png"><figcaption>' + (SCENES.indexOf(scene) + 1) + ' · ' + scene +
        '</figcaption></figure>').join('') +
      '</div>').join('')).join('');
    await page.setContent('<!doctype html><meta charset="utf-8"><style>' +
      '@font-face{font-family:Overpass;src:url(http://store.local/fonts/Overpass-800.ttf);font-weight:800}' +
      '@font-face{font-family:OverpassMono;src:url(http://store.local/fonts/OverpassMono-700.ttf)}' +
      'body{margin:0;padding:' + gap + 'px 28px;background:#1d2b2a;color:#f3ead8;font-family:OverpassMono,monospace;width:max-content}' +
      'h1{font:800 30px Overpass;margin:0 0 4px;letter-spacing:.02em}h2{font:800 22px Overpass;margin:' + gap + 'px 0 8px;color:#f2c230}' +
      '.row{display:flex;gap:' + gap + 'px;align-items:flex-start;margin-bottom:' + gap + 'px}' +
      '.dev{width:90px;font-size:14px;text-transform:uppercase}small{opacity:.7;font-size:11px}' +
      'figure{margin:0}img{height:' + thumbH + 'px;display:block;border:1px solid #0b1312}' +
      'figcaption{font-size:12px;margin-top:4px;text-transform:uppercase;letter-spacing:.06em}</style>' +
      '<h1>Airway — store screenshots (' + EXPECTED + ')</h1>' + blocks, { waitUntil: 'load' });
    await page.evaluate(() => Promise.all([document.fonts.ready,
      ...[...document.images].map((img) => img.decode())]));
    const size = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }));
    await page.setViewportSize({ width: size.w, height: size.h });
    await page.screenshot({ path: target, fullPage: true });
  } finally { await page.close(); }
}

/** `--validate`: committed PNGs, manifest and contact sheet still match the 30-shot contract. */
// [task-40] `--validate --out=<dir>` checks a fresh full run in a scratch dir (manifest + sheet inside it).
function validateShots(dir = OUT, manifestFile = MANIFEST, contactFile = CONTACT) {
  if (!existsSync(manifestFile)) throw new Error('Missing ' + manifestFile + '; run npm run store:shots');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  if (manifest.shots?.length !== EXPECTED) throw new Error('Manifest lists ' + manifest.shots?.length + '/' + EXPECTED);
  // [task-40] D-63: the manifest follows the store order (language, then SCENES, then DEVICES).
  const order = LANGUAGES.flatMap((lang) => SCENES.flatMap((scene) => DEVICES.map((d) => lang + '/' + scene + '-' + d.id)));
  const listed = manifest.shots.map((shot) => shot.id);
  if (listed.join() !== order.join()) throw new Error('Manifest is not in store order (' + SCENES.join(', ') + ')');
  const seen = new Set();
  for (const lang of LANGUAGES) for (const scene of SCENES) for (const device of DEVICES) {
    const id = lang + '/' + scene + '-' + device.id;
    const record = manifest.shots.find((shot) => shot.id === id);
    if (!record) throw new Error('Manifest misses ' + id);
    seen.add(id);
    const file = resolve(dir, id + '.png');
    if (!existsSync(file)) throw new Error('Missing PNG ' + id);
    checkPixels(file, device, id);
    checkPageRecord(id, record);
    checkWarmth(id, scene, record);
  }
  if (seen.size !== EXPECTED) throw new Error('Duplicate manifest entries');
  for (const lang of LANGUAGES) {
    const extra = readdirSync(resolve(dir, lang)).filter((file) => !seen.has(lang + '/' + file.replace(/\.png$/, '')));
    if (extra.length) throw new Error('Unexpected files in shots/' + lang + ': ' + extra.join(', '));
  }
  if (!existsSync(contactFile)) throw new Error('Missing ' + contactFile);
  const sheet = pngStats(contactFile);
  if (sheet.width < 1200 || sheet.height < 1200 || sheet.lumaStd < 12) throw new Error('Contact sheet looks empty');
  return EXPECTED;
}

try {
  const unknown = args.filter((arg) => arg !== '--validate' && !/^--(base-url|only|out)=/.test(arg));
  if (unknown.length) throw new Error('Unknown options: ' + unknown.join(', '));
  if (onlyArg && !SCENES.includes(onlyArg)) throw new Error('Unknown scene: ' + onlyArg);
  if (onlyArg && !outArg) throw new Error('--only needs --out=<dir>: a partial run never publishes');
  const fields = checkCopy();
  if (validateOnly) {
    const shots = outArg ? validateShots(resolve(outArg), resolve(outArg, 'manifest.json'),
      resolve(outArg, 'contact-sheet.png')) : validateShots();
    console.log('SUMMARY test:store-shots seed=0xA1A1 listings=2 fields=' + fields +
      ' scenes=5 devices=3 shots=' + shots + ' passed=1 failed=0');
  } else {
    const require = createRequire(import.meta.url);
    const { chromium } = require('playwright');
    const glyphOf = regionGlyphs();
    const url = baseArg ? baseArg.slice('--base-url='.length) : await startVite();
    stageDir = mkdtempSync(join(tmpdir(), 'airway-store-shots-'));
    browser = await chromium.launch({ headless: true, args: [
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    ] });
    const records = [];
    const scenes = onlyArg ? [onlyArg] : SCENES;
    for (const lang of LANGUAGES) {
      for (const scene of scenes) {
        for (const device of DEVICES) {
          const page = await browser.newPage({
            viewport: { width: device.w, height: device.h }, deviceScaleFactor: device.dpr,
            locale: lang === 'pl' ? 'pl-PL' : 'en-GB', reducedMotion: 'reduce',
          });
          const filename = scene + '-' + device.id + '.png';
          const target = resolve(stageDir, lang, filename);
          mkdirSync(dirname(target), { recursive: true });
          let state;
          try { state = await capture(page, url, lang, scene, target); }
          finally { await page.close(); }
          const id = lang + '/' + scene + '-' + device.id;
          const record = { id, lang, scene, device: device.id, seed: seedFor(scene),
            glyphs: [...new Set(state.glyphs.map((region) => glyphOf[region] ?? region))].sort(),
            devOverlay: state.devOverlay, text: state.text };
          // [task-40] Light and readability measurements (game/night/failure/upgrade; not the menu).
          if (state.sun) record.sun = state.sun;
          if (state.contrast) record.contrast = state.contrast;
          if (state.warmth) record.warmth = state.warmth;
          checkWarmth(id, scene, record);
          checkPageRecord(id, record);
          const stats = checkPixels(target, device, id);
          records.push({ ...record, png: { width: stats.width, height: stats.height, meanLuma: stats.meanLuma,
            lumaStd: stats.lumaStd, whiteShare: stats.whiteShare, colours: stats.colours } });
          captured++;
          console.log('shot ' + id + '.png ' + stats.width + 'x' + stats.height + ' luma=' + stats.meanLuma +
            '±' + stats.lumaStd + ' glyphs=' + (record.glyphs.join('+') || '-') +
            (record.sun ? ' sun=' + record.sun : '') + (record.warmth ? ' gold=' + record.warmth.gold + ' r/b=' + record.warmth.ratio : '') +
            (record.contrast ? ' contrast=' + JSON.stringify(record.contrast) : ''));
        }
      }
    }
    const expected = onlyArg ? LANGUAGES.length * DEVICES.length : EXPECTED;
    if (captured !== expected) throw new Error('Incomplete capture ' + captured + '/' + expected);
    const dest = outArg ? resolve(outArg) : OUT;
    // Publish only a complete matrix; do not leave partial store screenshots.
    for (const lang of LANGUAGES) {
      mkdirSync(resolve(dest, lang), { recursive: true });
      for (const file of readdirSync(resolve(stageDir, lang))) {
        copyFileSync(resolve(stageDir, lang, file), resolve(dest, lang, file));
      }
    }
    if (!onlyArg) {
      writeFileSync(outArg ? resolve(dest, 'manifest.json') : MANIFEST, JSON.stringify({
        note: 'Generated by scripts/store-shots.mjs; checked by npm run test:store-shots.',
        allowedGlyphs: D08_GLYPHS, shots: records,
      }, null, 1) + '\n');
      await renderContactSheet(browser, dest, outArg ? resolve(dest, 'contact-sheet.png') : CONTACT);
      console.log('contact sheet ' + (outArg ? resolve(dest, 'contact-sheet.png') : CONTACT.slice(ROOT.length + 1)));
    }
    console.log('SUMMARY store:shots seed=0xA1A1 expected=' + expected +
      ' captured=' + captured + ' checked=' + records.length + ' passed=1 failed=0');
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
