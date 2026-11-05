# UI skin inventory (night N11aq, D-250)

Every hard-coded visual value of the in-game HUD (boarding pass / top bar, tag dock), airport tags and chips, pause
sheet, weekly board (crates, contract waybill), hub cause board, game-over report and main menu (with the settings,
privacy, licences and help pages that share `menu.css`), and the token that now holds it. All tokens live in one file,
`src/ui/skin/current.css` ("Diorama", the look of today); the component CSS reads only `var(--skin-*)` for colours,
typefaces, weights, motion, corners/shadows and icon sizes. `npm run test:skin-tokens` (in `test:fast`) fails when a
colour, font family/weight or duration literal comes back into a covered file or a token is undefined/unused.

Covered files: `src/ui/hud.css`, `src/ui/overlay.css` (+ the inline SVG inks of `src/ui/overlay.ts`), `src/ui/game.css`,
`src/ui/upgrade/upgrade.css`, `src/ui/hubBoard.css`, `src/ui/gameover/gameover.css`, `src/ui/menu/menu.css`.
[night-11as] Follow-up, same pattern: `src/ui/atcStrip.css` (ATC strip, route menu and handles, first-time cards, slot
hint), `src/ui/logbook/logbook.css`, `src/ui/puzzles/board.css` (+ the curfew barrier SVG of `src/ui/puzzles/index.ts`,
now the airport tag's barrier tokens), `src/ui/leaderboard/leaderboard.css`, `src/ui/tutorial/tutorial.css` and the
glyph outline of `src/ui/glyphs.ts` (an inline `style.stroke`, so the hollow connecting glyph of `overlay.ts` now sets
its stroke the same way to keep winning). Not covered: the tutorial's painted mini-world SVG in
`src/ui/tutorial/index.ts` (land, sea, airports: world art like the globe) and the globe (`src/render/**`, out of scope).

**Counts.** 461 hard-coded values moved to 202 tokens: 246 colours (241 in the CSS, 5 inks of the inline SVGs in
`overlay.ts`; 169 tokens, values equal to the palette of `theme.css` point at it, e.g. `var(--airway-ticket)`), 83
font families (3 tokens), 84 weights (3), 19 motion durations/delays (12), 13 corners/shadows/hover rules (6) and 16
icon sizes (9). [night-11ar] D-252: the unused DEV overlay fixture controls (`.airport-demo-controls`) were deleted
with their 5 values and 2 tokens (`--skin-demo-bg`, `--skin-demo-accent`): 456 values, 200 tokens. [night-11as] The
follow-up moved 244 more values to 86 new tokens (158 colours, 38 font families and 44 weights on the existing tokens, 3
motion durations): 701 token uses, 286 tokens. Release builds
write every token value in place (`scripts/vite-skin-inline.mjs`); the source keeps the tokens.
**Zero visual change** (`npm run skin:pixels`, `e2e/skin-pixels.mjs`): see the PR; in short, after substituting the
skin back, every covered CSS file is the same text as before (colour case and palette names aside), and 88 fixture
shots × computed styles match.

**Text sizes.** The D-248 tokens stay in `theme.css` (`--airway-text-scale`, `--airway-text-scale-title`,
`--airway-text-scale-dense`, `--airway-font-*`); a skin never redefines them (the guard checks). Sizes written as
`calc(Npx * var(--airway-text-scale))` are listed below as structural: a new skin changes them per component, because
a new typeface has other metrics. The tag widths in `src/ui/overlay.ts` / `overlay-layout.ts` are computed from fixed
per-character widths of the current fonts (e.g. `PLATE_CHAR` 7.2 px for Overpass Mono 12 px): a skin that changes the
tag typeface or size must change those constants too (covered by `test:overlay-layout`, `test:e2e:fill-trend`).

## Tokens: component → property → current value → token

Ordered: typefaces and weights, motion, corners and shadows, icon sizes, then colours by component.

| Component | Selector → property | Current value | Token |
|---|---|---|---|
| Airport tags and chips, Game-over report, HUD: boarding pass + tag dock, Hub cause board, Main menu + settings, Pause sheet, Weekly board | `.airport-overlay` → font-family; `.airway-flight__sub` → font; `.airway-glyph-legend__row` → font; `.airway-go-milestone` → font; `.airway-go-overlay` → font-family; `.airway-go-score` → font; `.airway-hub-board` → font; … (23 uses) | 'Atkinson Hyperlegible Next', sans-serif | `--skin-face-text` |
| Airport tags and chips, Game-over report, HUD: boarding pass + tag dock, Main menu + settings, Pause sheet, Weekly board | `.airport-bubble__count` → font; `.airport-bubble__new` → font; `.airport-edge` → font; `.airport-slot__count` → font; `.airport-slot__label` → font; `.airway-dock__tag` → font-family; `.airway-glyph-legend__title` → font; `.airway-go-button` → font; … (23 uses) | 'Overpass', sans-serif | `--skin-face-display` |
| Airport tags and chips, Game-over report, Hub cause board, Main menu + settings, Pause sheet, Weekly board | `.airport-bubble__plate` → font; `.airport-bubble__surge` → font; `.airport-bubble__timer` → font; `.airport-slot__time` → font; `.airway-board__header` → font; `.airway-board` → font-family; `.airway-flight__region` → font; `.airway-go-board-head` → font; … (36 uses) | 'Overpass Mono', monospace | `--skin-face-mono` |
| Game-over report, Hub cause board, Main menu + settings, Pause sheet, Weekly board | `.airway-flight__sub` → font; `.airway-glyph-legend__row` → font; `.airway-go-milestone` → font; `.airway-hub-board__row[data-cause='none'] .airway-hub-board__text` → font-weight; `.airway-keys__row` → font; `.airway-licenses` → font; … (13 uses) | 400 | `--skin-weight-regular` |
| Airport tags and chips, Game-over report, HUD: boarding pass + tag dock, Hub cause board, Main menu + settings, Pause sheet, Weekly board | `.airport-bubble__surge` → font; `.airport-bubble__timer` → font; `.airport-slot__time` → font; `.airway-board__header` → font; `.airway-flight__region` → font; `.airway-go-board-head` → font; `.airway-go-board-title` → font; … (45 uses) | 700 | `--skin-weight-bold` |
| Airport tags and chips, Game-over report, HUD: boarding pass + tag dock, Main menu + settings, Pause sheet, Weekly board | `.airport-bubble__count` → font; `.airport-bubble__new` → font; `.airport-bubble__plate` → font; `.airport-edge` → font; `.airport-slot__count` → font; `.airport-slot__label` → font; `.airway-dock__tag` → font-weight; `.airway-glyph-legend__title` → font; … (25 uses) | 800 | `--skin-weight-heavy` |
| Airport tags and chips | `.airport-bubble` → transition; `.airport-edge` → transition; `.airport-slot` → transition | 90ms | `--skin-motion-follow` |
| Weekly board | `.airway-upgrade-tag` → transition | .12s | `--skin-motion-press` |
| Airport tags and chips | `.airport-bubble__trend` → animation | 120ms | `--skin-motion-trend-in` |
| Hub cause board | `.airway-hub-board` → animation | 140ms | `--skin-motion-panel-in` |
| Airport tags and chips, Game-over report | `.airport-bubble__new` → animation; `.airway-go-milestone-first` → animation | 160ms | `--skin-motion-stamp` |
| Weekly board | `.airway-upgrade` → animation | .18s | `--skin-motion-sheet-in` |
| Main menu + settings | `.flap-fold-in--active` → animation; `.flap-fold-out--active` → animation | 38ms | `--skin-motion-flap` |
| Game-over report | `.airway-go-flap` → animation | 90ms | `--skin-motion-flip` |
| Game-over report | `.airway-go-flight:nth-child(2) .airway-go-flap` → animation-delay | 65ms | `--skin-motion-flip-stagger-1` |
| Game-over report | `.airway-go-flight:nth-child(3) .airway-go-flap` → animation-delay | 120ms | `--skin-motion-flip-stagger-2` |
| Game-over report | `.airway-go-flight:nth-child(n+4) .airway-go-flap` → animation-delay | 180ms | `--skin-motion-flip-stagger-3` |
| Airport tags and chips | `.airport-edge--jam` → animation | 1.1s | `--skin-motion-jam-pulse` |
| Game-over report, HUD: boarding pass + tag dock, Main menu + settings, Pause sheet | `.airway-flight__region` → border-radius; `.airway-go-button` → border-radius; `.airway-go-map` → border-radius; `.airway-go-share-text` → border-radius; `.airway-hud button` → border-radius; `.airway-pause__button` → border-radius; … (7 uses) | 0 | `--skin-control-radius` |
| Airport tags and chips | `.airport-edge` → border-radius | 2px | `--skin-edge-radius` |
| Airport tags and chips, HUD: boarding pass + tag dock | `.airport-bubble.is-hover` → box-shadow; `.airway-hud button:not(:disabled):hover` → box-shadow | inset 0 -3px 0 currentColor | `--skin-hover-rule` |
| Airport tags and chips | `.airport-edge--new` → box-shadow | inset 0 4px 0 #ffc72c (`--airway-sign`) | `--skin-edge-new-bar` |
| Hub cause board | `.airway-hub-board` → box-shadow | 3px 3px 0 #fbf8f1 (`--airway-ticket`) | `--skin-hubboard-shadow` |
| Main menu + settings | `.airway-board` → box-shadow | 0 2px 0 #454849 | `--skin-menu-board-shadow` |
| HUD: boarding pass + tag dock | `.airway-hud__icon` → height; `.airway-hud__icon` → width | 27px | `--skin-hud-icon-size` |
| HUD: boarding pass + tag dock | `.airway-hud__icon` → width | 24px | `--skin-hud-icon-size-narrow` |
| HUD: boarding pass + tag dock | `.airway-pass__pause .airway-hud__icon` → height; `.airway-pass__pause .airway-hud__icon` → width | 22px | `--skin-pass-pause-icon-size` |
| HUD: boarding pass + tag dock | `.airway-dock__tag.is-countdown .airway-hud__icon` → height; `.airway-dock__tag.is-countdown .airway-hud__icon` → width | 22px | `--skin-dock-countdown-icon-size` |
| HUD: boarding pass + tag dock | `.airway-dock__tag[data-hud-action='hub'] .airway-hud__icon` → width | 25px | `--skin-dock-hub-icon-width` |
| Airport tags and chips | `.airport-edge svg` → height; `.airport-edge svg` → width | 14px | `--skin-edge-icon-size` |
| Airport tags and chips | `.airport-slot__mark` → height; `.airport-slot__mark` → width | 14px | `--skin-slot-icon-size` |
| Weekly board | `.airway-upgrade-back-arrow` → height; `.airway-upgrade-back-arrow` → width | 24px | `--skin-crate-back-icon-size` |
| Main menu + settings | `.airway-sign__pictogram svg` → height; `.airway-sign__pictogram svg` → width | 38px | `--skin-menu-sign-icon-size` |
| HUD: boarding pass + tag dock | `.airway-hud` → --hud-ink | #2a2420 (`--airway-ink`) | `--skin-hud-ink` |
| HUD: boarding pass + tag dock | `.airway-hud` → --hud-pass | #fbf8f1 (`--airway-ticket`) | `--skin-hud-paper` |
| HUD: boarding pass + tag dock | `.airway-hud` → --hud-perf | #d8cfbf | `--skin-hud-perforation` |
| HUD: boarding pass + tag dock | `.airway-hud` → --hud-teal | #1e6f6a (`--airway-teal`) | `--skin-hud-airline-default` |
| HUD: boarding pass + tag dock | `.airway-hud` → --hud-kraft | #d6b88a (`--airway-kraft`) | `--skin-hud-tag-bg` |
| HUD: boarding pass + tag dock | `.airway-hud` → --hud-eyelet | #b8955f | `--skin-hud-eyelet-ring` |
| HUD: boarding pass + tag dock | `.airway-hud` → --hud-red | #c8352a (`--airway-jam`) | `--skin-hud-alert` |
| HUD: boarding pass + tag dock | `.airway-pass__label` → color | #665f55 | `--skin-pass-label-ink` |
| HUD: boarding pass + tag dock | `.airway-dock__eyelet` → background | #8cc3d8 (`--airway-sky`) | `--skin-dock-eyelet-hole` |
| HUD: boarding pass + tag dock | `.airway-dock__tag.is-empty` → background | #d9cdb8 (`--airway-kraft-empty`) | `--skin-dock-tag-empty-bg` |
| HUD: boarding pass + tag dock | `.airway-dock__tag.is-empty` → color | #5a4e44 (`--airway-kraft-empty-ink`) | `--skin-dock-tag-empty-ink` |
| HUD: boarding pass + tag dock | `.airway-hud[data-layout='foldable'] .airway-dock` → border-left | #2a24205c | `--skin-dock-rack-rule` |
| Airport tags and chips | `.airport-bubble` → color; `.airport-overlay` → color | #2a2420 (`--airway-ink`) | `--skin-tag-ink` |
| Airport tags and chips | `.airport-bubble` → background | #fbf8f1 (`--airway-ticket`) | `--skin-tag-bg` |
| Airport tags and chips | `.airport-bubble--jam` → background | #c8352a (`--airway-jam`) | `--skin-tag-jam-bg` |
| Airport tags and chips | `.airport-bubble--jam` → color | #fbf8f1 (`--airway-ticket`) | `--skin-tag-jam-ink` |
| Airport tags and chips | `.airport-bubble__plate` → border-right | #2a2420 (`--airway-ink`) | `--skin-tag-plate-rule` |
| Airport tags and chips | `.airport-bubble__plate` → color | #13302e (`--airway-panel`) | `--skin-tag-plate-ink` |
| Airport tags and chips | `.airport-bubble__new` → background | #13302e (`--airway-panel`) | `--skin-tag-new-bg` |
| Airport tags and chips | `.airport-bubble__new` → color | #ffc72c (`--airway-sign`) | `--skin-tag-new-ink` |
| Airport tags and chips | `overlay.ts SVG` → fill/stroke | #13302e (`--airway-panel`) | `--skin-tag-barrier-post` |
| Airport tags and chips | `overlay.ts SVG` → fill/stroke | #fbf8f1 (`--airway-ticket`) | `--skin-tag-barrier-boom` |
| Airport tags and chips | `overlay.ts SVG` → fill/stroke | #b8322a | `--skin-tag-barrier-stripe` |
| Airport tags and chips | `overlay.ts SVG` → fill/stroke | #fbf8f1 (`--airway-ticket`) | `--skin-tag-glyph-hollow` |
| Airport tags and chips | `.airport-bubble__surge` → --aw-surge-ink | #13302e (`--airway-panel`) | `--skin-tag-surge-ink` |
| Airport tags and chips | `.airport-bubble__surge` → --aw-surge-paper | #fbf8f1 (`--airway-ticket`) | `--skin-tag-surge-paper` |
| Airport tags and chips | `.airport-edge--new` → border-color; `.airport-edge` → border | #13302e (`--airway-panel`) | `--skin-edge-border` |
| Airport tags and chips | `.airport-edge--curfew:not(.airport-edge--jam)` → background-image; `.airport-edge` → background | #fbf8f1 (`--airway-ticket`) | `--skin-edge-bg` |
| Airport tags and chips | `.airport-edge` → color | #13302e (`--airway-panel`) | `--skin-edge-ink` |
| Airport tags and chips | `--skin-edge-new-bar` → value; `.airport-edge:focus-visible` → outline | #ffc72c (`--airway-sign`) | `--skin-edge-highlight` |
| Airport tags and chips | `.airport-edge--jam` → background; `.airport-edge__gauge--high .airport-edge__fill` → background | #c8352a (`--airway-jam`) | `--skin-edge-jam-bg` |
| Airport tags and chips | `.airport-edge--jam` → border-color | #c8352a (`--airway-jam`) | `--skin-edge-jam-border` |
| Airport tags and chips | `.airport-edge--jam` → color | #fbf8f1 (`--airway-ticket`) | `--skin-edge-jam-ink` |
| Airport tags and chips | `.airport-edge--new` → background | #13302e (`--airway-panel`) | `--skin-edge-new-bg` |
| Airport tags and chips | `.airport-edge--new` → color | #ffc72c (`--airway-sign`) | `--skin-edge-new-ink` |
| Airport tags and chips | `.airport-edge--curfew:not(.airport-edge--jam)` → background-image | #B8322A | `--skin-edge-curfew-stripe` |
| Airport tags and chips | `.airport-slot` → border | #13302e (`--airway-panel`) | `--skin-slot-border` |
| Airport tags and chips | `.airport-slot` → background | #fbf8f1 (`--airway-ticket`) | `--skin-slot-bg` |
| Airport tags and chips | `.airport-slot` → color | #13302e (`--airway-panel`) | `--skin-slot-ink` |
| Airport tags and chips | `.airport-slot__stub` → background | #13302e (`--airway-panel`) | `--skin-slot-stub-bg` |
| Airport tags and chips | `.airport-slot__stub` → color | #ffc72c (`--airway-sign`) | `--skin-slot-stub-ink` |
| Pause sheet | `.airway-screen-root > .airway-tutorial-screen` → background | #8cc3d8 (`--airway-sky`) | `--skin-screen-sky` |
| Pause sheet | `.airway-pause` → background | #f4ebc9 (`--airway-strip`) | `--skin-pause-bg` |
| Pause sheet | `.airway-pause__button` → color; `.airway-pause__summary dt` → color; `.airway-pause` → color | #2a2420 (`--airway-ink`) | `--skin-pause-ink` |
| Pause sheet | `.airway-pause` → border-left | #13302e (`--airway-panel`) | `--skin-pause-edge` |
| Pause sheet | `.airway-pause__button` → border; `.airway-pause__summary` → border-top | #2a2420 (`--airway-ink`) | `--skin-pause-rule` |
| Pause sheet | `.airway-pause__summary dt` → border-bottom | #7a6f62 (`--airway-label-ink`) | `--skin-pause-rule-dim` |
| Pause sheet | `.airway-pause__button` → background | #fbf8f1 (`--airway-ticket`) | `--skin-pause-button-bg` |
| Pause sheet | `.airway-pause__button--primary` → background | #ffc72c (`--airway-sign`) | `--skin-pause-primary-bg` |
| Pause sheet | `.airway-pause__button--primary` → border-color | #1c1e20 (`--airway-board`) | `--skin-pause-primary-border` |
| Pause sheet | `.airway-pause__button--primary` → color | #1c1e20 (`--airway-board`) | `--skin-pause-primary-ink` |
| Pause sheet | `.airway-pause__button:focus-visible` → outline | #c8352a (`--airway-jam`) | `--skin-pause-focus` |
| Pause sheet | `.airway-pause__status` → color | #7a6f62 (`--airway-label-ink`) | `--skin-pause-status-ink` |
| Weekly board | `.airway-upgrade-open` → background | rgba(28, 30, 32, .62) | `--skin-crate-scrim` |
| Weekly board | `.airway-upgrade-tag` → color; `.airway-upgrade` → color | #2a2420 (`--airway-ink`) | `--skin-crate-ink` |
| Weekly board | `.airway-upgrade-sign` → background | #ffc72c (`--airway-sign`) | `--skin-crate-sign-bg` |
| Weekly board | `.airway-upgrade-sign` → color | #1c1e20 (`--airway-board`) | `--skin-crate-sign-ink` |
| Weekly board | `.airway-upgrade-tag` → background | #d6b88a (`--airway-kraft`) | `--skin-crate-label-bg` |
| Weekly board | `.airway-upgrade-tag:active` → background | #c9a874 | `--skin-crate-label-pressed-bg` |
| Weekly board | `.airway-upgrade-tag:focus-visible` → outline | #ffc72c (`--airway-sign`) | `--skin-crate-focus` |
| Weekly board | `.airway-upgrade-tag:disabled` → background | #c7b394 | `--skin-crate-label-disabled-bg` |
| Weekly board | `.airway-upgrade-model` → background | #eadcc2 | `--skin-crate-model-bg` |
| Weekly board | `.airway-upgrade-model` → border | #2a2420 (`--airway-ink`) | `--skin-crate-model-border` |
| Weekly board | `.airway-upgrade-model::before` → background; `.model-departure-slots::before` → background | #1e6f6a (`--airway-teal`) | `--skin-crate-model-silhouette` |
| Weekly board | `.model-widebody::before` → background | #c8352a (`--airway-jam`) | `--skin-crate-model-silhouette-wide` |
| Weekly board | `.airway-upgrade-heading` → border-bottom | #2a2420 (`--airway-ink`) | `--skin-crate-rule` |
| Weekly board | `.airway-upgrade-key` → color | #5e4e3a | `--skin-crate-key-ink` |
| Weekly board | `.airway-upgrade-stamp` → border; `.airway-upgrade-stamp` → color | #c8352a (`--airway-jam`) | `--skin-crate-stamp-ink` |
| Weekly board | `.airway-upgrade-back` → background | #1c1e20 (`--airway-board`) | `--skin-crate-back-bg` |
| Weekly board | `.airway-upgrade-back` → color | #ffc72c (`--airway-sign`) | `--skin-crate-back-ink` |
| Weekly board | `.airway-upgrade-back:active` → background | #3a3c3e | `--skin-crate-back-pressed-bg` |
| Weekly board | `.airway-upgrade-back:focus-visible` → outline | #1c1e20 (`--airway-board`) | `--skin-crate-back-focus` |
| Weekly board | `.airway-upgrade-waybill` → --aw-contract-paper | #f3ecdc | `--skin-crate-waybill-bg` |
| Weekly board | `.airway-upgrade-waybill` → --aw-contract-ink | #2a2420 (`--airway-ink`) | `--skin-crate-waybill-ink` |
| Weekly board | `.airway-upgrade-waybill` → --aw-contract-muted | #5e4e3a | `--skin-crate-waybill-muted` |
| Weekly board | `.airway-upgrade-waybill` → --aw-contract-rule | #2a2420 (`--airway-ink`) | `--skin-crate-waybill-rule` |
| Hub cause board | `.airway-hub-board--jammed` → border-image; `.airway-hub-board` → background | #1c1e20 (`--airway-board`) | `--skin-hubboard-bg` |
| Hub cause board | `.airway-hub-board__close` → color; `.airway-hub-board` → color | #f2efe6 (`--airway-flap-text`) | `--skin-hubboard-ink` |
| Hub cause board | `.airway-hub-board__close:focus-visible` → outline; `.airway-hub-board` → border-top | #ffc72c (`--airway-sign`) | `--skin-hubboard-accent` |
| (skin) | `--skin-hubboard-shadow` → value | #fbf8f1 (`--airway-ticket`) | `--skin-hubboard-offset` |
| Hub cause board | `.airway-hub-board--jammed` → border-image; `.airway-hub-board--jammed` → border-top-color | #c8352a (`--airway-jam`) | `--skin-hubboard-jam` |
| Hub cause board | `.airway-hub-board__close` → border-left; `.airway-hub-board__head` → border-bottom; `.airway-hub-board__row` → border-bottom | #4b4a44 | `--skin-hubboard-rule` |
| Hub cause board | `.airway-hub-board__mark` → color; `.airway-hub-board__title` → color | #ffc72c (`--airway-sign`) | `--skin-hubboard-title-ink` |
| Hub cause board | `.airway-hub-board__empty` → color; `.airway-hub-board__fill` → color; `.airway-hub-board__row[data-cause='none'] .airway-hub-board__text` → color | #d5cfbf | `--skin-hubboard-dim-ink` |
| Hub cause board | `.airway-hub-board__row[data-cause='none'] .airway-hub-board__mark` → color | #8f8a7c | `--skin-hubboard-mark-none-ink` |
| Game-over report | `.airway-go-overlay` → background | rgba(17, 35, 33, .63) | `--skin-go-scrim` |
| Game-over report | `.airway-go-overlay` → color; `.airway-go-share-text` → color | #2a2420 (`--airway-ink`) | `--skin-go-ink` |
| Game-over report | `.airway-go-sign-mark::before` → background; `.airway-go-sign` → background | #ffc72c (`--airway-sign`) | `--skin-go-sign-bg` |
| Game-over report | `.airway-go-map:focus-visible` → outline; `.airway-go-map` → border; `.airway-go-map` → color; `.airway-go-sign` → color | #1c1e20 (`--airway-board`) | `--skin-go-sign-ink` |
| Game-over report | `.airway-go-sign-mark` → background | #1c1e20 (`--airway-board`) | `--skin-go-sign-mark-bg` |
| Game-over report | `.airway-go-board` → background | #1c1e20 (`--airway-board`) | `--skin-go-board-bg` |
| Game-over report | `.airway-go-board` → color | #f2efe6 (`--airway-flap-text`) | `--skin-go-board-ink` |
| Game-over report | `.airway-go-board-title` → color | #ffc72c (`--airway-sign`) | `--skin-go-board-title-ink` |
| Game-over report | `.airway-go-board-head` → border-bottom | #53565a | `--skin-go-board-head-rule` |
| Game-over report | `.airway-go-board-head` → color; `.airway-go-none-hint` → color | #a6a8aa | `--skin-go-board-dim-ink` |
| Game-over report | `.airway-go-flight` → border-bottom | #36393b | `--skin-go-board-row-rule` |
| Game-over report | `.airway-go-flight-gate` → color | #d6b88a (`--airway-kraft`) | `--skin-go-board-gate-ink` |
| Game-over report | `.airway-go-flap` → color | #fff0e9 | `--skin-go-flap-ink` |
| Game-over report | `.airway-go-flap` → background | #862a27 | `--skin-go-flap-bg` |
| Game-over report | `.airway-go-flap` → border-top | #bd5147 | `--skin-go-flap-edge-light` |
| Game-over report | `.airway-go-flap` → border-bottom | #491818 | `--skin-go-flap-edge-dark` |
| Game-over report | `.airway-go-none-line` → color | #fbf8f1 (`--airway-ticket`) | `--skin-go-board-strong-ink` |
| Game-over report | `.airway-go-share-text` → background; `.airway-go-strip` → background; `.airway-go-tip-label` → color | #fbf8f1 (`--airway-ticket`) | `--skin-go-strip-bg` |
| Game-over report | `.airway-go-strip` → border-left | #c8352a (`--airway-jam`) | `--skin-go-strip-margin` |
| Game-over report | `.airway-go-strip::before` → border-left | #cc6e62 | `--skin-go-strip-margin-dash` |
| Game-over report | `.airway-go-strip-title` → color; `.airway-go-tab:focus-visible` → outline; `.airway-go-tab[aria-selected="true"]` → border-bottom; `.airway-go-tab[aria-selected="true"]` → color; `.airway-go-timeline-mark` → color; `.airway-go-tip-label` → background; … (8 uses) | #13302e (`--airway-panel`) | `--skin-go-strip-heading-ink` |
| Game-over report | `.airway-go-score` → color; `.airway-go-share-status` → color | #1e6f6a (`--airway-teal`) | `--skin-go-strip-value-ink` |
| Game-over report | `.airway-go-causes-title` → border-top; `.airway-go-milestones` → --aw-ms-rule; `.airway-go-share-text` → border; `.airway-go-tab + .airway-go-tab` → border-left; `.airway-go-tab` → border-bottom; `.airway-go-tabs` → border-top | #beb4a4 | `--skin-go-strip-rule` |
| Game-over report | `.airway-go-causes li::marker` → color; `.airway-go-timeline-end .airway-go-timeline-mark` → color | #c8352a (`--airway-jam`) | `--skin-go-strip-alert-ink` |
| Game-over report | `.airway-go-tab` → color; `.airway-go-timeline-note` → color | #6b6156 | `--skin-go-strip-dim-ink` |
| Game-over report | `.airway-go-timeline-week` → border-bottom | #e6ddcf | `--skin-go-strip-rule-light` |
| Game-over report | `.airway-go-milestones` → --aw-ms-stamp; `.airway-go-record` → color | #a32b25 | `--skin-go-strip-record-ink` |
| Game-over report | `.airway-go-button` → border | #1c1e20 (`--airway-board`) | `--skin-go-action-border` |
| Game-over report | `.airway-go-button:focus-visible` → outline | #ffc72c (`--airway-sign`) | `--skin-go-action-focus` |
| Game-over report | `.airway-go-same` → background | #ffc72c (`--airway-sign`) | `--skin-go-action-primary-bg` |
| Game-over report | `.airway-go-new` → color; `.airway-go-same` → color; `.airway-go-share-button` → color | #1c1e20 (`--airway-board`) | `--skin-go-action-ink` |
| Game-over report | `.airway-go-new` → background; `.airway-go-share-button` → background | #fbf8f1 (`--airway-ticket`) | `--skin-go-action-bg` |
| Game-over report | `.airway-go-menu` → background | #1c1e20 (`--airway-board`) | `--skin-go-action-dark-bg` |
| Game-over report | `.airway-go-menu` → color | #fbf8f1 (`--airway-ticket`) | `--skin-go-action-dark-ink` |
| Game-over report | `.airway-go-map` → background | #fbf8f1 (`--airway-ticket`) | `--skin-go-map-tab-bg` |
| Game-over report | `.airway-go-mapbar` → background | #fbf8f1 (`--airway-ticket`) | `--skin-go-mapbar-bg` |
| Game-over report | `.airway-go-mapbar` → border-left | #c8352a (`--airway-jam`) | `--skin-go-mapbar-margin` |
| Game-over report | `.airway-go-mapback` → color; `.airway-go-mapbar` → color | #1c1e20 (`--airway-board`) | `--skin-go-mapbar-ink` |
| Game-over report | `.airway-go-mapback` → background | #ffc72c (`--airway-sign`) | `--skin-go-mapback-bg` |
| Game-over report | `.airway-go-milestones` → --aw-ms-ink | #2a2420 (`--airway-ink`) | `--skin-go-milestone-ink` |
| Game-over report | `.airway-go-milestones` → --aw-ms-done | #1e6f6a (`--airway-teal`) | `--skin-go-milestone-done` |
| Game-over report | `.airway-go-milestones` → --aw-ms-open | #6b6257 | `--skin-go-milestone-open` |
| Main menu + settings | `.airway-menu` → color | #fbf8f1 (`--airway-ticket`) | `--skin-menu-ink` |
| Main menu + settings | `.airway-sign__pictogram` → color; `.airway-sign` → background | #ffc72c (`--airway-sign`) | `--skin-menu-sign-bg` |
| Main menu + settings | `.airway-sign__pictogram` → background; `.airway-sign` → color | #1c1e20 (`--airway-board`) | `--skin-menu-sign-ink` |
| Main menu + settings | `.airway-board` → background | #1c1e20 (`--airway-board`) | `--skin-menu-board-bg` |
| Main menu + settings | `.airway-board` → border | #141516 | `--skin-menu-board-frame` |
| (skin) | `--skin-menu-board-shadow` → value | #454849 | `--skin-menu-board-ledge` |
| Main menu + settings | `.airway-board__header` → color | #bfc2c3 | `--skin-menu-board-head-ink` |
| Main menu + settings | `.airway-board__service .airway-flight--half + .airway-flight--half` → border-left; `.airway-board__service` → border-top; `.airway-flight-line` → border-top; `.airway-flight__region` → border; `.airway-flight` → border-top | #050505 | `--skin-menu-board-rule` |
| Main menu + settings | `.airway-flight` → color | #f7f3ea (`--airway-paper`) | `--skin-menu-board-ink` |
| Main menu + settings | `.airway-flight:hover` → outline; `.airway-flight__region:focus-visible` → outline | #ffc72c (`--airway-sign`) | `--skin-menu-board-focus` |
| Main menu + settings | `.airway-flight:hover` → background | #323436 | `--skin-menu-board-hover-bg` |
| Main menu + settings | `.airway-flight:active` → background | #414448 | `--skin-menu-board-pressed-bg` |
| Main menu + settings | `.airway-flight__sub` → color | #b6bbbe | `--skin-menu-board-sub-ink` |
| Main menu + settings | `.airway-flight__region` → background-color; `.flap-half` → background | #2c2f32 (`--airway-flap`) | `--skin-menu-flap-bg` |
| Main menu + settings | `.airway-flight__region` → color | #f2efe6 (`--airway-flap-text`) | `--skin-menu-select-ink` |
| Main menu + settings | `.airway-flight__region option` → color | #1c1e20 (`--airway-board`) | `--skin-menu-option-ink` |
| Main menu + settings | `.airway-flight__region option` → background | #f7f3ea (`--airway-paper`) | `--skin-menu-option-bg` |
| Main menu + settings | `.split-flap` → color | #f1f2ee | `--skin-menu-flap-ink` |
| Main menu + settings | `.split-flap--highlight` → color | #ffc72c (`--airway-sign`) | `--skin-menu-flap-highlight-ink` |
| Main menu + settings | `.flap-half--top` → border-bottom | #090a0a | `--skin-menu-flap-top-edge` |
| Main menu + settings | `.flap-half--bottom` → background | #26282b | `--skin-menu-flap-bottom-bg` |
| Main menu + settings | `.flap-half--bottom` → border-top | #121416 | `--skin-menu-flap-bottom-edge` |
| Main menu + settings | `.airway-notice` → background | #fbf8f1 (`--airway-ticket`) | `--skin-menu-notice-bg` |
| Main menu + settings | `.airway-notice` → border-left | #c8352a (`--airway-jam`) | `--skin-menu-notice-margin` |
| Main menu + settings | `.airway-notice` → color | #2a2420 (`--airway-ink`) | `--skin-menu-notice-ink` |
| Main menu + settings | `.airway-settings` → background | #8cc3d8 (`--airway-sky`) | `--skin-settings-backdrop` |
| Main menu + settings | `.airway-settings__group-title` → color; `.airway-settings__paper` → background | #fbf8f1 (`--airway-ticket`) | `--skin-settings-paper` |
| Main menu + settings | `.airway-glyph-legend__row` → color; `.airway-glyph-legend__title` → color; `.airway-keys__row` → color; `.airway-publisher__row dd` → color; `.airway-settings__back` → border; `.airway-settings__back` → color; `.airway-settings__heading` → border-bottom; … (8 uses) | #2a2420 (`--airway-ink`) | `--skin-settings-ink` |
| Main menu + settings | `.airway-privacy__overline` → color; `.airway-setting__control` → border; `.airway-setting__switch input` → accent-color; `.airway-settings__group-title` → background; `.airway-settings__paper` → border-top; `.airway-unsupported__gpu` → border-left | #1e6f6a (`--airway-teal`) | `--skin-settings-accent` |
| Main menu + settings | `.airway-settings__back` → background | #ffc72c (`--airway-sign`) | `--skin-settings-back-bg` |
| Main menu + settings | `.airway-glyph-legend__row` → border-bottom; `.airway-keys__row` → border-bottom; `.airway-licenses li` → border-bottom; `.airway-privacy__section` → border-bottom; `.airway-publisher__row` → border-bottom; `.airway-setting` → border-bottom | #c2b5a6 | `--skin-settings-rule` |
| Main menu + settings | `.airway-setting__control` → background | #fff | `--skin-settings-control-bg` |
| Main menu + settings | `.airway-setting__control` → color | #13302e (`--airway-panel`) | `--skin-settings-control-ink` |
| Main menu + settings | `.airway-privacy__warning` → border; `.airway-setting__control:focus-visible` → outline | #c8352a (`--airway-jam`) | `--skin-settings-alert` |
| Main menu + settings | `.airway-setting__swatch` → box-shadow | #2a242033 | `--skin-settings-swatch-edge` |
| Main menu + settings | `.airway-privacy__date` → color; `.airway-publisher__row dt` → color; `.airway-setting__hint` → color | #55514a | `--skin-settings-dim-ink` |
| Main menu + settings | `.airway-settings__licenses` → background | #1c1e20 (`--airway-board`) | `--skin-settings-licenses-bg` |
| Main menu + settings | `.airway-settings__licenses` → color | #ffc72c (`--airway-sign`) | `--skin-settings-licenses-ink` |
| Main menu + settings | `.airway-privacy__warning` → color | #8a2219 | `--skin-settings-warning-ink` |
| Main menu + settings | `.airway-unsupported__gpu` → background | #efe8da | `--skin-settings-note-bg` |

## Tokens added by the follow-up (night N11as)

Same order: typefaces and weights (existing tokens, new uses), motion, then colours by component.

| Component | Selector → property | Current value | Token |
|---|---|---|---|
| ATC strip, route menu + handles, first-time card, Puzzle board + game, Tutorial | `.airway-atc-error` → font; `.airway-first-time__ok` → font; `.airway-route-menu button` → font; `.aw-settings-dialog h2` → font; `.aw-settings-sign` → font; `.aw-strip-index` → font; `.aw-tutorial-kicker` → font-family; `.puzzle-board-title` → font-family; … (12 uses) | 'Overpass', sans-serif | `--skin-face-display` |
| ATC strip, route menu + handles, first-time card, Leaderboard, Logbook, Puzzle board + game, Tutorial | `.airway-atc-flight` → font-family; `.airway-logbook__flights th` → font; `.airway-logbook__flights` → font; `.airway-logbook__records dd` → font; `.airway-logbook__summary-text` → font; `.airway-logbook__totals dd` → font; `.airway-logbook__totals dt` → font; `.airway-rank-column-title` → font; … (19 uses) | 'Overpass Mono', monospace | `--skin-face-mono` |
| ATC strip, route menu + handles, first-time card, Leaderboard, Logbook, Puzzle board + game, Tutorial | `.airway-atc-strip` → font; `.airway-logbook__empty` → font; `.airway-logbook__records dt` → font; `.airway-rank-empty, .airway-rank-status` → font; `.aw-strip-copy` → font; `.aw-tutorial` → font-family; `.puzzle-shell` → font-family | 'Atkinson Hyperlegible Next', sans-serif | `--skin-face-text` |
| ATC strip, route menu + handles, first-time card, Leaderboard, Logbook, Puzzle board + game, Tutorial | `.airway-atc-strip` → font; `.airway-logbook__flights th` → font; `.airway-logbook__flights` → font; `.airway-logbook__records dd` → font; `.airway-logbook__records dt` → font; `.airway-logbook__totals dt` → font; `.airway-rank-column-title` → font; `.airway-rank-title` → font; … (24 uses) | 700 | `--skin-weight-bold` |
| ATC strip, route menu + handles, first-time card, Logbook, Puzzle board + game, Tutorial | `.airway-atc-error` → font; `.airway-first-time__ok` → font; `.airway-logbook__totals dd` → font; `.airway-route-menu button` → font; `.aw-settings-dialog h2` → font; `.aw-settings-sign` → font; `.aw-strip-index` → font; `.aw-tutorial-kicker` → font-weight; … (15 uses) | 800 | `--skin-weight-heavy` |
| Leaderboard, Logbook, Puzzle board + game | `.airway-logbook__empty` → font; `.airway-logbook__milestones [data-reached="false"] dd` → font-weight; `.airway-logbook__summary-text` → font; `.airway-rank-empty, .airway-rank-status` → font; `.puzzle-curfew-hours` → font-weight | 400 | `--skin-weight-regular` |
| Puzzle board + game | `:root:not([data-airway-motion="reduce"]) .puzzle-flap:active` → transition | 80ms | `--skin-puzzle-motion-press` |
| Tutorial | `.aw-tutorial[data-step="route"] .aw-guide-primary` → animation | 1000ms | `--skin-tutorial-motion-guide` |
| Tutorial | `.aw-tutorial-world` → transition | 200ms | `--skin-tutorial-motion-world` |
| ATC strip, route menu + handles, first-time card | `.airway-atc-error` → color; `.airway-route-menu .airway-route-menu-danger` → color | #ae2d23 | `--skin-atc-error-ink` |
| ATC strip, route menu + handles, first-time card | `.airway-atc-field` → border-right | #cdbf8f | `--skin-atc-field-rule` |
| ATC strip, route menu + handles, first-time card | `.airway-route-handle--active::before` → background | #ffc72c (`--airway-sign`) | `--skin-atc-handle-active-bg` |
| ATC strip, route menu + handles, first-time card | `.airway-route-handle::before` → outline | #fbf8f1 (`--airway-ticket`) | `--skin-atc-handle-halo` |
| ATC strip, route menu + handles, first-time card | `.airway-route-handle::before` → border | #13302e (`--airway-panel`) | `--skin-atc-handle-rim` |
| ATC strip, route menu + handles, first-time card | `.airway-atc-strip` → color; `.airway-route-menu` → color | #2a2420 (`--airway-ink`) | `--skin-atc-ink` |
| ATC strip, route menu + handles, first-time card | `.airway-route-menu` → border | #13302e (`--airway-panel`) | `--skin-atc-menu-border` |
| ATC strip, route menu + handles, first-time card | `.airway-route-menu button:focus-visible` → outline | #ffc72c (`--airway-sign`) | `--skin-atc-menu-focus` |
| ATC strip, route menu + handles, first-time card | `.airway-route-menu button` → border-bottom | #baa985 | `--skin-atc-menu-rule` |
| ATC strip, route menu + handles, first-time card | `.airway-route-menu` → box-shadow | #2a2420 (`--airway-ink`) | `--skin-atc-menu-shadow` |
| ATC strip, route menu + handles, first-time card | `.airway-first-time__ok` → background | #ffc72c (`--airway-sign`) | `--skin-atc-ok-bg` |
| ATC strip, route menu + handles, first-time card | `.airway-first-time__ok:focus-visible` → outline | #13302e (`--airway-panel`) | `--skin-atc-ok-focus` |
| ATC strip, route menu + handles, first-time card | `.airway-first-time__ok` → color | #1c1e20 (`--airway-board`) | `--skin-atc-ok-ink` |
| ATC strip, route menu + handles, first-time card | `.airway-first-time__ok` → border-left | #9e916c | `--skin-atc-ok-rule` |
| ATC strip, route menu + handles, first-time card | `.airway-atc-strip` → background; `.airway-route-menu` → background | #fbf8f1 (`--airway-ticket`) | `--skin-atc-paper` |
| ATC strip, route menu + handles, first-time card | `.airway-atc-strip` → border-left | #c8352a (`--airway-jam`) | `--skin-atc-strip-edge` |
| ATC strip, route menu + handles, first-time card | `.airway-atc-strip` → box-shadow | #9e916c | `--skin-atc-strip-ledge` |
| Region glyphs (glyphs.ts) | `regionGlyph()` path → style.stroke | #fbf8f1 (`--airway-ticket`) | `--skin-glyph-outline` |
| Logbook | `.airway-logbook__flights tr[data-mode="daily"] .airway-logbook__mode::before` → background | #1e6f6a (`--airway-teal`) | `--skin-logbook-daily-mark` |
| Logbook | `.airway-logbook__paper` → border-left | #c8352a (`--airway-jam`) | `--skin-logbook-edge` |
| Logbook | `.airway-logbook__empty` → color; `.airway-logbook__flights` → color; `.airway-logbook__records dt` → color | #2a2420 (`--airway-ink`) | `--skin-logbook-ink` |
| Logbook | `.airway-logbook__flights th` → color; `.airway-logbook__totals dt` → color | #55514a | `--skin-logbook-label-ink` |
| Logbook | `.airway-logbook__milestones` → --aw-ms-done | #1e6f6a (`--airway-teal`) | `--skin-logbook-milestone-done` |
| Logbook | `.airway-logbook__milestones` → --aw-ms-open | #6b6257 | `--skin-logbook-milestone-open` |
| Logbook | `.airway-logbook__flights td` → border-bottom; `.airway-logbook__records .airway-logbook__cell` → border-bottom; `.airway-logbook__totals .airway-logbook__cell:nth-child(odd)` → border-right; `.airway-logbook__totals .airway-logbook__cell` → border-bottom | #c2b5a6 | `--skin-logbook-row-rule` |
| Logbook | `.airway-logbook__flights th` → border-bottom; `.airway-logbook__flights th` → border-top; `.airway-logbook__records` → border-top; `.airway-logbook__summary-text` → border; `.airway-logbook__totals` → border-top | #2a2420 (`--airway-ink`) | `--skin-logbook-rule` |
| Logbook | `.airway-logbook__summary-text` → background | #fbf6ec | `--skin-logbook-summary-bg` |
| Logbook | `.airway-logbook__records dd` → color; `.airway-logbook__summary-text` → color; `.airway-logbook__totals dd` → color | #13302e (`--airway-panel`) | `--skin-logbook-value-ink` |
| Puzzle board + game | `.puzzle-back` → border | #1c1e20 (`--airway-board`) | `--skin-puzzle-back-border` |
| Puzzle board + game | `.puzzle-best` → color | #1e6f6a (`--airway-teal`) | `--skin-puzzle-best-ink` |
| Puzzle board + game | `.puzzle-count` → color; `.puzzle-departures` → scrollbar-color; `.puzzle-flap-number` → color; `.puzzle-flap-stars.is-done` → color; `.puzzle-pack` → color | #ffc72c (`--airway-sign`) | `--skin-puzzle-board-accent` |
| Puzzle board + game | `.puzzle-board` → background | #1c1e20 (`--airway-board`) | `--skin-puzzle-board-bg` |
| Puzzle board + game | `.puzzle-board` → border-left; `.puzzle-board` → border-right | #ffc72c (`--airway-sign`) | `--skin-puzzle-board-edge` |
| Puzzle board + game | `.puzzle-board` → color; `.puzzle-flap` → color | #fbf8f1 (`--airway-ticket`) | `--skin-puzzle-board-ink` |
| Puzzle board + game | `.puzzle-hub` → border; `.puzzle-route` → border | #b9c5b8 | `--skin-puzzle-card-rule` |
| Puzzle board + game | `.puzzle-controls` → background | #13302e (`--airway-panel`) | `--skin-puzzle-controls-bg` |
| Puzzle board + game | `.puzzle-board-footer` → color; `.puzzle-control` → border | #a9bdb8 (`--airway-dim`) | `--skin-puzzle-dim` |
| Puzzle board + game | `.puzzle-error` → color | #90251b | `--skin-puzzle-error-ink` |
| Puzzle board + game | `.puzzle-flap` → background | #2c2f32 (`--airway-flap`) | `--skin-puzzle-flap-bg` |
| Puzzle board + game | `.puzzle-flap-best` → color; `.puzzle-flap-gate` → color; `.puzzle-flap-stars` → color | #b5c3c1 | `--skin-puzzle-flap-dim-ink` |
| Puzzle board + game | `.puzzle-flap:hover, .puzzle-flap:focus-visible` → background | #393d40 | `--skin-puzzle-flap-hover-bg` |
| Puzzle board + game | `.puzzle-flap::after` → border-top | #17191a | `--skin-puzzle-flap-split` |
| Puzzle board + game | `.puzzle-shell button:focus-visible` → outline | #ffc72c (`--airway-sign`) | `--skin-puzzle-focus` |
| Puzzle board + game | `.puzzle-game` → background | #e5e7df | `--skin-puzzle-game-bg` |
| Puzzle board + game | `.puzzle-control` → color; `.puzzle-hub` → color; `.puzzle-ticket` → color | #13302e (`--airway-panel`) | `--skin-puzzle-ink` |
| Puzzle board + game | `.puzzle-error` → background; `.puzzle-result.lost` → background | #f1ded9 | `--skin-puzzle-lost-bg` |
| Puzzle board + game | `.puzzle-result.lost` → border-color | #c8352a (`--airway-jam`) | `--skin-puzzle-lost-edge` |
| Puzzle board + game | `.puzzle-flap` → border-bottom; `.puzzle-pack` → background; `.puzzle-pack` → border-bottom | #151718 | `--skin-puzzle-pack-bg` |
| Puzzle board + game | `.puzzle-control` → background; `.puzzle-hub` → background; `.puzzle-route` → background; `.puzzle-stat` → background; `.puzzle-ticket` → background | #fbf8f1 (`--airway-ticket`) | `--skin-puzzle-paper` |
| Puzzle board + game | `.puzzle-result` → background | #e3e9e1 | `--skin-puzzle-result-bg` |
| Puzzle board + game | `.puzzle-departures` → scrollbar-color | #222528 | `--skin-puzzle-scroll-track` |
| Puzzle board + game | `.puzzle-control.primary` → background; `.puzzle-control.primary` → border-color; `.puzzle-exit` → background; `.puzzle-game-sign` → background; `.puzzle-route.is-active` → border-left-color; `.puzzle-sign` → background | #ffc72c (`--airway-sign`) | `--skin-puzzle-sign-bg` |
| Puzzle board + game | `.puzzle-control.primary` → color; `.puzzle-exit` → color; `.puzzle-game-sign` → color; `.puzzle-sign-plane::after` → background; `.puzzle-sign-plane::before` → background; `.puzzle-sign` → color | #1c1e20 (`--airway-board`) | `--skin-puzzle-sign-ink` |
| Puzzle board + game | `.puzzle-stats` → background; `.puzzle-stats` → border | #b8c9bd | `--skin-puzzle-stats-rule` |
| Puzzle board + game | `.puzzle-supply` → color | #38524d | `--skin-puzzle-supply-ink` |
| Puzzle board + game | `.puzzle-game` → border-left; `.puzzle-game` → border-right; `.puzzle-kicker` → color; `.puzzle-result` → border-left; `.puzzle-route` → border-left; `.puzzle-ticket` → border-bottom; `.puzzle-ticket` → border-right | #1e6f6a (`--airway-teal`) | `--skin-puzzle-teal` |
| Leaderboard | `.airway-rank-row.is-me` → color; `.airway-rank-title` → color | #ffc72c (`--airway-sign`) | `--skin-rank-accent` |
| Leaderboard | `.airway-rank` → background | #1c1e20 (`--airway-board`) | `--skin-rank-bg` |
| Leaderboard | `.airway-rank-column-title` → color; `.airway-rank-empty, .airway-rank-status` → color | #a9b3b1 | `--skin-rank-dim-ink` |
| Leaderboard | `.airway-rank-column-title` → border-bottom | #3b3e41 | `--skin-rank-head-rule` |
| Leaderboard | `.airway-rank` → color | #e9e3d4 | `--skin-rank-ink` |
| Leaderboard | `.airway-rank-row` → border-bottom | #2c2f31 | `--skin-rank-row-rule` |
| Puzzle board + game | `.puzzle-curfew-mark` inline SVG → fill/stroke (shared with the airport tag) | #fbf8f1 (`--airway-ticket`) | `--skin-tag-barrier-boom` |
| Puzzle board + game | `.puzzle-curfew-mark` inline SVG → fill/stroke (shared with the airport tag) | #13302e (`--airway-panel`) | `--skin-tag-barrier-post` |
| Puzzle board + game | `.puzzle-curfew-mark` inline SVG → fill/stroke (shared with the airport tag) | #b8322a | `--skin-tag-barrier-stripe` |
| Tutorial | `.aw-city` → color; `.aw-plane-tag, .aw-action-tag` → color; `.aw-tutorial-strip` → color; `.aw-tutorial-ticket` → color | #2a2420 (`--airway-ink`) | `--skin-tutorial-card-ink` |
| Tutorial | `.aw-settings-dialog` → background | #1c1e20 (`--airway-board`) | `--skin-tutorial-dialog-bg` |
| Tutorial | `.aw-settings-dialog button` → background | #2c2f32 (`--airway-flap`) | `--skin-tutorial-dialog-button-bg` |
| Tutorial | `.aw-settings-dialog button` → border | #9ba19e | `--skin-tutorial-dialog-button-rule` |
| Tutorial | `.aw-settings-dialog button` → color; `.aw-settings-dialog` → color | #fbf8f1 (`--airway-ticket`) | `--skin-tutorial-dialog-ink` |
| Tutorial | `.aw-tutorial-dock` → background | #13302e (`--airway-panel`) | `--skin-tutorial-dock-bg` |
| Tutorial | `.aw-tutorial button:focus-visible` → outline | #ff7a3d (`--airway-accent`) | `--skin-tutorial-focus` |
| Tutorial | `.aw-guide` → stroke; `.aw-live-path` → stroke | #ff7a3d (`--airway-accent`) | `--skin-tutorial-guide` |
| Tutorial | `.aw-tutorial-hint` → color; `.aw-tutorial` → color | #13302e (`--airway-panel`) | `--skin-tutorial-ink` |
| Tutorial | `.aw-ticket-skip` → background; `.aw-tutorial-ticket` → background | #fbf8f1 (`--airway-ticket`) | `--skin-tutorial-paper` |
| Tutorial | `.aw-ticket-perf` → border-left; `.aw-ticket-perf` → border-top | #789b94 | `--skin-tutorial-perforation` |
| Tutorial | `.aw-route` → stroke | #f4f0db | `--skin-tutorial-route` |
| Tutorial | `.aw-route-feeder` → stroke | #e6b666 | `--skin-tutorial-route-feeder` |
| Tutorial | `.aw-route-primary` → stroke | #fbf8f1 (`--airway-ticket`) | `--skin-tutorial-route-primary` |
| Tutorial | `.aw-complete-action` → background; `.aw-settings-dialog` → border; `.aw-settings-sign` → background | #ffc72c (`--airway-sign`) | `--skin-tutorial-sign-bg` |
| Tutorial | `.aw-settings-sign` → border; `.aw-settings-sign` → color | #1c1e20 (`--airway-board`) | `--skin-tutorial-sign-ink` |
| Tutorial | `.aw-tutorial-stage` → background; `.aw-tutorial-world` → background | #8cc3d8 (`--airway-sky`) | `--skin-tutorial-sky` |
| Tutorial | `.aw-plane-tag, .aw-action-tag` → background; `.aw-tutorial-strip` → background | #f7f3ea (`--airway-paper`) | `--skin-tutorial-strip-bg` |
| Tutorial | `.aw-tutorial-strip` → border-left | #c8352a (`--airway-jam`) | `--skin-tutorial-strip-edge` |
| Tutorial | `.aw-route-drop` → color; `.aw-tutorial[data-step="route"] .aw-city-lon .aw-airport, .aw-tutorial[data-step="route"] .aw-city-par .aw-airport, .aw-tutorial[data-step="transfer"] .aw-city-par .aw-airport` → outline | #ffc72c (`--airway-sign`) | `--skin-tutorial-target` |
| Tutorial | `.aw-plane-tag svg` → color; `.aw-strip-index` → color; `.aw-ticket-skip` → color; `.aw-tutorial-dock` → border-left; `.aw-tutorial-dock` → border-top; `.aw-tutorial-ticket` → border | #1e6f6a (`--airway-teal`) | `--skin-tutorial-teal` |

## Structural values (stay in the component CSS)

Sizes, paddings, rules and die-cut shapes are the geometry of each object; a skin changes them with small per-component
edits (the direction notes in `KIERUNKI.md` list the files). Titles sized with `clamp()` (menu sign, weekly sign,
game-over heading, upgrade title) are also here.

| Component | Property | Current values (structural, stay in the component CSS) |
|---|---|---|
| HUD: boarding pass + tag dock | font size | `11px`, `14px`, `17px`, `19px`, `8px`, `9px` |
| HUD: boarding pass + tag dock | padding | `0`, `0 3px`, `0 6px`, `0 8px`, `14px 4px 2px`, `16px`, `3px`, `5px`, `6px 0`, `8px 3px 8px 9px` |
| HUD: boarding pass + tag dock | letter spacing | `-.01em`, `.075em` |
| HUD: boarding pass + tag dock | border width/style | `2px dashed`, `2px solid`, `6px solid` |
| HUD: boarding pass + tag dock | clip-path (die-cut shapes) | `polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0…` |
| Airport tags and chips | padding | `0`, `0 4px`, `0 5px`, `0 9px 0 0`, `12px`, `2px`, `3px`, `4px 7px 4px 16px`, `6px`, `8px` |
| Airport tags and chips | clip-path (die-cut shapes) | `polygon(0 0,calc(100% - 6px) 0,100% 6px,100% calc(100% - 6px…`, `polygon(9px 0,100% 0,100% 100%,9px 100%,0 50%)` |
| Airport tags and chips | font size | `10px`, `11px`, `12px`, `13px` |
| Airport tags and chips | border width/style | `1.5px solid`, `1px solid`, `2px solid`, `6px solid` |
| Airport tags and chips | letter spacing | `.03em`, `.06em`, `0` |
| Pause sheet | padding | `10px 14px`, `14px 14px 12px 22px`, `4px 0` |
| Pause sheet | border width/style | `1px dashed`, `2px solid`, `8px solid` |
| Pause sheet | font size | `calc(11px * var(--airway-text-scale))`, `var(--airway-font-body)`, `var(--airway-font-title)` |
| Pause sheet | letter spacing | `.05em`, `.08em` |
| Weekly board | padding | `0 12px`, `0 14px 0 10px`, `10px`, `10px 14px 20px 10px`, `10px 14px 22px`, `10px 22px 10px 20px`, `12px`, `12px 20px 12px 18px`, `13px`, `16px`, `2px`, `2px 7px`, `3px 12px 3px`, `4px`, `4px 10px 5px`, `5px`, `5px 14px 6px 12px`, `6px 12px 6px 10px`, `6px 14px 7px`, `8px 12px 16px 8px`, `8px 14px 8px 12px`, `8px 18px 8px 16px`, `calc(10px + var(--aw-safe-top))`, `calc(6px + var(--aw-safe-bottom))`, … (29 values) |
| Weekly board | font size | `10px`, `11px`, `12px`, `13px`, `calc(10px * var(--airway-text-scale))`, `calc(12px * var(--airway-text-scale))`, `calc(13px * var(--airway-text-scale))`, `calc(14px * var(--airway-text-scale))`, `calc(15px * var(--airway-text-scale))`, `calc(16px * var(--airway-text-scale))`, `calc(18px * var(--airway-text-scale))`, `calc(20px * var(--airway-text-scale))`, `calc(24px * var(--airway-text-scale))`, `clamp(24px, 4.6vh, … (16 values) |
| Weekly board | clip-path (die-cut shapes) | `inset(50%)`, `none`, `polygon(0 0, 100% 0, 100% calc(100% - 8px), 96% 100%, 92% ca…`, `polygon(0 30%, 35% 30%, 48% 0, 52% 0, 65% 30%, 100% 30%, 100…` |
| Weekly board | border width/style | `2px dashed`, `2px solid` |
| Weekly board | letter spacing | `.04em`, `.05em`, `.06em`, `.12em`, `.14em`, `.1em` |
| Hub cause board | border width/style | `1px dashed`, `1px solid`, `4px solid` |
| Hub cause board | font size | `12px`, `13px`, `15px` |
| Hub cause board | padding | `0`, `0 12px`, `12px`, `1px`, `7px 0` |
| Hub cause board | letter spacing | `.07em` |
| Game-over report | padding | `0`, `0 12px`, `0 5px 7px`, `0 8px`, `10px`, `12px`, `14px 16px 13px 20px`, `1px`, `1px 5px 0`, `23px`, `2px`, `2px 0 2px 9px`, `2px 3px`, `3px`, `3px 0`, `3px 0 3px 2px`, `4px`, `4px 5px`, `4px 6px 2px 0`, `5px`, `6px`, `6px 0`, `6px 8px`, `7px`, `7px 13px 7px 7px`, `7px 14px`, `8px`, `8px 8px 8px 16px`, `9px`, `calc(var(--aw-safe-bottom) + 5px)`, `calc(var(--aw-safe-top) + 78px)`, … (32 values) |
| Game-over report | clip-path (die-cut shapes) | `polygon(0 18%, 64% 18%, 64% 0, 100% 50%, 64% 100%, 64% 82%, …` |
| Game-over report | font size | `10px`, `12px`, `calc(11px * var(--airway-text-scale))`, `calc(12px * var(--airway-text-scale))`, `calc(13px * var(--airway-text-scale))`, `calc(14px * var(--airway-text-scale))`, `calc(15px * var(--airway-text-scale))`, `calc(17px * var(--airway-text-scale-title))`, `calc(19px * var(--airway-text-scale-title))`, `calc(9px * var(--airway-text-scale))`, `clamp(10px, 2.2vw, 13px)`, `clamp(11px, 2.4vw, 14px)`, … (14 values) |
| Game-over report | letter spacing | `.045em`, `.04em`, `.06em`, `.075em` |
| Game-over report | border width/style | `1.5px solid`, `1px dashed`, `1px solid`, `2px solid`, `3px solid`, `6px solid`, `8px solid` |
| Main menu + settings | padding | `0`, `0 14px 0 4px`, `10px 2px`, `11px`, `11px 10px 12px`, `11px 16px 12px 12px`, `12px`, `14px`, `1px 5px`, `20px`, `5px 0`, `6px`, `6px 0`, `6px 10px 5px`, `7px 0`, `8px`, `8px 0 4px`, `8px 10px`, `8px 9px`, `9px 0`, `9px 12px`, `calc(var(--aw-safe-top) + 14px) calc(var(--aw-safe-right) + 12px) calc(var(--aw-safe-bottom) + 16px) calc(var(--aw-safe-left) + 12px)` |
| Main menu + settings | font size | `10px`, `11px`, `25px`, `27px`, `39px`, `9px`, `calc(10px * var(--airway-text-scale))`, `calc(11px * var(--airway-text-scale))`, `calc(12px * var(--airway-text-scale))`, `calc(13px * var(--airway-text-scale))`, `calc(14px * var(--airway-text-scale))`, `calc(16px * var(--airway-text-scale))`, `clamp(31px, 8.5vw, 50px)`, `clamp(8px,2.3vw,11px)` |
| Main menu + settings | letter spacing | `-.04em`, `.025em`, `.04em`, `.08em` |
| Main menu + settings | border width/style | `1px dashed`, `1px solid`, `2px dashed`, `2px solid`, `3px solid`, `6px solid`, `7px solid`, `9px solid` |
| Main menu + settings | clip-path (die-cut shapes) | `polygon(0 0,calc(100% - 10px) 0,100% 50%,calc(100% - 10px) 1…`, `polygon(0 100%,38% 0,100% 0,62% 100%)` |
