// Accessibility settings (task 20): text scale, enhanced glyphs and haptics, read by the settings screen,
// haptics and the composition root. [night-12q] R5i: the unused city announcer and action-label adapters were
// removed (overlays and the HUD label their own buttons through i18n).

export type TextScale = 100 | 115 | 130 | 150;
/** [night-11ap] R1g: the steps offered in Settings → Display, smallest first. */
export const TEXT_SCALES: readonly TextScale[] = [100, 115, 130, 150];
export interface AccessibilitySettings {
  textScale: TextScale;
  enhancedGlyphs: boolean;
  hapticsEnabled: boolean;
}

const SETTINGS_KEY = 'airway.settings';
const DEFAULT_SETTINGS: Readonly<AccessibilitySettings> = Object.freeze({
  textScale: 100,
  enhancedGlyphs: false,
  hapticsEnabled: true,
});
let memorySettings: AccessibilitySettings | null = null;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function readStoredRecord(): Record<string, unknown> {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    return raw ? record(JSON.parse(raw) as unknown) : {};
  } catch {
    return {};
  }
}
function validScale(value: unknown): TextScale {
  return TEXT_SCALES.includes(value as TextScale) ? value as TextScale : 100;
}

/**
 * [night-11ap] R1g: the step nearest to a system text factor (1 = the OS default). Below the default stays 100;
 * anything from about 1.4 up (Android 1.5/1.8/2.0, iOS accessibility sizes) is the largest step, 150.
 */
export function textScaleForSystem(factor: number | null): TextScale {
  if (factor === null || !Number.isFinite(factor) || factor <= 1) return 100;
  let best: TextScale = 100;
  for (const step of TEXT_SCALES) if (Math.abs(step / 100 - factor) < Math.abs(best / 100 - factor)) best = step;
  return best;
}

/**
 * [night-11ap] R1g: on the first launch only (no `textScale` stored yet) take the system text size as the
 * starting step and store it; an explicit choice in Settings is stored too, so it always wins afterwards. A
 * failed or empty read stores nothing and the next launch asks again.
 */
export async function presetTextScaleFromSystem(
  read: () => Promise<number | null>, root?: HTMLElement,
): Promise<TextScale | null> {
  if ('textScale' in readStoredRecord() || memorySettings) return null;
  let factor: number | null;
  try {
    factor = await read();
  } catch {
    return null;
  }
  if (factor === null || 'textScale' in readStoredRecord() || memorySettings) return null;
  return updateAccessibilitySettings({ textScale: textScaleForSystem(factor) }, root).textScale;
}
function settingsFrom(value: Record<string, unknown>): AccessibilitySettings {
  return {
    textScale: validScale(value.textScale),
    enhancedGlyphs: typeof value.enhancedGlyphs === 'boolean'
      ? value.enhancedGlyphs : DEFAULT_SETTINGS.enhancedGlyphs,
    hapticsEnabled: typeof value.hapticsEnabled === 'boolean'
      ? value.hapticsEnabled : DEFAULT_SETTINGS.hapticsEnabled,
  };
}
export function readAccessibilitySettings(): AccessibilitySettings {
  if (memorySettings) return { ...memorySettings };
  return settingsFrom(readStoredRecord());
}
export function applyAccessibilitySettings(
  settings: AccessibilitySettings,
  root?: HTMLElement,
): void {
  const element = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!element) return;
  element.style.setProperty('--airway-text-scale', String(settings.textScale / 100));
  element.dataset.airwayCvd = settings.enhancedGlyphs ? 'enhanced' : 'default';
  element.dataset.airwayTextScale = String(settings.textScale);
}
export function updateAccessibilitySettings(
  patch: Partial<AccessibilitySettings>, root?: HTMLElement,
): AccessibilitySettings {
  const prev = readAccessibilitySettings();
  const next = settingsFrom({ ...prev, ...patch });
  memorySettings = next;
  try {
    // Preserve the language field and any settings owned by other tasks.
    globalThis.localStorage?.setItem(SETTINGS_KEY,
      JSON.stringify({ ...readStoredRecord(), ...next }));
  } catch {
    // Keep working for this session if storage is blocked.
  }
  applyAccessibilitySettings(next, root);
  return { ...next };
}
/** [night-11ap] Forget the in-memory settings so the next read comes from storage (tests; a reload does the same). */
export function resetAccessibilityCache(): void {
  memorySettings = null;
}
export function initializeAccessibility(root?: HTMLElement): () => void {
  applyAccessibilitySettings(readAccessibilitySettings(), root);
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === SETTINGS_KEY) {
      memorySettings = null;
      applyAccessibilitySettings(readAccessibilitySettings(), root);
    }
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
