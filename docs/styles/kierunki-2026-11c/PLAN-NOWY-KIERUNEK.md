# Nowy kierunek: realistyczny globus NASA + UI-A „Lotniskowa tablica i paski lotu” — plan wdrożenia (D-323)

Noc 68a, 2026-11-08. Właściciel odrzucił Linoryt i wybrał (D-323):
- **świat:** realistyczny, oświetlony globus z NASA Blue Marble NG (dzień, K1) i Black Marble 2016 (noc, K2), z reliefem
  ETOPO5, atmosferą i pasem zmierzchu; **dzień i noc to stan gry** (terminator liczony z zegara doby); **domyślna
  prezentacja to noc K2** (menu, ciemny chrom UI, kadry sklepu);
- **UI:** UI-A „Lotniskowa tablica i paski lotu”: tablica split-flap, znaki lotniskowe ICAO/IATA, papierowe paski lotu
  hubów, przydział tygodnia jako wybór paska, raport końca gry jako wydruk z dalekopisu; kroje **Archivo** i **Chivo Mono**.

Źródła: research `RESEARCH-NOWY-KIERUNEK.md` (PR #344), makiety K1/K2 `makiety/` (PR #346: `k1-*.png`, `k2-*.png`,
shader `makiety/src/globe.js`), makiety UI-A `makiety/ui-a/` (PR #347: `ui-a-gra-noc.png`, `ui-a-gra-dzien.png`,
`ui-a-menu.png`, `ui-a-koniec-tygodnia.png`, `ui-a-raport.png`, kod `ui-a/src/ui.{css,js}`). Ten plan zakłada, że
#344, #346 i #347 trafią na `dev` przed pierwszym etapem kodu (są w nich pliki, do których etapy się odwołują).

Podział jak w Linorycie (D-284): **ext** = sesja globusa uruchamiana przez właściciela (`src/render/**`, `dev/`,
`public/data/globe/`), **agent** = nasi agenci (`src/ui/**`, `src/game/**`, `src/i18n/**`, `e2e/`, `scripts/`, natywne
`android/`/`ios/`, dokumenty). **Każdy etap to jeden PR do `dev`, jedna strona.** Etapy ext mają prefiks **R**, etapy
agentów **T**, znak aplikacji **Z**, sklep **U7**.

---

## 1. Strategia: podgląd za flagą DEV, jedno przełączenie, potem usunięcie

1. **Podgląd.** Render: `?look=earth` (tylko DEV). UI: `?skin=board` (tylko DEV; włącza też `?look=earth`, gdy R1
   jest na `dev`). Wydanie składa obie flagi do zera, więc każdy PR przed przełączeniem zostawia `dist/` bez zmian lub
   prawie bez zmian (budżet CSS 129,8 kB, D-297). Linoryt zostaje wydawanym wyglądem aż do przełączenia.
   U5 Linorytu usunął `?skin=` i harness e2e odrzuca `--skin` (D-301): T1 przywraca oba na czas podglądu.
2. **Jedno przełączenie (T6 + R5 tego samego dnia).** UI-A i globus NASA stają się domyślne; skórka Linoryt i jej
   kroje wychodzą w T6, globus Linoryt (materiał, kreskowanie, obiekty druku) w R6.
3. **Usuwanie po przełączeniu** (R6, część T6), gdy nic już nie może wybrać starego wyglądu.

Odrzucone: wydanie UI-A na globusie Linoryt (dwie techniki naraz: dokładnie błąd z D-282); jeden duży PR (nie do
przetestowania, blokuje sklep); globus NASA jako tryb obok Linorytu (D-285 L2: jeden wygląd, mniejszy bundle).

## 2. Co jest DOM, a co światem

Zasada z D-284 zostaje: tekst, i18n, glify D-08 i silnik układu notek (D-262…D-268) to **DOM**; wszystko, co leży na
kuli, chowa się za horyzontem i musi iść za kamerą bez opóźnienia, to **świat (ext)**.

