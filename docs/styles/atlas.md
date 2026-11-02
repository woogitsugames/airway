# Kierunek C — „Atlas” (rycina i akwarela dawnego atlasu)

Makiety: `mockups/atlas/png/` (gra, ulepszenie, menu; pion i poziom) · źródło `mockups/atlas/build.mjs`.

## Idea w jednym zdaniu
Globus jest tablicą z ręcznie rytego i podmalowanego akwarelą atlasu: koncentryczne linie wody przy brzegach, kreskowane góry,
lasy rysowane piórkiem, róża wiatrów, statek na Atlantyku — a na tym kompania lotnicza wyrysowuje swoją sieć.

## Dlaczego pasuje do tej gry
- Gracz **kreśli sieć na mapie świata** — atlas to naturalne miejsce na to działanie, a dawna kartografia to także historia
  pierwszych map tras lotniczych.
- **Huby to medaliony** z rytym zabytkiem, otoczone **wieńcem paciorków = miejsca w poczekalni** (czarne zajęte, czerwone przy
  przeciążeniu); czerwona pieczęć z zegarem = odliczanie do zatoru. Widać to bez cyfr.
- **Noc to rycinowe kreskowanie krzyżowe** (tak grawerzy oddawali cień) z kropkowaną linią terminatora — czytelne, piękne i tanie.
- **Typ samolotu kształtem linii:** szerokokadłubowe — podwójna czerwona „droga morska”, turbośmigłowe — kropkowany szlak indygo
  (konwencja dawnych map podróży).
- Proporcja „dużo do oglądania, mało do czytania”: świat jest bogaty, a HUD to kilka kartek papieru.

## Paleta
| Nazwa | Hex | Rola |
|---|---|---|
| Papier | `#EBDDBB` | tło, plansza |
| Ląd | `#EFE2BF` | ląd (jaśniejszy papier) |
| Morze | `#C9D6C2` | ocean, linie wody `#8FA592` |
| Zieleń akwareli | `#B9C48D` | lasy, strefa umiarkowana |
| Piasek akwareli | `#E6C98C` | pustynie |
| Atrament | `#3B2A1E` | kontury, tekst, paciorki zajęte |
| Czerwień kompanii | `#A3312A` | jedna główna akcja, trasy dalekie, przeciążenie |
| Indygo | `#2D3E6B` | szlaki turbośmigłowe, turbośmigłowiec |
| Noc | `#24304F` | kreskowanie nocy |

Kontrast: Atrament na Papierze **10,2:1**, na Lądzie 10,6:1, Papier na Czerwieni 5,1:1. Kolory celów
`#2D5DA8 #4E7A3A #C9962F #3B2A1E #B0559A #6FB3C0` — min. ΔE76: protan 15,1, deutan 15,9, tritan 16,6.

## Typografia (OFL)
- Nagłówki, nazwy miast: **Alegreya SC** 500/800 (kapitaliki o rodowodzie kaligraficznym — jak napisy na mapach).
- Tekst: **Alegreya** 400/700 + kursywa do opisów („pasażerów”, „Kompania przysłała…”).

## Język ikon i obiektów
Rysunek piórkiem 0,8–1,4 px, kreskowanie zamiast cieniowania, akwarela z postrzępionymi brzegami (filtr przemieszczenia).
Miasta: symbol trzech wież z dawnych map + chorągiewka z glifem regionu (co dane miasto „obsługuje”). Pasażerowie: glify na
wstędze-banderoli. Kartki HUD mają zagięty róg i wewnętrzną ramkę — papier, nie „karta aplikacji”.

## Ekrany
- **HUD w grze:** wstęga z tygodniem i godziną + siedem kropek doby; kartka z pasażerami; pauza; dok z kartek w zasięgu kciuka.
- **Ulepszenie:** „Tablica I/II/III” jak dodatek do atlasu: rycina samolotu w okręgu morza albo medalion huba.
- **Porażka (opis):** przepełniony hub dostaje czerwoną pieczęć lakową, mapa „starzeje się” (sepia) i pojawia się kartusz z
  raportem: wynik, tygodnie, trzy przyczyny; „Jeszcze raz”, „Nowy świat”.
- **Menu:** kartusz z tytułem i podtytułem „Atlas połączeń świata”, globus z siecią, róża wiatrów, lista kartek.

## Ruch i dźwięk
Linie „rysują się” stałą prędkością jak piórko; nowa trasa zostawia na chwilę mokry atrament (ciemniejszy, potem schnie).
Dźwięk: skrobanie stalówki przy rysowaniu, szelest kartki przy ulepszeniu, gwizdek statku przy nowym mieście; muzyka smyczkowo-klawesynowa w duchu „Rezonujących hubów”.

## Unikalność
- vs Mini Metro/Airways: zero płaskich kolorowych linii i pustego tła — gęsta ilustracja, faktura papieru, rycina.
- vs Fly Corp i Tiny Airline: nie realistyczna ani „stołowa” mapa, tylko stylizowany, historyczny globus.
- vs nasze gry: żadna nie używa ryciny i akwareli; inne kroje i paleta. Najdalej od AirWar (plakat) i Commutopii (3D, naklejki).

## Ryzyka
- Gęsta faktura może utrudnić czytanie małych glifów — w produkcji przy oddaleniu ukrywamy część dekoracji (lasy, linie wody).
- Filtry SVG (akwarela, papier) są drogie: w Canvas pre-renderujemy je raz do tekstury globusa.
- Klimat „starego atlasu” może kojarzyć się z grami eksploracyjnymi; trzeba trzymać nowoczesną czytelność HUD.
