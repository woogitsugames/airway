# Przekazanie koordynatora Airway

Ostatnia aktualizacja: 2026-11-07, ok. 11:05 UTC. Nowa sesja koordynatora (wieczór 6.11) pracuje ciągle; budziki
włączone. Nowa sesja startuje promptem z `docs/notes/coordinator-start-prompt.md`.

## 7.11 rano
- Właściciel wybrał **A „Linoryt”** (D-283): glify pasażerów kształt + kolory D-08, tryb „Satelita” usunięty
  całkiem, koordynator scala sam (D-222 potwierdzone). #284 scalony (research + makiety, D-282 zamknięta).
- Agent `night/28a-linoryt-ui` (`/workspace/28a`): plan etapów `docs/styles/kierunki-2026-11b/PLAN-LINORYT.md`,
  prompt dla sesji ext `docs/notes/linoryt-ext-prompt.md` (+ spec renderu), pierwszy etap UI. Po PR: wysłać
  właścicielowi prompt ext (stary `roza-ext-prompt.md` nieaktualny).
- GPT-09/10/21 (Róża) nieaktualne — nie scalać, jeśli przyjdą.

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
- Agent `night/28a-linoryt-ui` (plan Linorytu, prompt ext, etap UI 1) — `/workspace/28a`.

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
