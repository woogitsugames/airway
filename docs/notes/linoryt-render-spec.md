# Linoryt w renderze: specyfikacja dla sesji ext (globus)

Night 28a, 2026-11-07, dla sesji ext (właściciel `src/render/**`, `dev/`). Właściciel wybrał kierunek **A „Linoryt”**
(D-283): świat i UI to jeden druk z linoleum w trzech farbach na papierze. Plan etapów i podział pracy:
`docs/styles/kierunki-2026-11b/PLAN-LINORYT.md` (kroki ext: **E1, E2, E3, E4**). Prompt startowy:
`docs/notes/linoryt-ext-prompt.md`. Liczby w px to px CSS przy zoomie rozgrywki (gra otwiera się na ~2×), kadry
referencyjne 1080×1920 = 360×640 CSS × 3.

## Źródła

| Co | Plik |
|---|---|
| Opis kierunku, ryzyka, referencje | `docs/styles/kierunki-2026-11b/KIERUNKI.md` (sekcja A), `RESEARCH.md` |
| Kadry | `docs/styles/kierunki-2026-11b/png/a-game.png`, `a-menu.png` |
| Kod kadrów (globus liczony piksel po pikselu z danych gry) | `docs/styles/kierunki-2026-11b/src/dir-a.js` (`shade`, `sky`, `airport`, `plane`), `globe.js`, `icons.js` (`ICON`: sylwetki samolotów, hub) |
| UI po stronie agenta (podgląd `?skin=linoryt`) | `src/ui/skin/linoryt.{ts,css}`, zrzuty `docs/shots/28a/` |
| Decyzje | D-283 (wybór), D-284 (strategia podglądu, czerwień UI), D-08 (glify), D-47/D-177 (kontrast), D-73 (presety), D-172 (Satelita/Mapa — do usunięcia) |

## 1. Farby (jedno źródło: `LINORYT_INKS` w `src/render/globe/linoryt.ts`, eksport z `src/render/index.ts`)

| Farba | Hex (sRGB) | Gdzie |
|---|---|---|
| papier | `#ECE3CC` | niebo (tło sceny), wycięte linie morza, wnętrze tras, wycięcia w stemplach, obrys samolotów, punkty świateł miast nocą |
| atrament | `#1E1C1F` | linia brzegu, kreskowanie rzeźby i nocy, brzeg tarczy, stemple, zewnętrzna linia tras, samoloty |
| pruski błękit | `#2B4A66` | blok morza, trzy linie atmosfery na niebie |
| ochra | `#D29C47` | blok lądu |
| czerwień | `#B33823` | **tylko zator** (strefa, łuk, stempel huba w zatorze). Ta sama wartość co w UI (D-284: ciemniejsza od `#C8412A` z kadru, bo UI ma papierowe litery 13 px na czerwonym bloku, 4,7:1) |

Żadnych innych kolorów w świecie poza glifami D-08 (te są w DOM). Bez gradientów, poświaty i przezroczystych powłok
(chmury, ocean, mgiełka: wyłączone w tym wyglądzie). Wartości liniowe w shaderze = konwersja sRGB→linear tych hexów;
wyjście przez `linearToOutputTexel`, bez tone mappingu (kolory mają wyjść 1:1, sprawdź pikselem w zrzucie ±2).

## 2. Morze

- Blok błękitu. **Linie wycięte papierem** wzdłuż równoleżników (stała szerokość geograficzna = linia), w przestrzeni
  lat/lon, więc nie pływają przy obrocie.
- **Odstęp linii na ekranie 4–8 px CSS**: dwie oktawy (okres w stopniach `p0 = 0,5° / 2^k` i `p0 / 2^(k+1)`), `k`
  dobrane z bieżącego zoomu tak, żeby okres ekranowy drobniejszej oktawy był ≥ 4 px; waga przenikania liniowa w
  log2(okres ekranowy) między 4 a 8 px (wagi sumują się do 1).
- **Grubość linii** zależy od światła (kulistość z samej linii): `w = mix(0,8, 2,2) px` od strony nocnej/odwróconej do
  punktu podsłonecznego (cos kąta do słońca 0→1), minimum **1,5 px urządzenia** (antyaliasing przez `fwidth`, nigdy
  cieńsza; przy DPR 1 to 1,5 px CSS).
- **Water-lining**: trzy linie papieru równoległe do brzegu w odległości 0,35°, 0,8°, 1,4° od lądu (przy zoomie 1;
  skaluje się z oktawą), grubość 1,5 px, z tekstury odległości od brzegu (nowa `public/data/globe/coast-2048.png`,
  8 bit, 2048×1024 equirect, odległość 0…3° zakodowana liniowo, generowana z `world-atlas` 50m przez nowy
  `scripts/build-coast.mjs`, ≤ 350 kB). Poza 1,6° od brzegu tylko linie równoleżnikowe.
- Morze śródlądowe i jeziora z maski lądu jak dziś.

## 3. Ląd, rzeźba, brzeg

