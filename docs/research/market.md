# Airway Games: airline network game, market and design research

Date: 2026-11-02. Store figures were pulled live today, from the Steam store pages and appdetails API, the iTunes Search/Lookup API (US) and Google Play listings (US/EN). When Steam shows "in your language" the count covers English reviews only and the real total is higher. Anything I could not confirm is marked **UNVERIFIED**. The name checks are informational only and are not legal advice.

---

## 0. TL;DR

1. **The niche is not empty any more.** Two near-direct competitors appeared in 2026:
   - **Tiny Airline** (Inner Core Studios, NL; Steam "Coming soon", PC/Mac/Linux, no mobile mentioned). The player draws routes between more than 400 real airports. Range limits, long-haul permits and the jet stream are in. There is a new upgrade every night, and turboprops, jumbos, supersonics and hubs are named. It also has a Daily Sky and a vintage Weekly Sky. Passengers are shapes, and a crowded airport ends the game. https://store.steampowered.com/app/5337690/Tiny_Airline/ · https://innercorestudios.com/games/tiny-airline/
   - **"Mini Airways" browser game** (miniairways.co). This is not the Erabit title. It has real cities, auto multi-leg transfers through hubs, terminal capacity and a fail state on overcapacity. The Europe demo is free, with a paid unlock for 8 regions. Steam, App Store and Play are "planned". https://miniairways.co/
   - Others are minor: *Airlines: Route Manager Game* (Awaytix, Android, 50+ downloads, ads, transit-map look; https://play.google.com/store/apps/details?id=com.awaytix.game.airlines) and itch prototypes (*UFO Airlines*, *Flightplan*).
   - **No one ships a portrait-first, premium mobile game on a real 3D globe that has a day/night terminator.** That combination is still open, but the window is short. Tiny Airline could port to mobile, and miniairways.co already plans mobile.
2. **Differentiation has to be the globe and time.** That means the terminator demand waves and curfews, great-circle arcs, hubs with visible connection banks, and plane range. Tiny Airline already has range, nightly upgrades and daily modes, so these are not unique any more. The globe with a moving terminator, plus transfer/bank gameplay, is what nobody shows.
3. **Player pain points are consistent** across Mini Metro, Mini Motorways, Mini Airways and Fly Corp: play-until-you-lose with no goal, failures that feel random or unfair, too much micromanagement, thin content, identical vehicles, and opaque mechanics. Fly Corp players explicitly complain about the flat map ("LA to Tokyo over Europe"). Section 3 has the sources.
4. **Business:** free download with a one-time unlock at €3.99–4.99, using Apple's sanctioned "XX-day Trial"/IAP-unlock pattern and Google Play's new Game Trials for paid games. Benchmarks: Mini Airways mobile has 121 iOS ratings and about 1,050 Play ratings / 10K+ downloads at $4.99, which shows how small premium mobile volume is without featuring.
5. **Title shortlist** (cleanest checks): **Hubline**, **Daywing**, **Terminair**, **Duskport**, **Dayturn**.

---

## 1. Competitor facts, verified and updated

### Mini Airways (Erabit / CCC Games)
| Item | Claimed in brief | Verified 2026-11-02 |
|---|---|---|
| Steam release | July 2024 | **30 Jul 2024**. Steam name "Mini Airways - ATC simulator", dev CCC Games + Erabit, publisher Erabit, **$9.99** list. https://store.steampowered.com/app/2289650/ |
| Steam reviews | 92% of ~1.4k | **92% of 1,378** (Very Positive). Recent 30 days: **81% of 22**. Same URL |
| iOS | Jun–Jul 2025, $4.99 | "Mini Airways:Premium", released **18 Jun 2025**, **$4.99**, **121 ratings, 4.61★**, last update 28 Aug 2026 (v1.0.124), seller QI YU SG. PTE. LTD. https://apps.apple.com/app/id6478572512 |
| Android | Jun–Jul 2025, $4.99 | "Mini Airways: Premium" (Erabit Studios), **$4.99**, **~1,050 ratings, 4.53★, 10K+ downloads**, no ads, updated 25 Aug 2026. https://play.google.com/store/apps/details?id=com.mini.airways.paid.gp. The Android release date is **UNVERIFIED** (PocketGamer said "coming soon" at the iOS launch: https://www.pocketgamer.com/mini-airways-premium/out-now-on-ios) |
| Switch | June 2026 | **25 Jun 2026**, up to 4 players online per airport. https://www.nintendo.com/us/store/products/mini-airways-switch/ |
| 2026 roadmap | daily challenge, licence progression, crash replay, multiplayer | Official roadmap (May 2026): Q2 new map, licence system, "daily flight"; Q3 map DLC and "Black Box"; Q4 multiplayer overhaul. https://news.17173.com/content/05102026/015040892.shtml. **Status:** licence system and Harbin map shipped 26 Jun 2026. Paid DLC *Busy Skies* (5 maps; Air Corridor, Stopover Flight and Overflight mechanics) shipped 23 Sep 2026. Black Box (take over saved crisis scenarios, daily scenarios, share with friends) shipped 2 Oct 2026. The multiplayer overhaul (Q4) has **not shipped yet**. A free Barra map arrived 14 May 2026. Source: Steam news API https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=2289650 |

The complaints in the brief are confirmed by the top negative Steam reviews (https://steamcommunity.com/app/2289650/negativereviews/?browsefilter=toprated):
- "constantly giving directions to the planes"
- "play until you lose"
- "All airplanes are the same exact speed, altitude"
- square/peg hitboxes block parallel runways
- "named to bank on the fame of" Mini Metro, "Chinese knockoff of Mini Motorways"
- "lack of personality"

The note about the 2026 roadmap fixing the mobile versions is **UNVERIFIED**. The Steam news covers PC only.

### Fly Corp (KishMish Games)
- **Steam:** 18 May 2023, **$14.99**, **86% of 1,869** (English) reviews. Two paid DLCs: *American Dream* and *Delivery*, each $6.99. https://store.steampowered.com/app/1372530/Fly_Corp/
- **Mobile is F2P with IAP:**
  - Google Play: "Fly Corp: Airline Manager" published by **CASUAL AZUR GAMES**, **5M+ downloads**, **3.08★ from ~52k ratings**. https://play.google.com/store/apps/details?id=world.fly.corp
  - iOS: same name (seller AI GAMES FZ LLC), **4.41★ from 11.3k ratings**. https://apps.apple.com/app/id1595860359
  - Whether there are interstitial ads on mobile is **UNVERIFIED**. My Play scrape did not show a "Contains ads" label.
- **Negative Steam themes** (https://steamcommunity.com/app/1372530/negativereviews/?browsefilter=toprated):
  - "Flat earth makes this game no fun … LA to Tokyo? … over all of Europe"
  - lag at scale
  - "not very much content"
  - no management overview
  - random or unbalanced endgame
  - "Microtransactions!"
  - patches breaking modes
- The brief's "boring after an hour" is close in spirit to "shallow and empty" and "play once or twice through and you've seen it all". **The exact quote is UNVERIFIED.**

### Mini Metro / Mini Motorways (Dinosaur Polo Club)
- **Mini Metro Steam:** 6 Nov 2015, $6.99, **95% of 7,115** English reviews. https://store.steampowered.com/app/287980/
- **Mini Metro iOS:** **$3.99, 31.8k ratings, 4.86★**. https://apps.apple.com/app/id837860959
- **Mini Metro Play:** **74.7k ratings, 1M+ downloads**. The Play price showed $0.99 today; whether that is a sale or the list price is **UNVERIFIED**. https://play.google.com/store/apps/details?id=nz.co.codepoint.minimetro
- **Sales:** "5M+ sold" is **partly verified**. Reports range from 6M (PocketGamer.biz) to over 7M (DPC press release via NZGDA) to "close to 14m" (PC Games Insider). https://www.pocketgamer.biz/how-the-mini-metro-developer-beat-the-odds-to-build-a-premium-mobile-games-studio · https://www.pcgamesinsider.biz/news/67489/mini-metro-has-actually-sold-close-to-14m-copies/
- **Mini Motorways:** "9 million players" is verified. https://nzgda.com/blog/mini-motorways-celebrates-nine-million-players-as-dinosaur-polo-club-launches-new-creative-mode
  - Steam: 20 Jul 2021, $7.99, **96% of 16,136** English reviews. https://store.steampowered.com/app/1127500/
  - On iOS it is **Apple Arcade**. In Jul 2026 DPC launched a free "Mini Motorways Intro" that hands over to the Arcade subscription with progress carried over. That is a free-intro-then-unlock pattern from the genre leader. https://apps.apple.com/app/id6761439853
- **Development history:**
  - The prototype "Mind The Gap" dates from 2013. Early Access came in 2014 and the full release on 9 Nov 2015, after a further year working with artist Jamie Churchman and composer Disasterpeace. https://en.wikipedia.org/wiki/Mini_Metro_(video_game)
  - Disasterpeace's audio work was "around 90 percent coding". https://www.killscreen.com/music-urban-commute-designing-mini-metros-soundtrack/
  - "2.5 years instead of a few months" is consistent with this timeline, but the **exact quote is UNVERIFIED**.
  - Robert Curry: "minimalism was one of the things that made the game hard to make". https://www.indieorama.com/mini-metro-and-robert-curry-the-minimalism-was-one-of-the-things-that-made-the-game-hard-to-make
- **Mini Subway** (Cooking & Publishing) copied the look and UI and was removed from the eShop in Aug 2022. https://www.nintendolife.com/news/2022/08/mini-metro-copycat-game-has-been-removed-from-switch-eshop · https://toucharcade.com/2022/07/15/mini-metro-nintendo-switch-clone/
  - DPC says it assesses clones against its trademark.
  - Steam reviewers from 2023 accuse DPC of "copyright striking similar games made by smaller developers". Which games those were is **UNVERIFIED**, and a claim about All Quiet Roads is a forum rumour only. https://steamcommunity.com/app/287980/negativereviews/
  - **Implication:** DPC enforces its rights and the community is primed to call out clones. Also note Apple guideline 4.1(c): "You cannot use another developer's icon, brand, or product name in your app's icon or name". https://developer.apple.com/app-store/review/guidelines/

---

## 2. Other competitors and adjacent games

### Airline network / route games
| Game | What it is | Platform / price | Reception | Gap left |
|---|---|---|---|---|
| **Tiny Airline** (Inner Core Studios) | Minimalist route-drawing airline puzzle on a "tabletop map of the real world". Shapes as destinations, range, permits, jet stream, nightly upgrade, Daily/Weekly Sky, passport stamps | Steam, PC/Mac/Linux, coming soon, no mobile listed | Unreleased | **Closest threat.** Flat tabletop map, shape passengers (Mini Metro grammar), mouse/touchpad only, no day/night or transfer banks described. https://store.steampowered.com/app/5337690/ |
| **miniairways.co** (anonymous indie) | Browser airline network: real cities, frequencies, auto transfers through hubs, terminal capacity fail | Web/WebGL; free Europe demo with paid unlock; Steam, iOS and Play "planned" | Unknown | Close in concept, but uses the contested "Mini Airways" name. Globe or flat is **UNVERIFIED**. https://miniairways.co/ |
| **Fly Corp** | Route-network tycoon on a flat world map | PC $14.99; mobile F2P (Azur) | Steam 86%; Play 3.08★ | Flat map, F2P friction, shallow late game |
| **Airline Manager 4 / "Airline Manager - 2027"** (Xombat) | Long-term online airline management | F2P; Play 10M+, 4.20★ / 86k; Steam 71% of 1,781 | — | Spreadsheet sim, not a puzzle. https://play.google.com/store/apps/details?id=dk.xombat.airlinemanager4 · https://store.steampowered.com/app/1641650/ |
| **Airlines Manager: Plane Tycoon** (Playrion) | F2P airline tycoon | Play 10M+, 4.36★ / 162k, ads+IAP; iOS 21.8k ratings | — | Same as above. https://play.google.com/store/apps/details?id=com.Playrion.AirlinesManager2 |
| **AirlineSim** | Browser/online multiplayer airline sim | Steam F2P (2024), 79% of 112 | Niche | Hardcore. https://store.steampowered.com/app/2715810/ |
| **Pocket Planes** (NimbleBit, 2012) | Pixel-art idle airline routes | F2P; iOS 7.6k ratings; Play 500K+, 3.92★, ads | Legacy | Idle, not a puzzle. https://play.google.com/store/apps/details?id=com.nimblebit.pocketplanes |
| **Airline Tycoon 2** | Classic PC tycoon | Steam $9.99, **21% of 384** | Poor | — https://store.steampowered.com/app/201490/ |
| **New 2026 Steam airline tycoons**: Airline Founder (6 Sep 2026, $9.99, 77% of 81), Airline Empire (3 Oct 2026, $4.99, 54% of 11), Airline Legacy (22 Oct 2026, $17.99, 85% of 14) | Deep management sims, all Windows only | — | Small | They show interest in the theme, but none is minimalist or mobile. https://store.steampowered.com/app/4729250/ · /4893990/ · /4888530/ |
| **Jet Set Knights** | Airline sim with ultralight vehicles | Steam $9.99, 81% of 49 | Tiny | — https://store.steampowered.com/app/405550/ |
| **Airport CEO / Sky Haven Tycoon** | Airport builders (ground ops) | Steam; 82% of 4,705 / 57% of 1,215 | — | Different fantasy. https://store.steampowered.com/app/673610/ · /674090/ |
| **Airlines: Route Manager Game** (Awaytix) | Transit-map airline puzzle, 205 cities, shape matching | Android F2P with ads, 50+ downloads | None | Another clone, irrelevant at scale |
| **SkyHub Incheon: Airline Tycoon** | Android F2P with ads+IAP | 10+ downloads (Oct 2026) | — | Relevant only as a name collision. https://play.google.com/store/apps/details?id=com.skyhubincheon.game |
| itch.io: **UFO Airlines** (Mini Metro-inspired, airports spawn), **Flightplan** (prototype "inspired by Mini Metro, Fly Corp"), **Mini Flight Paths**, **Airfleet** (idle) | Prototypes | Free | — | https://jk5000.itch.io/ufo-airlines · https://explosiveghost.itch.io/flightplan · https://craftlings.itch.io/mini-flight-paths |
| "Airline Commander", "Air Traffic Empire" | Not found on Steam storesearch; the iOS search failed (rate limit) | — | — | **UNVERIFIED** |

### Minimalist network / transport puzzlers (adjacent)
| Game | Platform / price | Reception | Lesson / gap |
|---|---|---|---|
| **Mini Motorways** | Steam $7.99; iOS via Apple Arcade + free Intro | 96% Steam | Negative reviews cite randomness, "the game decides you die now", and less content than Metro |
| **Freeways** (Captain Games) | Steam $4.99, 90% of 1,762; iOS $2.99, 3.71★ / 507 | Good on PC, weak on mobile | Drawing precision on a touch screen is hard. https://store.steampowered.com/app/780210/ |
| **Railbound** (Afterburn, Polish studio) | Steam $12.99, 94% of 1,832; iOS $4.99, 4.81★ / 119; Play $4.99, 4.15★ / 1,159, 100K+ | Strong | Handcrafted puzzles sell at $4.99 premium on mobile. Even a hit gets few mobile ratings. https://store.steampowered.com/app/1967510/ · https://play.google.com/store/apps/details?id=com.Afterburn.Railbound |
| **Station to Station** (Galaxy Grove) | Steam $17.99, 89% of 1,246 | Good | Calm rail connection builder with goals per level. https://store.steampowered.com/app/2272400/ |
| **ISLANDERS / New Shores** | $4.99 / $9.99; 95% of 10,227 / 96% of 1,253 | Excellent | Short runs plus point thresholds give a clear goal |
| **Rail Route** | $24.99, 84% of 1,141 | Good | Dispatcher depth; shows the ATC-style drift risk |
| **Dorfromantik** | $9.09 shown (on sale?), 96% of 15,828 | Excellent | Calm, quest-based goals instead of pure survival |

**Is anyone already making a minimalist, premium mobile airline-hub game on a globe?** As of today, **not in a released form.** I checked Steam storesearch, App Store search, Play search and itch search; the results are above.
- Tiny Airline is the nearest in mechanics, but it is a flat PC game and unreleased.
- miniairways.co is the nearest in transfers, but it is browser-only and its mobile plans are unannounced.
- I found no released title with a rotating 3D globe plus a terminator mechanic. A deeper itch/Play sweep could still turn something up, so treat this as **"not found"** rather than "proven absent".

---

## 3. Genre gaps and player wishes (from reviews)

Sources: the top negative Steam reviews of Mini Airways, Fly Corp, Mini Metro and Mini Motorways (links in §1), plus GamingOnLinux comments (https://gamingonlinux.com/2024/03/mini-airways-is-like-mini-metro-mini-motorways-but-for-aircraft).

1. **Goals and an ending.** "just a 'play until you lose' sort of game" (Mini Airways). "You could play it forever and it only keeps getting harder until you fail" (Mini Metro). Players want objectives, a campaign or puzzle levels, and an end state they can win.
2. **Fair, legible failure.** "the game decides 'you die now'" and spawns impossible buildings (Motorways). "too much randomness" (Motorways). The "endgame is completely unbalanced and random" (Fly Corp). "the problem is their algorithm" (Metro).
3. **Planning over twitch.** "constantly giving directions to the planes" (Mini Airways). Motorways fans loved "seeing everything going smoothly". The desired fantasy is architect, not controller.
4. **Vehicle variety and meaningful choice.** "All airplanes are the same exact speed" (Mini Airways). "3/4 of the upgrades make no sense" (Mini Airways). "Planes should require fuel … some routes shouldn't be viable" (Fly Corp).
5. **Real-world plausibility.** The Fly Corp flat-earth complaint, and Mini Airways being called "unrealistic" by aviation fans. A **globe with great circles** answers this directly.
6. **Overview and information.** "You can't view your routes or airports or planes at the same time" (Fly Corp). "the game never explains [deeper strategy]" (Mini Metro).
7. **Content and identity.** "not very much content" (Fly Corp). "lack of personality" (Mini Airways). Clones are punished in reviews ("named to bank on the fame").
8. **Performance at scale.** Fly Corp lags after the 50% mark. For a phone with three.js this is a real risk.
9. **No F2P friction.** Fly Corp is at 3.08★ on Play while its Steam version is at 86%. The F2P mobile conversion looks hostile (my inference, though the gap itself is factual).

---

## 4. Core loop: critique and recommendation

### Recommended core ("hub architect on a turning globe")
- **Board.** An orthographic globe in portrait that auto-rotates to keep the "active hemisphere" in view. Start in one region (for example Europe/Atlantic) and widen over the run.
- **Input.** Drag from city to city to create a route that snaps to a great-circle arc. Drag a plane token onto a route. Long-press a city to make it a hub (limited hub tokens).
- **Passengers.** Do **not** use shapes; that is Mini Metro and Tiny Airline grammar. Use **destination colour by world region** (5–6 regions with distinct hue plus pattern for colour-blind players). Later add "named-city VIPs" shown with a 3-letter code.
  - Routing is deterministic and fewest-legs (Mini Metro-like greedy rule): a passenger boards any flight that reduces the legs remaining to their region.
  - Show the planned path on tap. This is the "explain pathfinding" answer: one tap shows one dotted path.
- **Hub transfer.** Arriving transfer passengers sit in a **connection ring** around the hub, segmented by outbound route. Minimum connection time is a short fill animation before they become boardable.
  - Keep MCT as one global constant at first. Per-hub MCT upgrades come later.
- **Failure.** A hub or city over capacity starts a visible countdown ring (about 20–30 s). Failure needs a **sustained** overflow, which is Mini Metro's proven fairness pattern.
  - Pausing is always allowed.
  - The run ends with a "what went wrong" replay: a heat-map of the jammed hub and its feeders. This answers wishes 2 and 6.
- **Time.** One globe rotation is one day; 7 days are one week, and each week brings a choice of 1 of 3 upgrades.
  - Options: +slot pair, new turboprop, new widebody (long range), hub expansion, faster MCT.
  - The terminator drives **demand waves**: cities spawn passengers in their local morning and evening peaks. That makes demand predictable, which feels fair, and it is uniquely aviation.
- **Curfews.** Introduce these as a mid-run modifier or puzzle rule, not from minute 1. A curfew city in the night zone cannot take departures or arrivals, so planes hold at the origin. It is visible as a dimmed city with a moon icon.
- **Plane types.** Turboprop: short range, fast turnaround, small. Widebody: long range, big, slow turnaround and needs a hub. A route longer than a plane's range is drawn **dashed**, and you cannot assign a short-range plane to it.
  - Skip automatic "stop en route" insertion in the MVP; it is hard to explain. Players create the tech stop themselves by routing through a city.
- **Modes.**
  - **Endless:** scored, ending around 10–15 min for a median player.
  - **Puzzle:** handcrafted, fixed seed and deterministic, with goals like "Deliver 150 to Asia by Day 5 with 3 planes, no widebody", star ratings, and unlimited undo.
  - **Daily seed:** cheap to add once the sim is deterministic.
- **Undo.** Unlimited in Puzzle mode. In Endless, undo the last route or plane edit while paused or within 5 s, which stops it being abused as a rewind.
- **Audio.** Each takeoff or landing triggers a note quantised to a scale, pitched by latitude, with the timbre set by plane type. The terminator crossing changes the chord. This is cheap and on-theme. Do not copy Disasterpeace's exact approach.

### Evaluating each proposed mechanic
- **Hub transfer, MCT and jam failure:** Keep it; this is the genre gap. Tiny Airline lists "hubs" as an upgrade, but transfers are not its core. The risk is opacity. Mitigate with the connection ring, tap-to-show-path, and a single MCT number.
- **Day/night terminator:** Keep it as the visual and design signature. It is the strongest unique-selling point, it reads well on a globe, and it ties into "week" pacing.
  - Risk: curfews add a second, invisible rule. Gate them behind a tutorial puzzle.
- **Plane range:** Keep it. Tiny Airline has range too, so it is not unique on its own, but it creates real turboprop-vs-widebody decisions (wish 4).
- **Puzzle mode:** Strongly keep it. It answers wish 1, makes the demo-to-unlock split natural, and is the cheapest content to produce once the sim is deterministic.
- **Discouraged altitude layers:** Agree. The Mini Airways reviews show that ATC-depth requests (altitude, speed, SIDs) are a bottomless pit.

### Design risks
1. **Great-circle readability on a ~6" screen.**
   - Arcs on an orthographic globe are short and curved near the limb. Clamp zoom so the active region covers about 70% of the screen.
   - Draw arcs as thick, raised (offset) ribbons, with a distinct colour per route.
   - Fade the back hemisphere fully, and cap simultaneous visible routes at 8–12.
   - Test at 360×780 CSS px.
2. **Touch precision** (Freeways' iOS 3.71★ suggests drawing on touch is hard). Snap to cities with a generous radius (about 44 px), and use drag-from-city, not freehand.
3. **Pathfinding explanation.** Use the greedy, fewest-legs rule and tap-to-show-path. Avoid optimal multi-criteria routing, because players cannot predict it.
4. **Fairness.** Make spawns predictable through terminator waves. Telegraph new cities a day ahead. Use a countdown, not an instant loss. Show a post-mortem.
5. **Session length.** Target 8–15 min for Endless and 2–5 min per puzzle. Allow saving mid-run (mobile interruptions).
6. **Globe rotation versus input.** Auto-rotation while the player drags is disorienting. Freeze rotation during a drag, and let the player pin the view.
7. **Performance on low-end Android.** Limit plane count, instance the meshes, and render at 30 fps when idle.

### Two alternative cores (brief)
- **A. "Day-by-day" turn-based network puzzle.** Plan the routes for a day, then watch the deterministic simulation run (like Into the Breach or Railbound pacing). There is no real-time stress, it fits short commutes, it is easier to build and test, and it suits handcrafted puzzles best. The trade-off is less emergent tension, so endless mode is weaker.
- **B. "Bank builder", single-hub timetable.** You run one hub airline. A 24-hour clock dial (the terminator as a ring) shows arrival and departure waves, and you place flights into banks to maximise connections under slot limits and curfews. This is very authentic to hub-and-spoke operations, its scope is smaller (no globe needed in v1), and it is unique. The trade-off is a more abstract, less "Mini Metro" fantasy and a harder pitch in screenshots.

---

## 5. MVP scope (5–6 weeks, 1–2 devs, TypeScript + Canvas/three.js + Capacitor)

**Tech suggestion:** use **Canvas2D + d3-geo orthographic projection** (geoOrthographic, geoInterpolate for great circles) for the MVP. It is faster to build and test than three.js, and its line rendering is crisper. Move to three.js only if you need 3D lighting. *(This is a design opinion; no source needed.)* Make the simulation a **fixed-step and deterministic** module, kept separate from rendering. That gives seeds, puzzles, replays and undo cheaply.

**In:**
- Globe and one starting region growing to about 40 cities
- Route drag, great-circle arcs, two plane types with range
- Region-coloured passengers, greedy routing, hubs with connection ring and MCT
- Capacity countdown fail, weekly 1-of-3 upgrade
- Terminator demand waves
- Endless mode, 10–15 puzzles, undo/pause
- Basic procedural audio, EN + PL, local save
- IAP unlock with a trial
- Android and iOS builds

**Out (post-launch):** curfews (unless week 3 finishes early), daily seed, leaderboards and cloud save, more regions and maps, a VIP city-code passenger, post-mortem heatmap polish, multiplayer, Steam port, more than 2 languages.

| Week | Milestone |
|---|---|
| 1 | Globe render, rotation/zoom, city data (lat/long, about 150 cities), drag-to-route snapping, arc rendering at phone size. **Gate:** readability test on a real phone |
| 2 | Deterministic sim: planes on arcs, boarding, greedy routing, hubs, MCT, capacity countdown, game over. Debug overlay |
| 3 | Plane types and range, weekly upgrades, terminator demand waves, city spawning and difficulty curve. First full Endless run. **Gate:** 5 external playtests, median run 8–15 min |
| 4 | Puzzle framework (JSON levels, goals, stars), 10 puzzles, undo, pause, tap-to-show-path, onboarding (3 tutorial puzzles) |
| 5 | Visual identity pass, procedural audio, PL/EN, save/resume, Capacitor builds, low-end Android performance, IAP unlock and trial, TestFlight / Play internal testing |
| 6 | Buffer: balancing, store assets (screenshots, 30-s trailer), privacy forms, submission. Optional: curfews or daily seed |

---

## 6. Business model (premium mobile, 2026)

**Market facts:**
- Upfront-paid apps are a tiny slice of the market: about 2% of apps with measurable downloads and under 1% of revenue (MWM data; vendor source, so treat as indicative). https://mwm.ai/glossary/top-paid
- Publisher Playdigious advises against "AAA pricing" on mobile. It says free-to-start works only if the trial engages, and that store featuring is "crucial". Shapez and Loop Hero did well as free-to-start. https://mobilegamer.biz/how-to-launch-a-premium-game-on-mobile/

**Comparable mobile prices and volumes (today):**

| Game | Price | Ratings |
|---|---|---|
| Mini Metro (iOS) | $3.99 | 31.8k |
| Mini Airways (iOS) | $4.99 | 121 |
| Mini Airways (Play) | $4.99 | ~1,050 / 10K+ downloads |
| Railbound (iOS) | $4.99 | 119 |
| Railbound (Play) | $4.99 | 1,159 / 100K+ downloads |
| Freeways (iOS) | $2.99 | 507 |

**Apple:**
- Unlocking a full version must use IAP.
- Non-subscription apps may offer a time-based free trial through a Tier-0 Non-Consumable IAP named "XX-day Trial", with up-front disclosure. (Guideline 3.1.1, https://developer.apple.com/app-store/review/guidelines/)
- Small Business Program: **15%** commission if proceeds are ≤ $1M in both the prior and current year. https://developer.apple.com/app-store/small-business-program/

**Google:**
- **Game Trials** were announced 11 Mar 2026: a full paid game with free trial and progress carry-over, rolling out "soon" to select paid games. "Buy once, play anywhere" covers mobile and PC. https://blog.google/products-and-platforms/platforms/google-play/google-play-paid-games-updates/
- **New fee structure** in the EEA, UK and US from 30 Jun 2026 (AU/JP from 30 Sep 2026), per Google's help page: new installs **20% + 5% billing fee** on the first $1M, or **15% + 5%** in Play Games Level Up. Other markets stay at 15% on the first $1M. https://support.google.com/googleplay/android-developer/answer/112622
  - This is surprising enough that it should be **re-checked in Play Console** before you model revenue.

**Recommendation:**
1. **Free download with a single non-consumable "Full Flight" unlock at €3.99 / $3.99** (test €4.99).
   - Free tier: the tutorial, the first 8–10 puzzles, and Endless in one region with no score saving after day 7, or similar.
   - Unlock: all regions, all puzzles, daily seed, and future content.
   - Never show ads or timers. Make "No ads. No timers. One purchase." a store-page headline.
   - On Android, also apply for Game Trials when it is available.
2. Keep a **paid-upfront SKU as an alternative** on iOS if featuring is the goal; Apple editorial favours premium games. *(This is industry opinion and UNVERIFIED as a rule.)*
3. Plan **Steam (PC) later**: same codebase, and it builds the reviews and wishlists that feed featuring. Note Playdigious' port threshold of 500K–1M units and 10K Steam reviews; you won't hit that, so self-publish.
4. Approach **Apple Arcade / Netflix Games** only after a vertical slice. DPC's Motorways sits on Arcade with a free Intro funnel, so that path exists for the genre.
5. Expect modest volume. A realistic first-year base case is thousands, not hundreds of thousands, of mobile units without featuring. Mini Airways has about 1.2k mobile ratings across both stores, even with an established PC brand.

---

## 7. Title candidates and collision checks (informational, not legal advice)

**Method:** exact-name searches on the Steam storesearch API, the iTunes Search API (US), Google Play search (US; top 6 apps resolved by name) and itch.io search, plus a general web search for the top picks, all on 2026-11-02. Collision levels: **clear** = no game or app with that name found; **weak** = same name exists but only as a non-game app or tiny itch jam; **strong** = a game with the same or near-same name exists, or an aviation-space app does. Trademark databases (EUIPO/USPTO/UPRP) were **not** searched, so do that before committing.

| # | Title | Idea | Result | What was found |
|---|---|---|---|---|
| 1 | **Hubline** | hub + route line; easy in PL/EN | **Clear** | Steam, itch: none. iOS/Play: no exact match (Line Hub, DeflineHub). Web: nothing named Hubline |
| 2 | **Daywing** | day/night + wing | **Clear** | Steam, itch, Play: none. iOS: none exact (Redwing). Web: nothing |
| 3 | **Terminair** | terminator + air (also "terminal") | **Clear** (Terminator association; check trademark) | Steam, iOS, Play: none exact. itch: "TERMITAIRE" (unrelated). Web: nothing |
| 4 | **Duskport** | dusk + airport | **Clear / weak** | Steam, Play: none. itch: "Fumo & Fulmini a Duskport" (jam game, unrelated). Web: *Duskpunk* (RPG) is similar-sounding |
| 5 | **Dayturn** | the turning day / globe | **Weak** | iOS: "Dayturn: Photo Journal" (4 ratings, non-game). Steam, itch, Play: none exact |
| 6 | **Hubspin** | spinning globe of hubs | **Weak** | No exact game. Generic "Hub"/"Spin Hub" apps on Play; may read as HubSpot |
| 7 | **Dawnline** | the terminator line | **Weak–strong** | itch: "Dawnline", "The Dawnline" games. Play: "Void Patrol: Dawnline". iOS: 4 "Dawnline" utility apps from 2026 |
| 8 | **Aeroloop** | aero + loop | **Weak–strong** | iOS: "AeroLoop" (0 ratings). itch: "Aeroloop". Steam: none |
| 9 | **Sunwake** | sun's wake / terminator | **Weak** | iOS: "Sunwake: Sunrise Alarm Clock". itch: none exact. Steam: none |
| 10 | **Hubwise** | smart hubs | **Weak** | iOS/Play: "HubWise" (BuildWise productivity app). Steam, itch: none |

**Rejected as strong collisions:**
- **Layover**: itch "Layover" ×4+, crew apps on iOS and Play
- **Contrail**: iOS *Contrail: Flight Paths* (minimalist plane game, Jun 2026), itch "Contrail", flight-tracker apps
- **Skyhub**: Play *SkyHub Incheon: Airline Tycoon*
- **Arcwise**: iOS game *Arcwise* (Sep 2026)
- **Great Circle**: *Indiana Jones and the Great Circle*
- **Redeye**: many apps and itch games
- **Nightside**: Steam *Nightside*
- **Nightfly**: Steam *Night Fly*
- **Skyloom**: itch *Skyloom*
- **Globeline / Flyway**: generic and crowded

**Pick:** **Hubline** (it describes the mechanic and is clean) or **Daywing** / **Terminair** (they sell the terminator USP). A short subtitle helps app-store search, for example "Hubline: Airline Network Puzzle". It contains the keywords without "Mini". Avoid an icon or visual language that echoes Mini Metro (Apple 4.1).

---

## 8. Top risks and mitigations

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| 1 | **Tiny Airline ships first or ports to mobile**, and/or miniairways.co launches on stores | High / High | Lead with the globe, terminator and transfer banks, not range or upgrades. Portrait one-hand mobile first. Ship a public demo or trailer early and get press angles ("the airline game where night falls across the globe"). Watch both pages monthly |
| 2 | **Perceived as a Mini Metro clone** (reviews, DPC enforcement, Apple 4.1) | Medium / High | No "Mini", no shapes, no flat pastel subway look, no coloured-line-on-white UI. Use a dark-ocean or lit-globe aesthetic. Original audio approach. Avoid DPC's typeface and colour palette. Get a legal check before launch |
| 3 | **Unreadable on phone** (arcs, small cities, globe limb) | Medium / High | Week-1 gate on a real 6" device. Zoom clamp, thick raised arcs, route cap, auto-framing, freeze rotation while dragging |
| 4 | **Opaque passenger routing feels unfair** | Medium / High | Greedy fewest-legs rule, tap-to-show-path, connection ring, countdown-based failure, post-mortem |
| 5 | **Scope creep** (curfews, VIPs, multiplayer; DPC needed ~2 years) | High / High | Strict MVP list (§5), deterministic sim first, cut curfews if late, puzzle content in JSON |
| 6 | **Low premium mobile volume** (Mini Airways about 1.2k mobile ratings) | High / Medium | Free download with unlock and trial, Steam version later, pitch to Apple/Google editorial, consider Arcade/Netflix, keep the budget small |
| 7 | **Store fee and policy changes** (Google's new 20% + 5% structure) | Medium / Low–Medium | Model at 25–30% take. Re-check the Play Console fee tier and enrol in Level Up if eligible |
| 8 | **Low-end Android performance** with WebView + Canvas/three.js | Medium / Medium | Canvas2D first, cap entities, 30 fps idle, test on a cheap device in week 5 |
| 9 | **Name or trademark conflict** | Low–Medium / Medium | EUIPO/USPTO/UPRP search on the shortlist and reserve the domain and handles before announcing |
| 10 | **"Play until you lose" fatigue** | Medium / Medium | Puzzle campaign with stars, daily seed (post-MVP), region "passport"-style milestones. Note that Tiny Airline already uses passport stamps, so do not copy them |
