# Zlecenie 31 — Tydzień = 3 doby gry i ponowny balans

> Paczka poprawkowa (fala **P1**, decyzja D-42). Projekt: **Airway** (airway.games). Zależy od zleceń: **brak (zacznij od razu)**.
> Gałąź robocza: **`task/31-week-3-days`** → draft PR do **`dev`**.

## Gdzie pracujesz
- Repozytorium: **`woogitsugames/airway`** (GitHub). Masz do niego dostęp. **Nie zmieniaj żadnych innych repozytoriów**
  (`woogitsu/commutopia`, `woogitsugames/cebulak-express`, `woogitsugames/Century-war`, `SamsufiPL/Frontier`,
  `SamsufiPL/AirWar` wolno tylko czytać jako wzorce).
- Gałąź bazowa: **`dev`**. Zrób `git fetch origin dev && git checkout -b task/31-week-3-days origin/dev`.
  Zlecenia, od których zależysz, muszą być już scalone do `dev` (PR `[NN]` merged). Jeśli nie są — nie zaczynaj, zgłoś to.
- Pracujesz **wyłącznie** na gałęzi **`task/31-week-3-days`** i tam wypychasz: `git push -u origin task/31-week-3-days`.
- Na końcu otwórz **draft PR `task/31-week-3-days` → `dev`** z tytułem `[31] 3-day week and rebalance`. **Nie scalaj** PR-a, nie pushuj do `dev`
  ani do `main`, nie przepisuj historii cudzych gałęzi. Scala właściciel.
- Jeśli przed PR-em `dev` poszedł do przodu: `git fetch origin dev && git rebase origin/dev` (albo merge), rozwiąż
  konflikty tylko w swoich plikach i uruchom testy ponownie.

## Przeczytaj najpierw
1. `CLAUDE.md` — zasady projektu (obowiązują także Ciebie, mimo nazwy pliku).
2. `docs/DECISIONS.md` — decyzje D-xx mają pierwszeństwo przed Twoimi pomysłami.
3. `docs/styles/diorama.md` — wybrany styl świata i interfejsu (D-11). Makiety: `mockups/diorama/png/*.png`,
   kod makiet: `mockups/diorama/scene3d.js` i `mockups/diorama/build.mjs` (wolno z nich przenosić rozwiązania).
4. `docs/RESEARCH.md` (rdzeń gry §3), `docs/ARCHITECTURE.md` (sekcje „Sim API” i „Render API”), `docs/TESTING.md`.
   Gra jest już zintegrowana na `dev` (PR #30): uruchom ją (`npm run dev`) i obejrzyj, zanim zaczniesz.
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
  `npm run test:<nazwa>` i wiersz w `docs/TESTING.md`. Przed pushem zawsze: `npm ci`, `npm run test:fast` (runner z jedną linią na krok) i `npm run build`;
  jeśli zmieniasz rozgrywkę lub ekrany, także `npm run test:e2e:smoke` i `npm run ui:matrix`. Playwright + Chromium są
  w środowisku (`npm install --no-save playwright@1.63.0`), WebGL przez SwiftShader (szczegóły w `e2e/README.md`).
- Zrzuty ekranu (jeśli zlecenie dotyczy wyglądu): `npm run shots` → PNG 412×915 i 915×412 w `docs/shots/31/`; obejrzyj je
  sam i porównaj z listą zakazów przed PR-em.
- Pracuj tylko w plikach ze swojej sekcji „Pliki”. W cudzych plikach dopuszczalne są małe, oznaczone zmiany
  (`// [task-31]`), bez przeformatowywania.
- Decyzje właściciela (styl, zakres, model biznesowy, nazwy): nie podejmuj ich sam. Zapisz pytanie w opisie PR-a
  w sekcji „Pytania do właściciela” z rekomendacją i zostaw rozsądny, łatwy do zmiany wariant domyślny.
- Nowe ustalenia techniczne zapisuj jako kolejne D-xx w `docs/DECISIONS.md` (sprawdź ostatni numer po rebase).

## Raport (opis draft PR-a, po polsku)
- Co zrobione (krótko), czego **nie** zrobiono i dlaczego.
- Uruchomione komendy i ich wynik (liczba testów, linie `SUMMARY`). Nie pisz, że coś działa, jeśli tego nie uruchomiłeś.
- Zrzuty (jeśli dotyczy) jako linki do plików w `docs/shots/31/`.
- Znane problemy, ryzyka, „Pytania do właściciela”.

## Zadanie
Decyzja właściciela **D-40**: tydzień gry trwa **3 doby** (nazwa „Tydzień” zostaje). Teraz bot przeżywa tydzień 1 tylko na
ok. 5% seedów (patrz `docs/balance/`), więc wybór ulepszenia prawie się nie pojawia.

1. Jedno źródło prawdy dla długości tygodnia w `src/sim/params.ts` (dziś są dwa: `SIM_DAYS_PER_WEEK` i
   `DAYNIGHT_DAYS_PER_WEEK` — połącz je). Zegar, oferta ulepszeń, HUD (7 kwadratów doby → 3), cisza nocna od tygodnia 4
   (D-17, czyli od doby 10), zadania i wyzwanie dnia korzystają z tej stałej.
2. HUD (`src/ui/hud/**`): pasek doby z karty pokładowej pokazuje 3 pola; sprawdź teksty i18n („Tydzień N”, dni).
3. Balans (`src/sim/params.ts`, bot `src/game/dev/bot-policy.ts` bez zmian zasad): cel — **mediana sesji 8–15 min przy 1×**
   i **≥ 60% seedów bota dochodzi do pierwszego wyboru ulepszenia**, ≥ 30% do drugiego. Raport 50 seedów przed/po w
   `docs/balance/` (CSV + krótki opis), zaktualizuj `test:balance` (progi) i opis w D-39/D-40 (dopisz liczby).
4. Zadania (`src/data/puzzles/**`): przelicz cele na nowym tygodniu (reguła z 17: bez działań porażka, rozwiązanie
   referencyjne wygrywa z marginesem ≥ 15%); `test:puzzles` zielony.
5. Testy na stałym seedzie, które zakładały 7 dób (sim-week, replay, ui:matrix `WEEK_SEED`, store `upgrade`), zaktualizuj
   uczciwie — najlepiej tak, by stały „szczęśliwy” seed nie był już potrzebny (autoplay dochodzi do tygodnia 1 na typowym seedzie).

## Pliki, które są Twoje
`src/sim/**`, `src/data/puzzles/**`, `docs/balance/**`, `scripts/test-*.{ts,mjs}` dla sim/balansu, `src/ui/hud/**` (tylko pasek doby), seedy w `e2e/smoke.mjs`, `scripts/ui-matrix.mjs`, `scripts/store-shots.mjs`

## Kryteria akceptacji
- `test:fast`, `test:balance`, `test:replay`, `test:puzzles`, `test:e2e:smoke`, `ui:matrix` zielone.
- Raport balansu: mediana 8–15 min, ≥ 60% seedów do 1. ulepszenia, ≥ 30% do 2.
- Zrzut HUD z 3 polami doby w `docs/shots/31/`.

## Testy do dodania
aktualizacja istniejących; nowy test, że długość tygodnia ma jedno źródło (grep/import w `test:arch` lub osobny)

## Poza zakresem
Wszystko, co należy do innych zleceń paczki (spis: `docs/tasks/00-INDEX.md`, sekcja „Paczka poprawkowa”).
