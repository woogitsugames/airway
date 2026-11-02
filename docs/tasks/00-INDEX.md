# Zlecenia produkcyjne Airway — spis i kolejność

Każdy plik `NN-*.md` to brief dla **jednej nowej sesji** agenta z dostępem do repozytorium `woogitsugames/airway`.
Sesja pracuje na gałęzi `task/NN-...`, wypycha ją i otwiera **draft PR do `dev`**. Scala właściciel (po przejrzeniu PR-a).

## Jak uruchamiać

1. Najpierw **tylko 01** (zakłada gałąź `dev` z dorobku etapu 0 i szkielet). Scal jego PR do `dev`.
2. Potem fale po kolei. Zlecenia w jednej fali można uruchomić **równolegle** (różne pliki). Następną falę zaczynaj, gdy
   PR-y poprzedniej, od których zależy, są scalone — inaczej sesja musi pracować na atrapach.
3. Po scaleniu fal 0–6 uruchom **30** (integracja i przekazanie).
4. Do każdej sesji wklej treść jednego pliku (albo napisz: „Wykonaj zlecenie z pliku `docs/tasks/NN-....md` w repozytorium”).

## Fale

### Fala 0 — Fundament
| Nr | Zlecenie | Gałąź | Zależy od |
|---|---|---|---|
| 01 | [Szkielet projektu, gałąź `dev`, architektura](01-scaffold.md) | `task/01-scaffold` | — |

### Fala 1 — Rdzeń
| Nr | Zlecenie | Gałąź | Zależy od |
|---|---|---|---|
| 02 | [Rdzeń symulacji: RNG, zegar, polecenia, replay](02-core-sim-kernel.md) | `task/02-core-sim-kernel` | 01 |
| 03 | [Renderer globusa Diorama (produkcyjny)](03-globe-renderer.md) | `task/03-globe-renderer` | 01 |
| 05 | [Dane miast i generator pojawiania się miast](05-cities-data.md) | `task/05-cities-data` | 01 |

### Fala 2 — Świat i symulacja
| Nr | Zlecenie | Gałąź | Zależy od |
|---|---|---|---|
| 04 | [Kamera i gesty jedną ręką](04-camera-input.md) | `task/04-camera-input` | 03 |
| 06 | [Lotniska w świecie i warstwa dymków (przywieszki)](06-airports-overlay.md) | `task/06-airports-overlay` | 03, 05 |
| 08 | [Symulacja: popyt, pasażerowie, przesiadki, huby, porażka](08-sim-passengers-hubs.md) | `task/08-sim-passengers-hubs` | 02, 05 |
| 09 | [Symulacja: samoloty, rozkład, typy, zasięg](09-sim-planes.md) | `task/09-sim-planes` | 02, 05 |

### Fala 3 — Rozgrywka na ekranie
| Nr | Zlecenie | Gałąź | Zależy od |
|---|---|---|---|
| 07 | [Rysowanie tras palcem](07-route-drawing.md) | `task/07-route-drawing` | 04, 06, 08 |
| 10 | [Render tras i samolotów](10-render-routes-planes.md) | `task/10-render-routes-planes` | 03, 09 |
| 11 | [Dzień i noc: słońce, fale popytu, cisza nocna](11-day-night.md) | `task/11-day-night` | 02, 03 |
| 13 | [HUD: karta pokładowa, dok z przywieszek, pion/poziom/składane](13-hud.md) | `task/13-hud` | 01, 06 |

