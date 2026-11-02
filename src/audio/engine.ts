import { AudioScheduler } from './scheduler';
import { clamp01, latitudeToHz, stressBeatHz } from './pitch';
import {
  DEFAULT_AUDIO_SETTINGS,
  type AudioCue, type AudioEffect, type AudioEventStream, type AudioSettings,
} from './events';

const TICKS_PER_SECOND = 10;
const SCHEDULE_INTERVAL_MS = 25;
const SIM_LATENCY_SECONDS = 0.125;
const MAX_STRESS_HUBS = 4;
const FADE_SECONDS = 0.006;

type SourceNode = OscillatorNode | AudioBufferSourceNode;
interface LiveVoice { readonly sources: SourceNode[]; readonly nodes: AudioNode[] }
interface StressVoice extends LiveVoice {
  readonly latitude: number;
  readonly fundamental: OscillatorNode;
  readonly beating: OscillatorNode;
  readonly gain: GainNode;
  readonly filter: BiquadFilterNode;
}

type AudioSessionNavigator = Navigator & {
  audioSession?: { type: 'ambient' | 'playback' | 'auto' };
};

/** Web Audio is instantiated only in unlock(), called by a user gesture. */
export class AirwayAudio {
  private readonly scheduler = new AudioScheduler();
  private readonly voices = new Set<LiveVoice>();
  private readonly stress = new Map<string, StressVoice>();
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private nightFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private interval: number | null = null;
  private gestureCleanup: (() => void) | null = null;
  private lifecycleCleanup: (() => void) | null = null;
  private tick = 0;
  private speed = 1;
  private week = 1;
  private night = false;
  private destroyed = false;

  get unlocked(): boolean { return this.context?.state === 'running'; }
  get schedulerStats(): Readonly<{ pending: number; scheduled: number; dropped: number }> {
    return {
      pending: this.scheduler.pending,
      scheduled: this.scheduler.scheduledCount,
      dropped: this.scheduler.droppedCount,
    };
  }

  /**
   * Called by the game composition root after a fixed simulation step. Speed
   * only controls sound timestamps, never the authoritative simulation clock.
   */
  setSimClock(tick: number, speed = 1): void {
    if (Number.isSafeInteger(tick) && tick >= 0) this.tick = tick;
    if (Number.isFinite(speed) && speed > 0) this.speed = Math.min(4, speed);
  }

  /** A typed, read-only subscription adapter; no imports from src/sim. */
  subscribe(source: AudioEventStream): () => void {
    return source.subscribe((cue) => { this.emit(cue); });
  }

  /**
   * UI effect triggers may omit tick. Hub load is a continuous signal and
   * updates its drone; other simulation cues are scheduled 125 ms ahead.
   */
  emit(cue: AudioCue): boolean {
    if (!this.unlocked || this.settings.muted || this.destroyed) return false;
    if (cue.type === 'hub-load') {
      this.updateStress(cue);
      return true;
    }
    if (cue.type === 'week') {
      if (Number.isSafeInteger(cue.week) && cue.week > 0) {
        this.week = cue.week;
        this.retuneStress();
      }
    }
    if (cue.type === 'dawn') this.setNight(false);
    const ctx = this.context;
    if (!ctx) return false;
    const isUI = cue.type === 'flap' || cue.type === 'paper' ||
      cue.type === 'tag' || cue.type === 'stamp';
    const deltaTicks = cue.tick === undefined ? 0 : Math.max(0, cue.tick - this.tick);
    const when = ctx.currentTime + (isUI ? 0.008 : SIM_LATENCY_SECONDS) +
      deltaTicks / (TICKS_PER_SECOND * this.speed);
    const duration = this.durationOf(cue);
    const added = this.scheduler.enqueue(cue, when, duration, isUI ? 'effects' : 'music');
    if (isUI) this.pump();
    return added;
  }

  playEffect(effect: AudioEffect): boolean {
    return this.emit(effect === 'new-city' ? { type: effect, tick: this.tick } : { type: effect });
  }

