import re, os, sys
src = open('docs/tasks/tools/gen_tasks.py').read()
COMMON = re.search(r'COMMON = """\\\n(.*?)"""', src, re.S).group(1)
COMMON = COMMON.replace("4. `docs/RESEARCH.md` (rdzeń gry §3, technika §4, MVP §5) oraz `docs/ARCHITECTURE.md` (powstaje w zleceniu 01).",
 "4. `docs/RESEARCH.md` (rdzeń gry §3), `docs/ARCHITECTURE.md` (sekcje „Sim API” i „Render API”), `docs/TESTING.md`.\n   Gra jest już zintegrowana na `dev` (PR #30): uruchom ją (`npm run dev`) i obejrzyj, zanim zaczniesz.")
COMMON = COMMON.replace("Przed pushem zawsze: `npm ci`, `npm run typecheck`, `npm run test:fast`,\n  `npm run build`.",
 "Przed pushem zawsze: `npm ci`, `npm run test:fast` (runner z jedną linią na krok) i `npm run build`;\n  jeśli zmieniasz rozgrywkę lub ekrany, także `npm run test:e2e:smoke` i `npm run ui:matrix`. Playwright + Chromium są\n  w środowisku (`npm install --no-save playwright@1.63.0`), WebGL przez SwiftShader (szczegóły w `e2e/README.md`).")
OUT = 'docs/tasks'
T = []
def task(nn, slug, title, title_en, deps, wave, body, files, accept, tests):
    T.append(locals())

task("31","week-3-days","Tydzień = 3 doby gry i ponowny balans","3-day week and rebalance",[], "P1","""\
Decyzja właściciela **D-40**: tydzień gry trwa **3 doby** (nazwa „Tydzień” zostaje). Teraz bot przeżywa tydzień 1 tylko na
ok. 5% seedów (patrz `docs/balance/`), więc wybór ulepszenia prawie się nie pojawia.

1. Jedno źródło prawdy dla długości tygodnia w `src/sim/params.ts` (dziś są dwa: `SIM_DAYS_PER_WEEK` i
   `DAYNIGHT_DAYS_PER_WEEK` — połącz je). Zegar, oferta ulepszeń, HUD (7 kwadratów doby → 3), cisza nocna od tygodnia 4
   (D-17, czyli od doby 10), zadania i wyzwanie dnia korzystają z tej stałej.
2. HUD (`src/ui/hud/**`): pasek doby z karty pokładowej pokazuje 3 pola; sprawdź teksty i18n („Tydzień N”, dni).
3. Balans (`src/sim/params.ts`, bot `src/game/dev/bot-policy.ts` bez zmian zasad): cel — **mediana sesji 8–15 min przy 1×**
   i **≥ 60% seedów bota dochodzi do pierwszego wyboru ulepszenia**, ≥ 30% do drugiego. Raport 50 seedów przed/po w
   `docs/balance/` (CSV + krótki opis), zaktualizuj `test:balance` (progi) i opis w D-39/D-40 (dopisz liczby).
4. Zadania (`src/data/puzzles/**`): przelicz cele na nowym tygodniu (reguła z 17: bez działań porażka, rozwiązanie
   referencyjne wygrywa z marginesem ≥ 15%); `test:puzzles` zielony.
5. Testy na stałym seedzie, które zakładały 7 dób (sim-week, replay, ui:matrix `WEEK_SEED`, store `upgrade`), zaktualizuj
   uczciwie — najlepiej tak, by stały „szczęśliwy” seed nie był już potrzebny (autoplay dochodzi do tygodnia 1 na typowym seedzie).
""","`src/sim/**`, `src/data/puzzles/**`, `docs/balance/**`, `scripts/test-*.{ts,mjs}` dla sim/balansu, `src/ui/hud/**` (tylko pasek doby), seedy w `e2e/smoke.mjs`, `scripts/ui-matrix.mjs`, `scripts/store-shots.mjs`",
"- `test:fast`, `test:balance`, `test:replay`, `test:puzzles`, `test:e2e:smoke`, `ui:matrix` zielone.\n- Raport balansu: mediana 8–15 min, ≥ 60% seedów do 1. ulepszenia, ≥ 30% do 2.\n- Zrzut HUD z 3 polami doby w `docs/shots/31/`.",
"aktualizacja istniejących; nowy test, że długość tygodnia ma jedno źródło (grep/import w `test:arch` lub osobny)")

