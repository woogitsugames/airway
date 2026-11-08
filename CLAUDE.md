# CLAUDE.md — Airway (airway.games): airline-network game on a globe

Instructions for AI coding agents working in this repository.

## Current stage: Production — MVP polish (after integration)
- Stage 0 chose the title **Airway** (D-12); its world style "Diorama" (D-11) and the later Róża and Linoryt looks
  (D-257, D-283) are superseded.
- **Visual direction (D-323, owner, 8.11):** a realistic lit globe from NASA Blue Marble (day) and Black Marble
  (night), day and night as game state (terminator from the game clock, default presentation the K2 night), with our
  own map language on it, and UI-A "Lotniskowa tablica i paski lotu" (split-flap board, ICAO/IATA signs, hub flight
  strips, teleprinter report; Archivo + Chivo Mono). Linoryt is still what ships until the flip; follow the stages of
  `docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md` (render = ext session `src/render/**`, UI = agents `src/ui/**`).
- Tasks 01–36 (`docs/tasks/00-INDEX.md`) are merged and integrated on `dev` (PR #30, #33–#37). Decisions are in
  `docs/DECISIONS.md` (renumbering of the first merge: `docs/integration/RENUMBERING.md`).
- Read `docs/ARCHITECTURE.md` (module map, Sim API, Render API) and `docs/TESTING.md` (every command, runtime, summary).

## The game in one line
Premium mobile (Android + iOS, Capacitor) minimalist network builder about **airlines on a globe**: the player designs
the route network, planes fly by themselves; passengers transfer at hubs; you lose when a hub jams. Not ATC.

## Language
- Talk to the owner in **Polish**. Code, comments, commit messages and technical docs in **English**; owner-facing
  deliverables (`docs/RESEARCH.md`, `docs/styles/*.md`) in Polish.
- Every player-facing string goes through i18n (PL + EN). Never hardcode player text.

## Hard rules
- No copies of Mini Metro, Mini Airways, Fly Corp or any other game: no code, art, names or UI. Mechanics and general
  art movements may inspire us.
- Forbidden: the "Mini" prefix; coloured lines on a flat pastel background; circle/square/triangle passengers;
  subway-map look. Allowed (D-323): routes over the realistic, lit and relief-shaded globe, drawn as cased lines.
- **No AI slop** in mockups/UI: no purple-blue gradients, glassmorphism, gratuitous neon glow, generic SaaS rounded
  cards with default shadows, emoji icons, single-pack stock icons, Inter/Roboto/system font as the only typeface,
  centred "Welcome!/Get Started", dashboard charts, clipart planes/globes, a bare satellite photo with none of our own
  labels, routes and signage on it, a generic dark "navigation app" dashboard.
- **Not minimal (owner, D-05):** no flat diagram look. The world is rich (since D-323 a realistic lit globe);
  gameplay info is drawn into it.
- Required: one authorial visual idea where **graphics explain gameplay**; types distinguishable by **shape**, not only
  colour; minimal in-world HUD; touch targets ≥ 48 dp; thumb-reach actions; safe areas; portrait + landscape +
  foldables; short matter-of-fact motion (no bouncy springs).
- Self-check every mockup PNG against the forbidden list before showing it.
- Fonts: SIL OFL only, licence file next to the font, entry in `docs/ASSETS.md`. Images: own, CC0 or public domain
  only, entry in `docs/ASSETS.md`. Public domain covers NASA imagery (Blue Marble NG, Black Marble; US Government
  work, credit "NASA Earth Observatory"; never NASA logos/insignia) and NOAA ETOPO5. Map data: Natural Earth (public
  domain) via `world-atlas` (ISC). Never tiles or screenshots of Google Earth/Maps, Apple Maps, Mapbox, Cesium Ion or
  Flightradar24 (look references only).
- Reference repos of our other games (`commutopia`, `cebulak-express`, `Century-war`, `Frontier`, `AirWar`) are
  **read-only**. Never modify them.
- Decisions that belong to the owner (style, title, scope, business model): ask briefly, give a recommendation.
  Record every decision as D-xx in `docs/DECISIONS.md` with rationale.

## Git
- `main` is the default branch and follows green `dev` (D-64); only the coordinator fast-forwards it.
- Work on your assigned branch (`task/NN-...` or `integration/<area>`); never push directly to `dev` or `main`.
- Open a **draft PR to `dev`** after implementation and checks; only the owner merges.
- Keep commits descriptive in English. PR and owner-facing report must be in Polish.

## Commands
- `npm ci` — install dependencies from the lockfile. Playwright 1.63 + Chromium come from the environment
  (`npm install --no-save playwright@1.63.0`), never from `package.json`.
- `npm run dev` — Vite dev server. `npm run build` — distance/land generators, `tsc`, Vite production build.
- `npm run test:fast` — typecheck + every headless unit test, ending with `test:arch` (~1.5–2 min with 4 parallel jobs, 119 steps); one PASS/FAIL line per
  step and a final `SUMMARY`. Run before every push. Add new fast tests to its step list.
- `npm run test:ci` — `test:fast`, build, HUD/tutorial/E2E smoke, UI matrix, balance, perf scene, all screenshots
  (~1.5–2 h serial on 4 vCPU, 93 steps; `:stub` variants are the fast path).
- `npm run test:<name>` — a single suite (list and expected summaries in `docs/TESTING.md`).
- `npm run test:e2e:smoke` / `npm run ui:matrix` — real-game Playwright journey and the PL/EN × 4-size screen matrix;
  need the DEV-only `window.aw` adapter (`e2e/README.md`). `npm run test:e2e:fixture` self-tests the harness only.
- `npm run shots` — every app/dev-page screenshot into `docs/shots/<task>/`; `npm run shots -- menu globe --fold`
  for a subset (`-- --list` shows targets). `npm run shots:site` (landing page), `npm run store:shots`
  (60 store PNGs, `docs/store/shots/`). Inspect every PNG before committing it.
- `npm run perf:scene` — SwiftShader scene benchmark (`.perf/scene.json`); never compare with devices.
- `npm run build:site` — static landing page into `site/dist/` (`docs/SITE.md`).
- `npm run android` / `android:release` / `android:aab` — native builds (`docs/ANDROID.md`); iOS: `docs/IOS.md`.
- `npm run mockups` / `npm run shots:mockups` — stage-0 reference mockups; `mockups/fetch-fonts.sh "Family" dir
  "400;700"` — obtain OFL fonts with licences (then `docs/ASSETS.md`).
