#!/usr/bin/env python3
"""[night-70a R1] D-323: bake the NASA textures of the realistic globe (`?look=earth`) into public/data/globe/.

Not part of the build. Run once after a deliberate change, then `node scripts/test-globe-assets.mjs --write`:

    python3 -I dev/globe-look/bake-earth.py <download-dir> [webp|jpg]

<download-dir> must hold (both public domain, US Government works, NASA Earth Observatory; docs/ASSETS.md "Globe data"):
  world.topo.bathy.200407.3x5400x2700.jpg  NASA Blue Marble Next Generation, July 2004 (D-176), topography + bathymetry
      https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/
  BlackMarble_2016_3km.jpg                 NASA Black Marble 2016, colour, 13500x6750 (Visible Earth record 144898)
      https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/
(eoimages.gsfc.nasa.gov serves the same files but drops long transfers through the agent proxy.)

Outputs (equirectangular, lon -180..180 left to right, 90N at the top, sRGB):
  day-{4096,2048}.<ext>    Blue Marble July, resized only; the grading (saturation, cooler deep water) is in the shader
  night-{2048,1024}.<ext>  Black Marble, resized; blue base and sodium lights are split in the shader (as in the K2 mockup)
"""
import sys
from pathlib import Path

from PIL import Image

Image.MAX_IMAGE_PIXELS = None
SRC = Path(sys.argv[1])
FMT = sys.argv[2] if len(sys.argv) > 2 else 'webp'
OUT = Path(__file__).resolve().parents[2] / 'public' / 'data' / 'globe'
# Qualities chosen by measurement (night 70a): the smallest files with no visible blocking at the game zoom.
QUALITY = {'webp': {'day': 80, 'night': 78}, 'jpg': {'day': 84, 'night': 82}}


def save(img: Image.Image, name: str, kind: str) -> None:
    path = OUT / f'{name}.{FMT}'
    if FMT == 'webp':
        img.save(path, 'WEBP', quality=QUALITY['webp'][kind], method=6)
    else:
        img.save(path, 'JPEG', quality=QUALITY['jpg'][kind], optimize=True, progressive=False)
    print(path.name, path.stat().st_size)


day = Image.open(SRC / 'world.topo.bathy.200407.3x5400x2700.jpg').convert('RGB')
for w in (4096, 2048):
    save(day.resize((w, w // 2), Image.LANCZOS), f'day-{w}', 'day')
night = Image.open(SRC / 'BlackMarble_2016_3km.jpg')
night.draft('RGB', (6750, 3375))
night = night.convert('RGB')
for w in (2048, 1024):
    save(night.resize((w, w // 2), Image.LANCZOS), f'night-{w}', 'night')
