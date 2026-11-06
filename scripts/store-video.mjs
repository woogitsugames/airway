// [night-18b] R2b, D-265: store preview video from real play. The DEV autoplay bot plays seed 0xA1A1 through real
// Commands (window.aw) on the real WebGL renderer; Playwright's fake clock is paused and every video frame is one
// fixed 1/30 s step (`page.clock.runFor`), so SwiftShader speed never changes what a frame shows. CSS animations are
// paused and stepped by the same 1/30 s. Frames are piped as PNG screenshots into ffmpeg (no screen recording, no
// frames on disk) and encoded to H.264 + a silent AAC track (no music, no text added: only the game's own HUD).
//
//   npm run store:video                       # every device × PL/EN into docs/store/video/
//   npm run store:video -- --only=play --lang=en --out=/tmp/v   # one preview, outside the repo
//   npm run test:store-video                  # re-check manifest, posters and (when present) the MP4 files
//
// D-269: the MP4 files are never committed (root .gitignore: docs/store/video/**/*.mp4). They live on the owner's
// Google Drive (DRIVE below) under the names in manifest.json `videos[].drive`; upload them after every regeneration.
// manifest.json (size, SHA-256, ffprobe facts) and the poster JPEGs stay in git.
//
// Without ffmpeg on PATH the frames are written to `--frames=<dir>` (default: a temp dir) with an encode.sh.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { ROOT, SEED, launchChromium, presetLanguage, startVite } from './lib/harness.mjs';

const OUT = resolve(ROOT, 'docs/store/video');
const FPS = 30;
const FRAME_MS = 1000 / FPS;
/** Store sizes (portrait). App Store app previews: iPhone 6.9"/6.5" 886×1920, iPad 13"/12.9" 1200×1600; Play: YouTube. */
export const DEVICES = [
  { id: 'play', w: 360, h: 640, dpr: 3, store: 'Google Play (YouTube link)' }, // 1080×1920
  { id: 'iphone', w: 443, h: 960, dpr: 2, store: 'App Store Connect → iPhone 6.9" app preview' }, // 886×1920
  { id: 'ipad', w: 768, h: 1024, dpr: 1.5625, store: 'App Store Connect → iPad 13" app preview' }, // 1200×1600
];
export const PIXELS = { play: [1080, 1920], iphone: [886, 1920], ipad: [1200, 1600] };
const LANGUAGES = ['pl', 'en'];
/**
 * Storyboard (frames at 30 fps), cuts between shots; every frame is real play of the same run.
 * 1 `route` 0–4 s: first frame is the game; a finger draws the first route, its plane boards and departs (4×).
 * 2 `dusk` 4–12 s: the bot's grown network on day 2; the evening terminator crosses it (4×). Poster at 5 s.
 * 3 `crates` 12–17 s: the weekly board opens with its freight crates; one is tapped and play resumes.
 * 4 `jam` 17–24 s: the player stops building; a hub fills to its jam warning (the run is still alive at the end).
 */
export const SHOTS = [
  { id: 'route', frames: 120 },
  { id: 'dusk', frames: 240 },
  { id: 'crates', frames: 150 },
  { id: 'jam', frames: 210 },
];
export const TOTAL_FRAMES = SHOTS.reduce((sum, shot) => sum + shot.frames, 0);
export const POSTER_S = 5;
/** Day 2, 15:30 on the dial (the run starts at 02:00): the dusk shot runs into the evening over the network. */
const DUSK_START_TICK = 1440 + 13.5 * 60;
/** Fill (waiting / waiting places) of the fullest airport when the jam shot starts. */
const JAM_START_FILL = 0.8;
/** D-269: where the MP4 files live (owner's Google Drive); git keeps only the manifest and the posters. */
export const DRIVE = {
  folder: 'gry/AirWay',
  url: 'https://drive.google.com/drive/folders/1_H49bE2oZRgA10jw64t3BsghtsrfgOgm',
};
/** The name a preview carries on the Drive, e.g. airway-preview-pl-play-1080x1920.mp4. */
export function driveName(lang, device) {
  const [w, h] = PIXELS[device];
  return 'airway-preview-' + lang + '-' + device + '-' + w + 'x' + h + '.mp4';
}
/** The root .gitignore rule that keeps the MP4 files out of git (D-269). */
export const IGNORE_RULE = 'docs/store/video/**/*.mp4';
const MANIFEST_NOTE = 'MP4 files are not in git (D-269): they are on the owner\'s Google Drive (storage) under videos[].drive; ' +
  'regenerate with npm run store:video and upload them after every regeneration.';
