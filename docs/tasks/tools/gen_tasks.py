# Generates docs/tasks/*.md: one self-contained brief per new agent session.
import os, textwrap, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

REPO = "woogitsugames/airway"
BASE = "dev"

COMMON = """\
## Gdzie pracujesz
- Repozytorium: **`{repo}`** (GitHub). Masz do niego dostęp. **Nie zmieniaj żadnych innych repozytoriów**
  (`woogitsu/commutopia`, `woogitsugames/cebulak-express`, `woogitsugames/Century-war`, `SamsufiPL/Frontier`,
  `SamsufiPL/AirWar` wolno tylko czytać jako wzorce).
- Gałąź bazowa: **`{base}`**. Zrób `git fetch origin {base} && git checkout -b {branch} origin/{base}`.
  {base_note}
- Pracujesz **wyłącznie** na gałęzi **`{branch}`** i tam wypychasz: `git push -u origin {branch}`.
- Na końcu otwórz **draft PR `{branch}` → `{base}`** z tytułem `[{nn}] {title_en}`. **Nie scalaj** PR-a, nie pushuj do `{base}`
  ani do `main`, nie przepisuj historii cudzych gałęzi. Scala właściciel.
- Jeśli przed PR-em `{base}` poszedł do przodu: `git fetch origin {base} && git rebase origin/{base}` (albo merge), rozwiąż
  konflikty tylko w swoich plikach i uruchom testy ponownie.

## Przeczytaj najpierw
1. `CLAUDE.md` — zasady projektu (obowiązują także Ciebie, mimo nazwy pliku).
2. `docs/DECISIONS.md` — decyzje D-xx mają pierwszeństwo przed Twoimi pomysłami.
3. `docs/styles/diorama.md` — wybrany styl świata i interfejsu (D-11). Makiety: `mockups/diorama/png/*.png`,
   kod makiet: `mockups/diorama/scene3d.js` i `mockups/diorama/build.mjs` (wolno z nich przenosić rozwiązania).
4. `docs/RESEARCH.md` (rdzeń gry §3, technika §4, MVP §5) oraz `docs/ARCHITECTURE.md` (powstaje w zleceniu 01).
5. Pliki i repozytoria-wzorce wymienione w treści zadania niżej.

## Zasady stałe
- Gra: **Airway** (airway.games), premium mobile (Android + iOS przez Capacitor 8), TypeScript + three.js + Vite.
  Gracz projektuje sieć tras na globusie, samoloty latają same, pasażerowie przesiadają się w hubach, porażka = zapchany hub.
  To **nie** jest kontrola lotów (ATC).
- Język: kod, komentarze, commity i dokumentacja techniczna **po angielsku**; opis PR-a i raport dla właściciela **po polsku**.
  Każdy tekst widoczny dla gracza przez i18n (`src/i18n/pl.ts` + `src/i18n/en.ts`), nigdy na sztywno.
- Moduły (szczegóły w `docs/ARCHITECTURE.md`): `src/core` (RNG, zegar, format, i18n), `src/sim` (**czysta symulacja: zero
  importów three.js, DOM i Capacitor; zero `Math.sin/cos/exp` w logice — patrz D-13**), `src/data`, `src/render` (three.js),
  `src/ui` (HUD w HTML/CSS/SVG), `src/input`, `src/audio`, `src/platform` (Capacitor), `src/game` (klej, tryby gry).
- Determinizm: ten sam seed + te same polecenia = ten sam wynik. RNG tylko z `src/core/rng.ts`. Stały krok symulacji.
- Wygląd: zakazy z `CLAUDE.md` (bez „AI slop”, bez stylu Mini Metro, bez emoji jako ikon, tylko kroje OFL z `docs/ASSETS.md`).
  Cele dotyku ≥ 48 dp, akcje w zasięgu kciuka, safe-area, pion + poziom + składane (412×915, 915×412, 673×841, 904×1000).
- Zasoby: tylko własne (proceduralne w kodzie) albo CC0, każdy wpis w `docs/ASSETS.md`. Bez binarnych grafik z sieci.
- Wydajność: zero alokacji w pętli klatki, instancjonowanie, mało draw calli, DPR ≤ 2.
- Testy: każdy nowy test na stałym seedzie, kończy się linią `SUMMARY ...` i kodem wyjścia ≠ 0 przy błędzie, ma skrypt
  `npm run test:<nazwa>` i wiersz w `docs/TESTING.md`. Przed pushem zawsze: `npm ci`, `npm run typecheck`, `npm run test:fast`,
  `npm run build`.
- Zrzuty ekranu (jeśli zlecenie dotyczy wyglądu): `npm run shots` → PNG 412×915 i 915×412 w `docs/shots/{nn}/`; obejrzyj je
  sam i porównaj z listą zakazów przed PR-em.
- Pracuj tylko w plikach ze swojej sekcji „Pliki”. W cudzych plikach dopuszczalne są małe, oznaczone zmiany
  (`// [task-{nn}]`), bez przeformatowywania.
- Decyzje właściciela (styl, zakres, model biznesowy, nazwy): nie podejmuj ich sam. Zapisz pytanie w opisie PR-a
  w sekcji „Pytania do właściciela” z rekomendacją i zostaw rozsądny, łatwy do zmiany wariant domyślny.
- Nowe ustalenia techniczne zapisuj jako kolejne D-xx w `docs/DECISIONS.md` (sprawdź ostatni numer po rebase).

## Raport (opis draft PR-a, po polsku)
- Co zrobione (krótko), czego **nie** zrobiono i dlaczego.
- Uruchomione komendy i ich wynik (liczba testów, linie `SUMMARY`). Nie pisz, że coś działa, jeśli tego nie uruchomiłeś.
- Zrzuty (jeśli dotyczy) jako linki do plików w `docs/shots/{nn}/`.
- Znane problemy, ryzyka, „Pytania do właściciela”.
"""

T = []
def task(nn, slug, title, title_en, deps, wave, body, files, accept, tests, base_note=""):
    T.append(dict(nn=nn, slug=slug, title=title, title_en=title_en, deps=deps, wave=wave, body=body, files=files,
                  accept=accept, tests=tests, base_note=base_note))

