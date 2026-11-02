// [task-19] Portable 30 s sound-design sketch; not an AudioContext capture.
// Uses the same pitch and beat mapping as the engine, but approximates its
// envelopes/filters in offline PCM. No samples, downloads or dependencies.
import { writeFileSync } from 'node:fs';
import { latitudeToHz, stressBeatHz } from './pitch.ts';

const SAMPLE_RATE = 22050;
const SECONDS = 30;
const frames = SAMPLE_RATE * SECONDS;
const audio = new Float32Array(frames);
const TAU = Math.PI * 2;
let noiseState = 0x19A0D10;

function noise() {
  noiseState ^= noiseState << 13;
  noiseState ^= noiseState >>> 17;
  noiseState ^= noiseState << 5;
  return (noiseState >>> 0) / 0x80000000 - 1;
}
function tone(start, duration, frequency, peak, waveform = 'sine') {
  const from = Math.floor(start * SAMPLE_RATE);
  const count = Math.min(Math.ceil(duration * SAMPLE_RATE), frames - from);
  const attack = Math.max(1, Math.ceil(0.007 * SAMPLE_RATE));
  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    const phase = (t * frequency) % 1;
    const oscillator = waveform === 'triangle' ? 4 * Math.abs(phase - 0.5) - 1 :
      Math.sin(TAU * phase);
    const envelope = Math.min(1, i / attack) * Math.exp(-4.2 * i / count);
    audio[from + i] += peak * oscillator * envelope;
  }
}
function rustle(start, duration, peak, cutoff = 2200) {
  const from = Math.floor(start * SAMPLE_RATE);
  const count = Math.min(Math.ceil(duration * SAMPLE_RATE), frames - from);
  const alpha = Math.min(1, TAU * cutoff / SAMPLE_RATE);
  let smoothed = 0;
  for (let i = 0; i < count; i++) {
    smoothed += alpha * (noise() - smoothed);
    const envelope = Math.sin(Math.PI * i / count) ** 2;
    audio[from + i] += peak * smoothed * envelope;
  }
}
function arrival(when, latitude, week = 1) {
  tone(when, 0.66, latitudeToHz(latitude, week), 0.20, 'triangle');
}
function transfer(when, latitude, week = 1) {
  tone(when, 0.25, latitudeToHz(latitude, week), 0.14);
}
function chord(when, latitude, week = 1) {
  const base = latitudeToHz(latitude, week);
  for (const factor of [1, 5 / 4, 3 / 2]) tone(when, 1.5, base * factor, 0.085);
}

// Sparse global arrivals give way to congestion and a 6 Hz stress beat.
for (let i = 0; i < 8; i++) {
  const latitude = [50.9, 40.7, 6.5, -33.9, 35.7][i % 5];
  arrival(0.7 + i * 0.88, latitude);
  if (i % 2 === 0) transfer(1.07 + i * 0.88, latitude);
}
const stressed = latitudeToHz(50.9, 1);
for (let i = 0; i < 7; i++) {
  const ratio = 0.75 + 0.25 * i / 6;
  const beat = stressBeatHz(ratio);
  const t = 8.1 + i * 0.9;
  tone(t, 1.1, stressed, 0.065);
  tone(t, 1.1, stressed + beat, 0.065);
  arrival(t + 0.16, 50.9);
}
// Night: a softer, darker lower-register note before dawn's chord bloom.
for (const t of [15.0, 16.3, 17.6, 18.8]) {
  tone(t, 0.9, latitudeToHz(50.9) / 2, 0.07);
}
chord(20.2, 50.9);
chord(22.0, 50.9, 2); // Week advances a fifth.
// Split-flap, paper label, luggage tag, stamp and a new-city bell.
tone(24.0, 0.10, 190, 0.26, 'triangle');
rustle(25.0, 0.27, 0.14);
tone(26.0, 0.21, 740, 0.14, 'triangle');
tone(26.0, 0.21, 1110, 0.10);
tone(27.0, 0.18, 105, 0.22, 'triangle');
rustle(27.0, 0.17, 0.12, 750);
tone(28.1, 1.3, latitudeToHz(6.5, 2) * 2, 0.15);
tone(28.1, 1.3, latitudeToHz(6.5, 2) * 4.02, 0.08);

const bytes = Buffer.allocUnsafe(44 + frames * 2);
bytes.write('RIFF', 0);
bytes.writeUInt32LE(bytes.length - 8, 4);
bytes.write('WAVEfmt ', 8);
bytes.writeUInt32LE(16, 16);
bytes.writeUInt16LE(1, 20); // PCM
bytes.writeUInt16LE(1, 22); // mono
bytes.writeUInt32LE(SAMPLE_RATE, 24);
bytes.writeUInt32LE(SAMPLE_RATE * 2, 28);
bytes.writeUInt16LE(2, 32);
bytes.writeUInt16LE(16, 34);
bytes.write('data', 36);
bytes.writeUInt32LE(frames * 2, 40);
for (let i = 0; i < frames; i++) {
  bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, audio[i])) * 32767), 44 + 2 * i);
}
const output = process.argv[2] ?? 'audio-demo.wav';
writeFileSync(output, bytes);
console.log('SUMMARY audio:demo seed=0x19A0D10 seconds=30 samples=' + frames +
  ' file=' + output + ' (illustrative PCM, not Web Audio capture)');
