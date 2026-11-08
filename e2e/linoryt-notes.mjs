// [night-30a] PLAN-LINORYT.md step U2: the in-page audit of the Linoryt preview's airport notes and edge chips, shared by
// e2e/screen-audit.mjs (test:e2e:screen-audit:stub) and scripts/shots-30a.mjs (the U2 shots).
/**
 * [night-30a] U2: the airport notes and edge chips of the game screen, against the stamps the notes' layout used
 * (`window.__awLinoryt.stamps()`, DEV probe): no shown note over a stamp (the inked square / hub octagon), over another
 * note, over the paper margins (top margin, dock) or off the screen; every row of a note inside its box (nothing wraps or
 * spills); a note's name in Besley; no edge chip over a stamp or a margin, none over a note (a jam's only on a full
 * edge), none smaller than 48 px.
 * Returns the problems and how many notes and chips were checked.
 */
export async function auditNotes(page) {
  return await page.evaluate(() => {
    const problems = [];
    const visible = (el) => !el.hidden && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden' && Number(getComputedStyle(el).opacity) > 0;
    const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const meet = (a, b, pad = 0) => a.l < b.r - pad && b.l < a.r - pad && a.t < b.b - pad && b.t < a.b - pad;
    const layer = document.querySelector('.airport-overlay');
    if (!layer) return { problems: ['no airport overlay'], notes: 0, chips: 0 };
    const origin = layer.getBoundingClientRect();
    const probe = window.__awLinoryt;
    if (!probe) return { problems: ['no __awLinoryt probe (U2 notes off?)'], notes: 0, chips: 0 };
    const stamps = probe.stamps().filter((s) => s.visible).map((s) => ({ ...s, x: s.x + origin.left, y: s.y + origin.top }));
    /** The inked stamp's outline points (square, or the hub octagon round a circle of radius half). */
    const outline = (s) => {
      const points = [];
      const corners = s.hub
        ? Array.from({ length: 8 }, (_, i) => [s.x + s.half / Math.cos(Math.PI / 8) * Math.cos((i + .5) * Math.PI / 4), s.y + s.half / Math.cos(Math.PI / 8) * Math.sin((i + .5) * Math.PI / 4)])
        : [[s.x - s.half, s.y - s.half], [s.x + s.half, s.y - s.half], [s.x + s.half, s.y + s.half], [s.x - s.half, s.y + s.half]];
      corners.forEach(([x0, y0], i) => { const [x1, y1] = corners[(i + 1) % corners.length]; for (let k = 0; k < 8; k++) points.push([x0 + (x1 - x0) * k / 8, y0 + (y1 - y0) * k / 8]); });
      points.push([s.x, s.y]);
      return points;
    };
    const onStamp = (box, s) => outline(s).some(([x, y]) => x > box.l + .5 && x < box.r - .5 && y > box.t + .5 && y < box.b - .5);
    const margins = [document.querySelector('.airway-pass'), document.querySelector('.airway-dock')].filter(Boolean).map(rect);
    const notes = [...layer.querySelectorAll('.airport-bubble')].filter(visible).map((el) => ({ el, id: el.dataset.airport, b: rect(el) }));
    for (const n of notes) {
      for (const s of stamps) if (onStamp(n.b, s)) problems.push(`note ${n.id} over the stamp of ${s.id}`);
      for (const m of notes) if (m !== n && n.id < m.id && meet(n.b, m.b)) problems.push(`notes ${n.id} and ${m.id} overlap`);
      for (const m of margins) if (meet(n.b, m)) problems.push(`note ${n.id} over a paper margin`);
      if (n.b.l < -.5 || n.b.r > innerWidth + .5 || n.b.t < -.5 || n.b.b > innerHeight + .5) problems.push(`note ${n.id} off the screen`);
      for (const child of n.el.children) {
        if (!visible(child) || child.classList.contains('lin-br')) continue;
        const c = rect(child);
        if (c.r > n.b.r + .5 || c.b > n.b.b + .5) problems.push(`note ${n.id}: ${String(child.className.baseVal ?? child.className).split(' ')[0]} spills out of its box`);
      }
      const name = n.el.querySelector('.lin-name, .lin-code');
      const shownName = [...n.el.querySelectorAll('.lin-name, .lin-code')].find(visible);
      if (!name || !shownName) problems.push(`note ${n.id} without a name`);
      else if (!/^"?Besley/.test(getComputedStyle(shownName).fontFamily)) problems.push(`note ${n.id}: name not in Besley`);
      if (n.el.classList.contains('airport-bubble--jam') && !n.el.classList.contains('airport-bubble--compact') && !visible(n.el.querySelector('.lin-jam'))) problems.push(`jam note ${n.id} without its block`);
    }
    const chips = [...layer.querySelectorAll('.airport-edge')].filter(visible).map((el) => ({ el, id: (el.textContent || '').trim(), b: rect(el) }));
    for (const c of chips) {
      if (c.b.r - c.b.l < 47.5 || c.b.b - c.b.t < 47.5) problems.push(`chip ${c.id} smaller than 48 px`);
      // Only a jam's chip may sit under a note, and only when its edge is full (overlay-layout placeSizedEdgeChips).
      if (!c.el.classList.contains('airport-edge--jam')) for (const n of notes) if (meet(c.b, n.b)) problems.push(`chip ${c.id} over the note of ${n.id}`);
      for (const s of stamps) if (onStamp(c.b, s)) problems.push(`chip ${c.id} over the stamp of ${s.id}`);
      for (const m of margins) if (meet(c.b, m)) problems.push(`chip ${c.id} over a paper margin`);
      for (const o of chips) if (o !== c && c.id < o.id && meet(c.b, o.b)) problems.push(`chips ${c.id} and ${o.id} overlap`);
      if (!c.el.dataset.linName) problems.push(`chip ${c.id} without its name`);
    }
    return { problems: [...new Set(problems)].slice(0, 12), notes: notes.length, chips: chips.length };
  });
}

