# Family audit: our other games (read-only review, 2026-11-02)

| Game | Stack | Look | Reusable pattern |
|---|---|---|---|
| **Commutopia** (`woogitsu/commutopia`) | TS + three.js 0.186 + Vite + Capacitor 8 | Casual 3D city; "UI5" skin: cream windows, navy `#161A36` outlines, hard offset shadows, sticker icons, Fredoka + Nunito, map bubbles above the world | `src/core/noise.ts` `Rng` (mulberry32 with exposed `state` so saves continue the stream); `src/sim/**` has no three.js imports; `src/sim/freight/hub.ts` + `ledger.ts`: hubs with docks/queue/deadline, losses booked by **cause** (`F_HUBFULL`, `F_NOROUTE`…) in typed arrays, zero per-frame allocation; map bubbles (`src/ui/mapBubbles.ts`) = in-world info; `test:*` scripts with fixed seed and a final `SUMMARY` line; `scripts/shot.cjs` 412×915 + Fold shots |
| **Cebulak Express** (`woogitsugames/cebulak-express`) | TS + Canvas 2D + Vite + Capacitor (Android + iOS) + Firebase | Flat outlined illustration, warm daylight, city skylines | `src/core/rng.ts` (same mulberry32), `src/core/daily.ts` (daily key in Europe/Warsaw, seed from string), `src/net/week.ts` (ISO-week leagues), `src/net/queue.ts` (offline score queue), `src/record/recorder.ts` (15 s 9:16 clip from canvas), fastlane + Playwright e2e |
| **Century War** (`woogitsugames/century-war`) | Kotlin Android, `:sim` module | Flat vector, dark HUD bars | Pure-Kotlin deterministic `:sim` with balance tests AI-vs-AI; screenshot regression goldens at phone + Fold sizes |
| **Frontier: Sky Realms** (`SamsufiPL/Frontier`) | Kotlin Canvas, all graphics/audio in code | Soft illustrated floating islands, faction colours teal/coral/violet/gold, towers with shield counters | **Drag-to-connect gesture**, swipe across a road to delete it; distinct shield *symbols* per faction (colour-blind); 5 000 bot-verified levels from a generator; foldable/split-screen handling |
| **AirWar** (`SamsufiPL/AirWar`) | Godot 4.7 | Style A1 "Wielki cyrk lotniczy": 1930s screen-print circus poster, cream `#f6ead0` + navy `#22324a` outline + red `#c8322b` + gold, hard 6 px offset shadow, Alfa Slab One + Barlow Condensed, ticket-shaped buttons | Decision log D-xx culture; poster component library |

**Shared brand DNA (what makes them "ours")**
1. Everything drawn in code (procedural art, synthesised audio) — no stock assets.
2. Warm cream paper + one dark ink (navy) as the UI base; flat fills with **hard, unblurred** shadows; chunky, friendly.
3. Information placed *in the world* (map bubbles, tower counters) rather than in dashboards.
4. Deterministic, seeded simulation separate from rendering; daily challenge keyed to Warsaw date; tests with fixed seeds.
5. PL + EN (or more) via i18n from day one; foldables treated as first-class.

**Carry over (code patterns, not code copies)**
- Seeded `Rng` with serialisable state; sim module free of renderer imports; fixed timestep.
- Hub model with capacity, queue, deadline and a **cause ledger** (why a passenger was lost) → directly maps to our hub jam/fail screen ("why did I lose").
- Daily seed (`dailyKey` in Europe/Warsaw), ISO-week league keys, offline score queue, Firebase leaderboard (later, post-MVP).
- Screenshot harness at 412×915 + Fold; `SUMMARY`-line headless tests.
- Capacitor 8 setup (haptics, share, filesystem), fastlane for iOS.

**Do not repeat (to avoid a reskin)**
- Cream + navy + hard-shadow "sticker/poster" chrome: it is now the signature of **both** Commutopia UI5 and AirWar A1. A third game in it reads as a skin.
- Alfa Slab One / Barlow Condensed (AirWar) and Fredoka / Nunito (Commutopia) — pick different faces.
- AirWar's 1930s circus poster (rays, tickets, starbursts) — the new game must not be a second "aviation poster" game.
- Frontier's teal/coral/violet/gold faction set and glowing ribbon roads — our routes must not look like Frontier's roads.
- Big chunky "Buduj" button + top bar of pills (Commutopia) — our HUD should be lighter and live on the globe.
