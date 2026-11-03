# Pytania do właściciela — zbiorczy arkusz

Zebrane 2026-11-03 (nocny agent, N7i) z sekcji „Pytania do właściciela” w PR #33–#61 oraz z dokumentów
(`docs/DECISIONS.md` — statusy „proposal / to implement”, `docs/legal/leaderboards-privacy.md`, `docs/FIREBASE.md`,
`docs/RESEARCH.md`). Pominięte są pytania już rozstrzygnięte decyzjami D-60…D-68 albo załatwione późniejszym zadaniem
(np. format „2 500” → D-61, kod/nazwa na stemplu → D-68, kolejność zrzutów → D-63, obrót globusa w menu → D-62,
przywieszka „SLOT” przy lotnisku → zadanie 38, dzielenie „Szerokokadłubowiec” → zadanie 37 / D-51).

Każda odpowiedź może być krótka („Q-07: tak”, „Q-12: B”). **Obecnie w grze** to odwracalna wartość domyślna, która
działa do czasu Twojej decyzji. Po decyzji agent zapisuje ją jako D-xx w `docs/DECISIONS.md` i usuwa wiersz stąd
(albo oznacza go „rozstrzygnięte → D-xx”). Nowe pytania z kolejnych PR dopisujemy na końcu odpowiedniej sekcji.

Priorytet: **P1** — blokuje wydanie albo sklep, **P2** — warto zdecydować przed testem na urządzeniu,
**P3** — kosmetyka, domyślna wartość jest bezpieczna.

## A. Rankingi online i prywatność (przed wydaniem)

| ID | P | Pytanie | Opcje | Obecnie w grze | Rekomendacja | Źródło |
|---|---|---|---|---|---|---|
| Q-01 | P1 | Kto jest administratorem danych (pełna nazwa, adres, kontakt) w polityce prywatności rankingów? | — (dane właściciela) | Puste pole w szkicu `docs/legal/leaderboards-privacy.md` | Podać dane firmy/osoby, która publikuje grę w sklepach | #49, `docs/legal/` |
| Q-02 ✅ D-77 | P1 | Jak długo przechowywać wpisy rankingu i jak je usuwać na żądanie? | A: 90 dni + e-mail; B: 90 dni + przycisk „Usuń mój wpis” w ustawieniach; C: bez limitu | Brak automatycznego usuwania (serwer nie ma TTL); szkic mówi „propozycja 90 dni” | A na start (TTL w Firestore to kilka linii), B po wydaniu | #49, `docs/legal/` |
| Q-03 | P1 | Co deklarujemy w Data Safety (Google Play) i App Privacy (App Store)? | A: „Identyfikatory: User ID (anonimowy)” + „Dane o grze”; B: nic (gdy rankingi wyłączone w buildzie) | Rankingi wyłączone bez konfiguracji Firebase — build nic nie wysyła | A, gdy rankingi wejdą do wydania | `docs/legal/` |
| Q-04 | P2 | Ranking tygodniowy: suma wyników dziennych z tygodnia czy najlepszy jeden dzień? | A: suma (nagradza codzienne granie); B: najlepszy dzień | A — suma (D-72, N6b) | A | #48, #49 |
| Q-05 | P2 | Gracze jako znak wywoławczy z anonimowego id (`AW-7F3A`) czy własny nick? | A: tylko znak; B: nick (wymaga moderacji i filtrów) | A — tylko znak, bez nicków | A w MVP | #48 |
| Q-06 | P2 | Osobny ekran rankingu w menu (obok „Wyzwanie dnia”)? | A: tak; B: tylko tablica na ekranie końca gry | B — tablica „Ranking · data” na końcu oficjalnej gry dnia | A, jako małe zadanie po teście rankingów na prawdziwym Firebase | #50 |
| Q-07 | P1 | Założenie projektu Firebase (kroki w `docs/FIREBASE.md`) i budżet z alertami | Budżet np. 10 EUR/mies.; region | Funkcja działa tylko na emulatorze | Założyć przed testem zamkniętym; budżet 10 EUR z alertami 50/90/100 % | `docs/FIREBASE.md`, D-66 |
| Q-41 | P1 | Usuwanie danych rankingu z poziomu aplikacji: Apple (5.1.1(v)) wymaga, by usunięcie konta — także automatycznego konta gościa — dało się rozpocząć w aplikacji; sam e-mail (D-77) nie wystarcza poza branżami regulowanymi | A: przycisk „Usuń moje dane rankingu” w ustawieniach (usuwa wpisy i anonimowe konto) + e-mail jako ścieżka WWW dla Google; B: tylko e-mail (ryzyko odrzucenia w App Store); C: pierwsze wydanie iOS bez rankingów | Tylko e-mail (D-77), brak przycisku | A (zadanie R1a, uzupełnia D-77) | R1, `docs/RESEARCH.md` R1 |

