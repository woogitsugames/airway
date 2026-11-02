import type { AudioCue } from './events';

export type AudioBus = 'music' | 'effects';
export type ScheduledCueHandler = (
  cue: AudioCue, startTime: number, slot: number,
) => void;

export interface AudioSchedulerConfig {
  readonly lookaheadSeconds?: number;
  readonly maxVoices?: number;
  readonly reservedEffectVoices?: number;
  readonly queueCapacity?: number;
}

/**
 * AudioContext-free, bounded scheduler. Owns a stable time-ordered queue and
 * reserves a voice until its scheduled envelope ends. Does not mutate the sim.
 * No arrays or temporary objects are allocated by pump().
 */
export class AudioScheduler {
  readonly lookaheadSeconds: number;
  readonly maxVoices: number;
  readonly reservedEffectVoices: number;
  readonly queueCapacity: number;

  private readonly cues: Array<AudioCue | null>;
  private readonly starts: Float64Array;
  private readonly lengths: Float64Array;
  private readonly buses: Uint8Array;
  private readonly voiceUntil: Float64Array;
  private readonly voiceBus: Uint8Array;
  private size = 0;
  private silenced = false;
  private dropped = 0;
  private scheduled = 0;

  constructor(config: AudioSchedulerConfig = {}) {
    const lookahead = config.lookaheadSeconds ?? 0.125;
    const maxVoices = config.maxVoices ?? 20;
    const reserved = config.reservedEffectVoices ?? 4;
    const capacity = config.queueCapacity ?? 256;
    if (!(lookahead >= 0.1 && lookahead <= 0.15) || !Number.isFinite(lookahead) ||
        !Number.isInteger(maxVoices) || maxVoices < 1 ||
        !Number.isInteger(reserved) || reserved < 0 || reserved >= maxVoices ||
        !Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('Invalid audio scheduler configuration');
    }
    this.lookaheadSeconds = lookahead;
    this.maxVoices = maxVoices;
    this.reservedEffectVoices = reserved;
    this.queueCapacity = capacity;
    this.cues = Array<AudioCue | null>(capacity).fill(null);
    this.starts = new Float64Array(capacity);
    this.lengths = new Float64Array(capacity);
    this.buses = new Uint8Array(capacity);
    this.voiceUntil = new Float64Array(maxVoices);
    this.voiceBus = new Uint8Array(maxVoices);
  }

  get pending(): number { return this.size; }
  get droppedCount(): number { return this.dropped; }
  get scheduledCount(): number { return this.scheduled; }

  /**
   * Stable insertion for equal timestamps. Priority is controlled by the
   * reserved effect pool, rather than by rearranging already-scheduled sound.
   */
  enqueue(cue: AudioCue, startTime: number, duration: number, bus: AudioBus): boolean {
    if (this.silenced || !Number.isFinite(startTime) || startTime < 0 ||
        !Number.isFinite(duration) || duration <= 0) {
      this.dropped++;
      return false;
    }
    const category = bus === 'effects' ? 1 : 0;
    if (this.size >= this.queueCapacity) {
      // Keep feedback responsive during 4x bursts: evict one furthest-future
      // music cue instead of discarding an incoming UI effect.
      let victim = this.size - 1;
      if (category === 1) {
        while (victim >= 0 && this.buses[victim] !== 0) victim--;
      }
      if (category === 0 || victim < 0) {
        this.dropped++;
        return false;
      }
      for (let i = victim + 1; i < this.size; i++) {
        this.cues[i - 1] = this.cues[i];
        this.starts[i - 1] = this.starts[i];
        this.lengths[i - 1] = this.lengths[i];
        this.buses[i - 1] = this.buses[i];
      }
      this.cues[--this.size] = null;
      this.dropped++;
    }
    let index = this.size;
    while (index > 0 && this.starts[index - 1] > startTime) {
      this.cues[index] = this.cues[index - 1];
      this.starts[index] = this.starts[index - 1];
      this.lengths[index] = this.lengths[index - 1];
      this.buses[index] = this.buses[index - 1];
      index--;
    }
    this.cues[index] = cue;
    this.starts[index] = startTime;
    this.lengths[index] = duration;
    this.buses[index] = category;
    this.size++;
    return true;
  }

  /** Schedules only the next 125 ms; late events are shifted by at most 6 ms. */
  pump(now: number, handler: ScheduledCueHandler): number {
    if (this.silenced || !Number.isFinite(now) || now < 0) return 0;
    let delivered = 0;
    const horizon = now + this.lookaheadSeconds;
    while (this.size > 0 && this.starts[0] <= horizon) {
      const cue = this.cues[0];
      const intendedTime = this.starts[0];
      const duration = this.lengths[0];
      const category = this.buses[0];
      // Pop the queue before invoking user code. Queue storage is preallocated.
      for (let i = 1; i < this.size; i++) {
        this.cues[i - 1] = this.cues[i];
        this.starts[i - 1] = this.starts[i];
        this.lengths[i - 1] = this.lengths[i];
        this.buses[i - 1] = this.buses[i];
      }
      this.cues[--this.size] = null;
      // Never play old events after the app resumes from the background.
      if (intendedTime < now - 0.2) { this.dropped++; continue; }
      const at = Math.max(intendedTime, now + 0.006);
      const slot = this.reserve(at, at + duration, category);
      if (slot < 0 || cue === null) { this.dropped++; continue; }
      try {
        handler(cue, at, slot);
        delivered++;
        this.scheduled++;
      } catch (error) {
        this.release(slot);
        throw error;
      }
    }
    return delivered;
  }

  /** Immediate mute clears all buffered events, including future ones. */
  setMuted(muted: boolean): void {
    this.silenced = muted;
    if (muted) this.clear();
  }

  clear(): void {
    for (let i = 0; i < this.size; i++) this.cues[i] = null;
    this.size = 0;
    this.voiceUntil.fill(0);
    this.voiceBus.fill(0);
  }

  release(slot: number): void {
    if (Number.isInteger(slot) && slot >= 0 && slot < this.maxVoices) {
      this.voiceUntil[slot] = 0;
      this.voiceBus[slot] = 0;
    }
  }

  activeCount(at: number): number {
    let count = 0;
    for (let i = 0; i < this.maxVoices; i++) if (this.voiceUntil[i] > at) count++;
    return count;
  }

  private reserve(at: number, until: number, category: number): number {
    let busy = 0;
    let music = 0;
    let free = -1;
    for (let i = 0; i < this.maxVoices; i++) {
      if (this.voiceUntil[i] > at) {
        busy++;
        if (this.voiceBus[i] === 0) music++;
      } else if (free < 0) free = i;
    }
    if (free < 0 || busy >= this.maxVoices ||
        (category === 0 && music >= this.maxVoices - this.reservedEffectVoices)) return -1;
    this.voiceUntil[free] = until;
    this.voiceBus[free] = category;
    return free;
  }
}
