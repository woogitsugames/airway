// Destination glyph SVGs for in-world luggage tags (task 06). Shapes and colours come from
// the single source of truth in src/data/regions.ts (D-08); nothing is redefined here.
import { GLYPH_PATHS, REGIONS, type RegionId } from '../data/regions';
import './skin/current.css'; // [night-11as] the glyph outline is a skin token

export type DestinationRegion = RegionId;
const SVG = 'http://www.w3.org/2000/svg';

export function isDestinationRegion(value: string): value is DestinationRegion {
  return Object.hasOwn(REGIONS, value);
}

export function regionGlyphPath(region: DestinationRegion): string {
  return GLYPH_PATHS[REGIONS[region].glyph];
}

/** Construct only when waiting passengers change, never from the animation frame. */
export function regionGlyph(region: DestinationRegion, size = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '-7 -7 14 14');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.dataset.airwayDestination = region;
  svg.classList.add('airport-region-glyph');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', regionGlyphPath(region));
  path.setAttribute('fill', REGIONS[region].color);
  // [night-11as] D-250 follow-up: skin token (src/ui/skin/current.css), an inline style so it resolves var().
  path.style.stroke = 'var(--skin-glyph-outline)';
  path.setAttribute('stroke-width', '1');
  path.setAttribute('paint-order', 'stroke');
  svg.appendChild(path);
  return svg;
}
