# Uwagi do niemieckiego opisu sklepu (fala 1) — do korekty native speakera

**Dla właściciela (PL).** To są uwagi, nie nowy tekst. Plik `docs/store/de.md` się nie zmienia (D-230, D-276), a
nic nie trafia do sklepu. Pełny opis i teksty alternatywne zrzutów i tak powstaną na nowo w kroku U7 (D-296): najpierw
nowy opis EN (sama mechanika, bez obietnic wyglądu), potem tłumaczenie DE z tego nowego EN, nie z obecnego akapitu o
dioramie. Do tego czasu ten plik zbiera to, co korektor niemiecki powinien sprawdzić, i pilnuje, żeby sklep i gra
mówiły tymi samymi słowami (słownik: `docs/i18n/README.md`, szkic gry: `docs/i18n/de.json`). Pytań do Ciebie tu nie
ma: tytuł jest zatwierdzony jako szkic (D-276), a ostateczne brzmienie należy do native speakera (Q-69 → D-136).

Notes below are in English with German quotes. Counts are Unicode code points (`[...text].length`, as
`test:store-shots`), keywords in UTF-8 bytes. Night 50a (GPT-12), against `docs/store/de.md` on `dev` 2026-11-08.

## Field by field

| Field | Limit | Now | Status |
|---|---|---|---|
| Store title | 30 | 28 | Approved draft (D-276); wording note below |
| App Store subtitle | 30 | 27 | OK |
| Play short description | 80 | 78 | OK; one wording note |
| Full description | 4000 | 1391 | Paragraph 2 stale (Diorama); mode name; rewritten from the new EN at U7 (D-296) |
| App Store keywords | 100 bytes | 100 | At the limit; no repeats of title/subtitle words |
| Play feature graphic alt text | 140 | 114 | Describes the pre-Linoryt graphic; redo with the U7 graphic |
| Play alt text 1–5 | 140 each | 132 / 126 / 113 / 122 / 124 | 1, 2 and 5 describe Róża parts that left the game (D-301) |

### Store title — „Airway: Flugrouten am Globus“ (28/30)

- „am Globus“ reads as colloquial (southern German/Austrian); standard German says „auf dem Globus“ or „rund um den
  Globus“. „Airway: Flugrouten auf dem Globus“ is 33 characters, over the limit. Options for the reviewer, all ≤ 30:
  „Airway: Flugnetz am Globus“ (26), „Airway: Flugrouten weltweit“ (27), „Airway: Routen um die Welt“ (26). The local search
  words „Flug“/„Route“ should stay (the reason for D-276).

### App Store subtitle — „Routen planen. Hubs retten.“ (27/30)

- Idiomatic and short. „Hubs“ matches the game (glossary D-223). Nothing to change.

### Play short description — „Routen-Puzzle auf einem 3D-Globus. Verbinde Städte und halte die Hubs in Gang.“ (78/80)

- Natural. „Routen-Puzzle“ may be written „Routenpuzzle“ (compound without hyphen, as the game draft writes
  „Routenaktionen“); the hyphen is not wrong. Keep the genre word „Puzzle“ (D-229).

### Full description (1391/4000)

1. Paragraph 1: „Baue ein Flugnetz über einen dreidimensionalen Globus.“ — „über einen … Globus“ is understandable
   but stiff; the game's tagline says „Ein Flugnetz über den ganzen Globus“. „erweitere Flughäfen“: the game says
   „Hub ausbauen“, so „baue Flughäfen aus“ would match.
2. **Paragraph 2 is stale** (see GPT-11, `docs/store/copy-review-2026-11.md`, and D-296): „Entdecke eine
   handgestaltete Diorama-Welt aus Ozeanen, Gebirgen, Wolken und Flughäfen.“ describes the October Diorama style. The
   game now prints the Linoryt globe (D-301), and it never had clouds after D-170. Its second half (day and night,
   new passengers at dawn) is true as a mechanic. At U7 the paragraph is translated from the new EN; for that, the game
   draft already uses „Ortszeit“ (local time), „Nachfrage“ (demand) and „im Morgengrauen“ (`tutorial.hint.complete`).
   Do not translate the old sentence again.
