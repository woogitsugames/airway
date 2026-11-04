# Privacy declarations — Google Play Data safety and App Store App Privacy (R1f, D-220)

Ready-to-paste answers for both store questionnaires, derived from what the code actually sends. Two builds exist
(D-66): **(A)** without a Firebase web config — the leaderboard layer is off and the app makes no network request of
its own; **(B)** with leaderboards — the official daily run is sent to our Cloud Functions. `npm run
test:privacy-declarations` keeps this file in sync with the code: it records every request the leaderboard layer makes
against a fake network, every field the server writes, and the iOS privacy manifest, and fails if any of them is
missing from the tables below (or listed here but no longer in the code).

**Owner-only matters stay open** (not decided here): **Q-01** data controller (name, address, contact — needed for
the privacy policy URL both stores ask for), **Q-07** Firebase project and budget (build B cannot ship without it),
**Q-03** confirms these answers (agent recommendation below), **Q-56** the leaderboard section of the public privacy
policy. Have the lawyer consult (Q-65/Q-67) read this sheet together with `docs/legal/leaderboards-privacy.md`.

## What the code sends

### Build A (no Firebase config)
`readNetConfig` returns `null` without `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID`, so
`createLeaderboards` returns the disabled facade: no sign-up, no submission, no board read, no deletion call. The only
other `fetch` calls in `src/` load the game's own bundled assets (`BASE_URL` land mask and globe textures). No ad SDK,
no analytics, no purchases (D-16; `src/platform/ads.ts`, `src/platform/store.ts`). Daily-result sharing
(`src/platform/share.ts`) hands plain text to the system share sheet or the clipboard only when the player taps
"Share" — nothing goes to our servers.

### Build B (leaderboards) — outbound requests
Every request is HTTPS `POST` with a JSON body. Endpoint ids are what the test records (Auth path or callable name).

<!-- privacy:endpoints -->
| Endpoint | Host | When | Body fields sent |
|---|---|---|---|
| `accounts:signUp` | `identitytoolkit.googleapis.com` (Firebase Auth) | first official daily run sent (or first board read) on this install | `returnSecureToken` |
| `token` | `securetoken.googleapis.com` (Firebase Auth) | the 1-hour ID token is about to expire | `grant_type`, `refresh_token` |
| `submitDaily` | `<region>-<project>.cloudfunctions.net` | an official daily run ends (or later from the offline queue) | `data.submission.v`, `data.submission.mode`, `data.submission.dateKey`, `data.submission.seed`, `data.submission.rulesVersion`, `data.submission.endTick`, `data.submission.claimedScore`, `data.submission.journal` |
| `getBoards` | `<region>-<project>.cloudfunctions.net` | the game-over report of an official daily run shows the boards | `data.daily`, `data.weekly` |
| `deleteMyData` | `<region>-<project>.cloudfunctions.net` | the player confirms Settings → Help → "Delete my ranking data" (D-114) | `data` (empty object) |
<!-- /privacy:endpoints -->

Request metadata: the Auth URLs carry the app's public Firebase API key as `?key=` (identifies the app, not the
player); the callables carry `Authorization: Bearer <ID token>` of the anonymous account. No name, e-mail, phone,
contact list, location, advertising ID, device ID, IDFV or free text is sent. Nothing is sent while the player has
turned off "Send my daily results" (D-135, D-186), and nothing at all in practice runs, endless or puzzles.

The command journal (`data.submission.journal`) is a list of `[tick, command]` pairs. A command carries only game
fields — the test fails if a command type gains a field that is not in this list:

<!-- privacy:journal -->
`type`, `cityIds`, `aircraft`, `routeId`, `end`, `planeId`, `hubId`, `week`, `upgrade`, `speed`
<!-- /privacy:journal -->

### Build B — what the server keeps (Firestore, server-only, D-66)
The journal is replayed and **not stored**; only the replayed result is written. Every entry has a TTL of 90 days
after its last write (D-77, `RETENTION_DAYS`).

<!-- privacy:stored -->
| Document | Fields written |
|---|---|
| `boards/d-<day>/entries/<uid>` | `callSign`, `score`, `weeks`, `hash`, `at`, `expireAt` |
| `boards/w-<week>/entries/<uid>` | `callSign`, `score`, `days`, `at`, `expireAt` |
| `boards/<board>/meta/top` | `entries` (top 50 rows: `uid`, `callSign`, `score`), `expireAt` |
<!-- /privacy:stored -->

