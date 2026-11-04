// [task-26] Fail-closed Playwright captures of real, deterministic game scenes.
// [task-36] Every PNG is checked (size, not blank/white, no dev text, passenger glyphs only from the six
// D-08 shapes) and a contact sheet is rendered. `--validate` re-checks the committed PNGs + manifest.
// Preview one scene without publishing: `node scripts/store-shots.mjs --only=night --out=/some/dir`.
// [N12n] `--feature` renders only the Google Play feature graphic (1024×500, opaque RGB PNG, D-117).
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync, inflateSync } from 'node:zlib';
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
// [N12o] D-123: the three original profiles plus the exact console sizes. Apple needs iPhone 6.9" (1320×2868) and
// iPad 13" (2064×2752) screenshots; Play's large-screen / promotion slots take only 9:16 or 16:9 (the foldable 4:5 and
// tablet 3:4 do not qualify), so `landscape` is 1920×1080 with the game in its landscape HUD. `store` names the slot.
const DEVICES = [
  { id: 'phone', w: 360, h: 640, dpr: 3, store: 'play' }, // 1080x1920; 9:16
  { id: 'foldable', w: 673, h: 841, dpr: 2, store: 'play' },
  { id: 'tablet', w: 768, h: 1024, dpr: 2, store: 'play' },
  { id: 'iphone', w: 440, h: 956, dpr: 3, store: 'apple' }, // 1320x2868, iPhone 6.9"
  { id: 'ipad', w: 1032, h: 1376, dpr: 2, store: 'apple' }, // 2064x2752, iPad 13"
  { id: 'landscape', w: 960, h: 540, dpr: 2, store: 'play' }, // 1920x1080; 16:9
];
// [N12o] Exact pixel sizes App Store Connect accepts for the two required device classes (portrait; Apple
// "Screenshot specifications": 6.9" display 1320×2868 or 1290×2796 / 1260×2736, 13" iPad 2064×2752 or 2048×2732).
const APPLE_SIZES = { iphone: ['1320x2868', '1290x2796', '1260x2736'], ipad: ['2064x2752', '2048x2732'] };
const EXPECTED = LANGUAGES.length * SCENES.length * DEVICES.length;
const args = process.argv.slice(2);
const validateOnly = args.includes('--validate');
const featureOnly = args.includes('--feature');
const baseArg = args.find((arg) => arg.startsWith('--base-url='));
const onlyArg = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);
const outArg = args.find((arg) => arg.startsWith('--out='))?.slice('--out='.length);
const MANIFEST = resolve(OUT, 'manifest.json');
const CONTACT = resolve(ROOT, 'docs/store/contact-sheet.png');
// [N12n] D-117: Google Play feature graphic, rendered from the real `game` scene in a wide landscape viewport
// at DPR 2 and downscaled, the wayfinding wordmark (brand/wayfinding.svg) on the left third, saved without alpha.
const FEATURE = resolve(ROOT, 'docs/store/feature-graphic.png');
const FEATURE_SIZE = { w: 1024, h: 500 };
// Disc centre at 62 % of the width and 0.45 radius below the middle: the network (northern half) is centred,
// the limb shows at the top and the sky stays free for the wordmark.
const FEATURE_VIEW = { cx: 0.62, dy: 0.45, zoom: 1.6 };
const FEATURE_MAX_BYTES = 15 * 1024 * 1024; // Play: JPEG or 24-bit PNG, ≤ 15 MB
// Google: no pure black/dark grey backgrounds. Share of dark, unsaturated pixels allowed in the whole image.
const FEATURE_DARK_MAX = 0.2;
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
    // [N12n] D-117: Play asks for an alt text with the feature graphic.
    const featureAlt = field(md, 'Play feature graphic alt text');
    if ([...featureAlt].length > 140) throw new Error(lang + ': feature graphic alt text >140 characters');
    if (/\b(?:image of|picture of|obraz|zdjęcie)\b|\b(?:free|darmow|gratis|price|cena)/i.test(featureAlt)) {
      throw new Error(lang + ': feature graphic alt text says "image of" or names a price');
    }
    const ownerTitle = lang === 'pl' ?
      'Airway: Buduj sieć lotów na globusie' : 'Airway: Globe Route Builder';
    if (approved !== ownerTitle) throw new Error(lang + ': D-18/D-203 title modified');
    // [N12ae] D-203 (Q-77 → B): the network is "sieć" in the store as in the game (D-195), never "siatka".
    if (lang === 'pl' && /siat(?:k|ce|ek)/i.test(md)) throw new Error('pl: store text says "siatka" (D-203: "sieć")');
    if ([...name].length > 30) throw new Error(lang + ': title >30 characters');
    if ([...subtitle].length > 30) throw new Error(lang + ': subtitle >30 characters');
    if ([...short].length > 80) throw new Error(lang + ': short description >80 characters');
    if ([...full].length > 4000) throw new Error(lang + ': full description >4000 characters');
    if (Buffer.byteLength(keywords, 'utf8') > 100) throw new Error(lang + ': keyword field >100 UTF-8 bytes');
    if (/mini metro|mini airways|tiny airline|fly corp/i.test(
      [name, subtitle, short, full, keywords].join(' '))) {
      throw new Error(lang + ': competitor name used');
    }
    // [N12an] R2c, D-229: App Store indexes name + subtitle + keywords together, so a keyword that repeats a word of
    // the name or subtitle (or another keyword) is wasted; commas without spaces, nothing empty, not the app name.
    const words = (text) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const indexed = new Set(words(name + ' ' + subtitle));
    const terms = keywords.split(',');
    if (terms.some((term) => !term || term !== term.trim())) throw new Error(lang + ': empty keyword or space around a comma');
    const keywordWords = terms.flatMap(words);
    const repeated = keywordWords.filter((word, i) => indexed.has(word) || keywordWords.indexOf(word) !== i);
    if (repeated.length) throw new Error(lang + ': keyword repeats the name/subtitle or another keyword: ' + repeated.join(', '));
    // [N12an] D-223: the glossary word is "hub" in the store texts too, never "terminal" (D-195).
    if (/terminal/i.test(md)) throw new Error(lang + ': store text says "terminal" (D-223: "hub")');
    // [N12an] R2c: one Play alt text per scene in store order (D-63), unique, ≤ 140 characters, no "image of".
    const alts = [...field(md, 'Play alt text').matchAll(/^(\d+)\. ([a-z]+) — (.+)$/gm)];
    if (alts.map((m) => m[2]).join() !== SCENES.join() || alts.some((m, i) => Number(m[1]) !== i + 1)) {
      throw new Error(lang + ': Play alt text lines do not follow the scenes ' + SCENES.join(', '));
    }
    if (new Set(alts.map((m) => m[3])).size !== alts.length) throw new Error(lang + ': repeated Play alt text');
    for (const [, , scene, alt] of alts) {
      if ([...alt].length > 140) throw new Error(lang + ': Play alt text ' + scene + ' >140 characters');
      if (/\b(?:image of|picture of|screenshot of|obraz|zdjęcie|zrzut)\b|\b(?:free|darmow|gratis|price|cena)/i.test(alt)) {
        throw new Error(lang + ': Play alt text ' + scene + ' says "image of" or names a price');
      }
    }
    console.log('listing ' + lang + ' name=' + [...name].length + '/30 short=' +
      [...short].length + '/80 keywords=' + Buffer.byteLength(keywords, 'utf8') + '/100bytes featureAlt=' +
      [...featureAlt].length + '/140 keywordTerms=' + terms.length + ' alts=' + alts.length);
    fields += 8;
  }
  if (new Set(SCENES).size !== SCENES.length) throw new Error('Duplicate scenes');
  if (new Set(DEVICES.map((d) => d.id)).size !== DEVICES.length) throw new Error('Duplicate devices');
  if (DEVICES[0].w * DEVICES[0].dpr !== 1080 ||
      DEVICES[0].h * DEVICES[0].dpr !== 1920) throw new Error('Invalid 9:16 phone dimensions');
  checkStoreSizes(DEVICES);
  return fields;
}

