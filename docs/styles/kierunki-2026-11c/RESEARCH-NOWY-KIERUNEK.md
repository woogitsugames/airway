# Research: realistyczny globus + styl mapy + UI jak w dobrych grach (noc 63a, 2026-11-08)

Status: **tylko research, bez kodu i bez zmian w `src/**`.** Nic tu nie zmienia gry, dopóki właściciel nie wybierze
kierunku (potrzebny nowy wpis D-xx, który częściowo zastąpi D-283; lista zmian w dokumentach w §7).
Kontekst poprzednich rund: `docs/styles/kierunki-2026-11b/KIERUNKI.md` i `RESEARCH.md` (Linoryt, Gwasz, Makieta),
`docs/styles/realistyczny.md` (D-170, globus ze zdjęć, usunięty w D-283/E4).

Zasada uczciwości źródeł: kolumna „Źródło” w §1 mówi, czy opis wynika z przeczytanych dziś recenzji/dokumentacji
(oznaczenie `[źr.]`), czy z wiedzy własnej autora, której w tej rundzie nie sprawdzono (`[wiedza]`). Wyszukiwanie
dało dużo o odbiorze UI i prawie nic o fontach w grach, więc nazw krojów z gier **nie podaję** (poza tym, co potwierdzone).

---

## 1. Tytuły: co robią, że wygląda premium, a co tanio

