# Translator drafts (wave 1: DE, FR, ES, PT-BR)

Drafts of the game catalog in the exchange format of R7i (D-211/D-212/D-213). Owner decision D-96/D-136: the agent
translates, a native speaker corrects. **Nothing here ships**: a planned language enters the game only when its
reviewed catalog is imported (`npm run i18n:import -- <code>`) and the language is added to `LANGUAGE_ENTRIES`
(`src/i18n/languages.ts`). Legal texts (`src/i18n/legal/`) are not exported and not translated here (lawyer).

| File | Status |
|---|---|
| `de.json` | Complete draft, 582 rows, needs native review (night 50a, GPT-12) |
| `fr.json` | Complete draft, 582 rows, needs native review (night 51a, GPT-13) |
| `es.json` | Complete draft, 582 rows, needs native review (night 51a, GPT-14) |
| `pt.json` | Complete draft (Brazilian Portuguese, code `pt`, locale pt-BR), 582 rows, needs native review (night 53a, GPT-15) |

## Working on a draft

- `npm run i18n:export -- de` refreshes the file from `src/i18n/en.ts` and keeps every translation whose English
  source has not changed (a changed or new key comes back empty).
- Fill `translation` only. Keep every `{param}`. A count's word is a plural token `{count|one|other}` in the order of
  `plural.categories` (German: 2 forms; French, Spanish, Portuguese: 2–3). A token may be added where English needs
  none ("{count} aircraft" → "{count} {count|Flugzeug|Flugzeuge}").
- French and Brazilian Portuguese `one` cover 0 and 1 ("0 passager", "0 passageiro"); the `many` form (round
  millions) may be left out and falls back to `other`, so the FR, ES and PT drafts give two forms.
- Brazilian Portuguese is language code `pt` (locale pt-BR, `PLANNED_LANGUAGE_ENTRIES`), so its draft is `pt.json`;
  only the store listing is named after the store locale (`docs/store/pt-br.md`, review notes `docs/store/review/pt-br.md`).
- `maxLength` is the visible budget from `src/i18n/limits.ts` (a plural token counts as its longest form, a `{param}`
  as nothing). Over-budget text is rejected.
- `npm run i18n:import -- de --check` validates without writing. `npm run test:i18n-drafts` (in `test:fast`) fails on
  structural problems in any draft here and only warns about missing, stale or untranslated rows.
- City and region names of the globe come from `src/data/city-names.json` (D-217), not from this file.

## Glossary

One column per wave-1 language; add a column when a language starts. Sentence case everywhere except codes, the
brand line (`menu.sign`), the share ticket and the ATC step lines (D-259). Address follows each language's store
listing: DE informal "du"; FR formal "vous" (`docs/store/fr.md` says "Construisez", "Reliez"); ES informal "tú"
(`docs/store/es.md` says "Construye", "No eres"), neutral Spanish for Spain and Latin America (no "vosotros", no
"coger"/"ordenador"; "tocar" for tap); PT Brazilian "você" with the imperative of `docs/store/pt-br.md` ("Construa",
"Conecte"), Brazilian spelling and words (D-212: a pt-PT device gets it too): "tela", "mouse", "aparelho", "salvar",
"excluir", "compartilhar", "ranking"; city names as `src/data/city-names.json` ("Nova York",
"Madri", "Acra"). French spacing before `: ; ? ! %` and inside `« »` is U+00A0, never U+202F
(D-146; `test:i18n-drafts` fails on U+202F). Spanish and French use `« »` for quotes; Portuguese uses “ ”. The Portuguese `gameover.region.*` names carry their
article ("a América do Norte", "o Oriente Médio"), because every sentence that uses them says "para {region}" (EN keeps
"the" only for the Middle East); `region.name.*` stay bare.

