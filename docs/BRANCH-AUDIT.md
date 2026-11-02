# Audyt gałęzi — woogitsugames/airway (2026-11-02, 23:25 CET)

Stan: `main` = `dev` = `b7b0301`. „Scalona” oznacza, że ostatni commit gałęzi jest już w `dev` (`git merge-base --is-ancestor`),
więc jej usunięcie **nie traci żadnej pracy**. Daty to ostatni commit (UTC).

## Zostaw

| Gałąź | Dlaczego |
|---|---|
| `main` | domyślna gałąź; podąża za zielonym `dev` (D-64) |
| `dev` | gałąź integracyjna; wszystkie PR-y zleceń idą do niej |
| `claude/peaceful-fermi-ep2iz7` | **niescalona**: 7 commitów z `docs/HANDOVER-coordinator.md` (raport drugiej sesji koordynatora). Usuń dopiero po przeniesieniu tego pliku do `dev` (albo jeśli nie jest potrzebny) |
| `task/37-…`, `task/38-…`, `task/39-…`, `task/40-…` | jeszcze nie istnieją; pojawią się, gdy druga sesja zacznie zlecenia 37–40 — nie usuwać w trakcie |

## Można usunąć (wszystko scalone do `dev`)

### Etap 0 i integracja
| Gałąź | Ostatni commit | Co to było |
|---|---|---|
| `claude/adoring-bell-uoqsxa` | 2026-11-02 16:29 | etap 0: research, makiety, decyzje (wszedł do `dev` przy zakładaniu gałęzi) |
| `integration/merge-train` | 2026-11-02 18:46 | integracja zleceń 02–29 (PR #30) |
| `docs/polish-tasks` | 2026-11-02 18:59 | paczka zleceń 31–36 (PR #31) |
| `docs/owner-decisions-3` | 2026-11-02 22:21 | decyzje D-60–D-64 (PR #38) |
| `docs/branch-audit` | — | ta lista (po scaleniu PR-a z tym plikiem) |

### Zlecenia 01–29 (pierwsza paczka)
`task/01-scaffold`, `task/02-core-sim-kernel`, `task/03-globe-renderer`, `task/04-camera-input`, `task/05-cities-data`,
`task/06-airports-overlay`, `task/07-route-drawing`, `task/08-sim-passengers-hubs`, `task/09-sim-planes`,
`task/10-render-routes-planes`, `task/11-day-night`, `task/12-weekly-upgrade`, `task/13-hud`, `task/14-menu`,
`task/15-game-over`, `task/16-save-lifecycle`, `task/17-puzzle-mode`, `task/18-daily-challenge`, `task/19-audio`,
`task/20-accessibility`, `task/21-performance`, `task/22-bot-balance`, `task/23-onboarding`, `task/24-android-build`,
`task/25-ios-build`, `task/26-store-assets`, `task/27-monetization-gate`, `task/28-e2e-smoke`, `task/29-landing-page`

### Zlecenia 31–36 (paczka poprawkowa)
`task/31-week-3-days`, `task/32-departure-slots`, `task/33-globe-detail`, `task/34-night-framing`,
`task/35-upgrade-card`, `task/36-store-shots-real`

**Razem do usunięcia: 40 gałęzi** (5 etap 0/integracja/dokumenty + 29 + 6).

## Jak usunąć

Najprościej na GitHubie: **Settings → General → Pull Requests → „Automatically delete head branches”** (na przyszłość),
a dla istniejących: zakładka **Branches** → kosz przy gałęzi. Albo jednym poleceniem (z dowolnego klonu):

```bash
git push origin --delete claude/adoring-bell-uoqsxa integration/merge-train docs/polish-tasks docs/owner-decisions-3 \
  task/01-scaffold task/02-core-sim-kernel task/03-globe-renderer task/04-camera-input task/05-cities-data \
  task/06-airports-overlay task/07-route-drawing task/08-sim-passengers-hubs task/09-sim-planes \
  task/10-render-routes-planes task/11-day-night task/12-weekly-upgrade task/13-hud task/14-menu task/15-game-over \
  task/16-save-lifecycle task/17-puzzle-mode task/18-daily-challenge task/19-audio task/20-accessibility \
  task/21-performance task/22-bot-balance task/23-onboarding task/24-android-build task/25-ios-build \
  task/26-store-assets task/27-monetization-gate task/28-e2e-smoke task/29-landing-page task/31-week-3-days \
  task/32-departure-slots task/33-globe-detail task/34-night-framing task/35-upgrade-card task/36-store-shots-real
```

Uwaga: `docs/tasks/*.md` odwołują się do nazw gałęzi `task/NN-…` tylko jako instrukcji dla sesji — po scaleniu nie są
potrzebne. Historia każdego zlecenia zostaje w `dev`/`main` (merge commity i PR-y #1–#38 na GitHubie).
