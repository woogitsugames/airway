# Plan wydania Airway

Dokument dla właściciela (D-96, Q-48 → A). Oś czasu premiery z RESEARCH „R2 — Marketing wydania niezależnej gry
mobilnej”, plan treści po premierze z RESEARCH „R6 — Plan treści na premierę i pierwsze 3 miesiące” (D-131) i szkice
tekstów wydarzeń w sklepach. Pilnuje go `npm run test:launch-plan` (każde `D-`/`Q-` istnieje, sekcje i wiersze są
na miejscu, daty są prawdziwe, teksty mieszczą się w limitach i nie mówią o cenie).

- **T** = dzień premiery w obu sklepach. Daty jeszcze nie ma — wybiera ją właściciel (D-96); wszystkie kroki liczą
  się w tygodniach od T.
- **Kto:** `właściciel` = konsola sklepu, konto, pieniądze, wysyłka wiadomości, decyzja; `agent` = kod, dokumenty i
  pliki w repo; `właściciel + agent` = agent przygotowuje, właściciel składa lub wysyła. Kroki **tylko dla
  właściciela** są oznaczone w kolumnie „Kto” jako **właściciel**.
- Lista kontrolna sklepów (konta, deklaracje, buildy) jest osobno w `docs/RELEASE.md` (R1l); ten plik mówi **kiedy**.
- Stan na 2026-11-04. Wszystko, co pochodzi z poradników, a nie z dokumentacji sklepów, jest oznaczone **NIEPEWNE**.

## Zasady

1. **Nigdy nie piszemy „free” / „darmowa” / „za darmo” ani ceny** w tekstach wydarzeń Apple, w promocjach Google Play
   ani na grafikach (zakaz cen i promocji w sklepach; RESEARCH R2). „Bez reklam, bez zakupów, bez konta” wolno tylko
   w opisie aplikacji i na stronie (D-16).
2. **Bez nagrody za przedrejestrację.** Nagroda w Play wymaga produktu jednorazowego (IAP), a D-16 nie ma zakupów —
   wszystko jest dla wszystkich.
3. **Pokazy tylko z grywalnym buildem** (D-96). Bez builda nie zgłaszamy.
4. **Jedno wydarzenie w sklepach naraz, co 4 tygodnie** (D-131): każda aktualizacja ma jedną nową mechanikę i zagadki,
   które jej uczą; bez płatnych sezonów i bez FOMO (D-16).
5. Każda zmiana reguł ma wersję parametrów, a stare zapisy i biegi są odtwarzane (D-76).

## Oś czasu (T = premiera)

Zmiana względem R2: pierwsza aktualizacja z zagadkami i drugie wydarzenie są w **T+4**, nie w T+6 — rytm 4 tygodni
zdecydował właściciel później (D-131, D-238).

