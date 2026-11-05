// [night-11ax] D-257: release CSS without the base ("Diorama") declarations that the shipped skin structure always overrides.
// src/ui/skin/roza.css ([night-11az] Róża; KARTA before it) restyles the components with rules `:root[data-skin="roza"] X { … }`; a release build always
// has <html data-skin="roza"> (index.html; only the DEV `?skin=current` comparison removes it), and such a rule beats
// every plain `X` rule (specificity + (0,2,0), and it comes last). So a declaration of a component rule is dead in a
// release when, for every selector X of its rule, a structure rule `:root[data-skin="roza"] X` sets the same property (or
// a shorthand that covers it) in the same @media/@container context or at the top level. Those declarations are
// dropped (empty rules and at-rules with them); `!important` ones always stay. The DEV comparison skin needs them, so
// this runs only where scripts/vite-skin-inline.mjs inlines (release builds; dev with AW_SKIN_INLINE=1, which is how
// `npm run skin:pixels` proves the result pixel-identical). postcss is Vite's own CSS parser (a dependency of vite).
import postcss from 'postcss';

export const SKIN_STRUCTURE_FILE = 'src/ui/skin/roza.css';
export const SKIN_SCOPE = ':root[data-skin="roza"]';
const norm = (s) => s.replace(/\s+/g, ' ').replace(/'/g, '"').trim();
const SHORTHANDS = {
  font: ['font-size', 'font-weight', 'font-family', 'line-height', 'font-style', 'font-variant', 'font-stretch'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'padding-block', 'padding-inline'],
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-block', 'margin-inline'],
  inset: ['top', 'right', 'bottom', 'left'],
  background: ['background-color', 'background-image', 'background-position', 'background-size', 'background-repeat',
    'background-clip', 'background-origin', 'background-attachment'],
  border: ['border-width', 'border-style', 'border-color', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style',
    'border-right-style', 'border-bottom-style', 'border-left-style', 'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color'],
  outline: ['outline-width', 'outline-style', 'outline-color'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
};

/** The at-rule chain of a node, e.g. "@media (max-width: 600px)". */
function context(node) {
  const out = [];
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule') out.unshift(`@${p.name} ${norm(p.params)}`);
  return out.join(' > ');
}

/** "context|selector without the scope" -> properties the skin structure sets there. */
export function skinOverrides(structureCss) {
  const over = new Map();
  postcss.parse(structureCss).walkRules((rule) => {
    const where = context(rule);
    const props = rule.nodes.filter((n) => n.type === 'decl').map((d) => d.prop.toLowerCase());
    for (const selector of rule.selectors) {
      const s = norm(selector);
      if (!s.startsWith(SKIN_SCOPE + ' ')) continue;
      const key = `${where}|${s.slice(SKIN_SCOPE.length + 1)}`;
      over.set(key, new Set([...(over.get(key) ?? []), ...props]));
    }
  });
  // [night-11az] D-257: classes the structure hides outright — a top-level rule `SCOPE .x { display: none }` (one
  // class, or one class's ::before/::after; no @media, not !important) while no other structural rule names it with a
  // display. Every component rule
  // whose selectors all style such an element, something inside it or one of its pseudo-elements is dead in a release.
  const hidden = new Set();
  const shown = new Set();
  postcss.parse(structureCss).walkRules((rule) => {
    const display = rule.nodes.find((n) => n.type === 'decl' && n.prop.toLowerCase() === 'display');
    if (!display) return;
    for (const selector of rule.selectors) {
      const s = norm(selector);
      const one = /^\.[A-Za-z0-9_-]+(?:::(?:before|after))?$/.exec(s.slice(SKIN_SCOPE.length + 1));
      if (s.startsWith(SKIN_SCOPE + ' ') && one && display.value.trim() === 'none' && !display.important && !context(rule)) hidden.add(one[0]);
      else for (const m of s.matchAll(/\.[A-Za-z0-9_-]+(?:::(?:before|after))?/g)) shown.add(m[0]);
    }
  });
  over.hidden = new Set([...hidden].filter((cls) => !shown.has(cls)));
  return over;
}

/** True when `selector` only reaches an element the structure hides (or its subtree / pseudo-elements). */
function insideHidden(over, selector) {
  for (const cls of over.hidden ?? []) {
    // A hidden pseudo-element (`.x::before`) kills only selectors that end with it.
    if (cls.includes('::')) { if (selector.endsWith(cls)) return true; continue; }
    const at = selector.indexOf(cls);
    if (at >= 0 && !/[A-Za-z0-9_-]/.test(selector[at + cls.length] ?? '')) return true;
  }
  return false;
}

function overridden(over, where, selector, prop) {
  for (const at of new Set([where, ''])) {
    const props = over.get(`${at}|${selector}`);
    if (props && (props.has(prop) || [...props].some((p) => SHORTHANDS[p]?.includes(prop)))) return true;
  }
  return false;
}

/** One component stylesheet without the declarations the structure always overrides (or hides); returns { css, removed }. */
export function pruneOverridden(css, over) {
  const root = postcss.parse(css);
  let removed = 0;
  root.walkDecls((decl) => {
    const rule = decl.parent;
    if (rule.type !== 'rule' || decl.important) return;
    if (rule.selectors.every((s) => insideHidden(over, norm(s)))) { decl.remove(); removed++; return; }
    const where = context(rule);
    if (rule.selectors.every((s) => overridden(over, where, norm(s), decl.prop.toLowerCase()))) { decl.remove(); removed++; }
  });
  if (!removed) return { css, removed };
  root.walkRules((rule) => { if (!rule.nodes.length) rule.remove(); });
  for (let again = true; again;) {
    again = false;
    root.walkAtRules((at) => { if (at.nodes && !at.nodes.length) { at.remove(); again = true; } });
  }
  return { css: root.toString(), removed };
}
