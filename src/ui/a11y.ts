// Accessibility settings (task 20): text scale, enhanced glyphs and haptics, read by the settings screen,
// haptics and the composition root. [night-12q] R5i: the unused city announcer and action-label adapters were
// removed (overlays and the HUD label their own buttons through i18n).

export type TextScale = 100 | 115 | 130;
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
  return value === 115 || value === 130 ? value : 100;
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
