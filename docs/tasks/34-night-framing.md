# Zlecenie 34 — Czytelna noc i kadrowanie kamery (menu, poziom)

> Paczka poprawkowa (fala **P2**, decyzja D-42). Projekt: **Airway** (airway.games). Zależy od zleceń: **33**.
> Gałąź robocza: **`task/34-night-framing`** → draft PR do **`dev`**.

## Gdzie pracujesz
- Repozytorium: **`woogitsugames/airway`** (GitHub). Masz do niego dostęp. **Nie zmieniaj żadnych innych repozytoriów**
  (`woogitsu/commutopia`, `woogitsugames/cebulak-express`, `woogitsugames/Century-war`, `SamsufiPL/Frontier`,
  `SamsufiPL/AirWar` wolno tylko czytać jako wzorce).
- Gałąź bazowa: **`dev`**. Zrób `git fetch origin dev && git checkout -b task/34-night-framing origin/dev`.
  Zlecenia, od których zależysz, muszą być już scalone do `dev` (PR `[NN]` merged). Jeśli nie są — nie zaczynaj, zgłoś to.
- Pracujesz **wyłącznie** na gałęzi **`task/34-night-framing`** i tam wypychasz: `git push -u origin task/34-night-framing`.
- Na końcu otwórz **draft PR `task/34-night-framing` → `dev`** z tytułem `[34] Readable night and camera framing`. **Nie scalaj** PR-a, nie pushuj do `dev`
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
- Zrzuty ekranu (jeśli zlecenie dotyczy wyglądu): `npm run shots` → PNG 412×915 i 915×412 w `docs/shots/34/`; obejrzyj je
  sam i porównaj z listą zakazów przed PR-em.
- Pracuj tylko w plikach ze swojej sekcji „Pliki”. W cudzych plikach dopuszczalne są małe, oznaczone zmiany
  (`// [task-34]`), bez przeformatowywania.
- Decyzje właściciela (styl, zakres, model biznesowy, nazwy): nie podejmuj ich sam. Zapisz pytanie w opisie PR-a
  w sekcji „Pytania do właściciela” z rekomendacją i zostaw rozsądny, łatwy do zmiany wariant domyślny.
- Nowe ustalenia techniczne zapisuj jako kolejne D-xx w `docs/DECISIONS.md` (sprawdź ostatni numer po rebase).

## Raport (opis draft PR-a, po polsku)
- Co zrobione (krótko), czego **nie** zrobiono i dlaczego.
- Uruchomione komendy i ich wynik (liczba testów, linie `SUMMARY`). Nie pisz, że coś działa, jeśli tego nie uruchomiłeś.
- Zrzuty (jeśli dotyczy) jako linki do plików w `docs/shots/34/`.
- Znane problemy, ryzyka, „Pytania do właściciela”.

## Zadanie
1. **Noc:** w widoku poziomym o 23:47 (`docs/shots/integration/route-drawing-l.png`) prawie nic nie widać. Strona nocna ma być
   ciemniejsza od dnia, ale czytelna: ląd i morze rozróżnialne (księżycowe światło z nieba, chłodna paleta), światła miast
   ciepłe, trasy, samoloty, lotniska i przywieszki zawsze czytelne (materiały UI niezależne od oświetlenia). Bez bloomu i neonów.
2. **Terminator:** wyraźna, ale miękka granica dnia i nocy; zmierzch/świt ciepłą barwą.
3. **Kadry:** menu (`menu-p.png` i `menu-l.png` na `dev`) — globus źle wykadrowany za tablicą i drogowskazem; ma wyglądać
   jak `mockups/diorama/png/menu-p.png` (horyzont z niebem u góry, sieć widoczna nad tablicą). W grze w poziomie kadr ma
   uwzględniać szynę HUD (prawy dok) i kartę pokładową (insety kamery z layoutu, nie stałe liczby).

## Pliki, które są Twoje
`src/render/**` (oświetlenie, kamera, materiały), `src/game/world.ts` (tylko framing, oznacz `// [task-34]`)

## Kryteria akceptacji
- Zrzuty dzień/zmierzch/noc × pion/poziom oraz menu pion/poziom w `docs/shots/34/`, obejrzane.
- Kontrast przywieszek i tras na nocy ≥ 4,5:1 (sprawdź próbką pikseli w teście lub opisz pomiar).

## Testy do dodania
`test:render-layers` (rozszerz o insety kamery)

## Poza zakresem
Wszystko, co należy do innych zleceń paczki (spis: `docs/tasks/00-INDEX.md`, sekcja „Paczka poprawkowa”).
