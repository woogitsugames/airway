# Handover koordynatora (zlecenia P1/P2)

Aktualizowane na bieżąco przez sesję koordynatora. Jeśli sesja się skończy, następna zaczyna od tego pliku.

## Stan (2026-11-02)
- Na `dev`: zlecenia 01–29, 31, 32, 33, 35 (PR #30, #32, #33, #34, #35). RULES_VERSION=4, test:balance po 32: mediana 12,92 min, 0,86/0,44. PR #34 [33] scalony przez koordynatora po pełnej bramce testów.
- **34 nocne kadrowanie** — w toku, gałąź `task/34-night-framing` z dev 3be12c9. D-47.
- **36 prawdziwe zrzuty do sklepów** — nie zaczęte; po scaleniu 32, 33, 34. D-48.

## Jak wznowić
1. Sprawdź draft PR-y `[32]`, `[33]` na GitHubie (sekcja „Stan / co dalej” w opisie).
2. Scalanie: świeży worktree z origin/dev → merge gałęzi zlecenia → konflikty w DECISIONS/TESTING/package.json
   (zachowaj obie strony) → `npm ci`, `npm install --no-save playwright@1.63.0` → test:fast, build, test:e2e:smoke,
   ui:matrix, test:balance + testy zlecenia → obejrzyj zrzuty (glify tylko 6 kształtów D-08) → push merge na gałąź
   zlecenia → zdejmij draft → merge commit do dev.
3. Po 32 i 34: sprawdź RULES_VERSION i test:balance (mediana 8–15 min, ≥60% / ≥30%).

## Decyzje czekające na właściciela
- z 32: limit 2/h miasto, 3/h hub; „+2 sloty” dla jednego lotniska; zlecić przywieszkę „SLOT 0:12” przy lotnisku (render/ui)?
- z 33: gęstość lądu medium (~200 tys. vs ~350 tys. jak makieta); cienie chmur na low; perf na prawdziwym Mali.
- z 31: etykieta doby „N/3”; 7,2 min do 1. ulepszenia (vs 4–5 min z D-40); parametry 16 h i 36/24.
- z 35: „2500” vs „2 500”; stempel huba kod vs nazwa miasta; karta huba wyłączona bez huba.
