# Nowe UI — 3 kierunki (noc 11ah, 2026-11-04)

Opis, rekomendacja i porównanie: [`docs/styles/ui-2026-11/KIERUNKI.md`](../../styles/ui-2026-11/KIERUNKI.md),
diagnoza dzisiejszego UI: [`DIAGNOZA.md`](../../styles/ui-2026-11/DIAGNOZA.md).

| Plik | Co pokazuje |
|---|---|
| `zestawienie-{game-p,game-l,menu-p}.png` | dziś + trzy kierunki obok siebie |
| `<karta|kokpit|znaki>/game-p.png` | gra, pion 412×915 (@2x) |
| `<karta|kokpit|znaki>/game-l.png` | gra, poziom 915×412 (@2x) |
| `<karta|kokpit|znaki>/menu-p.png` | menu główne 412×915 (@2x) |
| `_frames/{game-p,game-l,menu-p}.png` | tło: prawdziwy render gry bez UI (wspólne dla wszystkich) |
| `_frames/dzis-*.png` | ten sam kadr z dzisiejszym UI (PL) |

Odtworzenie: `node mockups/ui-2026-11/shoot.mjs` (wszystko) albo `… shoot.mjs karta|kokpit|znaki|sheet`.
Tła z gry: `npm run dev`, potem `?storeShot=game|menu` (seed 0xA1A1, grafika „high”, `pl-PL`), UI ukryte przez
`body *{visibility:hidden} canvas{visibility:visible}`.

## KARTA v2 — 3 warianty (noc 11ay, 2026-11-05)
Opis i rekomendacja: [`docs/styles/ui-2026-11/KARTA-V2.md`](../../styles/ui-2026-11/KARTA-V2.md).
`v2/zestawienie.png` (dziś KARTA | A | B | C), `v2/<a|b|c>/{game-p,game-l,jam,menu-p}.png`,
`v2/_frames/` = tła bez medalionów lotnisk (`python3 mockups/ui-2026-11/v2/clean-frames.py`).
Odtworzenie: `node mockups/ui-2026-11/v2/shoot.mjs [a|b|c|sheet]`.
