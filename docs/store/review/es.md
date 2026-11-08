# Uwagi do hiszpańskiego opisu sklepu (fala 1) — do korekty native speakera

**Dla właściciela (PL).** To są uwagi, nie nowy tekst. Plik `docs/store/es.md` się nie zmienia (D-230, D-276), a
nic nie trafia do sklepu. Pełny opis i teksty alternatywne zrzutów i tak powstaną na nowo w kroku U7 (D-296): najpierw
nowy opis EN (sama mechanika, bez obietnic wyglądu), potem tłumaczenie ES z tego nowego EN, nie z obecnego akapitu o
„mundo de diorama”. Do tego czasu ten plik zbiera to, co korektor hiszpański powinien sprawdzić, i pilnuje, żeby sklep
i gra mówiły tymi samymi słowami (słownik: `docs/i18n/README.md`, szkic gry: `docs/i18n/es.json`). Sklep i szkic gry
mówią do gracza per „tú”, neutralnym hiszpańskim dla Hiszpanii i Ameryki Łacińskiej (bez „vosotros”).

Notes below are in English with Spanish quotes. Counts are Unicode code points (`[...text].length`, as
`test:store-shots`), keywords in UTF-8 bytes. Night 51a (GPT-14), against `docs/store/es.md` on `dev` 2026-11-08.

## Field by field

| Field | Limit | Now | Status |
|---|---|---|---|
| Store title | 30 | 28 | Approved draft (D-276) |
| App Store subtitle | 30 | 30 | At the limit; OK |
| Play short description | 80 | 76 | OK |
| Full description | 4000 | 1371 | Paragraph 2 stale („mundo de diorama“); mode name; rewritten from the new EN at U7 (D-296) |
| App Store keywords | 100 bytes | 89 | No repeats of title/subtitle words; 11 bytes free |
| Play feature graphic alt text | 140 | 108 | Describes the pre-Linoryt graphic; redo with the U7 graphic |
| Play alt text 1–5 | 140 each | 127 / 124 / 116 / 124 / 131 | 1, 2 and 5 describe Róża parts that left the game (D-301) |

### Store title — „Airway: rutas sobre el globo“ (28/30)

- Natural and neutral. „sobre el globo“ and „en el globo“ both work; the game tagline says „por todo el globo“.
  Nothing to change.

### App Store subtitle — „Diseña vuelos. Salva tus hubs.“ (30/30)

- Idiomatic, informal „tú“ as the game draft. EN says „Design routes“; „Diseña rutas. Salva tus hubs.“ is 29 and
  uses the game's word („ruta“). A choice for the reviewer.

### Play short description — „Puzle de rutas en un globo 3D. Conecta ciudades y mantén los hubs en marcha.“ (76/80)

- Natural. „Puzle“ is the RAE spelling the game draft uses too. Keep the genre word (D-229).

### Full description (1371/4000)

1. Paragraph 1: „planifica cómo hacen escala los pasajeros entre vuelos“ — fine; the game draft uses „conexión“ for
   the transfer mechanic (MCT: „tiempo mínimo de conexión“) and „escala“ for the crate field. „amplía aeropuertos“
   matches „Ampliar hub“.
2. **Paragraph 2 is stale** (GPT-11, `docs/store/copy-review-2026-11.md`, and D-296): „Explora un mundo de diorama
   hecho a mano, con océanos, montañas, nubes y aeropuertos.“ describes the October Diorama style. The game now
   prints the Linoryt globe (D-301) and has had no clouds since D-170. Its second half (day and night, new waves of
   passengers at dawn) is true as a mechanic. At U7 the paragraph is translated from the new EN; the game draft
   already has „hora local“, „demanda“ and „al amanecer“ (`tutorial.hint.complete`). Do not translate the old
   sentence again.
3. Bullet „Resuelve puzles de rutas o haz crecer una red en el modo Sin fin.“ — the mode is „Vuelo sin fin“ in the
   game draft (`menu.endless`); the night-38a EN proposal also moves to the mode name („Endless flight“).
