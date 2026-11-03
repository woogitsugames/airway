// [m3] D-55: in-page check that player text is neither clipped nor overlapping (large-text variant of
// ui:matrix and test:a11y). Runs inside page.evaluate(); returns human-readable problems.
// Checked: every visible element that owns text inside the UI boards (menu, settings, HUD, upgrade board,
// game over, pause). The in-world airport overlay (labels that follow the globe) is excluded from overlap.
export function textFitProblems() {
  const BOARDS = [
    '.airway-screen-root > :not(.airway-game-screen)', '.airway-hud', '.airway-upgrade', '.airway-go-overlay',
    '.airway-pause:not([hidden])', '.airway-dock',
  ];
  // An open modal board (upgrade, game over, pause) covers the HUD: only the boards are checked then.
  const modals = [...document.querySelectorAll('[aria-modal="true"]')].filter((m) => m.getClientRects().length && !m.closest('[hidden]'));
  const roots = modals.length ? modals : BOARDS.flatMap((selector) => [...document.querySelectorAll(selector)]);
  const problems = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const seen = new Set();
  const items = [];
  const name = (el) => (el.dataset.testid ? `[${el.dataset.testid}]` : '') + el.tagName.toLowerCase() +
    (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '');
  const hidden = (el) => {
    if (el.closest('[hidden], [aria-hidden="true"], .airway-sr-only, .airway-upgrade-picks:not(:focus-within)')) return true;
    const style = getComputedStyle(el);
    return style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0 || !el.getClientRects().length;
  };
  for (const root of roots) {
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (seen.has(el) || el instanceof SVGElement) continue;
      seen.add(el);
      const ownText = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
      if (!ownText || hidden(el)) continue;
      const style = getComputedStyle(el);
      const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
      const clipsX = /hidden|clip|auto|scroll/.test(style.overflowX);
      const clipsY = /hidden|clip/.test(style.overflowY);
      if (clipsX && el.scrollWidth > el.clientWidth + 1) problems.push(`clipped-x ${name(el)} "${text}" ${el.scrollWidth}>${el.clientWidth}`);
      // Tight line-heights (1.0) report the font's ascent+descent as scroll height; ink still fits.
      if (clipsY && el.scrollHeight > el.clientHeight + Math.max(2, parseFloat(style.fontSize) * 0.3)) problems.push(`clipped-y ${name(el)} "${text}" ${el.scrollHeight}>${el.clientHeight}`);
      if (style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) problems.push(`ellipsis ${name(el)} "${text}"`);
      // Text measured by its own line boxes (a Range), not the element box (flex items stretch).
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
      if (!rects.length) continue;
      const left = Math.min(...rects.map((r) => r.left)), right = Math.max(...rects.map((r) => r.right));
      const top = Math.min(...rects.map((r) => r.top)), bottom = Math.max(...rects.map((r) => r.bottom));
      // Text inside a scrolling ancestor may legitimately sit below the fold.
      let scroller = el.parentElement;
      while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
      if (left < -1 || right > vw + 1 || (!scroller && (top < -1 || bottom > vh + 1))) {
        problems.push(`offscreen ${name(el)} "${text}" [${Math.round(left)},${Math.round(top)},${Math.round(right)},${Math.round(bottom)}]`);
      }
      // Clipped by an ancestor that hides overflow (split-flap halves clip their glyph on purpose).
      for (let p = el.closest('.flap-half') ? null : el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (/auto|scroll/.test(ps.overflowY)) break; // a scrolling board: the player can scroll to it
        if (!/hidden|clip/.test(ps.overflowX + ps.overflowY)) continue;
        const pb = p.getBoundingClientRect();
        if (left < pb.left - 1 || right > pb.right + 1 || (/hidden|clip/.test(ps.overflowY) && (top < pb.top - 1 || bottom > pb.bottom + 1))) {
          problems.push(`cut-by-parent ${name(el)} "${text}" in ${name(p)}`);
        }
        break;
      }
      items.push({ el, rects, label: `${name(el)} "${text}"` });
    }
  }
  // Overlap: line boxes of two unrelated text elements intersect by more than 2 px both ways.
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const tile = a.el.closest('.flap-tile'); // both halves of one split-flap tile print the same letter
      if (tile && tile === b.el.closest('.flap-tile')) continue;
      const hit = a.rects.some((r) => b.rects.some((s) =>
        Math.min(r.right, s.right) - Math.max(r.left, s.left) > 2 && Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top) > 2));
      if (hit) problems.push(`overlap ${a.label} × ${b.label}`);
    }
  }
  return [...new Set(problems)];
}