## B. Rozgrywka i balans

| ID | P | Pytanie | Opcje | Obecnie w grze | Rekomendacja | Źródło |
|---|---|---|---|---|---|---|
| Q-08 | P2 | Limit startów na godzinę: 2/h miasto, 3/h hub? | A: 2/3; B: 4/6 (z treści zlecenia 32, w praktyce nie blokuje) | A — 2/h i 3/h (`params.ts`, D-46) | A | #35 |
| Q-09 | P2 | Ulepszenie „+2 sloty” dla jednego wybranego lotniska czy dla wszystkich? | A: jedno lotnisko (realny wybór); B: globalnie | A — jedno wybrane lotnisko | A | #35 |
| Q-10 | P3 | Karta „Rozbudowa huba”, gdy nie ma jeszcze huba | A: wyłączona ze stemplem „Brak huba”; B: ukryta i zastąpiona inną kartą | A | A (zawsze zostaje co najmniej samolot do wyboru) | #33 |
| Q-11 | P2 | Trudność zagadek 16–30: marginesy 25 % → 17 % ponad rozwiązanie wzorcowe — dobre po zagraniu na telefonie? | Łagodniej / tak zostaje / trudniej (liczby w JSON, `targetDelivered`) | Margines maleje od 25 % (16) do 17 % (29–30), D-70 | Zostawić do pierwszego testu na telefonie | #44 |
| Q-35 ✅ D-78 | P2 | Szerokokadłubowiec w 1. tygodniu wyraźnie najsilniejszy: bot (N7w) z wymuszonym wyborem przeżywa średnio 21,8 min (WB-300) wobec 15,8 (TP-48), 16,4 („+2 sloty”) i 17,9 (huba) | A: zostawić; B: osłabić WB-300 na start (np. mniej miejsc / dłuższy postój); C: rzadziej w 1. tygodniu | A — parametry bez zmian | A do testu na ludziach; B, jeśli gracze zawsze biorą WB-300 | #76, `npm run test:bot-policy` |
| Q-36 ✅ D-79 | P3 | Lepszy bot (wydłuża trasy, gdy brak wolnych samolotów) podniósł medianę sesji z 12,9 do 14,6 min — blisko górnej granicy celu 8–15 min z zadania 31 | A: zostawić cel 8–15; B: cel 10–18 (bot gra już rozsądniej); C: przestroić popyt | A — cel bez zmian, bramka zielona | B (cel mierzy bota, nie gracza) | #76, `docs/balance/game-summary.md` |
| Q-45 | P3 | Przypomnienie o wyzwaniu dnia (lokalne powiadomienie, opt-in) | A: bez powiadomień (brak uprawnień, D-16); B: opt-in po kilku zagranych dniach (uprawnienie `POST_NOTIFICATIONS`, zmiana deklaracji prywatności) | A | A na start; wrócić po teście zamkniętym | R1 |
| Q-50 | P2 | Głębia gry po 3. godzinie — który kierunek najpierw? | A: region startowy (R2g) + klasy licencji (R2h) — tylko scenariusze, bez nowych reguł; B: A + zapowiedziane fale popytu (R2i); C: front pogodowy (R2j) jako duża funkcja pierwszej aktualizacji; D: kontrakt tygodnia (R2k) | Jeden scenariusz Endless | B przed wydaniem, C w pierwszej aktualizacji, D po teście zamkniętym | R2 |
| Q-51 | P2 | N12: bot balansu gra teraz rozsądnie zasięgiem (bierze szerokokadłubowiec, gdy flota go nie ma albo lotnisko jest poza zasięgiem turbośmigłowca; łączy dwa nieobsłużone lotniska ze sobą). Mediana sesji wzrosła z 14,55 do 17,81 min — tuż pod górną granicą 10–18 (D-79). Zostało 5/50 przegranych w 1. tygodniu na lotnisku dalej niż 2500 km od wszystkich (przed 1. tablicą nie da się mieć szerokokadłubowca — tak samo dla gracza) | A: zostawić cel i grę; B: w 1. tygodniu nowe lotniska tylko w zasięgu 2500 km od czynnych (uczciwość) i jednocześnie nieco trudniej (np. częstsze lotniska), by mediana została w 10–18; C: poszerzyć cel do 10–20 | A — reguły gry bez zmian, bramka zielona (17,81) | B (przegrana bez możliwej odpowiedzi w 1. tygodniu jest niesprawiedliwa) | N12a, `docs/balance/game-summary.md` |