<!-- launch:timeline -->
| Kiedy | Krok | Kto | Odniesienia | Uwagi |
|---|---|---|---|---|
| T−12 tyg. | Test zamknięty Google Play, 14 dni, 16–18 testerów (też playtest) | właściciel + agent | D-94, D-232, Q-52 | `docs/PLAYTEST.md`: rekrutacja, plan dni, tabela decyzji; konto organizacji jest zwolnione z reguły 12 × 14 |
| T−12 tyg. | Projekt Firebase z budżetem 10 EUR i alertami przed testem z rankingami | **właściciel** | Q-07, D-66, D-234 | `docs/FIREBASE.md`; bez projektu build nic nie wysyła (build A, D-220) |
| T−12 tyg. | Strona prasowa i ZIP gotowe; zwiastun 20–30 s z prawdziwej gry | właściciel + agent | D-219, Q-49 | `site/press.html`; wideo to backlog R2b, kanał YouTube zakłada właściciel (Q-49 otwarte) |
| T−10 tyg. | Nominacja do wyróżnienia w App Store Connect (Featuring Nominations) dla premiery | **właściciel** | D-96 | Apple: minimum 2 tygodnie przed, zalecane do 3 miesięcy; opis: globus z dniem i nocą, przesiadki, gra w pionie |
| T−8 tyg. | Pre-order w App Store (data premiery 2–180 dni od publikacji) | **właściciel** | D-96, D-134 | Wymaga deklaracji tradera (adres i telefon firmy, Q-01) i polityki prywatności online |
| T−8 tyg. | Przedrejestracja w Google Play (najwyżej 90 dni na kraj), bez nagrody | **właściciel** | D-96, D-16, D-220 | Wymaga wypełnionych deklaracji treści i Data safety (`docs/store/privacy-declarations.md`) |
| T−8 tyg. | Strona airway.games opublikowana z linkami do obu sklepów | właściciel + agent | D-67, D-218, Q-01 | `site/launch.js`; bez newslettera (D-136) |
| T−8 tyg. | Zgłoszenia na pokazy z grywalnym buildem (tabela „Pokazy”) | **właściciel** | D-96, Q-48 | Big Indie Pitch Mobile wypada w okolicy T−12 … T−8, jeśli premiera jest w kwietniu 2027 |
| T−4 tyg. | Buildy (TestFlight / test wewnętrzny Play) do twórców wideo z datą embarga | właściciel + agent | D-96, Q-48 | 20–30 osobistych wiadomości z listy twórców (szablon niżej); agent przygotowuje build i notkę |
| T−4 tyg. | Wydarzenie Apple „Tydzień otwarcia” wysłane do akceptacji; nominacja do wyróżnienia wydarzenia | **właściciel** | D-131 | Teksty: E1 w „Teksty wydarzeń”; promocja wydarzenia startuje najwcześniej 14 dni przed T |
| T−2 tyg. | Build wydania: zagadki 01–30, `npm run test:ci` zielone, test na urządzeniach | właściciel + agent | D-193, D-232 | „Daleki zasięg” ukryty w buildzie wydania do T+4 |
| T | Premiera; wydarzenie „Tydzień otwarcia” (Challenge: wyzwanie dnia + ranking tygodnia) | właściciel + agent | D-96, D-131, D-66 | Apple nie przyjmuje samych codziennych zadań, więc wydarzenie to tygodniowy ranking, nie „wyzwanie dnia” |
| T+1 tyg. | Zgłoszenie promocji Play „Major update” dla T+4 (najwcześniej 60 dni przed, akceptacja do 4 dni) | **właściciel** | D-131 | Teksty: P1; grafika nowa, nie z premiery (grafik nie wolno powtarzać) |
| T+2 tyg. | Wydarzenie Apple „Daleki zasięg” (Major Update) wysłane do akceptacji + nominacja | **właściciel** | D-131 | Teksty: E2 |
| T+4 tyg. | Aktualizacja „Daleki zasięg”: zagadki 31–40 w buildzie wydania | agent | D-131, D-193, D-162, D-165 | Usunąć `hiddenInRelease` w `src/data/puzzles/packs.ts`; `test:release-packs` |
| T+8 tyg. | Aktualizacja „Front pogodowy” (R2j) + zagadki 41–45; wydarzenia E3/P2 | właściciel + agent | D-131, Q-50 | Mechanika czeka na Q-50; zgłoszenia jak przy T+4 (Play ≤ 60 dni przed, Apple ≤ 14 dni promocji) |
| T+12 tyg. | Aktualizacja „Kontrakt tygodnia” (R2k) + wariant niedzielny wyzwania dnia; wydarzenie E4/P3 | właściciel + agent | D-131, Q-50 | Wariant zmienia replay na serwerze (`functions/`), więc najpierw koszty (R3, Q-07) |
<!-- /launch:timeline -->

## Pokazy

<!-- launch:showcases -->
| Pokaz | Data | Warunek | Kto | Odniesienia | Stan |
|---|---|---|---|---|---|
| The Big Indie Pitch — Mobile Edition, PG Connects London | 18.01.2027 | Bilet na konferencję; grywalny build | **właściciel** | D-96, Q-48 | do zgłoszenia, jeśli build jest grywalny; termin zgłoszeń NIEPEWNE — sprawdzić na bigindiepitch.com |
| Digital Dragons 2027 (Kraków), Indie Showcase | termin 2027 nieznany | Grywalny build | **właściciel** | D-96, Q-48 | NIEPEWNE: w 2026 konferencja 17.05.2026–19.05.2026; w 2024 zgłoszenia zamykano 01.03.2024 — sprawdzić w styczniu 2027 |
| Google Play Indie Games Festival | brak edycji | — | **właściciel** | D-96 | ostatnia potwierdzona edycja 2022; nie planować |
<!-- /launch:showcases -->