const MANIFEST = 'manifest.json';

const args = process.argv.slice(2);
const arg = (name) => args.find((a) => a.startsWith('--' + name + '='))?.slice(name.length + 3);
const validateOnly = args.includes('--validate');
/** `--draft`: storyboard check only, at DPR 1, every 15th frame as JPEG into `--out` (no video, no manifest). */
const draft = args.includes('--draft');

/** One H.264 encode of a PNG stream on stdin (or the encode command for a frame folder). */
function ffmpegArgs(input, output) {
  return [
    '-hide_banner', '-loglevel', 'error', '-y',
    ...input, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-map', '0:v', '-map', '1:a', '-t', String(TOTAL_FRAMES / FPS),
    '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p',
    '-crf', '18', '-maxrate', '12M', '-bufsize', '24M', '-r', String(FPS), '-g', String(FPS),
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output,
  ];
}
const hasTool = (tool) => spawnSync(tool, ['-version'], { stdio: 'ignore' }).status === 0;

/** Paused CSS animations advanced by exactly one frame (new ones start at 0): motion matches the fixed game step. */
async function stepAnimations(page) {
  await page.evaluate((ms) => {
    const taken = (window.__awVideoAnimations ??= new WeakSet());
    for (const animation of document.getAnimations()) {
      if (!taken.has(animation)) {
        taken.add(animation);
        animation.pause();
        animation.currentTime = 0;
      } else if (animation.playState === 'paused') {
        animation.currentTime = Number(animation.currentTime ?? 0) + ms;
        const end = animation.effect?.getComputedTiming().endTime;
        if (typeof end === 'number' && Number.isFinite(end) && Number(animation.currentTime) >= end) animation.finish();
      }
    }
  }, FRAME_MS);
}

/** Bot play off camera: one decision every 30 ticks, until `done(state)` or `limit` ticks. */
async function botPlay(page, limit, done) {
  for (let played = 0; played < limit;) {
    const state = await page.evaluate(async (step) => {
      const aw = window.aw;
      for (let i = 0; i < 10; i++) {
        const now = aw.state();
        if (now.screen !== 'game') return now;
        await aw.botStep();
        aw.advanceTicks(step);
      }
      return aw.state();
    }, 30);
    played += 300;
    if (state.screen !== 'game' || done(state)) return state;
  }
  return page.evaluate(() => window.aw.state());
}

const fullest = (state) => Math.max(...(state.airports ?? []).map((a) => a.waiting / Math.max(1, a.capacity)));

