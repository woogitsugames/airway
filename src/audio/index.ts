/** Public adapter boundary; can be imported before a user gesture. */
export { AirwayAudio, createAudio } from './engine';
export { AudioScheduler } from './scheduler';
export { clamp01, latitudeToHz, latitudeToMidi, stressBeatHz } from './pitch';
export { DEFAULT_AUDIO_SETTINGS } from './events';
export type {
  AudioCue, AudioEffect, AudioEventStream, AudioSettings, HubAudioData,
} from './events';
export type { AudioBus, AudioSchedulerConfig, ScheduledCueHandler } from './scheduler';