task("32","departure-slots","Egzekwowanie slotów startów","Enforce departure slots",["31"],"P2","""\
Decyzja właściciela **D-41**: sloty startów (limit odlotów z miasta na godzinę gry, D-28) **blokują** odloty.

1. Sim: samolot gotowy do odlotu czeka na ziemi, aż w mieście zwolni się slot w bieżącej godzinie gry; kolejność odlotów
   deterministyczna (np. kolejność gotowości, remis po id). Czekanie wydłuża postój, nie zmienia zasad pasażerów.
   Parametry startowe w `params.ts` (np. 4 sloty/h w mieście, 6 w hubie — dobierz botem).
2. Ulepszenie **„+2 sloty”** w puli tygodnia (12): realny efekt dla wybranego miasta/huba (tryb wyboru jak przy rozbudowie
   huba). Księga przyczyn: nowa przyczyna „samoloty czekały na slot” dla raportu porażki (15) — klucze i18n PL/EN.
3. W świecie: przy lotnisku, gdy samoloty czekają, widać to (np. samolot stoi na płycie z małą przywieszką „SLOT 0:12”) —
   tylko jeśli da się zrobić czysto przez istniejące API renderu/overlay; inaczej zgłoś w PR jako prośbę dla render/ui.
4. Samouczek (23): jeden krótki krok o slotach dopiero, gdy pierwszy raz zablokują odlot (nie na starcie).
5. Balans ponownie (cele z zlecenia 31 muszą dalej być spełnione); raport w `docs/balance/`.
""","`src/sim/**`, `src/ui/upgrade/**` (opcja „+2 sloty”), `src/game/causes.ts`, `src/game/tutorial/**` (jeden krok), i18n (nowe klucze), `docs/balance/**`",
"- Test: przy limicie 1 slotu/h dwa samoloty z jednego miasta nie startują w tej samej godzinie.\n- „+2 sloty” zmienia przepustowość (test).\n- Cele balansu z 31 nadal spełnione; `test:fast`, `test:e2e:smoke`, `test:replay` zielone.",
"`test:slots`")

task("33","globe-detail","Globus jak na makiecie: drobna siatka, teren, dekoracje","Globe detail to match the mockup",[],"P1","""\
Zrzuty gry na `dev` (`docs/shots/integration/*.png`) mają **zbyt grubą siatkę**: duże płaskie trójkąty, schodkowa Sahara,
mało drzew. Cel: wygląd jak `mockups/diorama/png/game-p.png` i `menu-p.png` (porównuj zrzuty obok siebie).

1. Siatka adaptacyjna: gęsto przy wybrzeżach i w górach, rzadziej na otwartym morzu; brak „zębów” wybrzeża.
   Preset `medium` ma wyglądać jak makieta, `low` może być prostszy, ale bez schodków.
2. Wysokości i biomy: płynne przejścia (bez tarasów na pustyni), góry tam, gdzie są w rzeczywistości (Alpy, Atlas, Skandynawia,
   Andy, Himalaje — prosta maska gór generowana skryptem z danych publicznych lub ręcznie wpisane pasma), śnieg tylko na szczytach
   i w Arktyce. Czapa lodowa Arktyki bez szwu tekstury (w koncepcjach do sklepu był płaski szary dysk — tego nie chcemy).
3. Dekoracje instancjonowane: gęstość drzew i skał jak na makiecie przy zoomie gry; chmury z cieniem.
4. Budżet: trójkąty/draw calle w presetach zapisane w `docs/PERFORMANCE.md` przed/po; `perf:scene` bez regresji czasu CPU > 20%.
""","`src/render/globe/**`, `scripts/build-land.*`, `public/data/**`, `docs/PERFORMANCE.md`",
"- Zrzuty przed/po w `docs/shots/33/` (pion i poziom, zoom 1× i 2,5×) obejrzane i porównane z makietą.\n- `test:render-layers`, `test:geo-math`, `test:land` zielone; `perf:scene` z liczbami w PR.",
"`test:land` (rozszerz o kontrolę braku szwu/schodków, jeśli da się to zmierzyć)")