- Blok ochry. **Kreskowanie rzeźby** atramentem: linie pod kątem **+45°** (z SW na NE w lokalnym układzie stycznym
  wschód/północ), okres ekranowy 4–7 px (dwie oktawy jak morze), **tylko na stokach odwróconych od światła z NW**
  (Imhof, azymut 315°, wysokość 45°): pokrycie = `smoothstep(0,15, 0,6, 1 − hillshade)`; grubość rośnie z cieniem
  0,9 → 2,4 px; minimum 1,5 px urządzenia jak wyżej. Hillshade z `elevation-2048.png` (jak dziś) wygładzony 3×3, żeby
  nie było „plam moro”.
- **Linia brzegu** atramentem **1,5 px CSS** (stała na ekranie, `fwidth` maski lądu), przy zoomie ≥ 3 do 2 px.
- Granice państw: brak (nie ma ich w kadrze; to mapa sieci, nie polityczna).

## 4. Niebo, brzeg tarczy, noc

- **Niebo = papier `#ECE3CC`** (zamiast `DIORAMA_SKY`/`#8CC3D8`): HUD i dok w UI mają papierowe marginesy, które mają
  się zlać z niebem. Eksport `SKY_COLOUR` z `src/render/index.ts`.
- **Brzeg tarczy**: atramentowy pierścień 2,5 px tuż przy limbie; **trzy linie atmosfery** w błękicie, 0,7 / 1,6 /
  2,8 % promienia od limbu, grubości 1,2 / 0,9 / 0,7 px (kod: `sky()` w `dir-a.js`). Rysowane w przebiegu nieba
  (shader tła albo jeden pierścień-mesh): ≤ +1 wywołanie rysowania.
- **Noc = gęstość kreskowania**, nie ciemna plama: druga warstwa kresek atramentem pod kątem **−45°** (krzyżuje się z
  rzeźbą), pokrycie 0 na terminatorze (wysokość słońca 0°) → pełne przy −12°; grubość 1,0 → 2,0 px; na morzu ta sama
  warstwa (na błękicie atrament), więc noc czyta się jako „cisza” na całej kuli. Ten sam punkt podsłoneczny co dziś
  (`setSun`). Światła miast: papierowe kropki 2 px wycięte z kreskowania nocy (bez poświaty), tylko w nocy.
- Zmierzch bez koloru (bez pomarańczu): sama gęstość.

## 5. Stemple lotnisk (E2)

| Typ | Kształt (px CSS, stałe na ekranie) | Opis |
|---|---|---|
| zwykłe | kwadrat 22 × 22 | atrament, wycięty papierem pas (skos 45°, 4 px szeroki, 70 % przekątnej) |
| hub | ośmiokąt opisany na kole r = 15 | atrament, trzy wycięte pasy (0°, 60°, 120°, 3,5 px) — „gwiazdka” z kadru |
| zamknięte nocą (D-? cisza nocna) | ten sam kształt, **sam kontur** 2,5 px | kształt mówi „nie lata”; bez koloru |
| zator | hub/zwykłe w **czerwieni** + strefa (niżej) | jedyna czerwień w świecie |
| nowe | jak zwykłe | „NOWE” rysuje UI obok |

Obrys papierem 2 px wokół każdego stempla (oddziela od ochry i tras). Jeden `InstancedMesh` (kwadrat styczny do
kuli, rozmiar przeliczany na px ekranu w vertex shaderze), SDF kształtów w fragment shaderze, AA przez `fwidth`.
Chowanie za horyzontem i skalowanie jak dziś. `pick()` łapie w `max(28, half + 6)` px (cel ≥ 48 dp).

**Zator**: koło zakreskowane czerwienią (kreski 45°, okres 6 px, 2 px) o promieniu **3 × połowa stempla** (48 px dla
huba), czerwony okrąg 3 px na jego brzegu i **łuk odliczania** 6 px na zewnątrz (od godziny 12 zgodnie z ruchem
wskazówek, długość = pozostała część karencji `jamTicksLeft / CONGESTION_GRACE_TICKS`). Bez pulsowania skalą; przy
`reduce motion` łuk skacze co sekundę gry, bez animacji. Ten sam przebieg SDF co stemple (≤ +1 wywołanie).

## 6. Trasy

- **Podwójna linia**: zewnętrzna atramentowa 5 px, rdzeń papierowy 2 px (szerokokadłubowy: 6,5 / 2,5 px), stałe na
  ekranie, końce zaokrąglone. Turbośmigłowy vs szerokokadłubowy różnią się grubością **i** sylwetką samolotu; bez
  koloru.
- **Trasa rysowana palcem** (`routePreview.ts`): sam atrament 3 px przerywany 5/4 px, bez rdzenia, bez czerwieni.
- Nowa trasa „odbija się” od początku do końca w 200 ms (przy reduce motion od razu).
- Dziś trasy to rury 3D z obrysem tylnych ścian; w Linorycie płaska wstęga ekranowa (jeden mesh na partię typu)
  jest tańsza i ostrzejsza. Liczba wywołań ≤ dzisiejszej (2).

## 7. Samoloty

