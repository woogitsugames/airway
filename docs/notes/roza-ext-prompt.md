# Prompt startowy dla sesji ext: Róża w renderze

Do wklejenia jako pierwsza wiadomość sesji ext. Specyfikacja: `docs/notes/roza-render-spec.md`.

```text
Jesteś sesją ext gry Airway (repo woogitsugames/airway). Odpowiadasz za globus 3D: `src/render/**` (znaczniki lotnisk,
trasy, samoloty, niebo). Z właścicielem rozmawiasz po polsku; kod, komentarze i commity po angielsku; PR i raport po
polsku. Przeczytaj najpierw CLAUDE.md, docs/ARCHITECTURE.md, docs/TESTING.md.

KONTEKST
Właściciel wybrał wariant UI C „Róża” (docs/styles/ui-2026-11/KARTA-V2.md; makiety
docs/mockups/ui-2026-11/v2/c/game-p.png, game-l.png, jam.png, menu-p.png; kod makiet mockups/ui-2026-11/v2/c/c.js
i common.js; wzorniki docs/references/charts/, zwłaszcza 01, 02, 07, 08, 16). Lotnisko przestaje być Medalionem
(D-178): staje się małą różą kompasową — kreski na obwodzie = miejsca w poczekalni (długa = zajęte), w środku układ
pasów (hub: podwójny pierścień + trzy pasy), zator = róża w cynobrze + gruby łuk odliczania. Agent #1 robi równolegle
UI w src/ui/** (tarcza 24 h, dok na łuku, nazwy po łuku, notki, glify). Pełna specyfikacja z wymiarami, paletą,
mapowaniem na pliki, kryteriami odbioru i testami: docs/notes/roza-render-spec.md — to jest Twoje zadanie.

ZADANIA (szczegóły w specyfikacji, sekcje R1–R8)
1. R1 Róża zamiast Medalionu: nowy src/render/rose.ts (jeden InstancedMesh z kwadratem stycznym do globusa,
   proceduralny shader SDF z obwódką i AA przez fwidth, stały rozmiar na ekranie: r = 11 px zwykłe / 16 px hub),
   roseTicks(cap, used, hub) z regułą kreska = ceil(cap / maxTicks) miejsc (12 zwykłe / 24 hub), łuk zatoru
   (jamTicksLeft / CONGESTION_GRACE_TICKS), kreskowany pierścień nocnej ciszy bez czerwieni; AirportStyle 'rose'
   jako domyślny (medal i reszta tylko za DEV ?airportStyle=); WorldRenderer.setAirportLoad dla WSZYSTKICH lotnisk
   (setHubLoad jako alias); menuNetwork.ts na tym samym API.
2. R2 Kontrast D-47/G9b: kreda #F5F2EA na tuszu #0C1418, obwódka ≥ 1 px urządzenia także na DPR 1; sonda D-177
   ≥ 4,5:1 dla lotnisk na Satelicie i Mapie, w dzień i w nocy.
3. R3 Trasy: paleta Róży (rdzeń #F5F2EA, kreski turbośmigłowe #EDD98E, obrys #0C1418), grubości i kształty bez zmian;
   wnętrze róży przygasza trasę; routePreview.ts bez czerwieni zatoru.
4. R4 Samoloty: tuszowy obrys (instancjonowany, +1 wywołanie na typ), kreda, pasek obciążenia bez cynobru.
5. R5 Niebo: NIE zmieniaj koloru (#8CC3D8 zostaje, UI ma na nim ciemny tusz); dodaj eksport SKY_COLOUR + skyIsLight
   z src/render/index.ts. Ciemne niebo = osobne pytanie do właściciela (możesz przygotować zrzuty, nie decyduj).
6. R7 API dla nakładki: najpierw (w pierwszym PR) eksport ROSE_SIZE_PX i ROSE_PALETTE z src/render/index.ts, potem
   WorldRenderer.projectAirport(id, out) → { x, y, radius, outer, squash, angle, visible } bez alokacji;
   pick() łapie w max(28, outer + 4) px (cel ≥ 48 dp).
7. R8 Testy, zrzuty, sonda, perf (tabela „Kryteria odbioru i testy” w specyfikacji, A1–A11).

GRANICE
- NIE dotykaj src/ui/** (to Agent #1). Poza src/render/** wolno zmienić tylko linie wywołań renderu w
  src/game/session.ts (syncWorld: setAirportLoad dla wszystkich miast + jam01), src/game/world.ts (interfejs World)
  i src/game/dev/stubWorld.ts (no-op / projectAirport przez project) — opisz to w PR.
- Cynober #EA4A2A tylko dla zatoru. Typy odróżnia kształt. Ruch krótki, rzeczowy, bez pulsowania i sprężyn.
- Każdy nowy PNG obejrzyj i sprawdź z listą zakazów CLAUDE.md przed commitem.

GAŁĘZIE I PR
- Od świeżego origin/dev. Gałęzie ext/03-*: ext/03-g10a-roza-airports (R1, R2, R7, okablowanie), potem
  ext/03-g10b-roza-routes-planes (R3, R4, R5) i ewentualnie ext/03-g10c-roza-shots (store:shots, ui:matrix).
- Draft PR do dev po polsku po implementacji i testach; nie scalaj (scala tylko właściciel); nigdy nie pchaj na dev
  ani main.
- Dopisz krok G10 (a/b/c) w docs/mockups/globe-2026-11/PLAN.md i wpis w docs/NIGHT-BACKLOG.md (G10, G9b zamknięte
  przez różę, jeśli sonda przejdzie).

DECYZJE
Z puli ext D-160…D-179 wolne są tylko D-167, D-168, D-169 (sprawdź jeszcze raz: grep "^## D-16[789]" w
docs/DECISIONS.md na origin/dev i origin/ext/*). Wpisy idą po D-166, przed D-170 (test:doc-ids wymaga rosnącej
kolejności). Proponowane: D-167 róża w renderze zastępuje Medalion D-178; D-168 reguła kresek, łuk zatoru, znak nocnej
ciszy; D-169 kontrakt projectAirport/ROSE_SIZE_PX i paleta tras/samolotów. Gdy zabraknie numerów: kolejny wolny
powyżej najwyższego w pliku, dopisany na końcu, z adnotacją w PR. Wybór wariantu C zapisuje sesja UI, nie Ty.

TESTY (przed każdym pushem)
- npm ci; npm run test:fast (typecheck, test:render-layers z nowymi przypadkami róży, test:quality, test:daynight,
  test:session-stub, test:doc-ids, test:arch); npm run build.
- Zmiana wyglądu: npm run test:e2e:smoke, node e2e/curfew-barrier.mjs, node e2e/new-airport.mjs,
  node e2e/airport-plates.mjs, node e2e/edge-chip-airports.mjs, npm run ui:matrix, npm run store:shots (potem
  npm run test:store-shots — bramka D-47 w scenach game/night), npm run shots -- airports airports-zoom globe-menu,
  npm run shots:34, sonda: node dev/globe-look/shots.mjs --looks=satellite,map --sizes=phone --play=300,
  npm run perf:scene (draw calls ≤ 50; nie porównuj z urządzeniami).
- Playwright 1.63 + Chromium ze środowiska (npm install --no-save playwright@1.63.0), nigdy w package.json.

RAPORT KOŃCOWY (po polsku, krótko): link do PR, co zmienione w renderze, wyniki sondy D-47 (Satelita/Mapa,
dzień/noc), draw calls przed/po, użyte numery decyzji, co zostaje dla Agenta #1 (np. napisy po łuku na
projectAirport).
```
