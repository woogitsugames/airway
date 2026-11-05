# Przekazanie koordynatora Airway

Ostatnia aktualizacja: 2026-11-05, ok. 06:55 UTC. Noc pracy autonomicznej (D-226); właściciel wraca o 9:00 czasu
brukselskiego.

## Stan repo
- `main` = `dev`. W nocy scalone #211–#248 (poprzednio #204–#210).
- Ostatnie numery: **D-256**, **Q-80**. D-160…D-179 należą do sesji ext.
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

## W toku
- Agent #1: R4b linia „czas słoneczny” w pomocy (`night/11aw-solar-time-help`).
- Agent #2: odświeżenie `store:shots` i `site:assets` na prawdziwym globie (`night/12bh-store-shots-refresh`).

## Decyzje do właściciela rano
1. **Kierunek nowego UI** (KARTA / KOKPIT / ZNAKI). KARTA da się obejrzeć w grze: build DEV + `?skin=karta`
   (zrzuty `docs/shots/ui-karta/`). Po wyborze: wdrożenie jako domyślnej skórki na tokenach D-250.
2. Etapy biegu: zamienić „tydzień 5” i „1000 pasażerów” na „tydzień 4” i „750” (bot prawie ich nie osiąga).
3. Kontrakt tygodnia: trudność (100 % popytu, limit 60), obie strony czy A→B, kara/„przyjmij”, nagroda, raport.
4. Szczyt popytu: +12 przez 6 h, zapowiedź o dobę, karta „pierwszy raz”/dźwięk, kiedyś w Daily?
4b. Front pogodowy (D-253): „−1 slot” nic nie zmienia dla bota — mocniej? rozmiar/częstość?
5. Klasy licencji: próg 5. tygodnia (bot 0,5 %), Daily liczy się do odblokowania?, klasa II zbyt łagodna?
6. Region startowy: mediana EUS 18,49 min (poza 10–18).
7. Zlokalizowane tytuły sklepu („Airway: Flugrouten am Globus”), PEGI 3 / Apple 4+, grupa 13+ (D-235).
8. Q-52 rekrutacja testerów, Q-01 dane wydawcy/administratora, Q-07 Firebase, Q-49, Q-50, Q-56, Q-67,
   „bezpłatne” w regulaminie, data premiery; jedna konsultacja z prawnikiem (polityka, regulamin, rejestr).
9. Właściciel: rejestracja aplikacji w App Check, przebieg Test Lab, akceptacja warunków przetwarzania Firebase.

## Znane problemy
- **G7** (sesja ext): SwiftShader ~10 fps. Obejście: `?render=stub` (D-254) — `test:e2e:session-stub` sprawdza
  podpięcia nocnych funkcji w `session.ts`; `ui:matrix:stub` 48/48, `test:e2e:smoke:stub` 9/9. Piksele globu
  (`store:shots`, `perf:scene`, pierścienie) nadal tylko na prawdziwym rendererze.
- Zapas budżetu paczki mały (D-252): JS +4,2 %, CSS ~+0,3 %, dist ~+0,6 %.
- Commity #206/#208 mają nazwę modelu w stopce (atrybucja środowiska); bez przepisywania historii.
- Odczyt skali tekstu z systemu (Android/iOS) i Test Lab niesprawdzone na urządzeniu.

## Kolejka po nocy
- Po wyborze kierunku UI: wdrożenie skórki (Agent #1), potem przegląd HUD/metek pod 150 % tekstu.
- Agent #2: R4f/R6e/R8f czekają (G7 / test zamknięty / urządzenie), N9d (#52).
- Nie bierz: kroków G i `src/render/**` (ext/03), zagadek (ext/04+).
