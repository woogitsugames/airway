# Airway audio (task 19)

Self-contained event-driven Web Audio synthesis. No Tone.js, samples, renderer or
simulation imports. Engine uses a 25 ms scheduler loop, bounded 125 ms lookahead,
20 simultaneous transient voices (four slots reserved for UI sounds), and at most
four two-oscillator congestion drones. A compressor, 55 Hz high-pass and short
attack/release envelopes prevent clipping and clicks during 4x simulation.

## Composition root integration (tasks 08/09/14/16)

```ts
import { createAudio, type AudioCue } from '../audio';

const audio = createAudio();
audio.unlockOnFirstGesture(document); // user gesture: pointerup/touchend/keydown
audio.attachBrowserLifecycle();        // use audio.pause/resume for Capacitor App
// Restore values from task 14's settings UI; store them there, not in audio.
audio.setSettings({ musicVolume: 0.65, effectsVolume: 0.8, muted: false });

// During game ticks, never modify the simulation in response to audio:
audio.setSimClock(simTick, gameSpeed); // valid gameSpeed: 0.25..4
// Translate immutable sim events to AudioCue in the composition root.
// e.g. on arrival: audio.emit({type:'arrival', tick, hubId, latitude,
//                             capacity, loadRatio, night});
// on MCT completion: type 'transfer'; hub occupancy: 'hub-load';
// on sunrise: type 'dawn'; new week: {type:'week',tick,week}.
// Alternatively, audio.subscribe({subscribe(listener) { ...; return unsubscribe; }})
// Menu/UI (task 14): audio.playEffect('flap'|'paper'|'tag'|'stamp'|'new-city');
// On exit: await audio.dispose();
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

Until tasks 08/09 provide a finalized event union, the read-only `AudioCue`
is the integration boundary. Feed these cues from `src/game` rather than adding
an import or audio side effect inside `src/sim`.

## Validation and listening

`npm run test:audio-sched` tests ordering, lookahead, 4x burst voice caps,
reserved UI capacity, mute, stale events and pentatonic mapping without
`AudioContext`. Test uses Node 22 built-in TypeScript stripping and seed 0xA1A1.

Manual listening protocol for iOS/Android browsers and WKWebView:
1. Trigger one arrival and a transfer at a latitude around 50 degrees.
2. Drive `hub-load` from 0.6 to 0.9 and 1.0; confirm the ~4/6 Hz beating,
   then release it below 0.68 without any tail click.
3. Run a 4x burst of ~160 arrivals; no more than 20 transient notes should
   overlap, and UI flap effects should remain audible.
4. Trigger dawn and the next week, then each of the five UI effects.
5. Mute mid-note; listen for immediate fade without a crack/pop. Test both
   settings sliders, app background/foreground and iOS physical silent switch.

No physical listening verification or WAV export is implied by this document;
those require a browser/device audio output check before merge.
