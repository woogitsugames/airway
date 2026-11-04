# Nowy wygląd globusa — makiety (listopad 2026, ext/03)

**Wybór właścicielki (D-170):** kierunek **B „Realistyczny”**, a obok drugi tryb **„Mapa”** (D-172). Satelita
jest domyślny, przełącznik jest w Ustawieniach i w doku. Tekstura satelitarna pochodzi z lipca (D-176). Płyty
lotnisk, trasy i samoloty dostaną nowy wygląd po osobnej rundzie makiet (D-175). Plan wdrożenia jest w
[PLAN.md](PLAN.md), a kroki G1–G9 w `docs/NIGHT-BACKLOG.md`.

Wszystkie obrazy to **prawdziwe rendery z silnika gry**, a nie rysunki. Za każdym razem działa ta sama gra
(`?storeShot=game`, seed 15: Teheran, Lahaur, Taszkent, Ałmaty, czyli kadr ze zrzutu z Folda). Wygląd zmienia
eksperymentalny przełącznik, dostępny tylko w trybie DEV: `?globeLook=refined|satellite|painted|map`.

| Plik | Co pokazuje |
|---|---|
| `compare-{day,dusk}-{phone,fold}.png` | zestawienia obok siebie: dziś, A, B, C, Mapa |
| `<look>-<day/dusk>-<phone/fold>.png` | pojedyncze kadry: telefon 412×915, Fold 1812×2176 (906×1088 @2x) |
| `shots.json` | pomiar kontrastu D-47 dla każdego kadru (`nightContrast` z sondy DEV) |

Powtórzenie: `python3 -I dev/globe-look/bake.py <pobrane>` (tekstury, źródła w `docs/ASSETS.md`), potem
`node dev/globe-look/shots.mjs --play=300` i `python3 -I dev/globe-look/sheet.py docs/mockups/globe-2026-11`.

## Kierunki
- **A „Dopracowana diorama”**: ten sam ilustracyjny świat, ale z gładkimi normalnymi i kolorami liczonymi per
  wierzchołek (koniec z kanciastymi blokami gór i pikselowym szumem grani). Stonowane biomy bez pomarańczowych
  plam, szersze i przerywane pasma górskie, 60% drzew w zwartych lasach, kamienie tylko na zboczach. Ocean ma
  linię brzegu z pianą i odblask, atmosfera reaguje na słońce.
- **B „Realistyczny”**: kolory z NASA Blue Marble NG, nocą światła miast z Black Marble 2016, relief z NOAA
  ETOPO5 (wysokość = √km, płyty lotnisk spłaszczone), warstwa chmur pod płytami lotnisk (chmury nigdy nie
  zasłaniają lotniska), ocean z odblaskiem i fresnelem, atmosfera ciepła na terminatorze.
- **C „Pomiędzy”**: kolory Blue Marble uproszczone do malarskich plam (paleta 56 kolorów i filtr trybu),
  własna rampa głębokości morza, miękki cień reliefu, czapy śnieżne powyżej ~5,4 km i puszyste chmury z dioramy.
- **Tryb „Mapa”** (D-172, wzór: Google Maps właścicielki): własna paleta (roślinność szałwiowa, suche tereny
  kremowe, lód biały, jasne morze), granice państw z Natural Earth i delikatny relief. Bez napisów i bez kolorów
  skopiowanych z Google. Siatka i shadery są te same co w B, więc przełączenie podmienia tylko teksturę.

## Wydajność: `perf:scene`, SwiftShader, 412×915, DPR 1, 40 s na przebieg (tylko orientacyjnie, nie porównywać z urządzeniem)

| Wygląd | Preset | CPU submit śr./p95 (ms) | Klatki | FPS bezczynność/aktywność | Trójkąty (maks.) | Draw calls |
|---|---|---|---|---|---|---|
| dziś | low | 1.84 / 2.30 | 318 | 8.6 / 7.3 | 185 314 | 43 |
| dziś | medium | 3.50 / 3.10 | 126 | 3.9 / 2.4 | 244 062 | 42 |
| dziś | high | 8.12 / 5.80 | 61 | 2.3 / 0.9 | 436 435 | 42 |
| A | low | 1.99 / 2.20 | 380 | 10.3 / 8.8 | 201 699 | 45 |
| A | medium | 3.23 / 4.50 | 147 | 4.3 / 3.1 | 248 902 | 45 |
| A | high | 6.39 / 6.60 | 77 | 2.7 / 1.2 | 432 864 | 44 |
| **B** | low | 1.71 / 2.20 | 375 | 10.1 / 8.7 | 190 580 | 40 |
| **B** | medium | 3.45 / 2.70 | 174 | 5.3 / 3.5 | 207 604 | 39 |
| **B** | high | 6.35 / 4.30 | 104 | 3.4 / 1.9 | 365 822 | 40 |
| C | low | 1.60 / 2.20 | 408 | 10.9 / 9.5 | 184 374 | 41 |
| C | medium | 3.53 / 2.60 | 191 | 5.7 / 4.0 | 197 057 | 40 |
| C | high | 5.74 / 3.80 | 109 | 3.6 / 2.0 | 349 789 | 41 |
| Mapa | low | 1.49 / 2.00 | 423 | 11.2 / 10.0 | 179 636 | 39 |
| Mapa | medium | 2.74 / 2.20 | 199 | 5.8 / 4.2 | 188 148 | 38 |
| Mapa | high | 4.83 / 4.10 | 114 | 3.7 / 2.1 | 335 422 | 39 |