task("34","night-framing","Czytelna noc i kadrowanie kamery (menu, poziom)","Readable night and camera framing",["33"],"P2","""\
1. **Noc:** w widoku poziomym o 23:47 (`docs/shots/integration/route-drawing-l.png`) prawie nic nie widać. Strona nocna ma być
   ciemniejsza od dnia, ale czytelna: ląd i morze rozróżnialne (księżycowe światło z nieba, chłodna paleta), światła miast
   ciepłe, trasy, samoloty, lotniska i przywieszki zawsze czytelne (materiały UI niezależne od oświetlenia). Bez bloomu i neonów.
2. **Terminator:** wyraźna, ale miękka granica dnia i nocy; zmierzch/świt ciepłą barwą.
3. **Kadry:** menu (`menu-p.png` i `menu-l.png` na `dev`) — globus źle wykadrowany za tablicą i drogowskazem; ma wyglądać
   jak `mockups/diorama/png/menu-p.png` (horyzont z niebem u góry, sieć widoczna nad tablicą). W grze w poziomie kadr ma
   uwzględniać szynę HUD (prawy dok) i kartę pokładową (insety kamery z layoutu, nie stałe liczby).
""","`src/render/**` (oświetlenie, kamera, materiały), `src/game/world.ts` (tylko framing, oznacz `// [task-34]`)",
"- Zrzuty dzień/zmierzch/noc × pion/poziom oraz menu pion/poziom w `docs/shots/34/`, obejrzane.\n- Kontrast przywieszek i tras na nocy ≥ 4,5:1 (sprawdź próbką pikseli w teście lub opisz pomiar).",
"`test:render-layers` (rozszerz o insety kamery)")

task("35","upgrade-card","Karta ulepszenia jak na makiecie + drobiazgi UI","Upgrade card to mockup + UI polish",[],"P1","""\
1. Ekran ulepszenia tygodnia ma wyglądać jak `mockups/diorama/png/upgrade-p.png` i `upgrade-l.png`: żółty drogowskaz
   „Tydzień N” + podtytuł „Hangar: przyszły trzy skrzynie. Otwierasz jedną.”, etykiety frachtowe z nagłówkiem
   „FRACHT · TP-48 · 1/3”, **większe okienko z modelem 3D**, **tabela pól** (zasięg, miejsca, najlepszy do / dla huba:
   miejsca, przesiadka), czerwony stempel kontekstu tylko na karcie, której dotyczy, ząbkowana krawędź. Dane z sim (nie na sztywno).
2. Gdy dojdzie ulepszenie „+2 sloty” (zlecenie 32), karta ma na nie miejsce (wariant ikony i pól) — przygotuj układ.
3. Przegląd wszystkich ekranów na 412×915, 915×412, 673×841 i 904×1000 (`npm run ui:matrix`): popraw ucięte teksty,
   nachodzenia i cele dotyku < 48 dp. Lista poprawek w PR.
""","`src/ui/upgrade/**`, `src/ui/**` (tylko poprawki z punktu 3), i18n",
"- Zrzuty ekranu ulepszenia (pion, poziom, tablet) w `docs/shots/35/` obok makiety.\n- `ui:matrix`, `test:hud-targets`, `test:i18n` zielone.",
"`test:hud-targets` (dodaj ekran ulepszenia, jeśli nie ma)")

