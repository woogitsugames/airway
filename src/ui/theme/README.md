# Accessibility integration — task 20

Task 20 is intentionally independent from unfinished tasks 06 and 13.
It supplies adapters and tokens but does not invent a production HUD.

## Application bootstrap

`src/main.ts` imports `theme.css` and calls `initializeAccessibility()`.
Preferences use the existing `airway.settings` JSON record without overwriting
the language chosen through `src/i18n`.

## Airport overlays

[night-12q] The original task-20 city announcer and action-label adapters were never wired in and were removed
(R5i). The overlay (`src/ui/overlay.ts`) and the HUD give their native buttons translated labels themselves.

Destination glyph SVG elements need `data-airway-destination` (or class
`airway-destination-glyph`) and their six region fills from
`src/ui/theme/tokens.json`. Preserve the six distinct silhouettes. The
enhanced setting changes size from 16 to 21 px and outline from 1.5 to 3 px.

## HUD, dock and menu

Use `airway-text-label`, `airway-text-body`, `airway-text-value` and
`airway-text-title` on role text; these consume 100/115/130% typography
tokens without scaling buttons/containers or their hit areas. Mark HUD/menu
root with `data-airway-hud` / `data-airway-menu`. The controls fragment
`createAccessibilityControls()` belongs in task 14 settings, not on the
placeholder sky scene. Test real 130% layout at 412×915, 915×412, 673×841
and 904×1000 when the HUD is merged.

## Route and jam events (task 07 / 08)

Call `hapticSnap()` after a successful snap, never for an invalid route.
Keep one `createJamHaptics()` object in the presentation layer, and call
`setJammed(hubId, jammed)` on state updates; it triggers a heavy impact
only on entering jam state. Call `reset()` when leaving a game session.
Both are no-ops on web or when disabled by the player. No haptic state
belongs in `src/sim`.

## Verification

`npm run test:cvd` checks the six destination colours with Machado (2009)
full-severity matrices and minimum pairwise ΔE76 ≥ 15 under all three CVD
types; `npm run test:contrast` checks all text/background token pairs at
≥ 4.5:1. Both also check CSS-token parity. These static tests do not
replace automated screen-reader, hardware vibration or visual HUD tests.