Apple Arcade i Netflix Games nie mają publicznych zgłoszeń — nie planujemy (RESEARCH R2).

## Lista twórców wideo (szablon)

Cel: 20–30 osobistych wiadomości do twórców o lotnictwie i strategii na telefon (prasa mobilna się skurczyła,
RESEARCH R2). Wysyła **właściciel** z adresu kontaktowego; agent przygotowuje build i notkę prasową. **Wypełnionej
listy nie trzymamy w repo** — to dane kontaktowe osób (RODO); tu jest tylko szablon, kopię prowadzi właściciel
u siebie i usuwa wiersze po kampanii.

<!-- launch:creators -->
| Nazwa | Kanał | Odbiorcy | Kontakt | Status |
|---|---|---|---|---|
| (np. Kanał lotniczy) | (link do kanału) | (język, liczba subskrybentów, tematy) | (adres z „O kanale” / formularz) | do kontaktu |
<!-- /launch:creators -->

Status: `do kontaktu` → `wysłano` (data) → `odpowiedź` → `build wysłany` (data embarga) → `opublikowano` (link)
albo `bez odpowiedzi` po 14 dniach (jedno przypomnienie, potem koniec).

## Treści po premierze

Rytm z D-131 (Q-64 → A): co 4 tygodnie jedna nowa mechanika i zagadki, które jej uczą; w każdym sklepie zawsze
trwa jedno wydarzenie. Kierunek mechanik po premierze zależy od Q-50 (otwarte; rekomendacja: front pogodowy jako
pierwsza duża funkcja).

<!-- launch:content -->
| Kiedy | Treść | Nowa mechanika | Zagadki, które jej uczą | Wydarzenie w sklepie | Odniesienia |
|---|---|---|---|---|---|
| T | 30 zagadek, wyzwanie dnia, Endless (+ region startowy R2g i klasy licencji R2h, jeśli wejdą) | — (rdzeń) | 01–15 rdzeń, 16–30 sloty, cisza nocna, tydzień, MCT | Challenge „Tydzień otwarcia” (E1) | D-131, D-193, Q-50 |
| T+4 tyg. | Paczka „Daleki zasięg” 31–40 (start poza Europą, oceany, szerokokadłubowce), poprawki z recenzji | brak nowej reguły — zasięg szerokokadłubowców i odcinki nad oceanem | 31–35 pierwsza połowa, 36–40 druga (gotowe w repo, ukryte w wydaniu) | Major Update „Daleki zasięg” (E2, P1) | D-131, D-162, D-163, D-165, D-193 |
| T+8 tyg. | Front pogodowy (R2j): pas chmur odbiera 1 slot odlotu lotniskom pod nim | front pogodowy | 41–45: 41 jeden front nad pustą siecią, 42 front + sloty, 43 front + cisza nocna, 44 front nad hubem, 45 dwa fronty | Major Update „Front pogodowy” (E3, P2) | D-131, Q-50 |
| T+12 tyg. | Kontrakt tygodnia (R2k) + „niedziela z licencją II” w wyzwaniu dnia (jeden dzień tygodnia z ostrzejszymi pokrętłami scenariusza, taki sam dla wszystkich) | kontrakt tygodnia | 46–50 z celem „kontrakt” (propozycja; nowy rodzaj celu zagadki) | Challenge „Kontrakt tygodnia” (E4, P3) | D-131, Q-50, Q-07 |
<!-- /launch:content -->

Numery zagadek 41–50 i ich tematy to propozycja; każda zagadka potrzebuje `referenceCommands`, tytułu PL/EN i
zrzutów, więc 5 zagadek to jeden PR (R6f: paczki bez ręcznych list).

## Teksty wydarzeń

Szkice do wklejenia w konsolach; przed wysłaniem właściciel czyta je jeszcze raz (**właściciel** składa każde
wydarzenie). Bez słów o cenie, „free/darmowa”, „#1”, „najlepsza” (zasada 1).

### Apple In-App Events

