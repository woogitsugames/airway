# Release checklist — Google Play and App Store

One list for the first store release (RESEARCH "R1 — Gotowość do wydania", backlog R1l). Every line names who does
it and links the decision (`D-`) or open owner question (`Q-`) behind it; `test:release-checklist` fails when a
reference does not exist, a line has no owner or no reference, or the version numbers of the native projects
disagree. Tick a line only when it is true for the build that goes to the store.

- **Who:** `owner` = consoles, accounts, money, legal, real devices; `agent` = code, docs and generated assets in
  this repo; `owner + agent` = the agent prepares, the owner files it.
- **State** (2026-11-04): `done` = in the repo or decided and nothing left before release; `ready` = prepared, the
  owner still has to file or confirm it; `open` = work or a decision is missing.
- Order: blocks A → B → C. A is needed before the closed test, B before pre-registration / pre-order, C for each
  store build. Dates follow the launch plan (D-96, D-238: `docs/LAUNCH.md` — timeline in weeks from launch day T, showcases, store-event texts).

## A — Accounts and back end (before the closed test)

| ID | Item | Who | State | Refs | Where / how |
|---|---|---|---|---|---|
| RL-01 | Google Play **organisation** account: D-U-N-S number, Play Console registration, developer verification | owner | open | D-94, Q-01 | Company data from Q-01; the organisation account is exempt from the 12 × 14 rule |
| RL-02 | Apple Developer Program account (organisation), App Store Connect record for `pl.samsufi.airway` | owner | open | D-96, Q-52 | `docs/IOS.md` (signing certificate + App Store profile); TestFlight in the closed test only if ready (Q-52 B) |
| RL-03 | Firebase project, Blaze plan, 10 EUR budget with 50/90/100 % actual + 100 % forecast alerts | owner | open | Q-07, D-66, D-109, D-234 | `docs/FIREBASE.md` steps 1–8 (step 1 includes accepting the Firebase Data Processing and Security Terms, date in `docs/legal/README.md` §2); the release build gets `.env.production` |
| RL-04 | App Check for the callables (Play Integrity / App Attest) | owner + agent | ready | Q-53, D-246 | Server param `APP_CHECK_ENFORCED` (default off) and the client header are in the repo; owner registers the apps, adds the Firebase config files, the plugin is installed, then enforcement after observing (`docs/FIREBASE.md` "App Check"); optional for the first release, recommended before featuring |
| RL-05 | Trademark check "Airway" (EUIPO / USPTO / UPRP, classes 9 and 41) | owner | open | Q-34 | RESEARCH §7 and R1 "Nazwa"; before pre-registration |
| RL-06 | Release signing: Android upload keystore outside the repo + Play App Signing; iOS distribution certificate | owner | open | D-94, D-98 | `docs/ANDROID.md` (release scripts refuse keys inside the repo), `docs/IOS.md` |

## B — Store listing and declarations (before pre-registration / pre-order)

