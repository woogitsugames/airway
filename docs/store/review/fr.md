# Uwagi do francuskiego opisu sklepu (fala 1) — do korekty native speakera

**Dla właściciela (PL).** To są uwagi, nie nowy tekst. Plik `docs/store/fr.md` się nie zmienia (D-230, D-276), a
nic nie trafia do sklepu. Pełny opis i teksty alternatywne zrzutów i tak powstaną na nowo w kroku U7 (D-296): najpierw
nowy opis EN (sama mechanika, bez obietnic wyglądu), potem tłumaczenie FR z tego nowego EN, nie z obecnego akapitu o
„monde en diorama”. Do tego czasu ten plik zbiera to, co korektor francuski powinien sprawdzić, i pilnuje, żeby sklep
i gra mówiły tymi samymi słowami (słownik: `docs/i18n/README.md`, szkic gry: `docs/i18n/fr.json`). Sklep i szkic gry
zwracają się do gracza per „vous” — zostawiam tak, ale to jedno pytanie warto zadać korektorowi (niżej).

Notes below are in English with French quotes. Counts are Unicode code points (`[...text].length`, as
`test:store-shots`), keywords in UTF-8 bytes. Night 51a (GPT-13), against `docs/store/fr.md` on `dev` 2026-11-08.

## Field by field

| Field | Limit | Now | Status |
|---|---|---|---|
| Store title | 30 | 28 | Approved draft (D-276); typography note below |
| App Store subtitle | 30 | 27 | Wording differs from the EN line; note below |
| Play short description | 80 | 79 | OK; one wording note |
| Full description | 4000 | 1495 | Paragraph 2 stale („monde en diorama”); mode name; rewritten from the new EN at U7 (D-296) |
| App Store keywords | 100 bytes | 97 | No repeats of title/subtitle words; „hub” is missing |
| Play feature graphic alt text | 140 | 123 | Describes the pre-Linoryt graphic; redo with the U7 graphic |
| Play alt text 1–5 | 140 each | 129 / 123 / 124 / 123 / 127 | 1, 2 and 5 describe Róża parts that left the game (D-301) |

### Store title — „Airway : routes sur le globe“ (28/30)

- French typography puts a no-break space before the colon. The file has an ordinary space (U+0020): a store field
  may wrap after „Airway“ and leave „:“ at the start of the next line. Use U+00A0 (not U+202F: D-146 for the game;
  store fields are plain text, but U+00A0 is the safe choice everywhere). Same count.
- „routes sur le globe“ keeps the search words of D-276. „Airway : réseau aérien mondial“ (30) is an option for the
  reviewer if „routes“ reads as roads; in aviation French „route aérienne“ is normal, so no change proposed.

### App Store subtitle — „Tracez vos lignes aériennes“ (27/30)

- EN says „Design routes. Save your hubs.“ The French line drops the hub half, which is the game's failure condition
  and the word the game uses (glossary D-223). „Tracez des routes. Sauvez vos hubs.“ is 35, over the limit;
  „Routes à tracer, hubs à sauver“ (30) or „Des routes, des hubs à sauver“ (29) keep both halves. A choice for the
  reviewer.
- „lignes aériennes“ is fine French but the game says „route“ everywhere (`route.menu.label` „Actions sur la route“).

### Play short description — „Puzzle de routes sur un globe 3D. Reliez les villes et gardez les hubs fluides.“ (79/80)

- Natural. „gardez les hubs fluides“ is slightly unusual („fluide“ is said of traffic, not of a place);
  „Puzzle de routes sur un globe 3D. Reliez les villes, évitez les hubs saturés.“ is 77 and uses the game's word for the failing state, „saturé“ (`note.jam` „Saturé, le réseau
  ferme…“).

### Full description (1495/4000)

1. Paragraph 1: matches the game („réseau aérien“, „correspondances“, „agrandissez les aéroports“ — the game says
   „Agrandir le hub“). „Les avions volent tout seuls — c’est vous qui décidez où va le réseau.“ is good.
2. **Paragraph 2 is stale** (GPT-11, `docs/store/copy-review-2026-11.md`, and D-296): „Explorez un monde en diorama
   fait main, avec ses océans, ses montagnes, ses nuages et ses aéroports.“ describes the October Diorama style. The
   game now prints the Linoryt globe (D-301) and has had no clouds since D-170. Its second half (day and night, new
   passengers at dawn) is true as a mechanic. At U7 the paragraph is translated from the new EN; the game draft
   already has „heure locale“, „demande“ and „à l’aube“ (`tutorial.hint.complete`). Do not translate the old sentence
   again.