Limity Apple: nazwa ≤ 30 znaków, krótki opis ≤ 50, długi opis ≤ 120. Wydarzenie trwa do 31 dni, promocja do 14 dni
przed startem, naraz do 10 opublikowanych. Typy: Challenge, Major Update.

<!-- launch:apple-events -->
| ID | Typ | Język | Nazwa | Krótki opis | Długi opis |
|---|---|---|---|---|---|
| E1 | Challenge | EN | Opening Week | Build the day's network, climb the weekly board | Every day a new seed, the same for everyone. Plan your hubs, keep them moving and see the week's ranking at the end. |
| E1 | Challenge | PL | Tydzień otwarcia | Zbuduj sieć dnia i wspinaj się w rankingu tygodnia | Co dzień nowy seed, ten sam dla wszystkich. Zaplanuj huby, nie daj im się zakorkować i sprawdź ranking tygodnia. |
| E2 | Major Update | EN | Long Haul: ten new puzzles | Widebodies, ocean legs, starts beyond Europe | Ten puzzles from the Pacific to the South Atlantic. Stretch widebody range over the oceans and link five continents. |
| E2 | Major Update | PL | Daleki zasięg: 10 zagadek | Szerokokadłubowce, oceany, start poza Europą | Dziesięć zagadek od Pacyfiku po południowy Atlantyk. Poprowadź szerokokadłubowce nad oceanami i połącz pięć kontynentów. |
| E3 | Major Update | EN | Weather Front | A cloud deck closes slots as it crosses the globe | A slow front drifts over the globe and takes a departure slot from each airport beneath it. Five puzzles teach it. |
| E3 | Major Update | PL | Front pogodowy | Pas chmur zabiera sloty odlotów nad lotniskami | Powolny front sunie nad globusem i odbiera jeden slot odlotu każdemu lotnisku pod nim. Pięć zagadek uczy, jak go ominąć. |
| E4 | Challenge | EN | Weekly Contract | A contract each week, a fourth crate for it | Each week the board offers a contract between two regions. Fulfil it for a fourth crate, and try the Sunday licence. |
| E4 | Challenge | PL | Kontrakt tygodnia | Kontrakt na tydzień, za wykonanie czwarta skrzynia | Co tydzień tablica proponuje kontrakt między dwoma regionami. Wykonaj go, a dostaniesz czwartą skrzynię. |
<!-- /launch:apple-events -->

### Google Play — promocja „Major update”

Play: promocja „Major update” trwa stałe 28 dni, zgłoszenie najwcześniej 60 dni przed startem, akceptacja do 4 dni,
**grafiki nie mogą się powtarzać** między zgłoszeniami (każda aktualizacja dostaje nową grafikę z prawdziwej sceny,
jak D-117). Limity pól formularza nie zostały sprawdzone w tej sesji (**NIEPEWNE** — sprawdzić w konsoli); teksty
trzymamy krótko: tytuł ≤ 30 znaków, opis ≤ 80.

<!-- launch:play-promos -->
| ID | Język | Tytuł | Opis |
|---|---|---|---|
| P1 | EN | Long Haul: ten new puzzles | Ten puzzles over the oceans: widebodies, long legs, five continents. |
| P1 | PL | Daleki zasięg: 10 zagadek | Dziesięć zagadek nad oceanami: szerokokadłubowce i pięć kontynentów. |
| P2 | EN | Weather Front | A cloud deck crosses the globe and closes departure slots beneath it. |
| P2 | PL | Front pogodowy | Pas chmur sunie nad globusem i zamyka sloty odlotów pod sobą. |
| P3 | EN | Weekly Contract | One contract between two regions each week, a fourth crate for it. |
| P3 | PL | Kontrakt tygodnia | Co tydzień kontrakt między dwoma regionami, za niego czwarta skrzynia. |
<!-- /launch:play-promos -->

## Otwarte sprawy właściciela

- Data premiery **T** (D-96) — od niej liczą się wszystkie kroki.
- Q-01 (dane administratora i firmy: trader, polityka), Q-07 (projekt Firebase i budżet), Q-49 (wideo i kanał
  YouTube), Q-50 (kierunek mechanik po premierze), Q-52 (test zamknięty).
- Zgłoszenie na Big Indie Pitch (18.01.2027) wymaga biletu i grywalnego buildu — decyzja zależy od daty T.