# ---------------------------------------------------------------- wave 0
task("01", "scaffold", "Szkielet projektu, gałąź `dev`, architektura", "Project scaffold, dev branch, architecture", [], 0,
"""\
Zbuduj fundament, na którym pracuje 29 kolejnych sesji. To zlecenie **zakłada gałąź `dev`**.

1. Jeśli na `origin` nie ma gałęzi `dev`: utwórz ją z `origin/claude/adoring-bell-uoqsxa` (tam jest cały etap 0:
   docs, makiety, decyzje) i wypchnij: `git fetch origin claude/adoring-bell-uoqsxa && git push origin
   origin/claude/adoring-bell-uoqsxa:refs/heads/dev`. To jedyny dozwolony push poza Twoją gałęzią. Jeśli `dev` istnieje —
   nic nie rób z nią.
2. Na swojej gałęzi: Vite 6 + TypeScript (strict) + three.js (przypnij wersję, np. 0.170.x jak w makietach) + Capacitor 8
   (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios` w zależnościach, ale **bez** generowania katalogów `android/` i
   `ios/` — to zlecenia 24 i 25). `capacitor.config.ts` z `appId: "games.airway.app"` (zapisz to jako decyzję do potwierdzenia),
   `appName: "Airway"`, `webDir: "dist"`.
3. Struktura `src/` jak w „Zasady stałe”, z plikami-zalążkami i jednym zdaniem komentarza „po co ten moduł”. `src/main.ts`
   uruchamia pusty ekran z płótnem three.js (pusta scena, kolor nieba z palety Dioramy) — tylko jako dowód, że build działa.
4. i18n: `src/i18n/index.ts` (`t(key, params?)`, wybór języka: zapis w ustawieniach → język urządzenia → `en`), `pl.ts`,
   `en.ts` z kilkoma kluczami. Test `test:i18n`: oba słowniki mają te same klucze, brak pustych wartości.
5. Fonty: przenieś używane w Dioramie kroje OFL (Overpass 400/800, Overpass Mono 700, Atkinson Hyperlegible Next 400/700)
   z `mockups/fonts/` do `public/fonts/` razem z plikami licencji; `src/ui/fonts.css` z `@font-face`.
6. Skrypty npm: `dev`, `build` (`tsc --noEmit && vite build`), `typecheck`, `test:fast` (agregat, na start: typecheck +
   test:i18n + test:arch), `shots` (wyrenderuj stronę gry Playwrightem do PNG — może wykorzystać wzorzec z `mockups/shoot.mjs`;
   Playwright jest w środowisku, nie dodawaj go jako zależności, jeśli to możliwe), `mockups`/`shots:mockups` zachowaj.
7. Test `test:arch`: żaden plik w `src/sim/**` nie importuje `three`, `@capacitor/*`, `src/render`, `src/ui`, `src/input`,
   `src/audio`, `src/platform`, ani nie używa `document`/`window`/`Math.random`/`Date.now`/`Math.sin|cos|tan|exp|pow|atan`.
   Zapisz regułę jako **D-13** w `docs/DECISIONS.md` (uzasadnienie: replay identyczny na iOS i Androidzie — różne silniki JS
   nie gwarantują identycznych wyników funkcji przestępnych; trygonometria tylko w render/input, symulacja dostaje
   prekomputowane liczby całkowite).
8. `docs/ARCHITECTURE.md`: mapa modułów, przepływ danych (input → polecenia → sim → stan → render/ui), zasada poleceń
   (gracz nie modyfikuje stanu bezpośrednio, tylko wysyła `Command`; to daje undo, replay i wyzwanie dnia), pętla
   (stały krok 10 tików/s przy 1×, render z interpolacją), konwencje nazw, gdzie trzymać balans (`src/sim/params.ts`).
9. `docs/TESTING.md` z tabelą testów. Zaktualizuj `CLAUDE.md`: sekcja „Current stage” → „Production (MVP)”, komendy.
   `.gitignore`: `node_modules`, `dist`, `android/app/build`, `ios/App/Pods`, klucze.
""",
"`package.json`, lockfile, `tsconfig*.json`, `vite.config.ts`, `capacitor.config.ts`, `index.html`, `src/**` (zalążki), `public/fonts/**`, `scripts/**`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `CLAUDE.md`, `.gitignore`, `docs/DECISIONS.md` (dopisanie D-13)",
"- `dev` istnieje na origin i zawiera historię etapu 0.\n- `npm ci && npm run typecheck && npm run test:fast && npm run build` przechodzi.\n- `test:arch` łapie celowo dodany zły import (sprawdź i usuń).\n- `npm run dev` pokazuje płótno z kolorem nieba.",
"`test:i18n`, `test:arch`",
base_note="Wyjątek: w tym zleceniu gałąź `dev` może jeszcze nie istnieć — patrz punkt 1. Twoją gałąź zrób z `origin/claude/adoring-bell-uoqsxa`, jeśli `dev` jeszcze nie ma.")

# ---------------------------------------------------------------- wave 1
task("02", "core-sim-kernel", "Rdzeń symulacji: RNG, zegar, polecenia, replay", "Sim kernel: RNG, clock, commands, replay", ["01"], 1,
"""\
1. `src/core/rng.ts`: mulberry32 z **zapisywalnym stanem** (wzorzec: `woogitsu/commutopia` `src/core/noise.ts` klasa `Rng`,
   `woogitsugames/cebulak-express` `src/core/rng.ts` — przepisz, nie kopiuj 1:1), `next/int/range/pick/chance`, `fork(label)`
   dla niezależnych strumieni (popyt, miasta, zdarzenia), `seedFromString`.
2. `src/core/daily.ts`: klucz dnia według daty w strefie `Europe/Warsaw` + seed wyzwania dnia (wzorzec:
   `cebulak-express/src/core/daily.ts`), klucz tygodnia ISO.
3. `src/sim/clock.ts`: stały krok, 1 tik = 1 minuta gry, 1440 tików = doba, 7 dób = tydzień; prędkości 0 / 1× / 2× / 4×
   (tików na sekundę: 0/10/20/40); akumulator czasu rzeczywistego po stronie `src/game`, sim widzi tylko `tick()`.
4. `src/sim/commands.ts`: typy poleceń (`AddRoute`, `ExtendRoute`, `RemoveRoute`, `AssignPlane`, `UnassignPlane`,
   `UpgradeHub`, `ChooseUpgrade`, `SetSpeed`…) — na razie same typy i walidacja pustą funkcją; `Sim.apply(cmd)` z kolejką,
   polecenia wykonywane na granicy tiku. Dziennik poleceń `[tick, cmd]`.
5. `src/sim/state.ts` + `src/sim/sim.ts`: szkielet `Sim` (seed, tick, stan pusty, `snapshot()` / `restore()` jako JSON
   z wersją), `hash()` stanu (np. FNV-1a po kanonicznym JSON) do testów determinizmu.
6. Undo: punkty kontrolne co N tików + powtórzenie poleceń (opis w `docs/research/ux-tech.md` §5). API: `sim.undo()` cofa
   ostatnie polecenie gracza.
7. Liczby: symulacja na liczbach całkowitych lub stałoprzecinkowych tam, gdzie wynik zależy od platformy; brak funkcji
   przestępnych (D-13).
""",
"`src/core/rng.ts`, `src/core/daily.ts`, `src/sim/clock.ts`, `src/sim/commands.ts`, `src/sim/state.ts`, `src/sim/sim.ts`, `src/sim/undo.ts`, `scripts/test-*.ts` (swoje), `docs/TESTING.md` (wiersze)",
"- Ten sam seed + ten sam dziennik → identyczny `hash()` po 50 000 tików (test).\n- `snapshot()` → `restore()` → dalsza symulacja daje ten sam hash co bez zapisu.\n- Undo przywraca dokładny hash sprzed polecenia.\n- `dailyKey` poprawny na granicy północy w Warszawie (testy z kilkoma datami, także zmiana czasu).",
"`test:rng`, `test:sim-kernel`, `test:undo`, `test:daily`")

task("03", "globe-renderer", "Renderer globusa Diorama (produkcyjny)", "Production Diorama globe renderer", ["01"], 1,
"""\
Przenieś globus z makiety (`mockups/diorama/scene3d.js`) do kodu produkcyjnego w `src/render/globe/`, porządnie i wydajnie.

1. Maska lądu z Natural Earth (`world-atlas` land-50m, ISC/PD) — generuj **w czasie budowania** (skrypt Node zapisujący
   teksturę/siatkę do `public/data/` lub `src/data/generated/`), nie w przeglądarce przy każdym starcie. Uzasadnij wybór w D-xx.
2. Siatka: low-poly z płaskim cieniowaniem; **gęstsza przy wybrzeżach** (siatka adaptacyjna albo dwa poziomy), żeby nie było
   postrzępionych zębów z makiety. Biomy jak w makiecie (`biome()`), wysokości gór, płycizna przy brzegu.
3. Dekoracje instancjonowane: drzewa, skały pustynne, chmury z cieniem (seedowane, deterministyczne rozmieszczenie).
4. Słońce = `DirectionalLight` w punkcie podsłonecznym; API `setSun(lon, lat)`. Światła miast po stronie nocnej (shader jak
   w makiecie). Delikatna atmosfera na krawędzi (bez bloomu, bez neonów).
5. Presety jakości (`low/medium/high`): gęstość siatki, liczba drzew/chmur, cienie on/off, DPR 1–2. Wybór automatyczny według
   prostego testu urządzenia + ustawienie ręczne.
6. API modułu: `createGlobe(scene, opts)`, `latLonToVec3`, `vec3ToLatLon`, `pick(screenX, screenY, camera)` → lon/lat albo null.
7. Strona deweloperska `dev/globe.html` (albo tryb `?dev=globe`) z samym globusem i licznikiem FPS/draw calli.
""",
"`src/render/globe/**`, `scripts/build-land.*`, `public/data/**` lub `src/data/generated/**`, `dev/**`, `docs/ASSETS.md` (wpis danych), `docs/DECISIONS.md` (dopisek)",
"- Wygląd zgodny z `mockups/diorama/png/game-p.png` (zrzut porównawczy w `docs/shots/03/`), wybrzeża bez dużych zębów.\n- Preset `medium`: ≤ 60 draw calli dla samego globusa; zgłoś czas klatki w SwiftShader (tylko orientacyjnie) i liczbę trójkątów.\n- `pick()` trafia w Londyn/Lizbonę/Kair z dokładnością < 0,5° (test w przeglądarce lub w Node na samej matematyce).",
"`test:geo-math` (konwersje lon/lat ↔ wektor, pick na sferze)")

