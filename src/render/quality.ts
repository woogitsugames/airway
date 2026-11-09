// The single render-only quality system (task 21). The simulation never reads device capabilities.
import {
  ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, type WebGLRenderer,
} from 'three';

export type QualityPreset = 'low' | 'medium' | 'high';
/** [night-04] `saver` = battery saver (D-73): low terrain, 30 fps cap, DPR 1, no shadows, fewer decorations. */
export type QualityPreference = QualityPreset | 'auto' | 'saver';
export const QUALITY_PREFERENCES: readonly QualityPreference[] = ['auto', 'saver', 'low', 'medium', 'high'];

export interface DeviceHints {
  hardwareConcurrency?: number;
  deviceMemoryGb?: number;
  devicePixelRatio?: number;
  /** [N12m] Unmasked WebGL renderer string (e.g. "Mali-G52 MC2"), read once by `readGpuRenderer`. */
  gpu?: string;
}

/** Everything a render layer may vary by device tier; terrain/decor density keys off `preset`. */
export interface QualityProfile {
  readonly preset: QualityPreset;
  readonly pixelRatio: number;
  readonly antialias: boolean;
  readonly shadowEnabled: boolean;
  readonly shadowMapSize: number;
  readonly maxOverlayItems: number;
  /** [night-04] Rendered frames per second cap; 0 = every display frame. */
  readonly maxFps: number;
  /** [night-04] 0..1 share of trees, rocks and city lights drawn. */
  readonly decorDensity: number;
  readonly batterySaver: boolean;
}

/** [night-04] Battery saver frame cap. */
export const SAVER_MAX_FPS = 30;
export const SAVER_DECOR_DENSITY = 0.6;

export const TONE_MAPPING_EXPOSURE = 1.05;

/**
 * [N12m] GPU families that start on `low` in auto (D-116): budget phones report 8 cores and 4 GB, so the
 * core/memory rule alone gives them `medium` and only visible stutter steps them down. Matched against the
 * unmasked renderer string, both the bare form ("Mali-G52 MC2", "Adreno (TM) 610", "PowerVR Rogue GE8320")
 * and Chrome's ANGLE wrapper ("ANGLE (ARM, Mali-G57 MC2, OpenGL ES 3.2)"). `MC`/`MP` is the core count.
 */
export const LOW_GPU_FAMILIES: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'Mali-G52', pattern: /\bMali-G52(?![0-9])(?!\s*M[CP]\s*[3-9])/i },
  { name: 'Mali-G57 MC1-2', pattern: /\bMali-G57\s*M[CP]\s*[12](?![0-9])/i },
  { name: 'Mali-G68 MC1-2', pattern: /\bMali-G68\s*M[CP]\s*[12](?![0-9])/i },
  { name: 'Mali-T8xx', pattern: /\bMali-T8[0-9]{2}\b/i },
  { name: 'PowerVR GE83xx', pattern: /\bPowerVR\b.*\bGE83[0-9]{2}\b/i },
  { name: 'Adreno 5xx', pattern: /\bAdreno\s*(?:\(TM\)\s*)?5[0-9]{2}\b/i },
  { name: 'Adreno 610/613', pattern: /\bAdreno\s*(?:\(TM\)\s*)?61[03]\b/i },
];

/** [N12m] Name of the matching low-end family, or null (unknown or capable GPU → the core/memory rule). */
export function lowGpuFamily(renderer: string | undefined): string | null {
  if (!renderer) return null;
  for (const family of LOW_GPU_FAMILIES) if (family.pattern.test(renderer)) return family.name;
  return null;
}

let gpuRendererCache: string | null | undefined;

/**
 * [N12m] Unmasked renderer of a throwaway WebGL context, read once per page and cached. Uses
 * `WEBGL_debug_renderer_info` when offered, else `RENDERER` (Chrome ≥ 121 returns the unmasked string there
 * too); the probe context is released at once. Never throws: no DOM, no WebGL or a denied extension → undefined.
 */
export function readGpuRenderer(): string | undefined {
  if (gpuRendererCache !== undefined) return gpuRendererCache ?? undefined;
  gpuRendererCache = null;
  if (typeof document === 'undefined') return undefined;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return undefined;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const value: unknown = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (typeof value === 'string' && value.trim()) gpuRendererCache = value.trim().slice(0, 200);
  } catch {
    gpuRendererCache = null;
  }
  return gpuRendererCache ?? undefined;
}

export function getDeviceHints(): DeviceHints {
  if (typeof navigator === 'undefined') return {};
  const device = navigator as Navigator & { deviceMemory?: number };
  return {
    hardwareConcurrency: device.hardwareConcurrency,
    deviceMemoryGb: device.deviceMemory,
    devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
    gpu: readGpuRenderer(),
  };
}