  /** Bind during bootstrap; this does not create an AudioContext. */
  unlockOnFirstGesture(target: EventTarget = document): () => void {
    this.gestureCleanup?.();
    if (this.destroyed) return () => {};
    const handler = (): void => {
      cleanup();
      // resume() is invoked synchronously within the trusted event call stack.
      void this.unlock();
    };
    const cleanup = (): void => {
      target.removeEventListener('pointerup', handler);
      target.removeEventListener('touchend', handler);
      target.removeEventListener('keydown', handler);
      if (this.gestureCleanup === cleanup) this.gestureCleanup = null;
    };
    target.addEventListener('pointerup', handler, { passive: true });
    target.addEventListener('touchend', handler, { passive: true });
    target.addEventListener('keydown', handler);
    this.gestureCleanup = cleanup;
    return cleanup;
  }

  unlock(): Promise<boolean> {
    if (this.destroyed || typeof AudioContext === 'undefined') return Promise.resolve(false);
    try {
      if (!this.context) this.setup();
      const ctx = this.context;
      if (!ctx) return Promise.resolve(false);
      this.applyIOSAudioSession();
      const resume = ctx.resume();
      return resume.then(() => {
        if (this.destroyed || ctx.state !== 'running') return false;
        this.startScheduler();
        this.applySettings();
        return true;
      }).catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  /** Settings are pushed in from the owner of UI/persistence (task 14). */
  setSettings(next: Partial<AudioSettings>): void {
    const wasMuted = this.settings.muted;
    this.settings = {
      muted: typeof next.muted === 'boolean' ? next.muted : this.settings.muted,
      musicVolume: next.musicVolume === undefined ? this.settings.musicVolume : clamp01(next.musicVolume),
      effectsVolume: next.effectsVolume === undefined ? this.settings.effectsVolume : clamp01(next.effectsVolume),
      playInSilentMode: typeof next.playInSilentMode === 'boolean'
        ? next.playInSilentMode : this.settings.playInSilentMode,
    };
    this.applyIOSAudioSession();
    this.applySettings();
    if (this.settings.muted && !wasMuted) {
      this.scheduler.setMuted(true);
      this.stopVoices();
    } else if (!this.settings.muted && wasMuted) {
      this.scheduler.setMuted(false);
    }
  }

  /** Global night state is optional; per-hub cues may override it. */
  setNight(isNight: boolean): void {
    this.night = isNight;
    const ctx = this.context;
    if (ctx && this.nightFilter) {
      this.nightFilter.frequency.setTargetAtTime(isNight ? 1300 : 5500, ctx.currentTime, 0.12);
    }
  }

  /** Call from Capacitor App pause and resume hooks when they are available. */
  pause(): void {
    this.stopScheduler();
    this.scheduler.clear();
    this.stopVoices();
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
  }

  resume(): Promise<boolean> {
    // Visibility/pageshow may fire before the first gesture. Do not create an
    // AudioContext from lifecycle notifications; only unlock() may do that.
    return this.context ? this.unlock() : Promise.resolve(false);
  }

  /** Browser fallback until task 16 wires @capacitor/app lifecycle. */
  attachBrowserLifecycle(): () => void {
    this.lifecycleCleanup?.();
    if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
    const onVisibility = (): void => {
      if (document.hidden) this.pause();
      else void this.resume();
    };
    const onPageHide = (): void => this.pause();
    const onPageShow = (): void => { void this.resume(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    const cleanup = (): void => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      if (this.lifecycleCleanup === cleanup) this.lifecycleCleanup = null;
    };
    this.lifecycleCleanup = cleanup;
    return cleanup;
  }

  async dispose(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.gestureCleanup?.();
    this.lifecycleCleanup?.();
    this.pause();
    this.voices.clear();
    this.stress.clear();
    const ctx = this.context;
    this.context = null;
    if (ctx && ctx.state !== 'closed') await ctx.close().catch(() => {});
  }

  private setup(): void {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.context = ctx;
    const master = ctx.createGain();
    const hipass = ctx.createBiquadFilter();
    hipass.type = 'highpass';
    hipass.frequency.value = 55;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 7;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.17;
    master.connect(hipass).connect(compressor).connect(ctx.destination);
    const music = ctx.createGain();
    const effects = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.night ? 1300 : 5500;
    music.connect(filter).connect(master);
    effects.connect(master);
    this.master = master;
    this.music = music;
    this.effects = effects;
    this.nightFilter = filter;
    this.noise = this.createNoise(ctx);
    this.applySettings();
  }

  private applySettings(): void {
    const ctx = this.context;
    if (!ctx) return;
    const now = ctx.currentTime;
    const fade = (node: GainNode | null, value: number): void => {
      if (!node) return;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(value, now + FADE_SECONDS);
    };
    fade(this.master, this.settings.muted ? 0 : 1);
    fade(this.music, this.settings.musicVolume);
    fade(this.effects, this.settings.effectsVolume);
  }

  private applyIOSAudioSession(): void {
    if (typeof navigator === 'undefined') return;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!ios) return;
    try {
      const session = (navigator as AudioSessionNavigator).audioSession;
      if (session) session.type = this.settings.playInSilentMode ? 'playback' : 'ambient';
    } catch { /* WKWebView may reject changing the session while suspended. */ }
  }

  private startScheduler(): void {
    if (this.interval !== null || typeof window === 'undefined') return;
    this.interval = window.setInterval(() => this.pump(), SCHEDULE_INTERVAL_MS);
  }

  private stopScheduler(): void {
    if (this.interval !== null && typeof window !== 'undefined') window.clearInterval(this.interval);
    this.interval = null;
  }

  private pump(): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.settings.muted) return;
    this.scheduler.pump(ctx.currentTime, (cue, at) => { this.play(cue, at); });
  }

