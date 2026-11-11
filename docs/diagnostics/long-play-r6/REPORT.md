# Długie przejścia r6 po D-321

Baza: `origin/dev` 316d556, 8 listopada 2026. Świat zastępczy, Chromium/Playwright, skala tekstu 100%, losowy region, klasa I. Każdy przebieg trwał łącznie 8 tygodni gry, także przez kolejne partie po game over. Nie jest to test renderera 3D ani urządzenia fizycznego.

| Język i rozmiar | Przed poprawką skryptu | Po poprawce | Godziny gry po poprawce |
| --- | --- | --- | --- |
| PL 412×915 | 1 zgłoszenie przewinięcia | issues=0 | 578 |
| EN 412×915 | issues=0 | issues=0 | 578 |
| PL 915×412 | issues=0 | issues=0 | 578 |
| EN 915×412 | issues=0 | issues=0 | 578 |
| PL 1024×1366 | issues=0 | issues=0 | 578 |
| EN 1024×1366 | issues=0 | issues=0 | 577 |

Polecenie: `npm run ui:long-play:stub -- <pl|en> <szerokość> <wysokość> 1 30 --weeks=8`. Początkowy seed telefonu i jego obrotu to 42704, tabletu 43767; wybór nowego świata w dalszym przebiegu zmienia seed. W sześciu przejściach po poprawce żadne Cofnij nie zostało odrzucone (`undoRefusals=0`), więc same przejścia nie dowodzą wykonania gałęzi odmowy. Osobny `npm run test:e2e:undo-refused-jam:stub` przeszedł 2/2: odmowa, komunikat i niezmieniony stan w PL i EN.

## Diagnoza zgłoszenia

PL 412×915, seed 42704, lotnisko BGW, tick 9807: pierwszy przebieg zgłosił `game-over scrollTop=12`. [Dziennik przed poprawką](before-pl-412x915.txt) i [zrzut](pl-412x915-game-over-scroll.png) pokazują stan. Instrumentacja fokusu w osobnym przebiegu diagnostycznym tego samego seeda ustaliła: przed `focus()` dół pierwszej akcji był na 927,25 px przy dolnej krawędzi 915 px; zaraz po fokusie przeglądarka przewinęła raport o 12 px, ustawiając dół na 915,25 px; po animacji dół znalazł się na 858,25 px. Skrypt sprawdzał wyłącznie końcową geometrię i nie rozpoznał przewinięcia wymaganego w chwili ustawienia fokusu. To fałszywy alarm skryptu, nie wykazano tu błędu gry.

Poprawka rejestruje faktyczny przyrost przewinięcia z zerowej pozycji wywołany synchronicznie przez `focus()`, a następnie sprawdza, czy ten sam element nadal ma fokus i pozycja przewinięcia jest taka sama. Poprzednia kontrola geometrii pozostaje. Nie modyfikowano `src/`.

## Negatywna kontrola

`npm run ui:long-play:stub -- pl 412 915 1 30 r6-scroll-control --weeks=3 --seed=42704 --probe-scroll=1`

Przełącznik diagnostyczny dodaje 4 px przewinięcia po ustawieniu fokusu; w zwykłym przebiegu jest wyłączony. Oczekiwane jest zgłoszenie i kod wyjścia 1: `sheet opened scrolled ... scrollTop=16`. Tak właśnie zakończył się [przebieg kontrolny](scroll-control.txt), co pokazuje, że późniejsze przewinięcie inne niż fokus nadal jest wykrywane. Standardowy przebieg po poprawce osiągnął ten sam tick bez zgłoszenia.

## Ograniczenia

Wyniki dotyczą jednego zestawu rozmiarów, domyślnej skali tekstu, losowego regionu i klasy I, w świecie bez renderera. Nie obejmują jakości nowego globusa ani wyglądu UI-A, rzeczywistych urządzeń, wszystkich seedów i odmów Cofnij w losowej rozgrywce. Obowiązkowy `test:fast` na początku zakończył się 118/119: `test:globe-assets` nie znalazł `true` w Windows PATH. Po dodaniu katalogu Git `usr/bin` pełna seria na bazie przeszła 119/119; końcowe wyniki podano w PR.