- **Wycięte sylwetki** atramentem z obrysem papieru 1,5 px: turbośmigłowy (prosty płat, dwa silniki) 22 px,
  szerokokadłubowy (skośne skrzydło, cztery silniki) 26 px; ścieżki: `ICON.prop`, `ICON.jet` z
  `docs/styles/kierunki-2026-11b/src/icons.js` (te same co symbole doku w `src/ui/skin/linoryt.ts`).
- Instancjonowane sprite'y z jednego atlasu SDF (2 kształty × 128 px, mipmapy), obrót wzdłuż kursu, bez bujania.
- Obciążenie: kreska 2 px pod sylwetką (atrament, długość = load/capacity × 18 px); bez czerwieni.

## 8. Czego UI oczekuje od renderu (API)

| API | Krok | Opis |
|---|---|---|
| `LINORYT_INKS`, `SKY_COLOUR` z `src/render/index.ts` | E1 | farby jak §1; UI sprawdza w teście, że tokeny skórki = te wartości |
| `?look=linoryt` (DEV) + `setLook`/opcja `look: 'linoryt'` | E1 | UI w podglądzie `?skin=linoryt` włącza ten wygląd (jedna linia w `src/game/world.ts` — robi agent w U2, jeśli ext tego nie zrobi) |
| `STAMP_SIZE_PX = { airport: 22, hub: 30 }` | E2 | fallback dla układu notek zanim jest `projectAirport` |
| `WorldRenderer.projectAirport(id, out)` → `{ x, y, half, visible }` bez alokacji | E2 | środek stempla i połowa boku na ekranie (dla notek: przeszkoda + miejsce „przy swoim lotnisku”, D-263/D-264) |
| `setHubLoad` z `jam01` (udział karencji) dla wszystkich lotnisk | E2 | strefa i łuk zatoru w świecie; tekst „Zator za 0:42” robi UI |
| `DEFAULT_GLOBE_LOOK` | E3 | stała, którą flip (U5, agent) przełącza na `'linoryt'` |
| `getScreenDisc()` (jest) | — | kadrowanie menu |

Stub świata (`src/game/dev/stubWorld.ts`): `projectAirport` przez `project`, `half` = `STAMP_SIZE_PX`/2.

## 9. Wydajność i migotanie (E1/E2)

- Wywołania rysowania ≤ 50 na każdym presecie (dziś 41–47); E1 bez dodatkowych (zastępuje materiał terenu), E2
  netto ≤ 0. Trójkąty terenu bez zmian (low/saver ≤ 35 k). Przezroczyste pełnoekranowe warstwy low/saver ≤ 1.
- Fragment shader ≤ 2 pobrania tekstur (maska lądu z odległością od brzegu w jednym kanale + wysokość), ≤ 6 par
  `smoothstep`/`fwidth`; `saver`: tylko jedna oktawa i bez kreskowania rzeźby (pełne pola ochry/błękitu + linie
  brzegowe + noc).
- **Sprawdzalne:** `npm run test:hatch-alias` (nowy, szybki, w `test:fast`: dla DPR 1/1,5/2 i zoomu 1…4 co 0,25 okres
  ekranowy każdej oktawy ≥ 3 px urządzenia, wagi przenikania sumują się do 1, grubość ≥ 1,5 px urządzenia);
  `npm run shots -- linoryt-motion` (8 klatek SwiftShader, obrót 0,15°/klatkę; wskaźnik migotania = odsetek pikseli w
  kafelkach bez krawędzi, których luminancja zmienia się o > 25 % między klatkami; budżet ≤ 2 %); `npm run perf:scene`
  (low/saver/medium, wpis w `docs/PERFORMANCE.md`; nie porównywać z urządzeniami); przed flipem jedno przejście
  Test Lab game loop (D-245) na budżetowym telefonie.

## 10. Kryteria odbioru (ext)

| # | Kryterium | Jak sprawdzić |
|---|---|---|
| L1 | Globus `?look=linoryt` jak `a-game.png`/`a-menu.png` (technika, farby ±2 w sRGB) | `npm run shots -- globe globe-menu` + piksel |
| L2 | Noc gęstnieje za terminatorem, dzień bez kresek nocy | `test:daynight` (nowy przypadek), zrzut terminatora |
| L3 | Migotanie ≤ 2 %, okres ≥ 3 px | `test:hatch-alias`, `shots -- linoryt-motion` |
| L4 | Stemple: zwykłe ≠ hub kształtem, zamknięte = kontur, zator czerwony ze strefą i łukiem | `test:render-layers`, `e2e/airport-plates.mjs`, `e2e/curfew-barrier.mjs` |
| L5 | Brak czerwieni poza zatorem | test pikseli w `test:render-layers` (paleta) |
| L6 | `projectAirport` bez alokacji, zgodny z `pick()` | `test:render-layers` |
| L7 | Wywołania ≤ 50, trójkąty w budżecie, `perf:scene` zapisany | `perf:scene` |
| L8 | Domyślny wygląd bez zmian do U5 | `test:e2e:smoke` (real), `store:shots` nie ruszone |
| L9 | E4: zero odwołań do tekstur zdjęciowych, `dist/` −~1,9 MB | `test:globe-assets` (przepisany), `test:bundle` |
