#!/usr/bin/env python3
"""ext/03 G9 (D-175): airport/route variants side by side (python3 -I dev/globe-look/sheet_g9.py)."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'docs/mockups/globe-2026-11'
G9 = BASE / 'g9'
FONT = ImageFont.truetype(str(ROOT / 'public/fonts/Overpass-800.ttf'), 22)
COLS = [('', 'Dziś'), ('ink', 'V1 Tusz'), ('apron', 'V2 Płyta'), ('medal', 'V3 Medalion')]
for size, scale in (('phone', 1.0), ('fold', 0.4)):
    rows = [('satellite', 'day'), ('map', 'day')] + ([('satellite', 'dusk')] if size == 'phone' else [])
    cells = []
    for look, time in rows:
        row = []
        for style, _ in COLS:
            path = (BASE / f'{look}-{time}-{size}.png') if not style else (G9 / f'{look}-{style}-{time}-{size}.png')
            row.append(Image.open(path).convert('RGB') if path.exists() else None)
        cells.append(row)
    first = next(c for r in cells for c in r if c)
    w, h = int(first.width * scale), int(first.height * scale)
    pad, head = 12, 44
    sheet = Image.new('RGB', (len(COLS) * (w + pad) + pad, head + len(rows) * (h + pad)), (247, 243, 234))
    draw = ImageDraw.Draw(sheet)
    for c, (_, label) in enumerate(COLS):
        draw.text((pad + c * (w + pad), 10), label, fill=(19, 48, 46), font=FONT)
        for r, row in enumerate(cells):
            if row[c]:
                sheet.paste(row[c].resize((w, h), Image.LANCZOS), (pad + c * (w + pad), head + r * (h + pad)))
    out = G9 / f'compare-g9-{size}.png'
    sheet.save(out, optimize=True)
    print(out.name, sheet.size)
