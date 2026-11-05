# Kontrast wariantu C „Róża” na prawdziwym globie

Audyt WCAG barw tuszu, obwódek (halo) i znaków wariantu C z `docs/styles/ui-2026-11/KARTA-V2.md` (źródła:
`mockups/ui-2026-11/v2/c/c.js`, `v2/common.js`) na klatkach prawdziwej gry `docs/mockups/ui-2026-11/_frames/`
(`game-p`, `game-l`; strona dzienna i nocna). Skrypt: `python3 scripts/research/roza-contrast.py` (Pillow + numpy,
poza testami). Próg zgodnie z **D-47**: 4,5:1 dla tekstu i warstw rozgrywki na globie (trasy, lotniska, samoloty,
przywieszki); dla elementu czysto dekoracyjnego (przerywany łuk doku) przyjęto 3:1 (WCAG 1.4.11).

## Metoda
- Tła: piksele klatek (DPR 2) w miejscach, gdzie Róża stawia podpisy — pustynia (Sahara, Arabia), ocean
  (M. Śródziemne, Czarne, Atlantyk), noc ze światłami miast, Afryka pod dokiem i tarczą, niebo; stare medaliony
  zamaskowane. Z każdego obszaru najciemniejszy i najjaśniejszy piksel (0,5 / 99,5 percentyl) oraz absolutne maksimum.
  „Lód” = najjaśniejszy neutralny piksel globu: w kadrze Europa–Bliski Wschód nie ma czap lodowych, najjaśniejsze są
  bloki świateł miast i jasny piasek (`#EDE4D0`, praktycznie biel Grenlandii/Antarktydy).

  | obszar | najciemniejszy | najjaśniejszy | max |
  |---|---|---|---|
  | pustynia | `#2E1609` | `#BDA78F` | `#E4D6BA` |
  | ocean | `#00011E` | `#88C1E2` | `#A2C1CD` |
  | noc + światła miast | `#000201` | `#C0AD8B` | `#ECE3D0` |
  | Afryka pod dokiem | `#000000` | `#947E55` | `#E4D9C3` |
  | lód / najjaśniejszy neutralny | — | `#AF9D8F` | `#EDE4D0` |
  | niebo | `#8CC3D8` | `#8CC3D8` | `#8CC3D8` |

- Dla każdego znaku trzy stosunki: **tusz│obwódka** (krawędź, którą czyta oko; przy kryjącej obwódce nie zależy od
  tła), **tusz│tło** (gdy obwódka znika — antyaliasing, zbyt cienka), **obwódka│tło** (sylwetka).
- Wynik PASS, gdy tusz│obwódka ≥ progu i obwódka wystaje ≥ 1 px CSS poza tusz, albo gdy sam tusz trzyma próg na
  każdym tle. Ciemna obwódka `#0C1418` znika na nocy (1,01:1), ale wtedy biały tusz sam ma tam ≥ 16:1, więc to nie
  błąd; z kolei na pustyni/lodzie biały tusz ma 1,13:1 i **całą robotę robi obwódka**.

## Wyniki

| barwa / znak | najgorsze tło | stosunek (tusz│obwódka; tusz│tło) | wynik |
|---|---|---|---|
| Kreda `#F5F2EA` — nazwa po łuku, notka „ATH 14 z 24”, liczby, podpisy doku, cyfry tarczy (obwódka `#0C1418` 2,6–3,2) | lód/światła `#EDE4D0` | 16,63; 1,13 | PASS |
| DIM = kreda 55 % (`#8C8E8C` na obwódce) — „za 1 dzień”, wolne kreski róży | lód/światła `#EDE4D0` | 5,64; 1,07 | PASS (na styk +1,1) |
| Kreski zajęte, pierścienie lotniska i tarczy (kreda 1,3–2,2 px, obwódka ~1,1 px) | lód/światła | 16,63; 1,13 | PASS |
| Cynober `#EA4A2A` — nazwa i notka zatoru | Afryka `#947E55` | 4,88; 1,03 | PASS (zapas tylko 0,38) |
| Cynober — gruby łuk odliczania (4 px na 7 px obwódki) | Afryka `#947E55` | 4,88; 1,03 | PASS (zapas 0,38) |
| Cynober — kreski róży zatoru | Afryka `#947E55` | 4,88; 1,03 | PASS (zapas 0,38) |
| Cynober — pionowa kreska startu łuku (2 px, **bez obwódki**) | Afryka `#947E55` | —; 1,03 | **FAIL** |
| Przerywany łuk doku (DIM 1,2 px na obwódce 70 %) — dekor | lód/światła | 3,38; 1,07 | PASS (próg 3) |
| Glif pasażera AFR `#13302E` na ciemnym obrysie | pustynia `#2E1609` | **1,32**; 1,21 | **FAIL** |
| Glif pasażera NAM `#0072B2` na ciemnym obrysie | Afryka `#947E55` | **3,59**; 1,33 | **FAIL** |
| Glify EUN `#009E73` / ME `#CC79A7` / SAM `#56B4E9` / EUS `#E69F00` | — | 5,44 / 6,08 / 8,06 / 8,26 | PASS |
| Poziom, niebo: tarcza i dok — czerń `#0C1418` na jasnej obwódce `#EEF3F2` | niebo `#8CC3D8` | 16,60; 9,67 | PASS |
| Poziom, niebo: podpis wyłączony — czerń 50 % (`#7D8485`) | niebo `#8CC3D8` | **3,42**; 2,95 | **FAIL** |
| „Tydzień 1”, „34 pasażerów”, „Airway”, pauza — czerń bez obwódki | niebo `#8CC3D8` | 9,67 | PASS (tylko póki pod spodem jest niebo) |

