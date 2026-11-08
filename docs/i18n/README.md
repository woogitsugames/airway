# Translator drafts (wave 1: DE, FR, ES, PT-BR)

Drafts of the game catalog in the exchange format of R7i (D-211/D-212/D-213). Owner decision D-96/D-136: the agent
translates, a native speaker corrects. **Nothing here ships**: a planned language enters the game only when its
reviewed catalog is imported (`npm run i18n:import -- <code>`) and the language is added to `LANGUAGE_ENTRIES`
(`src/i18n/languages.ts`). Legal texts (`src/i18n/legal/`) are not exported and not translated here (lawyer).

| File | Status |
|---|---|
| `de.json` | Complete draft, 582 rows, needs native review (night 50a, GPT-12) |

## Working on a draft

- `npm run i18n:export -- de` refreshes the file from `src/i18n/en.ts` and keeps every translation whose English
  source has not changed (a changed or new key comes back empty).
- Fill `translation` only. Keep every `{param}`. A count's word is a plural token `{count|one|other}` in the order of
  `plural.categories` (German: 2 forms; French, Spanish, Portuguese: 2–3). A token may be added where English needs
  none ("{count} aircraft" → "{count} {count|Flugzeug|Flugzeuge}").
- `maxLength` is the visible budget from `src/i18n/limits.ts` (a plural token counts as its longest form, a `{param}`
  as nothing). Over-budget text is rejected.
- `npm run i18n:import -- de --check` validates without writing. `npm run test:i18n-drafts` (in `test:fast`) fails on
  structural problems in any draft here and only warns about missing, stale or untranslated rows.
- City and region names of the globe come from `src/data/city-names.json` (D-217), not from this file.

## Glossary

One column per wave-1 language; add a column when a language starts. Sentence case everywhere except codes, the
brand line (`menu.sign`), the share ticket and the ATC step lines (D-259). Informal address (DE "du").

| English (game term) | German | Note |
|---|---|---|
| hub | Hub (pl. Hubs) | Glossary word in game, site and stores (D-195, D-223); not "Drehkreuz", not "Terminal" |
| network | Netz | "Flugnetz" in prose; "Netzwerk" only as a store keyword |
| route | Route | |
| airport | Flughafen | |
| passenger | Passagier | "Pax" only in tight tables (as EN) |
| turboprop | Turboprop | No article in the catalog (gender varies) |
| widebody (aircraft) | Großraumflugzeug | "Großraum" on the dock tag (10-character budget) |
| aircraft, plane | Flugzeug | |
| weekly crate | Kiste, Wochenkiste | The weekly upgrade board is the "Hangar" |
| upgrade | Upgrade | "Hub ausbauen" / "Hub-Ausbau" for the hub upgrade |
| departure slot | Startslot, Slot | |
| jam, congestion | Stau | "verstopft" for a congested hub |
| waiting area | Wartebereich | "Warteplätze" for its places |
| night curfew | Nachtflugverbot | |
| transfer, connection | Umstieg, umsteigen | "Mindestumsteigezeit" for MCT |
| weekly contract | Vertrag; Frachtbrief (the waybill) | |
| passenger surge | Passagieransturm, Ansturm | |
| weather front | Wetterfront | |
| home region | Heimatregion | |
| licence class | Lizenzklasse | |
| milestone | Meilenstein | |
| Endless flight (mode) | Endlosflug | "Endlos" in the logbook table |
| daily challenge | Tagesherausforderung | Menu row reads "Heute {date}" |
| puzzle | Puzzle (pl. Puzzles) | |
| logbook | Logbuch | |
| Settings | Optionen | "Einstellungen" does not fit the 10-cell menu row; used everywhere for consistency |
| holding pattern (pause) | Warteschleife | |
| departures board | Abflugtafel | |
| boarding pass | Bordkarte | |
| ATC | ATC | Kept as the step code; prose says "Störungsbericht" |
| local time | Ortszeit | |

## Open terminology questions for the German reviewer

1. "Optionen" or "Einstellungen" (the menu row allows 10 characters).
2. "Großraumflugzeug" or a shorter "Langstreckenjet" for widebody.
3. "Turboprop" as der/die/das: the catalog avoids the article; the reviewer may prefer "Propellermaschine".
4. "Hub" stays by the glossary decision; "Drehkreuz" is the everyday German word and may suit the store keywords.
5. "Im Plan" for the menu status "On time" (8 cells; "Pünktlich" has 9).
6. "Endlosflug" for "Endless flight" and "Warteschleife" for the pause title.