async function centre(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error('Not on screen: ' + selector);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Plays the storyboard on one page; `emit(buffer, index)` receives every PNG frame. Returns the shot log. */
async function film(page, url, lang, emit, posterFile) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install();
  await presetLanguage(page, lang, { clear: true });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.aw?.ready === true, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  // From here on, page time moves only with the frames.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const run = (ms) => page.clock.runFor(Math.round(ms));
  let index = 0;
  const frame = async (before) => {
    if (before) await before(index);
    await run(FRAME_MS);
    await stepAnimations(page);
    const png = await page.screenshot({ type: 'png', timeout: 180000 });
    if (index === POSTER_S * FPS && posterFile) {
      await page.screenshot({ path: posterFile, type: 'jpeg', quality: 92, timeout: 180000 });
    }
    await emit(png, index++);
  };
  const untilScreen = async (screen) => {
    for (let i = 0; i < 300; i++) {
      if ((await page.evaluate(() => window.aw.state().screen)) === screen) return;
      await run(FRAME_MS);
      await stepAnimations(page);
    }
    throw new Error('Screen "' + screen + '" not reached');
  };
  const tap = async (point) => { await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.up(); };
  const log = [];

  // Shot 1: a fresh run on 0xA1A1, 4× speed set on the dock before the first frame.
  await page.evaluate((seed) => window.aw.prepareSeed(seed), SEED);
  await tap(await centre(page, '[data-testid="menu-endless"]'));
  await untilScreen('game');
  const settle = async (n) => { for (let i = 0; i < n; i++) { await run(FRAME_MS); await stepAnimations(page); } };
  await settle(20); // framing settles
  const speed = await centre(page, '[data-hud-action="speed"]');
  await tap(speed); await settle(1); await tap(speed); await settle(1);
  const gesture = await page.evaluate(() => window.aw.gesture('route'));
  const DRAG = { start: 2, end: 22 };
  const startRoute = (await page.evaluate(() => window.aw.state())).routeCount;
  for (let f = 0; f < SHOTS[0].frames; f++) {
    await frame(async () => {
      if (f < DRAG.start || f > DRAG.end) return;
      const k = (f - DRAG.start) / (DRAG.end - DRAG.start);
      const ease = k * k * (3 - 2 * k);
      const x = gesture.from.x + (gesture.to.x - gesture.from.x) * ease;
      const y = gesture.from.y + (gesture.to.y - gesture.from.y) * ease;
      if (f === DRAG.start) { await page.mouse.move(x, y); await page.mouse.down(); }
      else await page.mouse.move(x, y);
      if (f === DRAG.end) await page.mouse.up();
    });
  }
  let state = await page.evaluate(() => window.aw.state());
  if (state.routeCount !== startRoute + 1) throw new Error('The drawn route was not built (routes ' + state.routeCount + ')');
  log.push({ shot: 'route', tick: state.tick, routes: state.routeCount });

  // Shot 2: the bot grows the network off camera, then plays on camera while dusk crosses it.
  state = await botPlay(page, 6000, (s) => s.tick >= DUSK_START_TICK - 300);
  await page.evaluate((ticks) => window.aw.advanceTicks(Math.max(0, ticks)), DUSK_START_TICK - state.tick);
  state = await page.evaluate(() => window.aw.state());
  if (state.screen !== 'game') throw new Error('Dusk shot: run is on "' + state.screen + '" at tick ' + state.tick);
  const duskTick = state.tick;
  for (let f = 0; f < SHOTS[1].frames; f++) {
    await frame(async () => { if (f % 8 === 0) await page.evaluate(() => window.aw.botStep()); });
  }
  state = await page.evaluate(() => window.aw.state());
  log.push({ shot: 'dusk', fromTick: duskTick, tick: state.tick, routes: state.routeCount });

  // Shot 3: the weekly board with its crates; a crate that needs no airport pick is tapped after 2.5 s.
  state = await page.evaluate(() => window.aw.autoplay(1));
  if (state.screen !== 'upgrade') throw new Error('Crates shot: autoplay ended on "' + state.screen + '"');
  const boardTick = state.tick;
  let picked = null;
  for (let f = 0; f < SHOTS[2].frames; f++) {
    await frame(async () => {
      if (f !== 75) return;
      picked = await page.evaluate(() => document.querySelector('[data-testid^="upgrade-option-"]' +
        ':not([data-upgrade="hub-expansion"]):not([data-upgrade="departure-slots"]):not(:disabled)')
        ?.getAttribute('data-upgrade') ?? null);
      if (!picked) throw new Error('No crate completes without an airport pick');
      await tap(await centre(page, '[data-upgrade="' + picked + '"]'));
    });
  }
  state = await page.evaluate(() => window.aw.state());
  if (state.screen !== 'game') throw new Error('Crates shot: board still open after the tap');
  log.push({ shot: 'crates', boardTick, picked, tick: state.tick });

  // Shot 4: no more building; real demand fills a hub to its warning, filmed until the end (never game over).
  for (let i = 0; i < 400 && state.screen === 'game' && fullest(state) < JAM_START_FILL; i++) {
    await page.evaluate(() => window.aw.advanceTicks(10));
    state = await page.evaluate(() => window.aw.state());
  }
  if (state.screen !== 'game') throw new Error('Jam shot: run ended before the shot (' + state.screen + ')');
  const jamTick = state.tick, jamFill = fullest(state);
  const jamAirport = [...state.airports].sort((a, b) => b.waiting / b.capacity - a.waiting / a.capacity)[0].id;
  let focused = false;
  for (let f = 0; f < SHOTS[3].frames; f++) {
    await frame(async () => {
      if (f !== 20) return;
      // Off screen, the filling airport is an edge chip: tap it like a player and the camera turns to it.
      const chip = await page.evaluate((id) => {
        let node = document.querySelector('.airport-bubble[data-airport="' + CSS.escape(id) + '"]');
        while (node && !node.classList.contains('airport-edge')) node = node.nextElementSibling;
        if (!node || node.hidden) return null;
        const box = node.getBoundingClientRect();
        return box.width ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
      }, jamAirport);
      if (chip) { await tap(chip); focused = true; }
    });
  }
  state = await page.evaluate(() => window.aw.state());
  log.push({ shot: 'jam', airport: jamAirport, focused, fromTick: jamTick, fromFill: Math.round(jamFill * 100) / 100, tick: state.tick,
    fill: Math.round(fullest(state) * 100) / 100, screen: state.screen });
  if (state.screen !== 'game') throw new Error('Jam shot ended on "' + state.screen + '" (want a hub near jam, not game over)');
  if (index !== TOTAL_FRAMES) throw new Error('Filmed ' + index + ' frames, expected ' + TOTAL_FRAMES);
  if (errors.length) throw new Error('Browser errors: ' + errors.join('; '));
  const text = await page.evaluate(() => document.body.innerText);
  if (/\b(?:undefined|NaN|DEV|debug)\b|\{[A-Za-z]+\}/.test(text)) throw new Error('Developer text on screen: ' + text.slice(0, 200));
  return log;
}