/**
 * [N12o] D-123: every console slot has a profile of an accepted size. Apple: one iPhone 6.9" and one iPad 13" profile
 * of an exact accepted size; Play: at least one 9:16 and one 16:9 profile with the short side ≥ 1080 px (the
 * large-screen and promotion requirement), every Play size within 320–3840 px and the long side ≤ 2 × the short side.
 * Returns the device count.
 */
export function checkStoreSizes(devices) {
  const px = (d) => ({ w: d.w * d.dpr, h: d.h * d.dpr });
  for (const [id, sizes] of Object.entries(APPLE_SIZES)) {
    const device = devices.find((d) => d.id === id);
    if (!device || device.store !== 'apple') throw new Error('No Apple ' + id + ' store-shot profile');
    const { w, h } = px(device);
    if (!sizes.includes(w + 'x' + h)) throw new Error('Apple ' + id + ' ' + w + 'x' + h + ' is not an accepted size');
  }
  const play = devices.filter((d) => d.store === 'play').map(px);
  for (const { w, h } of play) {
    if (Math.min(w, h) < 320 || Math.max(w, h) > 3840 || Math.max(w, h) > 2 * Math.min(w, h)) {
      throw new Error('Play screenshot ' + w + 'x' + h + ' outside 320–3840 px or 2:1');
    }
  }
  const has = (ratioW, ratioH) => play.some(({ w, h }) => w * ratioH === h * ratioW && Math.min(w, h) >= 1080);
  if (!has(9, 16)) throw new Error('No Play 9:16 profile with a short side ≥ 1080 px');
  if (!has(16, 9)) throw new Error('No Play 16:9 profile with a short side ≥ 1080 px');
  return devices.length;
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

/** [N12n] Colour type of a PNG (2 = RGB, 6 = RGBA) and its size, from IHDR. */
export function pngHeader(file) {
  const data = readFileSync(file);
  if (data.readUInt32BE(0) !== 0x89504e47 || data.toString('latin1', 12, 16) !== 'IHDR') throw new Error('Not a PNG: ' + file);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), bitDepth: data[24], colourType: data[25], bytes: data.length };
}

