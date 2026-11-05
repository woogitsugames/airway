# Plansza referencji: prawdziwe mapy lotnicze (KARTA)

Cel: zanim wybierzemy kierunek UI, pokazać **prawdziwe** mapy lotnicze, z których KARTA ma czerpać — zamiast
„generycznego” HUD-u (ciemne paski, drobne wersaliki z rozstrzelonymi literami, mono, ikony z jednej paczki w kółkach,
tagi z paskami i liniami odniesienia). Wszystkie wycinki to prace rządu USA (FAA, U.S. Coast and Geodetic Survey,
Departament Handlu) — domena publiczna; źródła i podstawa prawna w [`SOURCES.md`](SOURCES.md). Tylko materiał
referencyjny, nic z tego nie trafia do gry. Podgląd wszystkiego naraz: [`plansza.png`](plansza.png).

Dla każdego wycinka: co pokazuje → co można przenieść do Airway (HUD, znaczniki lotnisk, tagi, dok, typografia).

## 1. Symbole lotnisk

**01 — Sectional FAA, Baltimore (`01-lotnisko-sectional-bwi.jpg`)**
Lotnisko to krążek (niebieski = z wieżą, magenta = bez) z **wpisanym w środek kształtem pasów** — Fort Meade ma
jeden pas w magentowym kółku; symbol od razu mówi, jak lotnisko „wygląda” z góry. Obok blok 2–3 linijek danych tym
samym kolorem co symbol, bez ramki; VORTAC jako osobny, kanciasty znak w ramce z danymi.
→ Znacznik lotniska w grze = sylwetka pasów (1, 2, krzyż, równoległe) zamiast kropki/ikony; typ lotniska rozróżniony
kształtem pasów (pasuje do reguły „kształt, nie tylko kolor”). Tag = 2–3 linijki tekstu w kolorze znacznika, bez kart.

**02 — TAC Dallas–Ft Worth (`02-lotnisko-tac-dfw.jpg`)**
Duży węzeł (DFW) rysowany **dokładnym obrysem siedmiu pasów**, a wokół koncentryczne kręgi przestrzeni z liczbami
pułapów w środku łuku (np. 110/30). Hierarchia: im ważniejsze lotnisko, tym więcej geometrii, nie większa ikona.
→ Hub w grze rośnie jak prawdziwe lotnisko: dochodzą pasy i pierścienie zasięgu; pierścień może nieść liczbę
(pojemność / kolejka) wpisaną w łuk zamiast osobnego paska zajętości.

**03 — Diagram lotniska BOS (`03-lotnisko-diagram-bos.jpg`)**
Czarne grube pasy, szare drogi kołowania, płyty i terminale jako płaskie szare plamy; numery pasów na końcach,
drobne opisy z odsyłaczem. Dwa tony + czerń, zero cieniowania.
→ Widok zbliżenia huba (lub ekran ulepszeń) jako diagram w 2–3 tonach; numery pasów (09/27) jako naturalne,
„lotnicze” oznaczenie slotów/pasów zamiast cyfr w kółkach.

**04 — Szkice lotnisk ok. 1930 (`04-lotnisko-szkice-1930.jpg`)**
Każde pole w ramce z kreskowaną fakturą terenu, różą wiatrów w rogu i podpisem pod spodem (nazwa wersalikami +
jedna linijka opisu + numer biuletynu).
→ Karta lotniska / okno odblokowania jako „szkic w ramce z podpisem” — ilustracja na górze, podpis drukowany
pod spodem; róża wiatrów jako motyw na ekranie wyboru miasta. Kreskowanie zamiast cieni i gradientów.

## 2. Napisy i typografia

