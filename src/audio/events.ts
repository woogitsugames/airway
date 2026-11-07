/**
 * Read-only presentation cues. The simulation may emit these or be mapped to
 * them by the game composition root; audio never feeds back into the sim.
 */
export interface HubAudioData {
  readonly hubId: string;
  readonly latitude: number;
  /** 0..1 occupied/capacity ratio; emitted before an authoritative jam. */
  readonly loadRatio?: number;
  readonly capacity?: number;
  readonly night?: boolean;
  /** [night-03] Destination region of the hub; picks its rotation of the pentatonic (REGION_SCALES). */
  readonly regionId?: string;
}

export type AudioCue =
  | ({ readonly type: 'arrival'; readonly tick: number } & HubAudioData)
  | ({ readonly type: 'transfer'; readonly tick: number } & HubAudioData)
  | ({ readonly type: 'dawn'; readonly tick: number } & HubAudioData)
  | ({ readonly type: 'hub-load'; readonly tick: number; readonly loadRatio: number } & HubAudioData)
  | { readonly type: 'week'; readonly tick: number; readonly week: number }
  | { readonly type: 'new-city'; readonly tick: number; readonly latitude?: number; readonly regionId?: string }
  | { readonly type: 'flap' | 'paper' | 'tag' | 'stamp' | 'slot-wait' | 'surge-notice'; readonly tick?: number };

export type AudioEventStream = {
  subscribe(listener: (event: AudioCue) => void): () => void;
};

export type AudioEffect = 'flap' | 'paper' | 'tag' | 'stamp' | 'slot-wait' | 'new-city';

export interface AudioSettings {
  /** Master mute; audio is locked until the first trusted user gesture. */
  readonly muted: boolean;
  /** 0..1, saved and restored by the settings UI. */
  readonly musicVolume: number;
  readonly effectsVolume: number;
  /** false: respect the iOS hardware silent switch (ambient session). */
  readonly playInSilentMode: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  musicVolume: 0.65,
  effectsVolume: 0.8,
  playInSilentMode: false,
};

/** Shape of the toggles kept by the settings screen (src/ui/settings/settings.ts). */
export interface AudioToggles {
  readonly sound: boolean;
  readonly music: boolean;
  readonly playInSilentMode?: boolean;
}

/** Maps the settings screen's on/off switches to engine volumes. */
export function audioSettingsFromToggles(toggles: AudioToggles): AudioSettings {
  return {
    muted: !toggles.sound && !toggles.music,
    musicVolume: toggles.music ? DEFAULT_AUDIO_SETTINGS.musicVolume : 0,
    effectsVolume: toggles.sound ? DEFAULT_AUDIO_SETTINGS.effectsVolume : 0,
    playInSilentMode: toggles.playInSilentMode ?? DEFAULT_AUDIO_SETTINGS.playInSilentMode,
  };
}
