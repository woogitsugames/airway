# Kierunek A — „Diorama” (globus 3D low-poly) — WYBRANY świat gry (D-11)

Makiety: `mockups/diorama/png/` · gra `game-p.png`, `game-l.png` · ulepszenie `upgrade-p.png`, `upgrade-l.png` · menu `menu-p.png`, `menu-l.png`
· źródło: `mockups/diorama/scene3d.js` (three.js) + `build.mjs` (HUD HTML/SVG).

## Idea w jednym zdaniu
Ręcznie „sklejona” ziemia w miniaturze: obracasz małą planetę z lasami, górami, pustynią i chmurami, a na niej stawiasz lotniska
i rozciągasz nad nią trasy.

## Dlaczego pasuje do tej gry
- **Terminator jest prawdziwym światłem.** Słońce to światło kierunkowe w punkcie podsłonecznym, więc dzień, zmierzch i noc
  (z ciepłymi światłami miast) powstają w scenie same. Fala popytu o świcie jest dosłownie widoczna jako wschód słońca nad kontynentem.
- **Globus jest bryłą,** nie mapą: łuki wielkiego koła wiszą nad powierzchnią na „wysokości przelotowej”, samoloty rzucają cień,
  krzywizna i horyzont mówią „to jest świat”. Najmocniej odcina się od płaskiej mapy Tiny Airline i schematów Mini Metro.
- **Obciążenie huba widać w świecie:** pierścień segmentów na płycie lotniska — jeden segment = jedno miejsce w poczekalni; zapalone
  pomarańczowo = zajęte, czerwono powyżej 80%. Pełny pierścień z czerwonym dymkiem i odliczaniem = zator.
- Najbliżej rodzinnej Commutopii technicznie (three.js, Capacitor), ale wizualnie osobno: globus, nie miasto.

## Paleta
| Nazwa | Hex | Rola |
|---|---|---|
| Głębina | `#1F5F86` | otwarte morze |
| Płycizna | `#4AA3B8` | szelf przy brzegu |
| Trawa | `#86B35A` | strefa umiarkowana |
| Las | `#4F8A45` | drzewa, ciemniejsza zieleń |
| Piasek | `#DCB36E` | Sahara, Arabia |
| Śnieg | `#F3F1EA` | szczyty, Arktyka |
| Panel | `#13302E` | tło HUD (ciemna morska zieleń, nie granat studia) |
| Papier | `#F7F3EA` | tekst na panelu, dymki |
| Akcent | `#FF7A3D` | jedna główna akcja na ekran, zapalone miejsca w hubie |
| Zator | `#C8352A` | przepełnienie (zawsze z odliczaniem i pełnym pierścieniem) |

Kontrast (WCAG): Papier na Panelu **12,7:1**, Dim `#A9BDB8` na Panelu 7,2:1, Panel na Akcencie 5,4:1, biały na Zatorze ≥ 5:1.
Kolory celów (tylko wzmocnienie, tożsamość daje kształt): `#0072B2 #009E73 #E69F00 #13302E #CC79A7 #56B4E9` — minimalne ΔE76
po symulacji: protanopia 20,7, deuteranopia 17,9, tritanopia 16,1 (próg bezpieczny ≥ 15).

## Typografia (OFL)
- Nagłówki: **Overpass** 800 (rodowód: amerykański krój drogowskazów Highway Gothic — „oznakowanie lotniska”).
- Tekst i liczby: **Atkinson Hyperlegible Next** 400/700 (projektowany pod czytelność dla słabowidzących).

## Język ikon i obiektów
- Ikony HUD: grube, zaokrąglone kreski 2,6 px, wypełnienia płaskie; samoloty w doku to te same rzuty z góry co w świecie.
- **Lotnisko:** okrągła płyta, pas startowy z linią środkową, terminal z kolorowym dachem; hub — większa płyta, dach morski, wieża kontroli.
- **Trasy:** szerokokadłubowe — ciągła jasna rurka wysoko nad ziemią ze smugą kondensacyjną; turbośmigłowe — przerywana, ciepło-żółta,
  niżej. Różnica kształtem (ciągła/przerywana, wysoko/nisko), nie tylko kolorem.
- **Samoloty:** low-poly 3D; turbośmigłowiec z prostym skrzydłem i dwoma śmigłami (statecznik morski), szerokokadłubowiec ze skośnym
  skrzydłem i 4 silnikami (czerwony statecznik).
- **Pasażerowie:** w dymku nad miastem — rząd glifów regionu docelowego (szewron, kokarda, półksiężyc, dziurka od klucza, statecznik, kątownik).
- **Cisza nocna:** biało-czerwony szlaban dookoła płyty zamkniętego lotniska.

