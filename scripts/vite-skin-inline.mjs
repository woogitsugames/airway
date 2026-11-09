// [night-11ar] D-252: release builds resolve the UI skin tokens (src/ui/skin/current.css, D-250) into the component
// CSS. The skin is one static file chosen at build time (a new skin is a new file imported instead of it), so every
// `var(--skin-x)` has exactly one value; writing that value in place gives the CSS the browser read before D-250
// (D-250: "with the skin substituted back every covered CSS file equals the old text") and saves ~15 kB of the CSS
// budget (docs/PERFORMANCE.md "Bundle budget"). Source files keep the tokens; `npm run dev` keeps them too (DevTools
// show the names) unless AW_SKIN_INLINE=1, which `npm run skin:pixels` uses to prove the inlined CSS pixel-identical.
// Values that point at the palette (`var(--airway-ink)`) stay references: the palette is defined once on :root, so
// resolving there or on the element gives the same colour (the plugin refuses a palette or skin token defined anywhere
// else). Tokens read from TypeScript (inline SVG inks of overlay.ts) stay defined on :root, with resolved values.
// Guarded by `npm run test:skin-tokens` (unit cases and the real skin) and `npm run test:bundle` (no other
// `var(--skin-` in dist CSS).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SKIN_STRUCTURE_FILES, SKIN_SCOPE, skinOverrides, pruneOverridden } from './vite-skin-prune.mjs';

export const SKIN_FILE = 'src/ui/skin/current.css';
// [night-46a] D-301: no DEV-only skins any more; [night-81a] D-336: the UI-A structure (SKIN_STRUCTURE_FILES, board.css
// and board-week.css) is inlined like any component CSS and the base inks (`--base-*`, a plain :root in board.css
// section A) are palette constants written out in place.
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const USE = /var\(\s*--skin-([a-z0-9-]+)\s*([,)])/g;