  private durationOf(cue: AudioCue): number {
    switch (cue.type) {
      case 'arrival': return 0.72;
      case 'transfer': return 0.48;
      case 'dawn': return 1.5;
      case 'week': return 0.9;
      case 'new-city': return 1.25;
      case 'flap': return 0.095;
      case 'paper': return 0.29;
      case 'tag': return 0.21;
      case 'stamp': return 0.18;
      case 'hub-load': return 0.5;
    }
  }

  private play(cue: AudioCue, at: number): void {
    switch (cue.type) {
      case 'arrival':
      case 'transfer':
        this.hubStrike(cue, at);
        break;
      case 'dawn':
        this.chord(latitudeToHz(cue.latitude, this.week), at, 1.5);
        break;
      case 'week':
        this.chord(latitudeToHz(0, this.week) / 2, at, 0.9);
        break;
      case 'new-city':
        this.bell(latitudeToHz(cue.latitude ?? 0, this.week) * 2, at);
        break;
      case 'flap':
        this.flap(at);
        break;
      case 'paper':
        this.paper(at);
        break;
      case 'tag':
        this.tag(at);
        break;
      case 'stamp':
        this.stamp(at);
        break;
      case 'hub-load':
        // Continuous load is controlled in updateStress(), not replayed here.
        break;
    }
  }

  private hubStrike(cue: Extract<AudioCue, { type: 'arrival' | 'transfer' }>, at: number): void {
    const ctx = this.context;
    const bus = this.music;
    if (!ctx || !bus) return;
    const isArrival = cue.type === 'arrival';
    const frequency = latitudeToHz(cue.latitude, this.week);
    const decay = (isArrival ? 0.43 : 0.19) + 0.001 * Math.min(170, Math.max(0, cue.capacity ?? 0));
    const end = at + decay + 0.08;
    const envelope = this.envelope(bus, at, end, isArrival ? 0.048 : 0.025, 0.008);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cue.night ?? this.night ? 1100 : 3300;
    filter.connect(envelope);
    const main = this.oscillator(isArrival ? 'triangle' : 'sine', frequency, at, end, filter);
    const sources: SourceNode[] = [main];
    const beat = stressBeatHz(cue.loadRatio ?? 0);
    if (beat > 0) sources.push(this.oscillator('sine', frequency + beat, at, end, filter));
    this.track(sources, [filter, envelope]);
  }