W SwiftShaderze B rysuje więcej klatek niż dzisiejsza diorama (+18% low, +38% medium, +70% high), bo znikają
drzewa i kamienie (ok. 75 tys. trójkątów na medium). Rasteryzator programowy nie pokaże jednak dwóch kosztów
istotnych na telefonie: pamięci GPU na teksturę 4096×2048 (~43 MB z mipmapami, bez kompresji) oraz wypełniania
(ocean, mgiełka, chmury i halo to 3–4 przezroczyste warstwy na cały ekran). Dlatego w planie są G4 (wtopienie
oceanu i mgiełki w shader terenu) oraz D-173/G7 (2048 na low, w razie potrzeby KTX2).

## Rozmiar zasobów (MB, pliki w `dev/globe-look/assets/`)

| Wygląd | low | medium/high | Wszystkie pliki kierunku |
|---|---|---|---|
| A | 0 | 0 | 0 (proceduralnie) |
| B | 0,70 (dzień 2048 + noc 1024 + wysokości + chmury) | 1,46 (dzień 4096 + noc 2048 + …) | ≈ 1,80 |
| C | 0,50 | 0,82 | ≈ 1,01 |
| Mapa (dodatkowo do B) | 0,15 | 0,39 | ≈ 0,55 (noc wspólna z C) |

## Czytelność (kontrast D-47 tras / lotnisk / samolotów / przywieszek względem globusa, próg 4,5:1)

| Kadr | dziś | A | B | C | Mapa |
|---|---|---|---|---|---|
| dzień, telefon | 2,2 / 2,3 / 1,9 / 2,2 | 2,2 / 2,3 / 2,4 / 3,2 | **3,8 / 4,9 / 4,0 / 9,2** | 2,6 / 3,0 / 2,4 / 4,9 | 1,3 / 1,4 / 1,4 / 1,7 |
| dzień, Fold | 2,4 / 2,4 / 2,5 / 1,6 | 2,4 / 2,3 / 2,8 / 3,1 | **5,7 / 5,2 / 5,1 / 12,9** | 3,2 / 3,1 / 2,9 / 4,9 | 1,3 / 1,4 / 1,5 / 1,8 |
| zmierzch, telefon | 4,0 / 5,8 / 3,6 / 7,7 | 4,1 / 6,0 / 5,9 / 7,9 | **5,0 / 7,6 / 4,8 / 16,8** | 3,7 / 6,0 / 5,3 / 10,9 | 2,2 / 2,8 / 3,1 / 4,3 |

Wartości B dotyczą tekstury lipcowej (D-176), czyli kadrów w tym folderze. B jest
najczytelniejszy ze wszystkich, także w porównaniu z dzisiejszym globusem. Tryb Mapa wymaga przeprojektowania
płyt lotnisk, tras i samolotów (D-175, G9), o czym zdecydowała właścicielka.

## Ryzyko wobec listy zakazów (CLAUDE.md)
- **B**: brak płaskiego pastelowego tła, wyglądu planu metra i elementów UI w stylu AI slop. Globus jest
  bryłą z reliefem i światłem (spełnia D-05). Ryzyko: wygląd „jak każdy globus Blue Marble”, więc o
  tożsamości gry decydują obiekty lotnisk i papierowy UI (D-11) oraz G9.
- **Mapa**: najbliżej zakazanego „płaskiego pastelu”. Ratują go relief, oświetlenie 3D, terminator i własna
  paleta, ale bez nowego tuszu tras i lotnisk (G9) nie przechodzi D-47.
- **Licencje**: NASA (Blue/Black Marble), NOAA (ETOPO5) i Natural Earth to domena publiczna, chmury są
  własne (CC0). Wpis w `docs/ASSETS.md`.
