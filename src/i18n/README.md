# i18n catalogs (`en.ts`, `pl.ts`)

Every player-facing string lives here (PL + EN, same keys, same placeholders; plural tokens `{n|form|…}` in the
language's plural order). `npm run test:i18n` checks parity, placeholders, plural forms, unused keys and the glossary
below.

## Translator hand-off (R7i, D-211)

`npm run i18n:export -- de` writes `docs/i18n/de.json` (`--csv` for a spreadsheet): one row per key with the English
source, the Polish reference, the catalog comment as context, its `{param}`s, the length budget when one exists and
the target language's plural categories with sample numbers. The translator fills `translation`;
`npm run i18n:import -- de` checks the file and writes `src/i18n/de.ts`, or lists every problem and writes nothing.
Exporting again keeps translations whose English text did not change. Wave-1 languages (de, fr, es, pt = pt-BR) are
listed in `PLANNED_LANGUAGE_ENTRIES` of `languages.ts`; a language ships only when it joins `LANGUAGE_ENTRIES`.

## Glossary: one word per concept (R5g, D-195)

| Concept | EN | PL | Not (banned in the catalogs) |
|---|---|---|---|
| The weekly reward the player opens | crate / crates | skrzynia / skrzynie | cargo label, freight label / etykieta frachtowa |
| What a crate holds (generic) | upgrade | ulepszenie | — (the stencil header "FREIGHT / FRACHT" is the crate's code line, not a name) |
| An airport where passengers transfer | hub | hub | node, terminal / węzeł, terminal |
| Everything the player has built | network | sieć | grid / siatka |
| The run ends (game over) | Network closed | Sieć zamknięta | "wstrzymana" (reads as a pause you come back from) |
| Game time is stopped | paused / time | pauza / czas | simulation / symulacja |

Exceptions (`allow` in `scripts/test-i18n.mjs`): `menu.terminal` ("AIRWAY.GAMES · TERMINAL 1", the airport sign on
the menu) and `puzzle.board.subtitle` ("Route planning terminal"), where "terminal" is a building, not a hub.
Store texts in `docs/store/` are owner decisions outside the catalogs; since D-203 they use "sieć" too (PL title "Buduj sieć lotów").