| English (game term) | German | French | Spanish | Portuguese (BR) | Note |
|---|---|---|---|---|---|
| hub | Hub (pl. Hubs) | hub | hub | hub | Glossary word in game, site and stores (D-195, D-223); not "Drehkreuz", "plaque tournante", "centro de conexiones" |
| network | Netz | réseau | red | rede | DE "Flugnetz" in prose; "Netzwerk" only as a store keyword |
| route | Route | route | ruta | rota |  |
| airport | Flughafen | aéroport | aeropuerto | aeroporto |  |
| passenger | Passagier | passager | pasajero | passageiro | "Pax" only in tight tables (as EN) |
| turboprop | Turboprop | turbopropulseur | turbohélice | turboélice | Dock tag (10 cells): "Turboprop" in FR and ES, "Turboélice" in PT; DE no article in the catalog |
| widebody (aircraft) | Großraumflugzeug | gros-porteur | avión de fuselaje ancho | avião de fuselagem larga | Dock tag (10 cells): "Großraum", "Gros-port.", "Fus. ancho", "Fus. larga"; PT store alt text says "widebody" |
| aircraft, plane | Flugzeug | avion | avión | avião |  |
| weekly crate | Kiste, Wochenkiste | caisse, caisse de la semaine | caja, caja semanal | caixa, caixa semanal | The weekly upgrade board is the "Hangar" in all four |
| upgrade | Upgrade | amélioration | mejora | melhoria | Hub upgrade: "Hub ausbauen" / "Agrandir le hub" / "Ampliar hub" (ES, PT) |
| departure slot | Startslot, Slot | créneau de départ, créneau | slot de salida, slot | slot de decolagem, slot | FR airport tag (5 cells) and codes keep "SLOT"; ANAC also says "slot" |
| jam, congestion | Stau | saturation, saturé | atasco, atascado | congestionamento, congestionado | FR/ES stores say "saturé"/"atascado" too; PT store says "lotado"/"sobrecarregado" |
| waiting area | Wartebereich | zone d’attente | zona de espera | área de espera | Its places: "Warteplätze" / "places d’attente" / "plazas de espera" / "lugares de espera" |
| night curfew | Nachtflugverbot | couvre-feu de nuit | toque de queda nocturno | toque de recolher noturno |  |
| transfer, connection | Umstieg, umsteigen | correspondance | conexión, escala | conexão | MCT: "Mindestumsteigezeit" / "temps de correspondance minimum" / "tiempo mínimo de conexión"; FR crate field (10 cells) "Transit"; PT "tempo mínimo de conexão" |
| weekly contract | Vertrag; Frachtbrief (the waybill) | contrat; lettre de transport | contrato; carta de porte | contrato; conhecimento aéreo |  |
| passenger surge | Passagieransturm, Ansturm | afflux de passagers, afflux | oleada de pasajeros, oleada | onda de passageiros, onda |  |
| weather front | Wetterfront | front météo | frente meteorológico | frente meteorológica |  |
| home region | Heimatregion | région d’origine | región de origen | região de origem |  |
| licence class | Lizenzklasse | classe de licence | clase de licencia | classe de licença |  |
| milestone | Meilenstein | étape | hito | marco |  |
| Endless flight (mode) | Endlosflug | Vol sans fin | Vuelo sin fin | Voo sem fim | "Endlos" / "Sans fin" / "Sin fin" / "Sem fim" in the logbook table |
| daily challenge | Tagesherausforderung | défi du jour | desafío diario | desafio diário | DE menu row reads "Heute {date}" |
| puzzle | Puzzle (pl. Puzzles) | puzzle | puzle | quebra-cabeça (pl. quebra-cabeças) | ES follows the RAE spelling "puzle" |
| logbook | Logbuch | journal de bord; menu "Journal" | bitácora | diário de bordo; menu "Diário" | FR "Carnet de vol" does not fit the 10-cell menu row |
| Settings | Optionen | Réglages | Ajustes | Ajustes | DE: "Einstellungen" does not fit the 10-cell menu row; PT "Ajustes" as iOS ("Configurações" has 13) |
| holding pattern (pause) | Warteschleife | circuit d’attente | circuito de espera | circuito de espera |  |
| departures board | Abflugtafel | tableau des départs | panel de salidas | painel de partidas |  |
| boarding pass | Bordkarte | carte d’embarquement | tarjeta de embarque | cartão de embarque |  |
| ATC | ATC | ATC | ATC | ATC | Kept as the step code; prose says "Störungsbericht" / "rapport d’incident" / "informe de incidente" / "relatório de incidente" |
| local time | Ortszeit | heure locale | hora local | horário local |  |

