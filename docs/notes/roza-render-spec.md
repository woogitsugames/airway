# Róża w renderze: specyfikacja dla sesji ext (globus)

Night 12bm, dla sesji ext (właściciel `src/render/**`, gałęzie `ext/03-*`). Właścicielka wybrała wariant UI
**C „Róża”** (`docs/styles/ui-2026-11/KARTA-V2.md`). Agent #1 robi UI w `src/ui/**` (tarcza 24 h, dok na łuku,
nazwy po łuku, notki „ATH 14 z 24 ▲” z glifami). Ten dokument mówi, **co musi się zmienić w renderze**, żeby gra
wyglądała jak makiety C, z mapowaniem na pliki i funkcje, szacunkiem, kryteriami odbioru i testami. Na końcu gotowy
prompt startowy dla sesji ext (ten sam tekst: `docs/notes/roza-ext-prompt.md`).

## Źródła

| Co | Plik |
|---|---|
| Karta wariantów, opis C, zakres UI/ext | `docs/styles/ui-2026-11/KARTA-V2.md` |
| Makiety C (PNG 2×) | `docs/mockups/ui-2026-11/v2/c/game-p.png` (412×915), `game-l.png` (915×412), `jam.png` (zbliżenie zatoru AMM), `menu-p.png` |
| Kod makiet (geometria róży, kolory) | `mockups/ui-2026-11/v2/c/c.js` (`rose`, `marker`), `mockups/ui-2026-11/v2/common.js` (`rad`, `runways`) |
| Wzorniki z map lotniczych | `docs/references/charts/` — 01 (krążek z pasami), 02 (hub = więcej geometrii, liczba w łuku), 07 (zębaty krążek), 08 (farby, kreskowanie stref), 13 (trasy), 16 (róża z podziałką); plansza `plansza.png` |
| Plan globusa, G9/G9b | `docs/mockups/globe-2026-11/PLAN.md`, `docs/mockups/globe-2026-11/g9/README.md`, `docs/NIGHT-BACKLOG.md` (G9b) |
| Decyzje, na których to stoi | D-08 (glify), D-47 (kontrast ≥ 4,5:1), D-172 (Satelita/Mapa), D-177 (sonda krawędzi), D-178 (Medalion — zastępujemy) |

**Uwaga do makiet.** Tło makiet to prawdziwy render (seed 0xA1A1) z **wymazanymi medalionami** (`clean-frames.py`);
ciemne „plamy” wokół lotnisk to ślady wymazywania, nie część projektu. Trasy, samoloty i niebo na makietach to
**dzisiejszy** render — makieta nie proponuje dla nich nowego wyglądu (w tabeli KARTY-V2 kolumna C przy trasach ma
„—”). Nowe są tylko znaczniki lotnisk.

## Podział pracy: co render, co nakładka

