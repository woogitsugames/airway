# Przekazanie koordynatora Airway

Ostatnia aktualizacja: 2026-11-04, ok. 21:15 UTC. Sesja koordynatora pracuje w nocy autonomicznie (D-226); właściciel
wraca o 9:00 czasu brukselskiego.

## Stan repo
- `main` = `dev` po scaleniu #209 (i PR-a z tym plikiem).
- Scalone w tej sesji:
  - #204 pakiet startowy strony (N11ad, D-218);
  - #205 seedy ze stałą datą (N12aj, D-214);
  - #206 deklaracje prywatności (R1f, D-220);
  - #207 strona dla prasy + ZIP (R2e, D-219);
  - #208 karta dowodów dostępności (R1i);
  - #209 strzałka trendu zapełnienia (R4c, D-221).
- Decyzje właściciela z 2026-11-04 wieczorem: D-222 (scala koordynator), D-223 („hub” także w sklepie), D-224 (Q-03:
  „Device or other IDs”), D-225 („Sufficient Contrast” dopiero po G9b), D-226 (w nocy cały backlog po kolei).
- Ostatnie numery: **D-226**, **Q-80**. D-160…D-179 należą do sesji ext.
- Budziki koordynatora :15 i :45 (włączone): `trig_011aYp1uohavDkngVDFRndoA`, `trig_01TQogjhSE2ggjutqxxB6TtS`.

## Sposób pracy (D-222)
Filtr uprawnień nie pozwala subagentom scalać. Agenci pushują i otwierają PR (bez scalania); koordynator czyta raport,
w razie potrzeby scala `dev` do gałęzi (konflikty w Logu backlogu i liście `test:fast`: zostają oba wpisy,
`test:arch` zawsze ostatni), puszcza tylko tanie testy dotkniętego obszaru, scala commitem scalającym i synchronizuje
main (D-64). W commitach bez nazwy modelu: tylko `Co-Authored-By: Claude <noreply@anthropic.com>`.

## W toku
- Agent #1: R4d — tablica przyczyn zatoru huba (`night/11ag-hub-cause-board`).
- Agent #2: R1o — protokół testu zamkniętego i eksport dziennika (`night/12am-playtest-protocol`).

## Kolejka (D-226)
- **#1:** R4g, R2g, R1g, R7a/R7b/R7c, R7l.
- **#2:** R1k, R1l, R2c (+ „hub” w sklepie, D-223), R2f, R3d, R3e, R3i, R3j, R3k, R6g, R6i, R7d; R4f po G7.
- **Nie bierz:** kroków G (G5, G7, G9b) i `src/render/**` — sesja ext/03; zagadek — ext/04+; N9d (czeka na #52).

## Znane problemy
- **G7:** pod SwiftShader glob ~10 fps; `ui:matrix`, `e2e:smoke`, `store:shots`, `edge-chip-tags` przekraczają czas.
  Naprawia sesja ext. Nowe e2e piszemy na stronach-fixture (jak `test:e2e:fill-trend`).
- R4c: podpięcie w `session.ts` sprawdzone tylko typecheckiem — potwierdzić w e2e:smoke po G7.
- Commity #206 i #208 mają w stopce nazwę modelu (wymusiła ją atrybucja środowiska); historii nie przepisujemy.
- `docs/TESTING.md`: wiersz `test:fast` podaje nieaktualne `steps=36` (jest 84).
- Kolory regionów ASI i OCE nie są w `test:cvd` (kształty się różnią).
- Canonical wersji językowych strony ustawia JS; lepiej osobne `/pl/` i `/en/`.

## Sprawy tylko dla właściciela
- Q-01 — administrator danych; Q-07 — projekt i budżet Firebase.
- Prawnik: polityka prywatności; logi Cloud Run zapisują IP i user agenta.
- Adres `contact@airway.games` (strona prasowa) do potwierdzenia.
- Testy na urządzeniach (zamknięty test): Q-73 tempo, Q-78, Q-80 karta „+2 miejsca”.

## Zasada aktualizacji
Ten plik aktualizuj po każdym scaleniu i przy każdej zmianie stanu agentów: krótki PR do `dev`, scalenie, potem
synchronizacja main.