## Open terminology questions for the German reviewer

1. "Optionen" or "Einstellungen" (the menu row allows 10 characters).
2. "Großraumflugzeug" or a shorter "Langstreckenjet" for widebody.
3. "Turboprop" as der/die/das: the catalog avoids the article; the reviewer may prefer "Propellermaschine".
4. "Hub" stays by the glossary decision; "Drehkreuz" is the everyday German word and may suit the store keywords.
5. "Im Plan" for the menu status "On time" (8 cells; "Pünktlich" has 9).
6. "Endlosflug" for "Endless flight" and "Warteschleife" for the pause title.

## Open terminology questions for the French reviewer

1. "Réglages" for Settings (10-cell menu row; "Paramètres" also fits and is the Android word).
2. "Ponctuel" for the menu status "On time" (8 cells; "À l’heure" has 9) and "Embarq." for "Boarding" (8 cells;
   "Embarquement" has 12).
3. Dock tags (10 cells): "Turboprop" (the catalog says "turbopropulseur" elsewhere) and "Gros-port." for widebody.
4. "créneau" for a departure slot in prose, but "SLOT" on the 5-cell airport tag and in the `SLOT+n` crate code.
5. "Transit" for the crate field "Transfer" (10 cells; "Correspondance" has 14).
6. "Vol sans fin" for "Endless flight", "Circuit d’attente" for the pause title, "étape" for milestone ("jalon"?).
7. "vous" throughout, as the store listing; a casual game could use "tu" (decide together with the store copy).

## Open terminology questions for the Spanish reviewer

1. "Turboprop" (dock tag, 10 cells; "turbohélice" has 11) and "Fus. ancho" for widebody; "Vel. {speed}×" for the
   dock speed ("Velocidad" does not fit 10 cells).
2. "slot" kept as the aviation loanword (Spain and Latin America); "franja horaria" is the alternative.
3. "toque de queda nocturno" for night curfew ("restricción nocturna" is the regulator's wording).
4. "Bitácora" for the logbook (the current store alt text says "diario").
5. "Puzle" (RAE) or "Rompecabezas"; "Sudamérica"/"Norteamérica" (neutral) against "América del Sur/Norte".
6. "carta de porte" for the waybill ("guía aérea" is the air-freight term in Latin America).

## Open terminology questions for the Brazilian Portuguese reviewer

1. Widebody: "avião de fuselagem larga" (dock tag "Fus. larga", 10 cells) or the loanword "widebody" that
   `docs/store/pt-br.md` uses in alt text 3 and Brazilian aviation press uses too.
2. "partida" means both a departure (the departures board, "Partidas") and a game run ("Partida oficial", "partidas
   com detalhes"); "Decolagens" for the board, or "rodada" for a run, would separate them.
3. "Viajantes" for the HUD label "Passengers" (10 cells; "Passageiros" has 11); "Pontual" for the menu status "On time"
   (8 cells; "No horário" has 10); "Modo economia" for "Battery saver" (14 cells; "Economia de bateria" has 19).
4. "Conhecimento aéreo" for the waybill (the air cargo document) — correct but technical; "Guia de carga" reads easier.
5. "Circuito de espera" for the pause title ("órbita de espera" is what Brazilian pilots say); "Instrução de voo" for
   the tutorial title.
6. "Onda de passageiros" for a demand surge (the store says "ondas de passageiros"); "pico" is the alternative.
7. "Quebra-cabeça" for puzzle (the store's word); the menu row "Quebra-cabeças" is 14 of 15 cells.
8. Game name gender: the catalog says "o Airway" (the game); the store's feature-graphic alt text says "Placa da Airway"
   (the airline).