| ID | Item | Who | State | Refs | Where / how |
|---|---|---|---|---|---|
| RL-10 | Closed test, 14 days, 16–18 testers (also the playtest) | owner + agent | ready | D-94, D-227, D-231, D-232, Q-52 | `docs/PLAYTEST.md`: recruitment, day plan, `AW1:` record, decision table, production-access answers |
| RL-11 | Privacy policy online (URL in both consoles) and the same text in the game | owner + agent | open | Q-01, Q-56, D-86, D-135, D-136 | `site/privacy.html` + `docs/legal/leaderboards-privacy.md`; data controller and the leaderboard section need the owner and a lawyer (Cloud Run request logs); record of processing: `docs/legal/README.md` §1 |
| RL-12 | Site `airway.games` published, store links set when the store pages exist | owner + agent | ready | D-67, D-218 | `site/launch.js` (origin + two store links), `npm run build:site`, `docs/SITE.md` |
| RL-13 | Press page and press kit ZIP; contact address confirmed | owner + agent | ready | D-219 | `site/press.html`; confirm `contact@airway.games`; video slot waits for RL-25 |
| RL-14 | Terms of use (site + one line in the game), Apple standard EULA | owner + agent | open | D-134 | Backlog R7b; reviewed by the lawyer with the privacy policy |
| RL-15 | DSA **trader** status in Play Console and App Store Connect (address, phone, e-mail) | owner | open | D-134, D-94, Q-01 | Business details from Q-01, never private ones; deadlines (Google at account creation / existing accounts by 1 Feb 2027, shown from 1 Mar 2027; Apple before the EU submission) and filing dates in `docs/legal/README.md` §3 |
| RL-16 | Play **Data safety** form | owner + agent | ready | D-220, D-224 | `docs/store/privacy-declarations.md` (build A: nothing; build B: Device or other IDs + Other actions/Gameplay content) |
| RL-17 | Account deletion: in-app path + web resource for the Data safety form | agent | done | D-93, D-114, D-77 | Settings → Help → "Delete my ranking data"; e-mail path in `docs/FIREBASE.md` step 9 |
| RL-18 | App Store **App Privacy** answers and `PrivacyInfo.xcprivacy` | owner + agent | ready | D-220 | Same sheet as RL-16; `test:privacy-declarations` keeps the manifest equal to the answers |
| RL-19 | Age rating: IARC questionnaire (Play) and Apple age questions (4+/9+/13+/16+/18+) | owner + agent | ready | D-235, Q-05 | Answers in D-235: no violence, chat, user content, purchases, ads or location; call signs only (Q-05) → expected PEGI 3 / USK 0 / Apple 4+ |
| RL-20 | Play **Target audience**: 13 and older (outside the Families policy) | owner | ready | D-235 | Play Console → App content → Target audience and content |
| RL-21 | Export compliance (Apple encryption question) | agent | done | D-91 | `ITSAppUsesNonExemptEncryption = false` in `Info.plist`; any own cryptography reopens it |
| RL-22 | App Store **accessibility labels**: Differentiate Without Color Alone, Reduced Motion; not Sufficient Contrast | owner + agent | ready | D-225, D-88 | `docs/store/accessibility.md` (evidence per label, `test:a11y-evidence`); Sufficient Contrast after G9b |
| RL-23 | Store texts PL/EN: title, subtitle/short description, full description, keywords, Play alt texts | owner + agent | ready | D-18, D-203, D-216, D-223, D-229 | `docs/store/pl.md`, `docs/store/en.md` (byte limits in `test:store-shots`) |
| RL-24 | Store screenshots per device class: iPhone 6.9" 1320×2868, iPad 13" 2064×2752, Play phone 9:16, 16:9 landscape, tablet, foldable | agent | open | D-123, D-63, Q-46, Q-47 | `npm run store:shots` → `docs/store/shots/` + `docs/store/README.md` (console slots); regenerate with the current game-over wording (times out under SwiftShader until G7 is fixed) |
| RL-25 | Store video (App Store preview file, Play YouTube link) | owner + agent | open | Q-49 | Backlog R2b; the owner uploads to YouTube |
| RL-26 | Play feature graphic 1024×500 | agent | done | D-117 | `docs/store/feature-graphic.png` |
| RL-27 | Distribution: worldwide except mainland China (both consoles) | owner | ready | D-96 | Q-44 → A |
| RL-28 | Wave-1 store listings DE, FR, ES, PT-BR (stating the game is in English and Polish) | owner + agent | ready | D-230, D-96 | `docs/store/{de,fr,es,pt-br}.md`; each needs a native review before it is published |
| RL-29 | Legal register: GDPR art. 30 record, UK art. 27 representative answer, US state app-store age laws re-checked before the US launch, one lawyer consultation | owner + agent | ready | D-239, D-136, Q-67, Q-01 | `docs/legal/README.md` (§1 record, §4 UK, §5 US, §7 questions for the lawyer); the data controller stays a Q-01 placeholder |

## C — Each store build

| ID | Item | Who | State | Refs | Where / how |
|---|---|---|---|---|---|
| RL-30 | Version bump in **both** native projects from `package.json` | agent | ready | D-235 | `package.json` `version` = Android `versionName` = iOS `MARKETING_VERSION`; Android `versionCode` +1 per upload; iOS build number by `fastlane ios beta` (`IOS_BUILD_NUMBER`); `test:release-checklist` checks the three names agree |
| RL-31 | Play target API ≥ 36, minSdk 29, OpenGL ES 3.0 filter, 16 KB native alignment | agent | done | D-98, D-133, D-124 | `test:android-config`, `test:native-align`; `npm run android:aab` checks the bundle; raise the floor each August |
| RL-32 | Xcode 26 / iOS 26 SDK, languages in `CFBundleLocalizations` | agent | done | D-91 | `docs/IOS.md`, `test:ios-config` |
| RL-33 | Release build without DEV content: puzzles 01–30 only, no DEV adapters | agent | done | D-193, D-131 | `test:release-packs`; "Long haul" opens at T+4 |
| RL-34 | Backup carries the save to a new phone, not the leaderboard identity | agent | done | D-92 | Android backup rules, iOS default; Q-55 open for the wording |
| RL-35 | `npm run test:ci` green on the release commit, then a real-device pass (budget Android, iPhone, tablet) | owner + agent | open | D-232, Q-52 | `docs/TESTING.md`; device list in RESEARCH R3 |