## Interfejs v2: przedmioty z lotniska (po uwadze właściciela 2.11: „menu zbyt AI slop”)
Pierwsza wersja miała ciemne zaokrąglone panele i listę przycisków, czyli wygląd szablonu aplikacji. W v2 każdy element interfejsu
to prawdziwy przedmiot z lotniska, który coś znaczy:
- **Górny pasek = karta pokładowa:** tydzień, dzień (7 kwadratów doby), godzina; za perforacją odcinek z liczbą pasażerów;
  pauza jako osobny odcinek. Ostre rogi, wcięcia perforacji, brak cieni.
- **Dok = przywieszki bagażowe na sznurku** (64×62 dp, cele dotyku ≥ 48 dp): cofnij, turbośmigłowce, szerokokadłubowce,
  rozbudowa huba, przyspieszenie. Biała przywieszka oznacza typ samolotu wybrany do rysowania, a wyblakła brak zapasu.
- **Pasażerowie przy lotniskach = białe przywieszki** z dziurką i glifami celów. Przy zatorze przywieszka jest czerwona i ma odliczanie.
- **Podpowiedź = pasek postępu lotu z wieży kontroli** (ATC flight strip): kremowy, z czerwonym marginesem, w polach
  „3 788 km · LIS → ACC | za daleko dla turbośmigłowca | wskaż miasto po drodze”.
- **Ulepszenie tygodnia = etykiety frachtowe** na trzech skrzyniach w hangarze: papier pakowy, nagłówek „FRACHT · TP-48 · 1/3”,
  okienko z modelem 3D, tabela pól, czerwony stempel kontekstu („LONDYN 11/12”), ząbkowana krawędź od oderwania.
- **Menu = tablica odlotów split-flap:** każdy tryb to „lot” z bramką i statusem. „LOT BEZ KOŃCA · A1 · WEJŚCIE” na żółtych
  klapkach, „ZADANIA · B4 · PLANOWO”, „DZIŚ 02.11 · C2 · NOWY”, „USTAWIENIA · D0”. Wiersze mają ≥ 58 dp. Przy zmianie ekranu
  klapki obracają się w 60–90 ms ze stukotem.
- **Tytuł = żółto-czarny drogowskaz terminalu** z naszym własnym piktogramem (rzut szerokokadłubowca), zamiast logo na pustym tle.
- **Paleta UI:** karta `#FBF8F1`, morski pasek linii `#1E6F6A`, papier pakowy `#D6B88A`, tablica `#1C1E20`, klapka `#2C2F32`,
  żółć drogowskazu `#FFC72C`, czerwień zatoru `#C8352A`, atrament `#2A2420`. Kroje: Overpass 800, Atkinson Hyperlegible Next,
  **Overpass Mono 700** na klapki i stemple.

## Ekrany (opis)
- **Porażka:** kamera dolatuje do zapchanego huba, a scena zamiera. Na tablicy odlotów wszystkie loty z tego huba przeskakują na
  „ODWOŁANY”, wysuwa się pasek ATC z wynikiem, liczbą tygodni i trzema przyczynami z księgi przyczyn. Do wyboru: „Jeszcze raz (ten sam świat)”, „Nowy świat”.

## Ruch i dźwięk
Globus obraca się z bezwładnością, ale bez sprężynowania; trasy „wyrastają” z lotniska w 200 ms; samoloty startują i lądują
z krótkim zniżaniem. Dźwięk: miękkie drewniane „klik” przy stawianiu, szum wiatru zależny od zoomu, „Rezonujące huby” (patrz RESEARCH §4).

## Unikalność
- **Mini Metro / Motorways:** płaskie kolorowe linie na pastelu — tu bryła, światło, cienie, krajobraz. Brak wspólnego języka.
- **Mini Airways:** ciemny płaski radar — tu dzienna, ciepła sceneria i światło słońca.
- **Fly Corp:** realistyczna mapa + menu — tu stylizowany low-poly, decyzje w świecie, nie w tabelach.
- **Tiny Airline:** płaska „stołowa” mapa — tu kula z terminatorem.
- **Nasze gry:** to samo rzemiosło 3D co Commutopia, ale inny przedmiot (planeta zamiast miasta), inna paleta HUD (morska zieleń +
  papier + pomarańcz zamiast kremu i granatu z twardym cieniem) i inne kroje.

## Ryzyka
- **Wydajność** na słabym Androidzie (wypełnienie, cienie): LOD globusa, cienie tylko od chmur i samolotów, DPR ≤ 2, 30 fps w bezczynności.
- **Czytelność** w nocy i przy krawędzi: dymki i pierścienie są niezależne od oświetlenia (materiały bez światła).
- **Koszt produkcji** największy z czterech (modele, oświetlenie, testy na urządzeniach). Zgrubnie +1–2 tygodnie względem kierunków 2D.
- Postrzępione wybrzeża siatki low-poly — w produkcji siatka adaptacyjna (gęstsza przy brzegu).