3. Bullet „Résolvez des puzzles de routes ou développez un réseau en mode Sans fin.“ — the mode is „Vol sans fin“ in
   the game draft (`menu.endless`); the night-38a EN proposal also moves to the mode name („Endless flight“).
4. Bullet „Choisissez les types d’avions selon leur rayon d’action et leur capacité.“ — the crates say „Autonomie“
   and „Sièges“ (`upgrade.field.range`, `upgrade.field.seats`); „selon leur autonomie et leur nombre de sièges“
   matches the game.
5. Bullet „Relevez le défi du jour …“ — matches the game („défi du jour“, `daily.share.title`).
6. Bullet „Choisissez une amélioration à la fin de chaque semaine de jeu.“ — matches („amélioration“, the board is
   the „Hangar“ with „caisses“).
7. Paragraph 4: „un rapport des causes“ — the game calls it „Rapport d’incident ATC“ with „Trois causes principales“;
   „un rapport d’incident montre ce qui n’a pas marché“ uses the game's words. „débordé“/„déborde“ is fine; the
   game's word is „saturé“.
8. The U7 EN proposal adds four bullets (home region, weekly contract, demand surges, licence classes). Game-draft
   terms to reuse: „région d’origine“, „contrat“ / „lettre de transport“ and „quatrième caisse“, „afflux de
   passagers“ (announced a day ahead), „classe de licence II/III“ with „couvre-feu de nuit“. Not the weather front
   (DEV only, D-274).
9. Spacing: the file uses ordinary spaces before „:“ („Langue : le jeu…“, „Votre défi : …“); use U+00A0 when the copy
   is redone, as the game draft does.
10. Last line „Langue : le jeu est actuellement disponible en anglais et en polonais.“ stays until French ships
    (D-230).

### App Store keywords (97/100 bytes)

`compagnie,aéroport,vol,avion,réseau,correspondance,stratégie,puzzle,logistique,voyage,terre,3d`

- No word of the title or subtitle is repeated (D-229).
- „hub“ (the game's own word, and a common loanword in French aviation) is missing; it costs 4 bytes with its comma
  and 3 are free. Dropping „3d“ (3 bytes) makes room. „compagnie“ alone is a weak search word („compagnie aérienne“
  does not fit). A choice for the reviewer.

### Play feature graphic alt text (123/140)

- „Enseigne Airway à côté d’un globe 3D au crépuscule …“ describes the current `feature-graphic.png`
  (pre-Linoryt). The graphic is redrawn at U7; translate the alt text from the new EN line then.

### Play alt text (one line per scene)

| # | Scene | Count | Note |
|---|---|---|---|
| 1 | night | 129 | „roses d’aéroports“ are the Róża compass roses, removed with D-301. Redo at U7 |
| 2 | game | 123 | „cadran des 24 heures“ is the Róża day dial; Linoryt has a day bar (D-285). Redo at U7 |
| 3 | upgrade | 124 | Fine; „caisses de fret“, „turbopropulseur“, „gros-porteur“, „agrandissement d’un hub“ match the game draft |
| 4 | failure | 123 | „Network closed“ is quoted in English, correct while the shots are English; „Réseau fermé“ once they are French |
| 5 | menu | 127 | „sur l’arc d’une rose des vents“ is the Róża menu (D-301; Linoryt prints an index under the globe, D-286). „monde du jour“: the game draft says „Aujourd’hui {date}“ / „défi du jour“; „journal et réglages“ match. Redo at U7 |

## Glossary check: store draft against game draft

| Store `fr.md` | Game `fr.json` | Verdict |
|---|---|---|
| hub, hubs | hub, hubs | Same |
| réseau aérien, réseau | réseau | Same |
| mode Sans fin | Vol sans fin (logbook: Sans fin) | Align the store at U7 |
| défi du jour | défi du jour | Same |
| monde du jour (alt 5) | Aujourd’hui {date} | Align at U7 |
| amélioration | amélioration | Same |
| caisses de fret | caisse, Fret | Same family |
| turbopropulseur | turbopropulseur (dock tag „Turboprop“) | Same |
| gros-porteur | gros-porteur | Same |
| agrandissement d’un hub | Agrandir le hub | Same |
| zones d’attente | zone d’attente | Same |
| rapport des causes | Rapport d’incident ATC, causes | Prefer the game's words |
| saturé, débordé | saturé, saturation | Prefer „saturé“ |
| rayon d’action | Autonomie | Prefer the game's word |
| journal, réglages (alt 5) | Journal, Réglages | Same |
| lignes aériennes (subtitle) | route | Prefer „route“ |
| contrôleur aérien | (not in the game) | Fine |
| vous | vous | Same register |
