# Test zamknięty — protokół i podsumowanie z dziennika (R1o, D-227)

Protokół 14-dniowego testu zamkniętego Google Play (≥ 12 testerów przez 14 dni, RESEARCH R3) i opis akcji
**„Kopiuj podsumowanie”** w dzienniku lotów. Test jest prawdziwym playtestem: bot balansu mierzy sieć, nie gracza
(D-113), więc decyzje o tempie i kartach czekają na liczby od ludzi. Dokument dla właściciela (PL); część dla testerów
(instrukcja i pytania) jest w PL i EN.

Zakres R1o: przebieg dni 1–14, o co pytamy, pytania PL/EN, eksport dziennika. **R3j** (D-231) dodał zapis
playtestu: linię maszynową `AW1:` pod tekstem, prawdziwe minuty gry, przyczynę porażki, kartę z każdego tygodnia, stan
szkolenia, ustawienie i preset grafiki, kroki adaptacji i wersję gry, oraz `npm run playtest:decode` (CSV). **R3k**
(D-232) dodał rekrutację, ostateczną tabelę decyzji z progami spisanymi przed testem i arkusz odpowiedzi do wniosku o
produkcję (Q-42 → D-94; Q-52 wg rekomendacji A, do potwierdzenia). **R6i** dodał arkusz obserwacji pierwszej sesji
(pierwsze 10 minut) i dwa sprawdzenia na urządzeniu (muzyka z innej aplikacji, wibracje na tanim telefonie). **R8g**
dodał siedem pytań audytu R8 (RESEARCH R8, „Pytania do testu zamkniętego”) do ankiet B i C i do arkusza obserwacji,
każde z progiem w Tabeli decyzji (wiersze R8-1…R8-7). **Zapis v2** (D-295) dopisał do linii `AW1:` dane biegu
`endless` do decyzji „po teście zamkniętym” D-270…D-273: kontrakty spełnione / zaoferowane, szczyty ruchu, klasę
licencji, region startowy i osiągnięte etapy (sekcja „Linia `AW1:`”, wiersze D-270…D-273 w Tabeli decyzji).

## Prywatność (D-16, D-220)

- Dziennik i notatki biegów są **tylko na urządzeniu** (`localStorage`, klucz `airway.logbook.v1`). Gra nie wysyła
  ich nigdzie; nie ma analityki, sieci, identyfikatorów ani uprawnień.
- „Kopiuj podsumowanie” kładzie **zwykły tekst w schowku** dopiero po dotknięciu przycisku przez gracza. Tester sam
  decyduje, czy i gdzie go wkleić (formularz opinii). Gdy system blokuje schowek, tekst pojawia się zaznaczony pod
  przyciskiem do ręcznego skopiowania — nadal bez sieci.
- Tekst zawiera tylko liczby i daty biegów: bez kodów lotnisk, ziarna świata, imienia, adresu czy identyfikatora
  urządzenia. Linia `AW1:` (R3j) to te same liczby plus stałe słowa (przyczyna porażki, ustawienie grafiki, wersja
  gry; od D-295 także klasa licencji, region startowy — jedno z 8 słów `NAM` … `OCE` albo `random`, nie lotnisko — i
  litery etapów) zakodowane w base64url — czytelne dla każdego, kto ją zdekoduje, i nic poza tym.
- Dlatego eksport **nie zmienia** deklaracji Data safety / App Privacy: dane przekazywane przez użytkownika z jego
  inicjatywy (schowek, udostępnianie) nie są zbieraniem przez aplikację. Odnotowane w
  `docs/store/privacy-declarations.md` (sekcja „Build A”).
- W formularzu opinii (Formularz Google) nie prosimy o dane osobowe poza adresem z listy testu, który Google i tak zna.

## Co jest w podsumowaniu

