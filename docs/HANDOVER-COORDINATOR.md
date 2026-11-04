# Przekazanie koordynatora Airway

Ostatnia aktualizacja: 2026-11-04, ok. 18:00 UTC. Poprzednia sesja kończy pracę, bo wyczerpał się tygodniowy limit.

## Stan repo
- `main` = `dev` = `a902909` po scaleniu #201.
- Ostatnie scalone PR-y:
  - #194 plan smoke;
  - #195 tablica i samouczek przy notchu;
  - #196 znak wyboru huba;
  - #197 eksport/import tłumaczeń (N12ah);
  - #198 limity długości i18n + `?pseudo=harsh` + `test:e2e:pseudo-320` (N11ac, D-213);
  - #199/#200 prompt startowy i handover;
  - #201 nazwy miast z Wikidata (N12ai, D-217; plus D-215 Q-80 i D-216 Q-79);
- Ostatnie numery: decyzja **D-217** (następna wolna to D-218), pytanie **Q-80**. D-160…D-179 należą do sesji ext.
- Budziki :15 i :45 koordynatora są **wyłączone**:
  - `trig_01FNqUvAkWFVY9Jj8XnYzoXr`;
  - `trig_013Ke8JAt631r4TpcSEpMBqm`.

  Nowa sesja ustawia własne.

## Niedokończona praca (dokończ najpierw)
1. **N11ad / R7k: pakiet startowy strony.** WIP jest na `night/11ad-site-launch-pack` (commit `ad0a123`). Nie ma PR
   i nie przeszedł bramki.
   - **Gotowe:**
     - prawdziwe zrzuty 540×960 PL/EN ze skryptu `site/make-assets.mjs`;
     - wyłączone placeholdery sklepów w `site/launch.js`;
     - og:image, canonical, hreflang, karta twitter;
     - strona `404.html`;
     - `test:site` 272/272.
   - **Zostało:**
     - skrypt `site:assets` w `package.json`;
     - wpisy w `docs/SITE.md`, `docs/ASSETS.md` i `docs/TESTING.md`;
     - decyzja D-218;
     - pozycja w backlogu i linia w Logu;
     - scalenie z `dev`, potem `test:fast` + build i PR.
2. **N12ai / R7j — nazwy miast z Wikidata** — scalone w #201.
3. **N12aj: seedy ze stałą datą dla daily-share i daily-continue.** Nie zaczęte.
4. **R2e: strona dla prasy (`site/press.html`).** Nie zaczęte.

## Znane problemy
- **G7:** pod SwiftShader nowy glob chodzi w ~10 fps. Przez to padają lub nie mieszczą się w czasie `ui:matrix`,
  `e2e:smoke`, `store:shots` i `edge-chip-tags`. Naprawia to **sesja ext od globu**, nie nasi agenci (decyzja
  właściciela).
- Zrzuty w `docs/store/shots` są nieaktualne: scena porażki ma stary napis „SIATKA WSTRZYMANA”. Po G7 uruchom
  ponownie `store:shots`, a potem `site:assets`.
- W tekście strony (`about.p1` w `site/i18n.js`) zostało słowo „terminal”. Ma być „hub” zgodnie z glosariuszem D-195.
- Canonical dla wersji językowych strony ustawia dopiero JS. Lepiej wygenerować osobne strony `/pl/` i `/en/`.

## Kolejka (backlog `docs/NIGHT-BACKLOG.md`, pozycje `[ ]`)
- **Agent #1 (UI):**
  - R2e;
  - R4c — strzałka trendu zapełnienia;
  - R4d — tablica przyczyn zatoru huba;
  - R4g — klawiatura i mysz;
  - R2g — wybór regionu w Endless;
  - R1g — skala tekstu do 150 %;
  - R7a/R7b/R7c — polityka prywatności, regulamin, dane wydawcy;
  - R7l — przełącznik „wysyłaj wyniki dnia” w ustawieniach.
- **Agent #2 (platforma):**
  - N12aj;
  - R1f, R1i, R1k, R1l, R1o, R2c, R2f, R3d, R3e, R3i, R3j, R3k, R6g, R6i, R7d;
  - R4f — matryca dużych ekranów (po G7).
- **Nie bierz:**
  - kroków G i `src/render/**` (to robi sesja ext/03);
  - zagadek (sesja ext/04+);
  - N9d (czeka na #52).

## Sprawy tylko dla właściciela
- Q-01 — administrator danych.
- Q-07 — projekt i budżet Firebase.
- Konsultacja z prawnikiem.
- Testy na urządzeniach. W zamkniętym teście do sprawdzenia:
  - Q-73 — tempo;
  - Q-78;
  - Q-80 — karta „+2 miejsca”.

## Zasada aktualizacji
Ten plik aktualizuj po każdym scaleniu i przy każdej zmianie stanu agentów: krótki PR do `dev`, self-merge, potem
synchronizacja main.