/** name -> raw value of every `--skin-*` declaration in the skin file (one `:root` block, nothing else). */
export function skinTokens(skinCss) {
  const text = stripComments(skinCss).trim();
  const block = /^:root\s*\{([^{}]*)\}$/.exec(text);
  if (!block) throw new Error(`${SKIN_FILE}: expected exactly one :root { … } block and nothing else`);
  const tokens = new Map();
  for (const part of block[1].split(';')) {
    if (!part.trim()) continue;
    const m = /^\s*--skin-([a-z0-9-]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
    if (!m) throw new Error(`${SKIN_FILE}: not a --skin-* declaration: ${part.trim()}`);
    if (tokens.has(m[1])) throw new Error(`${SKIN_FILE}: --skin-${m[1]} defined twice`);
    tokens.set(m[1], m[2]);
  }
  return tokens;
}

/** Every token value with nested `var(--skin-y)` written out (cycles and unknown names throw). */
export function resolveTokens(tokens) {
  const done = new Map();
  const visit = (name, path) => {
    if (done.has(name)) return done.get(name);
    if (!tokens.has(name)) throw new Error(`unknown skin token --skin-${name}`);
    if (path.includes(name)) throw new Error(`skin token cycle: ${[...path, name].join(' -> ')}`);
    const value = substitute(tokens.get(name), (n) => visit(n, [...path, name]));
    done.set(name, value);
    return value;
  };
  for (const name of tokens.keys()) visit(name, []);
  return done;
}

function substitute(css, valueOf) {
  return css.replace(USE, (whole, name, end) => {
    if (end === ',') throw new Error(`var(--skin-${name}, fallback) is not supported; use the plain token`);
    return valueOf(name);
  });
}

/** Custom properties (other than skin tokens) that resolved skin values read, e.g. `airway-ink`. */
export function referencedProperties(resolved) {
  const names = new Set();
  for (const value of resolved.values()) for (const m of value.matchAll(/var\(\s*--([a-z0-9-]+)/g)) names.add(m[1]);
  return names;
}

/** Custom properties that are constants: declared exactly once in all `cssSources`, in a top-level `:root` rule
 *  (not under @media, not `:root[...]`), with a value free of var(), and never named in `scriptSources` (a script could
 *  set it at run time, like --airway-airline). name -> value. */
export function constantProperties(cssSources, scriptSources) {
  const seen = new Map();
  for (const css of cssSources) {
    const text = stripComments(css);
    let depth = 0;
    let start = 0;
    let selector = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') { if (depth === 0) selector = text.slice(start, i).trim(); depth++; start = i + 1; }
      else if (ch === '}' || ch === ';') {
        const m = /^\s*--([a-z0-9-]+)\s*:\s*([\s\S]*?)\s*$/.exec(text.slice(start, i));
        if (m) seen.set(m[1], [...(seen.get(m[1]) ?? []), { top: depth === 1 && selector === ':root', value: m[2] }]);
        if (ch === '}') depth--;
        start = i + 1;
      }
    }
  }
  const scripts = scriptSources.join('\n');
  const out = new Map();
  for (const [name, defs] of seen) {
    if (defs.length === 1 && defs[0].top && !defs[0].value.includes('var(') && !scripts.includes(`--${name}`)) {
      out.set(name, defs[0].value);
    }
  }
  return out;
}

/** Resolved skin values with `var(--p)` of constant properties written out too. */
export function withConstants(resolved, constants) {
  const out = new Map();
  for (const [name, value] of resolved) {
    out.set(name, value.replace(/var\(\s*--([a-z0-9-]+)\s*\)/g, (whole, p) => constants.get(p) ?? whole));
  }
  return out;
}

/** One CSS source with every `var(--skin-x)` replaced by its resolved value. */
export function inlineSkin(css, resolved, file = 'css') {
  const outsideRoot = stripComments(css).replace(/:root\s*\{[^{}]*\}/g, '');
  for (const m of outsideRoot.matchAll(/(?:^|[{;\s])--([a-z0-9-]+)\s*:/g)) {
    if (m[1].startsWith('skin-') || referencedProperties(resolved).has(m[1])) {
      throw new Error(`${file}: --${m[1]} is set outside :root; the skin tokens that read it cannot be inlined safely`);
    }
  }
  return substitute(css, (name) => {
    if (!resolved.has(name)) throw new Error(`${file}: unknown skin token --skin-${name}`);
    return resolved.get(name);
  });
}

/** The skin file reduced to the tokens TypeScript still reads at run time, values resolved. */
export function keptSkin(resolved, keep) {
  const names = [...keep].filter((name) => resolved.has(name)).sort();
  if (!names.length) return '';
  return `:root {\n${names.map((name) => `  --skin-${name}: ${resolved.get(name)};`).join('\n')}\n}\n`;
}

/** Token names written as `var(--skin-x)` in a TypeScript source. */
export function tokensInScript(ts) {
  return [...ts.matchAll(/var\(--skin-([a-z0-9-]+)\)/g)].map((m) => m[1]);
}

function sources(root, pattern, skip = []) {
  const out = [];
  const skipped = new Set(skip.map((file) => resolve(root, file)));
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (pattern.test(name) && !skipped.has(resolve(path))) out.push(readFileSync(path, 'utf8'));
    }
  };
  walk(join(root, 'src'));
  return out;
}

/** [night-36a] D-294: tokens the release keeps as `var(--skin-x)` references instead of writing their value in place.
 *  A font stack is long (~50 bytes) and named on dozens of rules (alone or inside a `font` shorthand), so one :root
 *  definition plus a ~20-byte reference per use is ~2.5 kB smaller than the inlined text; the computed font is the
 *  same (the token is defined once, on :root, and nothing else sets it: inlineSkin refuses that), so the pixels are too. */
export const REFERENCED_TOKENS = ['face-text', 'face-display', 'face-mono'];

/** `resolved` with every `refs` token written as `var(--skin-x)`, inside other tokens' values too. */
export function referencedValues(tokens, refs, constants = new Map()) {
  const mark = (name) => `\u0000${name}\u0000`;
  const marked = new Map(tokens);
  for (const name of refs) if (marked.has(name)) marked.set(name, mark(name));
  const out = new Map();
  for (const [name, value] of withConstants(resolveTokens(marked), constants)) {
    out.set(name, value.replace(/\u0000([a-z0-9-]+)\u0000/g, (whole, ref) => `var(--skin-${ref})`));
  }
  return out;
}