function sha256(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }

/** ffprobe facts of an MP4: codec, size, fps, duration, audio. */
export function probe(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries',
    'stream=codec_type,codec_name,profile,width,height,pix_fmt,avg_frame_rate,channels,sample_rate:format=duration',
    '-of', 'json', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('ffprobe failed on ' + file + ': ' + result.stderr);
  const json = JSON.parse(result.stdout);
  const video = json.streams.find((s) => s.codec_type === 'video');
  const audio = json.streams.find((s) => s.codec_type === 'audio');
  const [n, d] = String(video?.avg_frame_rate ?? '0/1').split('/').map(Number);
  return {
    codec: video?.codec_name, profile: video?.profile, width: video?.width, height: video?.height,
    pixFmt: video?.pix_fmt, fps: Math.round((n / (d || 1)) * 100) / 100,
    durationS: Math.round(Number(json.format.duration) * 100) / 100,
    audio: audio ? { codec: audio.codec_name, channels: audio.channels, sampleRate: Number(audio.sample_rate) } : null,
  };
}

/** Store rules for one probed file (Apple app previews: H.264, ≤ 30 fps, 15–30 s; ours: 20–28 s, exact size). */
export function checkProbe(device, facts) {
  const [w, h] = PIXELS[device];
  const problems = [];
  if (facts.codec !== 'h264') problems.push('codec ' + facts.codec);
  if (facts.width !== w || facts.height !== h) problems.push(facts.width + 'x' + facts.height + ' (want ' + w + 'x' + h + ')');
  if (facts.pixFmt !== 'yuv420p') problems.push('pixel format ' + facts.pixFmt);
  if (facts.fps !== FPS) problems.push(facts.fps + ' fps');
  if (!(facts.durationS >= 20 && facts.durationS <= 28)) problems.push('duration ' + facts.durationS + ' s');
  if (!facts.audio || facts.audio.codec !== 'aac' || facts.audio.channels !== 2) problems.push('no stereo AAC track');
  return problems;
}

