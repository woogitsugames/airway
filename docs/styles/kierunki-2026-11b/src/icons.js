// Our own action and aircraft symbols for the 2026-11b mockups (drawn for Airway, 100x100 boxes, centred at 50,50).
// Each direction re-draws them in its own technique (fill vs. outline vs. cut shape) from these silhouettes.
export const ICON = {
  // undo: a course line that turns back on itself, arrowhead at the end
  undo: 'M78 70 L78 46 Q78 26 58 26 L30 26 L30 12 L8 32 L30 52 L30 38 L58 38 Q66 38 66 46 L66 70 Z',
  // turboprop: straight high wing, two engine pods with propeller discs, straight tail
  prop: 'M46 8 L54 8 L56 40 L92 44 L92 54 L56 56 L55 80 L68 86 L68 92 L32 92 L32 86 L45 80 L44 56 L8 54 L8 44 L44 40 Z M20 34 L30 34 L30 46 L20 46 Z M70 34 L80 34 L80 46 L70 46 Z',
  // widebody: swept wing, four engines, swept tail
  jet: 'M47 6 L53 6 L56 36 L94 62 L94 70 L56 56 L55 80 L70 90 L70 95 L50 90 L30 95 L30 90 L45 80 L44 56 L6 70 L6 62 L44 36 Z M16 58 L22 55 L24 64 L18 66 Z M30 49 L36 46 L38 55 L32 57 Z M64 46 L70 49 L68 57 L62 55 Z M78 55 L84 58 L82 66 L76 64 Z',
  // hub: three runways crossing (shape of a hub, not colour)
  hub: 'M44 6 L56 6 L56 94 L44 94 Z M12 22 L18 12 L88 78 L82 88 Z M82 12 L88 22 L18 88 L12 78 Z',
  // view: globe half in shadow with one meridian (satellite / map toggle)
  view: 'M50 8 A42 42 0 1 1 49.9 8 Z M50 18 A32 32 0 0 0 50 82 Q34 50 50 18 Z',
  // tempo: a heading arrow with one wind barb = 1x
  tempo: 'M8 46 L68 46 L68 30 L94 52 L68 74 L68 58 L8 58 Z M20 46 L12 22 L22 22 L30 46 Z',
};
// The same set as stroked line drawings (for disabled/outline states).
export const ICON_LINE = {
  prop: ICON.prop, jet: ICON.jet, hub: ICON.hub,
};
