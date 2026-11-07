# Przegląd opisów sklepu i strony — listopad 2026 (propozycja dla właściciela)

Zlecenie GPT-11 (gałąź `night/38a-store-copy`). Pytanie do Ciebie: **Q-90** w `docs/OWNER-QUESTIONS.md` (sekcja F).
Ten dokument niczego nie zmienia w tekstach do wgrania: `docs/store/{en,pl,de,fr,es,pt-br}.md` i `site/i18n.js`
czekają na Twoją zgodę.

## Dlaczego

Sklepy wymagają, żeby metadane opisywały aplikację zgodnie z prawdą (App Store Review Guidelines 2.3 „Accurate
Metadata”, zasady metadanych Google Play). Obecny pełny opis sprzedaje wygląd, którego w grze nie ma albo zaraz nie
będzie:

- „Explore a handcrafted diorama world of oceans, mountains, clouds…” / „morza, góry, chmury i lotniska tworzą barwny
  świat dioramy” — styl Diorama (D-11) zastąpił w D-170 globus satelitarny, a ten też odchodzi: D-283 i D-285 wybrały
  **Linoryt** (druk w trzech farbach na papierze) zamiast zdjęć satelitarnych, trybu „Mapa” i interfejsu Róża (D-257).
  Linoryt wchodzi jednym przełączeniem (krok U5 w `docs/styles/kierunki-2026-11b/PLAN-LINORYT.md`), zrzuty, grafika
  i wideo sklepu powstaną od nowa w kroku U7.
- Opis nie wspomina funkcji, które już są w grze: tygodniowy kontrakt (D-247, D-271), zapowiadane szczyty ruchu (D-249,
  D-272, karta „pierwszy raz” D-292), region startowy (R2g), klasy licencji (D-251, D-273), etapy i kontrakty w raporcie
  końca gry (D-242, D-293).

**Zasada propozycji:** opis mówi o mechanice (co gracz robi i co dzieje się w grze), nie o wyglądzie. Zdania o
wyglądzie wrócą po U7, napisane z prawdziwych nowych zrzutów. Dzięki temu nowy opis jest prawdziwy dziś (satelita +
Róża) i po przełączeniu na Linoryt — nie trzeba go zmieniać drugi raz. Front pogodowy jest tylko w wersji DEV (D-274),
więc go nie reklamujemy. Dalej obowiązuje: bez ceny i słowa „darmowa” (RESEARCH R2), „hub”, nie „terminal” (D-223),
„sieć”, nie „siatka” (D-203); nazwy trybów jak w grze („Endless flight” / „lot bez końca”).

**Jak liczone:** znaki = punkty kodowe Unicode (`[...tekst].length`, jak w `test:store-shots`), bajty = UTF-8 (pole
słów kluczowych App Store). Oba nowe pełne opisy wstawiłem na próbę do `en.md` i `pl.md` i uruchomiłem
`npm run test:store-shots` (limity, „terminal”, „siatka”, cena, nazwy konkurencji): `SUMMARY test:store-shots …
passed=1 failed=0`. Potem cofnąłem tę zmianę.

## 1. Pola sklepu do zmiany

### 1.1 Pełny opis — drugi akapit

| Pole | Limit | Teraz | Propozycja |
|---|---|---|---|
| Full description (EN) | 4000 znaków | 1258 | 1571 |
| Pełny opis (PL) | 4000 znaków | 1250 | 1571 |

Usuwany akapit EN (229 znaków):

> Explore a handcrafted diorama world of oceans, mountains, clouds and airports. As Earth turns, daylight gives way to dusk and night, and new waves of passengers arrive at dawn. Each connection changes how the whole network works.

Dlaczego: „handcrafted diorama world” i „oceans, mountains, clouds” opisują styl z października; chmur nie ma ani na
globusie satelitarnym, ani w Linorycie. Druga połowa akapitu (doba, fale pasażerów o świcie) jest prawdziwa jako
mechanika i zostaje w nowym brzmieniu.

Nowy akapit EN (187 znaków):

> The globe keeps turning, and demand follows the local time of every city: nights are quiet and new waves of passengers arrive at dawn. Each connection changes how the whole network works.

Usuwany akapit PL (224 znaki):

> Spójrz na planetę z bliska: morza, góry, chmury i lotniska tworzą barwny świat dioramy. Wraz z obrotem Ziemi zmieniają się pory dnia, a świt przynosi nowe fale podróżnych. Każda decyzja dotycząca sieci połączeń ma znaczenie.