## Poprawki
1. **Glif AFR** (`#13302E`, ciemna morska zieleń) ginie w ciemnej obwódce Róży — 1,32:1, czyli w notkach typu
   „ANK 1 ▮1” sylwetka jest nieczytelna (widać to też na `v2/c/game-p.png`). Poprawka bez zmiany barwy regionu
   (D-08): w Róży glif AFR dostaje **jasny obrys kredowy `#F5F2EA`** zamiast ciemnego (12,6:1), a dopiero na nim
   zewnętrzną ciemną obwódkę 1 px (żeby obrys nie zlał się z pustynią). Alternatywa: rozjaśnić wypełnienie AFR do
   `#5E9C93` (5,89:1) — ale to zmienia barwę regionu we wszystkich widokach, więc odradzam.
2. **Glif NAM** (`#0072B2`) — 3,59:1. Ta sama zasada: jasny obrys `#F5F2EA` (4,64:1) albo w Róży jaśniejszy
   odcień `#3D9AD6` (6,02:1). Rekomendacja: reguła ogólna „glif, którego wypełnienie ma < 4,5:1 do `#0C1418`,
   dostaje kredowy obrys” — dotyczy dziś tylko AFR i NAM.
3. **Kreska startu łuku odliczania** (cynober 2 px bez obwódki) — dodać obwódkę `#0C1418` jak reszta łuku
   (pociągnięcie 2 + 3 = 5 px pod spodem, czyli 1,5 px z każdej strony) → 4,88:1.
4. **Cynober — zapas.** Wszystkie cynobrowe znaki przechodzą tylko dzięki obwódce i z zapasem 0,38. Przy
   antyaliasingu na ekranie DPR 1–1,5 obwódka 1,5 px łatwo „rozmywa się” do półtonu. Proponuję cynober
   **`#F2603F`** (5,78:1 na `#0C1418`; ta sama barwa, jaśniejsza o pół tonu) albo `#FF6A45` (6,55:1), a dla
   łuku odliczania obwódkę 7 → 8 px (2 px z każdej strony).
5. **DIM na niebie (poziom)** — czerń 50 % daje 3,42:1. Zmienić na **czerń 72 %** (`rgba(12,20,24,.72)`, 7,06:1)
   albo kryjący `#4A5559` (6,85:1). Minimum: 65 % (5,54:1).
6. **DIM na globie** przechodzi (5,64:1), ale bez zapasu na antyaliasing przy 12,5 px regular. Proponuję kredę
   **62 %** (6,87:1) — wyłączony przycisk nadal czyta się jako przygaszony.
7. **Szerokość obwódki.** Dla tekstu 12–12,5 px (cyfry tarczy, „dzień 2 z 3”, podpisy doku: `hw` 2,6–2,8 =
   1,3–1,4 px na zewnątrz) podnieść do **`hw` 3,2** (1,6 px), jak w notkach. Kreski róży i pierścienie mają
   obwódkę ~1,1 px — wystarczy, ale nie mniej; przy zagęszczeniu róży huba (36+ kresek) nie zwężać obwódki, tylko
   łączyć kreski (2–3 miejsca na kreskę, jak już przewiduje karta).
8. **Napisy bez obwódki na niebie** („Tydzień 1”, „Airway”, pauza) są poprawne (9,67:1) tylko dopóki leżą na
   niebie. Jeśli kamera (pion, foldable, mały ekran) przesunie glob pod nie, czerń spadnie do ~1:1 na nocy. Dać im
   jasną obwódkę `#EEF3F2` 3 px jak tarczy w poziomie — na niebie jest niewidoczna (1,72:1 do nieba), a na nocy
   ratuje odczyt.
9. **Sylwetka.** Ciemna obwódka nie odcina znaku od nocy (1,01:1) — to akceptowalne, bo kreda sama ma tam ≥ 16:1,
   ale cynober na nocy trzyma się wyłącznie na barwie (red vs `#000201` ≈ 5,5:1 — przechodzi). Nie trzeba jasnej
   obwódki dla cynobru.

## Wniosek
Kredowa farba Róży z ciemną obwódką spełnia D-47 na każdym tle z bardzo dużym zapasem (16,6:1). Do poprawy przed
implementacją: glify AFR i NAM (obrys kredowy), kreska startu łuku (obwódka), DIM na niebie (72 %), a profilaktycznie
jaśniejszy cynober `#F2603F`, DIM 62 % i obwódka 3,2 dla tekstu 12–12,5 px. Pomiar dotyczy makiet; po wdrożeniu
powtórzyć go na prawdziwej grze (`npm run shots:34` / `test:store-shots`, jak w D-47).