task("05", "cities-data", "Dane miast i generator pojawiania się miast", "City dataset and spawner", ["01"], 1,
"""\
1. `src/data/cities.ts`: ~150 prawdziwych miast (nazwa PL + EN przez i18n lub pola `namePl/nameEn`, kod 3-literowy,
   lon/lat, populacja do wag popytu, **region docelowy** z sześciu: `NAM, SAM, EUN, EUS, AFR, ME` — zobacz `mockups/lib/scene.mjs`;
   dodaj brakujące regiony tylko jeśli potrzebne dla Azji/Oceanii i zaproponuj glif w raporcie, bez wymyślania kształtów z
   Mini Metro). Źródło danych: wiedza ogólna / domena publiczna; współrzędne zaokrąglone do 0,1°.
2. `src/data/regions.ts`: region → glif (`chevron, bowtie, crescent, keyhole, fin, bracket` — geometria w
   `mockups/lib/scene.mjs` `GLYPHS`), kolor (palety CVD z `docs/styles/diorama.md`).
3. `src/sim/spawner.ts`: deterministyczny generator pojawiania się miast w trybie bez końca: zaczyna od 3–4 miast w jednym
   rejonie świata (wybór startu z seeda), potem nowe miasta co X godzin gry, preferuje bliskie istniejącej sieci, **minimalny
   odstęp 6°** między miastami (czytelność, `docs/research/ux-tech.md` §1), limit 40 miast w MVP. Odległości liczone
   w symulacji na **prekomputowanej tablicy** odległości (km, liczby całkowite) generowanej skryptem w czasie budowania (D-13).
4. Parametry w `src/sim/params.ts` (sekcja spawner).
""",
"`src/data/cities.ts`, `src/data/regions.ts`, `src/data/generated/distances.*`, `scripts/build-distances.*`, `src/sim/spawner.ts`, `src/sim/params.ts` (sekcja spawner)",
"- Każdy seed daje inny, ale powtarzalny przebieg pojawiania się miast.\n- Nigdy dwa miasta bliżej niż 6°.\n- Tablica odległości zgodna z wielkim kołem (±1 km).",
"`test:cities` (integralność danych, unikalne kody, regiony), `test:spawner` (determinizm, odstępy, limity)")

# ---------------------------------------------------------------- wave 2
task("04", "camera-input", "Kamera i gesty jedną ręką", "Camera and one-handed gestures", ["03"], 2,
"""\
Na podstawie `docs/research/ux-tech.md` §3 i makiety (kamera ukośna z widocznym horyzontem, `tilt` w `scene3d.js`).

1. Kamera orbitalna nad globusem: obrót przeciągnięciem (bezwładność z wygaszaniem, **bez sprężynowania**), zoom 1×–4×
   (pinch + jednoręczny „dwuklik i przeciągnij w pionie”), pochylenie kamery rosnące z zoomem (bliżej = bardziej ukośnie).
   „Delikatne prostowanie północy” po puszczeniu palca. Przycisk/akcja „pokaż całą sieć” (fit).
2. `src/input/gestures.ts`: rozstrzyganie gestów — przeciągnięcie **zaczęte ≤ 28 dp od miasta** = rysowanie trasy (oddaj
   zdarzenie do zlecenia 07 przez zdarzenia/callbacki, sam nie rysuj tras), w innym miejscu = obrót. Długie przytrzymanie
   350 ms = menu kontekstowe (callback). Przytrzymanie przy krawędzi globusa podczas rysowania = powolny obrót w tę stronę.
3. Kamera nie rusza się, kiedy palec jest na ekranie, chyba że to obrót (zasada z raportu).
4. Obsługa myszy i dotyku (Pointer Events), DPR, safe-area nie zasłania środka globusa (offset kamery jak w makiecie).
""",
"`src/render/camera.ts`, `src/input/**`",
"- Na 412×915 da się jedną ręką: obrócić, przybliżyć, oddalić, dojść do każdego miasta Europy.\n- Brak „pływania” kamery podczas rysowania.\n- Testy jednostkowe automatu gestów na zasymulowanych sekwencjach zdarzeń.",
"`test:gestures`")

task("06", "airports-overlay", "Lotniska w świecie i warstwa dymków (przywieszki)", "Airports in world and tag overlay layer", ["03", "05"], 2,
"""\
1. `src/render/airports.ts`: modele lotnisk i hubów jak w makiecie (`airport()` w `scene3d.js`: płyta, pas, terminal, wieża dla
   huba), instancjonowane; ustawianie na powierzchni (`place()`), skala zależna od zoomu w rozsądnych granicach (diorama ma
   przesadzoną skalę). **Pierścień pojemności huba** (segment = miejsce w poczekalni; zajęte pomarańczowe, > 80% czerwone) —
   API `setHubLoad(id, used, cap)`.
2. Szlaban ciszy nocnej (model z makiety) — API `setCurfew(id, on)` (używany później).
3. `src/ui/overlay.ts`: warstwa HTML nad płótnem, która co klatkę rzutuje pozycje lotnisk na ekran i ustawia **przywieszki
   pasażerów** (styl z `mockups/diorama/build.mjs`: `.bubble`, glify SVG regionów, czerwona przy zatorze z odliczaniem).
   Ukrywanie za horyzontem, wygaszanie przy krawędziach, unikanie nakładania (prosty układ: przesuń w górę przy kolizji).
   Bez alokacji DOM w każdej klatce (pula elementów).
4. Znaczniki miast poza ekranem / za horyzontem: strzałka + kod przy krawędzi ekranu (tap = obrót kamery do miasta,
   callback do zlecenia 04). Hub w zatorze za horyzontem pulsuje na czerwono (bez sprężynowania: zmiana krycia).
5. Strona deweloperska z 30 miastami i losowym obciążeniem do sprawdzenia czytelności.
""",
"`src/render/airports.ts`, `src/render/models/**` (modele lotnisk), `src/ui/overlay.ts`, `src/ui/overlay.css`, `src/ui/glyphs.ts`",
"- 30 miast widocznych i czytelnych na 412×915 przy zoomie 1× i 2,5× (zrzuty w `docs/shots/06/`).\n- Przywieszki nie migają, nie skaczą, nie nachodzą na siebie w typowym układzie Europy.\n- Pula DOM: liczba elementów stała po 1 minucie działania (sprawdź licznikiem).",
"`test:overlay-layout` (algorytm unikania kolizji na danych testowych)")