export function chooseQualityPreset(
  preference: QualityPreference = 'auto',
  hints: DeviceHints = getDeviceHints(),
): QualityPreset {
  if (preference === 'saver') return 'low';
  if (preference !== 'auto') return preference;
  if (lowGpuFamily(hints.gpu)) return 'low';
  const cores = hints.hardwareConcurrency ?? 6;
  const memory = hints.deviceMemoryGb ?? 6;
  if (cores <= 4 || memory <= 3) return 'low';
  if (cores >= 8 && memory >= 8) return 'high';
  return 'medium';
}

/** Persisting the preference belongs to the settings screen; pass it in here (D-33). */
export function resolveQualityProfile(
  preference: QualityPreference = 'auto',
  hints: DeviceHints = getDeviceHints(),
): QualityProfile {
  const preset = chooseQualityPreset(preference, hints);
  const cap = preset === 'high' ? 2 : preset === 'medium' ? 1.5 : 1;
  const reportedDpr = hints.devicePixelRatio ?? 1;
  const pixelRatio = Math.max(1, Math.min(2, cap, Number.isFinite(reportedDpr) ? reportedDpr : 1));
  const common = { pixelRatio, maxFps: 0, decorDensity: 1, batterySaver: false };
  if (preference === 'saver') {
    return { ...common, preset, pixelRatio: 1, antialias: false, shadowEnabled: false, shadowMapSize: 0,
      maxOverlayItems: 40, maxFps: SAVER_MAX_FPS, decorDensity: SAVER_DECOR_DENSITY, batterySaver: true };
  }
  if (preset === 'low') {
    return { ...common, preset, antialias: false, shadowEnabled: false, shadowMapSize: 0, maxOverlayItems: 40 };
  }
  // [ext-04] D-315: the globe and the world objects anti-alias every line in their shaders (SDF points/planes, ribbon,
  // limb), lights nothing and casts no shadows, so no preset pays for multisampling or a shadow map.
  if (preset === 'high') {
    return { ...common, preset, antialias: false, shadowEnabled: false, shadowMapSize: 0, maxOverlayItems: 80 };
  }
  return { ...common, preset, antialias: false, shadowEnabled: false, shadowMapSize: 0, maxOverlayItems: 60 };
}

/**
 * [night-04] Frame cap for `WorldRenderer.render`: true when this display frame should be drawn.
 * Tolerates vsync jitter, so 60 Hz draws every second frame and 120 Hz every fourth for 30 fps.
 */
export function frameDue(sinceLastMs: number, maxFps: number): boolean {
  return maxFps <= 0 || sinceLastMs >= 1000 / maxFps - 4;
}

/** One step down the adaptive ladder (auto quality only). */
export type AdaptiveStep = 'pixel-ratio' | 'decorations' | 'terrain';

/**
 * [night-04] Adaptive quality from frame time (D-73). Fed the interval between rendered frames;
 * when the median of a window stays above the budget for `strikes` windows in a row it asks for
 * one step down: DPR to 1, then fewer decorations, then a lower terrain preset. It never steps
 * back up during a session (no oscillation). [night-07b] The game remembers the steps between
 * sessions (D-74) and constructs the monitor with the remaining ladder. Pure: no clock, no DOM.
 */
export class AdaptiveQualityMonitor {
  private readonly samples: Float32Array;
  private filled = 0;
  private strikes = 0;
  private stepIndex = 0;
  private cooldown = 0;

  constructor(
    private readonly steps: readonly AdaptiveStep[],
    private readonly budgetMs = 1000 / 24,
    window = 60,
    private readonly strikesNeeded = 3,
  ) {
    this.samples = new Float32Array(window);
  }

  /** Steps still available. */
  get remaining(): number { return this.steps.length - this.stepIndex; }

  /** Returns the step to apply now, or null. Intervals > 250 ms (resume, hitch) are ignored. */
  push(intervalMs: number): AdaptiveStep | null {
    if (!(intervalMs > 0) || intervalMs > 250 || this.stepIndex >= this.steps.length) return null;
    if (this.cooldown > 0) { this.cooldown--; return null; }
    this.samples[this.filled++] = intervalMs;
    if (this.filled < this.samples.length) return null;
    this.filled = 0;
    const sorted = Array.from(this.samples).sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    this.strikes = median > this.budgetMs ? this.strikes + 1 : 0;
    if (this.strikes < this.strikesNeeded) return null;
    this.strikes = 0;
    // Let the new setting settle (a terrain rebuild hitches) before judging again.
    this.cooldown = this.samples.length;
    return this.steps[this.stepIndex++];
  }
}

