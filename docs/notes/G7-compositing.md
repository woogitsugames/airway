# G7: `--disable-gpu-compositing` na prawdziwym rendererze (pomiar, night-12bk)

Dla sesji ext (globus, G7). Tylko pomiar — żadne domyślne ustawienia, flagi testów prawdziwego renderera ani
zatwierdzone zrzuty nie zostały zmienione.

## Tło

PR #254 (night-12bj) dodał `SOFTWARE_COMPOSITING_ARGS = ['--disable-gpu-compositing']`
(`scripts/lib/harness.mjs`) dla przebiegów na stub-świecie: kompozycja strony schodzi z emulowanego GPU
(SwiftShader) na CPU i `ui:matrix:stub` spadł z 204 s do 31 s. Pytanie: czy ta sama flaga pomaga prawdziwemu
globusowi WebGL?

## Jak mierzono

- Maszyna: kontener 4 vCPU, SwiftShader (ANGLE/Vulkan, Subzero), Chromium headless shell 1243 (Playwright 1.63).
  Równolegle Agent #1 puszczał testy w `/workspace/11ax` — **load average 4–7,7** przy wszystkich pomiarach (podany
  przy każdym wierszu). Liczby porównywać tylko parami z tej tabeli, nigdy z urządzeniami.
- `perf:scene`: skrypt bez zmian; flaga przez `CHROMIUM_PATH` wskazujący na wrapper
  `exec …/chrome-headless-shell --disable-gpu-compositing "$@"` (bazowy przebieg przez identyczny wrapper bez flagi,
  ta sama binarka). Preset `medium` (domyślny) 2 × 60 s na wariant, naprzemiennie; `low` 1 × 40 s.
- `test:e2e:smoke`: `node e2e/smoke.mjs` z tym samym wrapperem, 2 przebiegi na wariant.
- Komórki `ui:matrix`: nowy skrypt pomiarowy `scripts/research/compositing-probe.mjs` (`capture <dir> [--soft]`)
  przechodzi menu → gra → plansza tygodnia → koniec gry jak `ui:matrix` dla PL 412×915@1 i PL 904×1088@2, mierzy każdy
  krok i zrzut, PNG do katalogu tymczasowego (nie `docs/shots/`); `diff <A> <B>` liczy różnicę pikseli. 2 przebiegi na
  wariant, naprzemiennie (bez, z, bez, z).

## Wyniki

| Pomiar | bez flagi (GPU compositing) | z `--disable-gpu-compositing` | load 1 min |
|---|---|---|---|
| `perf:scene` medium 60 s — klatki/s | 2,08 / 1,98 | 1,66 / 1,71 (−16 %) | 3,2–7,7 |
| `perf:scene` medium — średni odstęp klatek | 177 / 190 ms | 244 / 247 ms | |
| `perf:scene` medium — p95 CPU renderu | 13,3 / 11,3 ms | 12,3 / 9,0 ms | |
| `perf:scene` medium — próbki odczytu w 60 s | 60 / 60 | 34 / 35 (każde `page.evaluate` ~0,8 s dłużej) | |
| `perf:scene` low 40 s — klatki/s | 4,57 | 4,28 (−6 %) | 6,4–7,2 |
| `test:e2e:smoke` (9/9 PASS w obu) | 26,7 s / 26,3 s | 63,8 s / 61,0 s (**×2,3**) | 5,8–7,6 |
| Komórka 412×915@1 — cała | 28,3 s / 26,7 s | 26,5 s / 26,6 s | 4,1–5,8 |
| Komórka 904×1088@2 — cała | 55,9 s / 50,1 s | 53,4 s / 47,1 s | |
| 412×915@1 — suma 4 zrzutów | 15,8 s / 14,3 s | 4,7 s / 5,2 s (**×3 szybciej**) | |
| 904×1088@2 — suma 4 zrzutów | 34,8 s / 29,9 s | 14,9 s / 13,2 s (×2,3 szybciej) | |
| 412×915@1 — 2 kliknięcia (`clickTestId`) | 2,0 s / 2,5 s | 11,4 s / 11,6 s (**×5 wolniej**) | |
| 904×1088@2 — 2 kliknięcia | 1,8 s / 2,9 s | 25,0 s / 22,5 s (**×10 wolniej**) | |
| rAF/s na ekranie końca gry 412 / 904@2 | 5,7–6,7 / 2,3–4,3 | 5,3–6,0 / 2,7–4,0 | |