| Element (makieta UI-A) | Gdzie | Uwagi |
| --- | --- | --- |
| Tablica split-flap: zegar, TYDZ., DZIEŃ, PASAŻ., pasek 24 h z godzinami nocnymi, klawisz STOP | **DOM** | `src/ui/flap.ts` (mechanika klapek już jest) |
| Dok: 5 klawiszy (Cofnij, Turbośmigł., Szerokokadł., Hub, Tempo; D-285 L1), wybrany = żółty | **DOM** | ≥ 48 dp, zasięg kciuka |
| Znak lotniska: kod IATA żółty na czarnym z żółtą ramką, kolejka glifów D-08 za znakiem, nazwa miasta pod spodem, NOWE | **DOM** | kody z `airportLabel.ts` (D-68); zakotwiczenie przez `projectAirport` |
| Punkt lotniska na kuli (kropka; hub = pierścień), strefa zatoru i łuk odliczania | **świat** | kształt = typ (D-08/CLAUDE.md) |
| Zator: znak biały na czerwonym „AMM 0:42” | **DOM** | jedna czerwień na ekranie |
| Znak kierunku przy krawędzi „KHI · Karaczi 2 408 km →” (czarne na żółtym) | **DOM** | zastępuje chip krawędzi |
| Nazwy państw i mórz (atlasowe, rozstrzelone) | **DOM** | i18n PL/EN; pozycja z `projectLonLat` (R2) |
| Granice państw | **świat** | wektor Natural Earth na kuli |
| Trasy (obwiednia + rdzeń; szerokokadłubowe ciągłe, turbośmigłowe kropkowane), trasa rysowana (żółta kredka), odległość „973 km” | świat; etykieta odległości DOM | |
| Samoloty (sylwetki 31–38 pt z ciemnym obrysem) | **świat** | własne ikony, typ = kształt |
| Zatoka pasków lotu hubów (kolejka, miejsca, zamknięcie w czerwonym kółku) | **DOM** | zastępuje tablicę hubu |
| Koniec tygodnia (paski do wyboru), raport (wydruk), pauza, menu (tablica odlotów), ustawienia, dziennik, zadania, ranking, samouczek | **DOM** | arkusze |
| Kula: Blue Marble/Black Marble, relief, atmosfera, zmierzch, odblask morza, gwiazdy | **świat** | |

---

## 3. Etapy

Budżety dziś: CSS (wszystkie `dist/**/*.css`) **129,8 kB**, główny JS 1 180 kB surowo / 360 kB gzip, cały `dist/`
**4 300 kB** (`test:bundle`); render na 412×915: wywołania rysowania ≤ 50 na każdym presecie, warstwy przezroczyste na
pełnym ekranie low/saver ≤ 1, medium/high ≤ 2 (`docs/PERFORMANCE.md`). „Zrzuty” = PNG sprawdzone ręcznie z listą zakazów
CLAUDE.md przed commitem. `perf:scene` (SwiftShader) nigdy nie porównujemy z urządzeniami.

### R1 — ext — globus NASA za `?look=earth`: tekstury, terminator, atmosfera, presety
- **Zakres.** Kula z dwiema teksturami równoprostokątnymi (dzień, noc) mieszanymi w jednym shaderze według kąta słońca;
  słońce z istniejącego `SunController` (`src/render/sun.ts`, zegar doby, deklinacja listopadowa D-63), więc terminator
  przesuwa się z czasem gry; pas zmierzchu wąski i fizyczny (bez poświaty), światła miast z Black Marble oddzielone od
  niebieskiego tła nocy (jak w `makiety/src/globe.js`), odblask słońca na morzu, mgiełka przy krawędzi tylko po stronie
  dziennej, cienka powłoka atmosfery (obecny „papierowy” pas nieba Linorytu znika w R6), relief z `elevation-2048.png`
  jako cieniowanie. Własna korekta barw (mniej nasycenia, chłodniejsza głęboka woda), żeby zdjęcie nie wyglądało jak
  tapeta. Miesiąc Blue Marble: **lipiec 2004** (D-176, decyzja właściciela nadal obowiązuje).
- **Tekstury i rozmiar.** `public/data/globe/day-{4096,2048}` i `night-{2048,1024}` (WebP lub JPEG, wybór po pomiarze),
  skrypt wypiekania w `dev/globe-look/` (URL i data pobrania w `docs/ASSETS.md`, sekcja Globe data), `manifest.json`
  (SHA-256, rozmiar, format, 2:1 potęga dwójki). Szacunek: **+1,5–2,3 MB `dist/`** (stary zestaw ważył ok. 1,9 MB);
  APK rośnie o tyle samo. Nie przekraczać budżetu `total` 4 300 kB bez decyzji (jeśli trzeba: nowy D-xx z pomiarem).
  Kafel 500 m/px nad Europą (makieta) tylko jako opcja na high, po pomiarze pamięci.
