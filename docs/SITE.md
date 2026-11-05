# airway.games — static landing page

> Task 29. No production deployment is authorized by this change.

## Source and build

The standalone, framework-free site lives in `site/`. It is deliberately separate
from the Capacitor game and does not import `src/` or require a backend. All assets
are local: real game screenshots (from `docs/store/shots/`), hand-drawn SVG, a procedural Canvas 2D
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
npm run test:site       # local paths, alt texts, translated keys, privacy links, launch pack, press page + ZIP, publisher block, terms page
AIRWAY_RELEASE=1 npm run test:site   # release gate: also fails on "[Q-01 …]" publisher placeholders (D-241)
npm run site:assets     # after store:shots: refresh site/assets/shots/ (Playwright)
npm run build:site      # copy the static site into site/dist (+ og-image.png, airway-press-kit.zip)
npm run shots:site      # builds site/dist first; Playwright must be available
npm run typecheck
npm run test:fast
npm run build            # game build; does NOT deploy the site
```

`npm run shots:site` renders `site/dist/index.html` at 412x915 and 915x412 at DPR
1, writing `docs/shots/29/site-p.png` and `site-l.png`, plus the 404 page
(`site-404-p.png` 412x915, `site-404-l.png` 1280x800), the screenshot/store
section (`site-preview-p.png`, `site-preview-l.png`) and the whole press page (`site-press-p.png` PL 412 wide,
`site-press-l.png` EN 1280 wide). Review every image for
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

- The four phone previews (night globe, live game, weekly upgrade, menu) are **real game screenshots**: 540×960 JPEG
  copies in `site/assets/shots/{pl,en}/` of the store PNGs in `docs/store/shots/<lang>/<scene>-phone.png` (D-218).
  `site.js` swaps in the visitor's language. The stage-0 concept mockups are no longer used anywhere on the site.
- The website reuses `public/fonts/` copies of **Overpass**, **Overpass Mono**
  and **Atkinson Hyperlegible Next**. All have SIL OFL licenses copied alongside
  them in `site/fonts/`; see `docs/ASSETS.md`.
- Confirm `contact@airway.games` exists and receives mail; until then it is a
  **proposed placeholder**.
- The page calls the release "coming soon" without giving dates. The two store tags
  (Google Play, App Store) stay disabled, labelled "link after the store page opens",
  until `site/launch.js` has a URL on the store's own host; see "Launch pack" below.
- [N11am] R7a, D-243: the privacy policy is **draft v1** — 14 sections in the RESEARCH R7 order (controller,
  summary, device, leaderboard, purposes and legal bases, recipients, transfers, retention, rights, age, profiling,
  website, security, changes). Bodies are paragraphs and "• " lists (`data-i18n-paragraphs`). `test:privacy-policy`
  ties the text to `docs/legal/README.md` and `docs/store/privacy-declarations.md`; `AIRWAY_RELEASE=1 npm run
  test:site` fails while bracketed placeholders ("[Q-01 …]", "[to be filled in …]") remain. The red banner stays
  until the owner approves the text after the lawyer.
- The privacy document is explicitly a **draft**. Before publishing, confirm
  the data controller's legal identity and address, app telemetry / SDKs,
  offline behavior, retention of support messages and host request logs, cross-
  border data transfers, platform-specific services and any legal age requirements.
  The statement "no data collected" must **not** be presented as a confirmed
  fact until Android, iOS, hosting and email flows have been audited.
- The source has no analytics/cookies, but hosting logs and email delivery may
  still process personal data. Update the policy before enabling the public site.

## Launch pack (N11ad / R7k, D-218)

- **One config:** `site/launch.js` holds the public origin (`https://airway.games`), the two store links and the
  screenshot list. Store links are empty today. `storeLink()` accepts only `https://play.google.com/…` and
  `https://apps.apple.com/…`; anything else keeps the tag disabled. Filling a link also requires the official badge
  artwork in `site/assets/badges/` (`google-play.svg`, `app-store.svg`, Apple and Google brand rules, entry in
  `docs/ASSETS.md`); `test:site` fails on a link without its badge.
