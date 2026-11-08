# UI-A „Lotniskowa tablica i paski lotu” — specyfikacja (wersja 2, 2026-11c)

Makiety: `ui-a-*.png` (412×915 pt, PNG @2x), zestawienie `zestawienie-ui-a2.png`.
Render: `node docs/styles/kierunki-2026-11c/makiety/ui-a/src/shoot.mjs [night|day|dense|hc|menu|week|over|sheet]`.
Kod makiety (`src/ui.js`, `src/ui.css`) jest wzorcem, nie kodem gry.

## 1. Idea
Chrom gry mówi językiem lotniska, nie aplikacji: tablica split-flap (czas, tydzień, pasażerowie), emaliowane
tabliczki lotnisk na mapie, papierowe paski lotu kontrolera (huby), pulpit kontrolera (narzędzia), wydruk dalekopisu
(raport). Grafika tłumaczy rozgrywkę: linia trasy na tabliczce samolotu w doku jest tą samą linią, którą samolot
rysuje na mapie (przerywana = turbośmigłowiec, ciągła = szerokokadłubowiec).

## 2. Tokeny

### Kolory
| Token | Hex | Znaczenie |
|---|---|---|
| `--enamel` | `#0E0F0F` | emalia tablic i tabliczek |
| `--panel` | `#171818` | wnęka pasków |
| `--console` / `--console2` | `#2A2E2B` / `#343935` | pulpit (dok, pauza) |
| `--flap-a` / `--flap-b` / `--hinge` | `#232423` / `#1A1B1A` / `#050505` | klapki split-flap i ich zawias |
| `--cream` / `--cream2` / `--dim` | `#EFE7D3` / `#B9B2A2` / `#6F6B62` | tekst, kody lotnisk, obwódki, piny |
| `--engrave` | `#C9C3B2` | grawerowane podpisy pulpitu |
| `--lamp` | `#FFF1C9` | zapalona lampka wybranego narzędzia |
| **`--sign`** | **`#F3C317`** | **tylko kierunek / następna akcja** (zob. niżej) |
| `--red` | `#C9251C` | tylko zator (znak nakazu: biel na czerwieni, pieczątka) |
| `--paper` / `--rule` / `--print` | `#EDE3C8` / `#A89A78` / `#2A2620` | paski lotu i wydruk |
| `--blue` | `#3B5F8C` | uchwyt paska huba w normie |
| regiony D-08 | `#009E73` `#E69F00` `#13302E` `#CC79A7` `#0072B2` `#56B4E9` | glify pasażerów (zawsze z kształtem) |

**Żółty ma jedno znaczenie: „dokąd / co dalej”.** Wolno go użyć wyłącznie dla: rysowanej trasy (ołówek
woskowy), znacznika jej odległości, znaku kierunku przy krawędzi ekranu (lotnisko poza kadrem) i jednego
głównego przycisku ekranu. Na ekranie gry naraz najwyżej 3 elementy żółte. Wybór (narzędzie, pasek, zakładka)
pokazujemy odwróceniem na krem + lampką / klipsem „wybrany”, nie żółtym.

### Kroje (SIL OFL, `ui-a/fonts/`)
| Rola | Krój | Rozmiar (pt) |
|---|---|---|
| zegar tablicy | Archivo 700, stretch 78% | 34 na klapce 25×40 |
| liczby tablicy | Archivo 700 | 18 na klapce 17×25 |
| etykiety tablicy | Archivo 600, wersaliki, odstęp .16em | 8.5 (HC: 11) |
| kod lotniska | Archivo 800, stretch 82% | 14, hub 16 |
| miasto | Archivo 600 | 11 |
| podpis pulpitu | Archivo 700, wersaliki, odstęp .1em | 9.5 (HC: 12.5) |
| przycisk główny | Archivo 800, wersaliki | 27 (w parze 22) |
| pasek lotu / wydruk | Chivo Mono 500–800 | 7.5 nagłówki, 12 tekst, 22 kod huba |

Minimalny tekst na mapie i w pulpicie: 9.5 pt przy skali 100%; poniżej tylko etykiety tablicy (8.5 pt, wersaliki).

### Siatka
Siatka 8 dp; marginesy boczne 8, wewnętrzne 4 / 8 / 16. Cele dotyku ≥ 48 dp (pulpit: 58–92 × 58 dp twarzy
+ podpis; pauza 64×90; przyciski główne 68–76 wys.). Strefy bezpieczne: pasek stanu 30, dół 24 (dok ma je w sobie).

## 3. Komponenty

**Tablica split-flap.** Czarna emalia, klapki z linią zawiasu w połowie wysokości. Zegar, tydzień, dzień,
pasażerowie; pod spodem pasek 24 godzin (noc ciemniejsza, minione jaśniejsze, wskaźnik biały 3 px).
Zmiana wartości = przewrót klapki 120 ms na znak, kolejne znaki co 30 ms; bez odbicia.

**Znak lotniska (tabliczka emaliowana).** Krem na czarnym, kremowa wewnętrzna ramka wokół kodu IATA; za kodem
kolejka glifami D-08. Hub: większy kod, pin z gwiazdą huba, kolejka huba w pasku lotu. Zator: biel na
czerwieni + odliczanie, pierścień postępu wokół pinu. „NOWE”: kremowa zawieszka nad krawędzią tabliczki.

**Pasek lotu.** Papier w kolorowym uchwycie (czerwony = zator, niebieski = w normie); kolumny: hub, kolejka
(wiersz na region), miejsca, czas do zamknięcia (czerwony ołówek obwodzi pilne). Przy gęstej sieci lub tekście
130% wnęka pokazuje 1 pasek (najpilniejszy) + kafel „+N paski”.