  private chord(base: number, at: number, duration: number): void {
    const ctx = this.context;
    const bus = this.music;
    if (!ctx || !bus) return;
    const end = at + duration;
    const env = this.envelope(bus, at, end, 0.025, 0.085);
    const sources: SourceNode[] = [];
    for (const ratio of [1, 5 / 4, 3 / 2]) {
      sources.push(this.oscillator('sine', base * ratio, at, end, env));
    }
    this.track(sources, [env]);
  }

  private bell(frequency: number, at: number): void {
    const ctx = this.context;
    const bus = this.music;
    if (!ctx || !bus) return;
    const end = at + 1.25;
    const env = this.envelope(bus, at, end, 0.037, 0.005);
    this.track([
      this.oscillator('sine', frequency, at, end, env),
      this.oscillator('sine', frequency * 2.01, at, end, env),
    ], [env]);
  }

  private flap(at: number): void {
    const ctx = this.context;
    const bus = this.effects;
    if (!ctx || !bus) return;
    const env = this.envelope(bus, at, at + 0.095, 0.09, 0.003);
    this.track([this.oscillator('triangle', 190, at, at + 0.095, env)], [env]);
  }

  private paper(at: number): void {
    const ctx = this.context;
    const bus = this.effects;
    if (!ctx || !bus) return;
    const env = this.envelope(bus, at, at + 0.29, 0.072, 0.012);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2100;
    filter.Q.value = 0.42;
    filter.connect(env);
    const noise = this.noiseSource(at, at + 0.29, filter);
    this.track([noise], [filter, env]);
  }

  private tag(at: number): void {
    const ctx = this.context;
    const bus = this.effects;
    if (!ctx || !bus) return;
    const env = this.envelope(bus, at, at + 0.21, 0.043, 0.004);
    this.track([
      this.oscillator('triangle', 740, at, at + 0.21, env),
      this.oscillator('sine', 1110, at, at + 0.21, env),
    ], [env]);
  }

  private stamp(at: number): void {
    const ctx = this.context;
    const bus = this.effects;
    if (!ctx || !bus) return;
    const env = this.envelope(bus, at, at + 0.18, 0.07, 0.004);
    const low = this.oscillator('triangle', 105, at, at + 0.18, env);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 760;
    filter.connect(env);
    const paper = this.noiseSource(at, at + 0.18, filter);
    this.track([low, paper], [filter, env]);
  }

  private envelope(bus: AudioNode, start: number, end: number, peak: number, attack: number): GainNode {
    const ctx = this.context;
    if (!ctx) throw new Error('AudioContext is locked');
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(peak, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, end - 0.008);
    env.gain.setValueAtTime(0, end);
    env.connect(bus);
    return env;
  }

  private oscillator(type: OscillatorType, frequency: number, start: number, end: number, to: AudioNode): OscillatorNode {
    const ctx = this.context;
    if (!ctx) throw new Error('AudioContext is locked');
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(to);
    osc.start(start);
    osc.stop(end);
    return osc;
  }

  private noiseSource(start: number, end: number, to: AudioNode): AudioBufferSourceNode {
    const ctx = this.context;
    if (!ctx || !this.noise) throw new Error('Noise has not been initialized');
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.connect(to);
    source.start(start);
    source.stop(end);
    return source;
  }

  private createNoise(ctx: AudioContext): AudioBuffer {
    const length = Math.ceil(ctx.sampleRate * 0.35);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let state = 0x19A0D10;
    for (let i = 0; i < length; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      samples[i] = (state >>> 0) / 0x80000000 - 1;
    }
    return buffer;
  }

