# Test zamknięty — protokół i podsumowanie z dziennika (R1o, D-227)

Protokół 14-dniowego testu zamkniętego Google Play (≥ 12 testerów przez 14 dni, RESEARCH R3) i opis akcji
**„Kopiuj podsumowanie”** w dzienniku lotów. Test jest prawdziwym playtestem: bot balansu mierzy sieć, nie gracza
(D-113), więc decyzje o tempie i kartach czekają na liczby od ludzi. Dokument dla właściciela (PL); część dla testerów
(instrukcja i pytania) jest w PL i EN.

Zakres R1o: przebieg dni 1–14, o co pytamy, pytania PL/EN, eksport dziennika. **R3j** (D-231) dodał zapis
playtestu: linię maszynową `AW1:` pod tekstem, prawdziwe minuty gry, przyczynę porażki, kartę z każdego tygodnia, stan
szkolenia, ustawienie i preset grafiki, kroki adaptacji i wersję gry, oraz `npm run playtest:decode` (CSV). Uzupełnią go:
**R3k** (rekrutacja, ostateczna tabela decyzji z progami, odpowiedzi do wniosku o produkcję; *Q-42, Q-52*),
**R6i** (arkusz obserwacji pierwszych 10 minut).

## Prywatność (D-16, D-220)

- Dziennik i notatki biegów są **tylko na urządzeniu** (`localStorage`, klucz `airway.logbook.v1`). Gra nie wysyła
  ich nigdzie; nie ma analityki, sieci, identyfikatorów ani uprawnień.
- „Kopiuj podsumowanie” kładzie **zwykły tekst w schowku** dopiero po dotknięciu przycisku przez gracza. Tester sam
  decyduje, czy i gdzie go wkleić (formularz opinii). Gdy system blokuje schowek, tekst pojawia się zaznaczony pod
  przyciskiem do ręcznego skopiowania — nadal bez sieci.
- Tekst zawiera tylko liczby i daty biegów: bez kodów lotnisk, ziarna świata, imienia, adresu czy identyfikatora
  urządzenia. Linia `AW1:` (R3j) to te same liczby plus stałe słowa (przyczyna porażki, ustawienie grafiki, wersja
  gry) zakodowane w base64url — czytelne dla każdego, kto ją zdekoduje, i nic poza tym.
- Dlatego eksport **nie zmienia** deklaracji Data safety / App Privacy: dane przekazywane przez użytkownika z jego
  inicjatywy (schowek, udostępnianie) nie są zbieraniem przez aplikację. Odnotowane w
  `docs/store/privacy-declarations.md` (sekcja „Build A”).
- W formularzu opinii (Formularz Google) nie prosimy o dane osobowe poza adresem z listy testu, który Google i tak zna.

## Co jest w podsumowaniu

Przycisk w **Dziennik lotów → Kopiuj podsumowanie** (także w buildach wydania). Przykład (EN, telefon z 3 biegami;
najstarszy bieg zapisała wersja sprzed R3j, więc nie ma prawdziwych minut ani przyczyny):

