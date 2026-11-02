# Zlecenie 01 — Szkielet projektu, gałąź `dev`, architektura

> Jedna sesja = jedno zlecenie. Projekt: **Airway** (airway.games). Fala: **0**. Zależy od zleceń: **brak (zacznij od razu)**.
> Gałąź robocza: **`task/01-scaffold`** → draft PR do **`dev`**.

## Gdzie pracujesz
- Repozytorium: **`woogitsugames/airway`** (GitHub). Masz do niego dostęp. **Nie zmieniaj żadnych innych repozytoriów**
  (`woogitsu/commutopia`, `woogitsugames/cebulak-express`, `woogitsugames/Century-war`, `SamsufiPL/Frontier`,
  `SamsufiPL/AirWar` wolno tylko czytać jako wzorce).
- Gałąź bazowa: **`dev`**. Zrób `git fetch origin dev && git checkout -b task/01-scaffold origin/dev`.
  Wyjątek: w tym zleceniu gałąź `dev` może jeszcze nie istnieć — patrz punkt 1. Twoją gałąź zrób z `origin/claude/adoring-bell-uoqsxa`, jeśli `dev` jeszcze nie ma.
- Pracujesz **wyłącznie** na gałęzi **`task/01-scaffold`** i tam wypychasz: `git push -u origin task/01-scaffold`.
- Na końcu otwórz **draft PR `task/01-scaffold` → `dev`** z tytułem `[01] Project scaffold, dev branch, architecture`. **Nie scalaj** PR-a, nie pushuj do `dev`
  ani do `main`, nie przepisuj historii cudzych gałęzi. Scala właściciel.
- Jeśli przed PR-em `dev` poszedł do przodu: `git fetch origin dev && git rebase origin/dev` (albo merge), rozwiąż
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
- Zrzuty ekranu (jeśli zlecenie dotyczy wyglądu): `npm run shots` → PNG 412×915 i 915×412 w `docs/shots/01/`; obejrzyj je
  sam i porównaj z listą zakazów przed PR-em.
- Pracuj tylko w plikach ze swojej sekcji „Pliki”. W cudzych plikach dopuszczalne są małe, oznaczone zmiany
  (`// [task-01]`), bez przeformatowywania.
- Decyzje właściciela (styl, zakres, model biznesowy, nazwy): nie podejmuj ich sam. Zapisz pytanie w opisie PR-a
  w sekcji „Pytania do właściciela” z rekomendacją i zostaw rozsądny, łatwy do zmiany wariant domyślny.
- Nowe ustalenia techniczne zapisuj jako kolejne D-xx w `docs/DECISIONS.md` (sprawdź ostatni numer po rebase).

## Raport (opis draft PR-a, po polsku)
- Co zrobione (krótko), czego **nie** zrobiono i dlaczego.
- Uruchomione komendy i ich wynik (liczba testów, linie `SUMMARY`). Nie pisz, że coś działa, jeśli tego nie uruchomiłeś.
- Zrzuty (jeśli dotyczy) jako linki do plików w `docs/shots/01/`.
- Znane problemy, ryzyka, „Pytania do właściciela”.

## Zadanie
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

## Pliki, które są Twoje
`package.json`, lockfile, `tsconfig*.json`, `vite.config.ts`, `capacitor.config.ts`, `index.html`, `src/**` (zalążki), `public/fonts/**`, `scripts/**`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `CLAUDE.md`, `.gitignore`, `docs/DECISIONS.md` (dopisanie D-13)

## Kryteria akceptacji
- `dev` istnieje na origin i zawiera historię etapu 0.
- `npm ci && npm run typecheck && npm run test:fast && npm run build` przechodzi.
- `test:arch` łapie celowo dodany zły import (sprawdź i usuń).
- `npm run dev` pokazuje płótno z kolorem nieba.

## Testy do dodania
`test:i18n`, `test:arch`

## Poza zakresem
Wszystko, co należy do innych zleceń (lista: `docs/tasks/00-INDEX.md`). Nie dodawaj funkcji „przy okazji”.
