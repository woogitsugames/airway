// [night-03] Offline render of three 30 s previews of the real Web Audio engine (OfflineAudioContext in
// headless Chromium) into docs/audio/, plus mix checks: no NaN, peak <= -1 dBFS (limiter), audible RMS.
// `npm run audio:previews` writes the WAVs; `npm run test:audio-render` only checks (no files written).
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChromium } from './lib/harness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WRITE = !process.argv.includes('--check');
const SAMPLE_RATE = 22050;
const SECONDS = 30;
const PEAK_LIMIT = 0.891; // -1 dBFS

/** Deterministic xorshift for event timing; presentation only. */
function rng(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
}
const HUBS = {
  LON: [51.5, 'EUN'], PAR: [48.9, 'EUN'], FRA: [50.1, 'EUN'], MAD: [40.4, 'EUS'], ROM: [41.9, 'EUS'],
  CAI: [30.0, 'ME'], DXB: [25.2, 'ME'], ACC: [5.6, 'AFR'], NBO: [-1.3, 'AFR'], SIN: [1.3, 'ASI'], TYO: [35.7, 'ASI'],
  SYD: [-33.9, 'OCE'], GRU: [-23.6, 'SAM'], NYC: [40.7, 'NAM'],
};
const hub = (id, extra = {}) => ({ hubId: id, latitude: HUBS[id][0], regionId: HUBS[id][1], ...extra });

function traffic(random, ids, from, to, every, out, extra = () => ({})) {
  for (let at = from; at < to; at += every * (0.6 + random() * 0.8)) {
    const id = ids[Math.floor(random() * ids.length)];
    const type = random() < 0.3 ? 'transfer' : 'arrival';
    out.push({ at, cue: { type, tick: 0, ...hub(id, { capacity: 36 + Math.floor(random() * 60), ...extra(at) }) } });
  }
}