- **Presety (D-73, D-116).** low/saver: dzień 2048, noc 1024, bez odblasku i powłoki atmosfery (mgiełka w shaderze kuli),
  DPR 1; medium: dzień 4096, noc 2048; high: jak medium + odblask i powłoka. Pamięć GPU: 4096×2048 RGBA ok. 32 MB
  (z mipmapami ok. 43 MB), 2048 ok. 8 MB. Kompresja GPU (KTX2/Basis) tylko jeśli pomiar na urządzeniu tego wymaga
  (transkoder to dodatkowy JS i ryzyko budżetu).
- **Leniwe ładowanie.** Kula startuje z teksturą niskiej rozdzielczości (2048/1024) i podmienia na 4096 po pierwszej
  klatce gry, poza wątkiem rysowania (`ImageBitmap`); shader i tekstury w osobnym leniwym chunku jak Linoryt (D-300);
  utrata kontekstu WebGL obsłużona przez `contextGuard.ts` (ponowne wgranie tekstur).
- **Pliki.** `src/render/globe/` (nowy `earth.ts` + shader, `look.ts`: `GlobeLook = 'linoryt' | 'earth'`, `index.ts`),
  `src/render/sun.ts` (tylko odczyt), `src/render/quality.ts`, `public/data/globe/`, `dev/globe-look/`.
- **Testy.** `test:globe-assets` (manifest z nowymi plikami, limit na plik zamiast 350 kB łącznie, lista „usuniętych”
  tekstur zmieniona: day/night wracają, map/clouds nadal zakazane), `test:render-layers` (shader bez zdjęć w DEV-only
  imporcie, terminator z zegara: pozycja słońca dla 3 godzin), `perf:scene` z `?look=earth` na low/medium/high,
  `test:bundle` (`dist/` bez zmian, bo podgląd to DEV), zrzuty dzień/noc/zmierzch 412×915 i 915×412.
- **Ryzyka.** Pamięć i czas ładowania na tanich telefonach (pomiar na urządzeniu, nie na SwiftShader); „cudza
  fotografia” (D-283) — łagodzi korekta barw i warstwy R2/R3; noc za ciemna przy listopadowej deklinacji i lipcowej
  Ziemi (D-176) — sprawdzić pas zmierzchu z bramką D-63.

### T1 — agent — fundamenty UI-A za `?skin=board`: tokeny, kroje, tablica split-flap, dok
- **Zakres.** Tokeny skórki UI-A w nowym `src/ui/skin/board.css` (emalia, klapki, krem, żółty znaku, czerwień zatoru,
  papier pasków, druk; wartości z `makiety/ui-a/src/ui.css`, ale czerwień i żółty dobrane pod D-47 ≥ 4,5:1 dla tekstu)
  i pomocnicy `src/ui/skin/board.ts` (bez importów w czasie wykonania, jak `linoryt.ts`). Kroje **Archivo** i
  **Chivo Mono** jako podzbiory WOFF2 (łacina + polskie znaki) w `public/fonts/` z licencjami OFL obok i wpisem w
  `docs/ASSETS.md`; do przełączenia poza `dist/` przez `PREVIEW_FONTS` (`scripts/vite-font-files.mjs`). Archivo:
  statyczne instancje zamiast pełnego pliku zmiennego (wdth 62–125 ważyłby ok. 650 kB) — tylko używane szerokości i
  grubości. Brakująca strzałka U+2192 w Chivo Mono: stos `--skin-face-*` z Atkinson/Overpass (jak Besley), `test:glyphs`.
  Górny pas HUD jako tablica split-flap (zegar, TYDZ., DZIEŃ, PASAŻ., pasek 24 h z nocą 20–06 wg D-285 L3, znacznik
  „teraz”), klawisz STOP, dok z 5 klawiszy. Mechanika klapek: `src/ui/flap.ts` (długość komórek z `src/i18n/limits.ts`).
- **Pliki.** `src/ui/skin/board.{ts,css}`, `src/ui/hud/*`, `src/ui/hud.css`, `src/ui/flap.ts`, `src/main.ts` (gałąź
  DEV), `index.html` (bez zmian w wydaniu), `scripts/vite-font-files.mjs`, `e2e/browser.mjs` (`--skin=board`).
- **Testy.** `test:skin-tokens` (kontrakt nowej skórki jak dla Linorytu: zakres `:root[data-skin="board"]`, brak
  literałów), `test:glyphs`, `test:bundle` (wydanie bez zmian), nowy `test:e2e:board:stub` (audyt ekranów jak
  `screen-audit`, z wycięciem i 150 %), `test:e2e:reduce-motion-game:stub` (przy ograniczonym ruchu klapki zmieniają
  się bez animacji, D-88), zrzuty PL/EN 412×915, 915×412, 320×568.
