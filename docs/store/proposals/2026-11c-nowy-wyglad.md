# Propozycja tekstów PL/EN po zmianie wyglądu — do U7

Materiał do przeglądu, nie do publikacji przed wdrożeniem i sprawdzeniem rzeczywistego wyglądu oraz nowych materiałów wizualnych (D-296, D-323). Odwołania po zdaniach są dokumentacją redakcyjną i należy je usunąć przed wykorzystaniem tekstów. `D-323` i plan opisują **wybrany kierunek**, nie potwierdzenie jego ukończenia. Nowe opisy DE/FR/ES/PT-BR należy opracować z zatwierdzonego EN i przekazać native speakerom (D-296, `docs/store/review/`).

## PL

### Krótki opis (limit 80 znaków)

Buduj sieć lotów na globusie 3D i chroń huby przed zatorami. [F1, F2]

### Pełny opis

Stwórz własną sieć połączeń lotniczych na trójwymiarowym globusie. [F1] Łącz miasta trasami, rozbudowuj lotniska i planuj przesiadki pasażerów. [F1, F2] Samoloty latają samodzielnie — Ty decydujesz, którędy prowadzą połączenia. [F1]

Oglądaj Ziemię w dzień i w nocy na realistycznym globusie opartym na zdjęciach NASA. [K1] Informacje o lotach czerpią język z lotniskowych tablic split-flap, znaków i pasków lotu. [K2] Pasażerów rozróżnisz po kształcie ich symboli. [K3] Czas lokalny wpływa na ruch: noce są spokojne, a o świcie rośnie popyt. [F3]

• Rysuj trasy między miastami bez ręcznego sterowania samolotami. [F1]
• Wybieraj typ samolotu odpowiedni do zasięgu i liczby pasażerów. [F4]
• Buduj huby, w których podróżni przesiadają się na kolejne loty. [F2]
• Obserwuj liczbę oczekujących i reaguj, zanim hub się przepełni. [F2]
• Wybieraj ulepszenie po zakończeniu tygodnia gry. [F5]
• Sprawdzaj różne rozwiązania w zadaniach i buduj sieć w locie bez końca. [F6]
• Podejmuj wyzwanie dnia na przygotowanym dla wszystkich układzie. [F6]

W locie bez końca wybierz region startowy, realizuj tygodniowe kontrakty i przygotuj się na zapowiedziane szczyty ruchu. [F7] Zdobywaj klasy licencji z ciszą nocną i ostrzejszymi zasadami. [F7] Gdy hub się przepełni, raport pokaże przyczyny, osiągnięte etapy i wykonane kontrakty. [F8]

Airway to gra strategiczno-logiczna o trasach, przesiadkach i planowaniu na globusie. [F1]

### Pięć punktów: co wyróżnia grę

1. Projektujesz sieć, a samoloty same wykonują loty. [F1]
2. Przesiadki i zatory w hubach sprawiają, że liczy się układ całej sieci. [F2]
3. Czas lokalny miast zmienia rytm popytu. [F3]
4. Na globusie zobaczysz dzień i noc na podstawie obrazów NASA. [K1]
5. Tablica lotniskowa, znaki i paski lotu porządkują informacje, a kształty symboli rozróżniają pasażerów. [K2, K3]

### Tekst funkcji na grafice

Buduj sieć. [F1] Chroń huby. [F2]

### Nagłówek strony

Twoja sieć lotów na żywym globusie. [F1, K1]

## EN

### Short description (80-character limit)

Build routes on a 3D globe and keep airport hubs moving. [F1, F2]

### Full description

Build an airline network across a three-dimensional globe. [F1] Connect cities with routes, expand airports and plan passenger transfers. [F1, F2] Aircraft fly on their own — you decide where the network goes. [F1]

See Earth by day and night on a realistic globe based on NASA imagery. [K1] Flight information draws its language from airport split-flap boards, signs and flight strips. [K2] Passenger symbols are distinguishable by shape. [K3] Local time affects demand: nights are quiet and demand rises at dawn. [F3]

• Draw routes between cities without controlling every aircraft. [F1]
• Choose aircraft types for their range and passenger capacity. [F4]
• Create hubs where travellers transfer to their next flight. [F2]
• Watch waiting areas and act before a hub becomes overcrowded. [F2]
• Pick an upgrade at the end of each in-game week. [F5]
• Solve route-building puzzles or grow a network in Endless flight. [F6]
• Try the daily challenge with the same starting world for everyone. [F6]

In Endless flight, choose a home region, meet weekly contracts and prepare for announced passenger surges. [F7] Unlock licence classes with night curfews and tighter rules. [F7] If a hub becomes overwhelmed, the report shows the causes, milestones and contracts achieved. [F8]

Airway is a strategy puzzle game about routes, connections and planning on a globe. [F1]

### Five ways the game stands out

1. Design the network while aircraft fly themselves. [F1]
2. Transfers and hub congestion make the whole network matter. [F2]
3. Cities' local time changes the rhythm of demand. [F3]
4. See day and night on a globe based on NASA imagery. [K1]
5. Airport boards, signs and flight strips organise information, while passenger symbols differ by shape. [K2, K3]

### Feature graphic text

Build routes. [F1] Save your hubs. [F2]

### Website headline

Your airline network on a living globe. [F1, K1]

## Podstawa poszczególnych zdań

- **F1** — `CLAUDE.md`, „The game in one line”; `docs/store/pl.md` i `en.md`, obecne opisy; `src/game/run.ts`.
- **F2** — `src/sim/routing.ts`, `src/sim/hubs.ts`; obecne opisy sklepu.
- **F3** — `src/sim/daynight.ts`, `src/sim/demand.ts`; `docs/store/copy-review-2026-11.md` §1.1.
- **F4** — `src/sim/planes.ts`, `src/sim/params.ts`; obecne opisy sklepu.
- **F5** — `src/sim/upgrades.ts`; obecne opisy sklepu.
- **F6** — `src/game/modes/daily.ts`, `src/game/modes/puzzle.ts`, `src/core/daily.ts`; `docs/ARCHITECTURE.md`.
- **F7** — `src/game/gating.ts`, `src/sim/contracts.ts`, `src/sim/surge.ts`, `src/sim/licence.ts`; D-271, D-272, D-273 i `docs/store/copy-review-2026-11.md` §1.2.
- **F8** — `src/game/causes.ts`, `src/game/milestones.ts`, `src/game/contractsSummary.ts`; D-242, D-293.
- **K1** — D-323 i `docs/styles/kierunki-2026-11c/PLAN-NOWY-KIERUNEK.md` §1, §3 R1: Blue Marble NG i Black Marble, dzień/noc według zegara gry; planowane dla nowego wydania.
- **K2** — D-323 i plan §2–3 T1–T6: UI-A z tablicą, znakami oraz paskami lotu; wdrożenie etapowe.
- **K3** — D-323, D-08 i `src/ui/glyphs.ts`: symbole pasażerów rozróżniane kształtem i kolorem.

Przed publikacją w U7 porównać każde zdanie K1–K3 z rzeczywistym wydaniem i grafiką; tekst funkcji i nagłówek nie są tekstem alternatywnym obrazu. Alt teksty mają opisać faktycznie wykonane obrazy. Nie reklamujemy frontu pogodowego, który jest wyłączony w wydawanym locie bez końca (D-274).
