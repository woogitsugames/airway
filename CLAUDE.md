# CLAUDE.md — Airway Games: airline-network game (working title TBD)

Instructions for AI coding agents working in this repository.

## Current stage: research, concept and visual direction (NOT production)
- This stage ends with the **owner choosing a visual direction** (and later a title). Do **not** write game code
  until the owner has decided (see `docs/DECISIONS.md`).
- Deliverables of this stage: `docs/RESEARCH.md`, `docs/styles/<name>.md` + `mockups/<name>/` (HTML/SVG rendered to PNG
  at 412×915 and 915×412), `docs/DECISIONS.md`, `docs/ASSETS.md`.

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
  subway-map look.
- **No AI slop** in mockups/UI: no purple-blue gradients, glassmorphism, gratuitous neon glow, generic SaaS rounded
  cards with default shadows, emoji icons, single-pack stock icons, Inter/Roboto/system font as the only typeface,
  centred "Welcome!/Get Started", dashboard charts, clipart planes/globes.
- **Not minimal (owner, D-05):** no flat diagram look. The world is rich and illustrated; gameplay info is drawn into it.
- Required: one authorial visual idea where **graphics explain gameplay**; types distinguishable by **shape**, not only
  colour; minimal in-world HUD; touch targets ≥ 48 dp; thumb-reach actions; safe areas; portrait + landscape +
  foldables; short matter-of-fact motion (no bouncy springs).
- Self-check every mockup PNG against the forbidden list before showing it.
- Fonts: SIL OFL only, licence file next to the font, entry in `docs/ASSETS.md`. Images: own or CC0 only, entry in
  `docs/ASSETS.md`. Map data: Natural Earth (public domain) via `world-atlas` (ISC).
- Reference repos of our other games (`commutopia`, `cebulak-express`, `Century-war`, `Frontier`, `AirWar`) are
  **read-only**. Never modify them.
- Decisions that belong to the owner (style, title, scope, business model): ask briefly, give a recommendation.
  Record every decision as D-xx in `docs/DECISIONS.md` with rationale.

## Git
- Work on the designated feature branch, never on `main`. Small descriptive commits. No PR until the owner asks.

## Commands
- `npm ci` — install dev dependencies (mockup tooling only).
- `npm run mockups` — build every `mockups/<name>/` page (static HTML with inline SVG, generated in Node).
- `npm run shots` — render all mockups with Playwright to `mockups/<name>/png/*.png` (412×915 and 915×412, DPR 2).
  `node mockups/shoot.mjs <name>` renders one direction. Pages are served over a local HTTP server (ES modules); pages that set
  `window.__ready` (three.js) render with SwiftShader WebGL. Inspect every PNG yourself afterwards.
- `DPR=1 node mockups/shoot.mjs overview` — side-by-side contact sheets in `mockups/overview/png/`.
- `mockups/fetch-fonts.sh "Family" dir "400;700"` — fetch an OFL font + licence; then add it to `docs/ASSETS.md`.