## C. Wygląd świata i interfejs

| ID | P | Pytanie | Opcje | Obecnie w grze | Rekomendacja | Źródło |
|---|---|---|---|---|---|---|
| Q-12 | P2 | Cieplejsze, złote światło w scenie „gra” (zmierzch)? | A: zostawić obecne; B: mocniejszy złoty pas w `daynight.ts` | A — próba B (N7f) dawała pomarańczowe pustynie i została odrzucona | A | #51, #59, D-63 |
| Q-13 | P3 | Kąt słońca w zrzucie sklepowym „gra” (ok. 17:00 nad siatką) | OK / wcześniej / później | ok. 17:00, wysokość słońca 0,05 | OK | #51 |
| Q-14 | P2 | Jasność nocy: przyciemnić bardziej? | A: zostawić; B: ciemniej (`MOON_INTENSITY`) | A — noc wyraźnie ciemniejsza, kontrast ≥ 9:1 dla tras i lotnisk | A | #36 |
| Q-15 | P3 | Jasność pustyń nocą ×(0,60; 0,56; 0,48) | Zostawić / jaśniej / ciemniej (`NIGHT_SAND_GRADE`) | ×(0,60; 0,56; 0,48) | Zostawić | #41 |
| Q-16 | P3 | Dekoracyjna sieć z lecącymi samolotami w tle menu | A: tak; B: sam globus | A — mała sieć demonstracyjna | A | #36 |
| Q-17 | P2 | Przycisk „Wróć” przy wyborze huba: w żółtym znaku u góry czy kafel przy dolnej krawędzi (zasięg kciuka)? | A: znak u góry (+ systemowy back); B: dolny kafel | A (D-45/D-49) | A; B, jeśli na telefonie okaże się niewygodny | #41 |
| Q-18 | P3 | Strzałki lotnisk przy krawędzi ekranu: kod czy nazwa miasta (przy ustawieniu „nazwa”)? | A: zawsze kod (chip 58 px); B: nazwa (chip ok. 96 px) | A | A | #47 |
| Q-19 | P3 | Słowo na przywieszce odlotu: „SLOT” w obu językach czy po polsku „START”? | A: „SLOT”; B: „START 0:12” w PL | A | A (krótkie, lotnicze) | #42 |
| Q-20 | P3 | „×N” na przywieszce także przy jednym czekającym samolocie? | A: nie; B: tak | A — tylko od 2 samolotów | A | #42 |
| Q-21 | P3 | Gęstość lądu na presecie medium | A: 0,57° (ok. 200 tys. trójkątów, dziś z LOD D-73 jeszcze mniej); B: 0,28° jak na makiecie (ok. 350 tys.) | A | A | #34 |
| Q-22 | P3 | Plamy cieni chmur także na presecie low? | Tak / nie | Tak (jeden draw call) | Tak | #34 |
| Q-23 | P3 | Dzielenie wyrazów: ręczne miękkie dywizy w i18n zamiast `hyphens:auto` | Zostawić / `hyphens:auto` | Ręczne dywizy (D-51) | Zostawić (słowniki w WebView zawodzą) | #40 |
| Q-24 | P3 | Kropka „·” pożyczona z Atkinson w tekście Overpass zamiast poprawiania fontu | Zostawić / poprawiony TTF (zmiana nazwy fontu, OFL RFN) | Pożyczona kropka (D-51) | Zostawić | #40 |
| Q-25 | P2 | Glify i kolory regionów Azja (`ASI`, skrzydło) i Oceania (`OCE`, hak) | Akceptuję / do zmiany | Tymczasowe glify z zadania 05 | Akceptować, poprawki po obejrzeniu na telefonie | DECISIONS (task 05, „require approval”) |
| Q-26 ✅ D-80 | P2 | Własny kolor linii gracza (statecznik samolotu w kolorze linii)? | A: tak, osobne zadanie z paletą CVD; B: statecznik w kolorze typu | B (PR M1 otwarty) | A w osobnym zadaniu | #52 (otwarty) |
| Q-27 | P3 | Lista 15 zabytków miast; mniejsze archetypy dla Europy (Rzym, Stambuł)? | Zostawić / dodać | 15 miast (PR M1 otwarty) | Zostawić | #52 (otwarty) |
| Q-28 | P3 | Kolory dachów lotnisk według regionu | Akceptuję / poprawki | Mapowanie z PR M1 (otwarty) | Akceptować, poprawki po telefonie | #52 (otwarty) |
| Q-37 | P3 | Paleta kolorów linii (D-80): morski (domyślny), błękitny, ceglany, ochra, różany, grafitowy — czy odpowiada? | OK / inne odcienie (plik `src/data/airline-colours.json`, `test:cvd` pilnuje ΔE ≥ 15) | 6 kolorów; kolor widać w ustawieniach i na pasku karty pokładowej; na samolotach po scaleniu M1 | OK; kolory samolotów ocenić po M1 | N9c |
| Q-38 | P3 | Znaki biletu do udostępniania dla Azji i Oceanii: „⌒” (skrzydło) i „⌐” (hak), obok ‹ ⋈ ◖ ⌑ ⟆ ⟧ | OK / inne znaki Unicode (nie emoji; `TICKET_GLYPHS` w `src/game/modes/daily.ts`) | ⌒ i ⌐ (D-81), tymczasowe jak glify ASI/OCE (Q-25) | OK; zmienić razem z glifami Q-25 | N10e |
| Q-40 | P3 | Dziennik lotów (N10n): wejście z menu jako połowa ostatniego wiersza tablicy (USTAWIENIA D0 · DZIENNIK D1), a historia liczy się dopiero od tej wersji | A: zostawić; B: osobny wiersz tablicy (tablica wyższa o 60 px, ciasno na 915×412 z „Kontynuuj”); C: dziennik tylko w ustawieniach | A | A | N10n |

