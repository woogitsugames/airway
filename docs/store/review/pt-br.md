# Uwagi do brazylijskiego opisu sklepu (fala 1) — do korekty native speakera

**Dla właściciela (PL).** To są uwagi, nie nowy tekst. Plik `docs/store/pt-br.md` się nie zmienia (D-230, D-276), a
nic nie trafia do sklepu. Pełny opis i teksty alternatywne zrzutów i tak powstaną na nowo w kroku U7 (D-296): najpierw
nowy opis EN (sama mechanika, bez obietnic wyglądu), potem tłumaczenie PT-BR z tego nowego EN, nie z obecnego akapitu
o „mundo em diorama”. Do tego czasu ten plik zbiera to, co korektor brazylijski powinien sprawdzić, i pilnuje, żeby
sklep i gra mówiły tymi samymi słowami (słownik: `docs/i18n/README.md`, szkic gry: `docs/i18n/pt.json` — kod języka
w grze to `pt`, locale pt-BR, D-212). Sklep i szkic gry mówią do gracza per „você”, po brazylijsku („tela”, „aparelho”,
„salvar”, „Nova York”).

Notes below are in English with Portuguese quotes. Counts are Unicode code points (`[...text].length`, as
`test:store-shots`), keywords in UTF-8 bytes. Night 53a (GPT-15), against `docs/store/pt-br.md` on `dev` 2026-11-08.

## Field by field

| Field | Limit | Now | Status |
|---|---|---|---|
| Store title | 30 | 24 | Approved draft (D-276) |
| App Store subtitle | 30 | 28 | „Salve“ reads as rescue and as save; one wording note |
| Play short description | 80 | 79 | OK; one character free |
| Full description | 4000 | 1373 | Paragraph 2 stale („mundo em diorama“); mode name; rewritten from the new EN at U7 (D-296) |
| App Store keywords | 100 bytes | 98 | No repeats of title/subtitle words; 2 bytes free |
| Play feature graphic alt text | 140 | 115 | Describes the pre-Linoryt graphic; „da Airway“ against „do Airway“; redo with the U7 graphic |
| Play alt text 1–5 | 140 each | 130 / 133 / 125 / 114 / 127 | 1, 2 and 5 describe Róża parts that left the game (D-301) |

### Store title — „Airway: rotas pelo globo“ (24/30)

- Natural. The game tagline says „Uma rede aérea pelo globo inteiro“, so „pelo globo“ is consistent. Nothing to
  change.

### App Store subtitle — „Planeje voos. Salve os hubs.“ (28/30)

- Idiomatic, „você“ imperative as the game draft. „Salvar“ is also the Brazilian word for saving a game („Salvar voo“
  in the pause sheet), so „Salve os hubs“ can read as „save the hubs (to a file)“ for a second; the context makes the
  rescue meaning clear. EN says „Design routes“; „Planeje rotas. Salve os hubs.“ is 29 and uses the game's word
  („rota“). A choice for the reviewer.

### Play short description — „Quebra-cabeça de rotas num globo 3D. Conecte cidades e mantenha os hubs ativos.“ (79/80)

- Natural. „num“ is the everyday Brazilian contraction; „em um“ would make it 81, over the limit. „Quebra-cabeça“ is
  the genre word (D-229) and the game draft's word too.

### Full description (1373/4000)

1. Paragraph 1: „planeje como os passageiros fazem conexão entre voos“ matches the game draft („conexão“, MCT „tempo
   mínimo de conexão“); „amplie aeroportos“ matches „Ampliar hub“. „Os aviões voam sozinhos — você decide para onde a
   rede cresce“ is fine.
2. **Paragraph 2 is stale** (GPT-11, `docs/store/copy-review-2026-11.md`, and D-296): „Explore um mundo em diorama
   feito à mão, com oceanos, montanhas, nuvens e aeroportos.“ describes the October Diorama style. The game now prints
   the Linoryt globe (D-301) and has had no clouds since D-170. Its second half (day, dusk and night; new waves of
   passengers at dawn) is true as a mechanic. At U7 the paragraph is translated from the new EN; the game draft already
   has „horário local“, „demanda“ and „ao amanhecer“ (`tutorial.hint.complete`). Do not translate the old sentence
   again.
3. Bullet „Resolva quebra-cabeças de rotas ou faça uma rede crescer no modo Sem fim.“ — the mode is „Voo sem fim“ in
   the game draft (`menu.endless`; „Sem fim“ only in the logbook table); the night-38a EN proposal also moves to the
   mode name („Endless flight“).
4. Bullet „Escolha tipos de avião pelo alcance e pela capacidade de passageiros.“ — matches the crate fields
   („Alcance“, „Assentos“).
5. Bullet „Fique de olho nas áreas de espera e aja antes que um hub fique lotado.“ — fine; the game says
   „congestionamento“ / „congestionado“ for the jam and „lotado“ only in the puzzle result. Either reads well;
   paragraph 4 adds a third word („sobrecarregado“). The reviewer may pick one.
