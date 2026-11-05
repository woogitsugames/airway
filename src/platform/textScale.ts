/**
 * [night-11ap] R1g: the operating system's text size as a factor (1 = default), read once on first launch to
 * preset the game's own text scale (src/ui/a11y.ts `presetTextScaleFromSystem`). Android: the `AirwayTextScale`
 * plugin returns `Configuration.fontScale`. iOS (WKWebView) and browsers: the computed size of the Dynamic Type
 * body font (`-apple-system-body`, 17 px at the default size) or, elsewhere, of the browser's `medium` font
 * (16 px by default). Never throws; null when nothing can be read.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

export const TEXT_SCALE_PLUGIN = 'AirwayTextScale';
interface TextScalePluginPort { get(): Promise<{ scale?: unknown }> }

const IOS_BODY_PX = 17;
const WEB_MEDIUM_PX = 16;

function plausible(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 4 ? value : null;
}

/** Computed px size of `font` on a hidden probe; null without a DOM. */
function probe(font: string): number | null {
  if (typeof document === 'undefined' || !document.body) return null;
  const element = document.createElement('span');
  element.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;font:${font}`;
  element.textContent = 'A';
  document.body.append(element);
  try {
    return Number.parseFloat(getComputedStyle(element).fontSize) || null;
  } finally {
    element.remove();
  }
}

/** iOS / browser factor from a computed probe; exported for the headless test. */
export function factorFromProbe(px: number | null, base: number): number | null {
  return px === null ? null : plausible(Math.round((px / base) * 100) / 100);
}

export async function systemTextScale(): Promise<number | null> {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      if (!Capacitor.isPluginAvailable(TEXT_SCALE_PLUGIN)) return null;
      const { scale } = await registerPlugin<TextScalePluginPort>(TEXT_SCALE_PLUGIN).get();
      return plausible(scale);
    }
    if (Capacitor.getPlatform() === 'ios') return factorFromProbe(probe('-apple-system-body'), IOS_BODY_PX);
    return factorFromProbe(probe('medium sans-serif'), WEB_MEDIUM_PX);
  } catch {
    return null;
  }
}