task("08", "sim-passengers-hubs", "Symulacja: popyt, pasażerowie, przesiadki, huby, porażka", "Sim: demand, passengers, transfers, hubs, failure", ["02", "05"], 2,
"""\
Serce gry. Czysty `src/sim` (D-13). Na podstawie `docs/RESEARCH.md` §3 i `docs/research/market.md` §4.

1. Popyt: każde miasto generuje pasażerów do **regionów** (nie do konkretnych miast), wagi z populacji, odległości i pory dnia
   lokalnego (fala popytu o świcie — na razie funkcja z tablicy godzin; terminator wizualny robi zlecenie 11). Strumień RNG `demand`.
2. Sieć: graf tras (z poleceń `AddRoute/ExtendRoute/RemoveRoute`), trasa = lista miast (może mieć międzylądowania).
3. Trasowanie: pasażer wybiera drogę z **najmniejszą liczbą przesiadek** do dowolnego miasta swojego regionu (BFS po grafie
   tras; remis → krótszy dystans z tablicy odległości). Tablica tras przeliczana tylko po zmianie sieci. Pasażer pamięta tylko
   cel i przelicza decyzję w każdym hubie.
4. Hub = miasto, w którym przesiadają się pasażerowie (każde miasto z ≥ 2 trasami). Poczekalnia o pojemności (start 8–12),
   **minimalny czas przesiadki** (start 25 min gry) — pasażer w trakcie MCT nie może wsiąść.
5. Zator: poczekalnia pełna → odliczanie (np. 45 s gry przy 1×, parametr); spadek poniżej limitu zatrzymuje odliczanie;
   koniec odliczania = koniec gry. Zwykłe miasto bez huba też ma limit czekających (mniejszy).
6. **Księga przyczyn** (wzorzec: `woogitsu/commutopia` `src/sim/freight/ledger.ts` i `hub.ts`): liczniki zdarzeń per hub
   i per region (dowiezieni, czekający za długo, brak trasy, poczekalnia pełna…), żeby ekran porażki (zlecenie 15) umiał
   powiedzieć „62% czekających chciało do Ameryki Płn.”.
7. Wynik = liczba dowiezionych pasażerów. Wszystkie stałe w `src/sim/params.ts`.
8. Samoloty jeszcze nie istnieją (zlecenie 09) — zdefiniuj interfejs `boardAt(hub, route, seats)` / `alightAt(...)`, którego
   użyje 09, i przetestuj go sztucznym „teleportem” pasażerów.
""",
"`src/sim/demand.ts`, `src/sim/network.ts`, `src/sim/routing.ts`, `src/sim/hubs.ts`, `src/sim/ledger.ts`, `src/sim/params.ts` (swoje sekcje), `src/sim/sim.ts` (wpięcie, oznaczone `// [task-08]`)",
"- Determinizm (hash) po 7 dobach gry na 3 seedach.\n- Scenariusz testowy „za mało tras” kończy się porażką w przewidywalnym tiku; „wystarczająca sieć” przetrwa tydzień.\n- Trasowanie wybiera minimum przesiadek (testy na małych grafach).\n- Brak funkcji przestępnych w kodzie (test:arch zielony).",
"`test:routing`, `test:hubs`, `test:sim-week`")

task("09", "sim-planes", "Symulacja: samoloty, rozkład, typy, zasięg", "Sim: planes, scheduling, types, range", ["02", "05"], 2,
"""\
1. Typy samolotów w `src/sim/params.ts`: turbośmigłowiec (zasięg 2 500 km, 48 miejsc, wolniejszy), szerokokadłubowiec
   (11 000 km, 300 miejsc, szybszy). Czas lotu odcinka = liczba **całkowitych tików** policzona przy tworzeniu trasy z tablicy
   odległości (D-13).
2. Przydział samolotów do tras (`AssignPlane/UnassignPlane`), zapas samolotów gracza (z ulepszeń — zlecenie 12).
3. Ruch: samolot jeździ tam i z powrotem po liście miast trasy; postój na lotnisku (wysiadanie, wsiadanie, minimalny czas
   obsługi). Odcinek dłuższy niż zasięg typu jest **niedozwolony** (walidacja polecenia) — gracz musi dodać międzylądowanie
   albo użyć szerokokadłubowca. Zwróć powód odrzucenia (`RANGE_EXCEEDED` z dystansem), żeby UI pokazało pasek ATC.
4. Integracja z 08 przez `boardAt/alightAt` (jeśli 08 nie jest jeszcze scalone — zrób adapter i test na atrapie, opisz w PR).
5. Stan samolotu dla renderera: `routeId, segment, progress01 (stałoprzecinkowo), load` — render interpoluje.
""",
"`src/sim/planes.ts`, `src/sim/schedule.ts`, `src/sim/params.ts` (sekcja planes)",
"- Determinizm po 7 dobach.\n- Odrzucenie trasy za długiej dla turbośmigłowca z poprawnym dystansem.\n- Samolot nigdy nie przewozi więcej niż ma miejsc; suma pasażerów zachowana (test bilansu).",
"`test:planes`, `test:schedule`")

# ---------------------------------------------------------------- wave 3
task("07", "route-drawing", "Rysowanie tras palcem", "Route drawing by finger", ["04", "06", "08"], 3,
"""\
1. Przeciągnięcie od miasta (zdarzenie z 04) rysuje podgląd łuku wielkiego koła „na wysokości przelotowej” (wysokość jak
   w makiecie `routeCurve()`), przyciąganie do miast w promieniu **36 dp** (pozycja ekranowa), wiele miast w jednym ruchu =
   trasa z przystankami.
2. Podgląd pokazuje zasięg wybranego typu samolotu: część za zasięgiem jest czerwona + **pasek ATC** (styl `.strip`
   z makiety: „3 788 km · LIS → ACC | za daleko dla turbośmigłowca | wskaż miasto po drodze”), wszystko przez i18n.
3. Puszczenie nad miastem → polecenie `AddRoute` (lub `ExtendRoute`, jeśli zaczęto od końca istniejącej trasy). Uchwyty końców
   tras 48 dp, odsunięte 20 dp za miasto. Usuwanie: długie przytrzymanie trasy → menu (Usuń / Skróć). Cofanie: przycisk
   w doku → `sim.undo()`.
4. Podczas edycji symulacja zwalnia do 0,25× (polecenie `SetSpeed`, przywracane po edycji).
5. Haptyka przy przyciągnięciu i zatwierdzeniu (przez interfejs `src/platform/haptics.ts` — jeśli nie istnieje, zrób
   minimalny zalążek z no-op w przeglądarce).
""",
"`src/input/routeTool.ts`, `src/render/routePreview.ts`, `src/ui/atcStrip.ts` (+css), `src/platform/haptics.ts` (zalążek, jeśli brak)",
"- Da się narysować trasę LON→NYC i LIS→DKR→ACC jedną ręką na 412×915.\n- Trasa za długa dla wybranego typu nie powstaje i pokazuje pasek ATC.\n- Undo cofa ostatnią zmianę sieci.\n- Zrzuty i krótki opis gestów w `docs/shots/07/`.",
"`test:route-tool` (logika przyciągania i budowy polecenia na danych testowych)")

task("10", "render-routes-planes", "Render tras i samolotów", "Render routes and planes", ["03", "09"], 3,
"""\
1. Trasy: szerokokadłubowe = ciągła jasna rurka wyżej (+ smuga za samolotem), turbośmigłowe = przerywana ciepło-żółta niżej
   (jak w makiecie `routes()`), część za horyzontem jako blady ślad. Geometria przeliczana tylko przy zmianie sieci.
   Typ rozróżnialny **kształtem** (ciągła/przerywana, wysoko/nisko), nie tylko kolorem.
2. Samoloty: modele low-poly z makiety (`planeModel()`), instancjonowane osobno dla typów; pozycja/obrót interpolowane między
   tikami z `progress01`; cień na ziemi; krótkie zniżanie przy lądowaniu i wznoszenie przy starcie (liniowe, bez sprężyn).
3. Pasek obciążenia samolotu (miejsca zajęte) widoczny przy zbliżeniu — mała przywieszka lub segmentowany pasek nad kadłubem.
4. Budżet: 100 samolotów + 40 tras na presecie `medium` bez spadków (podaj liczby draw calli).
""",
"`src/render/routes.ts`, `src/render/planes.ts`, `src/render/models/planes.ts`",
"- Zrzut w `docs/shots/10/` zgodny z makietą.\n- 100 samolotów: draw calle i trójkąty w raporcie; zero alokacji w pętli klatki (sprawdź profilerem lub licznikiem).",
"`test:interp` (interpolacja pozycji na łuku, ciągłość przy zmianie odcinka)")

task("11", "day-night", "Dzień i noc: słońce, fale popytu, cisza nocna", "Day/night: sun, demand waves, curfew", ["02", "03"], 3,
"""\
1. Czas gry → punkt podsłoneczny (render liczy trygonometrię, sim tylko tik). Doba = jeden obrót terminatora. Pora roku:
   stała (listopad) w MVP — parametr na później.
2. Sim: lokalna godzina miasta z **prekomputowanej strefy w pełnych godzinach** (z długości geograficznej, liczba całkowita
   w danych miasta) — bez stref czasowych z prawdziwego świata. Fala popytu o świcie i spadek w nocy (tablica 24 wartości
   w `params.ts`), podpięta do popytu z 08.
3. Cisza nocna (modyfikator **wyłączony domyślnie** w MVP, flaga w params): wybrane miasta zamknięte 23–06 lokalnie;
   samoloty nie startują/nie lądują; szlaban z 06 włączony.
4. Render: światła miast rosną na stronie nocnej, delikatna zmiana ekspozycji; terminator płynny (bez skoków przy 4×).
""",
"`src/render/sun.ts`, `src/sim/daynight.ts`, `src/sim/params.ts` (sekcja daynight), dane stref w `src/data/cities.ts` (pole `utcOffsetH`, oznaczone `// [task-11]`)",
"- Terminator przesuwa się płynnie i zgadza z godziną w HUD.\n- Test: popyt o świcie > popyt w nocy dla tego samego miasta.\n- Determinizm zachowany.",
"`test:daynight`")