/** [N12n] Writes RGBA pixels as an opaque 8-bit RGB PNG (alpha dropped; the pixels are already opaque). */
export function writeRgbPng(file, width, height, rgba) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, o = y * stride + 1 + x * 3;
      raw[o] = rgba[i]; raw[o + 1] = rgba[i + 1]; raw[o + 2] = rgba[i + 2];
    }
  }
  const chunk = (kind, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0); head.write(kind, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

/**
 * [N12n] D-117 feature-graphic contract: exactly 1024×500, 8-bit RGB without alpha, ≤ 15 MB, the centre band
 * (middle third, where Play draws the video play button) carries the scene (not empty), and no large pure
 * black/dark-grey field (Google's rule). Returns the measurements.
 */
export function checkFeatureGraphic(file) {
  if (!existsSync(file)) throw new Error('Missing feature graphic ' + file + '; run npm run store:feature');
  const header = pngHeader(file);
  if (header.width !== FEATURE_SIZE.w || header.height !== FEATURE_SIZE.h) {
    throw new Error('feature graphic: ' + header.width + 'x' + header.height + ' instead of 1024x500');
  }
  if (header.colourType !== 2 || header.bitDepth !== 8) {
    throw new Error('feature graphic: PNG colour type ' + header.colourType + ' (need 8-bit RGB, no alpha)');
  }
  if (header.bytes > FEATURE_MAX_BYTES) throw new Error('feature graphic: ' + header.bytes + ' bytes > 15 MB');
  const { width, height, pixels } = readPng(file);
  let dark = 0, all = 0, n = 0, sum = 0, sq = 0;
  const buckets = new Map();
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      all++;
      if (l < 40 && Math.max(r, g, b) - Math.min(r, g, b) < 24) dark++;
      if (x >= width / 3 && x < width * 2 / 3) {
        n++; sum += l; sq += l * l;
        const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }
  }
  const mean = sum / n;
  const centre = {
    lumaStd: Math.round(Math.sqrt(Math.max(0, sq / n - mean * mean)) * 10) / 10,
    dominantShare: Math.round(Math.max(...buckets.values()) / n * 1000) / 1000,
    colours: buckets.size,
  };
  if (centre.lumaStd < 8 || centre.dominantShare > 0.85 || centre.colours < 60) {
    throw new Error('feature graphic: empty centre band (' + JSON.stringify(centre) + ')');
  }
  const darkShare = Math.round(dark / all * 1000) / 1000;
  if (darkShare > FEATURE_DARK_MAX) throw new Error('feature graphic: dark field ' + darkShare + ' > ' + FEATURE_DARK_MAX);
  return { ...centre, darkShare, bytes: header.bytes };
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
  // [N12o] Apple rejects screenshots with an alpha channel; Chromium writes opaque RGB, keep it that way.
  const header = pngHeader(file);
  if (header.colourType !== 2) throw new Error(where + ': PNG colour type ' + header.colourType + ' (need RGB, no alpha)');
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
  // [night-07p] The upgrade board and the game-over report must leave the boarding pass readable.
  const covered = await page.evaluate(() => {
    const pass = document.querySelector('.airway-pass')?.getBoundingClientRect();
    if (!pass) return '';
    const parts = document.querySelectorAll('.airway-upgrade-sign, .airway-upgrade-tag, .airway-go-sign, ' +
      '.airway-go-board, .airway-go-strip, .airway-go-button');
    for (const part of parts) {
      const r = part.getBoundingClientRect();
      if (r.width && r.left < pass.right && pass.left < r.right && r.top < pass.bottom && pass.top < r.bottom) {
        return part.className + ' at ' + Math.round(r.top) + ' px';
      }
    }
    return '';
  });
  if (covered) throw new Error('Boarding pass covered by ' + covered + ': ' + scene);
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
  // [N12o] Portrait thumbnails share one height; the 16:9 landscape row is as wide as two portrait phones.
  const thumbStyle = (device) => device.w > device.h ?
    'width:' + Math.round(thumbH * 1.1) + 'px;height:' + Math.round(thumbH * 1.1 * device.h / device.w) + 'px' :
    'width:' + Math.round(thumbH * device.w / device.h) + 'px';
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  try {
    await page.route('http://store.local/**', (route) => {
      const path = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
      return route.fulfill({ path: path.startsWith('fonts/') ? resolve(ROOT, 'public', path) : resolve(dir, path) });
    });
    const blocks = LANGUAGES.map((lang) => '<h2>' + lang.toUpperCase() + '</h2>' + DEVICES.map((device) =>
      '<div class="row"><div class="dev">' + device.id + '<br><small>' + device.w * device.dpr + '×' +
      device.h * device.dpr + '</small></div>' + SCENES.map((scene) =>
        '<figure><img style="' + thumbStyle(device) + '" src="http://store.local/' +
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
      'figure{margin:0}img{height:' + thumbH + 'px;display:block;border:1px solid #0b1312;object-fit:contain}' +
      'figcaption{font-size:12px;margin-top:4px;text-transform:uppercase;letter-spacing:.06em}</style>' +
      '<h1>Airway — store screenshots (' + EXPECTED + ')</h1>' + blocks, { waitUntil: 'load' });
    await page.evaluate(() => Promise.all([document.fonts.ready,
      ...[...document.images].map((img) => img.decode())]));
    const size = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }));
    await page.setViewportSize({ width: size.w, height: size.h });
    await page.screenshot({ path: target, fullPage: true });
  } finally { await page.close(); }
}