```text
Airway logbook summary · 2026-11-18
Flights: 14 (Endless 10, daily challenges 4)
Flight training: finished
Puzzles solved: 6 of 40
Game version: 0.1.1
Runs with details: 3 (the last 30 are kept)
Run length at 1× speed: median 14.2 min · longest 21.8 min
Real play time (pauses excluded): median 14.2 min · longest 16.3 min · measured in 2 runs
Weeks completed: median 2 · most 3
A departure waited for a slot: in 1 of 3 runs
Card "Expand hub": offered 2 · picked 1
Card "Departure slots": offered 1 · picked 0
Runs, newest first: date · mode · min at 1× · weeks · passengers · hub card picked/offered · slots card picked/offered · aircraft-minutes waiting for a slot
2026-11-18 · Endless · 21.8 · 3 · 412 · 1/1 · 0/1 · 34
2026-11-17 · Daily · 14.2 · 2 · 233 · 0/1 · 0/0 · 0
2026-11-16 · Endless · 9.6 · 1 · 88 · 0/0 · 0/0 · 0
AW1:eyJ2IjoxLCJkIjoiMjAyNi0xMS0xOCIsImFwcCI6IjAuMS4xIiwiZiI6MTQsImRsIjo0LCJ0dXQiOiJjb21wbGV0ZWQiLCJweiI6WzYsNDBdLCJyIjpbWyIyMDI2LTExLTE4IiwiZW5kbGVzcyIsMjEuOCwxNi4zLDMsNDEyLCJjYXBhY2l0eSIsIldIVCIsMSwxLDAsMSwzNCwiY29tcGxldGVkIiwiYXV0byIsIm1lZGl1bSIsMSwiMC4xLjEiXSxbIjIwMjYtMTEtMTciLCJkYWlseSIsMTQuMiwxMi4xLDIsMjMzLCJuby1yb3V0ZSIsIlRXIiwwLDEsMCwwLDAsImNvbXBsZXRlZCIsImF1dG8iLCJtZWRpdW0iLDAsIjAuMS4wIl0sWyIyMDI2LTExLTE2IiwiZW5kbGVzcyIsOS42LG51bGwsMSw4OCxudWxsLG51bGwsMCwwLDAsMCwwLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbF1dfQ
```

| Wiersz | Skąd | Do czego |
|---|---|---|
| Loty (Endless / wyzwania dnia) | licznik dziennika przy każdym końcu gry | zaangażowanie; gra dnia ≥ 5 z 7 dni (Q-45) |
| Szkolenie: ukończone / pominięte / zaczęte / nieotwierane | zapis samouczka `aw-tutorial` | „samouczek nieukończony” |
| Rozwiązane zadania | postęp zagadek | czy doszli do zagadek 1–10 / 11–30 |
| Wersja gry | `version` z `package.json` wstawiana przy buildzie (`src/core/version.ts`) | czy tester ma już poprawkę z dnia 8 |
| Biegi ze szczegółami | notatki ostatnich **30** biegów (od tej wersji) | podstawa wszystkich liczb niżej |
| Długość przy 1× | takty symulacji ÷ 600 (jak `test:balance`, „Session, min at 1x”), jedna cyfra po przecinku | **Q-73**: rozkład długości biegów ludzi wobec bota |
| Czas gry naprawdę (R3j) | sekundy klatek na ekranie gry i tablicy tygodnia, bez pauzy i tła (klatka liczy się najwyżej 0,5 s), w dziesiątych minuty; mediana z biegów, które go mają | **Q-73**: ile minut życia zajmuje bieg (wobec 1×: czy grają na 2×/3×) |
| Ukończone tygodnie | `floor(takt / tydzień)`, jak tablica końca gry | tydzień porażki |
| Odlot czekał na slot | samolotominuty czekania na slot startowy (limit D-46) ze wszystkich lotnisk; > 0 = limit choć raz zadziałał | **Q-80**: czy ludzie trafiają na limit startów |
| Karta „Rozbudowa huba” w ofercie / wybrana | tablice tygodnia z tą kartą; wybory z historii ulepszeń | **Q-78**: czy ludzie biorą kartę huba |
| Karta „Sloty startowe” w ofercie / wybrana | jw. dla „+2 sloty” | **Q-80**: czy karta w ogóle się pojawia i czy ktoś ją bierze |
| Tabela biegów | jeden wiersz na bieg, od najnowszego | mediany / p90 po zebraniu od wszystkich |

Ograniczenia, o których trzeba pamiętać przy czytaniu:
- **Minuty przy 1×** to czas gry, nie zegar ścienny: gracz na 2×/3× spędza mniej, z pauzami więcej. Ta jednostka jest
  porównywalna z botem (D-79, Q-73). **Prawdziwe minuty** (R3j) to czas przed ekranem gry i tablicą tygodnia bez
  pauzy; bieg wznowiony z zapisu liczy tylko czas od wznowienia.
