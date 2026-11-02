# Monetization boundary (task 27, D-16)

## Shipping contract: everything free

The current Airway build is **fully free**. It has **no advertising, in-app purchases,
subscriptions, paywalls, trial timers, analytics, purchase identifiers, or monetization SDKs**.
No content is locked, including Endless, Puzzles, and the Daily Challenge. The current
code neither offers a purchase action to players nor displays an advertisement. This is
an explicit owner decision (D-16), not a temporary promotional period.

The platform adapters are deliberately inert:

- `src/platform/store.ts`: `Entitlements` (`isUnlocked`, `purchase`, `restore`).
  `freeEntitlements.isUnlocked()` always returns `true`; `purchase()` returns
  `already-unlocked` without charging; `restore()` returns `not-required`.
- `src/platform/ads.ts`: `AdService` (`isEnabled`, optional `showRewarded` and
  `showInterstitialBetweenRuns`). `disabledAds.isEnabled()` is always `false`;
  both show methods return `false` without loading or displaying an ad.
- `src/game/gating.ts`: `canAccessContent(contentId, entitlements, config)` is the
  configuration-driven content check. **`GATING_ENABLED = false`** overrides even
  deliberately restrictive maps and hypothetical locked entitlements. The default
  configuration contains no gated content IDs.

These modules are not wired to a purchase screen, game menu, or native plugin.
The game modes in tasks 14 and 17 are not yet merged into `dev`; their future
navigation can call `canAccessContent` without altering the simulation. Do not
introduce monetization decisions or network calls inside `src/sim`.

## Future rules (not authorization to enable anything)

1. Never show a full-screen advertisement during a run. Do not interrupt active
   play, a drawing gesture, an upgrade choice, an overload countdown, or a puzzle.
2. No ad timers, forced waiting, deceptive close buttons, misleading purchase
   prompts, artificial scarcity, or other dark patterns.
3. An optional rewarded ad could be offered **only after a separate player action**,
   with the benefit and alternative clearly explained. Never make a reward ad a
   requirement to continue or complete a run.
4. If the owner approves interstitial ads at all, **between completed runs** is the
   least disruptive candidate. A post-run result/summary must remain readable and
   actionable without watching an ad; do not promise or implement any placement yet.
5. Never use ads in the tutorial or paywall a mode/puzzle without explicit product
   approval, a visible and localized explanation, and an accessible alternative.
6. Avoid profiling and ad identifiers. Any future analytics, personalized ads,
   tracking, consent flows, data transfers, store metadata, and privacy notices
   require independent legal and product review *before* integration.

## Future in-app purchase adapter (design sketch only)

Do not add an SDK now. If the owner approves monetization later, add an adapter
behind `Entitlements` outside the simulation. It should cache verified access for
synchronous `isUnlocked`, handle offline launches, cancellation, pending transactions,
refunds and restored purchases, and verify store transactions before granting access.
Do not use a client-only boolean or local storage as proof of purchase. Review the
transition for existing free players and saves **before** changing the gate flag.

Two possible native Capacitor IAP integrations, **not selected or installed**:

| Option | License | Integration and privacy trade-off |
| --- | --- | --- |
| [`@revenuecat/purchases-capacitor`](https://github.com/RevenueCat/purchases-capacitor) | MIT (SDK); RevenueCat service has separate terms/pricing | StoreKit/Google Play Billing wrapped with receipt validation and entitlement service. Adds a third-party processor and potential data transfer. |
| [`@capgo/native-purchases`](https://github.com/Cap-go/capacitor-native-purchases) | MPL-2.0 | Direct native purchase APIs for Capacitor 8; requires an independently verified, secure entitlement/receipt architecture. Review MPL obligations before distribution. |

The owner must choose whether to monetize, the product scope, purchase model,
providers, jurisdictions, and associated privacy obligations. No purchase SKU,
price, ad placement, or SDK is decided by task 27.

## Privacy-policy input for task 29

> The current version of Airway does not collect personal data, show ads, run
> analytics, or offer in-app purchases. It contains no advertising or purchase SDKs.

This statement describes the current product and must be re-verified against the
actual release build, local save/settings behavior, hosting and store disclosures
before it is published. Any later purchase/ad/analytics integration requires a
revised privacy statement and applicable legal notices and consent handling.