  private track(sources: SourceNode[], nodes: AudioNode[]): void {
    const voice: LiveVoice = { sources, nodes };
    this.voices.add(voice);
    // All sources in a transient stop at exactly the same timestamp.
    sources[0].onended = () => {
      for (const source of sources) source.disconnect();
      for (const node of nodes) node.disconnect();
      this.voices.delete(voice);
    };
  }

  private stopVoices(): void {
    const now = this.context?.currentTime ?? 0;
    for (const voice of this.voices) {
      for (const node of voice.nodes) {
        if (node instanceof GainNode) {
          node.gain.cancelScheduledValues(now);
          node.gain.setValueAtTime(node.gain.value, now);
          node.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
        }
      }
      for (const source of voice.sources) {
        try { source.stop(now + FADE_SECONDS); } catch { /* already ended */ }
      }
    }
    for (const hubId of this.stress.keys()) this.stopStress(hubId);
  }

  private updateStress(cue: Extract<AudioCue, { type: 'hub-load' }>): void {
    const ctx = this.context;
    const bus = this.music;
    if (!ctx || !bus) return;
    const ratio = clamp01(cue.loadRatio);
    if (ratio < 0.68) { this.stopStress(cue.hubId); return; }
    let drone = this.stress.get(cue.hubId);
    if (!drone && ratio < 0.75) return; // Hysteresis prevents drone churn.
    if (!drone) {
      if (this.stress.size >= MAX_STRESS_HUBS) return;
      const fundamental = ctx.createOscillator();
      const beating = ctx.createOscillator();
      fundamental.type = 'sine';
      beating.type = 'sine';
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.45;
      gain.gain.value = 0;
      fundamental.connect(filter);
      beating.connect(filter);
      filter.connect(gain).connect(bus);
      fundamental.start();
      beating.start();
      drone = {
        latitude: cue.latitude,
        fundamental, beating, gain, filter,
        sources: [fundamental, beating], nodes: [filter, gain],
      };
      this.stress.set(cue.hubId, drone);
    }
    const frequency = latitudeToHz(cue.latitude, this.week);
    drone.fundamental.frequency.setTargetAtTime(frequency, ctx.currentTime, 0.05);
    drone.beating.frequency.setTargetAtTime(frequency + stressBeatHz(ratio), ctx.currentTime, 0.05);
    drone.filter.frequency.setTargetAtTime(cue.night ?? this.night ? 950 : 2200, ctx.currentTime, 0.08);
    const amplitude = 0.012 * clamp01((ratio - 0.68) / 0.32);
    drone.gain.gain.setTargetAtTime(amplitude, ctx.currentTime, 0.06);
  }

  private stopStress(hubId: string): void {
    const voice = this.stress.get(hubId);
    const ctx = this.context;
    if (!voice || !ctx) return;
    this.stress.delete(hubId);
    const at = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(at);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, at);
    voice.gain.gain.linearRampToValueAtTime(0, at + 0.065);
    for (const osc of voice.sources) {
      try { osc.stop(at + 0.075); } catch { /* already stopped */ }
    }
    voice.sources[0].onended = () => {
      for (const source of voice.sources) source.disconnect();
      for (const node of voice.nodes) node.disconnect();
    };
  }

  private retuneStress(): void {
    const ctx = this.context;
    if (!ctx) return;
    for (const voice of this.stress.values()) {
      const frequency = latitudeToHz(voice.latitude, this.week);
      const currentBeat = Math.abs(voice.beating.frequency.value - voice.fundamental.frequency.value);
      voice.fundamental.frequency.setTargetAtTime(frequency, ctx.currentTime, 0.12);
      voice.beating.frequency.setTargetAtTime(frequency + currentBeat, ctx.currentTime, 0.12);
    }
  }
}

export function createAudio(): AirwayAudio { return new AirwayAudio(); }
