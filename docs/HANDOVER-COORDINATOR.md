# Przekazanie koordynatora Airway

Ostatnia aktualizacja: 2026-11-07, ok. 19:20 UTC. Nowa sesja koordynatora (wieczór 6.11) pracuje ciągle; budziki
włączone. Nowa sesja startuje promptem z `docs/notes/coordinator-start-prompt.md`.

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

## Kolejka
- Najpierw: PR-y od GPT (jeśli są), potem zadania z paczki GPT, których GPT nie wziął (te same opisy nadają się dla
  agentów Claude), w kolejności z pliku (01, 02, 05, 06, 20, potem 03, 04, 08, 09, 11…).
- Po ocenie Róży: ponowne `store:video` + upload na Dysk; ewentualnie `store:shots`.
- Agent #2: R4f/R6e/R8f czekają (G7 / test zamknięty / urządzenie), N9d (#52).
- Nie bierz: kroków G i `src/render/**` (ext/03), zagadek (ext/04+).