- **Real screenshots:** after every `npm run store:shots`, run `npm run site:assets` (Playwright from the
  environment). It downscales the five phone scenes per language to 540×960 JPEG (each under 250 kB) and records the
  hash of each source PNG in `site/assets/shots/sources.json`; `test:site` fails when a store PNG changed and the copy
  did not follow. [N12bh] The store shots now carry the N11t game-over wording ("SIEĆ ZAMKNIĘTA" / "NETWORK
  CLOSED"). [N12bi] "failure" is the fifth scene of `SITE_SHOTS.scenes`: preview card 05 "RAPORT / REPORT" with
  `preview.failure.*` copy and alt text, on the home page and the press page (phone 05, landscape 10).
- **Social preview:** `og:image` is the Play feature graphic (`docs/store/feature-graphic.png`, D-117), copied by
  `build:site` into `site/dist/assets/og-image.png` (not duplicated in git), with size, alt text and
  `twitter:card=summary_large_image`.
- **Canonical and hreflang:** `index.html` and `privacy.html` name the language-neutral URL as canonical plus
  `hreflang` pl / en / x-default (`?lang=`); with an explicit `?lang=` the page points canonical and `og:url` to itself.
- **404:** `site/404.html` in the site style, `noindex`, root-absolute URLs (hosts serve it at any depth); copied by
  `build:site`. Cloudflare Pages and GitHub Pages pick it up by name.
- **Still open:** no newsletter (Q-70 → A). The publisher block (R7c) and the terms page (R7b) are below.

## Press page (N11ae / R2e, D-219)

- **Page:** `site/press.html` (`?lang=pl|en`, same header, footer, fonts and `site.js` as the rest), linked from the
  home navigation and from every footer. Fact sheet (developer, genre, platforms, release, price, languages, contact,
  website), short and full description, ten screenshots (five scenes × phone and landscape, in the visitor's
  language), logo and icon, video slot, usage note, one ZIP download. No forms, scripts beyond `site.js`, trackers or
  external requests (D-67 still keeps the site unpublished).
- **Copy:** every visible string is in `site/i18n.js` (`press.*`). `press.short` / `press.long` are the Google Play
  short and full description from `docs/store/{pl,en}.md`; `test:site` fails when the store text changes and the page
  does not follow. The EN store text still says "a terminal" twice (D-216 left it unchanged); the page applies the
  D-195 glossary and says "a hub". The price row says what is absent ("no ads and no in-app purchases", D-16) and
  never a price or "free". The developer row says "publisher details to follow" until R7c; the release date is
  "to be announced"; contact is the proposed `contact@airway.games`.
- **ZIP:** `npm run build:site` writes `site/dist/airway-press-kit.zip` (`site/press-kit.mjs`, dependency-free ZIP
  writer, fixed timestamps, so the same sources give the same bytes): `airway-press-kit/README-{pl,en}.txt` (fact sheet,
  descriptions, usage, contents), `screenshots/{pl,en}/airway-<scene>-{phone,landscape}.png` (the full-size store PNGs,
  10 per language), `logo/airway-wordmark.{svg,png}`, `logo/airway-icon.{svg,png}`. About 12.8 MB; never committed.
- **One config:** `PRESS_KIT` in `site/launch.js` (ZIP name, contact, formats, logos, video). The scenes are
  `SITE_SHOTS.scenes`, so page and ZIP list the same five scenes (N12bi added "failure").
- **Thumbnails and logo PNGs:** `npm run site:assets` also writes `site/assets/shots/<lang>/<scene>-landscape.jpg`
  (960×540) and renders `brand/wayfinding.svg` / `resources/icon.svg` to `site/assets/press/airway-wordmark.png`
  (1920×520, with the site's Overpass 800, since the SVG wordmark is live text) and `airway-icon.png` (1024×1024).
  `sources.json` holds their source hashes.
- **Video:** `PRESS_KIT.video` is empty until R2b (`npm run store:video`) produces a file; the page shows
  `press.video.pending`. Once set (path relative to `site/`), switch the paragraph to `press.video.ready`: `test:site`
  then requires the file and its place in the ZIP. A video over 10 MB is git-ignored by R2b, so `build:site` must
  run where the file exists, or the build fails on the missing source.

## Publisher block (N11al / R7c, D-241)

- **One source:** `publisher.*` in `site/i18n.js` (PL/EN): title, legal name, address, register and tax ID, e-mail,
  phone, trader status, a note naming art. 5 of the Polish e-services act. `site/publisher.js` holds the row order
  (`PUBLISHER_FIELDS`) and the guard (`publisherGaps`, `assertPublisherReady`).
- **Where:** the `#publisher` section of `privacy.html` and `terms.html` (fact-sheet rows, since N11an); every footer links to it ("Wydawca" /
  "Publisher"); the game shows the same strings in Settings → Help; `docs/store/README.md` has the same values as a
  table for the App Store / Play Console trader fields. `test:publisher` keeps game and store table word for word.
- **Placeholders:** until Q-01 the identity rows read "[Q-01: … — to be filled in]". Any "[Q-…" value is a gap.
  `AIRWAY_RELEASE=1 npm run test:site` and `AIRWAY_RELEASE=1 npm run build:site` fail with gaps, and so do
  `npm run android:release` / `android:aab`. To fill: edit the six values in `site/i18n.js`, copy them to
  `src/i18n/{pl,en}.ts` and the table in `docs/store/README.md` (`test:publisher` says what differs).

## Scope

This task adds no gameplay logic, Android/iOS changes, cookies, mailing list,
backend, analytics, CI deployment or store listings. Since N11ad the previews
are real game screenshots (see "Launch pack").