Nowy akapit PL (185 znaków):

> Globus się obraca, a ruch pasażerów idzie za czasem lokalnym każdego miasta: noce są spokojne, a świt przynosi nowe fale podróżnych. Każda decyzja dotycząca sieci połączeń ma znaczenie.

Fakt w grze: popyt zależy od czasu lokalnego lotniska (`src/sim/daynight.ts`, `src/sim/demand.ts`); samouczek mówi to
samo (`tutorial.hint.complete`: „Noce są spokojne, o świcie rośnie popyt”).

### 1.2 Pełny opis — lista funkcji

Jeden punkt zmieniony (nazwa trybu jak w grze), trzy dodane. Nowe punkty dotyczą tylko lotu bez końca i tak są
napisane, bo wyzwanie dnia i zadania nie mają kontraktów ani szczytów ruchu (D-271, D-272).

| Punkt EN | Znaków | Fakt w grze |
|---|---|---|
| Solve route-building puzzles or grow a network in Endless flight. (było: „in Endless mode”) | 67 | `menu.endless` = „Endless flight” |
| Pick a home region for Endless flight and meet a weekly contract between two cities to get a fourth upgrade to choose from. | 125 | R2g (region startowy); D-247/D-271: kontrakt w obie strony, bez kary, nagroda: czwarta skrzynia na następnej tablicy |
| In Endless flight, get ready for passenger surges announced a day in advance. | 79 | D-249/D-272: szczyt zapowiadany dzień wcześniej, tylko lot bez końca |
| Unlock Endless licence classes II and III: night curfews at airports and tighter rules. | 89 | D-251/D-273: klasa II — cisza nocna od 2. tygodnia, 3 turbośmigłowce; III — do tego huby o 6 miejsc mniejsze |

| Punkt PL | Znaków |
|---|---|
| Sprawdzaj różne rozwiązania w zadaniach i buduj sieć w locie bez końca. (było: „w trybie bez końca”) | 73 |
| Wybierz region startowy lotu bez końca i wykonaj tygodniowy kontrakt między dwoma miastami, a dostaniesz czwarte ulepszenie do wyboru. | 136 |
| W locie bez końca przygotuj się na szczyty ruchu zapowiadane dzień wcześniej. | 79 |
| Zdobywaj klasy licencji II i III lotu bez końca: cisza nocna na lotniskach i ostrzejsze zasady. | 97 |

Piszę „czwarte ulepszenie do wyboru”, a nie „czwarta skrzynia”: skrzynia to obraz z interfejsu Róża, w Linorycie
tablica tygodnia jest kartką papieru (D-287); ulepszenie zostaje.

### 1.3 Pełny opis — akapit o porażce

Dopisane, że raport końca gry pokazuje też osiągnięte etapy i wykonane kontrakty (D-242, D-271, D-293).

- EN (309 znaków cały akapit): „…If a hub becomes overwhelmed, a cause report shows what went wrong, next to the
  milestones and contracts your run achieved, so you can plan a better route next time.”
- PL (294 znaki cały akapit): „…Gdy któryś się przepełni, raport pokaże, co poszło nie tak, a obok osiągnięte etapy
  i wykonane kontrakty — i pomoże zaplanować kolejną próbę.”

### 1.4 Cały nowy pełny opis (do wklejenia po zgodzie)

**EN — 1571 / 4000 znaków**

> Build an airline network across a three-dimensional globe. Connect cities with flight routes, expand airports and plan how passengers transfer between flights. Aircraft fly on their own — you decide where the network goes.
>
> The globe keeps turning, and demand follows the local time of every city: nights are quiet and new waves of passengers arrive at dawn. Each connection changes how the whole network works.
>
> • Draw routes between cities without controlling every aircraft.
> • Choose aircraft types for their range and passenger capacity.
> • Create hubs where travellers can transfer to their next flight.
> • Watch waiting areas and act before a hub becomes overcrowded.
> • Pick an upgrade at the end of each in-game week.
> • Solve route-building puzzles or grow a network in Endless flight.
> • Pick a home region for Endless flight and meet a weekly contract between two cities to get a fourth upgrade to choose from.
> • In Endless flight, get ready for passenger surges announced a day in advance.
> • Unlock Endless licence classes II and III: night curfews at airports and tighter rules.
> • Try the daily challenge with the same starting world for everyone.
>
> You are not an air traffic controller. Your challenge is to design a network that delivers passengers while keeping crowded hubs under control. If a hub becomes overwhelmed, a cause report shows what went wrong, next to the milestones and contracts your run achieved, so you can plan a better route next time.
>
> Airway is a strategy puzzle game about networks, connections and the changing rhythm of a living globe.

