# STAN NA 9.11 (po T6+R5, R6, T7)

- dev = main = 0b878c4 (PR #374 T6+R5 D-336, #375 R6 D-337, #376 T7 D-338). Nowy wygląd (globus NASA + UI-A, emalia) jest domyślny; Linoryt usunięty. test:fast 121 kroków, test:ci 99, CSS 195,4 kB (budżet 198,4).
- Pełny test:ci po T6 nie był powtórzony po poprawkach: uruchomić przed wydaniem. `store:shots` pada (glif Azji na nocnej klatce) -> U7.
- CLAUDE.md na dev mówi "117 steps"/"93 steps": poprawić w następnym PR (nie pushuję do dev).
- Zostało: U7 (zrzuty sklepu, film, strona, opisy wg D-296, nowe logo na feature graphic), test na tanim telefonie (D-245), pytania właściciela (Krym/granice, limit znaków kierunku, Q-52, Q-01, Q-07, Q-49/50/56/67, data wydania, konsultacja prawna, App Check). Paczka GPT: docs/gpt/ZLECENIA-2026-11-08.md.

# Przekazanie koordynatora Airway

Ostatnia aktualizacja: **2026-11-08, ok. 11:45 UTC**. Sesja koordynatora kończy pracę (limit tygodniowy właściciela).
Nowa sesja startuje promptem z `docs/notes/coordinator-start-prompt.md`. Wszystko poniżej sekcji „STAN NA 8.11”
to historia (chronologicznie, najnowsze wpisy na końcu pliku przed „Kolejka”).

## STAN NA 8.11 (nowa sesja koordynatora) — czytaj najpierw
- Właściciel potwierdził **Q-92 A** i **Q-93 A** (D-313, D-321 ostateczne).
- Właściciel **odrzucił wygląd Linoryt, znak aplikacji A/B/C i obecny UI** („ohydne, AI slop”). Nowy kierunek: globus
  realistyczny jak Google Earth + styl zwykłej mapy, UI wzorowany na dobrych grach ze Steama/mobilnych.
  Wstrzymane: U7, odchudzanie CSS (62a, zatrzymane bez PR), pełny `test:ci` (61a, zatrzymany), ikony aplikacji.
- W toku: agent research `night/63a-style-research` (`/workspace/63a`), plik
  `docs/styles/kierunki-2026-11c/RESEARCH-NOWY-KIERUNEK.md`, 3 kierunki + rekomendacja. Potem: wybór kierunku przez
  właściciela, makiety, nowa decyzja D-323+ (zmiana D-283/zakazów CLAUDE.md), plan etapów.
- Nieposprzątane worktree: `/workspace/61a`, `/workspace/62a`.

## STAN NA 8.11 noc (nowa sesja koordynatora) — czytaj najpierw
- Linoryt odrzucony (D-323). Nowy kierunek: globus NASA + UI-A, plan `docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md`.
  Znak aplikacji I-1 „Węzeł” (D-326). Q-92 A / Q-93 A ostateczne.
- Scalone na dev (wszystko za `?skin=board` / `?look=earth`, wydanie dalej Linoryt): R1 #362 (D-325), R2 #365 (D-327),
  T1 #350 (D-324), T2 #366 (D-328), R3 #367 (D-329), T3 #368 (D-330), T4 #369 (D-331), ikony #370 (D-333, wydanie ma już
  nową ikonę i splash na emalii). dev = main.
- W toku: T5 (`night/77a-board-t5`, D-332: raport, menu, pozostałe arkusze). Potem R4 (kadrowanie menu, noc domyślna),
  T6+R5 (przełączenie, wymaga akceptacji właściciela po zrzutach z prawdziwej gry), R6, T7, U7.
- Czekają: pomiar wydajności/pamięci GPU na tanim telefonie (SwiftShader −20% fps), Krym/granice (rekomendacja: bez linii
  przez Perekop), pytania z PR T2–T5 (domyślnie przyjęte rekomendacje), pakiet GPT-22…33 (`docs/gpt/ZLECENIA-2026-11-08.md`).
- Sesja ext nie istnieje; render robią nasi agenci (zgoda właściciela). Worktree: tylko agenci w toku.

## STAN NA 8.11 (nowa sesja koordynatora) — czytaj najpierw
- Właściciel potwierdził **Q-92 A** i **Q-93 A** (D-313, D-321 ostateczne).
- Właściciel **odrzucił wygląd Linoryt, znak aplikacji A/B/C i obecny UI** („ohydne, AI slop”). Nowy kierunek: globus
  realistyczny jak Google Earth + styl zwykłej mapy, UI wzorowany na dobrych grach ze Steama/mobilnych.
  Wstrzymane: U7, odchudzanie CSS (62a, zatrzymane bez PR), pełny `test:ci` (61a, zatrzymany), ikony aplikacji.
- W toku: agent research `night/63a-style-research` (`/workspace/63a`), plik
  `docs/styles/kierunki-2026-11c/RESEARCH-NOWY-KIERUNEK.md`, 3 kierunki + rekomendacja. Potem: wybór kierunku przez
  właściciela, makiety, nowa decyzja D-323+ (zmiana D-283/zakazów CLAUDE.md), plan etapów.
- Nieposprzątane worktree: `/workspace/61a`, `/workspace/62a`.

## STAN NA 8.11 wieczór (nowa sesja koordynatora) — czytaj najpierw
- Q-92 A / Q-93 A potwierdzone. **Linoryt odrzucony (D-323).** Nowy kierunek: globus NASA (K2, noc domyślnie jako wygląd) + UI-A
  „Lotniskowa tablica i paski lotu”. Plan: `docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md` (etapy R1–R6 render, T1–T7 UI, Z znak, U7).