task("13", "hud", "HUD: karta pokładowa, dok z przywieszek, pion/poziom/składane", "HUD: boarding pass, tag dock, layouts", ["01", "06"], 3,
"""\
Zaimplementuj interfejs z `docs/styles/diorama.md` („Interfejs v2”) i makiet `mockups/diorama/png/game-p.png`, `game-l.png`.

1. Górny pasek = **karta pokładowa** (tydzień, dzień z 7 kwadratami, godzina; odcinek z liczbą pasażerów; pauza jako osobny
   odcinek). CSS z `mockups/diorama/build.mjs` (`.pass`, maska perforacji) przeniesiony do `src/ui/`.
2. Dok = **przywieszki bagażowe na sznurku**: cofnij, turbośmigłowce (liczba), szerokokadłubowce (liczba), rozbudowa huba
   (liczba), prędkość. Biała przywieszka = typ wybrany do rysowania; wyblakła = brak zapasu. Przeciągnięcie przywieszki samolotu
   na trasę = `AssignPlane` (współpraca z 07/09 przez callbacki).
3. Układy: pion (pasek u góry, dok nad wskaźnikiem gestów), poziom (szyna boczna — popraw pionowy sznurek z makiety, który
   wyglądał dziwnie: np. przywieszki wiszą z poziomego drążka u góry szyny), składane ≥ 600 dp (stały panel boczny).
   Safe-area przez `env(safe-area-inset-*)`. Obsługa zmiany rozmiaru bez przeładowania.
4. Komponenty jako czyste funkcje `render(state)` aktualizujące DOM tylko przy zmianie wartości.
5. Wszystkie teksty przez i18n; kroje z `public/fonts`.
""",
"`src/ui/hud/**`, `src/ui/hud.css`, `src/ui/layout.ts`",
"- Zrzuty 412×915, 915×412, 673×841, 904×1000 w `docs/shots/13/`, zgodne z makietą i listą zakazów.\n- Cele dotyku ≥ 48 dp (test mierzący prostokąty elementów w Playwright).\n- Brak przeskoków układu przy obrocie.",
"`test:hud-targets` (Playwright: rozmiary celów dotyku i brak nachodzenia na safe-area)")

# ---------------------------------------------------------------- wave 4
task("12", "weekly-upgrade", "Tydzień i wybór ulepszenia (etykiety frachtowe)", "Weekly cycle and upgrade choice", ["08", "09", "13"], 4,
"""\
1. Sim: koniec tygodnia (7 dób) → pauza i oferta **3 z puli** (turbośmigłowiec, szerokokadłubowiec, rozbudowa huba +6 miejsc
   i MCT 25→15 min, +2 sloty startów — slot = limit odlotów z miasta na godzinę, jeśli wprowadzasz, opisz w D-xx). Losowanie
   ze strumienia RNG `upgrades`, z gwarancją co najmniej jednego samolotu. Polecenie `ChooseUpgrade`.
2. Rozbudowa huba wymaga wskazania huba (tryb wyboru na globusie, podświetlenie hubów).
3. UI: ekran z makiety `mockups/diorama/png/upgrade-p.png` / `upgrade-l.png` — żółty drogowskaz „Tydzień N”, trzy **etykiety
   frachtowe** (papier pakowy, nagłówek „FRACHT · TP-48 · 1/3”, okienko z modelem 3D na postumencie — `renderModel()`
   z makiety, tabela pól, czerwony stempel kontekstu wyliczony z księgi przyczyn, np. „LONDYN 11/12”), ząbkowana krawędź.
4. Animacja wejścia krótka i rzeczowa (przesunięcie 150–200 ms, bez odbicia).
""",
"`src/sim/upgrades.ts`, `src/ui/upgrade/**`, `src/render/modelPreview.ts`",
"- Determinizm ofert dla seeda.\n- Kontekstowy stempel wskazuje najbardziej obciążony hub.\n- Zrzuty w `docs/shots/12/`.",
"`test:upgrades`")

task("14", "menu", "Menu główne: tablica odlotów split-flap", "Main menu: split-flap departure board", ["01", "03"], 4,
"""\
Według `mockups/diorama/png/menu-p.png` / `menu-l.png` i `docs/styles/diorama.md`.

1. Tło: żywy globus (renderer z 03) z kilkoma trasami i samolotami demonstracyjnymi (stała, ładna scena; bez symulacji gry).
2. Tytuł na **żółto-czarnym drogowskazie** z własnym piktogramem samolotu: „Airway”, „AIRWAY.GAMES · TERMINAL 1”.
3. **Tablica odlotów**: wiersze = tryby jako „loty” z bramką i statusem: „LOT BEZ KOŃCA · A1 · WEJŚCIE” (rekord pod spodem),
   „ZADANIA · B4 · PLANOWO” (postęp), „DZIŚ dd.mm · C2 · NOWY” (wyzwanie dnia), „USTAWIENIA · D0”. Wiersze ≥ 58 dp.
   Prawdziwa **animacja klapek** (60–90 ms na znak, kaskada, bez odbicia) przy wejściu na ekran i przy zmianie statusu;
   `prefers-reduced-motion` → bez animacji. Teksty przez i18n (klapki muszą obsłużyć polskie znaki).
4. Ekran ustawień w tym samym języku wizualnym (tablica/karta): język, jakość grafiki, dźwięk/muzyka, haptyka, tryb
   daltonistów (przełącznik — palety robi zlecenie 20), pokaż licencje (lista z `docs/ASSETS.md`).
5. Nawigacja: wstecz (Android back przez interfejs `src/platform/back.ts` — zalążek, jeśli brak).
""",
"`src/ui/menu/**`, `src/ui/settings/**`, `src/ui/flap.ts`, `src/game/screens.ts` (router ekranów), `src/platform/back.ts` (zalążek)",
"- Zrzuty pion/poziom w `docs/shots/14/`.\n- Animacja klapek działa i respektuje reduced-motion.\n- Wszystkie napisy PL i EN.",
"`test:flap` (rozkład znaków, polskie litery, długości)")

task("15", "game-over", "Ekran porażki i raport przyczyn", "Game over and cause report", ["08", "13"], 4,
"""\
1. Przy końcu odliczania: kamera płynnie dolatuje do zapchanego huba (600–800 ms, ease-out, bez odbicia), scena zamiera.
2. Na **tablicy odlotów** loty z tego huba przeskakują na „ODWOŁANY”; wysuwa się pasek ATC / karta z wynikiem, liczbą tygodni
   i **trzema przyczynami** z księgi przyczyn (zlecenie 08), np. „62% czekających chciało do Ameryki Płn. — jedna trasa
   szerokokadłubowa nie wystarczyła”. Generator zdań z kluczy i18n + parametrów (bez sklejania tekstu na sztywno).
3. Przyciski: „Jeszcze raz (ten sam świat)” — ten sam seed, „Nowy świat”, „Menu”. Zapis rekordu lokalnie.
4. Opcjonalnie: krótka powtórka ostatnich 30 s z dziennika poleceń (jeśli proste — jeśli nie, zostaw jako pytanie w PR).
""",
"`src/ui/gameover/**`, `src/game/causes.ts`",
"- Trzy scenariusze testowe dają trzy różne, sensowne zestawy przyczyn.\n- „Ten sam świat” startuje z identycznym hashem początkowym.\n- Zrzuty w `docs/shots/15/`.",
"`test:causes`")