Przycisk w **Dziennik lotów → Kopiuj podsumowanie** (także w buildach wydania). Przykład (EN, telefon z 3 biegami;
najstarszy bieg zapisała wersja sprzed R3j, więc nie ma prawdziwych minut ani przyczyny; najnowszy bieg `endless`
ma pola zapisu v2, D-295 — widać je tylko w linii `AW1:` i w CSV, czytelny tekst się nie zmienia):

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
AW1:eyJ2IjoyLCJkIjoiMjAyNi0xMS0xOCIsImFwcCI6IjAuMS4xIiwiZiI6MTQsImRsIjo0LCJ0dXQiOiJjb21wbGV0ZWQiLCJweiI6WzYsNDBdLCJyIjpbWyIyMDI2LTExLTE4IiwiZW5kbGVzcyIsMjEuOCwxNi4zLDMsNDEyLCJjYXBhY2l0eSIsIldIVCIsMSwxLDAsMSwzNCwiY29tcGxldGVkIiwiYXV0byIsIm1lZGl1bSIsMSwiMC4xLjEiLDEsMiwxLDEsMTIsMCwyLCJFVU4iLCJIMjM0Il0sWyIyMDI2LTExLTE3IiwiZGFpbHkiLDE0LjIsMTIuMSwyLDIzMywibm8tcm91dGUiLCJUVyIsMCwxLDAsMCwwLCJjb21wbGV0ZWQiLCJhdXRvIiwibWVkaXVtIiwwLCIwLjEuMCIsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGxdLFsiMjAyNi0xMS0xNiIsImVuZGxlc3MiLDkuNixudWxsLDEsODgsbnVsbCxudWxsLDAsMCwwLDAsMCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGwsbnVsbCxudWxsLG51bGxdXX0
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
Tester wkleja ją razem z resztą tekstu; nie musi jej rozumieć. Klucze JSON-a: `v` (wersja zapisu: 2 od D-295, 1
przed nim), `d` (dzień skopiowania),
`app` (wersja), `f` / `dl` (loty / wyzwania dnia), `tut` (szkolenie teraz), `pz` (zagadki rozwiązane / wszystkie),
`r` (biegi, od najnowszego, kolumny jak niżej). Brak pola w starszej notatce = `null`. Kolumny tylko dopisujemy na
końcu: wiersz zapisu v1 ma 18 pierwszych kolumn, v2 — 27; dekoder czyta obie wersje, a kolumny, których linia nie ma,
zostawia puste (podsumowanie z wersji gry sprzed D-295 nadal się dekoduje).

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
| `contracts_met`, `contracts_offered` (v2) | kontrakty tygodnia spełnione / zaoferowane w biegu (D-271; liczone jak wiersz „Kontrakty” raportu końca gry, D-293: zamknięte + bieżący, bieżący spełniony, gdy już osiągnął cel); `0`/`0` — bieg nie doczekał kontraktu; puste — gra dnia albo zapis sprzed v2 |
| `surges_seen`, `surges_opened`, `surge_extra`, `surge_lost` (v2) | szczyty ruchu (D-249, D-272): ogłoszone, z otwartym oknem, dodatkowi pasażerowie, których wysłały, i `1`, gdy bieg przegrał na lotnisku szczytu w jego oknie albo do 6 h gry po nim — dokładnie jak `balance:surges` (`src/game/surgesSummary.ts`), więc ludzie porównują się z botem |
| `licence` (v2) | klasa licencji biegu: `1`, `2`, `3` (D-251, D-273) |
| `home` (v2) | region startowy (D-236): `random` albo identyfikator regionu (`NAM`, `SAM`, `EUN`, `EUS`, `AFR`, `ME`, `ASI`, `OCE`) — wybór z menu, nie lotnisko |
| `milestones` (v2) | etapy osiągnięte w biegu (D-242, D-270), po jednej literze w stałej kolejności: `H` pierwszy hub, `R` wszystkie regiony, `2` / `3` / `4` tydzień 2 / 3 / 4, `F` 500 pasażerów, `S` 750 pasażerów (np. `H23F`); pusto w komórce bez liter = żaden etap |

Zebranie: odpowiedzi z ankiet B i C (eksport Formularza Google do pliku tekstowego albo CSV) zapisać lokalnie i:

```sh
npm run playtest:decode -- ankieta-c.csv > biegi.csv
```

Skrypt znajduje każde `AW1:` w tekście (także w komórkach CSV), sprawdza pola tak jak gra (nieznane wartości
zostają pustą komórką) i wypisuje jeden wiersz na bieg; na stderr podaje `records`, `rows`, `skipped`. Dla przykładu
wyżej:

```csv
summary,copied,app_version,flights,dailies,tutorial_now,puzzles_solved,puzzles_total,day,mode,min_1x,min_real,weeks,passengers,cause,picks,hub_picked,hub_offered,slots_picked,slots_offered,held_min,tutorial,quality,preset,adapt_steps,version,contracts_met,contracts_offered,surges_seen,surges_opened,surge_extra,surge_lost,licence,home,milestones
1,2026-11-18,0.1.1,14,4,completed,6,40,2026-11-18,endless,21.8,16.3,3,412,capacity,WHT,1,1,0,1,34,completed,auto,medium,1,0.1.1,1,2,1,1,12,0,2,EUN,H234
1,2026-11-18,0.1.1,14,4,completed,6,40,2026-11-17,daily,14.2,12.1,2,233,no-route,TW,0,1,0,0,0,completed,auto,medium,0,0.1.0,,,,,,,,,
1,2026-11-18,0.1.1,14,4,completed,6,40,2026-11-16,endless,9.6,,1,88,,,0,0,0,0,0,,,,,,,,,,,,,,
```

Dane nie zawierają kodów lotnisk, ziarna świata ani identyfikatorów; tester może je przeczytać (base64 to nie
szyfrowanie). Arkusz z wynikami trzymamy prywatnie, poza repozytorium.

## Rekrutacja (R3k; Q-52 — rekomendacja A, do potwierdzenia przez właściciela)

Konto Google Play jest kontem organizacji (D-94), więc reguła „≥ 12 testerów × 14 dni” nas formalnie nie dotyczy; test
robimy i tak, jako prawdziwy playtest (D-113, D-152, D-204, D-215). Plan zakłada jednak liczby z reguły — gdyby konto
skończyło jako osobiste, ten sam test spełnia wymóg, a arkusz odpowiedzi niżej jest gotowy.