| Tytuł | Styl graficzny | Dane gry w świecie | HUD / UI | Typografia / paleta | Premium | Tanio / slop | Źródło |
|---|---|---|---|---|---|---|---|
| **Cities: Skylines (II)** | Realistyczne miasto, miękkie światło dzienne | Nakładki „info views” (33): cały świat przyciemniony i pomalowany jedną miarą (hałas, ruch, wiek) | Paski u dołu i u góry, panele z ikonami, wiele zagnieżdżeń | Neutralny szary UI, kolory tylko w nakładkach | Nakładka jako „opowieść” (populacja jako mapa), każda mechanika ma własny widok | Za dużo paneli i podmenu, rozstrojona hierarchia; po premierze UI poprawiał nowy deweloper | [źr.] |
| **Transport Fever 2** | Ładna, miękka grafika, „kredkowe” symbole | Linie i pojazdy podświetlane na mapie z menedżera linii; biała nakładka zdejmuje kolory tła, żeby linie było widać | Duży nacisk na mało kliknięć; czytelne menu (potwierdza też wersja konsolowa) | Kolory linii nadawane przez gracza | Biała nakładka „czyść tło, pokaż sieć” to wprost wzór dla nas | Symbole „kredkowe”, gra uznana za zbyt łatwą (to nie UI) | [źr.] |
| **Railway Empire 2** | Mieszanka cel-shadingu i akwareli, bogate szczegóły map i miast | Pociągi i miasta jako obiekty 3D na mapie USA | UI „łatwy w nawigacji i miły dla oka”, lepszy niż w jedynce | Ciepła paleta dziewiętnastowieczna | Bogactwo detalu ręcznie zrobionego | Recenzenci: grafika nie najlepsza, ten sam szablon co poprzednik | [źr.] |
| **Per Aspera** | Rzeczywista mapa Marsa z danych NASA, warstwy topograficzne, wyniki wysokości | Zasoby i drogi na prawdziwym reliefie; nazwy dolin i kraterów prawdziwe | „Śliski” interfejs, stan zasobów i trend popytu od razu na ekranie | Chłodna, czysta, rdzawa paleta | **Najbliższy nam przykład: prawdziwe dane planety jako plansza** (globus ma być prawdą, nie ilustracją) | Brak samouczka czytania UI, drobne wady interfejsu | [źr.] |
| **Frostpunk 2** | Heksowa mapa, „katalogowe” szczegóły, cienkie linie jak z druku | Ikony regionów (paliwo, drewno), ikony kolonii jak mechanizmy zegarowe | Duży rework UI przed premierą; okręgi to „świętość” językiem projektu (menu radialne) | Zimna paleta, w UI jasne panele w widoku rządu, ciemne w mieście (Steam) | Jeden motyw (okrąg, zegar) przechodzi przez świat i UI | Informacje chowane w podpowiedziach i podmenu, trudne czytanie przy kłopotach | [źr.]; kroju nie potwierdzono |
| **Civilization VI** | Pergaminowa mapa „epoki odkryć”, żywe kolory | Nieodkryte obszary jako papier z rysunkami potworów morskich i siatką długości; zoom: ikony czytelne bez najeżdżania | Dobrze oceniany UI, przystępny mimo złożoności | Kolor kafelka = typ terenu | Mapa jako rzecz materialna **i** czytelna strategicznie | Mgła wojny na pergaminie bywa trudna do odczytu, styl dzielił fanów | [źr.] |
| **Civilization VII** | Realistyczniejsza kartografia, szary UI | Ikony i teren na mapie | Premiera: „szary bałagan”, słaba czytelność mapy, brak skrótów, zbyt wiele krojów i słaba hierarchia tekstu (komentarz z Reddita, nie recenzja) | Szarości, mało koloru | (Lekcja negatywna) | **Przykład „tanio”: UI bez jednego języka, pogubiona hierarchia**; Firaxis obiecał poprawki czytelności mapy | [źr.] |
| **Northgard** | Ręcznie rysowany, komiksowy, żywy | Regiony do skolonizowania jako kolorowe płyty na mapie | Łatwe w użyciu menu; Sword & Solace ujednolicił UI | Nasycone, ciepłe | Charakterystyczny rysunek | Kartonowa, „zabawkowa” oprawa nie pasuje do realizmu | [źr.] częściowo; reszta [wiedza] |
| **Anno 1800** | Realistyczne XIX wiek, spójny kolor regionu | Łańcuchy produkcji pokazane połączeniami budynków | UI funkcyjny, prawie bez ornamentów, **ciemne kolory HUD, żeby nie męczył oczu i nie bił mapy** (wypowiedź projektanta Ubisoft) | Ciemny HUD, wyróżniony kolor na mapie | Chłodny, ciemny UI oddaje scenę mapie | Abstrakcyjne liczby produkcji, brak skalowania tekstu i ikon (dostępność) | [źr.] |
| **Dorfromantik** | Proste bryły, impresjonizm i sztuka naiwna jako mood board, arkusz stylu | Znaczniki zadań unoszą się nad polami | UI prawie zerowy: kolejka kafli w rogu, wynik w drugim, **bez mapy i minimapy** | Ciepła, ograniczona paleta | Rygor stylu zapisany na początku; brak tekstu | (Tanieje, gdy UI robi się bardziej wymyślny niż plansza) | [źr.] |
| **Islanders** | Minimalistyczne low-poly, wyspy jako obiekty | Punkty w kształcie ikon budynków | Prawie brak UI | Pastelowa, miękka | Cisza i spokój | Pastel bez kontekstu przypomina „kolorowy diagram” (nasz zakaz) | [wiedza] |
| **Townscaper** | Kolorowe domki, zero UI | Brak danych | Brak | Jasne pastele | Radość z dotyku | Nie służy do czytania sieci | [wiedza] |
| **Mini Motorways** (tylko rynek) | Płaskie, pastelowe, linie na tle | Drogi jako kolorowe linie na pastelu | Minimalny HUD | Pastel + pogrubione linie | Znana pętla czytelności | **Dokładnie to, czego CLAUDE.md zakazuje. Nie kopiujemy** | [wiedza] |
| **Flightradar24** (globus i mapa) | Globus 3D na silniku Cesium i Mapbox z obrazami i terenem; 9 stylów mapy (satelita, czarno-biała, teren) | Samoloty jako ikony renderowane w WebGL z pasmem śladu; etykiety wyłączane/logo/flaga/tekst; przeprojektowane piny lotnisk | Boczne karty szczegółów, kolory według wysokości | Ikony samolotów z ciężką obwódką | Ślad samolotu = trasa, **dane z prawdziwego świata jako gra** | Ikony samolotów jednego zestawu (clipart); etykiety się zlewają przy tłoku | [źr.] |
| **Google Earth** | Zdjęcia satelitarne, atmosfera, światło | Nakładki warstw, etykiety krajów i miast | Minimalny ekran, jasne etykiety z obwódką | Biały tekst z ciemnym halo | **Atmosfera przy krawędzi i miękki terminator** wywołują „premium” w sekundę | Cudze zdjęcia: tapeta rozpoznawalna wszędzie | [wiedza]; nie wolno użyć ich obrazów |
| **Apple Maps** (globus, etykiety) | Globus po oddaleniu na Macu z Apple silicon; od 2021 setki zakrzywionych etykiet cech fizycznych (pustynie, pasma) | Hierarchia miast: Apple oznacza większe miasta wcześniej niż Google (analiza J. O’Beirne’a) | Jasne etykiety zależne od zoomu | Ciemny tekst z jasnym halo | Hierarchia etykiet jest dla niego ważniejsza niż ornament | (Zbyt wiele etykiet = szum) | [źr.] |