**05 — Sectional FAA, Wilmington (`05-napisy-sectional-phl.jpg`)**
Nazwy lotnisk **pochyłym grotesk-wersalikiem** w kolorze symbolu, dane pod spodem prostym krojem; częstotliwości
VOR w prostokątnych ramkach z podwójną/zębatą krawędzią; białe obwódki (halo) wokół napisów na tle mapy.
→ Tagi lotnisk: nazwa kursywą/italic-grotesk w kolorze typu + liczby prostym krojem, z cienkim halo z koloru papieru
zamiast ciemnej plakietki. Dane „liczbowe” (kolejka, pasażerowie) w małej prostokątnej ramce jak częstotliwość.

**06 — Nagłówek procedury ILS BOS (`06-napisy-ils-naglowek.jpg`)**
Pas informacyjny jako **siatka komórek z cienkich linii**: mała etykieta nad dużą liczbą (APP CRS / 036°, ATIS /
135.0). Tytuł duży po prawej, wszystko jednym groteskiem w dwóch–trzech rozmiarach, bez kolorów.
→ Górny HUD jako jasny pasek-tabela z linii włosowych: „etykieta mała, liczba duża” w komórkach (dzień, pasażerowie,
budżet) zamiast ciemnego paska z mikroetykietami. Rozwiązuje problem „drobnych wersalików” — etykieta może być mała,
bo wartość jest duża i czytelna.

**07 — Blok tytułowy Chicago U-7, 1949 (`07-napisy-tytul-1949.jpg`)**
Szeryfowy, zwarty tytuł („CHICAGO (U-7)”), pod nim wyśrodkowane wersaliki o umiarkowanym rozstrzeleniu, cena w rogu;
obok legenda lotnisk: krążki z zębami (lądowe / wodne, wojskowe / cywilne).
→ Typografia menu/ekranów: szeryf drukarski na tytuły + grotesk na dane — dwa kroje z epoki druku zamiast mono.
Zębaty krążek jako baza znacznika lotniska (liczba zębów = poziom/rozmiar).

## 3. Kolory i farby drukarskie

**08 — Sectional FAA, Zatoka Delaware (`08-farby-sectional-dov.jpg`)**
Paleta druku: blady seledyn lądu, jasnoniebieska woda, **magenta** i **niebieski** jako dwie farby informacji,
żółć miast, brąz terenu. Ostrzeżenia w ramce magenty, wielkie półprzezroczyste liczby MEF (np. 07) w tle.
→ HUD i znaczniki w 2 farbach „nadruku” (magenta + niebieski) na globie — każda farba ma znaczenie (np. niebieski =
lotniska z obsługą, magenta = reszta/alerty). Duże, bladą farbą drukowane liczby w tle regionu zamiast liczników w HUD.

**09 — Chicago 1956 (`09-farby-chicago-1956.jpg`)**
Pomarańczowe miasta, niebieskie jezioro, ciemnoniebieskie romby lotnisk i ramki VOR; drogi czerwono-czarne cienką linią.
Mało farb, dużo papieru.
→ Ograniczyć paletę UI do 3–4 „farb” + kolor papieru. Pomarańcz jako akcent zabudowy/popytu zamiast neonów.

**10 — Chicago 1935 (`10-farby-chicago-1935.jpg`)**
Mocniejsza zieleń i ochra (nadruk na papierze o ciepłym tonie), czerwone przezroczyste korytarze, duże litery
N/A/S ostemplowane na mapie.
→ Paleta „starsza” dla trybu dziennego / menu: ciepły papier, zieleń-ochra; duże litery-sektory jako oznaczenie stref.

## 4. Elementy marginesu (skale, legendy, bloki tytułowe)

**11 — Legenda 1944 (`11-margines-legenda-1944.jpg`)**
Legenda w kolumnach: symbol + krótki opis zwykłym krojem, podzielona nagłówkami („Airports:”, „Beacons:”, „Radio”).
Symbole odróżnialne samym kształtem w jednej farbie.
→ Ekran „Jak czytać mapę” / samouczek jako prawdziwa legenda mapy; dok z narzędziami jako rząd symboli
narysowanych tą samą kreską co mapa (nie ikony z paczki w kółkach), z podpisem jak w legendzie.

