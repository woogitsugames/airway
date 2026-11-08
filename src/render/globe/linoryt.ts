// [ext-04 E1] D-283 "Linoryt": the globe as one relief print in three inks on paper
// (docs/notes/linoryt-render-spec.md §1–§4, §9). This module is pure data and math, so the UI and the headless
// tests can import the inks and the hatch rules without three.js; the material lives in `linoryt-globe.ts`.

/** §1 The only inks of the printed world (sRGB). Red is for a jam and nothing else. */
export const LINORYT_INKS = {
  paper: '#ECE3CC',
  ink: '#1E1C1F',
  blue: '#2B4A66',
  ochre: '#D29C47',
  red: '#B33823',
} as const;
export type LinorytInk = keyof typeof LINORYT_INKS;

/** §4 The sky is paper, so the HUD and dock margins of the Linoryt skin melt into it. */
export const SKY_COLOUR = LINORYT_INKS.paper;

/**
 * Hatch periods are 360° / 2^n (22.5°, 11.25°, … 0.088°): every octave closes on itself around the globe, so the
 * longitude-based families (rhumb lines at ±45°) have no seam at the antimeridian. D-298.
 */
export const HATCH_BASE_PERIOD_DEG = 22.5;
/** §2 Screen spacing of the finer octave in CSS px: [min, 2·min). `saver` keeps the lines wider (one octave less). */
export const HATCH_MIN_SPACING_PX = 4;
export const HATCH_SAVER_MIN_SPACING_PX = 6;
/** [ext-04 E3] D-300: open-sea parallels are one step sparser on every preset (they competed with stamps and notes). */
export const HATCH_SEA_MIN_SPACING_PX = 6;
/** §9 No line pattern may reach the screen with a period below this many device pixels (it fades to its mean). */
export const HATCH_ALIAS_FLOOR_DEVICE_PX = 3;
/** §2–§4 No hatch line is drawn thinner than this many device pixels (anti-aliased with the screen derivative). */
export const HATCH_MIN_WIDTH_DEVICE_PX = 1.5;

export interface HatchOctaves {
  /** Halvings of the base period used by the finer octave (0 = 22.5°). */
  readonly halvings: number;
  /** Periods in degrees of the finer and the coarser octave (coarse = 2 × fine). */
  readonly fineDeg: number;
  readonly coarseDeg: number;
  /** Screen periods in device px. */
  readonly finePx: number;
  readonly coarsePx: number;
  /** Cross-fade weights (sum to 1): the finer octave fades in as its spacing grows from min to 2·min. */
  readonly fineWeight: number;
  readonly coarseWeight: number;
  /** 1 = lines drawn; → 0 when even the coarsest octave would fall under the alias floor (drawn as its mean). */
  readonly lineVisibility: number;
}

const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * The octave pair for a pattern whose base period spans `basePx` device pixels on screen. Mirrors `awHatch` in the
 * shader line by line (the shader takes `basePx` from the screen derivative of each pixel).
 */
export function hatchOctaves(basePx: number, dpr: number, minSpacingCssPx = HATCH_MIN_SPACING_PX): HatchOctaves {
  const min = minSpacingCssPx * dpr;
  const halvings = Math.max(0, Math.floor(Math.log2(Math.max(basePx, 1e-6) / min)));
  const scale = 2 ** halvings;
  const finePx = basePx / scale;
  const fineWeight = Math.max(0, Math.min(1, Math.log2(finePx / min)));
  const coarsePx = finePx * 2;
  return {
    halvings, fineDeg: HATCH_BASE_PERIOD_DEG / scale, coarseDeg: HATCH_BASE_PERIOD_DEG * 2 / scale,
    finePx, coarsePx, fineWeight, coarseWeight: 1 - fineWeight,
    lineVisibility: smooth(HATCH_ALIAS_FLOOR_DEVICE_PX, HATCH_ALIAS_FLOOR_DEVICE_PX * 2, coarsePx),
  };
}

/** Line width in device px from a CSS width (never under the 1.5 device px floor). */
export function hatchWidthPx(cssPx: number, dpr: number): number {
  return Math.max(HATCH_MIN_WIDTH_DEVICE_PX, cssPx * dpr);
}

/** §2 Sea lines: 0.8 px on the night side → 2.2 px under the sun (cosine of the angle to the sun, 0..1). */
export function seaLineWidthCss(sunCos: number): number {
  return 0.8 + (2.2 - 0.8) * Math.max(0, Math.min(1, sunCos));
}

/** §4 Night hatch: 0 at the terminator (sun 0°), full at −12° (nautical night). `sunSin` = sine of the sun's elevation. */
export const NIGHT_FULL_SUN_DEG = -12;
export function nightCoverage(sunSin: number): number {
  return Math.max(0, Math.min(1, -sunSin / Math.sin(-NIGHT_FULL_SUN_DEG * Math.PI / 180)));
}
/** §4 Night line width 1.0 → 2.0 px CSS with the coverage. */
export function nightLineWidthCss(coverage: number): number {
  return 1 + Math.max(0, Math.min(1, coverage));
}

/** §3 Relief hatch from the Imhof shadow (1 − hillshade, light from 315° at 45°; flat ground = 0). */
export function reliefCoverage(shadow: number): number {
  return smooth(0.15, 0.6, shadow);
}
export function reliefLineWidthCss(coverage: number): number {
  return 0.9 + (2.4 - 0.9) * Math.max(0, Math.min(1, coverage));
}

/**
 * §2 Water lines along the coast, as CSS px from the shore at the centre of the disc (constant on screen, so they
 * follow the octaves instead of collapsing into the coast when zoomed out). The coast field holds ±3°.
 */
export const WATER_LINES_PX = [3.5, 7.5, 12] as const;
export const COAST_FIELD_RANGE_DEG = 3;
/** The last water line never lies further out than this (degrees; the field holds 3°). */
export const WATER_LINES_MAX_DEG = 2.6;
/** Degrees per CSS px for the water lines: constant on screen, capped by the field's range. */
export function waterLineScale(pxPerDegreeCss: number): number {
  const last = WATER_LINES_PX[WATER_LINES_PX.length - 1];
  const wanted = 1 / Math.max(1e-3, pxPerDegreeCss);
  return Math.min(wanted, WATER_LINES_MAX_DEG / last);
}
/** §3 Coastline width in CSS px: 1.5, 2 from zoom 3. */
export function coastWidthCss(zoom: number): number {
  return zoom >= 3 ? 2 : 1.5;
}

/** §4 Atmosphere lines on the paper sky: offset from the limb (share of the globe radius) and width (CSS px). */
export const ATMOSPHERE_LINES: readonly { readonly offset: number; readonly widthPx: number }[] = [
  { offset: 0.007, widthPx: 1.2 }, { offset: 0.016, widthPx: 0.9 }, { offset: 0.028, widthPx: 0.7 },
];
/** §4 The inked limb ring, CSS px. */
export const LIMB_RING_PX = 2.5;

/** §5/§8 Airport stamp side in CSS px, constant on screen (regular square / hub octagon across its flats). E2. */
export const STAMP_SIZE_PX = { airport: 22, hub: 30 } as const;
