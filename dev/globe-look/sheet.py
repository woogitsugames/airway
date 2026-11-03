#!/usr/bin/env python3
"""ext/03: side-by-side sheets of the globe-look renders (python3 -I dev/globe-look/sheet.py <dir>)."""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DIR = Path(sys.argv[1])
LOOKS = [('diorama', 'Dziś (diorama)'), ('refined', 'A  Dopracowana diorama'), ('satellite', 'B  Realistyczny'),
         ('painted', 'C  Pomiędzy'), ('map', 'Tryb Mapa (D-172)')]
FONT = Path(__file__).resolve().parents[2] / 'public/fonts'


def font(size):
    for name in [FONT / 'Overpass-800.ttf', *sorted(FONT.glob('*.ttf'))]:
        try:
            return ImageFont.truetype(str(name), size)
        except OSError:
            continue
    return ImageFont.load_default()


for size, scale in (('phone', 1.0), ('fold', 0.36)):
    for time in ('day', 'dusk'):
        frames = [(label, DIR / f'{look}-{time}-{size}.png') for look, label in LOOKS]
        frames = [(label, Image.open(path).convert('RGB')) for label, path in frames if path.exists()]
        if not frames:
            continue
        w, h = (int(frames[0][1].width * scale), int(frames[0][1].height * scale))
        pad, head = 12, 44
        sheet = Image.new('RGB', (len(frames) * (w + pad) + pad, h + head + pad), (247, 243, 234))
        draw = ImageDraw.Draw(sheet)
        f = font(22)
        for i, (label, img) in enumerate(frames):
            x = pad + i * (w + pad)
            draw.text((x, 10), label, fill=(19, 48, 46), font=f)
            sheet.paste(img.resize((w, h), Image.LANCZOS), (x, head))
        out = DIR / f'compare-{time}-{size}.png'
        sheet.save(out, optimize=True)
        print(out.name, sheet.size)