- Bieg **wznowiony z zapisu** liczy tablice tygodnia pokazane po wznowieniu; „w ofercie” nigdy nie jest mniejsze niż
  „wybrana”. Wybory i czekanie na slot są pełne (są w zapisie symulacji).
- Loty sprzed tej wersji liczą się w „Loty”, ale nie mają notatek ani podziału na tryby (wyzwania dnia od 0).
  Na test instalujemy czysty build.
- Bieg porzucony w menu (bez końca gry) nie trafia do dziennika — tak jak dotąd.

## Linia `AW1:` i `npm run playtest:decode` (R3j, D-231)

Ostatnia linia podsumowania to zapis playtestu dla arkusza: `AW1:` + base64url z JSON-a (ASCII, ten sam w PL i EN).
Tester wkleja ją razem z resztą tekstu; nie musi jej rozumieć. Klucze JSON-a: `v` (1), `d` (dzień skopiowania),
`app` (wersja), `f` / `dl` (loty / wyzwania dnia), `tut` (szkolenie teraz), `pz` (zagadki rozwiązane / wszystkie),
`r` (biegi, od najnowszego, kolumny jak niżej). Brak pola w starszej notatce = `null`.

| Kolumna CSV | Znaczenie |
|---|---|
| `summary`, `copied`, `app_version`, `flights`, `dailies`, `tutorial_now`, `puzzles_solved`, `puzzles_total` | z nagłówka podsumowania (powtórzone w każdym wierszu biegu); `summary` numeruje wklejone podsumowania po kolei |
| `day`, `mode` | dzień końca biegu, `endless` / `daily` |
| `min_1x`, `min_real` | minuty przy 1× (D-227) i prawdziwe minuty gry |
| `weeks`, `passengers` | ukończone tygodnie, przewiezieni pasażerowie |
| `cause` | pierwsza przyczyna z tablicy porażki (`src/game/causes.ts`: `capacity`, `no-route`, `regional-demand`, `seat-shortage`, `missed-transfer`, `transfer-not-ready`, `long-wait`, `congestion-duration`, `slot-wait`, `unavailable`) |
| `picks` | karta wybrana w kolejnych tygodniach: `T` turbośmigłowiec, `W` szerokokadłubowiec, `H` rozbudowa huba, `S` +2 sloty |
| `hub_picked`, `hub_offered`, `slots_picked`, `slots_offered`, `held_min` | jak w tabeli biegów (Q-78, Q-80) |
| `tutorial` | stan szkolenia w chwili końca biegu (`completed` / `skipped` / `in-progress` / `none`) |
| `quality`, `preset`, `adapt_steps` | ustawienie grafiki (`auto`, `saver`, `low`, `medium`, `high`), preset, na którym renderer skończył bieg, i liczba kroków automatycznego obniżenia jakości (0–3, D-74) |
| `version` | wersja gry, która grała ten bieg |

Zebranie: odpowiedzi z ankiet B i C (eksport Formularza Google do pliku tekstowego albo CSV) zapisać lokalnie i:

```sh
npm run playtest:decode -- ankieta-c.csv > biegi.csv
```

Skrypt znajduje każde `AW1:` w tekście (także w komórkach CSV), sprawdza pola tak jak gra (nieznane wartości
zostają pustą komórką) i wypisuje jeden wiersz na bieg; na stderr podaje `records`, `rows`, `skipped`. Dla przykładu
wyżej:

```csv
summary,copied,app_version,flights,dailies,tutorial_now,puzzles_solved,puzzles_total,day,mode,min_1x,min_real,weeks,passengers,cause,picks,hub_picked,hub_offered,slots_picked,slots_offered,held_min,tutorial,quality,preset,adapt_steps,version
1,2026-11-18,0.1.1,14,4,completed,6,40,2026-11-18,endless,21.8,16.3,3,412,capacity,WHT,1,1,0,1,34,completed,auto,medium,1,0.1.1
1,2026-11-18,0.1.1,14,4,completed,6,40,2026-11-17,daily,14.2,12.1,2,233,no-route,TW,0,1,0,0,0,completed,auto,medium,0,0.1.0
1,2026-11-18,0.1.1,14,4,completed,6,40,2026-11-16,endless,9.6,,1,88,,,0,0,0,0,0,,,,,
```

Dane nie zawierają kodów lotnisk, ziarna świata ani identyfikatorów; tester może je przeczytać (base64 to nie
szyfrowanie). Arkusz z wynikami trzymamy prywatnie, poza repozytorium.

## Przebieg (14 dni)

Kalendarz z RESEARCH R3; zadania testerów są w instrukcji niżej.

| Dzień | Co robią testerzy | Co zbieramy |
|---|---|---|
| T−7 | zapis do Grupy Google „airway-testers”, link opt-in | lista (16–18 osób, ≥ 6 PL i ≥ 6 EN, ≥ 3 budżetowe Androidy, ≥ 2 tablety/składaki) |
| 1 | instalacja, lot szkoleniowy, pierwszy bieg Endless do końca; 3–5 osób nagrywa ekran z komentarzem przez pierwsze 10 min | ankieta A, nagrania |
| 2–6 | gra dnia codziennie, Endless dowolnie, zagadki 1–10 | zgłoszenia błędów |
| 7 | ankieta B + **„Kopiuj podsumowanie”** wklejone w ankietę | podsumowania 1 (≥ 12) |
| 8 | **poprawka** z najczęstszymi problemami dni 1–7 (do wniosku o produkcję) | lista zmian (PR) |
| 9–13 | jak 2–6, zagadki 11–30 | zgłoszenia błędów |
| 14 | ankieta C + **„Kopiuj podsumowanie”** | podsumowania 2 (≥ 12) |

Podsumowanie z dnia 14 zawiera biegi z dnia 7 (do 30 ostatnich), więc do liczb bierzemy **dzień 14**; dzień 7 służy
do decyzji o poprawce z dnia 8. Kto zagrał ponad 30 biegów, ma w tabeli tylko 30 ostatnich — to wystarcza.

## Otwarte pytania, które test rozstrzyga

Liczby czytamy ze wszystkich podsumowań z dnia 14 razem (wiersze tabeli biegów). Progi niżej to **propozycja** do
zatwierdzenia w tabeli decyzji R3k, przed startem testu — żeby wyniki nie były naginane.

| Pytanie | Co policzyć | Odniesienie z bota | Propozycja odczytu |
|---|---|---|---|
| **Q-73** (D-152) kształt końca biegu: zostawić tempo (A) czy łagodniejsza rampa po 3. tygodniu (B) | mediana i p90 „min przy 1×” wszystkich biegów Endless; odsetek biegów z ≥ 4 ukończonymi tygodniami; ankieta C2–C3 | 200 biegów: średnio 16,7 min, p90 22,4, max 31,6, nikt nie widzi 5. tablicy | A zostaje, gdy mediana ludzi mieści się w 10–18 min (D-79) i ≤ 4 z 12 osób pisze „za krótko / za szybko się kończy”. B (przegląd R8f), gdy p90 ludzi < p90 bota **i** ≥ 5 z 12 osób chce dłuższych biegów |
| **Q-78** (D-204) karta „Rozbudowa huba” | suma „wybrana / w ofercie” dla karty huba; ankieta B (która karta zawsze najlepsza, czy karta huba jest zrozumiała) | bot bierze ją w 7–11 % wyborów (D-201) | A zostaje, gdy ludzie biorą ją w ≥ 10 % ofert i ankieta nie wskazuje niezrozumienia. Mierzymy D (inny efekt), gdy < 5 % ofert albo ≥ 4 osoby piszą, że nie wiedzą, co robi |
| **Q-80** (D-215) karta „+2 sloty” | odsetek biegów z „czekanie na slot” > 0; suma „wybrana / w ofercie” dla karty slotów | limit blokuje w 12 z 200 biegów (6 %); karta na 4 z 364 tablic, bot nigdy jej nie bierze | A zostaje, gdy limit bije w ≥ 20 % biegów ludzi (człowiek stawia kilka samolotów na jednym lotnisku) i kartę ktoś bierze. B (usunąć z puli Endless i gry dnia), gdy limit bije w < 10 % biegów i karta prawie się nie pojawia |