/** Adaptive ladder for a resolved profile: only steps that would change something. */
export function adaptiveSteps(profile: QualityProfile): AdaptiveStep[] {
  const steps: AdaptiveStep[] = [];
  if (profile.pixelRatio > 1) steps.push('pixel-ratio');
  if (profile.decorDensity > SAVER_DECOR_DENSITY) steps.push('decorations');
  if (profile.preset !== 'low') steps.push('terrain');
  return steps;
}

/**
 * [night-07b] Apply steps already taken (e.g. remembered from an earlier session, D-74) to a fresh
 * profile. Only a prefix of `adaptiveSteps(profile)` is honoured; anything else returns null so a
 * stale or foreign record never changes quality.
 */
export function applyAdaptiveSteps(profile: QualityProfile, taken: readonly AdaptiveStep[]): QualityProfile | null {
  const ladder = adaptiveSteps(profile);
  if (taken.length > ladder.length) return null;
  for (let i = 0; i < taken.length; i++) if (taken[i] !== ladder[i]) return null;
  let next = profile;
  for (const step of taken) {
    if (step === 'pixel-ratio') next = { ...next, pixelRatio: 1 };
    else if (step === 'decorations') next = { ...next, decorDensity: SAVER_DECOR_DENSITY };
    else {
      next = { ...next, preset: next.preset === 'high' ? 'medium' : 'low', shadowEnabled: false, shadowMapSize: 0 };
    }
  }
  return next;
}

/**
 * The only place that configures a WebGLRenderer: DPR (never above 2), shadows, colour
 * pipeline. Context antialiasing must be chosen at WebGLRenderer construction time.
 */
export function applyQualityProfile(renderer: WebGLRenderer, profile: QualityProfile): void {
  renderer.setPixelRatio(Math.min(2, profile.pixelRatio));
  renderer.shadowMap.enabled = profile.shadowEnabled;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
}

export type FrameCallback = (timestampMs: number, elapsedMs: number) => void;

/**
 * Keeps requestAnimationFrame alive while visible, but skips alternate display frames at rest.
 * Uses one persistent callback and no per-frame vectors, closures or arrays.
 * Visibility stops the RAF entirely; no simulation catch-up is performed here.
 */
export class AdaptiveFrameScheduler {
  private requestId = 0;
  private lastRenderedAt = 0;
  private activeUntil = 0;
  private interacting = false;
  private disposed = false;

  private readonly onFrame = (timestampMs: number): void => {
    this.requestId = 0;
    if (this.disposed || document.hidden) return;
    const idle = !this.interacting && timestampMs >= this.activeUntil;
    const minimumInterval = idle ? 1000 / 30 : 0;
    const elapsed = timestampMs - this.lastRenderedAt;

    if (this.lastRenderedAt === 0 || elapsed + 1 >= minimumInterval) {
      const delta = this.lastRenderedAt === 0 ? minimumInterval || 1000 / 60 : Math.min(250, elapsed);
      this.lastRenderedAt = timestampMs;
      this.paint(timestampMs, delta);
    }
    this.requestId = requestAnimationFrame(this.onFrame);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      if (this.requestId !== 0) cancelAnimationFrame(this.requestId);
      this.requestId = 0;
      this.lastRenderedAt = 0;
    } else if (!this.disposed && this.requestId === 0) {
      this.requestId = requestAnimationFrame(this.onFrame);
    }
  };

  private readonly onPointerDown = (): void => { this.setInteracting(true); };
  private readonly onPointerUp = (): void => { this.setInteracting(false); };
  private readonly onActivity = (): void => { this.markActivity(); };

  constructor(
    private readonly host: HTMLElement,
    private readonly paint: FrameCallback,
  ) {
    host.addEventListener('pointerdown', this.onPointerDown);
    host.addEventListener('pointermove', this.onActivity);
    host.addEventListener('wheel', this.onActivity, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onActivity);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    if (!document.hidden) this.requestId = requestAnimationFrame(this.onFrame);
  }

  markActivity(): void {
    this.activeUntil = performance.now() + 350;
  }

  setInteracting(value: boolean): void {
    this.interacting = value;
    this.markActivity();
  }

  get paused(): boolean {
    return document.hidden || this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.requestId !== 0) cancelAnimationFrame(this.requestId);
    this.requestId = 0;
    this.host.removeEventListener('pointerdown', this.onPointerDown);
    this.host.removeEventListener('pointermove', this.onActivity);
    this.host.removeEventListener('wheel', this.onActivity);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onActivity);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
