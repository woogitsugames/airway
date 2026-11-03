# G9: płyty lotnisk, trasy i samoloty pod nowy globus (D-175). Warianty do wyboru

Prawdziwe rendery z gry: seed 15 (kadr z Twojego zrzutu), Satelita i Mapa, telefon 412×915 i Fold 1812×2176.
Przełącznik działa tylko w DEV: `?airportStyle=ink|apron|medal`, razem z `?globeLook=satellite|map`. Domyślny
wygląd gry się nie zmienia. Zestawienia: `compare-g9-phone.png` (wiersze: Satelita w dzień, Mapa w dzień,
Satelita o zmierzchu) oraz `compare-g9-fold.png`.

| Wariant | Lotnisko | Trasy |
|---|---|---|
| Dziś | jasna płyta, ciemny pas, kolorowy dach | jasna rurka (szerokokadłubowe), złote kreski (turbośmigłowe) |
| **V1 „Tusz”** | ciemna płyta, jasny pas i terminal, jasne obrzeże, mocny kolor dachu | jak dziś, ale z ciemnym obrysem |
| **V2 „Płyta”** | asfaltowa płyta z białą linią, obrzeże w kolorze typu (morski hub, pomarańczowe zwykłe) | ciemny obrys, turbośmigłowe pomarańczowe |
| **V3 „Medalion”** | dzisiejsza jasna płyta z grubym ciemnym obrysem | ciemny obrys |

Typy nadal różnią się kształtem (hub: większa płyta i wieża; szerokokadłubowe: ciągła rurka, turbośmigłowe: kreski).

## Pomiar sondy D-47 (trasy / lotniska / samoloty / przywieszki, próg 4,5:1)

| Kadr | Dziś | V1 | V2 | V3 |
|---|---|---|---|---|
| Satelita, dzień, Fold | 5,7 / 5,2 / 5,1 / 12,9 | 3,5 / 3,1 / 5,2 / 11,2 | 3,0 / 2,2 / 5,2 / 11,3 | 3,5 / **4,5** / 5,1 / 12,9 |
| Satelita, dzień, telefon | 3,8 / 4,9 / 4,0 / 9,2 | 2,3 / 2,8 / 4,0 / 9,0 | 2,2 / 2,1 / 4,1 / 9,2 | 2,3 / 4,2 / 4,0 / 9,4 |
| Satelita, zmierzch, telefon | 5,0 / 7,6 / 4,8 / 16,8 | 3,1 / 4,0 / 4,6 / 16,6 | 2,6 / 2,1 / 4,5 / 16,3 | 3,0 / **6,0** / 5,3 / 16,9 |
| Mapa, dzień, telefon | 1,3 / 1,4 / 1,4 / 1,7 | 2,0 / 2,1 / 1,5 / 1,7 | 1,8 / 2,2 / 1,5 / 1,7 | 2,0 / 1,6 / 1,5 / 1,7 |

**Uwaga do liczb.** Sonda bierze medianę jasności wszystkich pikseli warstwy, więc przy dwukolorowym obiekcie
(ciemny obrys i jasny rdzeń) wychodzi średni szary. Dlatego obrys „obniża” wynik, choć na obrazie widać lepiej:
na Mapie dzisiejsze płyty znikają, a V1–V3 są wyraźne. W G9 sonda musi mierzyć kontrast krawędzi (D-177). Na
Mapie same przywieszki (1,7) to papierowy UI na jasnym tle; to także sprawa G9 (np. ciemny sznurek lub cień).

## Rekomendacja Claude
**V3 „Medalion”**: zachowuje znany kształt i kolory obiektów z D-11, a obrys daje czytelność na obu trybach. Na
Satelicie ma najlepszy wynik lotnisk (4,2–6,0). V1 jest najmocniejszy na Mapie, ale na Satelicie robi się ciężki
i ciemny. V2 jest najbardziej „realistyczny”, ale szara płyta zlewa się z suchym terenem Azji.

Pełne kadry Fold (1812×2176) nie są w repo (są w `compare-g9-fold.png`). Odtworzenie: `node dev/globe-look/shots.mjs --looks=satellite,map --times=day --sizes=fold --play=300 --style=<ink|apron|medal> --out=docs/mockups/globe-2026-11/g9`.
