/** Public adapter boundary; can be imported before a user gesture. */
export { AirwayAudio, MIX, createAudio } from './engine';
export { AudioScheduler } from './scheduler';
export { REGION_SCALES, clamp01, latitudeToHz, latitudeToMidi, stressBeatHz, weekTonicHz } from './pitch';
export { DEFAULT_AUDIO_SETTINGS, audioSettingsFromToggles } from './events';
export type {
  AudioCue, AudioEffect, AudioEventStream, AudioSettings, AudioToggles, HubAudioData,
} from './events';
export type { AudioBus, AudioSchedulerConfig, ScheduledCueHandler } from './scheduler';

import { createAudio as create } from './engine';
import { audioSettingsFromToggles, type AudioEventStream, type AudioToggles } from './events';

/**
 * Composition-root boot: no AudioContext until the first trusted gesture,
 * browser lifecycle pause/resume, settings applied, optional read-only cue stream.
 * Returns the engine plus one cleanup function.
 */
export function bootAudio(options: {
  toggles: AudioToggles;
  cues?: AudioEventStream;
  gestureTarget?: EventTarget;
}): { audio: ReturnType<typeof create>; dispose: () => Promise<void> } {
  const audio = create();
  audio.setSettings(audioSettingsFromToggles(options.toggles));
  const target = options.gestureTarget ?? (typeof document === 'undefined' ? undefined : document);
  if (target) audio.unlockOnFirstGesture(target);
  audio.attachBrowserLifecycle();
  const unsubscribe = options.cues ? audio.subscribe(options.cues) : () => {};
  return { audio, dispose: async () => { unsubscribe(); await audio.dispose(); } };
}
