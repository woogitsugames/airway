// Original six destination glyphs from the selected Diorama mockup (D-08).
export const REGION_GLYPHS = {
  NAM: { path: 'M-6 6 L6 6 L6 2.5 L-1 -6 L-6 -6Z', color: '#0072B2' },
  SAM: { path: 'M-6 -6 L-1.5 -6 L-1.5 1.5 L6 1.5 L6 6 L-6 6Z', color: '#56B4E9' },
  EUN: { path: 'M-6 -5 L0 1 L6 -5 L6 0 L0 6 L-6 0Z', color: '#009E73' },
  EUS: { path: 'M2.5 -5.45 A6 6 0 1 0 2.5 5.45 A6.6 6.6 0 0 1 2.5 -5.45Z', color: '#E69F00' },
  AFR: { path: 'M0 -6.2 A3.4 3.4 0 1 1 0 0.6 A3.4 3.4 0 1 1 0 -6.2Z M-1.7 -1 L1.7 -1 L3.4 6 L-3.4 6Z', color: '#13302E' },
  ME: { path: 'M-6 -5.5 L0 0 L-6 5.5Z M6 -5.5 L0 0 L6 5.5Z', color: '#CC79A7' },
} as const;

export type DestinationRegion = keyof typeof REGION_GLYPHS;
const SVG = 'http://www.w3.org/2000/svg';

/** Construct only when waiting passengers change, never from the animation frame. */
export function regionGlyph(region: DestinationRegion): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '-7 -7 14 14');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('airport-region-glyph');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', REGION_GLYPHS[region].path);
  path.setAttribute('fill', REGION_GLYPHS[region].color);
  path.setAttribute('stroke', '#FBF8F1');
  path.setAttribute('stroke-width', '1');
  path.setAttribute('paint-order', 'stroke');
  svg.appendChild(path);
  return svg;
}