task("16", "save-lifecycle", "Zapis, wczytanie, pauza w tle", "Save/load and app lifecycle", ["02", "08", "09"], 4,
"""\
1. Zapis gry = `snapshot()` + dziennik poleceń + wersja formatu; migracje wersji (wzorzec: wersjonowane zapisy
   `woogitsu/commutopia` `src/game/save.ts`). Magazyn: IndexedDB w przeglądarce, Capacitor Preferences/Filesystem na
   urządzeniu (przez `src/platform/storage.ts`).
2. Autozapis co dobę gry i przy przejściu aplikacji w tło (`@capacitor/app` `pause`), automatyczna pauza i ekran „Wznów”.
3. Ustawienia gracza osobno od zapisu gry. Klucze z prefiksem `aw-`.
4. Odporność: uszkodzony zapis → komunikat i nowa gra, bez wyjątku na starcie.
""",
"`src/game/save.ts`, `src/platform/storage.ts`, `src/platform/lifecycle.ts`",
"- Zapis → zamknięcie → wczytanie daje identyczny hash i dalszy przebieg.\n- Uszkodzony JSON obsłużony.\n- Migracja z wersji testowej v0 do v1.",
"`test:saves`")

task("19", "audio", "Dźwięk: „Rezonujące huby” i efekty", "Audio: resonant hubs and SFX", ["08", "09"], 4,
"""\
Koncepcja w `docs/RESEARCH.md` §4 i `docs/research/ux-tech.md` §6. **Nie** kopiuj podejścia Mini Metro.

1. Silnik na czystym Web Audio (bez Tone.js): każdy hub to rezonator (strojenie z szerokości geograficznej w skali
   pentatonicznej), przylot = uderzenie, przesiadka = szarpnięcie, przeciążenie słychać jako dudnienie (lekko rozstrojone
   drugie źródło) zanim pojawi się zator; noc przyciemnia filtr, świt dodaje akord; nowy tydzień zmienia tonację.
   Planowanie zdarzeń 100–150 ms do przodu.
2. Efekty proceduralne: stuk klapek (menu), szelest papieru (etykiety), przypięcie przywieszki, stempel, dzwonek nowego miasta.
3. Odblokowanie audio przy pierwszym dotyku; iOS: domyślnie respektuj przełącznik wyciszenia (ustawienie, żeby to zmienić);
   głośności muzyki i efektów w ustawieniach (14).
4. Dźwięk sterowany zdarzeniami z sim (subskrypcja, bez wpływu na determinizm).
""",
"`src/audio/**`",
"- Krótkie nagranie lub opis odsłuchu w PR (np. eksport 30 s do WAV skryptem offline, jeśli możliwe).\n- Brak trzasków przy 4× (limit głosów).\n- Wyciszenie działa natychmiast.",
"`test:audio-sched` (planowanie zdarzeń, limit głosów — logika bez AudioContext)")

task("20", "accessibility", "Dostępność: daltoniści, tekst, czytniki, haptyka", "Accessibility: CVD, text, screen readers, haptics", ["06", "13"], 4,
"""\
1. Palety kolorów celów: domyślna (z `docs/styles/diorama.md`, sprawdzona symulacją) + tryb wzmocniony (grubszy kontur glifów,
   większe glify). Skrypt `scripts/check-cvd.*` (port `cvd.py` z opisu w `docs/research/art-direction.md` §3: Machado 2009,
   min. ΔE76 ≥ 15 dla protan/deutan/tritan) jako test.
2. Kontrast tekstu UI ≥ 4,5:1 (test na tokenach kolorów).
3. Skalowanie tekstu (ustawienie 100/115/130%) bez rozjeżdżania HUD.
4. Etykiety ARIA na przyciskach doku/menu; tryb TalkBack/VoiceOver: dotknięcie miasta czyta nazwę, liczbę czekających i stan huba.
5. `src/platform/haptics.ts` na `@capacitor/haptics` (lekki impuls przy przyciągnięciu, mocniejszy przy zatorze), wyłączalne.
""",
"`src/ui/a11y.ts`, `src/ui/theme/**` (tokeny), `scripts/check-cvd.*`, `src/platform/haptics.ts`",
"- `test:cvd` i `test:contrast` zielone.\n- Zrzuty HUD przy 130% tekstu w `docs/shots/20/`.",
"`test:cvd`, `test:contrast`")

# ---------------------------------------------------------------- wave 5
task("17", "puzzle-mode", "Tryb Zadania: 15 zagadek z celem", "Puzzle mode: 15 goal puzzles", ["07", "08", "09", "12"], 5,
"""\
1. Format poziomu (`src/data/puzzles/*.json`): miasta startowe, zapas samolotów/ulepszeń, cel (np. „dowieź 300 pasażerów
   w 3 dni”, „połącz 3 kontynenty bez zatoru”, „przetrwaj 2 noce z ciszą nocną”), limit czasu gry, seed popytu.
2. Nieograniczone cofanie, przycisk „od nowa”, gwiazdki (1–3) za margines.
3. **15 zagadek** w krzywej trudności, każda z rozwiązaniem referencyjnym (lista poleceń) weryfikowanym testem: bez działań
   gracz przegrywa, rozwiązanie referencyjne wygrywa z marginesem ≥ 15% (zasada jak w commutopii: „nierozwiązywalne bez
   zmian, rozwiązywalne podpowiedzianą poprawką”).
4. Ekran wyboru zadań w stylu tablicy odlotów (klapki z 14) i postęp w menu.
""",
"`src/data/puzzles/**`, `src/game/modes/puzzle.ts`, `src/ui/puzzles/**`",
"- `test:puzzles`: wszystkie 15 spełnia regułę wygrana/porażka.\n- Zrzuty wyboru zadań w `docs/shots/17/`.",
"`test:puzzles`")

task("18", "daily-challenge", "Wyzwanie dnia (offline)", "Daily challenge (offline)", ["02", "14", "16"], 5,
"""\
1. Seed dnia z `src/core/daily.ts` (Warszawa), ten sam świat dla wszystkich; jedna „oficjalna” próba dziennie + dowolne
   próby treningowe; zapis najlepszego wyniku i serii dni.
2. Wynik do udostępnienia jako tekst (bez sieci): data, wynik, tygodnie, krótki „bilet” ASCII/emoji-free (np. ciąg glifów
   regionów jako znaków Unicode, które nie są emoji) — `@capacitor/share` przez `src/platform/share.ts`.
3. **Rankingi online są poza zakresem** (Firebase po MVP) — przygotuj interfejs `ScoreService` z implementacją lokalną
   i opisz w PR, jak podłączyć wzorzec `woogitsugames/cebulak-express` `src/net/*` później.
""",
"`src/game/modes/daily.ts`, `src/platform/share.ts`, `src/game/scores.ts`",
"- Dwie instancje gry z tą samą datą mają identyczny hash startowy.\n- Zmiana daty po północy w Warszawie zmienia seed.",
"`test:daily-mode`")

task("21", "performance", "Wydajność: budżety, presety, test urządzeń", "Performance: budgets, presets, device tier", ["10", "11", "06"], 5,
"""\
1. Pomiar: skrypt Playwright `perf:scene` — scena 40 miast, 100 samolotów, 40 tras, 2 minuty przy 4×; zbiera czas klatki,
   draw calle, trójkąty, pamięć JS, liczbę elementów DOM overlay. Wynik w JSON + linia `SUMMARY`.
2. Presety jakości (z 03) dopięte do wszystkich warstw; automatyczny dobór; 30 fps w bezczynności, pełne fps podczas
   interakcji; wstrzymanie renderu w tle.
3. Usuń alokacje w pętli klatki (wektory tymczasowe, tablice), połącz materiały, ogranicz cienie.
4. Raport w `docs/PERFORMANCE.md`: budżety (≤ 16,7 ms na średnim Androidzie, ≤ 33 ms na słabym), wyniki SwiftShader
   (tylko orientacyjnie — nie porównuj z urządzeniem), lista rzeczy do zmierzenia na prawdziwym telefonie.
""",
"`scripts/perf-*.ts`, `src/render/quality.ts`, poprawki wydajności w `src/render/**` (oznaczone `// [task-21]`), `docs/PERFORMANCE.md`",
"- `perf:scene` działa i daje liczby.\n- Liczba alokacji na klatkę ≈ 0 w stanie ustalonym (pomiar/zrzut profilera opisany w PR).",
"`perf:scene`")

