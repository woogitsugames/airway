# Zlecenie 08 — Symulacja: popyt, pasażerowie, przesiadki, huby, porażka

> Jedna sesja = jedno zlecenie. Projekt: **Airway** (airway.games). Fala: **2**. Zależy od zleceń: **02, 05**.
> Gałąź robocza: **`task/08-sim-passengers-hubs`** → draft PR do **`dev`**.

## Gdzie pracujesz
- Repozytorium: **`woogitsugames/airway`** (GitHub). Masz do niego dostęp. **Nie zmieniaj żadnych innych repozytoriów**
  (`woogitsu/commutopia`, `woogitsugames/cebulak-express`, `woogitsugames/Century-war`, `SamsufiPL/Frontier`,
  `SamsufiPL/AirWar` wolno tylko czytać jako wzorce).
- Gałąź bazowa: **`dev`**. Zrób `git fetch origin dev && git checkout -b task/08-sim-passengers-hubs origin/dev`.
  Zanim zaczniesz, sprawdź, czy zlecenia, od których zależysz, są już scalone do `dev` (PR-y `[NN]` w stanie merged). Jeśli nie — zbuduj na tym, co jest, z cienkim adapterem/atrapą i opisz to w PR.
- Pracujesz **wyłącznie** na gałęzi **`task/08-sim-passengers-hubs`** i tam wypychasz: `git push -u origin task/08-sim-passengers-hubs`.
- Na końcu otwórz **draft PR `task/08-sim-passengers-hubs` → `dev`** z tytułem `[08] Sim: demand, passengers, transfers, hubs, failure`. **Nie scalaj** PR-a, nie pushuj do `dev`
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
- Zrzuty ekranu (jeśli zlecenie dotyczy wyglądu): `npm run shots` → PNG 412×915 i 915×412 w `docs/shots/08/`; obejrzyj je
  sam i porównaj z listą zakazów przed PR-em.
- Pracuj tylko w plikach ze swojej sekcji „Pliki”. W cudzych plikach dopuszczalne są małe, oznaczone zmiany
  (`// [task-08]`), bez przeformatowywania.
- Decyzje właściciela (styl, zakres, model biznesowy, nazwy): nie podejmuj ich sam. Zapisz pytanie w opisie PR-a
  w sekcji „Pytania do właściciela” z rekomendacją i zostaw rozsądny, łatwy do zmiany wariant domyślny.
- Nowe ustalenia techniczne zapisuj jako kolejne D-xx w `docs/DECISIONS.md` (sprawdź ostatni numer po rebase).

## Raport (opis draft PR-a, po polsku)
- Co zrobione (krótko), czego **nie** zrobiono i dlaczego.
- Uruchomione komendy i ich wynik (liczba testów, linie `SUMMARY`). Nie pisz, że coś działa, jeśli tego nie uruchomiłeś.
- Zrzuty (jeśli dotyczy) jako linki do plików w `docs/shots/08/`.
- Znane problemy, ryzyka, „Pytania do właściciela”.

## Zadanie
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

## Pliki, które są Twoje
`src/sim/demand.ts`, `src/sim/network.ts`, `src/sim/routing.ts`, `src/sim/hubs.ts`, `src/sim/ledger.ts`, `src/sim/params.ts` (swoje sekcje), `src/sim/sim.ts` (wpięcie, oznaczone `// [task-08]`)

## Kryteria akceptacji
- Determinizm (hash) po 7 dobach gry na 3 seedach.
- Scenariusz testowy „za mało tras” kończy się porażką w przewidywalnym tiku; „wystarczająca sieć” przetrwa tydzień.
- Trasowanie wybiera minimum przesiadek (testy na małych grafach).
- Brak funkcji przestępnych w kodzie (test:arch zielony).

## Testy do dodania
`test:routing`, `test:hubs`, `test:sim-week`

## Poza zakresem
Wszystko, co należy do innych zleceń (lista: `docs/tasks/00-INDEX.md`). Nie dodawaj funkcji „przy okazji”.
