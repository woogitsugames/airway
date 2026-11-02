# Zlecenie 12 — Tydzień i wybór ulepszenia (etykiety frachtowe)

> Jedna sesja = jedno zlecenie. Projekt: **Airway** (airway.games). Fala: **4**. Zależy od zleceń: **08, 09, 13**.
> Gałąź robocza: **`task/12-weekly-upgrade`** → draft PR do **`dev`**.

## Gdzie pracujesz
- Repozytorium: **`woogitsugames/airway`** (GitHub). Masz do niego dostęp. **Nie zmieniaj żadnych innych repozytoriów**
  (`woogitsu/commutopia`, `woogitsugames/cebulak-express`, `woogitsugames/Century-war`, `SamsufiPL/Frontier`,
  `SamsufiPL/AirWar` wolno tylko czytać jako wzorce).
- Gałąź bazowa: **`dev`**. Zrób `git fetch origin dev && git checkout -b task/12-weekly-upgrade origin/dev`.
  Zanim zaczniesz, sprawdź, czy zlecenia, od których zależysz, są już scalone do `dev` (PR-y `[NN]` w stanie merged). Jeśli nie — zbuduj na tym, co jest, z cienkim adapterem/atrapą i opisz to w PR.
- Pracujesz **wyłącznie** na gałęzi **`task/12-weekly-upgrade`** i tam wypychasz: `git push -u origin task/12-weekly-upgrade`.
- Na końcu otwórz **draft PR `task/12-weekly-upgrade` → `dev`** z tytułem `[12] Weekly cycle and upgrade choice`. **Nie scalaj** PR-a, nie pushuj do `dev`
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
- Zrzuty ekranu (jeśli zlecenie dotyczy wyglądu): `npm run shots` → PNG 412×915 i 915×412 w `docs/shots/12/`; obejrzyj je
  sam i porównaj z listą zakazów przed PR-em.
- Pracuj tylko w plikach ze swojej sekcji „Pliki”. W cudzych plikach dopuszczalne są małe, oznaczone zmiany
  (`// [task-12]`), bez przeformatowywania.
- Decyzje właściciela (styl, zakres, model biznesowy, nazwy): nie podejmuj ich sam. Zapisz pytanie w opisie PR-a
  w sekcji „Pytania do właściciela” z rekomendacją i zostaw rozsądny, łatwy do zmiany wariant domyślny.
- Nowe ustalenia techniczne zapisuj jako kolejne D-xx w `docs/DECISIONS.md` (sprawdź ostatni numer po rebase).

## Raport (opis draft PR-a, po polsku)
- Co zrobione (krótko), czego **nie** zrobiono i dlaczego.
- Uruchomione komendy i ich wynik (liczba testów, linie `SUMMARY`). Nie pisz, że coś działa, jeśli tego nie uruchomiłeś.
- Zrzuty (jeśli dotyczy) jako linki do plików w `docs/shots/12/`.
- Znane problemy, ryzyka, „Pytania do właściciela”.

## Zadanie
1. Sim: koniec tygodnia (7 dób) → pauza i oferta **3 z puli** (turbośmigłowiec, szerokokadłubowiec, rozbudowa huba +6 miejsc
   i MCT 25→15 min, +2 sloty startów — slot = limit odlotów z miasta na godzinę, jeśli wprowadzasz, opisz w D-xx). Losowanie
   ze strumienia RNG `upgrades`, z gwarancją co najmniej jednego samolotu. Polecenie `ChooseUpgrade`.
2. Rozbudowa huba wymaga wskazania huba (tryb wyboru na globusie, podświetlenie hubów).
3. UI: ekran z makiety `mockups/diorama/png/upgrade-p.png` / `upgrade-l.png` — żółty drogowskaz „Tydzień N”, trzy **etykiety
   frachtowe** (papier pakowy, nagłówek „FRACHT · TP-48 · 1/3”, okienko z modelem 3D na postumencie — `renderModel()`
   z makiety, tabela pól, czerwony stempel kontekstu wyliczony z księgi przyczyn, np. „LONDYN 11/12”), ząbkowana krawędź.
4. Animacja wejścia krótka i rzeczowa (przesunięcie 150–200 ms, bez odbicia).

## Pliki, które są Twoje
`src/sim/upgrades.ts`, `src/ui/upgrade/**`, `src/render/modelPreview.ts`

## Kryteria akceptacji
- Determinizm ofert dla seeda.
- Kontekstowy stempel wskazuje najbardziej obciążony hub.
- Zrzuty w `docs/shots/12/`.

## Testy do dodania
`test:upgrades`

## Poza zakresem
Wszystko, co należy do innych zleceń (lista: `docs/tasks/00-INDEX.md`). Nie dodawaj funkcji „przy okazji”.