task("22", "bot-balance", "Bot i balans: długość sesji i uczciwa porażka", "Autoplay bot and balance", ["08", "09", "12"], 5,
"""\
1. Bot w Node (`scripts/bot.ts`) grający przez polecenia: prosta heurystyka (łącz nowe miasta z najbliższym hubem, dodawaj
   samoloty na najbardziej obciążone trasy, wybieraj ulepszenie według przyczyn z księgi).
2. Raport na 50 seedach: rozkład długości gry (tygodnie, minuty przy 1×), przyczyny porażek, wynik. Cel MVP z RESEARCH §5:
   **mediana sesji 8–15 min** przy dobrej grze, porażka zawsze poprzedzona widocznym odliczaniem.
3. Strojenie `src/sim/params.ts` do celu; każda zmiana opisana w PR z liczbami przed/po (tabela CSV w `docs/balance/`).
4. Test regresji balansu: `test:balance` (szybki, 10 seedów) pilnuje, by mediana mieściła się w przedziale.
""",
"`scripts/bot.ts`, `scripts/balance-report.ts`, `src/sim/params.ts` (strojenie, oznaczone), `docs/balance/**`",
"- Raport 50 seedów w `docs/balance/`.\n- `test:balance` zielony.",
"`test:balance`")

task("23", "onboarding", "Samouczek: pierwsze 3 minuty", "Onboarding: first 3 minutes", ["07", "13", "12"], 5,
"""\
1. Pierwsza gra prowadzona w świecie, nie ścianą tekstu: 3 miasta, podświetlona „ścieżka palca” od miasta do miasta, krótkie
   paski ATC z instrukcją (i18n), pauza symulacji do czasu wykonania kroku.
2. Kroki: narysuj trasę → przypisz samolot (przeciągnij przywieszkę) → zobacz przesiadkę w hubie → pierwsza noc (fala popytu
   o świcie) → pierwszy wybór ulepszenia → zator i jak go rozładować.
3. Pomijalny, powtarzalny z ustawień; stan w ustawieniach (`aw-tutorial`).
""",
"`src/game/tutorial/**`, `src/ui/tutorial/**`",
"- Przejście samouczka w teście e2e (Playwright) na 412×915.\n- Zrzuty kroków w `docs/shots/23/`.",
"`test:e2e:tutorial`")

# ---------------------------------------------------------------- wave 6
task("24", "android-build", "Build Android", "Android build", ["01", "16"], 6,
"""\
1. `npx cap add android`, konfiguracja edge-to-edge (Android 15+), status bar, orientacja nieblokowana, obsługa składanych
   (bez restartu aktywności przy zmianie rozmiaru — `configChanges`), przycisk wstecz → `src/platform/back.ts`.
2. Ikona i splash **proceduralne** (SVG w repo → PNG skryptem, wzorzec `woogitsu/commutopia` `resources/` i `brand/`):
   żółto-czarny drogowskaz z piktogramem samolotu, zgodny z menu.
3. Skrypty: `npm run android` (debug APK, wymaga `ANDROID_HOME`), release przez zmienne środowiskowe z kluczem **poza repo**
   (wzorzec z `CLAUDE.md` commutopii: `AW_KEYSTORE`, `AW_KEYSTORE_PASS`). AAB dla Play.
4. `docs/ANDROID.md`: jak zbudować, podpisać, zainstalować; wymagane wersje SDK.
""",
"`android/**` (bez buildów), `resources/**`, `brand/**`, `scripts/build-android.*`, `docs/ANDROID.md`",
"- Debug APK buduje się (jeśli w środowisku nie ma SDK — opisz to uczciwie w PR i zostaw instrukcję).\n- Żadnych kluczy ani APK w repo.",
"`test:android-config` (sprawdza manifest: orientacja, configChanges, brak zbędnych uprawnień)")

task("25", "ios-build", "Build iOS", "iOS build", ["01", "16"], 6,
"""\
1. `npx cap add ios`, safe-area, orientacje, ikony/splash ze źródeł z 24 (jeśli 24 nie jest scalone — wygeneruj z tych samych
   SVG i oznacz do ujednolicenia).
2. fastlane (wzorzec: `woogitsugames/cebulak-express` — `Gemfile`, `fastlane/`), lane `beta` do TestFlight z kluczem API
   App Store Connect ze zmiennych środowiskowych (nic w repo).
3. Audio: kategoria sesji respektująca przełącznik wyciszenia (zgodnie z 19).
4. `docs/IOS.md`: wymagania (Xcode, CocoaPods), budowanie, podpisywanie, TestFlight.
""",
"`ios/**` (bez Pods i buildów), `fastlane/**`, `Gemfile`, `docs/IOS.md`",
"- Projekt iOS generuje się i ma poprawną konfigurację (bez Maca — opisz w PR, czego nie dało się zweryfikować).",
"`test:ios-config` (Info.plist: orientacje, brak zbędnych uprawnień)")

task("26", "store-assets", "Zrzuty i teksty do sklepów", "Store screenshots and listing text", ["13", "14", "12", "15"], 6,
"""\
1. Skrypt `npm run store:shots`: ustawione sceny (trick przez parametry URL / tryb deweloperski) — gra w Europie o zmierzchu,
   wybór ulepszenia, menu z tablicą, porażka z raportem, widok nocny ze światłami. PL i EN, telefon 1080×1920 (9:16),
   składany i tablet; bez nakładek marketingowych w MVP (albo prosty pasek tekstu w stylu drogowskazu — zaproponuj).
2. Teksty sklepu PL/EN w `docs/store/` (tytuł „Airway”, podtytuł odróżniający od wyników medycznych i Mini Airways —
   3 propozycje do wyboru właściciela, opis krótki i długi, słowa kluczowe). **Bez** nazw konkurentów w tekstach sklepu.
""",
"`scripts/store-shots.*`, `docs/store/**`",
"- Komplet PNG w `docs/store/shots/` obejrzany i zgodny z listą zakazów.\n- Teksty PL/EN gotowe do wklejenia.",
"`store:shots`")

task("27", "monetization-gate", "Demo + odblokowanie (szkielet, decyzja właściciela)", "Demo + unlock (skeleton, owner decision)", ["14", "17"], 6,
"""\
Model biznesowy **nie jest jeszcze zatwierdzony** przez właściciela (RESEARCH §6 rekomenduje: darmowe pobranie + jedno
odblokowanie 3,99 €, bez reklam i timerów). Twoje zadanie to szkielet, który pozwoli wybrać później bez przebudowy:

1. `src/platform/store.ts`: interfejs `Entitlements` (`isUnlocked`, `purchaseUnlock`, `restore`), implementacja testowa
   (przełącznik w ustawieniach deweloperskich) i szkic adaptera pod natywną wtyczkę IAP (wybór wtyczki zostaw jako pytanie,
   podaj 2 opcje z licencjami).
2. Bramka zawartości sterowana konfiguracją `src/game/gating.ts`: np. demo = pierwsze 5 zadań + lot bez końca do tygodnia 3;
   pełna wersja = wszystko. Ekran odblokowania w języku wizualnym gry (karta pokładowa „upgrade do pierwszej klasy” — bez
   nachalności, bez timerów, bez dark patterns).
3. Wszystko wyłączone flagą domyślnie (`GATING_ENABLED=false`), dopóki właściciel nie zdecyduje. Pytanie w PR.
""",
"`src/platform/store.ts`, `src/game/gating.ts`, `src/ui/unlock/**`",
"- Z wyłączoną flagą gra działa jak pełna wersja.\n- Z włączoną flagą bramka działa w trybie testowym.",
"`test:gating`")

task("28", "e2e-smoke", "Testy e2e i macierz ekranów", "E2E smoke tests and screen matrix", ["13", "14", "15", "16"], 6,
"""\
1. Playwright (przeglądarka z środowiska): `test:e2e:smoke` — start, menu, nowa gra, narysowanie trasy, przypisanie samolotu,
   przyspieszenie do końca tygodnia, wybór ulepszenia, zapis/wczytanie, porażka w scenariuszu testowym, powrót do menu.
2. `ui:matrix`: zrzuty kluczowych ekranów w PL/EN × 412×915, 915×412, 673×841, 904×1000 do `docs/shots/matrix/`
   (wzorzec: `woogitsu/commutopia` `scripts/shot.cjs`, `ui:matrix`).
3. Uchwyt deweloperski `window.aw` (start trybu z seedem, przewijanie czasu) tylko w buildzie deweloperskim.
4. Dokumentacja w `docs/TESTING.md`.
""",
"`e2e/**`, `scripts/shot.*`, `src/game/devHandle.ts`",
"- Smoke zielony lokalnie (podaj czas).\n- Matryca zrzutów kompletna.",
"`test:e2e:smoke`, `ui:matrix`")

