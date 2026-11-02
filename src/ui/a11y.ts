// [task-20] Accessibility adapters. HUD (13) and airport overlays (06) bind to these APIs on mount.
import { t, type TranslationKey } from '../i18n';

export type TextScale = 100 | 115 | 130;
export interface AccessibilitySettings {
  textScale: TextScale;
  enhancedGlyphs: boolean;
  hapticsEnabled: boolean;
}
export interface CityStatus {
  name: string;
  waiting: number;
  hubCapacity?: number;
  jammed?: boolean;
}
export type AirportAction = 'undo' | 'turboprop' | 'widebody' | 'hub' |
  'speed' | 'pause' | 'resume' | 'menu' | 'settings' | 'back';

const SETTINGS_KEY = 'airway.settings';
const DEFAULT_SETTINGS: Readonly<AccessibilitySettings> = Object.freeze({
  textScale: 100,
  enhancedGlyphs: false,
  hapticsEnabled: true,
});
const ACTION_KEYS: Record<AirportAction, TranslationKey> = {
  undo: 'a11y.action.undo',
  turboprop: 'a11y.action.turboprop',
  widebody: 'a11y.action.widebody',
  hub: 'a11y.action.hub',
  speed: 'a11y.action.speed',
  pause: 'action.pause',
  resume: 'action.resume',
  menu: 'a11y.action.menu',
  settings: 'a11y.action.settings',
  back: 'a11y.action.back',
};
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

/** Set translated action names on native buttons (dock and split-flap menu). */
export function labelAirportActions(container: ParentNode): number {
  let count = 0;
  for (const element of container.querySelectorAll<HTMLElement>('[data-airway-action]')) {
    const action = element.dataset.airwayAction as AirportAction | undefined;
    if (!action || !Object.prototype.hasOwnProperty.call(ACTION_KEYS, action)) continue;
    element.setAttribute('aria-label', t(ACTION_KEYS[action]));
    count++;
  }
  return count;
}
function cityCondition(city: CityStatus, waiting: number): string {
  if (city.jammed) return t('a11y.cityJammed');
  const capacity = city.hubCapacity;
  if (capacity === undefined || !Number.isFinite(capacity) || capacity <= 0) {
    return t('a11y.cityAirport');
  }
  if (waiting >= capacity) return t('a11y.cityJammed');
  if (waiting >= capacity * 0.8) return t('a11y.cityBusy');
  return t('a11y.cityNormal');
}
export function describeCity(city: CityStatus): string {
  const waiting = Number.isSafeInteger(city.waiting) ? Math.max(0, city.waiting) : 0;
  return t('a11y.cityDescription', { city: city.name, waiting, state: cityCondition(city, waiting) });
}

/** Polite status region; only announce on user selection, never during each render frame. */
export function createCityAnnouncer(container: HTMLElement): {
  announce: (city: CityStatus) => void;
  dispose: () => void;
} {
  const region = document.createElement('div');
  region.className = 'airway-sr-only';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  container.appendChild(region);
  let disposed = false;
  return {
    announce(city) {
      if (disposed) return;
      const message = describeCity(city);
      region.textContent = '';
      queueMicrotask(() => { if (!disposed) region.textContent = message; });
    },
    dispose() { disposed = true; region.remove(); },
  };
}

/** Attach to an airport hit target once, update its accessible state at simulation ticks. */
export function bindCityAccessibility(
  element: HTMLElement,
  initial: CityStatus,
  onActivate: () => void,
  announcer: ReturnType<typeof createCityAnnouncer>,
): { update: (city: CityStatus) => void; dispose: () => void } {
  let current = initial;
  const nativeButton = element.tagName === 'BUTTON';
  if (!nativeButton) {
    element.setAttribute('role', 'button');
    if (element.tabIndex < 0) element.tabIndex = 0;
  }
  element.setAttribute('aria-label', describeCity(current));
  const click = () => {
    onActivate();
    announcer.announce(current);
  };
  const key = (event: KeyboardEvent) => {
    if (!nativeButton && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (!event.repeat) element.click();
    }
  };
  element.addEventListener('click', click);
  if (!nativeButton) element.addEventListener('keydown', key);
  return {
    update(city) {
      if (city.name === current.name && city.waiting === current.waiting &&
        city.hubCapacity === current.hubCapacity && city.jammed === current.jammed) return;
      current = city;
      element.setAttribute('aria-label', describeCity(current));
    },
    dispose() {
      element.removeEventListener('click', click);
      if (!nativeButton) element.removeEventListener('keydown', key);
    },
  };
}

/** Mountable settings fragment for task 14 menu; no synthetic HUD while task 13 is missing. */
export function createAccessibilityControls(): HTMLElement {
  const form = document.createElement('fieldset');
  form.className = 'airway-a11y-controls';
  const legend = document.createElement('legend');
  legend.textContent = t('a11y.settingsTitle');
  form.appendChild(legend);
  const scaleLabel = document.createElement('label');
  scaleLabel.textContent = t('a11y.textScale');
  const scale = document.createElement('select');
  for (const value of [100, 115, 130] as const) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = value + '%';
    scale.appendChild(option);
  }
  scale.value = String(readAccessibilitySettings().textScale);
  scale.addEventListener('change', () => {
    updateAccessibilitySettings({ textScale: validScale(Number(scale.value)) });
  });
  scaleLabel.appendChild(scale);
  form.appendChild(scaleLabel);
  const addCheck = (key: TranslationKey, field: 'enhancedGlyphs' | 'hapticsEnabled') => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = readAccessibilitySettings()[field];
    input.addEventListener('change', () => updateAccessibilitySettings({ [field]: input.checked }));
    label.append(input, document.createTextNode(t(key)));
    form.appendChild(label);
  };
  addCheck('a11y.enhancedGlyphs', 'enhancedGlyphs');
  addCheck('a11y.haptics', 'hapticsEnabled');
  return form;
}