/** JPEG size from its SOF marker. */
export function jpegSize(file) {
  const data = readFileSync(file);
  if (data[0] !== 0xff || data[1] !== 0xd8) throw new Error('Not a JPEG: ' + file);
  for (let i = 2; i < data.length;) {
    if (data[i] !== 0xff) { i++; continue; }
    const marker = data[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return { width: data.readUInt16BE(i + 7), height: data.readUInt16BE(i + 5) };
    i += 2 + data.readUInt16BE(i + 2);
  }
  throw new Error('No JPEG frame header: ' + file);
}

/** Git's view of the MP4 files under the output dir: tracked paths, or null when git is unavailable. */
function trackedVideos(dir) {
  const result = spawnSync('git', ['ls-files', '--', '*.mp4'], { cwd: dir, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split('\n').filter(Boolean) : null;
}

/** Re-checks the manifest, the posters and every MP4 that is present (they are git-ignored and usually absent, D-269). */
export function validate(dir = OUT) {
  const file = join(dir, MANIFEST);
  if (!existsSync(file)) throw new Error('Missing ' + relative(ROOT, file) + '; run npm run store:video');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  if (manifest.seed !== '0xA1A1' || manifest.fps !== FPS || manifest.frames !== TOTAL_FRAMES) {
    throw new Error('Manifest seed/fps/frames differ from the script');
  }
  if (manifest.posterS !== POSTER_S) throw new Error('Manifest poster time ' + manifest.posterS + ' s');
  if (manifest.storage?.url !== DRIVE.url || manifest.storage?.folder !== DRIVE.folder) {
    throw new Error('Manifest storage is not the Drive folder of D-269 (' + DRIVE.url + ')');
  }
  if (dir === OUT) {
    const rules = readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n').map((line) => line.trim());
    if (!rules.includes(IGNORE_RULE)) throw new Error('.gitignore misses ' + IGNORE_RULE + ' (D-269)');
    const tracked = trackedVideos(dir);
    if (tracked?.length) throw new Error('MP4 files tracked by git (D-269 keeps them on the Drive): ' + tracked.join(', '));
  }
  if (existsSync(join(dir, '.gitignore'))) throw new Error('Stale ' + relative(ROOT, join(dir, '.gitignore')) + ' (D-269 uses the root .gitignore)');
  const want = LANGUAGES.flatMap((lang) => DEVICES.map((d) => lang + '/' + d.id));
  const have = manifest.videos.map((v) => v.lang + '/' + v.device);
  if (have.join() !== want.join()) throw new Error('Manifest lists ' + have.join(', ') + '; want ' + want.join(', '));
  let probed = 0, absent = 0;
  for (const video of manifest.videos) {
    const problems = checkProbe(video.device, video.probe);
    if (problems.length) throw new Error(video.file + ': ' + problems.join('; '));
    if (video.shots.at(-1)?.screen !== 'game') throw new Error(video.file + ': the jam shot ends on game over');
    const poster = join(dir, video.poster);
    if (!existsSync(poster)) throw new Error('Missing poster ' + video.poster);
    const size = jpegSize(poster);
    if (size.width !== video.probe.width || size.height !== video.probe.height) throw new Error(video.poster + ': wrong size');
    if (video.drive !== driveName(video.lang, video.device)) throw new Error(video.file + ': Drive name ' + video.drive + ', want ' + driveName(video.lang, video.device));
    if (!(video.bytes > 0) || !/^[0-9a-f]{64}$/.test(video.sha256 ?? '')) throw new Error(video.file + ': size or SHA-256 missing');
    const path = join(dir, video.file);
    if (!existsSync(path)) { absent++; continue; }
    if (statSync(path).size !== video.bytes || sha256(path) !== video.sha256) throw new Error(video.file + ': differs from the manifest');
    if (hasTool('ffprobe')) {
      const live = checkProbe(video.device, probe(path));
      if (live.length) throw new Error(video.file + ' (ffprobe): ' + live.join('; '));
      probed++;
    }
  }
  return { videos: manifest.videos.length, probed, absent };
}

async function main() {
  if (validateOnly) {
    const result = validate(resolve(arg('out') ?? OUT));
    console.log('SUMMARY test:store-video seed=0xA1A1 videos=' + result.videos + ' probed=' + result.probed +
      ' absent=' + result.absent + ' passed=1 failed=0');
    return;
  }
  const only = arg('only')?.split(',') ?? DEVICES.map((d) => d.id);
  const langs = arg('lang')?.split(',') ?? LANGUAGES;
  const devices = DEVICES.filter((d) => only.includes(d.id));
  const out = resolve(arg('out') ?? OUT);
  const full = devices.length === DEVICES.length && langs.length === LANGUAGES.length;
  if (draft) {
    mkdirSync(out, { recursive: true });
    const host = await startVite();
    const browser = await launchChromium();
    try {
      for (const lang of langs) for (const device of devices) {
        const page = await browser.newPage({ viewport: { width: device.w, height: device.h }, deviceScaleFactor: 1,
          hasTouch: true, reducedMotion: 'no-preference', locale: lang === 'pl' ? 'pl-PL' : 'en-US' });
        const shots = await film(page, host.url, lang, (png, i) => {
          if (i % 15 === 0) writeFileSync(join(out, lang + '-' + device.id + '-' + String(i).padStart(3, '0') + '.png'), png);
        }, null);
        await page.close();
        console.log(lang + '/' + device.id + ' ' + JSON.stringify(shots));
      }
    } finally { await browser.close(); await host.stop(); }
    return;
  }
  const ffmpeg = hasTool('ffmpeg');
  const framesRoot = ffmpeg ? null : resolve(arg('frames') ?? mkdtempSync(join(tmpdir(), 'airway-video-')));
  if (!ffmpeg) console.warn('ffmpeg not found: writing PNG frames + encode.sh under ' + framesRoot);
  const stage = mkdtempSync(join(tmpdir(), 'airway-video-stage-'));
  const host = await startVite();
  const browser = await launchChromium();
  const videos = [];
  const started = Date.now();
  try {
    const jobs = langs.flatMap((lang) => devices.map((device) => ({ lang, device })));
    const worker = async () => {
      for (let job = jobs.shift(); job; job = jobs.shift()) {
        const { lang, device } = job;
        mkdirSync(join(stage, lang), { recursive: true });
        const file = lang + '/preview-' + device.id + '.mp4';
        const poster = lang + '/poster-' + device.id + '.jpg';
        const page = await browser.newPage({ viewport: { width: device.w, height: device.h },
          deviceScaleFactor: device.dpr, hasTouch: true, reducedMotion: 'no-preference',
          locale: lang === 'pl' ? 'pl-PL' : 'en-US' });
        const t0 = Date.now();
        let shots;
        try {
          if (ffmpeg) {
            const encoder = spawn('ffmpeg', ffmpegArgs(['-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', '-'],
              join(stage, file)), { stdio: ['pipe', 'inherit', 'inherit'] });
            const exited = once(encoder, 'exit');
            shots = await film(page, host.url, lang, async (png) => {
              if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
            }, join(stage, poster));
            encoder.stdin.end();
            const [code] = await exited;
            if (code !== 0) throw new Error('ffmpeg exited with ' + code + ' for ' + file);
          } else {
            const dir = join(framesRoot, lang, device.id);
            mkdirSync(dir, { recursive: true });
            shots = await film(page, host.url, lang, (png, i) => writeFileSync(join(dir, String(i).padStart(4, '0') + '.png'), png),
              join(stage, poster));
            writeFileSync(join(dir, 'encode.sh'), '#!/bin/sh\nffmpeg ' + ffmpegArgs(['-framerate', String(FPS), '-i', '%04d.png'],
              'preview-' + device.id + '.mp4').map((a) => (/[\s"'|;&<>*?()]/.test(a) ? "'" + a + "'" : a)).join(' ') + '\n');
            console.log('frames ' + dir + ' (encode with: sh encode.sh)');
            continue;
          }
        } finally { await page.close(); }
        const facts = probe(join(stage, file));
        const problems = checkProbe(device.id, facts);
        if (problems.length) throw new Error(file + ': ' + problems.join('; '));
        const bytes = statSync(join(stage, file)).size;
        videos.push({ lang, device: device.id, store: device.store, file, drive: driveName(lang, device.id), poster, bytes,
          sha256: sha256(join(stage, file)), probe: facts, shots });
        console.log('video ' + file + ' ' + facts.width + 'x' + facts.height + ' ' + facts.durationS + ' s ' +
          (bytes / 1048576).toFixed(1) + ' MB in ' + Math.round((Date.now() - t0) / 1000) + ' s');
      }
    };
    // Two pages at a time (`--jobs=N`); each page has its own paused clock, so frames never depend on the load.
    await Promise.all(Array.from({ length: Math.max(1, Number(arg('jobs') ?? 2)) }, worker));
    const order = (v) => LANGUAGES.indexOf(v.lang) * DEVICES.length + DEVICES.findIndex((d) => d.id === v.device);
    videos.sort((a, b) => order(a) - order(b));
  } finally {
    await browser.close();
    await host.stop();
  }
  if (!ffmpeg) { rmSync(stage, { recursive: true, force: true }); process.exitCode = 2; return; }
  // Install only after every requested preview succeeded.
  for (const video of videos) {
    for (const name of [video.file, video.poster]) {
      mkdirSync(join(out, video.lang), { recursive: true });
      rmSync(join(out, name), { force: true });
      renameSync(join(stage, name), join(out, name));
    }
  }
  rmSync(stage, { recursive: true, force: true });
  if (full) {
    const manifest = {
      generator: 'scripts/store-video.mjs', seed: '0xA1A1', fps: FPS, frames: TOTAL_FRAMES, durationS: TOTAL_FRAMES / FPS,
      posterS: POSTER_S, storyboard: SHOTS, audio: 'silent stereo AAC (no music, no game audio)',
      note: MANIFEST_NOTE, storage: DRIVE,
      videos,
    };
    writeFileSync(join(out, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
    rmSync(join(out, '.gitignore'), { force: true }); // the pre-D-269 per-folder ignore file
    validate(out);
    console.log('Upload the MP4 files to ' + DRIVE.url + ' (Drive "' + DRIVE.folder + '") as: ' +
      videos.map((v) => v.file + ' → ' + v.drive).join(', '));
  }
  console.log('SUMMARY store:video seed=0xA1A1 videos=' + videos.length + ' frames=' + TOTAL_FRAMES + ' fps=' + FPS +
    ' durationS=' + Math.round((Date.now() - started) / 1000) + ' passed=1 failed=0');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  console.log('SUMMARY store:video seed=0xA1A1 passed=0 failed=1');
  process.exitCode = 1;
});