**Dok = pulpit kontrolera.** Kształt mówi, czym jest kontrolka:
- okrągły przycisk w pierścieniu — akcja natychmiastowa (Cofnij, Pauza);
- pokrętło z podziałką 1/2/4 — ustawienie (Tempo);
- prostokątna tabliczka emaliowana przykręcona śrubami — samolot do przydzielenia; na tabliczce sylwetka,
  linia trasy (przerywana / ciągła) i licznik split-flap;
- ośmiokąt — budowa (Hub); niedostępny = kreskowanie + papierowa zawieszka „za 1 dzień”.
Wybrana tabliczka: odwrócona na krem, wciśnięta 1 px, lampka zapalona, podpis biały.

**Pieczątka.** Czerwona ramka, Archivo 800 20 pt, obrót −4°. Ma własne, wydrukowane „pole pieczęci”
(116×74, kreskowane) w stopce wydruku; od perforacji, linii i tekstu dzieli ją ≥ 8 pt. Nigdy nie leży na
tekście, linii ani torze perforacji.

**Wydruk (raport).** Papier dalekopisu z perforacją po bokach i zdartą górną krawędzią, Chivo Mono, linie
kropkowe, tabela tygodni, stopka „dyżurny” + pole pieczęci.

## 4. Stany i ruch
- Naciśnięcie: twarz kontrolki przesuwa się 1 pt w dół, cień 2→1 pt, 60 ms. Brak skalowania i sprężyn.
- Wybór narzędzia: odwrócenie kolorów 90 ms, lampka zapala się od razu.
- Klapki: patrz tablica. Zator: pierścień rośnie liniowo z czasem; ostatnie 10 s — miganie 1 Hz tylko pierścienia.
- Pieczątka: pojawia się w jednym kroku (80 ms, krycie 0→0.9), bez „uderzenia” i odbicia.
- Krzywe: `cubic-bezier(.2,0,0,1)` lub liniowo; czasy 60–180 ms. „Ogranicz ruch” = bez animacji klapek.
- Niedostępne: kreskowanie + powód słowami (nie samo wyszarzenie).

## 5. Wysoki kontrast + tekst 130% (`ui-a-gra-kontrast.png`)
Globus przyciemniony o 42%, etykiety atlasu wyłączone, granice białe 45%. Tabliczki: czysta czerń, biała ramka
1.6 pt, biały tekst; trasy 4.2 pt biel na czarnej obwódce 9 pt; przerywana 9/6. Paski: biały papier, czarny
tekst. Teksty ×1.3; mapa przechodzi na poziom szczegółowości 2; pulpit używa krótkich form podpisów
(„Turbo”, „Szeroki”, „1 dzień”) — krótkie formy są osobnymi kluczami i18n. Kolejka huba w pasku: glif + liczba.

## 6. Rozmieszczanie etykiet lotnisk
**Poziomy szczegółowości (LOD), zależne od zoomu i skali tekstu:**
1. Bliski zoom (szerokość kadru < ok. 1 500 km) i tekst < 120%: kod + glif na każdego pasażera (maks. 7, dalej
   „+n”) + nazwa miasta pod tabliczką.
2. Szeroki zoom lub tekst ≥ 120%: kod IATA + jeden glif na kierunek (od najliczniejszego) + suma; miasto tylko
   przy hubach. Nazwy państw znikają, morza zostają, jeśli nie kolidują.
3. Awaryjnie: sam kod.

**Algorytm (zachłanny, deterministyczny):**
1. Priorytet: zator > hub > lotnisko z trasą > liczba czekających. Wyżej = umieszczane wcześniej.
2. Grupowanie: zwykłe lotniska, których piny są bliżej niż 40 pt (na ekranie), dostają wspólną tabliczkę
   „LCA·BEY” z sumą i glifami kierunków oraz cienką linią odniesienia do każdego pinu. Huby nigdy nie są grupowane.
3. Kandydaci: preferowana strona, potem P, L, PG, LG, PD, LD; następnie te same pozycje odsunięte o 20 pt z linią
   odniesienia (kara). Pierwsza pozycja bez kolizji wygrywa.
4. Kolizje: inne tabliczki, piny (ważniejsze niż tabliczki), samoloty (lżejsza kara), krawędź ekranu (4 pt),
   strefy chromu (tablica u góry, wnęka pasków i dok u dołu). Trasy mogą biec pod tabliczką (tabliczka ma obrys).
5. Brak miejsca na danym LOD → następny LOD dla tego lotniska; nadal brak → sam kod w najlepszym miejscu.
6. Etykiety atlasu (państwa, morza) ustępują tabliczkom i pinom.
7. Stabilność: pozycja zmienia się tylko przy zmianie LOD lub nowej kolizji; przejście 120 ms przesunięciem.

## 7. Samokontrola „czy to szablon AI?”
Sprawdzone na wszystkich 7 kadrach: brak fioletowo-niebieskich gradientów, szkła, poświaty, emoji, kart SaaS,
wyśrodkowanego „Witaj”, wykresów; kroje OFL (nie Inter/Roboto); samoloty i glify własne; typy rozróżnione
kształtem. Poprawki w tej rundzie: (1) dok z ciemnych klawiszy na pulpit z kształtami-znaczeniami; (2) żółty
zdjęty z tabliczek, licznika, wyboru narzędzia i paska tygodnia; (3) gęsta sieć z grupowaniem i LOD; (4) pieczątka
w osobnym polu i kontrast 130% z krótkimi formami. Ryzyka: zawieszka „za 1 dzień” jest gęsta przy 9 pt; pulpit
jest ciemny także w dzień (do sprawdzenia na urządzeniu w słońcu).
