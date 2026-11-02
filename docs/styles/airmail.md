# Kierunek B — „Poczta lotnicza” (świadomie z rodziny naszych gier)

Makiety: `mockups/airmail/png/` (gra, ulepszenie, menu; pion i poziom) · źródło `mockups/airmail/build.mjs`.

## Idea w jednym zdaniu
Ilustrowany szkolny globus w manierze naszych gier (płaska ilustracja z konturem jak w Cebulaku): miasta to znaczki pocztowe z
panoramą, trasy dalekiego zasięgu to wstęgi „par avion”, świat jest pełen drobnych rysunków — drzew, gór, fal, wydm i chmur.

## Dlaczego pasuje do tej gry
- **Linia lotnicza = poczta lotnicza.** Pasażerowie to bagażowe zawieszki z glifem celu, huby to większe znaczki, ulepszenie
  tygodnia to „przyszła poczta, otwórz jedną paczkę”. Cała metafora pochodzi z lotnictwa pasażerskiego i pocztowego.
- **Ząbki perforacji = miejsca w hubie.** Pod znaczkiem huba biegnie listwa miejsc; zajęte są zaczernione, przy zatorze czerwone.
  Pełna listwa i czerwony **stempel** z odliczaniem („0:42”) pokazują zator, zanim przeczytasz liczbę.
- **Cisza nocna = znaczek zasłonięty nocą** z księżycem i godzinami „23–06”.
- Paski „par avion” od razu odróżniają trasy szerokokadłubowe (pasiasta wstęga) od turbośmigłowych (kremowa wstęga z przeszyciem).

## Paleta
| Nazwa | Hex | Rola |
|---|---|---|
| Niebo | `#BFE3EC` | tło poza globusem |
| Morze | `#8FCADB` | ocean, fale `#E9F6F8` |
| Ląd | `#B9D98A` | strefa umiarkowana |
| Wydma | `#EED9A2` | pustynie |
| Kontur | `#2E2B28` | wszystkie kontury i tekst |
| Papier | `#FBF4E4` | znaczki, panele |
| Czerwień par avion | `#C8332B` | jedna główna akcja, zator, stempel |
| Granat par avion | `#1F3F8F` | wstęga dalekiego zasięgu, etykiety |
| Musztarda | `#D9A21B` | przeszycie wstęgi turbośmigłowej |
| Noc | `#1B2440` @ 42% | strona nocna |

Kontrast: Kontur na Papierze **12,8:1**, Kontur na Niebie 10,3:1, biały na Czerwieni 5,3:1, Czerwień na Papierze 4,8:1.
Kolory celów `#1F3F8F #2E8B57 #D9A21B #C8332B #B05AA8 #8AD3E6` — min. ΔE76: protan 16,9, deutan 26,3, tritan 24,4.

## Typografia (OFL)
- Nagłówki i liczby: **Young Serif** (ciepły, książkowy szeryf z cyframi nautycznymi — jak druk na znaczkach).
- Tekst: **Familjen Grotesk** 400/700.

## Język ikon i obiektów
Kontur 2 px, płaskie wypełnienia, miękki offsetowy cień (rodzinny), ale formy filatelistyczne: znaczek, stempel, zawieszka,
koperta z szewronami. Samoloty: białe sylwetki z konturem i cieniem na ziemi; szerokokadłubowiec z czerwoną kropką „lotu pocztowego”.
Huby mają rozpoznawalne zabytki (Big Ben, wieża Belém, kopuła z minaretami), zwykłe miasta — proceduralną panoramę.

## Ekrany
- **HUD w grze:** kremowe tabliczki z konturem: tydzień z paskiem doby, pasażerowie, pauza; dok kciukowy 62 dp na dole.
- **Ulepszenie:** trzy „paczki” z kopertowym obramowaniem z szewronów, ilustracja samolotu w okienku nieba lub znaczek huba.
- **Porażka (opis):** zapchany znaczek dostaje grube czerwone „ZWROT DO NADAWCY”, z góry spada koperta-raport: wynik, tygodnie,
  trzy przyczyny z księgi przyczyn; „Jeszcze raz”, „Nowy świat”.
- **Menu:** słońce, globus z siecią i chmurami, logo z paskiem par avion, lista w zasięgu kciuka.

## Ruch i dźwięk
Wstęgi rozwijają się liniowo; znaczek „przybija się” krótkim stuknięciem (bez odbicia), zawieszki przesuwają się w kolejce.
Dźwięk: stempel, szelest papieru, dzwonek pocztowy przy nowym mieście; muzyka jak „Rezonujące huby”, ale na celeście i pizzicato.

## Unikalność
- vs Mini Metro/Airways/Fly Corp: ilustracja, kontur, rysunki krajobrazu, metafora poczty — zero schematu.
- vs Tiny Airline: globus i bogata ilustracja zamiast płaskiej mapy.
- **vs nasze gry — najsłabszy punkt kierunku:** świadomie rodzinny (kontur, krem, miękki cień) i blisko Cebulaka. Ryzyko odbioru
  jako „reskin” Cebulaka lub Frontiera (miasta z licznikami + przeciąganie połączeń). Formy filatelistyczne muszą całkowicie zastąpić
  „wieże z licznikami”.

## Ryzyka
Gęstość: znaczki + zawieszki szybko zatłaczają Europę (widać w makietach) — w produkcji zawieszki tylko przy hubach i po dotknięciu
miasta, a mniejsze znaczki przy oddaleniu. Wiele drobnych rysunków = więcej pracy ilustracyjnej (wszystko proceduralnie w kodzie, jak w naszych grach).
