# airway.games — static landing page

> Task 29. No production deployment is authorized by this change.

## Source and build

The standalone, framework-free site lives in `site/`. It is deliberately separate
from the Capacitor game and does not import `src/` or require a backend. All assets
are local: approved Diorama concept mockups, hand-drawn SVG, a procedural Canvas 2D
globe and the project's existing SIL OFL font binaries and license notices. There
are no scripts, trackers, external resources, forms or runtime requests to third
parties.

```sh
npm ci
npm run test:site
npm run build:site
python3 -m http.server 4173 --directory site/dist
# Open http://localhost:4173/?lang=pl or ?lang=en
```

`site/dist/` is a generated directory and is excluded by `.gitignore` (the
existing `dist/` rule). Do not commit it. Production hosts publish the **contents**
of `site/dist`, not the repository root. The relative URLs allow root-path and
subpath previews. Always serve through HTTP for ES modules; do not open the HTML
with a `file:` URL.

The site supports PL and EN via `?lang=pl` and `?lang=en`; an absent parameter
uses the visitor's browser language, then English. The switch stores no cookies
or localStorage values. PL/EN copy lives in `site/i18n.js`, independent of the
game's `src/i18n` catalog.

## Verification

```sh
npm run test:site       # local paths, alt texts, translated keys, privacy links
npm run build:site      # copy the static site into site/dist
npm run shots:site      # Playwright must be available in the environment
npm run typecheck
npm run test:fast
npm run build            # game build; does NOT deploy the site
```

`npm run shots:site` renders `site/dist/index.html` at 412x915 and 915x412 at DPR
1, writing `docs/shots/29/site-p.png` and `site-l.png`. Review both images for
typography, visible globe, horizontal overflow and forbidden "template UI".
Also check 673x841, 904x1000, English copy, keyboard navigation, reduced motion
and Canvas fallback manually. Without Playwright, the screenshot task reports a
nonzero exit code instead of claiming to have captured images.

The globe uses a Canvas 2D texture with an orthographic spherical projection and
seeded, reproducible geography. It keeps rendering when WebGL is disabled. If
Canvas 2D is unavailable or JavaScript is disabled, `globe-fallback.svg` remains
visible. On browsers that prefer reduced motion, the globe is stationary but
can be turned manually. When off screen or in a background tab, its animation
pauses. Device pixel ratio is capped at 2.

## Deployment options (not executed)

- **Cloudflare Pages:** connect this repository, set build command
  `npm run build:site` and build output `site/dist`; no environment variables.
  Make the custom domain `airway.games` only after owner approval.
- **GitHub Pages:** use a Pages GitHub Actions workflow that checks out the
  approved branch, runs `npm ci && npm run build:site`, uploads `site/dist/`
  with `actions/upload-pages-artifact` and deploys with `actions/deploy-pages`.
  Ordinary "Deploy from a branch" cannot serve a `site/dist/` folder unless it
  is copied to an allowed Pages publishing location first. Do **not** add or
  trigger that workflow in this task.
- **Any static host:** upload exactly the contents of `site/dist/`. Serve HTML
  as `text/html`, JS as JavaScript, SVG as `image/svg+xml`, TTF as `font/ttf`.
  Use HTTPS and a conservative Content-Security-Policy: `default-src 'self';
  script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self';
  connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'`.
  Confirm compatibility with the host's CSP and caching behavior before launch.

## Assets and content approval

- The three vertical concept captures are copied **from this repository's own**
  `mockups/diorama/png/{game-p,upgrade-p,menu-p}.png`. They are illustrative
  concepts, *not* screenshots of a shipped game. Do not use them in an app store
  without separately checking store rules and whether the shipped UI matches.
- The website reuses `public/fonts/` copies of **Overpass**, **Overpass Mono**
  and **Atkinson Hyperlegible Next**. All have SIL OFL licenses copied alongside
  them in `site/fonts/`; see `docs/ASSETS.md`.
- Confirm `contact@airway.games` exists and receives mail; until then it is a
  **proposed placeholder**.
- The page calls the release "coming soon" without giving dates or pre-order
  links; no store availability has been asserted.
- The privacy document is explicitly a **draft**. Before publishing, confirm
  the data controller's legal identity and address, app telemetry / SDKs,
  offline behavior, retention of support messages and host request logs, cross-
  border data transfers, platform-specific services and any legal age requirements.
  The statement "no data collected" must **not** be presented as a confirmed
  fact until Android, iOS, hosting and email flows have been audited.
- The source has no analytics/cookies, but hosting logs and email delivery may
  still process personal data. Update the policy before enabling the public site.

## Scope

This task adds no gameplay logic, Android/iOS changes, cookies, mailing list,
backend, analytics, CI deployment or store listings. The menu task (14) is not
present in `dev`, so the landing page uses approved Stage 0 Diorama mockups
rather than integrating with unmerged production screens.