Przy okazji test daje dane do Q-35 (która karta „zawsze najlepsza”, ankieta B), Q-45 (gra dnia ≥ 5 z 7 dni),
Q-50 (czego brakuje po kilku godzinach), Q-14 i Q-29 (noc, dźwięk; ankieta C) i progu „samouczek nieukończony”.

## Instrukcja dla testerów

Wysyłana w e-mailu powitalnym i przypięta w Grupie Google. Wersja PL i EN mówią to samo.

### PL
1. Zainstaluj Airway z linku testu. Przejdź **lot szkoleniowy** i zagraj pierwszy bieg **Bez końca** aż do końca
   (gra kończy się, gdy hub się zatka). Jeśli nagrywasz ekran — mów na głos, co myślisz, przez pierwsze 10 minut.
2. Dni 2–13: zagraj **wyzwanie dnia** codziennie (kilka minut), resztę jak lubisz: Bez końca, zadania 1–10, potem 11–30.
   Graj normalnie — nie ma dobrych ani złych wyników.
3. Dzień 7 i dzień 14: otwórz **Dziennik lotów → Kopiuj podsumowanie** i wklej tekst w ankietę. Tekst to tylko
   liczby z Twoich biegów; gra niczego nie wysyła sama.
4. Błąd albo coś niejasnego? Napisz w Grupie albo przez „Wyślij opinię” w Google Play: co robiłeś, co się stało,
   model telefonu. Zrzut ekranu bardzo pomaga.
5. Nie wypisuj się z testu przed dniem 14 — Google liczy 14 dni bez przerwy.

### EN
1. Install Airway from the test link. Play the **flight training** and your first **Endless** run to the end (the
   game ends when a hub jams). If you record your screen, think aloud for the first 10 minutes.
2. Days 2–13: play the **daily challenge** every day (a few minutes); the rest as you like: Endless, puzzles 1–10, then
   11–30. Just play normally — there are no good or bad results.
3. Day 7 and day 14: open **Logbook → Copy summary** and paste the text into the survey. It is only numbers from your
   runs; the game sends nothing by itself.
4. A bug or something unclear? Post in the Group or use "Send feedback" in Google Play: what you did, what happened,
   your phone model. A screenshot helps a lot.
5. Please stay in the test until day 14 — Google counts 14 days in a row.

## Ankiety (Formularz Google, PL/EN)

Każde pytanie ma odpowiedź zamkniętą i jedno pole „dlaczego” (opcjonalne). Pytania oznaczone pytaniem właściciela
odpowiadają na nie wprost.

### A — dzień 1
| # | PL | EN |
|---|---|---|
| A1 | Czy wiesz, czemu skończył się Twój pierwszy bieg? (tak / chyba / nie) — jednym zdaniem: czemu? | Do you know why your first run ended? (yes / sort of / no) — in one sentence: why? |
| A2 | Co było niejasne w locie szkoleniowym? | What was unclear in the flight training? |
| A3 | Czy odróżniasz samoloty i lotniska po kształcie, bez czytania? (tak / czasem / nie) | Can you tell aircraft and airports apart by shape, without reading? (yes / sometimes / no) |
| A4 | Telefon (model) i czy gra się przycinała (nigdy / czasem / często) | Phone (model) and did the game stutter (never / sometimes / often) |
| A5 | Czy zagrasz jutro? (1–5) | Will you play tomorrow? (1–5) |