**12 — Skale 1956 (`12-margines-skale-1956.jpg`)**
Potrójna podziałka (km / mile morskie / mile lądowe) z zębatkami, gruba ramka-neatline, pod spodem blok tytułowy.
→ Dolny pasek HUD jako „margines mapy”: neatline + podziałka (np. czas/dzień jako skala z kreskami) zamiast ciemnego
paska. Zegar dnia = podziałka z przesuwanym znacznikiem.

## 5. Linie tras

**13 — Radiolatarnie 1949 (`13-trasy-radiolatarnie-1949.jpg`)**
Trasy jako **szerokie półprzezroczyste pasy magenty** zwężające się ku stacji, z kursem (246°, 68°) wpisanym w pas;
krzyżują się, prześwitują przez siebie.
→ Trasy w grze jako przezroczyste pasy farby, nie neonowe linie; szerokość pasa = przepustowość/częstotliwość,
kurs albo numer trasy wpisany w pas.

**14 — Odlot RNAV CELTK (`14-trasy-rnav-celtk.jpg`)**
Punkty trasy jako czteroramienne gwiazdki z nazwą 5-literową, odcinki z kursem (122°) i odległością w nawiasie (24).
Czarno-białe, tylko linia i tekst.
→ Etykieta trasy w grze: „kurs° (dystans)” wzdłuż linii zamiast pływającej plakietki; punkty pośrednie jako małe
gwiazdki. 5-literowe kody (CELTK) jako styl nazw tras/punktów.

**15 — Przylot STAR GARDNER (`15-trasy-star-gardner.jpg`)**
Pomoce nawigacyjne w **ramkach z danymi** (nazwa, częstotliwość, współrzędne) połączone z punktem cienką linią;
strzałki kierunku na liniach, pułapy podkreślone/nadkreślone.
→ Jeśli tag lotniska potrzebuje linii odniesienia — to tak: prosta ramka, cienka linia, bez paska zajętości.
Strzałki kierunku na trasach i „nad/pod kreską” dla limitów (np. pojemność min/max).

**16 — Sectional FAA, Harrisburg (`16-trasy-sectional-mdt.jpg`)**
Drogi lotnicze Victor jako cienkie niebieskie linie z oznaczeniem „V 210”, róża kompasowa VOR z podziałką, magentowe
pierścienie Class C, pas „mode C” w półprzezroczystej magencie.
→ Róża z podziałką wokół wybranego huba jako wskaźnik kierunków połączeń; nazwy tras w stylu „V 210” wzdłuż linii.

## 5 najmocniejszych pomysłów dla naszego UI

1. **Lotnisko = sylwetka pasów** (01, 02, 03): znacznik pokazuje układ pasów, hub dorasta geometrią (pasy, pierścienie)
   — kształt mówi o typie i rozmiarze, bez ikon i pasków zajętości.
2. **Dwie farby nadruku na globie** (08, 09, 13): magenta + niebieski z jasnym halo zamiast ciemnych plakietek; trasy
   jako półprzezroczyste pasy farby z wpisanym kursem/numerem.
3. **HUD jako tabela z linii włosowych** (06, 12): „mała etykieta nad dużą liczbą” w jasnych komórkach, dół ekranu jako
   neatline z podziałką czasu — koniec z ciemnymi paskami i mikro-wersalikami.
4. **Typografia drukarska** (05, 07): szeryf na tytuły + grotesk z pochyłą odmianą na nazwy lotnisk; liczby w małych
   prostokątnych ramkach jak częstotliwości; bez mono.
5. **Dok jako legenda mapy** (11, 04): narzędzia narysowane tą samą kreską co mapa, z podpisami jak w legendzie, karty
   lotnisk jako szkic w ramce z podpisem — zamiast ikon z jednej paczki w kółkach.

Braki: wycinków IFR enroute (low/high) i stron „Chart User’s Guide” FAA nie udało się pobrać (faa.gov zablokowane
w tej sesji) — warto dołożyć później.