const SCENES = [
  { file: 'preview-1-calm-europe.wav', title: 'Calm morning in Europe: arrivals, transfers, dawn bloom, route tags, surge notice at 10 s',
    cues: (() => {
      const r = rng(0xA1A1); const out = [];
      out.push({ at: 1.2, cue: { type: 'dawn', tick: 0, ...hub('FRA') } });
      traffic(r, ['LON', 'PAR', 'FRA', 'MAD', 'ROM'], 2.5, 29, 0.9, out);
      for (const at of [6, 14.5, 22]) out.push({ at, cue: { type: 'tag' } });
      out.push({ at: 18, cue: { type: 'new-city', tick: 0, latitude: 52.2, regionId: 'EUN' } });
      out.push({ at: 26, cue: { type: 'stamp' } });
      out.push({ at: 10, cue: { type: 'surge-notice' } }); // [night-35a] D-272: the first surge announcement
      return out;
    })() },
  { file: 'preview-2-hub-tension.wav', title: 'Frankfurt fills up: load drone and beating from 60 % to 100 %, slot waits, relief',
    cues: (() => {
      const r = rng(0xB2B2); const out = [];
      traffic(r, ['FRA', 'LON', 'PAR', 'CAI'], 0.5, 29.5, 0.55, out, (at) => ({ loadRatio: at < 24 ? 0.6 + 0.4 * at / 24 : 0.5 }));
      for (let at = 1; at < 24; at += 1) out.push({ at, cue: { type: 'hub-load', tick: 0, ...hub('FRA', { loadRatio: Math.min(1, 0.6 + 0.4 * at / 23) }) } });
      for (const at of [9, 15, 19, 22]) out.push({ at, cue: { type: 'slot-wait' } });
      out.push({ at: 24.5, cue: { type: 'tag' } });
      out.push({ at: 25, cue: { type: 'hub-load', tick: 0, ...hub('FRA', { loadRatio: 0.3 }) } });
      return out;
    })() },
  { file: 'preview-3-week-turn.wav', title: 'A network across regions; the week turns (key change) and dawn reaches Asia',
    cues: (() => {
      const r = rng(0xC3C3); const out = [];
      traffic(r, ['DXB', 'SIN', 'SYD', 'ACC', 'NBO', 'GRU', 'NYC'], 0.5, 11, 0.7, out);
      out.push({ at: 11.5, cue: { type: 'week', tick: 0, week: 2 } });
      out.push({ at: 13.3, cue: { type: 'stamp' } });
      traffic(r, ['DXB', 'SIN', 'SYD', 'ACC', 'NBO', 'GRU', 'NYC', 'TYO'], 14, 29.5, 0.7, out);
      out.push({ at: 19, cue: { type: 'dawn', tick: 0, ...hub('TYO') } });
      out.push({ at: 24, cue: { type: 'new-city', tick: 0, latitude: -36.8, regionId: 'OCE' } });
      return out;
    })() },
  { file: null, title: 'Check only: 4x burst, 160 arrivals in 2 s at four loaded hubs plus UI effects (limiter)',
    cues: (() => {
      const r = rng(0xD4D4); const out = [];
      for (let i = 0; i < 160; i++) out.push({ at: 1 + i / 80, cue: { type: 'arrival', tick: 0, ...hub(['FRA', 'DXB', 'SIN', 'NYC'][i % 4], { loadRatio: 0.95, capacity: 120 }) } });
      for (const id of ['FRA', 'DXB', 'SIN', 'NYC']) out.push({ at: 0.5, cue: { type: 'hub-load', tick: 0, ...hub(id, { loadRatio: 1 }) } });
      for (const at of [1.2, 1.5, 1.8]) out.push({ at, cue: { type: 'stamp' } }, { at: at + 0.05, cue: { type: 'tag' } });
      out.push({ at: 1.6, cue: { type: 'surge-notice' } }); // [night-35a] D-272
      out.push({ at: 2, cue: { type: 'week', tick: 0, week: 3 } });
      void r;
      return out;
    })() },
];
// Week cues must reach the engine in time order.
for (const scene of SCENES) scene.cues.sort((a, b) => a.at - b.at);

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24); header.writeUInt32LE(SAMPLE_RATE * 2, 28); header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const bundle = await build({
  entryPoints: [resolve(ROOT, 'scripts/audio/offline-entry.ts')], bundle: true, write: false, format: 'iife',
  platform: 'browser', target: 'es2022', logLevel: 'silent',
});
const browser = await loadChromium().launch(); // [night-52a] ESM 'playwright' ignores NODE_PATH; the harness resolves it
const page = await browser.newPage();
await page.setContent('<!doctype html><title>audio</title>');
await page.addScriptTag({ content: bundle.outputFiles[0].text });
let failed = 0;
const notes = [];
if (WRITE) mkdirSync(resolve(ROOT, 'docs/audio'), { recursive: true });
for (const scene of SCENES) {
  const samples = await page.evaluate(([cues, seconds, rate]) => globalThis.renderAirwayPreview(cues, seconds, rate),
    [scene.cues, SECONDS, SAMPLE_RATE]);
  let peak = 0; let sum = 0; let nan = 0;
  for (const value of samples) { if (!Number.isFinite(value)) nan++; else { peak = Math.max(peak, Math.abs(value)); sum += value * value; } }
  const rms = Math.sqrt(sum / samples.length);
  const peakDb = 20 * Math.log10(Math.max(peak, 1e-9));
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-9));
  const ok = nan === 0 && peak <= PEAK_LIMIT && rmsDb > -40;
  if (!ok) { failed++; console.error(`FAIL ${scene.file ?? 'burst'}: nan=${nan} peak=${peakDb.toFixed(1)} dBFS rms=${rmsDb.toFixed(1)} dBFS`); }
  notes.push(`${scene.file ? scene.file.slice(8, 9) : 'burst'}:peak${peakDb.toFixed(1)}:rms${rmsDb.toFixed(1)}`);
  if (WRITE && scene.file) writeFileSync(resolve(ROOT, 'docs/audio', scene.file), wav(samples));
  console.log(`${scene.file ?? 'burst'} — ${scene.title} — peak ${peakDb.toFixed(1)} dBFS, RMS ${rmsDb.toFixed(1)} dBFS`);
}
await browser.close();
console.log(`SUMMARY test:audio-render seed=0xA1A1 scenes=${SCENES.length} seconds=${SECONDS} rate=${SAMPLE_RATE} passed=${SCENES.length - failed} failed=${failed} ${notes.join(' ')}`);
if (failed) process.exitCode = 1;