### B — dzień 7 (+ podsumowanie z dziennika)
| # | PL | EN |
|---|---|---|
| B1 | Wklej „Kopiuj podsumowanie” z Dziennika lotów | Paste "Copy summary" from the Logbook |
| B2 | Ile razy dziennie otwierasz grę? (0 / 1 / 2–3 / więcej) | How many times a day do you open the game? (0 / 1 / 2–3 / more) |
| B3 | Co najczęściej kończy Twoją sesję? (przegrana / nuda / brak czasu / inne) | What usually ends your session? (a loss / boredom / no time / other) |
| B4 | Która karta tygodnia wydaje się zawsze najlepsza? (turbośmigłowiec / szerokokadłubowiec / rozbudowa huba / sloty startowe / zależy) — Q-35 | Which weekly card always seems best? (turboprop / widebody / expand hub / departure slots / it depends) — Q-35 |
| B5 | Co robi karta „Rozbudowa huba”? (własnymi słowami; „nie wiem” jest dobrą odpowiedzią) — Q-78 | What does the "Expand hub" card do? (your own words; "I don't know" is a fine answer) — Q-78 |
| B6 | Czy samolot czekał kiedyś na ziemi na „slot startowy”? (tak, często / raz-dwa / nie / nie wiem, co to) — Q-80 | Did an aircraft ever wait on the ground for a "departure slot"? (yes, often / once or twice / no / don't know what that is) — Q-80 |
| B7 | Najlepszy i najgorszy moment tygodnia | Best and worst moment of the week |
| B8 | Bateria / grzanie się telefonu (bez zmian / trochę / mocno) | Battery / phone heating (no change / a little / a lot) |

### C — dzień 14 (+ podsumowanie z dziennika)
| # | PL | EN |
|---|---|---|
| C1 | Wklej „Kopiuj podsumowanie” z Dziennika lotów | Paste "Copy summary" from the Logbook |
| C2 | Bieg Bez końca kończy się zwykle… (za wcześnie / w sam raz / za późno) — Q-73 | An Endless run usually ends… (too early / about right / too late) — Q-73 |
| C3 | Czy wolałbyś dłuższe biegi, w których trudność rośnie wolniej? (tak / obojętne / nie) — Q-73 | Would you prefer longer runs in which the difficulty grows more slowly? (yes / don't mind / no) — Q-73 |
| C4 | Czego brakuje po kilku godzinach? (celu / odmiany / niczego / inne) — Q-50 | What is missing after a few hours? (a goal / variety / nothing / other) — Q-50 |
| C5 | Czy poleciłbyś grę? (0–10) | Would you recommend the game? (0–10) |
| C6 | Dźwięk (włączony / wyciszony; czy przeszkadza) — Q-29; noc na globusie (za ciemna / w sam raz / za jasna) — Q-14 | Sound (on / muted; does it bother you) — Q-29; night on the globe (too dark / right / too bright) — Q-14 |
| C7 | Ile zapłaciłbyś za tę grę? (tylko sygnał; gra zostaje bez reklam i zakupów, D-16) | What would you pay for this game? (a signal only; the game stays without ads or purchases, D-16) |

## Po teście

1. Zebrać biegi z podsumowań z dnia 14 w jeden arkusz: `npm run playtest:decode -- plik.txt > biegi.csv` (linie
   `AW1:`, sekcja wyżej).
2. Policzyć wiersze z tabeli „Otwarte pytania” i z tabeli decyzji R3k; wpisać wyniki i decyzje jako D-xx.
3. Odpowiedzi do wniosku o produkcję (R3k): liczba testerów i dni, sposób zbierania (ankiety + podsumowania z dziennika
   + nagrania), 5 najczęstszych uwag, zmiany w poprawce z dnia 8, dowód gotowości.
