# Airway audio (task 19)

Self-contained event-driven Web Audio synthesis. No Tone.js, samples, renderer or
simulation imports. Engine uses a 25 ms scheduler loop, bounded 125 ms lookahead,
20 simultaneous transient voices (four slots reserved for UI sounds), and at most
four two-oscillator congestion drones. A compressor, 55 Hz high-pass and short
attack/release envelopes prevent clipping and clicks during 4x simulation.

## Composition root integration

```ts
import { bootAudio, audioSettingsFromToggles, type AudioCue } from './audio';
import { readSettings } from './ui/settings/settings';

// No AudioContext is created here; the first pointerup/touchend/keydown unlocks it.
const { audio, dispose } = bootAudio({ toggles: readSettings() });

// After each completed sim step (timestamps only, never authoritative):
audio.setSimClock(simTick, gameSpeed);           // gameSpeed 0.25..4
// Map immutable sim events to cues in src/game, never inside src/sim:
audio.emit({ type: 'arrival', tick, hubId, latitude, capacity, loadRatio, night });
// 'transfer' on MCT completion, 'hub-load' on occupancy change, 'dawn', {type:'week',tick,week}.
// Or pass a read-only stream: bootAudio({ toggles, cues: { subscribe(listener) { ...; return off; } } }).
// Menu/UI: audio.playEffect('flap' | 'paper' | 'tag' | 'stamp' | 'new-city');
// Settings screen change: audio.setSettings(audioSettingsFromToggles(next));
// On teardown: await dispose();
```

Hub latitude `[-60, +70]` maps onto ten pentatonic degrees across two octaves;
week changes move the key around the circle of fifths. Arrival strikes a mellow
triangle resonator; transfers pluck a shorter sine. A hub above ~72% load adds
an oscillator beating up to 6 Hz by 100%. `hub-load` updates an independent
fading drone that stops when occupancy drops below 68%. Per-event `night`
lowers the filter cutoff; `setNight(true)` dims the overall music bus; dawn
blooms a three-note chord. Menu flap, paper, tag, stamp and new-city bell are
synthesised locally with deterministic generated noise and oscillators.

## Settings and platform behavior

`setSettings()` takes 0..1 music/effect volumes, `muted`, and
`playInSilentMode` (default `false`). On iOS, the engine requests the ambient
Audio Session (respects the hardware silent switch). Explicitly opting in to
`playInSilentMode: true` requests playback. Availability of
`navigator.audioSession` and the device's physical switch varies in WKWebView:
verify on physical iOS hardware before release. Mute ramps master output to
zero within 6 ms, drops the queued events and stops active notes. It never
alters the simulation or its random number generator.

The read-only `AudioCue` union is the integration boundary. Feed cues from
`src/game` rather than adding an import or audio side effect inside `src/sim`.
iOS: `AppDelegate.swift` sets the native `.ambient` session at launch, so the
hardware silent switch is respected unless the player opts in.

## Validation and listening

`npm run test:audio-sched` tests ordering, lookahead, 4x burst voice caps,
reserved UI capacity, mute, stale events and pentatonic mapping without
`AudioContext`. Test uses Node 22 built-in TypeScript stripping and seed 0xA1A1.

For a reproducible **illustrative** 30-second audio sketch run
`npm run audio:demo -- /path/to/audio-demo.wav` (Node 22). This offline PCM
renderer reuses the pitch/beat rules but is *not* a capture of the Web Audio
engine or proof of browser/device performance. It generates no stored assets.

Manual listening protocol for iOS/Android browsers and WKWebView:
1. Trigger one arrival and a transfer at a latitude around 50 degrees.
2. Drive `hub-load` from 0.6 to 0.9 and 1.0; confirm the ~4/6 Hz beating,
   then release it below 0.68 without any tail click.
3. Run a 4x burst of ~160 arrivals; no more than 20 transient notes should
   overlap, and UI flap effects should remain audible.
4. Trigger dawn and the next week, then each of the five UI effects.
5. Mute mid-note; listen for immediate fade without a crack/pop. Test both
   settings sliders, app background/foreground and iOS physical silent switch.

A 30-second illustrative WAV can be generated offline, but actual Web Audio
listening and physical-device checks remain required before merge.