- Scalone: #344 research, #347 makiety UI-A (+K1/K2), #349 D-323+plan, #350 T1 (UI-A za ?skin=board, D-324). #346/#348 zamknięte (K1/K2 w #347, UI-B odrzucone). dev = main.
- W toku: agent R1 `night/70a-earth-r1` (`/workspace/70a`, globus NASA za ?look=earth, D-325). Sesja ext nie istnieje — render robią nasi agenci (zgoda właściciela).
- Następne: T2 po R2 (patrz plan), znak aplikacji (szkice z huba/glifów i ze znaku lotniskowego), U7 na końcu. Odchudzenie CSS niepotrzebne w tej formie.
- Odpowiedzi właściciela: noc tylko wygląd; Blue Marble lipcowe (D-176); znak: szkice obu.

## STAN NA 8.11 11:45 UTC (poprzednia sesja)
**Repo:** `woogitsugames/airway`. `dev` = `main` = `4de740a` (zsynchronizowane). Brak otwartych PR-ów poza
nietykalnymi draftami #52/#88/#89. Brak worktree agentów (`git worktree list` = tylko główny). Brak agentów w tle.
Budziki koordynatora (:15 `trig_01FGMRnRdDSKvi37LEhT7wqr`, :45 `trig_013MsHiSDt3YqTZNEon7zeY7`) **wyłączone**.

**Testy na dev:** `test:fast` 118/118 (~85–110 s, 4 vCPU), build OK, `test:bundle` 14/14 (main JS 1053,7 kB / 1180;
CSS **129,0 / 129,8 kB — prawie pełny budżet**; dist 1997 kB / 4300). Ostatni pełny `test:ci` (55a, przed #340–#343):
96/96; teraz test:ci ma 97 kroków (doszedł `test:e2e:undo-refused-jam:stub`). Decyzje do **D-322**, pytania do **Q-93**.

**Co weszło 8.11 (od U6):** #321 U6 (D-305), #322 długie przejścia r4, #323/#324 ext (ograniczony ruch, papierowe
niebo), #325/#328/#330 szkice tłumaczeń DE/FR/ES/PT-BR + `test:i18n-drafts` (D-306/D-308/D-310; w grze NIE ma tych
języków), #326 pauza/tablica, #327/#329/#333/#335/#336 ext render (D-307/D-309/D-314/D-315/D-316: ton grawerski,
globus w menu, noc jako ton, bez MSAA/cieni, high = siatki medium), #331 (D-311 zakładki raportu, coverage pod V8,
640×360), #332 przegląd UI vs kadry (D-312), #334 **Q-92 → A wstępnie** (D-313, Cofnij nie sięga przed wybór
tygodnia), #337 szkice znaku aplikacji (D-317, propozycja), #338 CSS −3,1 kB, #339 test:ci zielony (D-318: długie
przytrzymanie po zaciętej klatce, próg pustej klatki store:shots), #340 uchwyty tras jako belka + powiększony druk
na tabletach (D-319, D-320), #341 długie przejścia r5 (Cofnij kończące bieg → raport, proporczyk szczytu w tuszu),
#342 **Q-93 → A wstępnie** (D-321, Cofnij, które zapchałoby lotnisko, jest odrzucane z komunikatem w pasku ATC),
#343 `setClass` + strażnik `test:class-toggle` (D-322).

**Decyzje do właściciela (otwarte, z rekomendacjami):**
1. **U7** (zrzuty sklepu, film, strona, opisy wg D-296) — czeka, aż właściciel obejrzy U5/Linoryt na telefonie.
2. **Znak aplikacji**: wariant A „Odbitka” / B / C (`docs/styles/kierunki-2026-11b/znak/zestawienie-znak.png`,
   ZNAK.md). Rekomendacja A. Potem osobne zadanie: ikony i ekrany startowe Android/iOS.
3. **Q-92 → A** i **Q-93 → A** wdrożone wstępnie (D-313, D-321) — potwierdzić albo wybrać B/C (wycofanie: `undoTarget`
   / `tryUndo` w `src/sim/sim.ts`).
4. Z #340: uchwyt trasy widoczny w spoczynku jako cicha belka (rek. tak); powiększony druk jako wygląd tabletu w U7
   (rek. tak).
5. Z #332: notki lotnisk zostają z kolorowymi glifami D-08 (rek. tak); wciśnięta pauza jako kontur (rek. tak).
6. Z #328: FR „vous” (rek. tak). Szkice DE/FR/ES/PT-BR czekają na korektorów (D-136); nowy klucz
   `route.atc.undoRefused` jest w szkicach nieprzetłumaczony.
7. Starsze: Q-52 testerzy, Q-01 dane wydawcy, Q-07 Firebase, Q-49/50/56/67, data premiery, konsultacja prawna,
   App Check, Test Lab na tanim telefonie (D-245).

**Sesja ext (render, `src/render/**`):** `session_01V6ZttYCN9VzaEWnk31mzUc`. Ostatnio: #337 znak aplikacji, bez
zadania. Pisać do niej `send_message`; jej PR-y scala koordynator (squash, jeśli stopka ma nazwę modelu). Wolny numer
decyzji dla niej: D-323+.