### Wnioski z tabeli (co powtarza się w dobrze ocenianych grach)
1. **Prawdziwe dane jako plansza** (Per Aspera, Flightradar24) buduje zaufanie szybciej niż jakakolwiek ilustracja. To
   zgodne z prośbą właściciela o realistyczny globus.
2. **UI schodzi na drugi plan** (Anno: ciemny HUD „żeby nie bił mapy”; Dorfromantik: prawie zero UI). Premium to nie
   ornament panelu, tylko **rygor**: jeden krój nagłówków, jeden krój liczb, stała siatka i odstępy.
3. **Nakładka-czyszczenie** (Transport Fever 2: biała nakładka; Cities: Skylines: info views). Gdy gracz planuje sieć,
   tło cichnie, a trasy dostają pełny kontrast. Dla nas: tryb „planowanie” przygasza zdjęcie i podnosi etykiety.
4. **Jeden motyw przez świat i UI** (Frostpunk: okrąg i zegar). U nas: **glify pasażerów i okrągły hub** jako
   powtarzalny element etykiet, przycisków i znaku aplikacji.
5. **Hierarchia etykiet** (Apple Maps; Civ VI: czytelność na zoomie bez najeżdżania). Mapa zawsze pokazuje tylko tyle
   nazw, ile da się przeczytać; reszta wraz z zoomem.
6. **Znaki „tanio”:** szare panele bez języka (Civ VII), wiele krojów naraz, ikony z jednej paczki, abstrakcyjne
   liczby bez wykresu w świecie, chowanie ważnych informacji w podpowiedziach (Frostpunk 2), płaski pastel z grubą
   linią (Mini Motorways-klony), puszysty „glow” i półprzezroczyste szyby.

---

## 2. Dane i obrazy realistycznego globusa (tylko domena publiczna / CC0)