task("36","store-shots-real","Prawdziwe zrzuty do sklepów","Real store screenshots",["31","32","33","34","35"],"P3","""\
Dotychczasowa paczka podglądów do sklepów (koncepcje, nie gra) **nie może trafić do sklepów**: była narysowana poza grą
i miała kształty pasażerów z Mini Metro (trójkąt, koło), których nie używamy (D-08). Zastąp ją prawdziwymi zrzutami z gry.

1. `npm run store:shots` na scalonym `dev`: sceny gra o zmierzchu, ulepszenie, menu, porażka z raportem, noc ze światłami;
   PL + EN; telefon 1080×1920, składany, tablet. Sceny ustawiane uczciwie (prawdziwe polecenia/autoplay, bez podrabiania stanu).
2. Automatyczna kontrola każdego PNG: rozdzielczość, brak pustych/białych klatek, brak napisów deweloperskich; ręcznie
   obejrzyj wszystkie i porównaj z listą zakazów z `CLAUDE.md` (w tym: glify pasażerów tylko z sześciu kształtów D-08).
3. Teksty sklepu z zlecenia 26 (`docs/store/`) dopasuj do zrzutów; tytuł „Airway: Globe Route Builder” (D-18).
4. Arkusz kontaktowy wszystkich zrzutów w `docs/store/contact-sheet.png`.
""","`scripts/store-shots.mjs`, `docs/store/**`",
"- 30 prawdziwych PNG w `docs/store/shots/` + arkusz kontaktowy, obejrzane.\n- `store:shots` i `test:store-shots` zielone.",
"`test:store-shots` (rozszerz o kontrole z punktu 2)")

for t in T:
    branch = f"task/{t['nn']}-{t['slug']}"
    deps = ", ".join(t["deps"]) if t["deps"] else "brak (zacznij od razu)"
    common = COMMON.format(repo="woogitsugames/airway", base="dev", branch=branch, nn=t["nn"], title_en=t["title_en"],
        base_note="Zlecenia, od których zależysz, muszą być już scalone do `dev` (PR `[NN]` merged). Jeśli nie są — nie zaczynaj, zgłoś to.")
    md = f"""# Zlecenie {t['nn']} — {t['title']}

> Paczka poprawkowa (fala **{t['wave']}**, decyzja D-42). Projekt: **Airway** (airway.games). Zależy od zleceń: **{deps}**.
> Gałąź robocza: **`{branch}`** → draft PR do **`dev`**.

{common}
## Zadanie
{t['body']}
## Pliki, które są Twoje
{t['files']}

## Kryteria akceptacji
{t['accept']}

## Testy do dodania
{t['tests']}

## Poza zakresem
Wszystko, co należy do innych zleceń paczki (spis: `docs/tasks/00-INDEX.md`, sekcja „Paczka poprawkowa”).
"""
    open(os.path.join(OUT, f"{t['nn']}-{t['slug']}.md"), "w").write(md)

idx = open(os.path.join(OUT, '00-INDEX.md')).read()
idx += """
## Paczka poprawkowa (D-42) — po integracji #30

Uruchamiaj falami; w jednej fali równolegle. Każda sesja: gałąź `task/NN-...` z `dev`, draft PR do `dev`.

| Fala | Nr | Zlecenie | Gałąź | Zależy od |
|---|---|---|---|---|
| P1 | 31 | [Tydzień = 3 doby gry i ponowny balans](31-week-3-days.md) | `task/31-week-3-days` | — |
| P1 | 33 | [Globus jak na makiecie](33-globe-detail.md) | `task/33-globe-detail` | — |
| P1 | 35 | [Karta ulepszenia jak na makiecie + drobiazgi UI](35-upgrade-card.md) | `task/35-upgrade-card` | — |
| P2 | 32 | [Egzekwowanie slotów startów](32-departure-slots.md) | `task/32-departure-slots` | 31 |
| P2 | 34 | [Czytelna noc i kadrowanie kamery](34-night-framing.md) | `task/34-night-framing` | 33 |
| P3 | 36 | [Prawdziwe zrzuty do sklepów](36-store-shots-real.md) | `task/36-store-shots-real` | 31–35 |

Zlecenie 30 (integracja) zostało wykonane w sesji koordynatora (PR #30) — nie uruchamiaj go.
"""
open(os.path.join(OUT, '00-INDEX.md'), 'w').write(idx)
print(len(T))