3. Bullet „Löse Routen-Puzzles oder lass dein Netz im Endlosmodus wachsen.“ — the mode is „Endlosflug“ in the game
   draft (`menu.endless`); the night-38a EN proposal also moves to the mode name („Endless flight“).
4. Bullet „Wähle Flugzeugtypen nach Reichweite und Passagierkapazität.“ — „Sitzplätze“ is what the crates show
   („Sitze“, `upgrade.field.seats`); „nach Reichweite und Sitzplätzen“ is lighter.
5. Bullet „Stell dich der Tagesherausforderung …“ — matches the game („Tagesherausforderung“, `daily.share.title`).
6. Paragraph 4: „zeigt ein Ursachenbericht“ — the game calls it „ATC-Störungsbericht“ with „Drei Hauptursachen“;
   „ein Bericht mit den Ursachen“ avoids a word the game never shows. „Wenn ein Hub überlastet ist“ is fine; the game's
   word for the failing state is „Stau“.
7. The U7 EN proposal adds four bullets (home region, weekly contract, demand surges, licence classes). Game-draft
   terms to reuse: „Heimatregion“, „Wochenvertrag“/„Frachtbrief“ and „vierte Kiste“, „Passagieransturm“ (announced a day
   ahead), „Lizenzklasse II/III“ with „Nachtflugverbot“. Not the weather front (DEV only, D-274).
8. Last line „Sprache: Das Spiel ist derzeit auf Englisch und Polnisch verfügbar.“ stays until German ships (D-230).

### App Store keywords (100/100 bytes)

`fluggesellschaft,flughafen,flug,flugzeug,netzwerk,umsteigen,strategie,puzzle,logistik,reisen,erde,3d`

- No word of the title or subtitle is repeated (D-229). „netzwerk“ is fine as a search word even though the game says
  „Netz“.
- „drehkreuz“ (the everyday German word for hub) is a likely search term that the field cannot hold today: it costs
  10 bytes with its comma. Dropping „erde“ and „3d“ frees 8, so 2 more are needed, for example „fluggesellschaft“ →
  „airline“ (−9). A choice for the reviewer, not a recommendation to change now.

### Play feature graphic alt text (114/140)

- „Airway-Schild neben einem 3D-Globus in der Dämmerung …“ describes the current `feature-graphic.png` (pre-Linoryt).
  The graphic is redrawn at U7; translate the alt text from the new EN line then.

### Play alt text (one line per scene)

| # | Scene | Count | Note |
|---|---|---|---|
| 1 | night | 132 | „Flughafen-Rosen“ are the Róża compass roses, removed with D-301. Redo at U7 |
| 2 | game | 126 | „24-Stunden-Zifferblatt“ is the Róża day dial; Linoryt has a day bar (D-285). Redo at U7 |
| 3 | upgrade | 113 | Fine; „Frachtkisten“, „Großraumflugzeug“ and „Hub-Ausbau“ match the game draft |
| 4 | failure | 122 | „Network closed“ is quoted in English, correct while the shots are English; „Netz geschlossen“ once they are German |
| 5 | menu | 124 | „am Bogen einer Kompassrose“ is the Róża menu (D-301; Linoryt prints an index under the globe, D-286). „Welt des Tages“: the game draft says „Heute {Datum}“ / „Tagesherausforderung“. Redo at U7 |

## Glossary check: store draft against game draft

| Store `de.md` | Game `de.json` | Verdict |
|---|---|---|
| Hub, Hubs | Hub, Hubs | Same |
| Flugnetz, Netz | Netz, Flugnetz | Same |
| Endlosmodus | Endlosflug | Align the store at U7 |
| Tagesherausforderung | Tagesherausforderung | Same |
| Welt des Tages (alt 5) | Heute {date} | Align at U7 |
| Upgrade | Upgrade | Same |
| Frachtkisten | Kiste, Wochenkiste | Same family |
| Großraumflugzeug | Großraumflugzeug | Same |
| Hub-Ausbau | Hub ausbauen, Hub-Ausbau | Same |
| Wartebereiche | Wartebereich | Same |
| Ursachenbericht | ATC-Störungsbericht, Ursachen | Prefer the game's words |
| Einstellungen (alt 5) | Optionen (menu budget) | Depends on the reviewer's choice in `docs/i18n/README.md` |
| Fluglotse | (not in the game) | Fine |