| Co | Plan |
|---|---|
| Liczba | **16–18 zapisanych** (zapas na odpadających), cel ≥ 12 aktywnych do dnia 14 |
| Języki | ≥ 6 PL i ≥ 6 EN (obie wersje gry i ankiet) |
| Doświadczenie | 4–5 osób znających gry sieciowe / strategiczne, reszta „zwykli gracze” |
| Urządzenia | ≥ 3 budżetowe Androidy (Mali-G52/G57, 4 GB RAM), ≥ 2 tablety lub składaki, reszta dowolna; iOS tylko przez TestFlight, jeśli konto Apple jest gotowe (Q-52 B) |
| Nagrania | 3–5 osób nagrywa pierwsze 10 minut (systemowe nagrywanie ekranu + komentarz); obserwator wypełnia arkusz pierwszej sesji (R6i) |
| Źródła | znajomi i rodzina, polskie społeczności gamedev i grupy graczy mobilnych, formularz zapisu na `airway.games` (D-67). **Bez** płatnych serwisów testerów i wymian „test za test” (instalują i nic nie mówią; ryzyko odrzucenia wniosku) |
| Kanał | jedna Grupa Google „airway-testers” (lista testu w Play Console = ta grupa); adres opinii w konsoli = Grupa |
| Podziękowanie | opt-in w napisach (znak wywoławczy lub imię); bez nagród rzeczowych i kodów |
| Zgoda | e-mail powitalny mówi wprost: gra nic nie wysyła sama, „Kopiuj podsumowanie” to liczby, które tester wkleja z własnej woli; nagranie ekranu tylko za zgodą, nie trafia do repozytorium |

Kto w dniu 7 nie wkleił podsumowania i nie grał od 3 dni, dostaje jedno przypomnienie w Grupie (bez nacisku). Nikogo
nie usuwamy z listy — Google liczy ciągłość zapisu.

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

