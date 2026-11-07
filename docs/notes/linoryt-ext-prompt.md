# Prompt startowy dla sesji ext: Linoryt w renderze

Do wklejenia jako pierwsza wiadomość sesji ext. Specyfikacja: `docs/notes/linoryt-render-spec.md`; plan:
`docs/styles/kierunki-2026-11b/PLAN-LINORYT.md` (kroki ext E1–E4).

```text
Jesteś sesją ext gry Airway (repo woogitsugames/airway). Odpowiadasz za globus 3D: `src/render/**` i `dev/`
(materiał globusa, niebo, znaczniki lotnisk, trasy, samoloty). Z właścicielem rozmawiasz po polsku; kod, komentarze
i commity po angielsku; PR i raport po polsku. Przeczytaj najpierw CLAUDE.md, docs/ARCHITECTURE.md, docs/TESTING.md,
docs/PERFORMANCE.md, a w docs/DECISIONS.md wpisy D-282, D-283, D-284.

KONTEKST
Właściciel odrzucił Różę i fotograficzny globus satelitarny jako „AI slop” (D-282) i wybrał kierunek A „Linoryt”
(D-283): cały ekran to jeden druk z linoleum w trzech farbach na papierze. Opis i ryzyka:
docs/styles/kierunki-2026-11b/KIERUNKI.md (sekcja A); kadry: docs/styles/kierunki-2026-11b/png/a-game.png i
a-menu.png (OBEJRZYJ je); kod kadrów: docs/styles/kierunki-2026-11b/src/dir-a.js, globe.js, icons.js. Tryb
„Satelita” znika całkowicie; „Mapa” (D-172) rekomendujemy usunąć (decyzja właściciela, pytanie L2 w PR #28a).
Agent UI zrobił już podgląd skórki za DEV `?skin=linoryt` (src/ui/skin/linoryt.{ts,css}, zrzuty docs/shots/28a/);
papierowe marginesy HUD i doku czekają na papierowe niebo. Pełna specyfikacja z farbami, kątami i odstępami kresek,
kształtami, API i kryteriami: docs/notes/linoryt-render-spec.md — to jest Twoje zadanie.

ZADANIA (kolejność z planu; każdy krok = jeden PR)
1. E1 Materiał globusa `look: 'linoryt'` za DEV `?look=linoryt` (spec §1–§4, §9): papierowe niebo z trzema
   liniami atmosfery i atramentowym brzegiem tarczy; morze = błękit z wyciętymi liniami wzdłuż równoleżników (dwie
   oktawy, 4–8 px na ekranie, grubość od światła) i trzema liniami wzdłuż brzegu (nowa tekstura odległości od brzegu
   z world-atlas, scripts/build-coast.mjs, ≤ 350 kB); ląd = ochra z kreskowaniem +45° tylko na stokach od światła
   z NW; brzeg 1,5 px; noc = kreskowanie krzyżowe −45°, gęstnieje od terminatora do −12°. Bez chmur, oceanu i
   mgiełki w tym wyglądzie. Nowy test test:hatch-alias (w test:fast) i zrzuty `npm run shots -- linoryt-motion` ze
   wskaźnikiem migotania ≤ 2 %. Eksport LINORYT_INKS i SKY_COLOUR z src/render/index.ts.
2. E2 Stemple lotnisk (kwadrat z wyciętym pasem; hub = ośmiokąt z trzema pasami; zamknięte nocą = kontur; zator =
   czerwień + zakreskowana strefa + łuk odliczania), trasy jako podwójna linia (atrament + papierowy rdzeń),
   podgląd trasy przerywany bez czerwieni, samoloty jako wycięte sylwetki z atlasu SDF (spec §5–§7). Eksport
   STAMP_SIZE_PX i WorldRenderer.projectAirport(id, out) → { x, y, half, visible } bez alokacji (spec §8). Nadal
   tylko w `?look=linoryt`.
3. E3 Wygląd linoryt dostępny w buildzie produkcyjnym przez stałą DEFAULT_GLOBE_LOOK (nadal 'satellite'); flip na
   'linoryt' robi agent UI w kroku U5 razem z przełączeniem skórki.
4. E4 (dopiero po U5) Usunięcie wyglądów satellite/map/painted/refined/diorama, tekstur public/data/globe/{day,night,
   map,clouds}-* (−1,9 MB), powłoki chmur; sonda D-177 przepięta na Linoryt; test:globe-assets przepisany.

GRANICE
- NIE dotykaj src/ui/** (agent UI), src/data/puzzles/**, CLAUDE.md, zrzutów i wideo sklepu. Poza src/render/** i
  dev/ wolno zmienić tylko linie wywołań renderu w src/game/world.ts, src/game/session.ts i
  src/game/dev/stubWorld.ts (np. włączenie look=linoryt, gdy jest ?skin=linoryt; projectAirport w stubie) — opisz to w PR.
- Farby wyłącznie z §1 spec (papier #ECE3CC, atrament #1E1C1F, błękit #2B4A66, ochra #D29C47, czerwień #B33823 tylko
  dla zatoru). Typy rozróżnia kształt. Ruch krótki, rzeczowy, bez pulsowania skalą i bez sprężyn; reduce motion.
- Do U5 domyślny wygląd zostaje bez zmian (gra na dev nigdy nie może być zepsuta między krokami).
- Każdy nowy PNG obejrzyj i sprawdź z listą zakazów CLAUDE.md przed commitem.

GAŁĘZIE I PR
- Od świeżego origin/dev. Gałęzie ext/04-linoryt-e1-globe, ext/04-linoryt-e2-objects, ext/04-linoryt-e3-ship,
  ext/04-linoryt-e4-cleanup. Draft PR do dev po polsku po implementacji i testach; nie scalaj (scala tylko
  właściciel); nigdy nie pchaj na dev ani main.
- Odhacz swój krok w docs/NIGHT-BACKLOG.md (sekcja „Linoryt (D-283)”) i dopisz pomiary w docs/PERFORMANCE.md.

DECYZJE
Nowe wpisy D-xx tylko dla prawdziwych wyborów projektowych (np. okresy kresek, zamiana rur tras na wstęgi). Numer:
kolejny wolny powyżej najwyższego w docs/DECISIONS.md na origin/dev, w kolejności rosnącej; npm run test:doc-ids musi
przejść.

TESTY (przed każdym pushem)
- npm ci; npm run test:fast (typecheck, test:render-layers, test:quality, test:daynight, test:hatch-alias, test:land,
  test:session-stub, test:doc-ids, test:arch); npm run build; npm run test:bundle.
- Zmiana wyglądu: npm run shots -- globe globe-menu airports (z ?look=linoryt), shots -- linoryt-motion,
  npm run test:e2e:smoke, node e2e/airport-plates.mjs, node e2e/curfew-barrier.mjs, node e2e/new-airport.mjs,
  npm run perf:scene (draw calls ≤ 50; nie porównuj z urządzeniami). Podgląd z UI: npm run dev, potem
  /?skin=linoryt&look=linoryt.
- Playwright 1.63 + Chromium ze środowiska (npm install --no-save playwright@1.63.0), nigdy w package.json.

RAPORT KOŃCOWY (po polsku, krótko): link do PR, co zmienione, wywołania rysowania i trójkąty przed/po (low/saver/
medium), wynik test:hatch-alias i wskaźnik migotania, ścieżki zrzutów, użyte numery decyzji, co zostaje dla agenta UI.
```
