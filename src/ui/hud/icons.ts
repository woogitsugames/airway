/**
 * Original inline SVG symbols drawn for Airway (no external icon set or emoji). [night-11az] D-257 "Róża": the chart
 * symbol set of the KARTA v2 mockups (mockups/ui-2026-11/v2/common.js, SYM), stroke-based in currentColor:
 * undo = a course line that turns back on itself; turboprop = a straight wing with two propeller discs; widebody = a
 * swept wing with four engine pods; hub = a three-runway pattern in a ring; satellite = a sheet corner with a curved
 * graticule (the photo globe), map = the same corner with a straight grid; speed = a track arrow whose barbs count the
 * tempo like a wind barb (one barb per 1×); pause = two bars; resume = a course triangle.
 */
const S = 'fill="none" stroke="currentColor"';
const paths = {
  undo: `<path d="M-12 10H4A8.5 8.5 0 0 0 4-7H-10" ${S} stroke-width="3" stroke-linejoin="round"/><path d="M-5-13-12-7-5-1" ${S} stroke-width="3"/>`,
  turboprop: `<path d="M0-16V15M-16-3H16M-6 13H6" ${S} stroke-width="3"/><circle cx="-9" cy="-7" r="3.2" ${S} stroke-width="2.4"/><circle cx="9" cy="-7" r="3.2" ${S} stroke-width="2.4"/>`,
  widebody: `<path d="M0-17V16M-18 6 0-4 18 6M-7 15 0 11 7 15" ${S} stroke-width="3"/><path d="M-11 0v5M-6-3v5M6-3v5M11 0v5" ${S} stroke-width="3"/>`,
  hub: `<circle r="15" ${S} stroke-width="2.4"/><path d="M-5-10 3 10M3-10 11 6M-10 4 9-4" ${S} stroke-width="3.4"/>`,
  satellite: `<path d="M-16 16V-16H16" ${S} stroke-width="3"/><path d="M-16 4Q0-2 16 4M-16-6Q0-11 16-6M-6-16Q-9 0-6 16M5-16Q2 0 5 16" ${S} stroke-width="1.8"/>`,
  map: `<path d="M-16 16V-16H16" ${S} stroke-width="3"/><path d="M-16 4H16M-16-6H16M-6-16V16M5-16V16" ${S} stroke-width="1.8"/>`,
  speed: `<path d="M-16 0H15M8-6 15 0 8 6" ${S} stroke-width="3"/>`,
  pause: `<path d="M-6-12V12M6-12V12" ${S} stroke-width="4.5"/>`,
  resume: '<path d="M-7-13 12 0-7 13z" fill="currentColor"/>',
} as const;

export type HudIcon = keyof typeof paths;
/** `barbs` (speed only): one wind-barb stroke per 1× of game speed. */
export function iconSvg(name: HudIcon, barbs = 1): string {
  const extra = name === 'speed'
    ? Array.from({ length: Math.max(1, barbs) }, (_, i) => `<path d="M${-14 + i * 6} 0 ${-19 + i * 6}-10" ${S} stroke-width="3"/>`).join('')
    : '';
  return `<svg class="airway-hud__icon" viewBox="-20 -20 40 40" aria-hidden="true" focusable="false"><g fill="currentColor">${paths[name]}${extra}</g></svg>`;
}