task("29", "landing-page", "Strona airway.games", "airway.games landing page", ["14"], 6,
"""\
1. Statyczna strona w `site/` (bez frameworka lub Vite, build do `site/dist`, nie commitować `dist`): hero z żywym globusem
   (lekka wersja renderera z 03 albo wideo/zrzut, jeśli WebGL niedostępny), tytuł na drogowskazie, 3 zrzuty, krótki opis
   PL/EN, „Wkrótce na Android i iOS”, kontakt, polityka prywatności (gra offline, brak zbierania danych w MVP — do potwierdzenia
   przez właściciela).
2. Ten sam język wizualny (karta pokładowa, tablica, przywieszki), kroje OFL, zgodnie z listą zakazów (żadnego szablonu
   landing page z gradientem i kartami).
3. Instrukcja wdrożenia w `docs/SITE.md` (np. GitHub Pages / dowolny statyczny hosting) — **nie wdrażaj** bez zgody właściciela.
""",
"`site/**`, `docs/SITE.md`",
"- Strona działa lokalnie, Lighthouse (jeśli dostępny) ≥ 90 wydajność na mobile, zrzuty w `docs/shots/29/`.",
"`test:site` (linki, alt-y, i18n)")

task("30", "integration-review", "Integracja, przegląd i przekazanie", "Integration review and handover", ["(wszystkie scalone)"], 7,
"""\
Uruchom to zlecenie **dopiero po scaleniu do `dev` większości zleceń 01–29** (sprawdź listę scalonych PR-ów).

1. Pełny przegląd `dev`: spójność architektury z `docs/ARCHITECTURE.md`, `test:arch`, determinizm end-to-end (replay
   z dziennika poleceń całej gry = ten sam wynik), brak martwego kodu i podwójnych implementacji (np. dwa `haptics.ts`).
2. Napraw drobne niespójności między zleceniami (małe, opisane commity). Większe problemy → lista w raporcie, nie przebudowuj.
3. Uruchom wszystko: `test:fast`, `test:e2e:smoke`, `ui:matrix`, `perf:scene`, `test:balance`; zbierz wyniki.
4. Przejdź grę ręcznie (w przeglądarce, 412×915) przez 15 minut i opisz wrażenia: czytelność, frustracje, błędy.
5. `docs/HANDOVER.md`: stan MVP vs plan z RESEARCH §5, znane błędy, ryzyka, kolejne kroki (rankingi Firebase, cisza nocna
   włączona, cargo, Steam), lista pytań do właściciela.
""",
"poprawki w dowolnych plikach (małe, oznaczone `// [task-30]`), `docs/HANDOVER.md`",
"- Wszystkie testy zielone albo uczciwie opisane czerwone z przyczyną.\n- HANDOVER kompletny.",
"wszystkie istniejące")

# ---------------------------------------------------------------- write files
order = sorted(T, key=lambda t: t["nn"])
for t in order:
    branch = f"task/{t['nn']}-{t['slug']}"
    deps = ", ".join(t["deps"]) if t["deps"] else "brak (zacznij od razu)"
    common = COMMON.format(repo=REPO, base=BASE, branch=branch, nn=t["nn"], title_en=t["title_en"],
                           base_note=t["base_note"] or "Zanim zaczniesz, sprawdź, czy zlecenia, od których zależysz, są już scalone do `dev` (PR-y `[NN]` w stanie merged). Jeśli nie — zbuduj na tym, co jest, z cienkim adapterem/atrapą i opisz to w PR.")
    md = f"""# Zlecenie {t['nn']} — {t['title']}

> Jedna sesja = jedno zlecenie. Projekt: **Airway** (airway.games). Fala: **{t['wave']}**. Zależy od zleceń: **{deps}**.
> Gałąź robocza: **`{branch}`** → draft PR do **`{BASE}`**.

{common}
## Zadanie
{t['body']}
## Pliki, które są Twoje
{t['files']}

## Kryteria akceptacji
{t['accept']}

## Testy do dodania
{t['tests']}

## Poza zakresem
Wszystko, co należy do innych zleceń (lista: `docs/tasks/00-INDEX.md`). Nie dodawaj funkcji „przy okazji”.
"""
    open(os.path.join(OUT, f"{t['nn']}-{t['slug']}.md"), "w").write(md)

# index
waves = {}
for t in order: waves.setdefault(t["wave"], []).append(t)
idx = ["# Zlecenia produkcyjne Airway — spis i kolejność", "",
       "Każdy plik `NN-*.md` to brief dla **jednej nowej sesji** agenta z dostępem do repozytorium `woogitsugames/airway`.",
       "Sesja pracuje na gałęzi `task/NN-...`, wypycha ją i otwiera **draft PR do `dev`**. Scala właściciel (po przejrzeniu PR-a).", "",
       "## Jak uruchamiać", "",
       "1. Najpierw **tylko 01** (zakłada gałąź `dev` z dorobku etapu 0 i szkielet). Scal jego PR do `dev`.",
       "2. Potem fale po kolei. Zlecenia w jednej fali można uruchomić **równolegle** (różne pliki). Następną falę zaczynaj, gdy",
       "   PR-y poprzedniej, od których zależy, są scalone — inaczej sesja musi pracować na atrapach.",
       "3. Po scaleniu fal 0–6 uruchom **30** (integracja i przekazanie).",
       "4. Do każdej sesji wklej treść jednego pliku (albo napisz: „Wykonaj zlecenie z pliku `docs/tasks/NN-....md` w repozytorium”).", "",
       "## Fale", ""]
names = {0: "Fundament", 1: "Rdzeń", 2: "Świat i symulacja", 3: "Rozgrywka na ekranie", 4: "Pętla gry i ekrany", 5: "Treść i jakość", 6: "Wydanie", 7: "Domknięcie"}
for w in sorted(waves):
    idx.append(f"### Fala {w} — {names[w]}")
    idx.append("| Nr | Zlecenie | Gałąź | Zależy od |")
    idx.append("|---|---|---|---|")
    for t in waves[w]:
        idx.append(f"| {t['nn']} | [{t['title']}]({t['nn']}-{t['slug']}.md) | `task/{t['nn']}-{t['slug']}` | {', '.join(t['deps']) or '—'} |")
    idx.append("")
idx += ["## Zasady wspólne (powtórzone w każdym zleceniu)",
        "- Repo `woogitsugames/airway`; inne repozytoria tylko do czytania.",
        "- Gałąź bazowa `dev`; nigdy push do `dev`/`main` (wyjątek: zlecenie 01 zakłada `dev`); PR jako draft; bez scalania.",
        "- Zasady projektu w `CLAUDE.md`, decyzje w `docs/DECISIONS.md`, styl w `docs/styles/diorama.md`.",
        "- Symulacja deterministyczna i czysta (`src/sim`, D-13), testy na stałym seedzie z linią `SUMMARY`.",
        "- Raport po polsku w opisie PR-a: co zrobione, wyniki testów, zrzuty, pytania do właściciela.", "",
        "## Decyzje, które należą do właściciela (zlecenia je oznaczą, ale nie rozstrzygają)",
        "- `appId` aplikacji (propozycja `games.airway.app`) — zlecenie 01.",
        "- Model biznesowy i wtyczka IAP — zlecenie 27 (domyślnie wyłączone).",
        "- Podtytuł do sklepów — zlecenie 26.",
        "- Polityka prywatności i wdrożenie strony — zlecenie 29.",
        "- Włączenie ciszy nocnej w trybie bez końca — zlecenie 11 (domyślnie wyłączona)."]
open(os.path.join(OUT, "00-INDEX.md"), "w").write("\n".join(idx) + "\n")
print(len(order), "tasks")