- **Ryzyka.** Polskie słowa dłuższe niż komórki tablicy (limity w `limits.ts`, skrót „PASAŻ.” w obu językach
  sprawdzony); zbyt dużo żółtego (makieta: jedno znaczenie — kierunek albo akcja); klapki migające przy każdej minucie
  gry (zmieniać tylko cyfry, które się zmieniły).

### R2 — ext — mapa na kuli: granice, API rzutowania etykiet
- **Zakres.** Granice państw z Natural Earth (`world-atlas`) jako cienkie półprzezroczyste linie na kuli (jedno
  wywołanie rysowania), wybrzeża bez dodatkowej linii (zdjęcie je pokazuje). Dla DOM: `projectLonLat(lon, lat)` →
  punkt ekranu + widoczność za horyzontem (bez alokacji, jak `projectAirport`), lista punktów etykiet atlasowych (państwa,
  morza) z wagą do chowania przy zoomie.
- **Pliki.** `src/render/globe/borders.ts` (nowy), `src/render/world.ts`, `src/render/index.ts` (Render API),
  `docs/ARCHITECTURE.md` (Render API).
- **Testy.** `test:render-layers` (granice: jedno wywołanie, widoczność za horyzontem), sonda kontrastu D-177 dla granic
  na dniu i nocy, `perf:scene`.
- **Ryzyka.** Migotanie cienkich linii na tanich GPU (grubość w pikselach ekranu, nie w stopniach).

### T2 — agent — znaki lotnisk, znak zatoru, znaki kierunku, nazwy państw i mórz
- **Zakres.** Notka lotniska staje się znakiem ICAO: kod IATA (ustawienie kod/nazwa z D-68 zostaje), kolejka glifów D-08
  za znakiem (jeden glif = jeden pasażer, wiersz na region, jak w makiecie), nazwa miasta pod znakiem, „NOWE”; hub ze
  znakiem huba; zator = znak biały na czerwonym z odliczaniem; chip krawędzi = znak kierunku czarny na żółtym ze strzałką
  (SVG, nie znak fontu). Nazwy państw i mórz jako etykiety atlasowe (rozstrzelone kapitaliki, i18n PL/EN) z `projectLonLat`
  (R2; bez R2 stały zestaw wyłączony). Zachowanie silnika układu notek zostaje (priorytet zator > nowe > hub > zapełnienie,
  notki nie nachodzą na znacznik ani na siebie, D-262…D-268, D-280, D-281); zmienia się tylko geometria i rozmiary.
  Gęstość: przy dużej sieci mniejsze lotniska pokazują sam kod bez kolejki (zoom odsłania resztę).
- **Pliki.** `src/ui/overlay.ts`, `src/ui/overlay-layout.ts`, `src/ui/overlay.css`, `src/ui/airportLabel.ts`,
  `src/ui/glyphs.ts`, `src/ui/skin/board.*`, `src/i18n/{pl,en}.ts` + `limits.ts`.
- **Testy.** `test:note-layout` (te same fixtury, nowe wymiary), `test:e2e:transfer-glyphs:stub`, `test:e2e:edge-dock`,
  `test:e2e:board:stub`, `test:contrast` (znaki na zdjęciu dnia, nocy i zmierzchu: znak ma własne nieprzezroczyste tło,
  więc kontrast tekstu nie zależy od zdjęcia), `test:cvd` (glify na emalii i na papierze pasków), zrzuty.
- **Ryzyka.** Tłok etykiet nad Europą (makieta: Ateny zasłaniają Peloponez); znak zasłania trasy — znak zawsze obok
  punktu, nigdy na nim.

### R3 — ext — obiekty świata: punkty lotnisk, trasy z obwiednią, samoloty, strefa zatoru
- **Zakres.** Punkt lotniska (kropka z ciemnym obrysem; hub = pierścień; godziny ciszy nocnej jako znak kształtem),
  trasy jako wstęga ekranowa z ciemną obwiednią i jasnym rdzeniem (szerokokadłubowe ciągłe, turbośmigłowe kropkowane;
  istniejąca wstęga z D-299 dostaje nowe kolory i wzór), trasa rysowana żółtą „kredką” z kropkami poza zasięgiem,
  samoloty: sylwetki z własnych ikon 31–38 pt z ciemnym obrysem i cieniem na kuli (bez świateł pozycyjnych z poświatą),
  strefa zatoru: czerwony pierścień + łuk odliczania na jasnym obrzeżu. `projectAirport` bez zmian w API.