## D. Dźwięk

| ID | P | Pytanie | Opcje | Obecnie w grze | Rekomendacja | Źródło |
|---|---|---|---|---|---|---|
| Q-29 | P2 | Charakter dźwięku (skale regionów, dron napięcia, „tik-tak” slotu) po odsłuchu `docs/audio/` | OK / zmiany (poziomy w `MIX`, `src/audio/engine.ts`) | Wersja z N3 (D-71) | Odsłuchać na telefonie w słuchawkach i głośniku | #46 |
| Q-30 | P3 | Terkot tablicy split-flap przy każdym powrocie do menu czy tylko przy zmianie statusu? | A: zawsze (≤ 8 kliknięć); B: tylko przy zmianie | A | A | #58 |

## E. Wydajność

| ID | P | Pytanie | Opcje | Obecnie w grze | Rekomendacja | Źródło |
|---|---|---|---|---|---|---|
| Q-31 | P2 | Tryb „Oszczędna” (teren low, 30 kl./s, 60 % dekoracji, bez cieni) — dobry kompromis? | Tak / mocniej / łagodniej | Tak, jak opisano (D-73) | Tak; zweryfikować na słabym Androidzie | #53 |
| Q-32 | P2 | Próg automatycznego obniżenia jakości: 24 kl./s | Zostawić / inny próg po pomiarze | 24 kl./s | Potwierdzić na telefonie z GPU Mali | #53 |
| Q-33 | P3 | Ważność zapamiętanego obniżenia jakości | A: 30 dni; B: do nowej wersji aplikacji; C: A lub B, co pierwsze | A — 30 dni (D-74) | C (mała zmiana) | #55 |

## F. Wydanie i marka

