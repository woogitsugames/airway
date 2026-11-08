import assert from 'node:assert/strict';
import { AudioScheduler, bootAudio, audioSettingsFromToggles, DEFAULT_AUDIO_SETTINGS } from '../src/audio/index.ts';

const SEED = '0xA1A1';
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}`, error); }
}
class Param {
  value = 0;
  setValueAtTime(v) { this.value = v; return this; }
  linearRampToValueAtTime(v) { this.value = v; return this; }
  exponentialRampToValueAtTime(v) { this.value = v; return this; }
  setTargetAtTime(v) { this.value = v; return this; }
  cancelScheduledValues() { return this; }
}
class FakeNode {
  gain = new Param(); frequency = new Param(); detune = new Param(); Q = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  type = ''; buffer = null; onended = null; stopped = false;
  connect(to) { return to; } disconnect() {} start() {} stop() { this.stopped = true; }
}
const contexts = [];
class FakeContext {
  state = 'suspended'; currentTime = 0; sampleRate = 48000; destination = new FakeNode(); onstatechange = null;
  oscillators = [];
  constructor() { contexts.push(this); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createOscillator() { const n = new FakeNode(); this.oscillators.push(n); return n; }
  createBufferSource() { return new FakeNode(); }
  createBuffer(_channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
}
globalThis.AudioContext = FakeContext; globalThis.GainNode = FakeNode;
// Intervals are controlled manually; no browser, hardware or Web Audio implementation is used.
let nextInterval = 1;
const intervals = new Map();
globalThis.window = { setInterval: fn => { const id = nextInterval++; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id) };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const cue = tick => ({ type: 'arrival', tick, hubId: 'BRU', latitude: 50 });

await test('toggle mapping covers all sound and music combinations', () => {
  for (const sound of [false, true]) for (const music of [false, true]) {
    const settings = audioSettingsFromToggles({ sound, music, playInSilentMode: true });
    assert.equal(settings.muted, !sound && !music);
    assert.equal(settings.effectsVolume, sound ? DEFAULT_AUDIO_SETTINGS.effectsVolume : 0);
    assert.equal(settings.musicVolume, music ? DEFAULT_AUDIO_SETTINGS.musicVolume : 0);
    assert.equal(settings.playInSilentMode, true);
  }
});
await test('boot defers context until gesture and disposes stream and listeners', async () => {
  let listener, unsubscribed = 0;
  const target = new EventTarget();
  const cues = { subscribe(fn) { listener = fn; return () => { unsubscribed++; listener = null; }; } };
  const count = contexts.length;
  const { audio, dispose } = bootAudio({ toggles: { sound: true, music: false }, gestureTarget: target, cues });
  try {
    assert.equal(contexts.length, count);
    assert.equal(audio.status.musicVolume, 0);
    assert.equal(audio.status.effectsVolume, DEFAULT_AUDIO_SETTINGS.effectsVolume);
    assert.equal(audio.status.waitingForGesture, true);
    listener(cue(0));
    assert.equal(audio.schedulerStats.pending, 0);
    target.dispatchEvent(new Event('pointerup'));
    await flush();
    assert.equal(contexts.length, count + 1);
    assert.equal(audio.unlocked, true);
    assert.equal(audio.status.waitingForGesture, false);
    listener(cue(0));
    assert.equal(audio.schedulerStats.pending, 1);
    audio.setSettings({ muted: true });
    assert.equal(audio.schedulerStats.pending, 0);
    listener(cue(0));
    assert.equal(audio.schedulerStats.pending, 0);
    audio.setSettings({ muted: false });
    listener(cue(0));
    assert.equal(audio.schedulerStats.pending, 1);
    const ctx = contexts.at(-1);
    ctx.currentTime = .01;
    for (const fn of intervals.values()) fn();
    assert.equal(audio.schedulerStats.scheduled, 1);
    assert.ok(ctx.oscillators.length > 0);
    audio.setSettings({ muted: true });
    assert.ok(ctx.oscillators.every(n => n.stopped));
    await dispose();
    assert.equal(unsubscribed, 1);
    assert.equal(ctx.state, 'closed');
    assert.equal(intervals.size, 0);
    target.dispatchEvent(new Event('pointerup'));
    await flush();
    assert.equal(contexts.length, count + 1);
  } finally { if (listener) await dispose(); }
});
await test('boot with no stream handles muted toggles and cleanup without gesture', async () => {
  const target = new EventTarget();
  const count = contexts.length;
  const { audio, dispose } = bootAudio({ toggles: { sound: false, music: false }, gestureTarget: target });
  assert.equal(audio.status.muted, true);
  await dispose();
  target.dispatchEvent(new Event('keydown'));
  await flush();
  assert.equal(contexts.length, count);
});
await test('effect priority evicts furthest music while preserving stable cue order', () => {
  const s = new AudioScheduler({ queueCapacity: 3, maxVoices: 4, reservedEffectVoices: 1 });
  s.enqueue(cue(1), 2.1, .3, 'music'); s.enqueue(cue(2), 2.1, .3, 'music'); s.enqueue(cue(3), 2.2, .3, 'music');
  assert.equal(s.enqueue({ type: 'flap' }, 2.1, .1, 'effects'), true);
  const heard = [];
  assert.equal(s.pump(2.0, c => heard.push(c.type === 'arrival' ? c.tick : c.type)), 3);
  assert.deepEqual(heard, [1, 2, 'flap']);
  assert.equal(s.droppedCount, 1);
});
await test('reserved voices cap music and permit effects; mute clears pending and active', () => {
  const s = new AudioScheduler({ maxVoices: 3, reservedEffectVoices: 1 });
  for (let i = 0; i < 3; i++) s.enqueue(cue(i), 1.1, 2, 'music');
  s.enqueue({ type: 'flap' }, 1.1, 2, 'effects');
  assert.equal(s.pump(1, () => {}), 3);
  assert.equal(s.droppedCount, 1);
  assert.equal(s.activeCount(1.2), 3);
  s.enqueue(cue(4), 2, 1, 'music');
  s.setMuted(true);
  assert.equal(s.pending, 0);
  assert.equal(s.activeCount(1.2), 0);
  assert.equal(s.enqueue(cue(5), 2, 1, 'music'), false);
  s.setMuted(false);
  assert.equal(s.pump(2, () => assert.fail('muted cues must not replay')), 0);
});
await test('invalid and stale cues drop and full effect-only queue refuses replacement', () => {
  const s = new AudioScheduler({ queueCapacity: 1 });
  assert.equal(s.enqueue(cue(1), NaN, 1, 'music'), false);
  assert.equal(s.enqueue(cue(1), 0, 0, 'music'), false);
  assert.equal(s.enqueue({ type: 'flap' }, 1, 1, 'effects'), true);
  assert.equal(s.enqueue({ type: 'tag' }, 1, 1, 'effects'), false);
  assert.equal(s.pump(2, () => assert.fail('stale cue')), 0);
  assert.equal(s.droppedCount, 4);
});
console.log(`SUMMARY test:audio-boundary seed=${SEED} cases=${passed + failed} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