- **Pliki.** `src/render/linoryt-objects.ts` → `src/render/objects.ts` (nowa nazwa przy okazji), `routes.ts`,
  `planes.ts`, `airports.ts`, `routePreview.ts`, `contrast.ts`.
- **Testy.** `test:render-layers` (kształty, wzory linii, czerwień tylko dla zatoru), sonda D-177 na dniu i nocy (rdzeń
  do obwiedni ≥ 3:1, trasy ≥ 4,5:1 względem tła), `perf:scene`, zrzuty.
- **Ryzyka.** Kontrast tras do świateł miast w nocy (obwiednia w kolorze nocy, jak K2); samoloty giną na zielonym lądzie
  w dzień (ciemny obrys); wywołania rysowania ≤ 50.

### T3 — agent — paski lotu hubów i pasek ATC
- **Zakres.** Zatoka pasków na dole ekranu gry: jeden pasek na hub (kolor uchwytu, kod, nazwa, kolejka glifami, miejsca
  „36/36”, zamknięcie w czerwonym kółku kredką), maks. 2 w pionie, reszta zwinięta; zastępuje tablicę hubu
  (`hubBoard.ts`, długie przytrzymanie zostaje jako otwarcie pełnego paska). Pasek ATC (`atcStrip.ts`: podpowiedzi trasy,
  zasięg, odmowa Cofnij z D-321) jako pasek kontrolera w tym samym języku.
- **Pliki.** `src/ui/hubBoard.{ts,css}`, `src/ui/atcStrip.{ts,css}`, `src/game/hubBoard.ts` (tylko model, bez zmian
  logiki), `src/ui/layout.ts` (wstawki kamery: zatoka to przeszkoda jak dok).
- **Testy.** `test:hub-board`, `test:hud-targets` (≥ 48 dp), `test:render-layers` (wstawki kamery), `test:e2e:hub-board`,
  `test:e2e:text-scale-150`, `test:e2e:pseudo-320`, zrzuty.
- **Ryzyka.** Zatoka zjada wysokość na krótkich telefonach w poziomie (915×412): w poziomie paski idą do prawej kolumny.

### T4 — agent — koniec tygodnia: przydział jako wybór paska
- **Zakres.** Arkusz końca tygodnia: tablica „TYDZ. 1” z liczbami tygodnia, trzy paski do wyboru (Turbośmigłowiec +2,
  Szerokokadłubowiec +1, Hub +1; wybrany w żółtej ramce), główna akcja jako znak kierunku czarny na żółtym („WEŹ
  TURBOŚMIGŁOWCE → Tydzień 2 zaczyna się o 06:00”), kontrakty (slip), wybór lotniska dla huba (`upgrade-pick`, D-322).
  Modele 3D skrzyń nadal nie są rysowane (D-302 (1)). Tablety: powiększony arkusz (D-320).
- **Pliki.** `src/ui/upgrade/{index,cards}.ts`, `upgrade.css`, i18n.
- **Testy.** `test:e2e:gameover-contracts`, `test:e2e:text-scale-150`, `test:e2e:pseudo-320`, `test:class-toggle`,
  `ui:matrix` (podgląd), zrzuty PL/EN.
- **Ryzyka.** Zależny tylko od T1; może iść równolegle z R1–R3.