### Piksele

| Para | zmienione piksele | > 8 poziomów | maks. różnica kanału |
|---|---|---|---|
| bez flagi vs bez flagi (szum) | gra 0 %, koniec gry 0,9–2,7 %, menu/plansza ≤ 0,24 % | ≤ 0,08 % | 1 (gra/koniec), do 227 w animowanym menu |
| z flagą vs z flagą (szum) | 0 % poza menu (≤ 0,36 %) | ≤ 0,19 % (menu) | 0 poza menu |
| **bez flagi vs z flagą** | **gra 17,7 % / 60,2 %, koniec gry 37 % / 53 %, plansza 20 % / 33 %, menu 1,6 % / 26 %** (412 / 904@2) | 0–0,7 % | 20–234 |

Flaga zmienia piksele deterministycznie (powtarzalnie między przebiegami): duża część globusa przesuwa się o 1–8
poziomów (inna ścieżka mieszania/konwersji koloru warstwy WebGL), na oko nie do odróżnienia. Większe różnice (> 8,
0–0,7 % pikseli) to głównie inny stan gry w chwili zrzutu (np. zegar 02:01 vs 02:08, bo wolniejsze kliknięcia
przesuwają czas), nie artefakty. Każdy zatwierdzony zrzut z prawdziwym globusem (`docs/shots/matrix/`, `store:shots`,
progi pikselowe testów) po włączeniu flagi trzeba by wygenerować od nowa.

## Wniosek

Na prawdziwym rendererze flaga **nie rozwiązuje G7**, a tam, gdzie G7 boli (kliknięcia w kartę tygodnia przy
~10 rAF/s), wręcz szkodzi:

- Kompozycja nie jest wąskim gardłem globusa: rAF i klatki `perf:scene` zostają takie same albo spadają (−6…−16 %),
  bo SwiftShader dalej rysuje WebGL, a wynik canvasu trzeba co klatkę kopiować z „GPU” do kompozytora programowego.
- Zrzuty przyspieszają ×2–3 (tylko one zyskują), ale kliknięcia Playwrighta (sprawdzanie stabilności i trafienia
  wymaga klatek kompozytora) zwalniają ×5–10, więc `test:e2e:smoke` trwa ×2,3 dłużej, a komórki `ui:matrix` wychodzą
  na zero. Hipoteza przyczyny (kopiowanie canvasu WebGL przy każdej klatce kompozytora) — niezweryfikowana.
- Zmienia piksele 18–60 % zrzutów globusa i odcina porównywalność z historycznymi liczbami `perf:scene`.

**Rekomendacja:** zostawić `SOFTWARE_COMPOSITING_ARGS` wyłącznie dla stub-świata (jak w #254); prawdziwy renderer,
`perf:scene`, `store:shots` i `docs/shots/matrix/` — bez flagi. Dla G7 szukać zysku po stronie sceny (rozdzielczość
canvasu / DPR w testach, preset `low` dla zautomatyzowanej przeglądarki, dłuższy limit kliknięcia w karcie tygodnia),
nie kompozytora. Ewentualny wyjątek do rozważenia przez sesję ext: jednorazowe przebiegi tylko ze zrzutami (bez
kliknięć) na przeciążonej maszynie — ale wtedy z nowymi wzorcami pikseli.

Odtworzenie: `node scripts/research/compositing-probe.mjs capture <dir> [--soft]`, `… diff <dirA> <dirB>`;
`perf:scene` z flagą: `CHROMIUM_PATH=<wrapper z --disable-gpu-compositing> npm run perf:scene`.
