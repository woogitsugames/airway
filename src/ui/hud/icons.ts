/** Original, inline SVG silhouettes (no external icon set or emoji). */
const paths = {
  undo: '<path d="M9 8a10 10 0 1 0-16-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M-12-7v10h10z"/>',
  turboprop: '<path d="M0-15L3-4 13 2V5L3 3 2 12 7 15v2L0 15-7 17v-2l5-3 1-9-10 2V2L-3-4z"/><path d="M-10-3v11m20-11v11" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  widebody: '<path d="M0-18c2 0 3 3 3 5l1 10 14 9v4L4 7l-1 7 5 4v3l-8-2-8 2v-3l5-4-1-7-14 3V6l14-9 1-10c0-2 1-5 3-5z"/><path d="M-13 4v6m26-6v6" fill="none" stroke="currentColor" stroke-width="2.6"/>',
  hub: '<circle r="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M0-16v7 M11-11l-5 5 M16 0H9 M11 11L6 6 M0 16V9 M-11 11l5-5 M-16 0h7 M-11-11l5 5" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
  speed: '<path d="M-14-12L-1 0l-13 12z M1-12L14 0 1 12z"/>',
  // [G8] D-172: the current globe view — a lit globe with meridians (Satelita) or a folded map (Mapa).
  satellite: '<circle r="14" fill="none" stroke="currentColor" stroke-width="3"/><path d="M0-14c-7 7-7 21 0 28M0-14c7 7 7 21 0 28M-14 0h28" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M-9-7c3-3 7-2 8 1-2 3-6 4-8 2z M2 3c4-1 8 1 8 4-3 2-7 2-8-1z"/>',
  map: '<path d="M-16-11l10-4 12 4 10-4v26l-10 4-12-4-10 4z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M-6-15v26M6-11v26" stroke="currentColor" stroke-width="2.4"/>',
  pause: '<rect x="-9" y="-13" width="7" height="26"/><rect x="3" y="-13" width="7" height="26"/>',
  resume: '<path d="M-7-14L13 0-7 14z"/>',
} as const;

export type HudIcon = keyof typeof paths;
export function iconSvg(name: HudIcon): string {
  return `<svg class="airway-hud__icon" viewBox="-20 -20 40 40" aria-hidden="true" focusable="false"><g fill="currentColor">${paths[name]}</g></svg>`;
}