### Fala 4 — Pętla gry i ekrany
| Nr | Zlecenie | Gałąź | Zależy od |
|---|---|---|---|
| 12 | [Tydzień i wybór ulepszenia (etykiety frachtowe)](12-weekly-upgrade.md) | `task/12-weekly-upgrade` | 08, 09, 13 |
| 14 | [Menu główne: tablica odlotów split-flap](14-menu.md) | `task/14-menu` | 01, 03 |
| 15 | [Ekran porażki i raport przyczyn](15-game-over.md) | `task/15-game-over` | 08, 13 |
| 16 | [Zapis, wczytanie, pauza w tle](16-save-lifecycle.md) | `task/16-save-lifecycle` | 02, 08, 09 |
| 19 | [Dźwięk: „Rezonujące huby” i efekty](19-audio.md) | `task/19-audio` | 08, 09 |
| 20 | [Dostępność: daltoniści, tekst, czytniki, haptyka](20-accessibility.md) | `task/20-accessibility` | 06, 13 |

### Fala 5 — Treść i jakość
| Nr | Zlecenie | Gałąź | Zależy od |
|---|---|---|---|
| 17 | [Tryb Zadania: 15 zagadek z celem](17-puzzle-mode.md) | `task/17-puzzle-mode` | 07, 08, 09, 12 |
| 18 | [Wyzwanie dnia (offline)](18-daily-challenge.md) | `task/18-daily-challenge` | 02, 14, 16 |
| 21 | [Wydajność: budżety, presety, test urządzeń](21-performance.md) | `task/21-performance` | 10, 11, 06 |
| 22 | [Bot i balans: długość sesji i uczciwa porażka](22-bot-balance.md) | `task/22-bot-balance` | 08, 09, 12 |
| 23 | [Samouczek: pierwsze 3 minuty](23-onboarding.md) | `task/23-onboarding` | 07, 13, 12 |

### Fala 6 — Wydanie
| Nr | Zlecenie | Gałąź | Zależy od |
|---|---|---|---|
| 24 | [Build Android](24-android-build.md) | `task/24-android-build` | 01, 16 |
| 25 | [Build iOS](25-ios-build.md) | `task/25-ios-build` | 01, 16 |
| 26 | [Zrzuty i teksty do sklepów](26-store-assets.md) | `task/26-store-assets` | 13, 14, 12, 15 |
| 27 | [Monetyzacja: przygotowanie pod reklamy i wersję płatną (wyłączone)](27-monetization-gate.md) | `task/27-monetization-gate` | 14, 17 |
| 28 | [Testy e2e i macierz ekranów](28-e2e-smoke.md) | `task/28-e2e-smoke` | 13, 14, 15, 16 |
| 29 | [Strona airway.games](29-landing-page.md) | `task/29-landing-page` | 14 |

### Fala 7 — Domknięcie
| Nr | Zlecenie | Gałąź | Zależy od |
|---|---|---|---|
| 30 | [Integracja, przegląd i przekazanie](30-integration-review.md) | `task/30-integration-review` | (wszystkie scalone) |

## Zasady wspólne (powtórzone w każdym zleceniu)
- Repo `woogitsugames/airway`; inne repozytoria tylko do czytania.
- Gałąź bazowa `dev`; nigdy push do `dev`/`main` (wyjątek: zlecenie 01 zakłada `dev`); PR jako draft; bez scalania.
- Zasady projektu w `CLAUDE.md`, decyzje w `docs/DECISIONS.md`, styl w `docs/styles/diorama.md`.
- Symulacja deterministyczna i czysta (`src/sim`, D-13), testy na stałym seedzie z linią `SUMMARY`.
- Raport po polsku w opisie PR-a: co zrobione, wyniki testów, zrzuty, pytania do właściciela.

## Decyzje, które należą do właściciela (zlecenia je oznaczą, ale nie rozstrzygają)
- ~~appId~~ → `pl.samsufi.airway` (D-15).
- ~~Model biznesowy~~ → na razie darmowa, reklamy i wersja płatna później (D-16); wybór wtyczek IAP/reklam — później.
- ~~Podtytuł~~ → „Airway: Globe Route Builder” (D-18).
- Polityka prywatności i wdrożenie strony — zlecenie 29.
- ~~Cisza nocna~~ → od tygodnia 4 w trybie bez końca, zawsze w zadaniach (D-17).

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