| Element makiety C | Kto | Dlaczego |
|---|---|---|
| Róża lotniska: pierścień(e), kreski miejsc, układ pasów, łuk odliczania zatoru, znak nocnej ciszy | **render (ext)** | leży na globusie, ma się chować za horyzontem, przesuwać z kamerą bez opóźnienia i ustępować samolotom; to zastępca Medalionu (D-178) |
| Nazwa miasta po łuku nad różą, notka „ATH 14 z 24 ▲”, linijka zatoru, glify pasażerów, chipy na krawędzi | UI (Agent #1) | tekst i glify w DOM/SVG (i18n, ostre fonty, dostępność) |
| Tarcza 24 h, dok na łuku, tydzień/pasażerowie, pauza | UI (Agent #1) | HUD |
| Trasy, podgląd trasy, samoloty, niebo | render (ext) | tylko korekty palety i obrysu (niżej) |

Nakładka **nie rysuje** krążka ani kresek pod lotniskiem; potrzebuje od renderu tylko położenia i promienia róży
(R7). Dopóki R7 nie wejdzie, Agent #1 liczy na stałych z R7a.

## Paleta Róży (z `c.js`)

| Token | Wartość | Użycie w renderze |
|---|---|---|
| `INK` (kreda) | `#F5F2EA` | pierścień, zajęte kreski, pasy, rdzeń trasy szerokokadłubowej, kadłub samolotu |
| `HALO` (tusz) | `#0C1418` | obwódka pod każdą kreską róży (+2,2 px), obrys tras i samolotów |
| `DIM` (wolne miejsce) | `#F5F2EA` przy α 0,55 | krótkie kreski wolnych miejsc |
| `RED` (cynober) | `#EA4A2A` | **tylko zator**: cała róża + łuk odliczania |
| złoto kresek | `#EDD98E` (makieta) / dziś `#FFD166` | kreski tras turbośmigłowych |

Cynober jest zarezerwowany dla zatoru — nigdzie indziej w renderze (dziś `#C8352A`/`#E5483B` dla
pełnego huba, bariery i krytycznego paska samolotu; patrz R1, R3, R5). Pomarańczowy `BUSY #FF9A3D` znika.
Kolory renderu powinny mieć jedno źródło: stała `ROSE_PALETTE` w `src/render/rose.ts` eksportowana przez
`src/render/index.ts`; Agent #1 bierze te same wartości do tokenów skórki (spójność nakładki i znacznika).

---

## R1. Róża lotniska zamiast Medalionu (główna zmiana)

**Wygląd (makieta `c/game-p.png`, `c/jam.png`, kod `marker()` w `c.js`).** Wymiary w px CSS przy zoomie rozgrywki
(kadry 412×915; w poziomie ×0,92, `rad()` w `common.js`):

| Część | Zwykłe | Hub |
|---|---|---|
| Promień pierścienia `r` | 11 | 16 |
| Pierścień | kreda 1,3 na tuszu 3,6 | to samo + **drugi pierścień** w `r − 3,2`, 0,9 px |
| Pasy w środku | **jeden pas** dł. ≈ 1,05 r, szer. 2,8, obrót −25° | **trzy pasy**: dwa równoległe (−25°, przesunięte o −4,2 / +4,6 px, długości ≈ 1,03 r i 0,86 × tego) + poprzeczny (58°, 0,72 ×, szer. 2,9) |
| Obwódka pasów | tusz +1,3 px z każdej strony | to samo |
| Kreski miejsc (od `r` na zewnątrz, start na 12:00, zgodnie z zegarem) | zajęta: dł. 6, szer. 2,2, kreda; wolna: dł. 2,7 (45 %), szer. 1,3, `DIM`; każda na tuszu +2,2 | zajęta dł. 7; reszta jak obok |
| Zasięg zewnętrzny (bez zatoru) | ≈ 17 | ≈ 23 |

Hub odróżnia **kształt** (podwójny pierścień + trzy pasy, większy promień), nie kolor — reguła CLAUDE.md
i wzornik 02. Dzisiejsza wieża huba i kolorowy dach terminalu odpadają (róża jest symbolem mapy, nie dioramą).

**Liczba kresek a pojemność (do zapisania jako decyzja).** Makieta ma 12/24 miejsca, gra ma 24 (miasto,
`CITY_WAITING_CAPACITY`) i 36 (hub, `HUB_WAITING_CAPACITY`), +6 za ulepszenie (`HUB_CAPACITY_UPGRADE`), do 48
(`maxHubSeats`). 24 kreski na `r = 11` to 2,9 px odstępu przy 2,2 px kreski — zlewa się w zębatkę (ryzyko z KARTY).
Propozycja: **kreska = k miejsc**, `k = ceil(cap / maxTicks)`, `maxTicks` = 12 (zwykłe) i 24 (hub). Wtedy miasto 24 →
12 kresek po 2, hub 36 → 18 po 2, hub 48 → 24 po 2. Zapalonych kresek `floor(used / k)`; reszta `used mod k ≠ 0`
rysuje następną kreskę w połowie długości. Pełna róża ⇔ `used = cap`. Funkcja czysta `roseTicks(cap, used, hub)`
→ `{ ticks, lit, partial }` do testów jednostkowych.

**Zator (makieta `c/jam.png`).** Cała róża (pierścień, kreski, pasy) w `RED`; **gruby łuk odliczania** w promieniu
`r + 14`: cynober 4 px na tuszu 7 px, od 12:00 zgodnie z zegarem, długość = pozostały czas / czas łaski
(`jamTicksLeft / CONGESTION_GRACE_TICKS`, dziś 45 s); znacznik startu: radialna kreska ±6 px, 2 px na 12:00. Łuk
maleje płynnie (interpolacja `alpha` jak samoloty), bez pulsowania (CLAUDE.md: krótki, rzeczowy ruch). Zator czyta
się kształtem (łuk + komplet długich kresek), kolor jest drugim kanałem.

**Nocna cisza (curfew, dziś czerwono-biała bariera `.066`).** Makieta C jej nie pokazuje; cynober zajęty przez
zator. Propozycja: **kreskowany pierścień** (krótkie skośne kreski kredą na tuszu, jak strefy zastrzeżone na
wzorniku 08) w promieniu `r + 9`, bez czerwieni. Do decyzji (D-168) — e2e `curfew-barrier.mjs` i `curfewDrawn()`
muszą dalej działać.

**Jak rysować (rekomendacja).** Jeden `InstancedMesh` z kwadratem stycznym do globusa (jak dziś `place()` w
`airports.ts`: lokalne Y = pion, −Z = północ) i **proceduralnym fragment shaderem** (SDF): pierścienie, kreski po
kącie, prostokąty pasów, łuk zatoru i kreskowanie liczone analitycznie, antyaliasing przez `fwidth`, obwódka i rdzeń
w tym samym przebiegu. Atrybuty instancji: `aTicks` (ticks, lit, partial, hub), `aState` (jam01, curfew, jam flag).
Zmiana zajętości = aktualizacja atrybutu, bez przebudowy geometrii (dziś `rebuildMarkers()` przepisuje do
48 × 64 macierzy). Grubości linii w px CSS × DPR (uniform), więc róża jest równie ostra na `low` (DPR 1, bez MSAA)
co na Fold. Rozmiar: uniform „świat na px CSS” liczony co klatkę z `orbit.getScreenDisc()` (już liczone w
`pixelsPerDegree()` w `world.ts`), róża ma **stały rozmiar na ekranie** w zakresie zoomu rozgrywki, z ograniczeniem
0,85–1,3× na skrajnych zoomach (zastępuje `setZoom()`/`zoomScale` 1–1,6). Róża leży na globusie (skrót perspektywy
przy krawędzi tarczy jest zamierzony: „nadruk na globusie”); `depthTest` z globusem, `polygonOffset`, żeby nie
migotała z terenem (spłaszczonym pod lotniskami przez `airportFlatten`).

Koszt: **1 wywołanie rysowania** zamiast dzisiejszych ~15 (5–6 części × zwykłe/hub + pierścienie + 2 bariery);
budżet ≤ 50 (PLAN) zyskuje.

**Pliki i funkcje.**
- Nowy `src/render/rose.ts`: `createRoseLayer(scene, options)`, `roseTicks()`, `ROSE_PALETTE`, `ROSE_SIZE_PX`,
  shader. Interfejs jak `AirportsLayer` (`addAirport`, `has`, `isHub`, `getPosition`, `clear`, `update`, `dispose`)
  + `setLoad(id, used, cap)` **dla każdego lotniska**, `setJam(id, fraction | null)`, `setCurfew(id, on)`,
  `setPixelScale(worldPerCssPx, dpr)`.
- `src/render/airports.ts`: `AirportStyle` dostaje `'rose'` jako nową domyślną; `medal`/`current`/`ink`/`apron`
  zostają za DEV `?airportStyle=` na jedno wydanie, potem do usunięcia (D-174 — eksperyment w drzewie za flagą).
  `setHubLoad()` przestaje rzucać dla zwykłych lotnisk w ścieżce `rose`.
- `src/render/world.ts`: `createWorldRenderer` domyślnie `airportStyle: 'rose'`; nowa metoda
  `setAirportLoad(loads: readonly AirportLoadView[])` z `{ id, used, cap, jam01: number | null }` (`setHubLoad`
  zostaje jako alias do czasu migracji); w `render()` przekazanie skali px do róży; `stats().airports` bez zmian.
- `src/render/menuNetwork.ts`: tło menu (makieta `c/menu-p.png`: róże bez napisów; hub 9 z 24, zwykłe 2 z 12) —
  przez ten sam `setAirportLoad`.
- Okablowanie poza renderem (jedyne linie poza `src/render/**`, uzgodnić w PR): `src/game/session.ts` `syncWorld()`
  (dziś linia z `world.setHubLoad(cities.filter((city) => city.hub)…)` → wszystkie miasta + `jam01` z
  `city.jamTicksLeft`), `src/game/world.ts` (interfejs `World`, przekazanie), `src/game/dev/stubWorld.ts` (no-op).
  `src/ui/**` bez zmian.

**Szacunek:** 1–1,5 nocy (shader + warstwa + API + okablowanie + testy jednostkowe).

## R2. Kontrast D-47 / G9b

Róża z kredowym rdzeniem na tuszowej obwódce ma kontrast **rdzeń–obwódka 16,6:1** niezależnie od tła, a sonda D-177
bierze lepszą z dwóch granic (krawędź–globus albo rdzeń–krawędź). Warunek: obwódka ma ≥ 1 px urządzenia także na
DPR 1 (stąd grubości w px × DPR, nie w jednostkach świata). Dla lotnisk to **zamyka G9b** (dziś Medalion 2,6–3,2).
Do sprawdzenia: Mapa w dzień (jasny ląd), pustynie w dzień (Arabia, Sahara — kadr makiety), noc (kreda na czarnym).
Zator: cynober `#EA4A2A` na tuszu `#0C1418` = 4,88:1 — powyżej progu, ale na granicy: nie rozjaśniać tuszu ani nie
przyciemniać cynobru. Złoto kresek `#EDD98E` na tuszu = 13,2:1.

**Pliki:** bez zmian w `src/render/contrast.ts` (sonda D-177 już mierzy krawędzie); `airports.group` dalej jest
warstwą `airports` w `measureLayerContrast()`. **Szacunek:** w R1 + pomiar (0,25 nocy razem z R8).

## R3. Trasy

Makieta C nie zmienia tras (dzisiejszy render, D-178: rurka z tuszowym obrysem; szerokokadłubowe ciągłe, turbośmigłowe
kreskowane — kształt, nie kolor). Korekty, żeby trasy należały do tej samej „farby” co róża:
- `src/render/routes.ts`: `LIGHT_TUBE '#fffaf0'` → `INK #F5F2EA`; `GOLD_DASH '#ffd166'` → `#EDD98E` (bladsze złoto z
  makiety, mniej „żółte” obok kredy); kolor obrysu (shader `outline`) → `HALO #0C1418`. Grubości bez zmian
  (`0.0032` ciągła, `0.0026` kreska, kreska 55 % okresu, `Math.ceil(arc.angle / 0.022)`). Duch za horyzontem
  (`HORIZON_FRAGMENT`, α 0,19) bez zmian.
- Trasa nie wchodzi pod różę dalej niż pierścień: koniec rurki kończyć na `r` róży (dziś rurka idzie do środka pada,
  a w makiecie ślad trasy w środku róży przecina pasy — `routeStubs()` w `common.js` dorysowuje go tylko dlatego, że
  medalion został wymazany). Prościej: róża rysowana **nad** trasą (kolejność niżej) i wnętrze róży (do `r`) ma
  półprzezroczyste tuszowe wypełnienie α ≈ 0,35, które przygasza trasę pod pasami.
- `src/render/routePreview.ts` (linia podczas przeciągania): kolory wierzchołków z tej samej palety (kreda / złoto),
  stan „nie można” bez czerwieni zatoru (np. `DIM`).
- Pasy z numerem tras (wzornik 13, wariant B) **nie** wchodzą — to nie jest C.

**Szacunek:** 0,25 nocy.

## R4. Samoloty

Makieta pokazuje dzisiejsze samoloty. Potrzebne:
- Tuszowy obrys samolotów (G9b: samoloty 1,4–3,0 < 4,5): instancjonowane „napompowane” tylne ściany jak obrys tras,
  +1 wywołanie rysowania na typ (`src/render/models/planes.ts`, `createInstancedPlaneModel`; `src/render/planes.ts`).
- Kolory: kadłub kreda `INK`; pasek obciążenia (`planes.ts` `LOADED #f7f3ea` → `INK`, `EMPTY #6b7f7a` → `DIM` na
  tuszu, `CRITICAL #c8352a` → **nie** cynober zatoru, tylko kreda w pełni + brak koloru: pełny samolot czyta się
  długością paska). Smugi (`trailMaterial #fffaf0`) → `INK`.
- Kolejność: samoloty **nad** różami (lądujący samolot zasłania kreski na chwilę; róża nie może przykrywać samolotu).

**Szacunek:** 0,5 nocy.

## R5. Niebo

`DIORAMA_SKY = '#8CC3D8'` (`src/render/world.ts`, `scene.background`). Makiety C **zostawiają** jasne niebo i na
nim UI używa **ciemnego** tuszu (napisy „Tydzień 1”, pauza, dok w poziomie — `inks(true)` w `c.js`). Dlatego:
- **W tym kroku nie zmieniać koloru nieba.** Ciemne niebo z DIAGNOZY wymagałoby odwrócenia farby HUD po stronie
  Agenta #1 — to osobne pytanie do właścicielki (rekomendacja i zrzuty porównawcze można przygotować, decyzji nie).
- Zrobić jedno źródło prawdy: eksport `SKY_COLOUR` (alias `DIORAMA_SKY` na czas migracji) i `skyIsLight: true` z
  `src/render/index.ts`, żeby nakładka wybierała farbę z renderu, a nie z własnej kopii heksa.
- Poświata atmosfery przy krawędzi tarczy (jasnoniebieski rąbek na makiecie) bez zmian.

**Szacunek:** 0,1 nocy.

## R6. Kolejność rysowania (z-order)

W WebGL, od dołu: globus (teren, ocean, chmury do `r = 1.0048`) → obrys tras → rdzeń tras → **róże** (obwódka i
rdzeń w jednym shaderze, wnętrze α 0,35) → cień samolotu → samoloty z obrysem → duchy tras za horyzontem
(`renderOrder = 100`, jak dziś). Nad canvasem: nakładka DOM/SVG Agenta #1 (nazwy po łuku, notki, glify, HUD) —
`src/ui/overlay.css` `z-index: 2`, `pointer-events: none` poza celami dotyku. Róża nie ma przezroczystego tła poza
`r + zasięg kresek` (nie zasłania sąsiednich tras/samolotów w gęstej sieci).

## R7. API dla nakładki (projekcja, rozmiar, trafienie)

Dziś nakładka rzutuje kotwice przez `project(lon, lat, altitude, out)` na wysokości 1,045/1,075
(`src/ui/overlay.ts`), a `pick()` łapie lotnisko w promieniu `CITY_PICK_RADIUS_DP = 28`. Dla Róży nakładka musi
znać **promień róży na ekranie**, żeby postawić nazwę po łuku (`R = r + 11` zwykłe, `r + 13` hub, `r + 22` przy
zatorze — `marker()` w `c.js`) i notkę obok.
- **R7a (od razu, w pierwszym PR):** eksport stałych `ROSE_SIZE_PX = { regular: { r: 11, outer: 17 }, hub: { r: 16,
  outer: 23 }, jamArc: 14, landscapeScale: 0.92 }` z `src/render/index.ts` — Agent #1 może pracować na nich, zanim
  wejdzie R7b.
- **R7b:** `projectAirport(id: string, out: AirportScreen): AirportScreen | null` w `WorldRenderer`:
  `{ x, y, radius, outer, squash, angle, visible }` w px CSS — środek róży, promień pierścienia i zasięg kresek po
  bieżącej skali, `squash` (stosunek osi elipsy 0–1 przy krawędzi tarczy) i `angle` (kierunek dłuższej osi), żeby
  napis po łuku mógł się spłaszczyć razem z różą. Bez alokacji (jak `project`).
- **Trafienie:** `pick()` łapie w promieniu `max(CITY_PICK_RADIUS_DP, outer + 4)` → cel ≥ 48 dp zostaje (średnica
  ≥ 56). Hub z łukiem zatoru (`r + 14 + 3,5` ≈ 34 px) ma odpowiednio większy cel. Kolizje sąsiednich róż:
  najbliższy środek wygrywa (jak dziś).
- `src/game/dev/stubWorld.ts` (świat bez WebGL, D-254) dostaje `projectAirport` przez `project()` i stałe.

**Szacunek:** 0,25 nocy.

## R8. Testy, zrzuty, sonda

Patrz kryteria niżej; regeneracja `store:shots`, `ui:matrix`, `shots airports airports-zoom`, `shots:34`, pomiar sondy
na Satelicie i Mapie, `perf:scene`. **Szacunek:** 0,5–1 noc (w większości czas maszyny).

## Razem

| | Szacunek |
|---|---|
| R1 róża + API + okablowanie | 1–1,5 nocy |
| R2 kontrast | w R1/R8 |
| R3 trasy | 0,25 |
| R4 samoloty | 0,5 |
| R5 niebo (token, bez zmiany koloru) | 0,1 |
| R7 projekcja/trafienie | 0,25 |
| R8 testy i zrzuty | 0,5–1 |
| **Razem** | **≈ 2,5–3,5 nocy** (KARTA-V2 zakładała 2–3) |

Proponowany podział na PR-y: **G10a** `ext/03-g10a-roza-airports` (R1, R2, R7a, R7b, okablowanie) → **G10b**
`ext/03-g10b-roza-routes-planes` (R3, R4, R5) → zrzuty/sklep w G10b albo osobno (`ext/03-g10c-roza-shots`).

## Kryteria odbioru i testy

| # | Kryterium | Jak sprawdzić |
|---|---|---|
| A1 | Róża zamiast Medalionu na grze, w menu i w świecie DEV; hub = podwójny pierścień + trzy pasy, zwykłe = jeden pierścień + jeden pas | `npm run shots -- airports airports-zoom` (`docs/shots/06/`), `npm run shots -- globe-menu`, porównanie z `c/game-p.png`, `c/game-l.png`, `c/menu-p.png` |
| A2 | Kreski = miejsca w poczekalni dla **każdego** lotniska; `roseTicks()` zgodne z regułą `k = ceil(cap / maxTicks)` (24 → 12, 36 → 18, 48 → 24) | `npm run test:render-layers` (nowe przypadki: liczba kresek, zapalone, połówka, zmiana zajętości bez przebudowy geometrii, `clear()`) |
| A3 | Zator: róża w cynobrze + łuk `jamTicksLeft / CONGESTION_GRACE_TICKS`, maleje płynnie; poza zatorem cynobru nie ma nigdzie w renderze | `test:render-layers` (stan instancji), `npm run test:e2e:smoke` (dochodzi do zatoru), zrzut zatoru jak `c/jam.png` |
| A4 | Nocna cisza nadal widoczna (nowy znak), `curfewDrawn()` liczy poprawnie | `node e2e/curfew-barrier.mjs`, `test:render-layers` |
| A5 | D-47: trasy, lotniska, samoloty ≥ 4,5:1 w scenach `game` i `night`, Satelita **i** Mapa | `npm run test:store-shots` (bramka `checkWarmth`), `node dev/globe-look/shots.mjs --looks=satellite,map --sizes=phone --play=300` (sonda D-177), `npm run shots:34` (noc) |
| A6 | Cel dotyku lotniska ≥ 48 dp, trafienie najbliższej róży | `node e2e/new-airport.mjs`, `node e2e/airport-plates.mjs`, `node e2e/edge-chip-airports.mjs`, `npm run test:route-tool` |
| A7 | `projectAirport` zgadza się z narysowaną różą (± 1 px środek, ± 1 px promień) na pionie, poziomie i Fold | nowy przypadek w `test:render-layers` (czysta matematyka kamery) + `npm run ui:matrix` (nazwy po łuku Agenta #1 trafiają w pierścień) |
| A8 | Wywołania rysowania nie rosną (róża 1 zamiast ~15; obrys samolotów +1–2), budżet ≤ 50 | `npm run perf:scene` (`.perf/scene.json`), `world.stats().drawCalls`, `docs/PERFORMANCE.md` |
| A9 | Brak zmian w `src/ui/**`; render nie importuje UI | `git diff --stat origin/dev -- src/ui` pusty, `npm run test:arch` |
| A10 | Bramka całości | `npm run test:fast` (z `typecheck`, `test:render-layers`, `test:quality`, `test:daynight`, `test:session-stub`, `test:doc-ids`), `npm run build`; przy zmianie wyglądu jak w G2/G3: `npm run test:e2e:smoke`, `npm run ui:matrix`, `npm run store:shots -- --validate` |
| A11 | Samokontrola PNG z listą zakazów CLAUDE.md (brak neonu, gradientów, „pinezek Google”, wyglądu mapy metra) | każdy nowy PNG obejrzany przed commitem |

## Decyzje

Z zakresu ext D-160…D-179 wolne są tylko **D-167, D-168, D-169** (zajęte: D-160–D-166, D-170–D-179; sprawdzone na
`origin/dev` i wszystkich `origin/ext/*` 2026-11-05). `test:doc-ids` wymaga rosnącej kolejności, więc wpisy idą po
D-166, przed D-170. Proponowane:
- **D-167** — Lotnisko = róża rysowana w renderze (instancjonowany kwadrat z shaderem SDF, stały rozmiar na ekranie),
  zastępuje Medalion D-178; nakładka rysuje tylko napisy.
- **D-168** — Kreska róży = `ceil(cap / maxTicks)` miejsc (12 zwykłe / 24 hub), łuk odliczania zatoru, kreskowany
  pierścień nocnej ciszy, cynober tylko dla zatoru.
- **D-169** — `projectAirport` i `ROSE_SIZE_PX` jako kontrakt render → nakładka; paleta Róży dla tras i samolotów.

Jeśli zabraknie numerów, kolejny wolny numer **powyżej** najwyższego w `docs/DECISIONS.md` w chwili scalania (dopisany
na końcu) i informacja w PR. Sam wybór wariantu C zapisuje sesja UI (Agent #1), nie ext.

## Ryzyka

- **Skrót perspektywy przy krawędzi tarczy**: róża leżąca na globusie staje się elipsą; jeśli przy krawędzi kreski
  się zlewają, dodać uniform „podnieś ku kamerze” (mieszanie z billboardem powyżej ~60° od środka widoku) — za flagą,
  decyzja po zrzutach.
- **Gęsta sieć (Europa przy małym zoomie)**: róże 17–23 px nachodzą na siebie; kolizje napisów rozwiązuje Agent #1,
  ale zachodzenie samych róż — próg zoomu, poniżej którego zwykłe lotniska tracą kreski wolnych miejsc (zostają
  zajęte).
- **Wspólne pliki** `src/game/session.ts` / `src/game/world.ts`: zmieniać tylko linie wywołań renderu; Agent #1 też
  może tam sięgać — wspomnieć w PR i zrobić rebase na świeży `dev` przed scaleniem.
- **Zrzuty bazowe**: zmiana znaczników zmienia piksele wszystkich zrzutów z prawdziwym globusem (`docs/shots/matrix/`,
  `docs/store/shots/`) — regenerować razem, w jednym PR (jak G6).

## Prompt startowy dla sesji ext

Ten sam tekst leży w `docs/notes/roza-ext-prompt.md`.

```text
Jesteś sesją ext gry Airway (repo woogitsugames/airway). Odpowiadasz za globus 3D: `src/render/**` (znaczniki lotnisk,
trasy, samoloty, niebo). Z właścicielką rozmawiasz po polsku; kod, komentarze i commity po angielsku; PR i raport po
polsku. Przeczytaj najpierw CLAUDE.md, docs/ARCHITECTURE.md, docs/TESTING.md.

KONTEKST
Właścicielka wybrała wariant UI C „Róża” (docs/styles/ui-2026-11/KARTA-V2.md; makiety
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
   z src/render/index.ts. Ciemne niebo = osobne pytanie do właścicielki (możesz przygotować zrzuty, nie decyduj).
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
- Draft PR do dev po polsku po implementacji i testach; nie scalaj (scala tylko właścicielka); nigdy nie pchaj na dev
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
