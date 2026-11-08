// [night-70a R1] D-323: the realistic NASA globe (`?look=earth`, DEV only until the flip): pure data and math, so the
// headless tests can check the presets, the texture choice and the terminator without three.js. The material and the
// lazy texture upgrade live in `earth-globe.ts` (a lazy chunk a release build folds away while the look is a preview).
import type { QualityProfile } from '../quality';

/** Files under public/data/globe/ (manifest.json, `npm run test:globe-assets`). Baked by dev/globe-look/bake-earth.py. */
export const EARTH_TEXTURES = {
  day: { 4096: 'day-4096.webp', 2048: 'day-2048.webp' },
  night: { 2048: 'night-2048.webp', 1024: 'night-1024.webp' },
} as const;

export type EarthDaySize = keyof typeof EARTH_TEXTURES.day;
export type EarthNightSize = keyof typeof EARTH_TEXTURES.night;

/** What a preset draws (PLAN-NOWY-KIERUNEK.md R1, D-73/D-116). */
export interface EarthPreset {
  /** Texture the globe starts with (fast first frame). */
  readonly startDay: EarthDaySize;
  readonly startNight: EarthNightSize;
  /** Texture swapped in after the first frame (equal to the start size = no upgrade). */
  readonly day: EarthDaySize;
  readonly night: EarthNightSize;
  /** Sun glint on the sea (one specular term in the globe shader). */
  readonly glint: boolean;
  /** Thin atmosphere shell around the limb (one additive, transparent draw). The limb haze in the globe shader stays. */
  readonly shell: boolean;
  /** Faint star field (one opaque point draw). */
  readonly stars: boolean;
}

/** low/saver: 2048 + 1024, no glint, no shell; medium: 4096 + 2048; high: medium + glint + shell. */
export function earthPreset(profile: Pick<QualityProfile, 'preset' | 'batterySaver'>): EarthPreset {
  if (profile.batterySaver || profile.preset === 'low') {
    return { startDay: 2048, startNight: 1024, day: 2048, night: 1024, glint: false, shell: false, stars: false };
  }
  const high = profile.preset === 'high';
  return { startDay: 2048, startNight: 1024, day: 4096, night: 2048, glint: high, shell: high, stars: true };
}

/**
 * Colours and strengths of the look (sRGB, the shader works on the textures as stored, like the K2 mockup). One set
 * for day and night: day and night are game state (the terminator follows the game clock), not two gradings.
 */
export const EARTH_LOOK = {
  /** Space behind the globe (K2 "Nawigacja nocna"). */
  space: '#010306',
  /** Limb haze and shell colour on the lit side. */
  atmosphere: '#86ABD9',
  /** Black Marble city lights gain. */
  nightGain: 1.55,
  /** Moonlight on the night side (share of the day colour). */
  moon: 0.05,
  /** Gamma on the day image (< 1 lifts the mid tones). */
  grade: 0.92,
  /** Limb haze (lit side only). */
  haze: 0.5,
  /** Atmosphere shell strength (high only); kept low: no neon rim. */
  shellStrength: 0.75,
  /** Shell radius (globe = 1); exaggerated ~2× so it reads at phone size. */
  shellRadius: 1.02,
  /** Relief: slope gain of the ETOPO5 gradient on the lit side. */
  relief: 0.6,
} as const;

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Terminator weights for a surface point whose normal makes `sunCos` (cos of the angle) with the subsolar direction.
 * Mirrors the shader line by line: night lights fade in from sun elevation ≈ +3° to ≈ −8°; the warm dusk band is
 * narrow (≈ −11° … +9°) and only tints the lit colour (no glow added to the night side).
 */
export function earthNightWeight(sunCos: number): number {
  return 1 - smooth(-0.14, 0.06, sunCos);
}
export function earthDuskWeight(sunCos: number): number {
  return smooth(-0.2, -0.01, sunCos) * (1 - smooth(-0.01, 0.16, sunCos));
}
/** Direct light on the day image (0 night … 1 noon), before the relief. */
export function earthDayLight(sunCos: number): number {
  return Math.pow(Math.max(0, Math.min(1, sunCos * 2.2 + 0.1)), 0.6);
}
