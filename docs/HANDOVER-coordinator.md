# Handover koordynatora → poprzednia sesja koordynatora

Dla: sesji koordynatora, która scaliła PR #30, #32, #33 i której limit się zresetował.
Od: sesja `session_01SPCeEKoCNFa2kVSBjiNFJa` (gałąź `claude/peaceful-fermi-ep2iz7`), 2026-11-02 ok. 21:30 UTC.

## TL;DR
Kolejka P1–P3 (zlecenia 31–36) jest **zamknięta**: wszystko scalone do `dev` merge commitami, każde po pełnej bramce
testów na scalonym drzewie. `origin/dev` = `cb5ccf5` („[36] Real store screenshots (#37)”). Nic nie jest w toku,
nie ma niewypchniętych zmian ani otwartych draft PR-ów z tej kolejki. `main` nie był ruszany.

## Co zostało scalone
| Zlecenie | PR | Decyzja | Scalił |
|---|---|---|---|
| 31 Tydzień = 3 doby + balans | #32 | D-43 | Ty (razem z 35, commit 329cd15) |
| 35 Karta ulepszenia + poprawki ekranów | #33 | D-45 | Ty |
| 33 Globus: siatka, teren, dekoracje | #34 | D-44 | ja → 3be12c9 |
| 32 Egzekwowanie slotów startów | #35 | D-46 | ja → 269b1b2 |
| 34 Noc i kadr kamery (HUD-aware) | #36 | D-47 | ja → e9908c2 |
| 36 Prawdziwe zrzuty do sklepów | #37 | D-48 | ja → cb5ccf5 |

Kolejność była: 33 ‖ 32 → scal 33 → 34 → scal 32 → scal 34 → 36 → scal 36.

## Bramka przy każdym scaleniu (wyniki na scalonym drzewie)
- **#34 [33]:** test:fast 40/40, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:land 60 kontroli / 0 błędów,
  test:balance ok.
- **#35 [32]:** test:fast 41/41, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:balance ok, test:slots 5/5,
  test:replay 20/20, test:hud-targets 151/151.
- **#36 [34]:** test:fast 41/41, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:render-layers 33/33,
  test:hud-targets 151/151, test:balance ok, test:land ok.
- **#37 [36]:** test:fast 41/41, build ok, e2e:smoke 9/9, ui:matrix 32/32, test:store-shots 30 zrzutów ok.

## Stan zasad i balansu na `dev`
- `RULES_VERSION = 4` (`src/sim/state.ts`): 3 po zleceniu 31, 4 po zleceniu 32.
- `test:balance` (50 seedów, bot): mediana 12,92 min, 86% gier do 1. ulepszenia, 44% do 2. (progi: 8–15 min,
  ≥60%, ≥30%). Wynik ten sam po 32 i po 34, bo sloty 2/h miasto i 3/h hub rzadko blokują bota (9/50 gier).
- Długość tygodnia: jedno źródło `SIM_DAYS_PER_WEEK = 3` (`src/sim/params.ts`), pilnuje go `test:week-source`.

## Zrzuty, które obejrzałam przy scalaniu
- `docs/shots/33/world-medium-*` obok `mockups/diorama/png/game-p.png`: zgodne z makietą.
- `docs/shots/32/hint-*`, `board-*`: pasek ATC o slotach i karta „Sloty startowe”.
- `docs/shots/34/night-*`, `menu-*`: noc czytelna, menu jak na makiecie.
- `docs/store/contact-sheet.png`: wszystkie 30 zrzutów do sklepów.
- Glify pasażerów wszędzie tylko z sześciu kształtów D-08. Żółte romby na globusie to znaczniki lotnisk, nie glify
  pasażerów. Nic z listy zakazów z CLAUDE.md.

## Do zrobienia dalej (propozycja kolejnego zlecenia)
1. **Poprawki UI widoczne w zrzutach sklepowych** (przed publikacją):
   - karta ulepszenia, telefon, PL: „Szerokokadłubowiec” łamie się w środku słowa (`src/ui/upgrade/**`);
   - menu na 360 px: nagłówki „BRAMKA” i „STATUS” zlewają się w „BRAMKASTATUS”.
   Potem `npm run store:shots` i `npm run test:store-shots`, commit nowych PNG.
2. **Odświeżenie zrzutów referencyjnych:** `docs/shots/matrix/` i `docs/shots/13/` agenci celowo nie commitowali
   (różnią się bajtowo przy każdym przebiegu). Jeden commit z `npm run ui:matrix` na świeżym `dev`.
3. **Przywieszka „SLOT 0:12” przy lotnisku na globusie:** dane są już w `CityView`, brakuje API w overlayu
   lotnisk. Zgłoszone w PR #35.
4. **Pomiar wydajności na prawdziwym słabym Androidzie (Mali):** zlecenie 33 podniosło liczbę trójkątów w klatce
   (medium: 229 tys. → 424 tys.). Średni czas klatki w SwiftShader +30%, p95 bez zmian.
5. Drobne:
   - jedna klatka bez insetów przy pierwszym pokazaniu menu (34);
   - pustynie nocą dość jasne (34);
   - „ATC ·RAPORT”: metryka kropki w kroju Overpass (35);
   - po wybraniu „Rozbudowa huba” nie da się wrócić do kart, bo sim nie ma komendy anulowania (35).

## Decyzje czekające na właściciela (zebrane z raportów agentów)
- **31:** etykieta doby „N/3” zamiast nazw dni; 7,2 min do 1. ulepszenia przy 1× zamiast 4–5 min z D-40 (skrócenie
  wymaga zmiany skali czasu); nowe miasto co 16 h i poczekalnie hub/miasto 36/24 (łagodniej: 14 h).
- **35:** „2500” czy „2 500” w polskich liczbach (`Intl` daje „2500”); stempel huba kodem lotniska czy nazwą miasta;
  karta „Rozbudowa huba” wyłączona, gdy nie ma huba.
- **33:** gęstość lądu na medium (ok. 200 tys. trójkątów teraz, ok. 350 tys. jak na makiecie w kadrze menu); cienie
  chmur na low.
- **32:** limit 2/h miasto i 3/h hub (4/6 ze zlecenia nigdy nie blokuje); „+2 sloty” dla jednego wybranego lotniska;
  czy zlecić przywieszkę slotu przy lotnisku.
- **34:** dekoracyjna sieć tras w menu; jasność nocy (`MOON_INTENSITY` w `daynight.ts`); globus w menu stoi (wcześniej
  obracał się 1,2°/s).
- **36:** kolejność zrzutów (zmierzch, noc, ulepszenie, porażka, menu) i podpisy. Moja uwaga: „zmierzch” na zrzutach
  wygląda prawie jak dzień.

## Procedura scalania, której używałam (gdybyś kontynuował(a) tę rolę)
1. `git fetch origin && git worktree add --detach ../wt-merge origin/dev && cd ../wt-merge`.
2. `git merge --no-ff origin/task/NN-...`. Konflikty w `docs/DECISIONS.md`, `docs/TESTING.md`, `package.json`:
   zachowaj linie obu stron.
3. `npm ci && npm install --no-save playwright@1.63.0`.
4. Uruchom:
   - zawsze: `test:fast`, `build`, `test:e2e:smoke`, `ui:matrix`;
   - testy ze zlecenia;
   - `test:balance`, jeśli zmieniał się sim.
   WebGL headless przez SwiftShader: `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
5. Obejrzyj PNG zlecenia obok makiet i listy zakazów.
6. Zdejmij draft (`update_pull_request draft:false`), potem `merge_pull_request merge_method: merge`.
   W `commit_message` wpisz wyniki bramki.

## Środowisko tej sesji (do sprzątnięcia, nic tam nie ginie)
Worktree w `/home/user/wt-3{1..6}-*` są czyste i zgodne z `origin`. Kontener tej sesji zniknie; wszystko jest
na GitHubie.