Projekt miał już takie tekstury (D-170 do D-285). Zniknęły w E4 (commit `79d9001`, PR #317), ale **są w historii git**
(`git show 79d9001^:public/data/globe/day-4096.jpg` itd.). Poniżej źródła i rozdzielczości do ponownego użycia.

| Warstwa | Źródło | Rozdzielczość do użycia | Licencja | Uwagi |
|---|---|---|---|---|
| Dzień: kolor Ziemi | NASA Blue Marble Next Generation z topografią i batymetrią (NASA Earth Observatory / Visible Earth) | Dostępne 5400×2700 (8 km/px) dla każdego miesiąca, 21600×10800 (2 km/px) dla wybranych miesięcy (m.in. styczeń, czerwiec, lipiec); natywnie 500 m/px | Materiały NASA „generalnie nie podlegają prawu autorskiemu” w USA; **wyłączone: logo i insygnia NASA**, rozpoznawalne osoby (nie dotyczy) | W ASSETS dziś: „domena publiczna”. Wymaga wpisu i zasady podziękowania |
| Noc: światła miast | NASA Black Marble 2016, kolor | 3600×1800 (0,1°), JPEG ok. 761 kB, GeoTIFF ok. 4 MB; także 13500×6750 | j.w. (NASA, dane VIIRS Suomi NPP; autorzy: M. Román, J. Stevens) | Do shadera nocnej półkuli i terminatora |
| Relief | NOAA ETOPO5 (**już w grze**, `elevation-2048.png`, 303 kB) | 2048×1024 | Domena publiczna (NOAA) | Wystarczy do cieniowania; dla większego zoomu rozważyć NASA SRTM/GEBCO tylko po sprawdzeniu licencji (nie zbadano) |
| Granice, wybrzeża, miasta, nazwy | Natural Earth przez `world-atlas` (ISC) | Wektor, bez rozdzielczości | Domena publiczna / ISC | Granice i etykiety rysujemy **wektorowo w świecie**, więc są ostre przy każdym zoomie |
| Alternatywa „kartograficzna” | Natural Earth: Cross Blended Hypso with Shaded Relief, Water and Drainages (raster 1:10 m) | Duży 21600×10800, średni 16200×8100 | Domena publiczna (Natural Earth) | Sprawdzić wybrane pliki i wersję na stronie pobrań przed użyciem |
| Chmury | Własne, proceduralne (jak w D-170) | n/d | Własne / CC0 | NASA nie dostarcza gotowych, lekkich chmur w tej rundzie sprawdzeń |

**Czego NIE wolno:** żadnych kafli ani zrzutów Google Earth/Maps, Apple Maps, Mapbox, Cesium Ion, Flightradar24.
To tylko referencja wyglądu. Licencje i warunki kafli nie pozwalają na wbudowanie ich w grę.

**Rozwiązanie do three.js (WebGL):** kula z dwoma teksturami równoprostokątnymi (dzień, noc), shader miesza je wg kąta
słońca (terminator z pasem zmierzchu, jak w D-63), relief z ETOPO5 jako normalna i cieniowanie, atmosfera jako
osobna siatka z rozpraszaniem na krawędzi (Fresnel). Granice i etykiety jako osobna warstwa wektorowa na kuli.

**Szacunek rozmiaru (nie zmierzony; to szacunek):**
- Poprzedni zestaw dzień 4096 + 2048, noc 2048 + 1024 ważył według D-283 **ok. 1,9 MB** (plus mapa 4096/2048 w trybie Mapa).
- Nowy zestaw do rekomendacji: dzień 4096×2048 JPEG/WebP ok. 1,2–1,8 MB, noc 2048×1024 ok. 0,3–0,5 MB, relief już jest.
  **Razem ok. 1,5–2,3 MB do APK**, czyli praktycznie jak było. Wariant z 8192 (ostrość przy zoomie regionalnym):
  +4–6 MB, rozważać tylko jako opcjonalne kafle pobierane po instalacji (czego dziś nie robimy).
- Pamięć GPU, nie rozmiar pliku: 4096×2048 RGBA to ok. 32 MB (z mipmapami ok. 43 MB); na słabych telefonach preset niski
  powinien ładować 2048 (8 MB). Do zmierzenia na urządzeniu, nie na SwiftShader (CLAUDE.md: nie porównywać z urządzeniami).
- Przy tej wielkości wpływ na APK to zaledwie kilka MB; główny koszt to **pamięć i czas ładowania**, nie pobieranie.

---

## 3. Trzy kierunki

Wspólne dla K1–K3 (odpowiedź na zakazy z CLAUDE.md):
- Globus jest **bryłą oświetloną**, z reliefem, atmosferą i terminatorem. To nie „płaskie pastelowe tło”, więc zakaz
  „kolorowych linii na płaskim pastelu” nie dotyczy, ale trasy mają **obwiednię (casing)** i muszą mieć ≥ 4,5:1 względem
  tła (D-47 / D-177: sonda kontrastu, próg istniejący).
- **Pasażerowie:** zostają glify D-08 (chevron, muszka, półksiężyc, dziurka od klucza, statecznik, nawias; dodatkowo
  skrzydło ASI i hak OCE tymczasowo), rysowane jako **biały kształt z ciemną obwiednią i kolorem D-08 wewnątrz**,
  w pigułce przy mieście z liczbą. Żadnego koła, kwadratu ani trójkąta jako pasażera.
- **Samolot:** sylwetka z góry z własnych ikon projektu (`src/icons.js`), **typ rozpoznawany kształtem** (turbośmigłowiec,
  szerokokadłubowiec, regionalny); nie clipart, nie paczka ikon.
- Bez: gradientu fioletowo-niebieskiego, glassmorphismu, neonowej poświaty, emoji, centralnego „Welcome”, wykresów
  dashboardowych, clipartu globusa. Poświata dozwolona tylko jako **fizyczne światła miast na stronie nocnej**.
- Dotyk ≥ 48 dp, dok w zasięgu kciuka, safe areas, ruch krótki i rzeczowy (bez sprężyn).
- Wszystkie kroje: SIL OFL; **sprawdziłem pobrane pliki z google/fonts (raw.githubusercontent.com) przez fontTools:
  mają wszystkie polskie litery ąćęłńóśźż i duże**. Brakuje strzałki U+2192 w Fraunces, Newsreader, Commissioner i
  Instrument Serif (jak już w Besley, rozwiązanie istnieje: stos z Atkinson/Overpass, `test:glyphs`).

### K1 „Atlas satelitarny” (dzień jak Google Earth, etykiety jak atlas)
**Idea.** Prawdziwa Ziemia w dziennym świetle z miękką atmosferą, a gra to **kartograficzna warstwa nad nią**: nazwy
miast i krajów jak w dobrym atlasie, trasy jak linia nawigacji z obwiednią, lotniska jako okrągłe pinezki-pigułki.
**Paleta (propozycja, hex):** morze `#1C4E73`/`#0E2F47` (głębia), atmosfera `#8FB8E6`, ląd z Blue Marble (nie malowany),
papier etykiet `#F4EFE4`, tusz `#16202A`, akcent trasy szerokokadłubowej `#F2B233` (bursztyn), regionalnej `#FFFFFF`
z ciemną obwiednią, alarm zatoru `#C8341F`. Glify pasażerów kolorami D-08.
**Typografia (SIL OFL):** nazwy miast i krajów **Newsreader** (szeryf druku atlasowego; opsz 600 dla etykiet),
UI i liczby **Hanken Grotesk** (500–700), cyfry tabelaryczne w zegarze i kasie (`tnum`). Atlas ma dwa krojów, nie więcej.
**Etykiety i trasy.** Miasto = kropka + nazwa, rozmiar od liczby ludności, duże miasta zawsze, mniejsze od zoomu;
etykiety z halo (jasny tekst i ciemny obrys) jak w Google Earth, bez cienia. Granice państw cienkie, półprzezroczyste
białe. Trasa to **wielka orbita** z jasną obwiednią 1 px i barwnym rdzeniem; turbośmigłowce kropkowane, szerokokadłubowe ciągłe.
**Lotniska i samoloty.** Zwykłe lotnisko: biała pigułka z nazwą; hub: **podwójny pierścień + wieża jako znak**
(kształtem, nie kolorem). Samolot: biała sylwetka z cieniem na globie, ślad za nim (jak Flightradar24, tylko nasz).
**HUD.** Dolny dok z trzema przyciskami w kciuku, pasek doby u góry (godziny nocne zacienione), brak paneli
zasłaniających globus; tryb „planowanie” przygasza zdjęcie o 30% i podnosi etykiety (jak biała nakładka Transport Fever).
**Zgodność z CLAUDE.md.** Nie metro: bryła z reliefem. Nie Mini Motorways: realistyczna planeta, nie pastel. Obrazy: NASA
(domena publiczna; wpis w ASSETS i Ustawienia → Licencje). Wymaga uznania w D-xx, że tryb satelitarny wraca.
**Ryzyka.** (1) **To powrót do D-170, odrzuconego w D-283 za „cudzą fotografię”.** K1 musi dowieść, że różnica to
kartograficzny język etykiet i tras, a nie ornament na zdjęciu (diagnoza z KIERUNKI.md punkt 1–3). (2) Blue Marble
rozpoznawalny wszędzie. Łagodzenie: własne cieniowanie reliefu, korekta kolorów, własny terminator. (3) Pamięć GPU.
(4) Gęstość etykiet na małym ekranie.

### K2 „Nawigacja nocna” (strona nocna jako główny widok)
**Idea.** Globus ciemny jak w nawigacji samochodowej nocą: **Black Marble** pokazuje prawdziwe światła miast, które są
naturalnymi „hubami”, a trasy to jasne linie jak trasa w Mapach. Strona dzienna tylko jako pas zmierzchu.
**Paleta:** noc `#0B1320`, morze nocne `#10263D`, światła miast `#FFC76B`/`#FFE9B8` (z danych), trasa główna `#4FD1C5`
(morski), regionalna `#F2F2F2`, etykiety `#E9EEF5` z obrysem `#0B1320`, alarm `#FF5B3A`. Akcent musi pochodzić z
fizycznego światła, a nie z neonu.
**Typografia:** UI **Manrope** (700 etykiety, 500 tekst), liczby i czas **Sofia Sans Condensed** (600), wąska, dobra do tablic.
**Etykiety i trasy.** Wąski tekst z obrysem, pojawia się z zoomem; trasa z obwiednią 2 px w kolorze nocy, żeby
odciąć ją od świateł miast. Hub = jaśniejsze „miasto” z pierścieniem zmieniającym się w czerwony przy zatorze.
**Lotniska i samoloty.** Pinezki-pigułki ciemne z jasnym tekstem; samolot jasny z cieniem i małym światłem pozycyjnym
(realny detal, nie poświata).
**HUD.** Ciemny, spokojny, w stylu Anno (ciemny HUD nie męczy oczu); panele **nieprzezroczyste**, nie szkło.
**Zgodność.** Bez glassmorphismu i neonu: żadnego rozmycia tła pod panelami; światło tylko z miast. Glify D-08 jasne
kontury na ciemnym.
**Ryzyka.** (1) **Najbliżej „generycznego ciemnego dashboardu” i „motywu nawigacji”**: największe ryzyko slopu.
(2) Czarna noc kłóci się z dniem gry (zegar doby: kiedy jest dzień w grze?). (3) Kontrast tras do świateł miast.
(4) Ciemne UI to najczęstszy wybór klonów (Flightradar24-podobnych).

### K3 „Hipsometria” (Imhof i kartografia, globus bez zdjęcia, ale realistyczny)
**Idea.** Realizm zrobiony **kartografią, nie fotografią**: globus malowany z danych jak atlas fizyczny Natural Earth
(hipsometria: zieleń, żółć, brąz, biel), cieniowany reliefem Imhofa i **oświetlony** (słońce, atmosfera, noc z
Black Marble jako jedyny element NASA). Etykiety i granice w stylu atlasu na bryle.
**Paleta:** ląd hipsometryczny `#A9C48A` (niziny) `#E1D6A0` `#C9A36B` `#9B6E4A` `#F1EDE6` (szczyty), morze `#2F6F8F`→`#123A56`,
atmosfera `#A9CBEE`, tusz `#1B2430`, papier `#F4EFE4`, trasa `#D9482B` (czerwień znacznika) kontra `#FFFFFF`.
**Typografia:** nagłówki i miasta **Fraunces** (pokrętła `opsz`, `SOFT`: ciepły, nowoczesny szeryf), UI **Figtree**
(500–700), liczby tabelaryczne.
**Etykiety i trasy.** Jak K1, ale na **kolorach atlasu**; trasy kontrastowe czerwone/białe z obwiednią; granice kreskowane.
**Lotniska i samoloty.** Pinezki-pigułki papierowe; samolot z cieniem na reliefie.
**HUD.** Papierowe jasne panele z cienką ramką; tonacja zbliżona do dzisiejszego Linorytu, więc najmniejsza zmiana.
**Zgodność.** Nie fotografia: unika zarzutu „cudze zdjęcie” z D-283; dane PD (Natural Earth hypso jako alternatywa
dla Blue Marble, ETOPO5 już jest). Zmiana w CLAUDE.md najmniejsza.
**Ryzyka.** (1) **Może nie spełnić prośby „realistyczny jak Google Earth”**: to atlas, nie satelita. (2) Hipsometria
bywa „szkolna” (mapy z podręcznika), co łatwo wygląda tanio. (3) Palety atlasów (zieleń-brąz) mocno pachną klipartem
bez dobrego cieniowania. (4) Plik 16200×8100 trzeba mocno zmniejszyć (JPEG 4096 ok. 1–1,5 MB).

---

## 4. Porównanie

| Kryterium | K1 Atlas satelitarny | K2 Nawigacja nocna | K3 Hipsometria |
|---|---|---|---|
| „Jak Google Earth” (prośba 1) | **tak, najpełniej** | tak, tylko noc | częściowo |
| Styl mapy: etykiety, granice, trasy (prośba 2) | **tak** | tak | **tak** |
| Premium UI jak w grach (prośba 3) | tak (jasny, rygor) | tak, ale ryzyko generyczności | tak |
| Ryzyko „AI slop / generyczne” | średnie | **wysokie** | średnie |
| Kontrast tras | dobry z obwiednią | dobry | średni |
| Koszt wdrożenia względem Linorytu | wysoki (wraca wiele tekstur) | wysoki | **najniższy** |
| APK (szacunek) | +1,5–2,3 MB | +1,0–1,5 MB (tylko noc) | +1,0–1,5 MB |
| Wymaga zmian CLAUDE.md i ASSETS | tak | tak | niewiele |

## 5. Rekomendacja

**K1 „Atlas satelitarny”, z nocą z K2 jako stanem gry (terminator związany z zegarem doby).** To jedyny kierunek,
który spełnia wszystkie trzy prośby właściciela (Google Earth + mapa + UI jak w dobrych grach), a ryzyko „cudzego
zdjęcia” z D-283 zmniejszają trzy rzeczy: (1) **własny język etykiet i tras** zamiast ornamentu, (2) własne cieniowanie
reliefu i korekta barw, (3) **nocna strona jako element gry**, a nie tapeta (światła miast jako huby i pasek doby).
K3 zostaje wariantem awaryjnym, gdyby właściciel uznał zdjęcia za „cudze” po raz drugi. K2 samodzielnie odradzam
(najbardziej „generyczny dashboard”).

Proponowany następny krok (do decyzji, nie do wykonania w tej nocy): jeden render referencyjny K1 w three.js (gra i
menu, 1080×1920), z obiema kropkami: dzień i noc, na **tej samej sytuacji** co `game-phone.png`, zanim ruszy jakikolwiek kod produkcyjny.

## 6. Znak aplikacji (osobny wątek)
Właściciel odrzucił znak jako „brzydki i slop”. Wniosek z wzorców: **nie rysować globusa-clipartu**; znak ma wywodzić się z
własnego motywu gry (glify D-08, huby jako okrąg, wielka orbita). Wariant dla K1: jeden **okrągły hub** i łuk trasy
na ciemnym tle w tuszu i bursztynie; wariant dla K3: papierowy hub z cieniem reliefu. Szkice A/B/C w
`docs/styles/kierunki-2026-11b/znak/` były generowane z sylwetek doku, więc łatwo wpadają w „ikonę z paczki”. Do osobnego
researchu: czytelność w rozmiarze 48 dp i na tle sklepu.

## 7. Co trzeba zaktualizować, jeśli właściciel zmienia kierunek
1. **Nowy wpis D-xx w `docs/DECISIONS.md`**: częściowo zastępuje D-283 (Linoryt wraca do archiwum, tryb satelitarny
   wraca), z uzasadnieniem. Nie kasuje D-08 (glify), D-47 (kontrast), D-285 do czasu przeglądu.
2. **`CLAUDE.md`:**
   - „Current stage”: opis kierunku (dziś nadal „Diorama D-11” i tytuł D-12, zaległe względem Linorytu).
   - „Hard rules”: zakaz „coloured lines on a flat pastel background” zostaje, ale warto dopisać, że **oświetlony,
     realistyczny globus z obwiednią tras jest dozwolony** (żeby agenci nie odrzucali K1 mechanicznie).
   - „Images: own or CC0 only” kłóci się z NASA (domena publiczna USA, nie CC0): zmienić na „own, CC0 or public domain,
     z wpisem w `docs/ASSETS.md`” i wskazać ograniczenie logo NASA.
   - Lista „No AI slop”: dopisać „realistyczny globus bez własnych etykiet i tras (sama fotografia)” jako błąd.
3. **`docs/ASSETS.md`:** sekcja „Globe data” (dziś tylko ETOPO5; wpisać NASA Blue Marble / Black Marble z miesiącem,
   rozdzielczością, URL i datą pobrania), czcionki K1/K2/K3 z licencjami w `public/fonts/` obok pliku, wiersz o
   Besley/Schibsted do usunięcia po przełączeniu.
4. **Testy i budżety:** `npm run test:globe-assets` ma limit **350 kB** i listę zakazanych starych tekstur (zmienić
   manifest i limit); budżet CSS D-258; `test:glyphs` na nowe kroje; Ustawienia → Licencje: klucz `licenses.nasaEarth`
   (usunięty w U6) trzeba przywrócić w PL i EN.
5. **Dokumenty stylu:** `docs/styles/realistyczny.md` (opis D-170, częściowo odpowiada K1), `PLAN-LINORYT.md` oraz
   `docs/ARCHITECTURE.md` (Render API po usunięciu `GlobeMode` w E4) wymagają adnotacji „zastąpione”; podobnie notatki
   ext (`docs/notes/linoryt-*`).
6. **Zakazy Mini Metro/Mini Airways/Fly Corp:** bez zmian. K1–K3 nie kopiują żadnej z tych gier (realistyczna planeta,
   własne glify, trasy po wielkich orbitach z obwiednią). Nazw „Mini” i podobnych nie używamy. Mini Motorways, Flightradar24,
   Google Earth i Apple Maps to wyłącznie referencje poglądowe, bez ich obrazów i ikon.
7. **Sklep:** film i zrzuty czekają (D-283); po wyborze kierunku odtworzyć `docs/store/`.

## 8. Ograniczenia tego researchu
- Brak zrzutów ekranu i wglądu w pliki gier: oceny wyglądu pochodzą z recenzji i wypowiedzi twórców (patrz linki), nie z oglądania gier.
- Islanders, Townscaper, Mini Motorways, Google Earth: z wiedzy własnej, bez weryfikacji w tej rundzie.
- Rozmiary APK i pamięci GPU to szacunki, bez pomiaru na urządzeniu.
- Natural Earth Hypso: sprawdzono nazwy i rozmiary plików (strona pobrań), nie licencję wprost w wyszukiwaniu; **projekt już
  traktuje Natural Earth jako domenę publiczną** (CLAUDE.md, ASSETS), ale warto potwierdzić na stronie przed wpisem.
- Polskie litery fontów sprawdzone fontTools na plikach pobranych z google/fonts (statyczne podglądy), pliki do
  `public/fonts/` trzeba wygenerować i podzbiorować jak w ASSETS (pyftsubset).

## 9. Linki
**Dane i licencje**
- [NASA Blue Marble Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/) · [SVS 12564](https://svs.gsfc.nasa.gov/12564/) · [baza topografii/batymetrii](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry)
- [NASA Black Marble 2016 (Visible Earth)](https://visibleearth.nasa.gov/images/144898/earth-at-night-black-marble-2016-color-maps/144946l) · [mapy Earth at Night](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps) · [SVS 30876](https://svs.gsfc.nasa.gov/30876)
- [Zasady użycia mediów NASA](https://www.nasa.gov/multimedia/guidelines/index.html)
- [Natural Earth 1:10m raster](https://www.naturalearthdata.com/downloads/10m-raster-data/10m-cross-blend-hypso/)
- Kroje (pliki sprawdzone): [Fraunces](https://github.com/google/fonts/tree/main/ofl/fraunces), [Newsreader](https://github.com/google/fonts/tree/main/ofl/newsreader), [Hanken Grotesk](https://github.com/google/fonts/tree/main/ofl/hankengrotesk), [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope), [Sofia Sans Condensed](https://github.com/google/fonts/tree/main/ofl/sofiasanscondensed), [Figtree](https://github.com/google/fonts/tree/main/ofl/figtree)

**Gry i mapy**
- Transport Fever 2: [dyskusja o nakładce](https://steamcommunity.com/app/1066780/discussions/0/1737761716219384975), [Dedoimedo](https://www.dedoimedo.com/games/transport-fever-2.html), [UI na konsolach](https://www.transportfever2.com/?p=6036)
- Cities: Skylines II: [info views](https://gameplay.tips/guides/cities-skylines-ii-info-views-guide.html), [przegląd UI Iceflake](https://www.eteknix.com/iceflake-giving-cities-skylines-2-ui-an-extreme-makeover-with-their-first-big-update/), [TheSixthAxis](https://www.thesixthaxis.com/2023/10/19/cities-skylines-2-review/)
- Civilization VII: [CGMagazine, obietnica poprawek](https://www.cgmagonline.com/news/civilization-vii-quality-of-life-updates), [Notebookcheck](https://www.notebookcheck.net/Civilization-VII-s-rough-launch-sparks-backlash-developers-pledge-improvements.958568.0.html), [Aftermath](https://aftermath.site/civilization-vii-review/)
- Civilization VI: [Twinfinite o stylu](https://twinfinite.net/news/civilization-vi-devs-explain-the-games-art-style/), [Cogconnected](https://cogconnected.com/?p=131493)
- Frostpunk 2: [PCGamesN, ulepszenia UI](https://www.pcgamesn.com/frostpunk-2/ui-improvements), [Xbox o UI](https://news.xbox.com/en-us/2025/09/18/adapting-frostpunk-2s-depth-to-a-gamepad/), [Seasoned Gaming](https://seasonedgaming.com/2024/10/03/review-frostpunk-2-embrace-the-frost/)
- Per Aspera: [PC Gamer](https://pcgamer.com/per-aspera-review), [DualShockers](https://www.dualshockers.com/per-aspera-review/), [PCGamesN](https://www.pcgamesn.com/per-aspera/review)
- Railway Empire 2: [GamesCreed](https://www.gamescreed.com/review/railway-empire-2-pc-review), [God is a Geek](https://godisageek.com/reviews/railway-empire-2-review/)
- Anno 1800: [The AU Review](https://www.theaureview.com/games/anno-1800-review-bold-new-era/), [Game Revolution](https://www.gamerevolution.com/review/532599-anno-1800-review), [PCInvasion](https://www.pcinvasion.com/?p=188771)
- Northgard: [Gamereactor](https://www.gamereactor.eu/northgard-review/), [CGMagazine](https://www.cgmagonline.com/articles/previews/northgard-early-access-preview-beautiful-strategy-title)
- Dorfromantik: [80.lv o minimalizmie](https://80.lv/articles/how-dorfromantik-expands-its-cozy-world-through-minimalist-design), [Game Developer](https://www.gamedeveloper.com/disciplines/sparking-joy-through-tile-placement-in-idyllic-village-builder-i-dorfromantik-i-), [ScreenRex](https://screenrex.com/dorfromantik-review/)
- Flightradar24: [widok 3D](https://www.flightradar24.com/blog/inside-flightradar24/introducing-enhanced-3d-view-on-flightradar24/), [pomoc o 3D](https://support.fr24.com/support/solutions/articles/3000123424-the-flightradar24-3d-view), [opcje etykiet](https://www.flightradar24.com/blog/inside-flightradar24/new-flightradar24-com-label-options/)
- Apple Maps: [J. O’Beirne, etykiety fizyczne](https://justinobeirne.com/apple-maps-redesign-physical-feature-labels), [porównanie Google/Apple](https://www.justinobeirne.com/cartography-comparison-part-2), [globus w Mapach (Apple)](https://support.apple.com/guide/maps/mpsaf9c43d8f/mac)