6. Bullet „Escolha uma melhoria no fim de cada semana do jogo.“ — matches „melhoria“; the game shows it as a crate
   („caixa“) in the „Hangar“.
7. Bullet „Encare o desafio diário com o mesmo mundo inicial para todos.“ — matches the game („desafio diário“, menu
   hint „o mesmo mundo para todos“).
8. Paragraph 4: „um relatório de causas“ — the game calls it „Relatório de incidente ATC“ with „Três causas
   principais“; „um relatório do incidente mostra o que deu errado“ uses the game's words. „mantenha os hubs lotados
   sob controle“ is fine.
9. The U7 EN proposal adds four bullets (home region, weekly contract, demand surges, licence classes). Game-draft
   terms to reuse: „região de origem“, „contrato“ / „conhecimento aéreo“ and „quarta caixa“, „onda de passageiros“
   (announced a day ahead; the current paragraph 2 already says „ondas de passageiros“), „classe de licença II/III“
   with „toque de recolher noturno“. Not the weather front (DEV only, D-274).
10. Last line „Idioma: no momento, o jogo está disponível em inglês e polonês.“ stays until Portuguese ships (D-230).

### App Store keywords (98/100 bytes)

`aviação,aeroporto,voo,avião,rede,conexão,estratégia,quebra-cabeça,logística,viagem,terra,3d`

- No word of the title or subtitle is repeated (D-229); „hub“ is in the subtitle, „rotas“ and „globo“ in the title.
- 2 bytes free, so no new word fits. „terra“ is the weakest term; „mundo“ (same 5 bytes) is the game's word for the
  daily world, „aérea“ (6) would need one byte elsewhere. A choice for the reviewer.

### Play feature graphic alt text (115/140)

- „Placa da Airway ao lado de um globo 3D ao entardecer …“ describes the current `feature-graphic.png` (pre-Linoryt).
  The graphic is redrawn at U7; translate the alt text from the new EN line then.
- „da Airway“ treats the name as the airline (feminine); the game draft says „o Airway“ / „do Airway“ (the game,
  masculine: `gl.unsupported.body`, `licenses.intro`, `save.error.unsupported`). Pick one for both.

### Play alt text (one line per scene)

| # | Scene | Count | Note |
|---|---|---|---|
| 1 | night | 130 | „rosas dos aeroportos“ are the Róża compass roses, removed with D-301. Redo at U7 |
| 2 | game | 133 | „o mostrador de 24 horas“ is the Róża day dial; Linoryt has a day bar (D-285). Redo at U7 |
| 3 | upgrade | 125 | „caixas de carga“, „turboélice“, „ampliação de um hub“ match the game draft; „widebody“ against the draft's „avião de fuselagem larga“ (open term 1 in `docs/i18n/README.md`); „escolhe-se uma“ is formal, the game says „Você abre uma.“ |
| 4 | failure | 114 | „Network closed“ is quoted in English, correct while the shots are English; „Rede fechada“ once they are Portuguese. „hub congestionado“ and „linha do tempo“ match the game |
| 5 | menu | 127 | „no arco de uma rosa dos ventos“ is the Róża menu (D-301; Linoryt prints an index under the globe, D-286). „voo sem fim“, „quebra-cabeças“, „diário“ (menu „Diário“) and „ajustes“ match; „mundo do dia“: the game says „Hoje {date}“ / „desafio diário“. Redo at U7 |

## Glossary check: store draft against game draft

| Store `pt-br.md` | Game `pt.json` | Verdict |
|---|---|---|
| hub, hubs | hub, hubs | Same |
| rede aérea, rede | rede (tagline „rede aérea“) | Same |
| rotas | rota | Same |
| modo Sem fim | Voo sem fim (logbook: Sem fim) | Align the store at U7 |
| desafio diário | desafio diário | Same |
| mundo do dia (alt 5) | Hoje {date} | Align at U7 |
| melhoria | melhoria | Same |
| caixas de carga | caixa, Carga | Same |
| turboélice | turboélice (dock tag „Turboélice“) | Same |
| widebody | avião de fuselagem larga (dock tag „Fus. larga“) | Reviewer decides (README open term 1) |
| ampliação de um hub | Ampliar hub | Same |
| áreas de espera | área de espera | Same |
| relatório de causas | Relatório de incidente ATC, causas | Prefer the game's words |
| lotado, sobrecarregado | congestionamento, congestionado; lotado (puzzle) | Same family; reviewer may unify |
| fazer conexão | conexão | Same |
| viajantes | Viajantes (HUD label) | Same |
| diário (alt 5) | Diário (menu), diário de bordo | Same |
| ajustes (alt 5) | Ajustes | Same |
| Airway (feminine, alt) | o Airway (masculine) | Pick one |
| controlador de tráfego aéreo | (not in the game) | Fine |
| você | você | Same register |
