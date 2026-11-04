// [night-12t] D-153: the sound path survives what a real Android phone does to Web Audio: a first resume that stays
// suspended, a system interruption, a lifecycle resume refused outside a gesture, a "running" context whose clock
// never moves, and the cue clock unit (sim tick, not world minute). Fake AudioContext, no browser.
import assert from 'node:assert/strict';

const SEED = '0xA1A1';
let passed = 0;
let failed = 0;
const live: { dispose(): Promise<void> }[] = [];
async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}`, error); }
  // A failed check must not leave a scheduler interval or stall timer keeping the process alive.
  for (const audio of live.splice(0)) await audio.dispose();
}
const tick = (ms = 0) => new Promise((done) => setTimeout(done, ms));

// ---- fake Web Audio ------------------------------------------------------------------------------------------
class FakeParam {
  value = 0;
  setValueAtTime(v: number) { this.value = v; return this; }
  linearRampToValueAtTime(v: number) { this.value = v; return this; }
  exponentialRampToValueAtTime(v: number) { this.value = v; return this; }
  setTargetAtTime(v: number) { this.value = v; return this; }
  cancelScheduledValues() { return this; }
}
class FakeNode {
  gain = new FakeParam(); frequency = new FakeParam(); detune = new FakeParam(); Q = new FakeParam();
  threshold = new FakeParam(); knee = new FakeParam(); ratio = new FakeParam(); attack = new FakeParam(); release = new FakeParam();
  type = ''; buffer: unknown = null; onended: (() => void) | null = null;
  connect<T>(to: T): T { return to; }
  disconnect() {}
  start() {}
  stop() {}
}
type Behaviour = { stayPausedResumes: number; refuseOutsideGesture: boolean; frozenClock: boolean };
const behaviour: Behaviour = { stayPausedResumes: 0, refuseOutsideGesture: false, frozenClock: false };
let inGesture = false;
const contexts: FakeContext[] = [];
class FakeContext {
  state: 'suspended' | 'running' | 'closed' | 'interrupted' = 'suspended';
  currentTime = 0;
  sampleRate = 48000;
  destination = new FakeNode();
  oscillators = 0;
  onstatechange: (() => void) | null = null;
  constructor(readonly options: { latencyHint?: string } = {}) { contexts.push(this); }
  private set(next: FakeContext['state']) { if (this.state !== next) { this.state = next; this.onstatechange?.(); } }
  resume(): Promise<void> {
    if (behaviour.refuseOutsideGesture && !inGesture) return Promise.reject(new Error('NotAllowedError'));
    if (behaviour.stayPausedResumes > 0) { behaviour.stayPausedResumes--; return Promise.resolve(); }
    this.set('running');
    return Promise.resolve();
  }
  suspend(): Promise<void> { this.set('suspended'); return Promise.resolve(); }
  close(): Promise<void> { this.set('closed'); return Promise.resolve(); }
  /** The system takes the context away (call, audio focus). */
  interrupt(): void { this.set('suspended'); }
  advance(seconds: number): void { if (!behaviour.frozenClock && this.state === 'running') this.currentTime += seconds; }
  createGain() { return new FakeNode(); }
  createBiquadFilter() { return new FakeNode(); }
  createDynamicsCompressor() { return new FakeNode(); }
  createOscillator() { this.oscillators++; return new FakeNode(); }
  createBufferSource() { return new FakeNode(); }
  createBuffer(_channels: number, length: number) { const data = new Float32Array(length); return { getChannelData: () => data }; }
}
Object.assign(globalThis, {
  AudioContext: FakeContext, GainNode: FakeNode,
  window: { setInterval: globalThis.setInterval.bind(globalThis), clearInterval: globalThis.clearInterval.bind(globalThis) },
});

const { AirwayAudio } = await import('../src/audio/engine.ts');
const { audioClockTick } = await import('../src/game/audioCues.ts');

function setup() {
  Object.assign(behaviour, { stayPausedResumes: 0, refuseOutsideGesture: false, frozenClock: false });
  contexts.length = 0;
  const audio = new AirwayAudio();
  live.push(audio);
  const target = new EventTarget();
  audio.unlockOnFirstGesture(target);
  const tap = async () => { inGesture = true; target.dispatchEvent(new Event('pointerup')); inGesture = false; await tick(); await tick(); };
  return { audio, tap };
}

await test('a first resume that stays suspended is retried on the next tap', async () => {
  const { audio, tap } = setup();
  behaviour.stayPausedResumes = 1;
  await tap();
  assert.equal(audio.unlocked, false);
  assert.equal(audio.status.waitingForGesture, true, 'the tap listener must stay until the context runs');
  await tap();
  assert.equal(audio.unlocked, true);
  assert.equal(audio.status.waitingForGesture, false, 'no listener left once running');
  assert.equal(contexts.length, 1, 'one context, resumed twice');
  await audio.dispose();
});

await test('a context the system suspends is resumed by the next tap', async () => {
  const { audio, tap } = setup();
  await tap();
  assert.equal(audio.unlocked, true);
  contexts[0].interrupt();
  assert.equal(audio.unlocked, false);
  assert.equal(audio.status.waitingForGesture, true);
  await tap();
  assert.equal(audio.unlocked, true);
  await audio.dispose();
});

await test('the game\'s own pause does not arm a tap; a refused lifecycle resume does', async () => {
  const { audio, tap } = setup();
  await tap();
  audio.pause();
  await tick();
  assert.equal(audio.status.waitingForGesture, false, 'pause() suspends on purpose');
  behaviour.refuseOutsideGesture = true;
  assert.equal(await audio.resume(), false);
  assert.equal(audio.status.waitingForGesture, true, 'refused resume waits for a tap');
  await tap();
  assert.equal(audio.unlocked, true);
  await audio.dispose();
});

await test('a running context with a frozen clock is rebuilt with the playback latency hint', async () => {
  const { audio, tap } = setup();
  behaviour.frozenClock = true;
  await tap();
  assert.equal(audio.unlocked, true);
  assert.equal(contexts[0].options.latencyHint, 'interactive');
  await tick(1300);
  assert.equal(contexts[0].state, 'closed');
  assert.equal(audio.status.rebuilds, 1);
  assert.equal(audio.status.waitingForGesture, true);
  behaviour.frozenClock = false;
  await tap();
  assert.equal(contexts.length, 2);
  assert.equal(contexts[1].options.latencyHint, 'playback');
  assert.equal(audio.unlocked, true);
  await audio.dispose();
});

await test('a healthy clock is left alone', async () => {
  const { audio, tap } = setup();
  await tap();
  const timer = setInterval(() => contexts[0].advance(0.05), 50);
  await tick(1300);
  clearInterval(timer);
  assert.equal(audio.status.rebuilds, 0);
  assert.equal(contexts[0].state, 'running');
  await audio.dispose();
});

await test('cues carry run.tick, so the engine clock is the tick: a chime plays now, not after the minute drift', async () => {
  // After weekly offer commands the sim tick runs ahead of the frozen world minute (here 40 ticks = 4 s at 1x).
  const run = { tick: 5040, clockMinute: 5000 };
  assert.equal(audioClockTick(run), 5040);
  for (const [clock, expectPlayed] of [[audioClockTick(run), true], [run.clockMinute, false]] as const) {
    const { audio, tap } = setup();
    await tap();
    audio.setSimClock(clock, 1);
    const before = contexts[0].oscillators;
    assert.equal(audio.emit({ type: 'arrival', tick: run.tick, hubId: 'FRA', latitude: 50, regionId: 'EUN' }), true);
    for (let i = 0; i < 6; i++) { contexts[0].advance(0.05); await tick(30); }
    assert.equal(contexts[0].oscillators > before, expectPlayed, `clock ${clock}: chime within 0.3 s`);
    await audio.dispose();
  }
});

await test('status reports the engine for device checks', async () => {
  const { audio, tap } = setup();
  assert.equal(audio.status.state, 'none');
  await tap();
  const status = audio.status;
  assert.equal(status.state, 'running');
  assert.equal(status.latencyHint, 'interactive');
  assert.equal(status.unlockAttempts, 1);
  assert.equal(status.musicVolume, 0.65);
  await audio.dispose();
});

console.log(`SUMMARY test:audio-unlock seed=${SEED} passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