| ID | P | Pytanie | Opcje | Obecnie w grze | Rekomendacja | Źródło |
|---|---|---|---|---|---|---|
| Q-34 | P1 | Sprawdzenie znaku towarowego „Airway” (EUIPO/USPTO/UPRP) przed wydaniem | Zlecić / sprawdzić samemu | Niesprawdzone (wstępne wyszukiwanie w sklepach: RESEARCH §7) | Sprawdzić przed przedrejestracją w sklepach | `docs/RESEARCH.md` §7 |
| Q-39 | P3 | Dodać link do gry (np. `airway.games`) na końcu tekstu udostępnianego wyniku dnia? | A: bez linku; B: link po zatwierdzeniu domeny (docs/SITE.md) | A — tekst bez linku (D-81) | B, gdy domena i strona będą gotowe | N10e |
| Q-42 | P1 | Konto Google Play: osobiste czy organizacji? Osobiste (założone po 13.11.2023) wymaga testu zamkniętego ≥ 12 testerów × 14 dni przed produkcją; organizacja wymaga numeru D-U-N-S, ale jest zwolniona. Do tego deklaracja DSA (przedsiębiorca: adres i kontakt widoczne w UE) | A: osobiste + test zamknięty (zaplanować ~3 tygodnie i 12+ osób); B: organizacja (D-U-N-S, firma z Q-01) | Brak konta | B, jeśli gra wychodzi jako firma; inaczej A — test i tak potrzebny jako playtest | R1 |
| Q-43 | P2 | Kolejne języki po PL/EN | A: fala 1 po wydaniu DE, FR, ES, PT-BR (bez zmian technicznych), potem JA (krój CJK OFL, kilka MB); B: od razu z JA; C: czekać na dane z wydania | Tylko PL i EN | A; najpierw opisy w sklepie (R1k), potem tłumaczenie gry z korektą native speakera | R1 |
| Q-44 | P2 | Kraje dystrybucji | A: cały świat oprócz Chin kontynentalnych (Apple: ISBN/ICP; Google Play tam nie działa); B: tylko UE + UK + USA na start; C: cały świat | Nie ustawione | A | R1 |
| Q-46 | P2 | Tekst na zrzutach w sklepie? Żaden sklep nie ma pola podpisu pod zrzutem (Play ma tylko tekst alternatywny), więc obecne „podpisy do konsoli” nie mają gdzie trafić | A: bez tekstu na obrazach, podpisy jako alt text na Play (dziś); B: krótki tekst (2–5 słów) na tabliczce lotniskowej w kadrze, ≤ 20% obrazu, bez „pobierz/#1/darmowa”; C: A na start, B w eksperymencie Play po wydaniu | Bez tekstu; podpisy w `docs/store/*.md` | C | R2 |
| Q-47 | P3 | Pierwszy zrzut: zostaje nocny globus (D-63) czy sprawdzamy kadr „gra” na pierwszym miejscu? Na miniaturze w wynikach noc pokazuje światła, mniej mechaniki (hipoteza) | A: zostaje D-63; B: zamiana na „gra, noc, ulepszenie, porażka, menu”; C: D-63 na start + eksperyment Play (Store listing experiments) A vs B po wydaniu | D-63 | C | R2 |
| Q-48 | P1 | Plan wydania: data premiery i kolejność kroków (test zamknięty → pre-order iOS / przedrejestracja Play ≤ 90 dni → premiera), nominacja Apple 6–12 tygodni przed, zgłoszenie do Big Indie Pitch Mobile (PG Connects London, 18.01.2027, wymaga biletu) i Digital Dragons 2027 | A: plan T−12 tygodni z R2 (`docs/LAUNCH.md`, R2f) i oba pokazy; B: plan bez pokazów; C: cicha premiera bez przedrejestracji | Brak planu | A (pokazy tylko z grywalnym buildem) | R2 |
| Q-49 | P2 | Wideo w sklepach: Play przyjmuje tylko link YouTube (kanał właściciela, bez reklam), a gra bez wideo nie pojawia się w części miejsc Google Play; Apple: 15–30 s plik | A: jedno wideo 20–30 s z prawdziwej rozgrywki (R2b) do obu sklepów + kanał YouTube „Airway”; B: tylko App Store (bez YouTube); C: bez wideo | Brak wideo | A | R2 |