4. Bullet „Elige tipos de avión según su alcance y su capacidad de pasajeros.“ — matches the crate fields („Alcance“,
   „Asientos“).
5. Bullet „Acepta el desafío diario …“ — matches the game („desafío diario“, `daily.share.title`).
6. Bullet „Vigila las zonas de espera y actúa antes de que un hub se sature.“ — fine; the game says „atasco“ /
   „atascado“ for the jam and „saturado“ only in the puzzle result. Either reads well.
7. Paragraph 4: „un informe de causas“ — the game calls it „Informe de incidente ATC“ with „Tres causas
   principales“; „un informe del incidente muestra qué salió mal“ uses the game's words.
8. The U7 EN proposal adds four bullets (home region, weekly contract, demand surges, licence classes). Game-draft
   terms to reuse: „región de origen“, „contrato“ / „carta de porte“ and „cuarta caja“, „oleada de pasajeros“
   (announced a day ahead; the current paragraph 2 already says „oleadas de pasajeros“), „clase de licencia II/III“
   with „toque de queda nocturno“. Not the weather front (DEV only, D-274).
9. Last line „Idioma: por ahora el juego está disponible en inglés y polaco.“ stays until Spanish ships (D-230).

### App Store keywords (89/100 bytes)

`aerolínea,aeropuerto,vuelo,avión,red,escala,estrategia,puzle,logística,viaje,tierra,3d`

- No word of the title or subtitle is repeated (D-229).
- 11 bytes are free. Candidates: „conexión“ (10 with comma, the game's transfer word) or „transporte“ (11). „hub“
  is in the subtitle, so it need not be repeated. A choice for the reviewer.

### Play feature graphic alt text (108/140)

- „Letrero de Airway junto a un globo 3D al atardecer …“ describes the current `feature-graphic.png` (pre-Linoryt).
  The graphic is redrawn at U7; translate the alt text from the new EN line then.

### Play alt text (one line per scene)

| # | Scene | Count | Note |
|---|---|---|---|
| 1 | night | 127 | „rosas de aeropuertos“ are the Róża compass roses, removed with D-301. Redo at U7 |
| 2 | game | 124 | „la esfera de 24 horas“ is the Róża day dial; Linoryt has a day bar (D-285). Redo at U7 |
| 3 | upgrade | 116 | Fine; „cajas de carga“, „turbohélice“, „avión de fuselaje ancho“, „ampliar un hub“ match the game draft |
| 4 | failure | 124 | „Network closed“ is quoted in English, correct while the shots are English; „Red cerrada“ once they are Spanish. „hub atascado“ matches the game |
| 5 | menu | 131 | „en el arco de una rosa de los vientos“ is the Róża menu (D-301; Linoryt prints an index under the globe, D-286). „mundo del día“: the game draft says „Hoy {date}“ / „desafío diario“; „diario“ is „Bitácora“ in the game draft; „ajustes“ matches. Redo at U7 |

## Glossary check: store draft against game draft

| Store `es.md` | Game `es.json` | Verdict |
|---|---|---|
| hub, hubs | hub, hubs | Same |
| red aérea, red | red | Same |
| modo Sin fin | Vuelo sin fin (logbook: Sin fin) | Align the store at U7 |
| desafío diario | desafío diario | Same |
| mundo del día (alt 5) | Hoy {date} | Align at U7 |
| mejora | mejora | Same |
| cajas de carga | caja, Carga | Same |
| turbohélice | turbohélice (dock tag „Turboprop“) | Same |
| avión de fuselaje ancho | avión de fuselaje ancho | Same |
| ampliar un hub | Ampliar hub | Same |
| zonas de espera | zona de espera | Same |
| informe de causas | Informe de incidente ATC, causas | Prefer the game's words |
| atascado, saturar | atasco, atascado | Same family |
| hacer escala | conexión; escala (crate field) | Fine; reviewer may unify |
| diario (alt 5, logbook) | Bitácora | Depends on the reviewer's choice in `docs/i18n/README.md` |
| ajustes (alt 5) | Ajustes | Same |
| controlador aéreo | (not in the game) | Fine |
| tú | tú | Same register |