/** Everything the transform needs, read from the tree: resolved token values, the tokens scripts read, and the values
 *  written in place (`inline`: `resolved` with the REFERENCED_TOKENS kept as references, defined by keptSkin). */
export function skinBuild(root) {
  const scripts = sources(root, /\.(ts|tsx|js|mjs)$/);
  const tokens = skinTokens(readFileSync(resolve(root, SKIN_FILE), 'utf8'));
  const constants = constantProperties(sources(root, /\.css$/), scripts);
  const refs = new Set(REFERENCED_TOKENS.filter((name) => tokens.has(name)));
  return {
    resolved: withConstants(resolveTokens(tokens), constants),
    inline: referencedValues(tokens, refs, constants),
    keep: new Set(scripts.flatMap(tokensInScript)),
    refs,
    inks: baseInks(constants),
  };
}

/** [night-48a] U6 (D-294 mechanism); [night-81a] D-336: the base inks (Linoryt's until T6) (`--base-*` palette constants: one plain :root definition, var-free,
 *  never named by a script) are written out in place of their `var(--base-x)` references (~3 kB of release CSS). The
 *  definitions stay on :root, so a DEV probe or a later rule that names the ink still resolves; inks whose value holds a
 *  var() (`--base-neatline`, `--base-top`) or that a script sets (`--base-pass-bottom`, `--base-jam-w`) stay references. */
export function baseInks(constants) {
  return new Map([...constants].filter(([name]) => name.startsWith('base-')));
}

/** `css` with every `var(--base-x)` of an ink in `inks` replaced by its value (a fallback form is left alone). */
export function inlineInks(css, inks) {
  return css.replace(/var\(\s*--(base-[a-z0-9-]+)\s*\)/g, (whole, name) => inks.get(name) ?? whole);
}

/** Vite plugin: on in `vite build`, and in `vite` (dev) only with AW_SKIN_INLINE=1. */
export function skinInline() {
  let root = process.cwd();
  let enabled = false;
  let build = false;
  let cache = null;
  let overrides = null;
  const normal = (id) => id.split('?')[0].replace(/\\/g, '/');
  return {
    name: 'airway-skin-inline',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
      build = config.command === 'build';
      enabled = build || process.env.AW_SKIN_INLINE === '1';
    },
    buildStart() { cache = null; overrides = null; },
    transform(code, id) {
      const file = normal(id);
      if (!enabled || !file.endsWith('.css') || !file.startsWith(normal(resolve(root, 'src')) + '/')) return null;
      const { resolved, inline, keep, refs, inks } = build ? (cache ??= skinBuild(root)) : skinBuild(root);
      if (file === normal(resolve(root, SKIN_FILE))) return { code: keptSkin(resolved, new Set([...keep, ...refs])), map: null };
      const inlined = inlineInks(inlineSkin(code, inline, file.slice(root.length + 1)), inks);
      // [night-11ax] D-257: a release always has <html data-skin="board"> ([night-81a] D-336; "linoryt" before), so its scope
      // is written `:root:root` (same specificity, 0-2-0; ~15 bytes less per selector). Dev (AW_SKIN_INLINE=1) keeps it.
      if (SKIN_STRUCTURE_FILES.some((f) => file === normal(resolve(root, f)))) return { code: build ? inlined.split(SKIN_SCOPE).join(':root:root') : inlined, map: null };
      // [night-11ax] D-257: drop the declarations the skin structure always overrides (scripts/vite-skin-prune.mjs).
      const structure = () => skinOverrides(SKIN_STRUCTURE_FILES.map((f) => readFileSync(resolve(root, f), 'utf8')).join('\n'));
      const over = build ? (overrides ??= structure()) : structure();
      return { code: pruneOverridden(inlined, over).css, map: null };
    },
  };
}