Test rozstrzyga **Q-73** (D-152, koniec biegu), **Q-78** (D-204, karta „Rozbudowa huba”) i **Q-80** (D-215, karta
„+2 sloty”). Progi są w **Tabeli decyzji** niżej (R3k, D-232) — spisane przed testem, żeby wyników nie naginać.
Propozycje z R1o (D-227) zastąpiła ta tabela; zmiana: Q-73 B patrzy na najdłuższe biegi testerów, nie na p90 wszystkich
biegów (ludzie przegrywający szybciej niż bot to sprawa tempa tygodnia 1, nie ściany po tygodniu 3).

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
| B9 | Czy przeniosłeś kiedyś samolot z jednej trasy na inną? (tak, kilka razy / raz-dwa / nie / nie wiedziałem, że można) — R8-2 | Did you ever move an aircraft from one route to another? (yes, several times / once or twice / no / didn't know I could) — R8-2 |
| B10 | Którą kartę tygodnia wybrałeś ostatnio i dlaczego (jedno zdanie)? Czy któraś karta wydała się „bez sensu”? (nie / tak — która) — R8-3 | Which weekly card did you pick last time and why (one sentence)? Did any card seem pointless? (no / yes — which) — R8-3 |
| B11 | Czy widziałeś przy lotnisku stempel „SLOT” (wstrzymany odlot)? (tak / nie / nie wiem); ile samolotów miałeś najwięcej na jednym lotnisku? (1–2 / 3–4 / 5+ / nie wiem) — R8-4 | Did you see a "SLOT" stamp by an airport (a held departure)? (yes / no / don't know); the most aircraft you had at one airport? (1–2 / 3–4 / 5+ / don't know) — R8-4 |

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
| C8 | Na ekranie końca gry: czy wiedziałeś, co mogło uratować lotnisko? (tak / nie / zgadywałem); czy miałeś wtedy wolny samolot w doku? (tak / nie / nie wiem) — R8-1 | On the game-over screen: did you know what could have saved the airport? (yes / no / I guessed); did you have a spare aircraft in the dock then? (yes / no / don't know) — R8-1 |
| C9 | Czy doszedłeś do ciszy nocnej (lotniska gasną nocą, od tygodnia 3)? (tak / nie / nie wiem); jeśli tak — co wtedy dzieje się z lotniskiem? (własnymi słowami) — R8-5 | Did you reach the night curfew (airports go dark at night, from week 3)? (yes / no / don't know); if yes — what happens to the airport then? (your own words) — R8-5 |
| C10 | Czy w ostatnich minutach biegu miałeś na co wydać decyzję, czy tylko patrzyłeś? (miałem co robić / trochę / tylko patrzyłem) — R8-7 | In the last minutes of a run, did you have decisions to make, or did you just watch? (had things to do / a little / just watched) — R8-7 |

## Arkusz obserwacji pierwszej sesji (R6i)

Dla 3–5 testerów z nagraniem (dzień 1) i dla każdej sesji, którą obserwujemy na żywo. Jeden arkusz na osobę,
oznaczoną pseudonimem (`T01`, `T02`, …) — bez imienia, e-maila i modelu konta. Obserwator wypełnia go z nagrania albo
na bieżąco; nagrania zostają prywatne, poza repozytorium, i kasujemy je po teście.

**Zasady obserwacji.** Tester dostaje tylko instrukcję z e-maila (PL/EN wyżej). Obserwator **nie podpowiada** przez
10 minut; gdy tester utknie na ponad 60 s i prosi o pomoc, obserwator mówi jedno zdanie i zaznacza „po podpowiedzi”.
Czas liczymy od pierwszego ekranu z globusem w biegu **Lot bez końca** (po szkoleniu albo jego pominięciu), w sekundach
z licznika nagrania. Tester mówi na głos, co myśli; obserwator zapisuje cytaty dosłownie.

| # | Co notujemy | Jak | Wynik (wpisać) |
|---|---|---|---|
| O1 | Szkolenie: ukończone / pominięte / porzucone; krok, na którym się zawahał (> 10 s bez ruchu) | z nagrania | |
| O2 | **Sekundy do pierwszej własnej trasy** na prawdziwym globusie (od pierwszego ekranu z globusem do pierwszej trasy, po której leci samolot) | licznik nagrania | s |
| O3 | **Czy znalazł dok** (samoloty na przywieszkach) i przypisał samolot do trasy: sam / po podpowiedzi / nie; sekunda | z nagrania | |
| O4 | **Pierwszy moment „nie ma nic do roboty”** (tester czeka, przewija globus bez celu albo to mówi): minuta i co było na ekranie | z nagrania + cytat | min |
| O5 | **Co znaczy glif** pasażera: po biegu pokazać glif przy lotnisku i zapytać „co oznacza ten znak?” — dobrze (region docelowy) / częściowo / źle | pytanie po biegu | |
| O6 | **Tablica tygodnia (skrzynia)**: czy wybrał kartę i umieścił nowy samolot z doku **bez pomocy**; czy umie powiedzieć, co wybrał | z nagrania + pytanie | |
| O7 | Pierwsza porażka: minuta; czy umie powiedzieć dlaczego (porównać z A1 i `cause` w CSV) | pytanie po biegu | |
| O8 | Inne miejsca, gdzie utknął > 10 s (ekran, element, cytat) | z nagrania | |
| O9 | **Przeniesienia samolotu** (R8-2): ile razy zdjął samolot z trasy i dał go innej (albo usunął trasę, by uwolnić samolot); czy zrobił to, gdy lotnisko nie miało trasy, a dok był pusty | z nagrania (licznik) | razy |
| O10 | **Stempel SLOT** (R8-4): czy pojawił się wstrzymany odlot i czy tester go zauważył (sam / po pytaniu / nie); najwięcej samolotów na jednym lotnisku | z nagrania + pytanie | |

**Sprawdzenia na urządzeniu** (obserwator albo tester według krótkiej instrukcji w Grupie; jedna próba na telefon):

| # | Sprawdzenie | Kroki | Wynik |
|---|---|---|---|
| U1 | **Android: muzyka z innej aplikacji** (focus audio WebView, dziś nieznane) | włączyć muzykę w innej aplikacji (np. odtwarzacz muzyki), otworzyć Airway; zagrać 1 min z dźwiękiem gry włączonym, potem wyłączonym w Ustawieniach | muzyka gra dalej / ścisza się / zatrzymuje się (osobno dla dźwięku gry wł./wył.) |
| U2 | **Wibracje na tanim telefonie** (R6d, R6e) | Ustawienia → Wibracje włączone; przeciągnąć trasę do lotniska (przyciągnięcie, „snap”), potem doczekać zatoru albo końca gry (zator / koniec) | snap: wyraźna / słaba / brak / brzęczy; zator: wyraźna / słaba / brak / brzęczy; model telefonu |

Arkusz trafia do tabeli zbiorczej (jeden wiersz na testera). **Progi** (jak tabela decyzji — spisane przed testem;
obserwowanych jest mało, więc liczymy osoby, nie procenty):

| Sygnał | Próg | Decyzja |
|---|---|---|
| O2 sekundy do pierwszej trasy | mediana > 60 s albo ≥ 2 osoby > 120 s | przegląd pierwszego ekranu biegu i podpowiedzi trasy przed premierą |
| O3 dok nieznaleziony sam | ≥ 2 osoby | mocniejsza wskazówka doku (pierwsza karta) |
| O4 „nic do roboty” przed 3. minutą | ≥ 2 osoby | wraca tempo tygodnia 1 (Q-60, D-113) |
| O5 glif źle | ≥ 2 osoby | legenda glifów w szkoleniu / na przywieszce |
| O6 tablica tygodnia z pomocą | ≥ 2 osoby | przegląd tablicy tygodnia (skrzynia, dok) |
| O9 zero przeniesień, gdy lotnisko bez trasy i pusty dok | ≥ 2 osoby | wskazówka przeniesienia samolotu (R8-2) przed premierą |
| O10 SLOT nie zauważony mimo wstrzymania | ≥ 2 osoby | stempel SLOT wyraźniej (R8-4, Q-80) |
| U1 muzyka zatrzymuje się przy wyłączonym dźwięku gry | 1 telefon | zadanie platformy: nie przejmować focusu audio, gdy dźwięk gry jest wyłączony |
| U2 wibracja brak / brzęczy na tanim telefonie | ≥ 2 telefony | R6e (stałe systemowe Androida) przed premierą |

## Pytania R8 (R8g, D-240)

Siedem pytań audytu R8 (`docs/RESEARCH.md`, R8 — „Pytania do testu zamkniętego”). Audyt liczył na regułach v5; od
reguł v6 cisza nocna zaczyna się w tygodniu 3 (D-151, Q-72 → B), a tablica tygodnia pokazuje tylko karty, które mogą
zadziałać (D-150), więc progi dotyczą reguł v6 i odniesienie z bota bierzemy z `docs/balance/game-summary.md`. Dziennik
nie zapisuje przeniesień samolotu ani wolnych samolotów w chwili porażki (D-16: tylko liczby potrzebne do Q-73/Q-78/Q-80),
więc pytania 1, 2 i 4 idą przez ankietę i arkusz obserwacji; pytania 5 i 6 liczymy także z CSV.

| R8 | Pytanie z RESEARCH R8 | Gdzie pytamy | Z dziennika (CSV) | Próg z RESEARCH R8 | Wiersz decyzji |
|---|---|---|---|---|---|
| 1 | Czy wiedziałeś, co mogło uratować lotnisko? Czy był wolny samolot? | C8 | `cause` (`no-route`) | „nie” > 30 % → rada R8b ma sens | R8-1 |
| 2 | Ile razy gracz przeniósł samolot z trasy na trasę? | B9, O9 | — (nie zapisujemy) | „prawie nigdy” → przenoszenie jest ukryte | R8-2 |
| 3 | Jaką kartę wybrał i dlaczego; czy któraś była „bez sensu”? | B10 | `picks` | ≥ 1/3 testerów → R8a | R8-3 |
| 4 | Czy widział wstrzymany odlot (stempel SLOT); ile samolotów na najbardziej obciążonym lotnisku? | B11, O10 | `held_min` | odpowiedź na D-41 dla ludzi | R8-4 |
| 5 | Czy doszedł do ciszy nocnej i czy zrozumiał zamknięcie lotniska? | C9 | `weeks` ≥ 2 (`endless`) | odsetek < 30 % → Q-72 B (już w mocy, D-151) | R8-5 |
| 6 | Rozkład długości biegów (p10/p50/p90), czy najlepsi przekraczają 30 min? | — | `min_1x` (`endless`) | rozkład, nie sama mediana; > 30 min | R8-6 |
| 7 | Czy w ostatnich minutach miałeś na co wydać decyzję, czy tylko patrzyłeś? | C10 | — | sufit tygodnia 4–5 (R8f) | R8-7 |

## Tabela decyzji (R3k, D-232) — progi spisane przed testem

Liczymy z podsumowań z **dnia 14** (`npm run playtest:decode`, jeden wiersz na bieg) i z ankiet. „Tester” = osoba z
wklejonym podsumowaniem z dnia 14; mianownik „z 12” skaluje się do faktycznej liczby (np. „≥ 4 z 12” = ≥ 33 %).
**Minimum danych:** decyzję z wiersza podejmujemy, gdy ≥ 8 testerów wkleiło podsumowanie i spełniony jest warunek
w kolumnie „Minimum”; inaczej obowiązuje stan obecny (kolumna „Bez danych”) i pytanie wraca po premierze.

Odniesienie z bota: `docs/balance/game-summary.md` (50 ziaren, 30 min, reguły v6, bot po N12ad) i pomiary 200 ziaren
z `docs/balance/README.md` (N12af) oraz R8 (`docs/balance/r8-audit-200.csv`, reguły v5). Bot gra na 1× i nie pauzuje,
więc porównujemy z kolumną `min_1x`; `min_real` mówi tylko, ile życia zajmuje bieg.

| Pytanie | Sygnał (kolumna CSV / ankieta) | Odniesienie z bota | Minimum | Decyzja przy progu | Bez danych |
|---|---|---|---|---|---|
| **Q-73** (D-152) koniec biegu | (a) mediana `min_1x` biegów `endless`; (b) mediana najdłuższego biegu `endless` każdego testera; (c) C3 „tak” i C2 „za wcześnie” | 50 biegów (start o 07:00, D-343): p10 11,78 · mediana 17,67 · p90 24,20 min; tygodnie mediana 2,45, W5 w 1 z 50; 200 biegów: max 31,6 min, nikt nie widzi 5. tablicy | ≥ 40 biegów `endless` od ≥ 8 testerów | **B** (łagodniejsza rampa po tygodniu 3, przegląd R8f), gdy (b) ≥ 22 min **i** ≥ 5 z 12 odpowiada „tak” w C3 albo „za wcześnie” w C2 — dobrzy gracze dochodzą do ściany bota. **A**, gdy (a) mieści się w 10–18 min (D-79) i ≤ 3 z 12 chce dłuższych biegów. (a) < 10 min → to nie Q-73, tylko tempo 1. tygodnia: wraca Q-60 (D-113, wariant 11 h × 110 %) | A (reguły v6) |
| **Q-78** (D-204) karta „Rozbudowa huba” | `hub_picked / hub_offered` (suma); B5 (czy wiedzą, co robi) | 50 biegów: w ofercie 99, wybrana 10 (10 %); N12ad: 7–11 % wyborów | ≥ 40 ofert karty huba | **A** (bez zmian), gdy ≥ 10 % ofert i ≤ 3 z 12 odpowiada „nie wiem” / błędnie w B5. **D** (zmierzyć inny efekt huba), gdy < 5 % ofert **albo** ≥ 4 z 12 nie rozumie karty. 5–10 % i zrozumiała → A, ponownie po premierze | A |
| **Q-80** (D-215) karta „+2 sloty” | odsetek biegów z `held_min` > 0; `slots_picked / slots_offered`; B6 | 50 biegów: wstrzymanie w 7 (14 %), karta na 4 tablicach, 0 wyborów; 200 biegów: wstrzymanie w 12 (6 %), karta na 4 z 364 tablic, bot nie bierze nigdy | ≥ 60 biegów (endless + daily) | **A**, gdy `held_min` > 0 w ≥ 20 % biegów **i** kartę wybrało ≥ 2 testerów. **B** (usunąć kartę z puli Endless i gry dnia; zagadki bez zmian), gdy `held_min` > 0 w < 10 % biegów **i** karta była w ofercie na < 3 % tablic (tablice = suma `weeks`). Pomiędzy → A | A |
| Q-35 karta zawsze najlepsza | pierwszy znak `picks` (tydzień 1); B4 | R8: tydzień 1 — szerokokadłubowiec 63 %, turbośmigłowiec 36 %, hub 1 % (194 biegi) | ≥ 30 biegów z `picks` | Q-35 → wariant B (przegląd kart), gdy jedna karta ≥ 70 % wyborów tygodnia 1 **albo** ≥ 6 z 12 wskazuje tę samą kartę w B4 | bez zmian |
| Przyczyna porażki | `cause` (pierwsza przyczyna tablicy) | R8: `regional-demand` 47 %, `no-route` 33 %, `capacity` 21 % | ≥ 30 porażek z `cause` | `no-route` ≥ 50 % porażek → nowe lotniska są przeoczane: przegląd sygnału nowego lotniska przed premierą. `slot-wait` ≥ 10 % → potwierdza Q-80 A | bez zmian |
| „Nie wiem, czemu przegrałem” | A1 = „nie” | — | ≥ 8 odpowiedzi A | ≥ 4 z 12 → wskazówka na raporcie końca (R1j) mocniej i przegląd tablicy przyczyn przed premierą | bez zmian |
| Szkolenie nieukończone | `tutorial_now` ≠ `completed` | — | ≥ 8 podsumowań | ≥ 3 z 12 → skrócić / przebudować krok, w którym odpadają (nagrania, arkusz R6i) | bez zmian |
| Pierwszy bieg | najstarszy bieg każdego testera (`min_1x`) w podsumowaniu z dnia 7 | bot: p10 11,16 min | ≥ 8 testerów | mediana < 6 min albo > 20 min → przestroić tydzień 1 (Q-51, D-79, D-113) | bez zmian |
| Wydajność | A4 „często”, B8 „mocno”; `preset`, `adapt_steps` | — | — | ≥ 2 osoby z tą samą rodziną GPU → R3f/R3i dla niej (Q-31/Q-32); ≥ 3 testerów z `adapt_steps` ≥ 2 → przegląd drabiny adaptacji (D-74) | bez zmian |
| Gra dnia | `dailies` i dni z `mode = daily` w podsumowaniu | — | ≥ 8 podsumowań | < 4 z 12 gra ≥ 5 z 7 dni (dni 8–14) → wraca Q-45 (przypomnienie) | bez zmian |
| Czego brakuje | C4 = cel / odmiana | — | ≥ 8 odpowiedzi C | ≥ 5 z 12 → Q-50: R2g + R2h przed premierą | bez zmian |
| Poprawka z dnia 8 | `version` biegów z dni 9–14 | — | — | < 9 z 12 testerów gra na nowej wersji do dnia 11 → przypomnienie w Grupie (aktualizacja w Play) | — |
| **R8-1** rada końca gry (R8b, N12y) | C8 „nie” (bez „zgadywałem”) i C8 wolny samolot; `cause` = `no-route` | 50 biegów: porażka bez wolnego samolotu 48 z 49 (98 %), lotnisko bez trasy 13 (27 %); R8 (v5): 56 z 200 bez trasy | ≥ 8 odpowiedzi C | „nie” > 30 % odpowiedzi C8 → rada `gameover.unservedNoSpare` (R8b) nie wystarcza: przegląd raportu końca gry przed premierą (rada przy lotnisku na globusie). „Nie” przy „wolny samolot: tak” u ≥ 3 z 12 → brakuje rady „wolny samolot w doku”. ≤ 30 % → bez zmian | bez zmian |
| **R8-2** przenoszenie samolotu | B9 „nie” + „nie wiedziałem, że można”; O9 | bot od N12z przenosi samolot, gdy lotnisko nie ma trasy, a rezerwa jest pusta; R8 (v5, bot bez przenoszenia): 56 z 200 porażek bez trasy | ≥ 8 odpowiedzi B | ≥ 6 z 12 (50 %) nie przeniosło nigdy **albo** O9 = 0 u ≥ 2 obserwowanych → przenoszenie jest ukryte: wskazówka w szkoleniu / raporcie końca przed premierą i Q-73 czeka na drugi pomiar po niej (krótkie biegi to wtedy nie tempo) | bez zmian |
| **R8-3** karta „bez sensu” (R8a) | B10 „tak — która”; `picks` | 50 biegów (v6, start o 07:00): „+2 sloty” w ofercie 4, wybrana 0; „Rozbudowa huba” w ofercie 99, wybrana 10 (10 %) | ≥ 8 odpowiedzi B | ≥ 4 z 12 (1/3) nazywa tę samą kartę „bez sensu” → D-150 nie wystarczyło: przegląd kart razem z Q-35 B (i Q-78 D, gdy to karta huba). < 4 z 12 → bez zmian | bez zmian |
| **R8-4** stempel SLOT (D-41) | B11 „tak”, B11 samoloty na lotnisku; O10; `held_min` > 0 | 50 biegów: wstrzymanie w 7 (14 %), 9 wstrzymanych odlotów | ≥ 8 odpowiedzi B | ≥ 4 z 12 widziało SLOT **albo** ≥ 3 z 12 ma 5+ samolotów na jednym lotnisku → D-41 działa dla ludzi: wspiera Q-80 A. ≤ 1 z 12 widziało SLOT i nikt nie ma 5+ → wspiera Q-80 B. Decyduje wiersz Q-80 | bez zmian |
| **R8-5** cisza nocna (D-17, D-151) | testerzy z biegiem `endless` o `weeks` ≥ 2 (doszli do tygodnia 3); C9 „tak” i poprawny opis | 50 biegów (v6, start o 07:00): cisza w 37 (74 %), wstrzymanie ciszą w 30 z 37 (81 %); R8 (v5, od tyg. 4): 29 z 200 (15 %) | ≥ 8 podsumowań | < 30 % testerów doszło do ciszy → wraca Q-72 C (od tygodnia 2) do właściciela. Doszło ≥ 30 %, ale < 30 % z nich opisuje zamknięcie dobrze w C9 → przegląd sygnału ciszy (lotnisko gaśnie, przywieszka) przed premierą | bez zmian |
| **R8-6** rozrzut długości biegu | p10 / p50 / p90 `min_1x` biegów `endless`; najdłuższy bieg każdego testera | 50 biegów: p10 11,78 · mediana 17,67 · p90 24,20 · max 30,00 min; R8 (v5, 200 biegów): max 31,6 min | ≥ 40 biegów `endless` od ≥ 8 testerów | ≥ 3 z 12 testerów ma bieg > 30 min → sufit bota nie jest sufitem ludzi: R8f odkładamy. 0 z 12 > 30 min **i** p90 ludzi ≤ p90 bota → ściana jest wspólna: argument dla Q-73 B (przegląd R8f). Wpisujemy p10/p50/p90, nie samą medianę | bez zmian |
| **R8-7** ostatnie minuty | C10 „tylko patrzyłem” | 50 biegów: porażka w tyg. 4 w 8, w tyg. 5 w 1 (z 50) | ≥ 8 odpowiedzi C | ≥ 4 z 12 „tylko patrzyłem” → sufit tygodnia 4–5 jest odczuwalny: R8f (więcej samolotów / wolniejsza rampa) idzie do właściciela z Q-73. < 4 z 12 → bez zmian | bez zmian |
| **D-270** progi etapów (tydzień 4, 750 pasażerów) | `milestones` biegów `endless`: odsetek biegów z `4` i z `S`; odsetek testerów, którzy choć raz mają `4` / `S` | 50 biegów: tydzień 4 w 9 (18 %), 750 pasażerów w 1 (2 %); pierwszy hub 50, wszystkie regiony 35, tydz. 2 50, tydz. 3 33, 500 pasażerów 7 (D-270) | ≥ 40 biegów `endless` od ≥ 8 testerów | Etap, który ma ≥ 80 % biegów (np. `4` albo `S`) → za łatwy: próg w górę (tydzień 5 / 1 000) jako nowa decyzja. Etap, którego nie ma żaden tester (0 z 12) → za trudny: próg w dół o jeden krok. Pomiędzy → bez zmian | bez zmian (D-270) |
| **D-271** kontrakt tygodnia: trudność i nagroda | `contracts_met / contracts_offered` (suma, biegi `endless` z `contracts_offered` > 0); odsetek testerów z ≥ 1 spełnionym | bot (D-247, trudność A): około połowa kontraktów spełniona; bot nie bierze skrzynki z kontraktu | ≥ 30 zaoferowanych kontraktów od ≥ 8 testerów | < 25 % spełnionych → za trudny: cel 80 % zamiast 100 % oczekiwanego popytu (nowa decyzja). > 75 % spełnionych → za łatwy albo nagroda za tania: cel 120 %. ≤ 3 z 12 testerów spełnia choć jeden → nikt nie gra o kontrakt: przegląd nagrody (czwarta skrzynka) przed premierą. 25–75 % → bez zmian | bez zmian (D-271) |
| **D-272** wielkość szczytu ruchu (+12 w 6 h) | `surge_lost` = 1 wobec `surges_opened` (suma); `surge_extra` na otwarte okno | 200 biegów: 140 ogłoszonych, 85 okien w 79 biegach, dodatkowi pasażerowie na taki bieg mediana 12 (3–24), 4 porażki na lotnisku szczytu (D-249) | ≥ 30 otwartych okien od ≥ 8 testerów | `surge_lost` w ≥ 15 % otwartych okien → szczyt za duży albo zapowiedź za krótka: +8 zamiast +12 (nowa decyzja). `surge_lost` w 0 okien przy ≥ 60 otwartych **i** mediana `surge_extra` na okno ≥ 10 (szczyt w pełni obsłużony) → szczyt bez znaczenia: +16. Pomiędzy → bez zmian | bez zmian (D-272) |
| **D-273** siła klasy II licencji | biegi `endless` z `licence` = 2 wobec `licence` = 1 tych samych testerów: mediana `weeks` i `min_1x`; liczba testerów z biegiem `licence` = 2 | 200 biegów: mediana 16,75 (I) / 15,45 (II) / 14,10 (III) min; tydzień 4: 30 / 20 / 12 z 200 (D-273) | ≥ 15 biegów klasy II od ≥ 4 testerów | Klasa II krótsza od I o < 1 min (mediana `min_1x` tych samych testerów) → za łagodna: cisza nocna od tygodnia 2 i 2 turbośmigłowce. Krótsza o > 4 min → za ostra: rezerwa 4 turbośmigłowców. < 4 z 12 testerów otworzyło klasę II → próg otwarcia (tydzień 4) wraca do właściciela. Pomiędzy → bez zmian | bez zmian (D-273) |

Wyniki wpisujemy pod tabelą (kolumna „Wynik”, liczby z CSV) i każdą decyzję jako nowe D-xx. Progów **nie zmieniamy**
po zobaczeniu danych; jeśli próg okaże się źle postawiony, zapisujemy to jako osobną decyzję z uzasadnieniem i
rozstrzygamy po premierze.

## Arkusz odpowiedzi do wniosku o produkcję (R3k)

Play Console pyta o to po teście zamkniętym kont osobistych (Play Console Help 14151465). Konto organizacji (D-94)
tego wniosku nie składa — arkusz zostaje jako gotowy opis testu (prasa, Apple, własne notatki) i jako zapas, gdyby
konto było osobiste. Odpowiedzi wpisujemy **po angielsku** (formularz konsoli); `[…]` uzupełniamy liczbami z tabeli
decyzji i z listy zmian PR poprawki.

| Pytanie Google | Skąd odpowiedź | Szkic (EN) |
|---|---|---|
| How easy was it to recruit testers? | tabela „Rekrutacja”, lista Grupy | "We recruited [N] testers ([n PL] Polish, [n EN] English speakers) from friends, Polish game-dev and mobile-gaming communities and a sign-up form on airway.games, without paid testing services. [n] testers used budget Android phones and [n] tablets or foldables." |
| Describe the engagement of your testers | podsumowania z dnia 14: `flights`, `dailies`, liczba biegów, zagadki | "[n] of [N] testers played until day 14. Median [x] flights per tester ([x] Endless runs, [x] daily challenges); [x] testers solved puzzles 1–10, [x] reached 11–30. Testers used every mode: flight training, Endless, the daily challenge and puzzles." |
| Was the usage similar to what you expect in production? | `min_real`, `dailies`, ankieta B2 | "Yes: short sessions on phones (median [x] real minutes per run), a daily challenge most days ([x] of [N] testers on ≥ 5 of 7 days), longer Endless runs at weekends." |
| Summarise the feedback and how you collected it | ankiety A/B/C, nagrania, Grupa | "Three surveys (day 1, 7, 14) in Polish and English, a logbook summary the testers pasted themselves (no analytics in the app), [n] screen recordings of the first ten minutes and bug reports in the Google Group. Top five points: 1. […] 2. […] 3. […] 4. […] 5. […]" |
| Intended audience | D-16, `docs/store/en.md` | "Adults and teenagers who like calm strategy and puzzle games on phones and tablets; Polish and English at launch, more languages later." |
| How does your app provide value? | opis sklepu | "A premium-feel, ad-free network builder on a 3D globe: players design an airline's routes, planes fly on their own and passengers change planes at hubs. Daily challenge and 40 hand-made puzzles." |
| Expected installs in the first year | MONETIZATION / plan marketingu | "[x]–[y] (organic store search, press kit, communities)." |
| What changes did you make based on the test? | PR poprawki z dnia 8 + decyzje D-xx po teście | "Release [version] on day 8: […]. After day 14: […] (each change linked to the survey signal that caused it)." |
| How did you decide the app is ready for production? | dowód gotowości | "No crash or blocking report from day 9 to 14; the Play pre-launch report without crashes; our full automated test suite (`test:ci`) green on the release build; every decision rule from the test plan evaluated and recorded." |

Dowód gotowości do zachowania (zrzuty / linki): raport przed wydaniem z konsoli, przebieg `test:ci` na commicie wydania,
tabela decyzji z wynikami, lista zmian poprawki (PR), liczba zgłoszeń blokujących w dniach 9–14 (= 0).

## Po teście

1. Zebrać biegi z podsumowań z dnia 14 w jeden arkusz: `npm run playtest:decode -- plik.txt > biegi.csv` (linie
   `AW1:`, sekcja wyżej).
2. Policzyć każdy wiersz **Tabeli decyzji** (najpierw kolumna „Minimum”); wpisać wyniki i decyzje jako D-xx.
3. Wypełnić **Arkusz odpowiedzi do wniosku o produkcję** liczbami z punktu 2 i listą zmian poprawki z dnia 8.