/**
 * [N12n] D-117: the Play feature graphic from the real `game` scene (seed 0xA1A1, English page; the image has no
 * words but the wordmark). The DOM HUD is hidden, only the globe canvas stays, and the original wayfinding sign
 * (brand/wayfinding.svg, Overpass 800) sits on the left third, clear of the centre where Play draws the video
 * play button. Captured at 1024×500 @2, downscaled in Chromium to @1 and written as opaque RGB.
 */
async function renderFeatureGraphic(browser, baseUrl, target) {
  const page = await browser.newPage({ viewport: { width: FEATURE_SIZE.w, height: FEATURE_SIZE.h },
    deviceScaleFactor: 2, locale: 'en-GB', reducedMotion: 'reduce' });
  const hi = resolve(stageDir, 'feature@2.png'), lo = resolve(stageDir, 'feature@1.png');
  let state;
  try {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = new URL(baseUrl);
    url.searchParams.set('storeShot', WARM_SCENE);
    url.searchParams.set('seed', String(SEED));
    url.searchParams.set('lang', 'en');
    await page.goto(url.href, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction((id) => document.documentElement.dataset.storeShotReady === id, WARM_SCENE,
      { timeout: 120000 }).catch(() => { throw new Error('feature graphic: scene "' + WARM_SCENE + '" never became ready'); });
    // A closer globe, slid right of the wordmark and down so the network sits in the middle of the frame.
    const framed = await page.evaluate(({ cx, dy, zoom }) => {
      const probe = window.__awWorld;
      if (!probe?.featureView) return null;
      probe.featureView(0, 0, zoom);
      const disc = probe.disc();
      if (!disc) return null;
      probe.featureView(cx * innerWidth - disc.x, innerHeight / 2 + dy * disc.radius - disc.y, zoom);
      return probe.disc();
    }, FEATURE_VIEW);
    if (!framed) throw new Error('feature graphic: DEV world probe has no featureView/disc');
    await page.evaluate(() => new Promise((done) => { let n = 20; const step = () => (--n ? requestAnimationFrame(step) : done()); requestAnimationFrame(step); }));
    const sign = readFileSync(resolve(ROOT, 'brand/wayfinding.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    await page.addStyleTag({ content: '#app *:not(canvas){visibility:hidden!important}' +
      '#aw-feature-sign{position:fixed;left:4%;top:50%;width:28%;transform:translateY(-50%);z-index:9;' +
      'pointer-events:none}#aw-feature-sign svg{display:block;width:100%;height:auto}' });
    state = await page.evaluate(async (markup) => {
      const holder = document.createElement('div');
      holder.id = 'aw-feature-sign';
      holder.innerHTML = markup;
      document.body.append(holder);
      await document.fonts.load('800 126px Overpass');
      await document.fonts.ready;
      const box = holder.getBoundingClientRect();
      return { overpass: document.fonts.check('800 126px Overpass'), signRight: box.right,
        sun: document.documentElement.dataset.storeShotSun ?? null,
        canvas: [...document.querySelectorAll('#app canvas')].some((c) => c.getBoundingClientRect().width > 500) };
    }, sign);
    if (!state.overpass) throw new Error('feature graphic: Overpass 800 not loaded for the wordmark');
    if (!state.canvas) throw new Error('feature graphic: no globe canvas');
    const disc = await page.evaluate(() => window.__awWorld?.disc?.() ?? null);
    if (!disc || disc.y - disc.radius < 0 || disc.x - disc.radius < FEATURE_SIZE.w / 3 - 120) {
      throw new Error('feature graphic: globe limb not in the frame or under the wordmark (' + JSON.stringify(disc) + ')');
    }
    if (state.signRight > FEATURE_SIZE.w / 3 + 1) throw new Error('feature graphic: wordmark leaves the left third');
    if (errors.length) throw new Error('feature graphic: browser errors: ' + errors.join('; '));
    await page.screenshot({ path: hi, animations: 'disabled', fullPage: false });
  } finally { await page.close(); }
  const down = await browser.newPage({ viewport: { width: FEATURE_SIZE.w, height: FEATURE_SIZE.h }, deviceScaleFactor: 1 });
  try {
    await down.route('http://store.local/**', (route) => route.fulfill({ path: hi }));
    await down.setContent('<!doctype html><style>html,body{margin:0;background:#888}img{display:block;width:' +
      FEATURE_SIZE.w + 'px;height:' + FEATURE_SIZE.h + 'px}</style><img src="http://store.local/hi.png">', { waitUntil: 'load' });
    await down.evaluate(() => document.images[0].decode());
    await down.screenshot({ path: lo, fullPage: false });
  } finally { await down.close(); }
  const { width, height, pixels } = readPng(lo);
  writeRgbPng(target, width, height, pixels);
  return { ...state, ...checkFeatureGraphic(target) };
}

/** `--validate`: committed PNGs, manifest and contact sheet still match the shot contract (60 since N12o). */
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
  const unknown = args.filter((arg) => arg !== '--validate' && arg !== '--feature' && !/^--(base-url|only|out)=/.test(arg));
  if (unknown.length) throw new Error('Unknown options: ' + unknown.join(', '));
  if (onlyArg && !SCENES.includes(onlyArg)) throw new Error('Unknown scene: ' + onlyArg);
  if (onlyArg && !outArg) throw new Error('--only needs --out=<dir>: a partial run never publishes');
  const fields = checkCopy();
  if (validateOnly) {
    const shots = outArg ? validateShots(resolve(outArg), resolve(outArg, 'manifest.json'),
      resolve(outArg, 'contact-sheet.png')) : validateShots();
    const feature = checkFeatureGraphic(outArg ? resolve(outArg, 'feature-graphic.png') : FEATURE);
    console.log('feature graphic 1024x500 rgb centre=' + feature.lumaStd + ' dark=' + feature.darkShare +
      ' bytes=' + feature.bytes);
    console.log('SUMMARY test:store-shots seed=0xA1A1 listings=2 fields=' + fields +
      ' scenes=' + SCENES.length + ' devices=' + DEVICES.length + ' shots=' + shots + ' feature=1 passed=1 failed=0');
  } else if (featureOnly) {
    const require = createRequire(import.meta.url);
    const { chromium } = require('playwright');
    const url = baseArg ? baseArg.slice('--base-url='.length) : await startVite();
    stageDir = mkdtempSync(join(tmpdir(), 'airway-store-feature-'));
    browser = await chromium.launch({ headless: true, args: [
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    ] });
    const target = outArg ? resolve(outArg, 'feature-graphic.png') : FEATURE;
    mkdirSync(dirname(target), { recursive: true });
    const result = await renderFeatureGraphic(browser, url, target);
    captured = 1;
    console.log('feature ' + target + ' 1024x500 rgb sun=' + result.sun + ' centre=' +
      result.lumaStd + ' colours=' + result.colours + ' dark=' + result.darkShare + ' bytes=' + result.bytes);
    console.log('SUMMARY store:feature seed=0xA1A1 captured=1 passed=1 failed=0');
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
  console.log('SUMMARY ' + (validateOnly ? 'test:store-shots' : featureOnly ? 'store:feature' : 'store:shots') +
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
