# Przekazanie koordynatora Airway

Ostatnia aktualizacja: 2026-11-05, ok. 13:00 UTC. Właściciel wybrał UI „Róża” (D-257) — scalone jako domyślne (#263).

## Stan repo
- `main` = `dev`. W nocy scalone #211–#248, rano #249–#263.
- Ostatnie numery: **D-258**, **Q-89**. D-160…D-179 należą do sesji ext.
- Budziki koordynatora :15 i :45 (włączone): `trig_011aYp1uohavDkngVDFRndoA`, `trig_01TQogjhSE2ggjutqxxB6TtS`.

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
- Strażnik `docs/TESTING.md` w `test:doc-ids` (#262); `test:fast` trwa ~6 min (107 kroków).

## W toku
- Agent #1: dopracowanie Róży — kapitaliki w arkuszach, kolizje nazw po łuku, pauza w pionie (`night/14b-roza-polish`).
- Agent #2: zrzuty sklepu i strony w UI Róża (`night/14a-store-shots-roza`).

## Decyzje do właściciela rano
1. Ocena Róży w grze (zestawienie `docs/shots/ui-roza/zestawienie.png`) i uruchomienie sesji ext z promptem Róży.
2. Rozgrywka (arkusz `docs/OWNER-QUESTIONS.md`, sekcja B): Q-81 progi etapów, Q-82 kontrakt tygodnia, Q-83 szczyt
   popytu, Q-84 klasy licencji, Q-85 siła frontu pogodowego, Q-86 mediana regionu EUS.
3. Wydanie (sekcja F): Q-87 zlokalizowane tytuły sklepu, Q-88 PEGI 3 / Apple 4+ / grupa 13+, Q-89 „bezpłatne”
   w regulaminie.
4. Starsze otwarte: Q-52 rekrutacja testerów, Q-01 dane wydawcy/administratora, Q-07 Firebase, Q-49, Q-50, Q-56,
   Q-67, data premiery; jedna konsultacja z prawnikiem (polityka, regulamin, rejestr).
5. Właściciel: rejestracja aplikacji w App Check, przebieg Test Lab, akceptacja warunków przetwarzania Firebase.

## Znane problemy
- **G7** (sesja ext): SwiftShader ~10 fps. Obejście: `?render=stub` (D-254) — `test:e2e:session-stub` sprawdza
  podpięcia nocnych funkcji w `session.ts`; `ui:matrix:stub` 48/48, `test:e2e:smoke:stub` 9/9. Piksele globu
  (`store:shots`, `perf:scene`, pierścienie) nadal tylko na prawdziwym rendererze.
- Zapas budżetu paczki mały: JS 1146,8/1180 kB, CSS 107,2/109 kB (~1,7 %), dist 3955/4300 kB.
- Commity #206/#208 mają nazwę modelu w stopce (atrybucja środowiska); bez przepisywania historii.
- Odczyt skali tekstu z systemu (Android/iOS) i Test Lab niesprawdzone na urządzeniu.

## Kolejka po nocy
- Po dopracowaniu Róży: przegląd HUD/notek pod 150 % tekstu na prawdziwym globie, R2b wideo sklepu w nowym UI.
- Agent #2: R4f/R6e/R8f czekają (G7 / test zamknięty / urządzenie), N9d (#52).
- Nie bierz: kroków G i `src/render/**` (ext/03), zagadek (ext/04+).
