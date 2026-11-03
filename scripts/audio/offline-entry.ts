// [night-03] Browser bundle for offline previews: the real AirwayAudio graph on an OfflineAudioContext.
import { AirwayAudio } from '../../src/audio/engine';
import type { AudioCue } from '../../src/audio/events';

export interface TimedCue { readonly at: number; readonly cue: AudioCue }

async function render(cues: readonly TimedCue[], seconds: number, sampleRate: number): Promise<number[]> {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  const audio = new AirwayAudio();
  audio.attachOfflineContext(ctx);
  for (const { at, cue } of cues) audio.renderCueAt(cue, at);
  const buffer = await ctx.startRendering();
  return Array.from(buffer.getChannelData(0));
}

(globalThis as unknown as { renderAirwayPreview: typeof render }).renderAirwayPreview = render;