**PL — 1571 / 4000 znaków**

> Stwórz własną sieć połączeń lotniczych na trójwymiarowym globusie. Łącz miasta trasami, rozbudowuj lotniska i planuj przesiadki pasażerów. Samoloty latają samodzielnie — Ty decydujesz, którędy prowadzą połączenia.
>
> Globus się obraca, a ruch pasażerów idzie za czasem lokalnym każdego miasta: noce są spokojne, a świt przynosi nowe fale podróżnych. Każda decyzja dotycząca sieci połączeń ma znaczenie.
>
> • Rysuj trasy między miastami bez ręcznego sterowania samolotami.
> • Wybieraj typ samolotu odpowiedni do zasięgu i liczby pasażerów.
> • Buduj huby, w których podróżni przesiadają się na kolejne loty.
> • Obserwuj liczbę oczekujących i reaguj, zanim hub się przepełni.
> • Wybieraj ulepszenie po zakończeniu tygodnia gry.
> • Sprawdzaj różne rozwiązania w zadaniach i buduj sieć w locie bez końca.
> • Wybierz region startowy lotu bez końca i wykonaj tygodniowy kontrakt między dwoma miastami, a dostaniesz czwarte ulepszenie do wyboru.
> • W locie bez końca przygotuj się na szczyty ruchu zapowiadane dzień wcześniej.
> • Zdobywaj klasy licencji II i III lotu bez końca: cisza nocna na lotniskach i ostrzejsze zasady.
> • Podejmuj wyzwanie dnia na przygotowanym dla wszystkich układzie.
>
> Nie musisz kierować każdym samolotem. Twoim zadaniem jest zbudowanie takiej sieci, w której pasażerowie dotrą do celu, a żaden hub nie utknie w zatorze. Gdy któryś się przepełni, raport pokaże, co poszło nie tak, a obok osiągnięte etapy i wykonane kontrakty — i pomoże zaplanować kolejną próbę.
>
> Airway to gra strategiczno-logiczna o połączeniach, przesiadkach i planowaniu na prawdziwym globusie.

Ten sam tekst idzie do `press.long` w `site/i18n.js` (strona prasowa i README pakietu prasowego): `test:site` wymaga,
żeby `press.long` był identyczny z pełnym opisem sklepu, więc `en.md`, `pl.md` i `site/i18n.js` zmieniamy w jednym PR.

## 2. Pola sklepu bez zmian (sprawdzone)

| Pole | EN | PL | Limit | Werdykt |
|---|---|---|---|---|
| Tytuł sklepu | 27 | 24 | 30 znaków | zatwierdzone (D-18, D-203) — poza zakresem |
| Podtytuł App Store | 30 („Design routes. Save your hubs.”) | 24 („Łącz miasta. Ratuj huby.”) | 30 znaków | sama mechanika — zostaje |
| Krótki opis Google Play | 72 | 78 | 80 znaków | „globus 3D” zostaje i w Linorycie (D-283) — zostaje |
| Słowa kluczowe App Store | 96 B | 92 B | 100 bajtów | żadnego słowa o wyglądzie (`earth`/`ziemia`, `3d` dalej prawdziwe) — zostają |

## 3. Teksty związane z obrazami — do kroku U7, nie teraz

Te teksty opisują **konkretne obrazy**, które dziś pokazują globus satelitarny i interfejs Róża. Pasują do obecnych
zrzutów (`docs/store/shots/manifest.json`, `docs/store/contact-sheet.png` — przeczytane, nie nagrywane od nowa), więc
dziś nie są nieprawdziwe, ale po przełączeniu na Linoryt (U5) przestaną pasować. Nie proponuję nowych brzmień na zapas:
alt text musi opisywać prawdziwy nowy obraz. **Krok U7** (koordynator: `store:shots`, `store:feature`, `store:video`,
`site:assets`) przepisuje je razem z obrazami.

