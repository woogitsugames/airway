# Accessibility evidence — App Store accessibility labels (R1i)

Evidence sheet for the App Store Connect accessibility labels (shown on the product page from iOS 26). Apple asks to
declare a feature only when **every common task** of the app can be completed with it, and App Review may ask for a
correction (`docs/RESEARCH.md`, R1 — accessibility). Google Play has no equivalent form; the store paragraph at the
end goes into both listings. `npm run test:a11y-evidence` keeps this sheet in sync with the code: the tests it names
exist, the glyph table matches `src/data/regions.ts`, the text-size steps and the colour-vision mode match the
settings, and a label is never marked "Yes" while its blocker is open.

## Common tasks
1. Start a run from the menu (Endless, puzzles, the daily challenge) and resume a saved run.
2. Draw, extend, shorten and remove a route between airports on the globe.
3. Put aircraft on a route and take them off (turboprop / widebody from the tag dock).
4. Read who waits at an airport (destination region per passenger, transfers still making their connection).
5. See trouble coming: a hub filling up, a jam countdown, an airport closed by the night curfew, a slot hold.
6. Pick one weekly upgrade crate (and the airport for a hub expansion or "+2 slots").
7. Read the game-over report (cause, tip) and share the daily result.
8. Change settings (language, text size, colour-vision mode, reduce motion, sound, haptics) and read help.

## Labels

<!-- a11y:labels -->
| Label | Declare | Evidence |
|---|---|---|
| Differentiate Without Color Alone | Yes | `test:cvd`, `test:e2e:transfer-glyphs`, `test:e2e:curfew-barrier`, `test:e2e:tutorial`, `test:a11y-evidence` |
| Sufficient Contrast | Not yet | `test:contrast`, `test:e2e:dock-empty-tags`, `test:render-layers` |
| Reduced Motion | Yes | `test:motion`, `test:e2e:reduce-motion` |
| Larger Text | No | `test:a11y-evidence` |
| VoiceOver | No | — |
| Voice Control | No | — |
| Dark Interface | No | — |
| Captions | No | — |
| Audio Descriptions | No | — |
<!-- /a11y:labels -->

### Differentiate Without Color Alone — declare
Every piece of gameplay information that has a colour also has a shape, a mark or text:

- **Destinations (tasks 4, 5):** each region is its own silhouette on the luggage tags; colour only repeats it
  (D-08, D-31). The legend is in Settings → Help ("Passenger glyphs", `test:e2e:tutorial`, 8 rows).

<!-- a11y:glyphs -->
| Region | Glyph |
|---|---|
| `NAM` | `fin` |
| `SAM` | `bracket` |
| `EUN` | `chevron` |
| `EUS` | `crescent` |
| `AFR` | `keyhole` |
| `ME` | `bowtie` |
| `ASI` | `wing` |
| `OCE` | `hook` |
<!-- /a11y:glyphs -->

- **Colour-vision mode** (Settings → Display, `settings.colorblind`): destination symbols grow from `16px` to `21px`
  with a `3px` outline instead of `1.5px` (`data-airway-cvd="enhanced"`).
- **Transfers (task 4):** a passenger still making the connection is the same glyph drawn hollow
  (`test:e2e:transfer-glyphs`, `docs/shots/n10i/`).
- **Curfew (task 5):** a closed airport gets a boom-barrier stub on its tag and a striped bar on its edge chip
  (`test:e2e:curfew-barrier`, `docs/shots/n10g/`).
- **Jam (task 5, 7):** the jam is a countdown number on the airport plate and the game-over report names the cause
  in words; the red is secondary.
- **Aircraft (task 3):** turboprop and widebody are different silhouettes on the dock tags (`src/ui/hud/icons.ts`);
  hubs carry a tower on the airport object (D-178).
- **Airline colour** (D-80) is cosmetic and carries no information.
- The destination colours themselves are checked for colour-vision deficiency (`test:cvd`, Machado 2009, ΔE ≥ 15)
  for the six original regions: `NAM`, `SAM`, `EUN`, `EUS`, `AFR`, `ME`. `ASI` and `OCE` colours are provisional and
  not in that check; their shapes are distinct, which is what the label needs.

### Sufficient Contrast — not yet
UI text passes WCAG AA: every declared text/background token pair is ≥ 4.5:1 (`test:contrast`, 17 pairs), empty dock
tags keep their ink ≥ 4.5:1 (`test:e2e:dock-empty-tags`). The blocker is the globe: after D-178 the probe
(`measureLayerContrast`, D-177) still measures airports 2.6–3.2:1, planes 1.4–3.0:1 and the Mapa luggage tags 1.6:1
against the terrain (backlog **G9b**, owned by the globe session). Declare this label once G9b is ticked and the
store screenshots are re-measured. The game has no "increase contrast" setting of its own.

### Reduced Motion — declare
Settings → Display → "Reduce motion" (D-88) starts at the system setting and then follows the player's choice. One
helper (`reducedMotion()` in `src/ui/motion.ts`) stills the menu globe, cuts the camera instead of panning, changes
the split-flap boards at once and switches off every CSS animation and transition (stamp-ins, NEW stub, jam pulse,
upgrade slip, tutorial guide). Planes keep flying and the globe still follows the finger: that is the game state and
direct manipulation, not decoration. `test:motion` (no other module reads the media query),
`test:e2e:reduce-motion` (`docs/shots/n11g/`).

### Not declared, and why
- **Larger Text:** Apple needs at least 200% (or the system maximum). The game offers its own text size,
  `100/115/130/150` %, starting on first launch from the system text size (Android font scale, iOS Dynamic Type;
  R1g, N11ap); 150% is still short of 200%. The in-world HUD, luggage tags and split-flap boards keep fixed sizes.
- **VoiceOver / Voice Control:** settings and menus have labels, but drawing a route is a drag on the 3D globe with
  no alternative input; tasks 2, 3 and 6 cannot be completed with a screen reader or voice commands.
- **Dark Interface:** the world has night, but the UI (paper, kraft labels, boarding pass) has no dark appearance
  and does not follow the system setting.
- **Captions / Audio Descriptions:** the game has no speech or video; sound is effects and music only, and no
  information is given by sound alone. The labels do not apply.

## Store paragraph (both stores, appended to the full description)

<!-- a11y:store-en -->
Accessibility: every destination is a shape, not just a colour, and a colour-vision mode makes the symbols larger with thicker outlines. Interface text meets WCAG AA contrast. "Reduce motion" follows your system and stills the menu globe, camera pans and board animations. Text size follows your system and goes up to 150%, and haptics can be switched off.
<!-- /a11y:store-en -->

<!-- a11y:store-pl -->
Dostępność: każdy kierunek to kształt, nie tylko kolor, a tryb dla daltonistów powiększa symbole i pogrubia ich obrys. Tekst interfejsu spełnia kontrast WCAG AA. „Ogranicz ruch” podąża za ustawieniem systemu i zatrzymuje obrót globu w menu, przejazdy kamery i animacje tablic. Rozmiar tekstu podąża za ustawieniem systemu i sięga 150%, wibracje można wyłączyć.
<!-- /a11y:store-pl -->