### T5 — agent — raport (wydruk z dalekopisu), pauza, menu (tablica odlotów) i pozostałe arkusze
- **Zakres.** Raport końca gry jako wydruk: nagłówek, zamknięty hub z pieczątką „ZATOR”, kolejka w chwili zamknięcia
  glifami, liczby z kropkowanymi prowadnicami, tabela tygodni, „REKORD”, akcje „MENU” i „JESZCZE RAZ” (znak kierunku).
  Pieczątka nie może wyglądać jak trop (samoocena #347) — prosty prostokąt z kodem i czasem. Menu: tytuł AIRWAY na
  klapkach, podpis, kula nocą (kadrowanie w R4), lista „ODLOTY · WYBIERZ” (Dziś, Zadania, Dziennik, Ustawienia), główna
  akcja „LOT BEZ KOŃCA” jako żółty znak w zasięgu kciuka. Ustawienia, O grze, Dziennik, Zadania, Ranking, Samouczek,
  ekran nieobsługiwanego urządzenia: ten sam język (emalia, klapki tylko w nagłówkach, papier pasków dla list).
- **Pliki.** `src/ui/gameover/*`, `src/ui/menu/*`, `src/ui/settings/*`, `src/ui/logbook/*`, `src/ui/puzzles/*`,
  `src/ui/leaderboard/*`, `src/ui/tutorial/*`, `src/ui/unsupported.ts`, i18n PL/EN.
- **Testy.** `test:e2e:gameover-*`, `test:e2e:tutorial*`, `test:e2e:smoke`, `ui:matrix` (PL/EN × 4 rozmiary),
  `test:e2e:text-scale-150`, `test:e2e:notch`, zrzuty `npm run shots -- menu gameover ...`.
- **Ryzyka.** Menu jako „tytuł + kula + lista” było słabe w K1/K2 (samoocena #346) — tablica odlotów musi nieść akcent.

### R4 — ext — kadrowanie menu, noc domyślna, wygląd gotowy do wydania (jeszcze nie domyślny)
- **Zakres.** Menu pokazuje nocną stronę z pasem zmierzchu (D-323: domyślnie noc K2), kula obraca się jak dziś (D-62,
  0 przy ograniczonym ruchu), kadrowanie wg pudełka tablicy odlotów z T5 (zastępuje `indexFraming` z D-286). Wygląd
  `earth` dostępny w wydaniu za `DEFAULT_GLOBE_LOOK` (jak E3 Linorytu), tekstury w leniwym chunku.
- **Pliki.** `src/render/camera.ts`, `framing.ts`, `menuNetwork.ts`, `sun.ts` (ustawienie słońca w menu), `look.ts`.
- **Testy.** `test:render-layers` (kadrowanie menu), `perf:scene`, `test:bundle` (budżet `total` z nowymi teksturami).
- **Ryzyka.** „Noc domyślna” w menu a pora gry na starcie biegu — patrz pytanie P1.

### T6 + R5 — agent + ext — przełączenie
- **Agent (T6).** `index.html` ustawia `data-skin="board"`, kolor motywu ciemny (emalia); `current.css` dostaje wartości
  UI-A; `board.css` to plik struktury (inliner `vite-skin-inline.mjs` i pruner `vite-skin-prune.mjs` zostają);
  usuwane: `src/ui/skin/linoryt.{ts,css}`, kroje Besley i Schibsted Grotesk z licencjami (`public/fonts/`, Ustawienia →
  Licencje), `?skin=board` jako flaga (staje się domyślna), `test:e2e:linoryt-contrast` przepisany na
  `test:e2e:board-contrast` (prawdziwe klatki dnia i nocy), `test:e2e:weather-linoryt` → `test:e2e:weather-board`,
  `src/game/menu-clear.ts` `indexFraming` (jeśli R4 go zastąpił). Natywnie: paski systemowe Androida i iOS na ciemnej
  emalii, jasne ikony (`@color/airway_paper` → nowy kolor; `test:android-config`, `test:ios-config` porównują z nowym
  tokenem), ekrany startowe ponownie wyrenderowane. Licencje: wraca „NASA Earth Observatory (Blue Marble, Black Marble)”
  (`licenses.nasaEarth`, PL/EN). i18n: klucze Linorytu przemianowane na neutralne, limity długości.
- **Ext (R5).** `DEFAULT_GLOBE_LOOK = 'earth'`.
- **Budżety.** CSS: pomiar + 3 kB (D-297), nowy D-xx; JS bez zmian albo z decyzją; `dist/` z teksturami w 4 300 kB.
- **Testy.** `test:fast`, `test:ci` (pełny), `skin:pixels` (porównanie z podglądem `?skin=board`), zrzuty wszystkich ekranów.
- **Warunek.** Właściciel widział T1–T5 + R1–R4 na telefonie (podgląd DEV lub APK debug) i zaakceptował.

### R6 — ext — usunięcie globusa Linoryt
- **Zakres.** Usuwane: `src/render/globe/linoryt-globe.ts`, `linoryt.ts` (materiał druku, kreskowanie, pole wybrzeża
  pieczone przy ładowaniu, papierowy pas nieba), stare części `linoryt-objects.ts`, `LINORYT_INKS` w `contrast.ts`,
  przypadki Linorytu w `test:render-layers`, typ `'linoryt'` w `look.ts`; `docs/notes/linoryt-*` dostają adnotację
  „archiwum, zastąpione przez D-323”. **Zostają:** `elevation-2048.png` (relief), maska lądu (`land-mask.ts`, jeśli
  korzysta z niej wybór lotniska lub teren), `test:globe-assets` (z nowym manifestem), sonda D-177.
- **Testy.** `test:ci`; nic w `src/` nie odwołuje się do `linoryt`.

### T7 — agent — dostępność i szlif na wydanym UI-A
- **Zakres.** D-47/D-177: `test:contrast` z parami UI-A (krem na emalii, żółty znak, biały na czerwonym, druk na papierze
  pasków), prawdziwe klatki dnia, nocy i zmierzchu (znaki, etykiety atlasowe na zdjęciu — etykiety bez tła muszą mieć
  obrys i ≥ 4,5:1 na każdym podłożu albo dostają tło); `test:cvd` na emalii i papierze; D-88: klapki bez animacji,
  łuk zatoru nie pulsuje, „teraz” na pasku doby skacze co godzinę gry; skala tekstu 150 % (D-248/D-267), 320 dp,
  wycięcia, poziom, składane i tablety (`ui:matrix`), czytnik ekranu (tablica ma etykietę tekstową, nie odczytuje klapek
  po znaku). Budżet CSS obniżony do pomiaru + ok. 3 kB.
- **Testy.** `test:contrast`, `test:cvd`, `test:e2e:board-contrast`, `test:e2e:reduce-motion*`, `test:e2e:text-scale-150`,
  `test:e2e:pseudo-320`, `test:e2e:notch`, `ui:matrix`, `test:hud-targets`, `test:bundle`.

### Z — agent (+ ext do renderu, jeśli potrzeba) — znak aplikacji i ikony
- **Zakres.** Nowy znak aplikacji wyprowadzony z własnych motywów gry: **hub (pierścień) i glify D-08** albo znak
  lotniskowy z UI-A (żółty kod na czarnym z żółtą ramką) z łukiem trasy; **bez clipartu globusa i bez samolotu z paczki**.
  Szkice D-317 (technika Linorytu) odpadają. 3 warianty 1024×1024 + arkusz z maskami iOS/Android adaptive i rozmiarami
  120–29 px (czytelność przy 48 dp i na tle sklepu), właściciel wybiera; potem `resources/icon.svg`,
  `icon-foreground.svg`, `splash.svg`, ikony `android/` i `ios/`, `brand/wayfinding.svg` (znak słowny z Archivo),
  ikona strony. Ikony w grze (dok, arkusze) zostają własne (`src/ui/hud/icons.ts`), dopasowane grubością linii do Archivo.
- **Kiedy.** Szkice mogą powstać równolegle z T2–T5; pliki wydania dopiero po przełączeniu (T6), przed U7.
- **Testy.** `test:android-config`, `test:ios-config`, zrzuty arkusza.
- **Ryzyko.** „Ikona z paczki” (research §6): rysować z geometrii znaku huba, nie z sylwetek doku.

### U7 — agent (koordynator) — sklep, film, strona (po wdrożeniu)
- `npm run store:shots` (60 PNG; kolejność D-63: noc pierwsza — pasuje do nocy domyślnej), `npm run store:video`
  (D-265, D-269), `npm run site:assets`, `npm run shots:site`; teksty sklepu i strony z `docs/store/copy-review-2026-11.md`
  (D-296), alt-teksty. Dopiero gdy właściciel zobaczył przełączenie na telefonie i Z jest wybrany.

---

## 4. Kolejność i zależności

```
T1 ─┬─────────────► T4 ─┐
    │               T5 ─┤   (T4, T5 zależą tylko od T1)
R1 ─┼─► R2 ─► T2 ───────┤
    └─► R3 ─► T3 ───────┼─► R4 ─► [T6 + R5 przełączenie] ─► R6 ∥ T7 ─► Z (pliki) ─► U7
Z (szkice) ── równolegle od T2 ─────────────────────────────────────────┘
```

1. **T1 ∥ R1** (start równoległy; podgląd UI może jechać na globusie Linoryt, dopóki R1 nie jest na `dev`).
2. **R2 → T2** (etykiety atlasowe potrzebują `projectLonLat`; znaki lotnisk działają na obecnym `projectAirport`).
3. **R3 ∥ T3**, potem **T4, T5** (bez zależności od renderu).
4. **R4** (kadrowanie menu z pudełka tablicy odlotów z T5).
5. **Przełączenie T6 + R5** jednego dnia, po akceptacji właściciela.
6. **R6 ∥ T7**, potem **Z** (pliki wydania), na końcu **U7**.

## 5. Co z kodu Linoryt usunąć, zastąpić, zostawić

| Element | Los | Etap |
| --- | --- | --- |
| `src/ui/skin/linoryt.{ts,css}`, tokeny Linorytu w `current.css` | usunąć / zastąpić UI-A | T6 |
| Kroje Besley, Schibsted Grotesk (+ OFL) | usunąć; Archivo, Chivo Mono w ich miejsce | T1 (podgląd), T6 |
| `src/game/menu-clear.ts` `indexFraming` (D-286) | zastąpić kadrowaniem tablicy odlotów | R4/T6 |
| `test:e2e:linoryt-contrast`, `test:e2e:weather-linoryt` | przepisać na UI-A | T6 |
| `test:skin-tokens` (kontrakt Linorytu) | przepisać na `board` | T1, T6 |
| Globus druku: `linoryt-globe.ts`, `globe/linoryt.ts`, kreskowanie, papierowe niebo | usunąć | R6 |
| `linoryt-objects.ts` (stemple, wstęga, atlas samolotów) | przerobić w R3 (wstęga, atlas sylwetek), reszta usunąć | R3, R6 |
| Paski systemowe papieru (D-305), `@color/airway_paper` | zastąpić ciemną emalią | T6 |
| Szkice znaku D-317 | odrzucić | Z |
| **Glify D-08** (`src/ui/glyphs.ts`, kształt + kolor), `test:cvd`, `test:glyphs` | **zostają** | — |
| **`test:globe-assets`** (manifest, SHA-256, format, limit) | **zostaje**, nowy manifest | R1 |
| `elevation-2048.png` (ETOPO5), maska lądu, Natural Earth | zostają | — |
| `flap.ts`, silnik układu notek, `setClass`, inliner i pruner skórki, budżety, sonda D-177 | zostają | — |

## 6. i18n

Każdy tekst przez i18n PL + EN. Komórki tablicy split-flap mają stałą liczbę znaków: limity w `src/i18n/limits.ts`
(zegar 5, tydzień i dzień 1–3, pasażerowie do 5 cyfr; podpisy klawiszy doku ≤ 10 znaków jak dziś). Skróty („TYDZ.”,
„PASAŻ.”, „ZAMKN.”) po polsku i angielsku z pełną etykietą dla czytnika ekranu. Kody IATA się nie tłumaczą; nazwy miast
i państw — tak (PL/EN). Klucze Linorytu przemianowane na neutralne w T6. Szkic DE (D-306) dostaje nowe klucze po T6.

## 7. Ryzyka całości

1. **Powtórka „AI slop” / „cudza fotografia”** (D-170, D-282): bramka właściciela po T1+R1 (pierwsze zrzuty z gry, nie
   z makiety), po T2+R3 i przed przełączeniem. Każdy zrzut sprawdzony z listą zakazów CLAUDE.md.
2. **Wydajność i pamięć na tanich telefonach**: presety i leniwe ładowanie w R1; pomiar na urządzeniu przed T6.
3. **Rozmiar APK i `dist/`**: +1,5–2,3 MB; budżet `total` 4 300 kB pilnowany przez `test:bundle`.
4. **Gęstość etykiet i znaków** przy dużej sieci nad Europą: chowanie zależne od zoomu (T2).
5. **Kontrast na zdjęciu** (dzień jasny, noc ciemna, zmierzch pośrodku): znaki mają własne nieprzezroczyste tło;
   etykiety atlasowe sprawdzone na trzech podłożach (T7).
6. **Żółty nadużywany**: jedno znaczenie (kierunek albo akcja), sprawdzane w przeglądzie zrzutów.
7. **Budżet CSS** (129,8 kB): podgląd za flagą DEV nie rusza wydania; przełączenie mierzy i ustala nowy budżet (D-297).

## 8. Pytania do właściciela

- **P1. „Domyślnie noc K2” — tylko wygląd czy też pora startu?** Rekomendacja: noc domyślna w menu, w chromie UI i w
  kadrach sklepu; bieg zaczyna się jak dziś (zegar gry bez zmian, terminator idzie z czasem), bo przesunięcie startu na
  wieczór zmienia symulację i bilans (złote hashe, D-13).
- **P2. Miesiąc Blue Marble:** zostaje lipiec (D-176), czy listopad do listopadowego słońca? Rekomendacja: lipiec
  (zielona półkula północna czyta się lepiej; decyzja D-176 już zapadła).
- **P3. Znak aplikacji:** kierunek „hub + glify D-08” czy „znak lotniskowy z kodem”? Rekomendacja: oba jako szkice w Z,
  wybór na arkuszu w rozmiarach 48 dp.
