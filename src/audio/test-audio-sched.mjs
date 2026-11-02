// [task-19] AudioContext-free scheduling regression; Node 22 type stripping.
import assert from 'node:assert/strict';
import { AudioScheduler } from './scheduler.ts';
import { latitudeToHz, latitudeToMidi, stressBeatHz } from './pitch.ts';

const SEED = '0xA1A1';
const tests = [];
const run = (name, check) => tests.push({ name, check });
const arrival = (tick) => ({ type: 'arrival', tick, hubId: 'BRU', latitude: 50.9 });
const flap = () => ({ type: 'flap' });

run('lookahead schedules 125 ms ahead, never early', () => {
  const scheduler = new AudioScheduler();
  const seen = [];
  assert.equal(scheduler.enqueue(arrival(100), 1.3, 0.5, 'music'), true);
  assert.equal(scheduler.pump(1.1, (cue) => seen.push(cue)), 0);
  assert.equal(scheduler.pump(1.18, (_cue, start) => seen.push(start)), 1);
  assert.deepEqual(seen, [1.3]);
});

run('stable ordering for equal timestamps', () => {
  const scheduler = new AudioScheduler();
  for (const tick of [2, 0, 1]) scheduler.enqueue(arrival(tick), tick === 0 ? 2 : 2.1, 0.12, 'music');
  const order = [];
  scheduler.pump(2.0, (cue) => order.push(cue.tick));
  assert.deepEqual(order, [0, 2, 1]);
});

run('4x burst respects 20 voices and four reserved UI slots', () => {
  const scheduler = new AudioScheduler({ maxVoices: 20, reservedEffectVoices: 4 });
  for (let tick = 0; tick < 4 * 40; tick++) {
    assert.equal(scheduler.enqueue(arrival(tick), 10.05, 0.50, 'music'), true);
  }
  for (let i = 0; i < 4; i++) scheduler.enqueue(flap(), 10.06, 0.1, 'effects');
  assert.equal(scheduler.pump(10.0, () => {}), 20);
  assert.equal(scheduler.activeCount(10.07), 20);
  assert.equal(scheduler.droppedCount, 144);
  // After all envelopes end, previously reserved slots can be reused.
  scheduler.enqueue(arrival(500), 10.70, 0.4, 'music');
  assert.equal(scheduler.pump(10.6, () => {}), 1);
  assert.equal(scheduler.activeCount(10.75), 1);
});

run('effects displace future music when the pending queue is full', () => {
  const scheduler = new AudioScheduler({ queueCapacity: 2 });
  scheduler.enqueue(arrival(1), 3.1, 0.2, 'music');
  scheduler.enqueue(arrival(2), 3.2, 0.2, 'music');
  assert.equal(scheduler.enqueue(flap(), 3.19, 0.1, 'effects'), true);
  const heard = [];
  scheduler.pump(3.1, (cue) => heard.push(cue.type));
  assert.deepEqual(heard, ['arrival', 'flap']);
  assert.equal(scheduler.droppedCount, 1);
});

run('mute drops the pending queue immediately and does not replay old cues', () => {
  const scheduler = new AudioScheduler();
  scheduler.enqueue(arrival(0), 10.15, 0.4, 'music');
  scheduler.setMuted(true);
  assert.equal(scheduler.pending, 0);
  assert.equal(scheduler.pump(10.1, () => assert.fail('no audio while muted')), 0);
  assert.equal(scheduler.enqueue(arrival(1), 10.2, 0.4, 'music'), false);
  scheduler.setMuted(false);
  assert.equal(scheduler.pump(10.1, () => assert.fail('no stale cue')), 0);
});

run('invalid timestamps, bounded backlog and stale scheduling are rejected', () => {
  const scheduler = new AudioScheduler({ queueCapacity: 2 });
  assert.equal(scheduler.enqueue(arrival(0), NaN, 0.5, 'music'), false);
  assert.equal(scheduler.enqueue(arrival(0), 1.0, 0.1, 'music'), true);
  assert.equal(scheduler.enqueue(arrival(1), 1.1, 0.1, 'music'), true);
  assert.equal(scheduler.enqueue(arrival(2), 1.2, 0.1, 'music'), false);
  assert.equal(scheduler.pump(2.0, () => assert.fail('stale cue played')), 0);
  assert.equal(scheduler.pending, 0);
});

run('handler exceptions free voice reservation for retry', () => {
  const scheduler = new AudioScheduler({ maxVoices: 2, reservedEffectVoices: 0 });
  scheduler.enqueue(arrival(0), 2.1, 0.5, 'music');
  assert.throws(() => scheduler.pump(2.0, () => { throw new Error('adapter failed'); }), /adapter failed/);
  assert.equal(scheduler.activeCount(2.11), 0);
});

run('latitude pitch is bounded, pentatonic and transposed by week', () => {
  const base = latitudeToMidi(-60, 1);
  assert.equal(latitudeToMidi(-150, 1), base);
  assert.equal(latitudeToMidi(90, 1) - base, 24);
  assert.equal(latitudeToMidi(-60, 2) - base, 7);
  assert.ok(Math.abs(latitudeToHz(0, 1) - 440 * 2 ** ((latitudeToMidi(0, 1) - 69) / 12)) < 1e-8);
  assert.equal(stressBeatHz(0.70), 0);
  assert.equal(stressBeatHz(1), 6);
  assert.ok(stressBeatHz(0.90) > stressBeatHz(0.80));
});

let failed = 0;
for (const { name, check } of tests) {
  try {
    check();
    console.log('PASS ' + name);
  } catch (error) {
    failed++;
    console.error('FAIL ' + name + ': ' + (error instanceof Error ? error.stack : String(error)));
  }
}
console.log('SUMMARY test:audio-sched seed=' + SEED + ' tests=' + tests.length +
  ' passed=' + (tests.length - failed) + ' failed=' + failed);
if (failed) process.exitCode = 1;
