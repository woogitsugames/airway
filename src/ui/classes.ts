// [night-59a] D-322: the one place that sets or clears a class or a flag attribute on a condition.
// `classList.toggle(name, force)` and `toggleAttribute(name, force)` FLIP the token when `force` is `undefined`
// instead of clearing it. A typed `boolean` field can still arrive as `undefined` from untyped data (an e2e fixture,
// the DEV adapter, an old save), and the screen then silently shows the opposite state (the weekly board opened in
// airport-pick mode). These helpers coerce, so a missing flag always means "off". `npm run test:class-toggle` fails
// on any two-argument `classList.toggle(...)` / `toggleAttribute(...)` in src/ outside this file.

/** Adds `name` to `el` when `on` is truthy, removes it otherwise (never flips). */
export function setClass(el: Element, name: string, on: boolean): void {
  el.classList.toggle(name, !!on);
}

/** Sets the empty attribute `name` on `el` when `on` is truthy, removes it otherwise (never flips). */
export function setFlagAttribute(el: Element, name: string, on: boolean): void {
  el.toggleAttribute(name, !!on);
}