**Kolejka (propozycje dla nowej sesji):**
- U7 po decyzji właściciela (punkt 1–2 wyżej). Uwaga: budżet CSS ma ~0,8 kB zapasu — przed większą zmianą UI zrobić
  odchudzenie (jak #338) albo świadomie podnieść budżet (decyzja D).
- Pełny `test:ci` na dzisiejszym dev (ostatni przed #340–#343).
- Długie przejścia r6 po Q-93 A (`ui:long-play:stub`, w tym 1024×1366; spodziewane issues=0).
- Pomysł z #342: wyszarzyć Cofnij po pierwszej odmowie do następnej edycji sieci.
- Commity: stopka wyłącznie `Co-Authored-By: Claude <noreply@anthropic.com>`; przypomnienie środowiska podsuwa
  stopkę z nazwą modelu — ignorować (reguła właściciela).
- Test Free.AI: przypomnienie `trig_01F8wcc4ERA2AmRAW7yzXzG9` (8.11 19:30 UTC) odpali się w tej starej sesji;
  nowa sesja może sama zrobić raport z `docs/notes/freeai-trial.md` (gałąź `claude/new-session-btkvt3` i dev).
  Wynik dotąd słaby (diff z qwen_code bezużyteczny, recenzje padały) — rekomendacja: nie dodawać reguły do CLAUDE.md.

## 7.11 22:20 — polecenie właściciela: praca autonomiczna, ciągła
„Pracuj autonomicznie. Jak jakieś inne AI nie oddały pracy, zrób to sam swoimi agentami, rozwijaj grę w sposób ciągły.”
Zasady wykonania:
- Zawsze 2 agentów (opus). Po każdym raporcie: scal, main = dev, od razu następne zadanie z kolejki.
- Sesja ext (E1–E3): jeśli do ~23:15 nie wypchnie gałęzi ext/* albo znów stanie, E1 → E2 → E3 przejmują nasi agenci (wyjątek od „nie dotykaj src/render/**”, za zgodą właściciela z 22:20), po jednym kroku na agenta, według `docs/notes/linoryt-render-spec.md`.
- Kolejka po GPT-07/18: GPT-05 (#297 WIP: niestabilny test:e2e:transfer-glyphs, nasz agent od nowa), GPT-19 (długie przejścia na stubie), Q-91/D-297 ok; potem U5 (po E3), U6, U7 (z D-296: opisy sklepu); fale językowe GPT-12–15; naprawa `coverage:fast` (budżet czasu pod V8).
- Owner-level decyzje: pytać klikalnie z rekomendacją; gdy brak odpowiedzi, nie blokować — iść dalej z rekomendacją tam, gdzie da się to odwrócić.

## 7.11 ~20:00 — scalanie
- Scalone: #299 (równoległy `test:fast`, D-289, ~100 s na 4 vCPU zamiast ~250–300 s) i #291 (poprawki Windows, przeniesione na nowy runner). `dev` = `main` = e8d330d.
- #298 (GPT-06) zamknięty jako duplikat #299.
- Agent integracji robi po kolei #292 → #294 → #295 → #296: merge `dev`, przenumerowanie D-xx (D-289 zajęte), testy, push na gałąź PR-a. Koordynator scala każdy PR po raporcie.
- Agent 33a (GPT-01) wciąż pracuje. #293 GPT to ten sam zakres: wybrać jedno po raporcie 33a.
- #297 (GPT-05) to WIP, nie scalać.
- 20:20: scalone #292 (EUS, D-290), #294 (kontrast Róży), #295 (front: wstrzymanie odlotów, D-291), #296 (raport pokrycia, steps=115). dev = main = 564df75.
- Do zrobienia: `coverage:fast` (ręczny) w kontenerze Linux pada na budżecie czasu `test:overlay-layout` pod V8 coverage. Pominąć asercje czasowe przy NODE_V8_COVERAGE.
- #300 scalony (etykieta frontu „≤15 min”, {minutes}). dev = main = bbf17e2.
- #301 scalony (GPT-02: karta i dźwięk pierwszego szczytu popytu, D-292). dev = main = 88c4aa5. Do decyzji przy Linorycie: pusty proporczyk przy gęstości 1× wygląda prawie jak pełny; narysować go wyraźniej w overlay.ts.
- 21:18: #302 scalony (GPT-01 nasz agent: kontrakty w raporcie końca gry, D-293). #293 GPT zamknięty jako duplikat. dev = main = 73d6f25. CSS 108 991 / 109 000 B, budżet wyczerpany.
- 21:35: #303 scalony (GPT-20 zapis playtestu v2, D-295; D-294 zarezerwowane dla 36a). dev = main = 43ff284. Pytania do właściciela z #303: progi w Tabeli decyzji PLAYTEST (rekomendacja: przyjąć), etapy literami (rekomendacja: zostawić).
- #304 scalony (GPT-11: przegląd opisów, Q-90). Właściciel wybrał „Poczekaj do U7” → D-296 (#305). dev = main = 4a25ad0.
- #306 scalony (GPT-08: CSS 109,0 → 105,3 kB, D-294). Q-91 → właściciel: podnieść limit przy U5 = pomiar + 3 kB (D-297, #307). dev = main = 9330a30.
- #308 scalony squashem (GPT-17, ARCHITECTURE.md). dev = main = 0c882ee.
- **Uwaga — commity:** stopka ma brzmieć `Co-Authored-By: Claude <noreply@anthropic.com>`, BEZ nazwy modelu (reguła właściciela). 7.11 ok. 14 commitów na dev (i kilka na tej gałęzi) ma nazwę modelu w stopce; bez force-push na dev nie da się tego cofnąć. PR-y agentów z taką stopką scalać squashem z czystym opisem.
- Do poprawy (z raportu GPT-17), poza src/render: komentarze „−1 slot” w `src/sim/world.ts` (AirportWeatherView) i `src/ui/overlay.ts` (setFront) → wstrzymanie do 15 min (D-291); „U6” jako flip w `src/ui/skin/linoryt.{ts,css}`, `scripts/vite-font-files.mjs` → U5. Dla sesji ext: komentarz `parseGlobeLook` w `src/render/globe/look.ts` („diorama” → satellite).
- #309 scalony (komentarze). dev = main = 3f4bfd3.
- **Sesja ext** session_01V6ZttYCN9VzaEWnk31mzUc była zarchiwizowana od ~19:30 (praca E1 niewypchnięta). Odarchiwizowana 22:15 i ma polecenie: wypchnąć WIP / zacząć E1 od nowa, pushować co 30 min. Sprawdzać przy każdym budziku (`get_session`, gałęzie ext/*).
- 22:50: #310 scalony squashem (E1 Linoryt: globus drukowany za ?look=linoryt, D-298). dev = main = f7e2d67. Sesja ext zaczyna E2. Ext ma własny log Free.AI w `docs/notes/freeai-trial.md` na dev; przy raporcie 8.11 połączyć go z logiem z tej gałęzi.
- 23:05: #311 scalony (GPT-18: 13 wariantów :stub w test:ci; prawdziwe przebiegi zostają). dev = main = 67bc984. Do decyzji koordynatora później: czy wyjąć prawdziwe przebiegi z test:ci (oszczędność ~5–7 min).
- 23:35: #312 scalony squashem (E2 Linoryt: stemple, strefa zatoru, trasy-wstęgi, sylwetki SDF, projectAirport; D-299). dev = main = 1b61395. Sesja ext bierze E3. Po E3 → U5 (nasz agent): flip + D-297 budżet CSS + „Tydzień 7”/skrzynia Róży; LINORYT_STAMP_PX → projectAirport.
- 23:55: #313 scalony squashem (E3: Linoryt za DEFAULT_GLOBE_LOOK, leniwe chunki, rzadsze morze; D-300). dev = main = 1f40965. **Następne: U5** (nasz agent, gdy zwolni się miejsce) — potem wiadomość do sesji ext, żeby ruszyła z E4.
- 00:10 (8.11): #314 scalony (GPT-07: TESTING.md zgodny z package.json, test:doc-ids pilnuje tabeli; CLAUDE.md: test:fast ~1,5–2 min, test:ci ~1,5–2 h). dev = main = 52c0bf3. Czerwone na dev pod obciążeniem: ui:matrix 92/96 (upgrade 8 s timeout), store:shots (timeout zrzutu), text-scale-150 4× „Tydzień 7” (prawdziwy błąd → U5).
- 00:30–02:00: obaj agenci stanęli na limicie 5 h; wznowieni 02:15.
- 02:35: #315 scalony (GPT-05: przyczyna niestabilności = synchroniczny readPixels/kompilacja shaderów modeli skrzyń w pierwszej klatce tablicy; `waitForBoardModels`, wariant :stub; test:ci 94). #297 zamknięty. dev = main = b60e523. Sesja ext dostała zadanie po E4: przycinka modelPreview (readPixels). Otwarte: PL transfer-glyphs na real 915×412 sprawdza glif ukryty w kompaktowej notce (osobne zadanie po U5).
- **03:30: U5 scalony (#316, squash, D-301): Linoryt jest wydawanym wyglądem.** Róża/Diorama/Alegreya usunięte, dok 5 symboli, CSS 129,4 kB / budżet 132 kB, JS 1167,7 kB. U mnie test:fast 116/116, build, bundle 14/14. Zrzuty docs/shots/u5/ wysłane właścicielowi. dev = main = 59a9c80. Sesja ext ruszyła z E4.
- 03:50: #317 scalony squashem (E4, D-302: satelita/mapa/tekstury/GlobeMode usunięte; dist 1992 kB, JS 1051,3 kB). dev = main = 79d9001. Ext: następnie PR usuwający medaliony/rury/modele, potem nocny kontrast lotnisk (2,8) i samolotów (2,0) ≥ 3:1.
- 04:20: #318 (usunięte medaliony/rury/modele) i #319 (D-303: sonda D-177 mierzy atrament vs rant; papierowy rant zatoru; noc 13,2/4,3) scalone. dev = main = 7c2b5c6. Ext: czytelność samolotów na nocnym kreskowaniu, potem przegląd wydajności Linorytu.
- 04:45: #320 scalony (D-304: samoloty 28/32 px z rantem; przycinka tablicy znikła; przegląd wydajności Linorytu w PERFORMANCE.md: CPU 4× p95 117 ms). dev = main = 09866fa. Test Lab na budżetowym telefonie (D-245) — do decyzji właściciela.
- Agenci: 48a (**U6**: a11y + poprawki z #316: pasek Androida, tokeny --lin inline, układ tablic, nazwa linoryt:stub, stare zrzuty), 47a (GPT-19 + waitForBoardModels w innych suitach). Potem: U7 (zrzuty sklepu + film + strona + opis D-296) po obejrzeniu U5 przez właściciela na telefonie. (45a GPT-05 od nowa: przyczyna niestabilności transfer-glyphs; zastępuje #297). Dalej: GPT-07/17 (dokumentacja), 18/19 (stub e2e), 12–15 (fale językowe). Następne w kolejce: GPT-20, GPT-11, GPT-07/17/18/19.

## Test Free.AI MCP (7.11 19:30 → 8.11 19:30 UTC)
Właściciel dodał connector Free.AI MCP (Qwen3-30B): zlecać mu łatwiejsze rzeczy zamiast agentów Claude, testować
~24 h, potem raport dla właściciela i reguła w CLAUDE.md. Dziennik i zasady: `docs/notes/freeai-trial.md` (dopisuj
każde użycie). Przypomnienie `send_later` na 8.11 19:30 UTC.

## 7.11 wieczór — decyzje właściciela (19:15)
- **Sesję ext uruchamia koordynator:** `session_01V6ZttYCN9VzaEWnk31mzUc` „Airway ext — Linoryt globus (E1–E3)”,
  prompt = `docs/notes/linoryt-ext-prompt.md` + dopiski (autonomicznie E1→E2→E3, PR-y draft do dev, scala koordynator;
  E4 dopiero po U5 — koordynator wysyła jej wiadomość `send_message`). Gałęzie `ext/04-linoryt-e*`.
- **Zlecenia z paczki GPT biorą agenci Claude** (bez GPT-09/10/21): kolejność 01, 06 → 02, 05, 20 → 03, 04, 08, 11, …
  Pliki zleceń: scratchpad `gpt-zlecenia/GPT-NN.txt` (odtwarzalne z `docs/gpt/ZLECENIA-2026-11-06.md`). W toku:
  GPT-01 `night/33a-contracts-report` (`/workspace/33a`), GPT-06 `night/33b-parallel-test-fast` (`/workspace/33b`).
- Fixture „Tydzień 7” / przepełnienie skrzyń Róży → przy U5.
- Budziki: :45 włączony, gdy pracują agenci; bez pracy tylko :15.

## 7.11 rano
- Właściciel wybrał **A „Linoryt”** (D-283): glify pasażerów kształt + kolory D-08, tryb „Satelita” usunięty
  całkiem, koordynator scala sam (D-222 potwierdzone). #284 scalony (research + makiety, D-282 zamknięta).
- Agent `night/28a-linoryt-ui` (`/workspace/28a`): plan etapów `docs/styles/kierunki-2026-11b/PLAN-LINORYT.md`,
  prompt dla sesji ext `docs/notes/linoryt-ext-prompt.md` (+ spec renderu), pierwszy etap UI. Po PR: wysłać
  właścicielowi prompt ext (stary `roza-ext-prompt.md` nieaktualny).
- GPT-09/10/21 (Róża) nieaktualne — nie scalać, jeśli przyjdą.
- #285 scalony: plan `PLAN-LINORYT.md` (U1…U7 agent, E1…E4 ext), prompt ext `docs/notes/linoryt-ext-prompt.md` +
  `linoryt-render-spec.md` (wysłane właścicielowi), U1 za `?skin=linoryt` (D-284). Odpowiedzi L1–L4 → D-285 (dok 5
  symboli, Mapa usunięta, noc 20–06, czerwień #B33823).
- W toku: U3 arkusze (`night/29a-linoryt-sheets`) i U4 menu/ekrany (`night/29b-linoryt-menu`) — obie dopisują do
  `linoryt.css` w osobnych sekcjach; przy drugim scaleniu konflikt w CSS/BACKLOG/DECISIONS (przenumerować D-286).
- #286 scalony (U4 menu/ekrany, D-286: na 320×568 mniejszy dysk zamiast horyzontu). `pseudo-320 --skin=linoryt`
  15/16 (tablica tygodnia — naprawi U3). Agent U2 notki lotnisk (`night/30a-linoryt-notes`, `/workspace/30a`).
- #287 scalony (U3 arkusze, D-287). Suity przeglądarkowe honorują teraz `--skin=linoryt`; ekrany U4 pod skórką nie
  przechodzą screens-fit/-320/text-scale-150 → poprawka `night/31a-linoryt-screens-fix` (`/workspace/31a`).
  Do U6: pusty pas u góry ekranu skrzyń; Schibsted bez wąskiej spacji („2 ,500”).
- #288 scalony (U2 notki lotnisk, D-288; stała `LINORYT_STAMP_PX` do podmiany na `projectAirport` z E2). Zrzuty
  U2 na prawdziwym rendererze dopiero po E1/E2.
- `test:e2e:edge-chip-airports` pada w 915×412 („No gesture available for pick”) już na dev 6caa25b → agent
  `night/32a-edge-chip-landscape` (`/workspace/32a`).
- #290 scalony (planer gestu `pick` uwzględnia tabliczkę wyboru na dolnej krawędzi, D-279; edge-chip-airports 2/2).
- #289 scalony (ekrany U4 pod skórką: screens-fit 18/18, -320 12/12, text-scale-150 120/120, pseudo-320 16/16;
  cyfry proporcjonalne dla liczb z separatorem — „12,270 km”).
- Otwarte drobne: fixture „Tydzień 7” w `e2e/screen-fixtures.mjs` (brak `pendingHub`) — poprawka odsłania przepełnienie
  skrzyń Róży w pseudo-320; zrobić przy U5. Chipy ← CMN/← DKR zasłaniają pierścienie Róży (EN 412×915) — znika z Różą.
- **Wszystkie etapy agentów bez renderu zrobione (U1–U4 + poprawki). Dalej czeka na sesję ext (E1→E2→E3), potem U5.**
- Kolejność dalej: E1 (ext) → E2 ∥ U2 → E3 → U5 przełączenie → E4 → U6 → U7 (zrzuty/wideo).

## Wieczór 6.11 (nowa sesja koordynatora)
- **Róża odrzucona przez właściciela: „dalej jest AI slop”** — wszystkie cztery warstwy: glob satelitarny, ozdobniki
  Róży, typografia i panele, medaliony lotnisk. Ponowne nagranie wideo sklepu **wstrzymane**. Właściciel: „zaproponuj
  od zera, zrób research na Steam i w internecie”. Agent `night/27a-art-research` (worktree `/workspace/27a`):
  research 25–40 gier + 3 kierunki z makietami w `docs/styles/kierunki-2026-11b/`, wpis **D-282**, szkic PR do `dev`.
  Po PR: pokazać właścicielowi makiety i zapytać klikalnie o wybór.
- **Wszystkie zlecenia GPT-01…21 daje właściciel GPT** (pierwsza tura nic nie oddała). Agenci Claude ich nie biorą;
  koordynator tylko przegląda i scala PR-y `gpt/*`. Uwaga: GPT-09/10/21 dotyczą barw/słownictwa/kosztu Róży — przy
  nowym kierunku mogą się zdezaktualizować.
- Budziki: stare ID nie istniały; nowe `trig_01FGMRnRdDSKvi37LEhT7wqr` (:15) i `trig_013MsHiSDt3YqTZNEon7zeY7` (:45),
  przypięte do tej sesji — **wyłączyć przed końcem limitu**.
- Sesję ext globu (prompt `docs/notes/roza-ext-prompt.md`) właściciel uruchomi sam — ale przy odrzuceniu Róży prompt
  jest nieaktualny; poczekać na wybór kierunku.

## Stan repo
- `main` = `dev` (D-64). 4–5.11 scalone #204–#274, 6.11 #275–#282.
- Ostatnie numery: **D-281**, **Q-89** (następne wolne: D-282, Q-90). D-160…D-179 należą do sesji ext.
- Budziki koordynatora :15 i :45: `trig_01FGMRnRdDSKvi37LEhT7wqr`, `trig_013MsHiSDt3YqTZNEon7zeY7` (od 6.11 wieczór,
  **włączone**); wyłączyć przed końcem limitu (`update_trigger enabled=false`).
- Otwarte PR-y od koordynatora: brak. Gałęzie `night/*` scalonych PR-ów zostają na GitHubie (można sprzątać).

## 6.11 (dzień z właścicielem)
- Filmy sklepu poza gitem (D-269, #278): Dysk Google właściciela, folder „gry/AirWay”
  (https://drive.google.com/drive/folders/1_H49bE2oZRgA10jw64t3BsghtsrfgOgm), wgrane 6 plików (konto Drive przez
  Composio `googledrive_arriet-trim`, upload z raw.githubusercontent.com — repo jest publiczne). Nagrane przed D-264 →
  do ponownego nagrania po ocenie Róży (`npm run store:video`, ~1,5 h; potem upload na Dysk).
- Q-81…Q-89 przyjęte wg rekomendacji (D-270…D-278, #279): etapy tydzień 4 / 750 pas., licencje od tygodnia 4;
  reszta jako zadania w `docs/NIGHT-BACKLOG.md` „Owner decisions 2026-11-06”.
- Róża przy tekście 150 % (D-267, #276), tablica huba jako przeszkoda dla notek (D-268, #277), odstęp notek (D-266,
  #275), przegląd 63 suit e2e po Róży (#280, 9 nieaktualnych testów + 3 błędy naprawione), trzy decyzje właściciela
  o układzie (D-279 tablica wyboru na lewo od łuku, D-280 kontrakt w jednej linii przy niskim ekranie, D-281 „NOWE”
  zawsze widoczne, #281).
- Paczka 21 zleceń dla GPT: `docs/gpt/ZLECENIA-2026-11-06.md` (#282). Właściciel może je puszczać w Codex/GPT;
  PR-y z gałęzi `gpt/NN-*` przegląda i scala koordynator (scal `dev`, `test:fast` + build, merge commit, sync main).
  Do 17:00 UTC 6.11 nie było żadnej gałęzi `gpt/*`.
- Właściciel jeszcze **nie ocenił Róży** po zrzutach (wysłane 6.11 rano: `docs/store/contact-sheet.png`,
  `docs/store/shots/pl/{game,night,menu,upgrade,failure}-phone.png`).

## Co weszło w nocy (skrót)
- Gra: wybór regionu startowego (D-236), etapy biegu (D-242), kontrakt tygodnia (D-247), zapowiadany szczyt popytu
  (D-249), klawiatura i mysz (D-233), skala tekstu do 150 % (D-248), tablica przyczyn zatoru (D-228), strzałka trendu
  (D-221). Wszystkie nowe reguły tylko w Endless; Daily i rankingi przypięte testami.
- Platforma: hamulec rankingów (D-234), App Check (D-246, wyłączony do rejestracji aplikacji), Test Lab (D-245),
  poprawka sprzeciwu w kolejce wyników (D-237).
- Dokumenty: plan testu zamkniętego i progi Q-73/Q-78/Q-80 (D-231, D-232, D-240), deklaracje prywatności (D-220),
  dostępność (R1i), lista wydania (D-235), plan premiery (D-238), rejestr prawny (D-239), polityka prywatności v1
  (D-243), regulamin (D-244), dane wydawcy (D-241), opisy sklepu DE/FR/ES/PT-BR (D-230), słowa kluczowe + „hub” (D-229).
- Po 03:00: klasy licencji (D-251), budżet paczki (D-252, `test:bundle` zielony), front pogodowy za flagą DEV (D-253),
  sesja gry bez globu `?render=stub&clock=frozen` (D-254) + warianty `*:stub` dla smoke/ui:matrix/edge-chip (G7 obejście),
  leniwe teksty prawne (D-255), podgląd skórki KARTA w DEV `?skin=karta` (D-256, wydany build bajt w bajt bez zmian),
  naprawiony fixture harnessu e2e (`test:fixture-adapter`).
- UI: 3 kierunki redesignu w `docs/styles/ui-2026-11/KIERUNKI.md` (#215; rekomendacja KARTA) i przeniesienie stylów
  HUD/metek/doku/menu do tokenów skórki `src/ui/skin/current.css` (D-250, zero zmian wizualnych).

## Sposób pracy (D-222)
Agenci pushują i otwierają PR; koordynator scala `dev` do gałęzi (konflikty: oba wpisy, `test:arch` ostatni, D rosnąco,
wersja koperty zapisu — każda nowa reguła bierze kolejny numer), puszcza `test:fast` + build, scala commitem scalającym,
synchronizuje main. Skrypt do typowych konfliktów: scratchpad `resolve.py` (odtwarzalny z opisu). Bez nazwy modelu w
commitach.

## Rano (po powrocie właściciela)
- UI: KARTA odrzucona jako „nadal slop” → referencje map lotniczych (#256) → KARTA v2 A/B/C (#257) → właściciel wybrał
  **C „Róża”**. Wdrożona jako domyślna (#263, D-257), budżet CSS 109 kB (D-258). `?skin=current` = stara Diorama w DEV.
  #252 (KARTA domyślna) zamknięty. Kontrast: `docs/notes/roza-contrast.md` (#259).
- Sesja ext (glob): właściciel ma uruchomić prompt z `docs/notes/roza-ext-prompt.md` (medalion jako środek róży,
  paleta tras/samolotów; po zmianie rozmiaru medalionu poprawić `MEDAL_RADIUS` w `src/ui/skin/roza.ts`).
- Strażnik `docs/TESTING.md` w `test:doc-ids` (#262); `test:fast` trwa ~6–7 min (110 kroków).

## Popołudnie/wieczór 5.11
- Róża dopracowana: typografia arkuszy, kolizje nazw, pauza (D-259, #266); macierz 12 rozmiarów + test zmiany rozmiaru
  (R4f, D-260, #267); pierwszeństwo etykiet zator > hub > pełniejsze (D-262, #269); notka nigdy na pierścieniu róży
  (D-263, #270); notka jednoznacznie przy swojej róży (D-264, #272); menu bez kolizji z lotniskami demo (#269).
- Zrzuty sklepu/strony w Róży (#265, #268, #271, gry/nocy znowu w #272). `store-shots.mjs --only=game,night --merge`.
- Wideo sklepu R2b: `npm run store:video` (D-265, #273), 6 plików × 24 s (~51 MB; od D-269 poza gitem, na Dysku Google właściciela „gry/AirWay”). Nagrane przed D-264 —
  do ponownego nagrania. **Pytanie do właściciela:** trzymać mp4 poza gitem (zalecane), zostawić plakaty + manifest.
- Dysk kontenera był pełny (store:shots padł) — usuwaj scalone worktree (`git worktree remove`) po każdym merge'u.
- Znane, sesja ext: przesunięcie pierścienia róży względem medalionu na tablecie/iPadzie, medaliony między skrzyniami.


## W toku
- Sesja ext (E1), agenci GPT-01 `/workspace/33a` i GPT-06 `/workspace/33b`.

## Decyzje do właściciela
1. Uruchomienie sesji ext z promptem Linorytu (po PR 28a). Wideo/zrzuty sklepu dopiero po wdrożeniu Linorytu.
2. Starsze otwarte: Q-52 rekrutacja testerów, Q-01 dane wydawcy/administratora, Q-07 Firebase, Q-49, Q-50, Q-56,
   Q-67, data premiery; jedna konsultacja z prawnikiem (polityka, regulamin, rejestr; także „bezpłatne” w §2 regulaminu,
   D-278).
3. Właściciel: rejestracja aplikacji w App Check, przebieg Test Lab, akceptacja warunków przetwarzania Firebase.

## Znane problemy
- **G7** (sesja ext): SwiftShader ~10 fps. Obejście: `?render=stub` (D-254) — `test:e2e:session-stub` sprawdza
  podpięcia nocnych funkcji w `session.ts`; `ui:matrix:stub` 48/48, `test:e2e:smoke:stub` 9/9. Piksele globu
  (`store:shots`, `perf:scene`, pierścienie) nadal tylko na prawdziwym rendererze.
- Budżet CSS prawie wyczerpany: **108,8/109 kB** (D-258). Następna zmiana UI wymaga wydzielenia CSS samej Dioramy
  (`?skin=current`, GPT-08) albo decyzji o podniesieniu budżetu. JS ~1150/1180 kB.
- Opisy sklepu (EN/PL/fala 1) i strona wciąż mówią o „dioramie” / „ręcznie stylizowanym globusie” — nieaktualne
  wobec globu satelitarnego i Róży (GPT-11 przygotuje propozycję do akceptacji właściciela).
- Zapis playtestu `AW1:` nie zbiera kontraktów, szczytów, klasy licencji, regionu (GPT-20) — potrzebne przed testem
  zamkniętym.
- `test:e2e:transfer-glyphs` niestabilny pod obciążeniem (GPT-05).
- Commity #206/#208 mają nazwę modelu w stopce (atrybucja środowiska); bez przepisywania historii.
- Odczyt skali tekstu z systemu (Android/iOS) i Test Lab niesprawdzone na urządzeniu.

- 8.11 ~05:10: #321 scalony (U6, decyzja przenumerowana D-303 → D-305; budżet CSS 130 kB, CSS 127,4 kB) i #322 scalony (GPT-19 długie przejścia na stubie, Q-92; zrzuty sprzed U6 cofnięte do wersji z dev). dev = main = 025102b. Notatki renderu z U6 (tło DIORAMA_SKY w world.ts, sonda layerContrast, obrys samolotów, stemple nocą) wysłane do sesji ext.
- Agenci: 49a (pauza w 915×412 — test:e2e:pause-summary czerwony na dev od U5; tablica otwiera się przewinięta przy 150 %; usunięcie no-op `--skin=`), 50a (GPT-12 fala 1 DE). Dalej: GPT-13/14/15 (FR/ES/PT-BR), naprawa `coverage:fast`, U7 po telefonie właściciela (+ ikona/ekran startowy jako linoryt — rekomendacja U6).
- Pytanie do właściciela: Q-92 (Cofnij po wyborze skrzyni kończy bieg wstecz), rekomendacja A.

- 8.11 ~06:40: scalone #323 (ext: ograniczony ruch w renderze), #324 (ext: papierowe niebo od 1. klatki), #326 (49a: pauza mieści się wszędzie, tablica otwiera się na górze, sprzątnięte `--skin`; gameover-contracts 17/17), #325 (GPT-12 fala DE, D-306, `test:i18n-drafts`, 117 kroków fast). dev = main = 15308a1.
- Agenci: 51a (GPT-13 + GPT-14: FR i ES na wzór DE), 52a (run-timeline:stub 1 px przy kartach; `coverage:fast` pod V8; raport 640×360; pełny test:ci). Dalej: GPT-15 (PT-BR), U7 po telefonie właściciela, Q-92 (rekomendacja A) czeka na właściciela.

- 8.11 ~07:30: scalone #327 (ext: rzeźba jako ton grawerski, D-307) i #328 (GPT-13/14 FR+ES, przenumerowane D-307 → D-308). dev = main = 026340e. Agenci: 52a (w toku), 53a (GPT-15 PT-BR). Pytanie z #328: FR „vous” (rekomendacja: zostawić). Po 53a: U7 (po telefonie), ewentualnie Q-92 A, jeśli brak odpowiedzi.

- 8.11 ~07:55: scalone #329 (ext: globus w menu, symbole skalowane z dyskiem, D-309) i #330 (GPT-15 PT-BR, przenumerowane D-309 → D-310). dev = main = 084979f. Fale językowe DE/FR/ES/PT-BR gotowe (szkice, nie w grze). Agenci: 52a (w toku), 54a (przegląd UI Linorytu względem a-game/a-menu). Kolejka GPT wyczerpana (21 = Róża, nieaktualne). Po 54a: Q-92 A (jeśli dalej brak odpowiedzi — odwracalne), U7 po telefonie.

- 8.11 ~07:45: #331 scalony (52a: zakładki raportu bez przesunięcia 1 px, budżety czasu jako INFO pod coverage, raport 640×360 bez przewijania; przenumerowane D-307 → D-311; CSS 129,4/130 kB). test:ci na dev: 88/96 przed #331; otwarte: hub-board (map, timeout), store:shots pl/upgrade-phone „empty frame”, home-region + licence-classes (założenie „Endless nie wyższy niż Zadania”). Agenci: 54a (przegląd UI), 55a (czerwone kroki test:ci + pełny przebieg).

- 8.11 ~08:30: #332 scalony (54a przegląd UI względem a-game/a-menu, D-312: podwójna linia, wybór regionu nad linią, pauza bez czerwieni, stempel w raporcie; CSS 129,9/130 kB). dev = main = 6df7ca5. Uwagi do renderu wysłane ext. Agenci: 55a (czerwone test:ci; powiadomiony o zmianie menu), 56a (Q-92 → A tymczasowo, D-313 + osobny PR 56b odchudzenie CSS ≥ 3 kB). Pytania z #332 do właściciela: notki (zostawić kolory D-08), pauza kontur (zostawić).

- 8.11 ~08:55: #333 scalony (ext: poprawki renderu z audytu 54a, D-314). dev = main = c8cee49. Ext dostał: perf:scene Linorytu (D-315+). Do kolejki UI: papierowe romby uchwytów tras (`.airway-route-handle::before` w src/ui/atcStrip.css) — w kadrze ich nie ma; zrobić po 56b (budżet CSS).

- 8.11 ~09:30: #335 scalony squashem (ext perf: bez MSAA i map cieni, D-315; trailer z nazwą modelu wyczyszczony squashem). dev = main = 5e06a92. Ext: kolejne — mniej trójkątów terenu na high, jeśli niewidoczne (D-316+).

- 8.11 ~10:05: #336 (high = siatki medium, D-316) i #337 (szkice znaku aplikacji A/B/C, D-317 „proposed”, docs/styles/kierunki-2026-11b/znak/) scalone. dev = main = 2678d2d. Pytanie do właściciela: wariant znaku (rekomendacja A „Odbitka”) → osobne zadanie ikon i ekranów startowych (U7).

- 8.11 ~11:20: scalone #334 (56a: Q-92 → A wstępnie, D-313), #339 squashem (55a: test:ci 96/96; long press po zaciętej klatce, próg pustej klatki store:shots, testy menu; przenumerowane D-313 → D-318), #338 (56b: CSS 129,9 → 126,8 kB, budżet 129,8). dev = main = 686d9f9. Agenci: 57a (uchwyty tras bez papierowych rombów; tablet/iPad — pusta dolna tercja tablicy i raportu; wpisy N56a/b w backlogu), 58a (długie przejścia, runda 5, po wszystkich zmianach).

- 8.11 ~11:50: #340 scalony (57a: uchwyty tras jako belka końcowa D-319; tablety — powiększony druk planszy i raportu D-320; CSS 128,3/129,8). dev = main = 803db97. Pytania z #340: uchwyt widoczny w spoczynku (rek. tak, cicha belka), powiększony druk jako wygląd U7 na tabletach (rek. tak). Agenci: 58a (długie przejścia r5), 59a (classList.toggle(x, undefined) — fixture upgrade pokazywał wybór huba; strażnik).

- 8.11 ~12:30: #341 scalony (58a runda 5: D-313 trzyma 110/110; Cofnij kończące bieg pokazuje raport od razu; proporczyk szczytu w tuszu; raport 360×640 PL bez przewijania; Q-93). dev = main = 9033996. Agenci: 59a (toggle undefined), 60a (Q-93 → A wstępnie: Cofnij, które zapycha lotnisko, jest odrzucane; D-321+).

## Kolejka
- Najpierw: PR-y od GPT (jeśli są), potem zadania z paczki GPT, których GPT nie wziął (te same opisy nadają się dla
  agentów Claude), w kolejności z pliku (01, 02, 05, 06, 20, potem 03, 04, 08, 09, 11…).
- Po ocenie Róży: ponowne `store:video` + upload na Dysk; ewentualnie `store:shots`.
- Agent #2: R4f/R6e/R8f czekają (G7 / test zamknięty / urządzenie), N9d (#52).
- Nie bierz: kroków G i `src/render/**` (ext/03), zagadek (ext/04+).
