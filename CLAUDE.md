# CLAUDE.md — Airway (airway.games): airline-network game on a globe

Instructions for AI coding agents working in this repository.

## Current stage: Production (MVP)
- Stage 0 is complete: world style **A "Diorama"** (D-11) and title **Airway** (D-12).
- Task 01 starts production with Vite 6, strict TypeScript, three.js, and Capacitor 8.
  See `docs/ARCHITECTURE.md` and `docs/TESTING.md` for the boundaries and gates.
- Implement only the assigned task from `docs/tasks/00-INDEX.md`; the owner merges draft PRs.


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
- Always branch from `dev` to the assigned `task/NN-...` branch.
- Open a **draft PR to `dev`** after implementation and checks; only the owner merges.
- Never push directly to `dev` or `main`, except task 01 creating `dev` from the approved stage-0 branch.
- Keep commits descriptive in English. PR and owner-facing report must be in Polish.


## Commands
- `npm ci` — install dependencies from the lockfile.
- `npm run dev` — start Vite with the empty Diorama sky canvas.
- `npm run typecheck` — strict TypeScript.
- `npm run test:i18n` — PL/EN catalog parity, empty entries, placeholders.
- `npm run test:arch` — simulation dependency and deterministic-operation boundary.
- `npm run test:fast` — typecheck, i18n and architecture checks.
- `npm run build` — TypeScript check and Vite production build.
- `npm run shots` — game screenshots at 412×915 and 915×412 into `docs/shots/01/`.
- `npm run mockups` — regenerate existing stage-0 mockups.
- `npm run shots:mockups` — preserve reference mockup captures.
- `mockups/fetch-fonts.sh "Family" dir "400;700"` — obtain OFL fonts with licences.

See `docs/TESTING.md` before pushing.
