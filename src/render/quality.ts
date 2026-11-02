// The single render-only quality system (task 21). The simulation never reads device capabilities.
import {
  ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace, type WebGLRenderer,
} from 'three';

export type QualityPreset = 'low' | 'medium' | 'high';
export type QualityPreference = QualityPreset | 'auto';

export interface DeviceHints {
  hardwareConcurrency?: number;
  deviceMemoryGb?: number;
  devicePixelRatio?: number;
}

/** Everything a render layer may vary by device tier; terrain/decor density keys off `preset`. */
export interface QualityProfile {
  readonly preset: QualityPreset;
  readonly pixelRatio: number;
  readonly antialias: boolean;
  readonly shadowEnabled: boolean;
  readonly shadowMapSize: number;
  readonly maxOverlayItems: number;
}

export const TONE_MAPPING_EXPOSURE = 1.05;

export function getDeviceHints(): DeviceHints {
  if (typeof navigator === 'undefined') return {};
  const device = navigator as Navigator & { deviceMemory?: number };
  return {
    hardwareConcurrency: device.hardwareConcurrency,
    deviceMemoryGb: device.deviceMemory,
    devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
  };
}

export function chooseQualityPreset(
  preference: QualityPreference = 'auto',
  hints: DeviceHints = getDeviceHints(),
): QualityPreset {
  if (preference !== 'auto') return preference;
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
  if (preset === 'low') {
    return { preset, pixelRatio, antialias: false, shadowEnabled: false, shadowMapSize: 0, maxOverlayItems: 40 };
  }
  if (preset === 'high') {
    return { preset, pixelRatio, antialias: true, shadowEnabled: true, shadowMapSize: 2048, maxOverlayItems: 80 };
  }
  return { preset, pixelRatio, antialias: true, shadowEnabled: false, shadowMapSize: 0, maxOverlayItems: 60 };
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