Firebase Authentication keeps the anonymous account (random `uid`, creation and last sign-in time) until the player
deletes it in the app (`deleteMyData` removes the entries and the account). The call sign (`AW-7F3A`) is derived from
the uid and shown on the public boards next to the score.

## Google Play — Data safety form

| Question | (A) no Firebase | (B) leaderboards |
|---|---|---|
| Does your app collect or share any of the required user data types? | **No** | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | — | **Yes** (HTTPS only; plain HTTP is the local emulator in dev builds) |
| Which of the following methods of account creation does your app support? | — | none the player sees; the anonymous Firebase account is created automatically (if the form insists on a choice: "OAuth/other") |
| Do you provide a way for users to request that their data is deleted? | — | **Yes** — in the app (Settings → Help → "Delete my ranking data", D-114) and by e-mail (D-77); the web deletion URL waits for the published privacy page (Q-01, Q-56) |

Data types for **(B)** (everything else: not collected):

<!-- privacy:play -->
| Category → type | Collected | Shared | Processed ephemerally | Required or optional | Purposes |
|---|---|---|---|---|---|
| Device or other IDs | Yes — anonymous Firebase Auth uid (and the call sign derived from it) | No | No | Optional (switch "Send my daily results", D-135) | App functionality; Fraud prevention, security, and compliance |
| App activity → Other actions | Yes — official daily run: date, score, rules version, command journal | No | No | Optional (same switch) | App functionality; Fraud prevention, security, and compliance |
<!-- /privacy:play -->

Notes: "Shared" is No — Google Firebase is our processor (service provider), which Play does not count as sharing.
We recommend **Device or other IDs** rather than **User IDs**: Play defines User IDs as identifiers of an identifiable
person (account name, e-mail); the anonymous uid identifies an app install and is listed by Google next to the
Firebase installation ID. If the owner prefers the wording of Q-03 option A ("User ID"), tick **User IDs** instead
with the same answers — never both.

## App Store — App Privacy (App Store Connect)

- **(A):** "Data Not Collected".
- **(B):** "Yes, we collect data", then:

<!-- privacy:apple -->
| Data type | Linked to the user | Used for tracking | Purposes |
|---|---|---|---|
| Identifiers → User ID | Yes | No | App Functionality |
| User Content → Gameplay Content | Yes | No | App Functionality |
<!-- /privacy:apple -->

Apple's "App Functionality" explicitly covers fraud prevention, so no second purpose is needed. "Linked" is Yes
because both are stored under the uid of the anonymous account. No tracking (no data combined with third-party data,
no data brokers, `NSPrivacyTracking` false). The App Privacy label belongs to the app record, not a build: switch it
from "Data Not Collected" to the (B) answers **before** submitting the first build with leaderboards.

### `PrivacyInfo.xcprivacy`
`ios/App/App/PrivacyInfo.xcprivacy` declares the (B) data types above in `NSPrivacyCollectedDataTypes`
(`NSPrivacyCollectedDataTypeUserID`, `NSPrivacyCollectedDataTypeGameplayContent`, linked, not tracking, purpose
`NSPrivacyCollectedDataTypePurposeAppFunctionality`). The manifest is one static file for both builds (D-220): a build
without Firebase then declares more than it collects, which is harmless, while the opposite would be a wrong
declaration. `test:ios-config` and `test:privacy-declarations` check it.

## Open points (not decided here)
1. **Q-01** — data controller; both stores need the privacy policy URL and Play the deletion web resource.
2. **Q-07** — the Firebase project (region `europe-west1` by default) must exist before build B is uploaded.
3. **Q-03** — owner confirms the recommendation above (Device or other IDs vs User IDs on Play).
4. **Server request logs** — Cloud Functions (2nd gen, Cloud Run) request logs in our Google Cloud project record the
   caller's IP address and user agent by default. We do not read or use them, but whether they must be declared
   (or the logs shortened/excluded when the project is created, Q-07) is a question for the lawyer consult.
5. Public call sign on the boards: other players see `AW-xxxx` and the score; ask the lawyer whether this needs a
   line in the privacy policy beyond `docs/legal/leaderboards-privacy.md` (it is not "sharing" in either store's sense).