| Gdzie | Pole | Znaków EN / PL (limit) | Co przestanie pasować |
|---|---|---|---|
| `docs/store/{en,pl}.md` | Play alt text 1 `night` | 136 / 138 (140) | „lit cities”, „airport roses” / „światła miast”, „róże lotnisk” |
| `docs/store/{en,pl}.md` | Play alt text 2 `game` | 137 / 132 (140) | „low evening sun”, „24-hour day dial and actions” / „tarcza doby i łuk akcji” (Linoryt: pasek doby i dok z pięcioma symbolami, D-285) |
| `docs/store/{en,pl}.md` | Play alt text 3 `upgrade` | 123 / 135 (140) | „freight-label crates” / „skrzynie z etykietami frachtowymi” (D-287: kartka papieru) |
| `docs/store/{en,pl}.md` | Play alt text 4 `failure` | 109 / 112 (140) | pewnie zostaje (sama mechanika: „Network closed”, przyczyny) — sprawdzić z nowym zrzutem |
| `docs/store/{en,pl}.md` | Play alt text 5 `menu` | 139 / 124 (140) | „arc of a compass rose” / „łuk róży wiatrów” (D-286: globus między tytułem a spisem) |
| `docs/store/{en,pl}.md` | Play feature graphic alt text | 105 / 99 (140) | „3D globe at dusk” — zależy od nowej grafiki (`store:feature`) |
| `site/i18n.js` | `meta.ogimage` | jak wyżej | ten sam tekst co alt grafiki Play |
| `site/i18n.js` | `preview.*.alt`, `preview.*.caption` | — | róże lotnisk, „tarcza doby”, „nocna strona globusa świeci miastami” |
| `site/i18n.js` | `preview.menu.title` | — | „Game modes on a compass rose” / „Tryby gry na róży wiatrów” |
| `docs/store/README.md` | opis sceny `menu` i kontraktu DEV | — | „the Róża main menu (D-257)”, „Róża rose menu” |

## 4. Strona — `about.p2`

| Język | Teraz | Znaków | Propozycja | Znaków |
|---|---|---|---|---|
| PL | Ręcznie stylizowany globus 3D, cykl dnia i nocy oraz krótkie sesje strategiczne przygotowane z myślą o telefonach. | 114 | Globus 3D z cyklem dnia i nocy, który zmienia ruch pasażerów, tygodniowe kontrakty i krótkie sesje strategiczne przygotowane z myślą o telefonach. | 146 |
| EN | An illustrated 3D globe, a day-night cycle and short strategic sessions designed around mobile play. | 100 | A 3D globe whose day-night cycle drives passenger demand, weekly contracts and short strategic sessions designed around mobile play. | 132 |

Dlaczego: „ręcznie stylizowany” / „illustrated” obiecuje wygląd (a PL i EN mówią co innego). Propozycja mówi o
mechanice: doba zmienia popyt, tygodniowe kontrakty, krótkie sesje. Pole nie ma limitu sklepu; nowy tekst jest
o ~30 znaków dłuższy i mieści się w akapicie sekcji „Instrukcja lotu” bez zmian w CSS.

Bez zmian (sprawdzone): `hero.description` („małym, żywym globusie” / „living miniature globe”), `about.p1`,
`about.tag1…3` („GLOBUS 3D”), `meta.*` poza `meta.ogimage` — mówią o globusie i mechanice, nie o stylu.
`press.fact.price.value` („Bez reklam i bez zakupów w aplikacji”) — poza zakresem, rozstrzyga D-278.

## 5. Języki fali 1 (DE, FR, ES, PT-BR) — poza zakresem

`docs/store/{de,fr,es,pt-br}.md` mają to samo zdanie o dioramie (tłumaczenie `en.md`, oznaczenie `needs native review`,
D-230/D-276). Po Twojej zgodzie na nowy tekst EN trzeba je przetłumaczyć z nowego `en.md`, zanim pójdą do korekty
native speakera (Q-69/D-136) — inaczej korektor poprawi zdanie, które i tak wypadnie.

## 6. Zmienione bez pytania (dokument wewnętrzny)

`docs/store/README.md`, lista kontrolna przed publikacją zrzutów: zamiast „rich Diorama globe” i listy elementów Róży —
„wygląd, który jest w wydaniu” (Linoryt po U5, do tego czasu satelita + Róża) i wymóg, żeby żaden tekst sklepu ani
strony nie obiecywał wyglądu, którego nie ma na zrzutach.

## 7. Rekomendacja

**A** — przyjąć teraz pełny opis z punktu 1.4 i `about.p2` z punktu 4 (jeden PR: `en.md`, `pl.md`, `press.long` i
`about.p2` w `site/i18n.js`; muszą przejść `test:store-shots`, `test:site`, `build:site`), a teksty z punktu 3 przepisać
w kroku U7 razem z nowymi obrazami. Powód: opis bez obietnic wyglądu jest prawdziwy przed przełączeniem na Linoryt i po
nim.
