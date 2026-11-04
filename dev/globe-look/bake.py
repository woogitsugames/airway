#!/usr/bin/env python3
"""ext/03 globe-look experiment: bake public-domain rasters into the textures the DEV-only looks use.

Not part of the build. Run once (outputs are committed under dev/globe-look/assets/):

    python3 -I dev/globe-look/bake.py <download-dir>

<download-dir> must hold (all public domain, see docs/ASSETS.md "Globe look experiment"):
  BlackMarble_2016_3km.jpg                  NASA Black Marble 2016 (night lights)
      https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/
  ETOPO5.DAT                                NOAA ETOPO5 5-arc-minute relief (int16 BE, 4320x2160, lon 0..360, 90N first)
      https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO5/TOPO/ETOPO5/ETOPO5.DAT
  world.topo.bathy.200407.3x5400x2700.jpg  NASA Blue Marble Next Generation, July 2004, topography + bathymetry (B, C, Mapa)
      https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/

Outputs (equirectangular, lon -180..180 left to right, 90N at the top):
  satellite-day-{4096,2048}.jpg   B: Blue Marble, slightly graded (contrast, less haze)
  satellite-night-{2048,1024}.jpg B: Black Marble lights only (black floor removed)
  map-{4096,2048}.jpg             D-172 "Mapa" mode: own cartographic palette + hillshade + country borders
                                  (also needs borders.json from `node dev/globe-look/borders.mjs` in <download-dir>)
  clouds-2048.png                 B: procedural cloud cover (own work, CC0), alpha in the red channel
  painted-{4096,2048}.jpg         C: Blue Marble July simplified (palette + mode filter) + own bathymetry ramp
  painted-night-1024.jpg          C: Black Marble lights, blurred and posterised to warm dots
  elevation-2048.png              B/C: land elevation, 8 bit, value = round(255 * sqrt(clamp(m, 0, 8000) / 8000))
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent / 'assets'
OUT.mkdir(exist_ok=True)


def save_jpg(img: Image.Image, name: str, quality: int = 84) -> None:
    img.save(OUT / name, quality=quality, optimize=True, progressive=True)
    print(name, (OUT / name).stat().st_size)


def etopo() -> np.ndarray:
    """Metres, 2160x4320, recentred so column 0 is lon -180."""
    raw = np.fromfile(SRC / 'ETOPO5.DAT', dtype='>i2').reshape(2160, 4320).astype(np.float32)
    return np.roll(raw, 2160, axis=1)


def blur(a: np.ndarray, r: int) -> np.ndarray:
    """Three box passes (~Gaussian) of radius r, wrapping in longitude."""
    out = a.astype(np.float32)
    for _ in range(3):
        for axis in (0, 1):
            acc = np.zeros_like(out)
            for d in range(-r, r + 1):
                acc += np.roll(out, d, axis=axis) if axis == 1 else np.take(out, np.clip(np.arange(out.shape[0]) + d, 0, out.shape[0] - 1), axis=0)
            out = acc / (2 * r + 1)
    return out


def resize_float(a: np.ndarray, w: int, h: int) -> np.ndarray:
    return np.asarray(Image.fromarray(a, mode='F').resize((w, h), Image.BILINEAR))


def bake_satellite(elev: np.ndarray) -> None:
    # D-176: July (owner): a green northern hemisphere; November was the first mockup round.
    day = Image.open(SRC / 'world.topo.bathy.200407.3x5400x2700.jpg').convert('RGB')
    a = np.asarray(day).astype(np.float32) / 255
    # Gentle grade: remove some atmospheric haze, a touch more contrast; never oversaturate.
    a = np.clip((a - 0.02) * 1.08, 0, 1) ** 1.05
    graded = Image.fromarray((a * 255 + .5).astype(np.uint8))
    for w in (4096, 2048):
        save_jpg(graded.resize((w, w // 2), Image.LANCZOS), f'satellite-day-{w}.jpg')
    night = Image.open(SRC / 'BlackMarble_2016_3km.jpg').convert('L')
    for w in (2048, 1024):
        n = np.asarray(night.resize((w, w // 2), Image.LANCZOS)).astype(np.float32) / 255
        n = np.clip((n - 0.12) / 0.88, 0, 1) ** 1.4  # drop the dark land/sea floor, keep the lights
        save_jpg(Image.fromarray((n * 255 + .5).astype(np.uint8)), f'satellite-night-{w}.jpg', 80)


def fbm(w: int, h: int, seed: int, octaves: int = 6) -> np.ndarray:
    """Tileable-in-longitude value noise (own work)."""
    rng = np.random.default_rng(seed)
    total = np.zeros((h, w), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        gw, gh = 4 * 2 ** o, 2 * 2 ** o
        grid = rng.random((gh + 1, gw)).astype(np.float32)
        grid = np.concatenate([grid, grid[:, :1]], axis=1)  # wrap in longitude
        layer = np.asarray(Image.fromarray(grid, mode='F').resize((w, h), Image.BICUBIC))
        total += layer * amp
        norm += amp
        amp *= 0.55
    return total / norm


def bake_clouds() -> None:
    w, h = 2048, 1024
    n = fbm(w, h, 11)
    lat = np.linspace(90, -90, h)[:, None]
    # More cloud in the storm tracks (~55°) and the ITCZ, less over the subtropical highs (~25°).
    belt = 0.55 + 0.25 * np.exp(-((np.abs(lat) - 55) / 12) ** 2) + 0.18 * np.exp(-(lat / 7) ** 2) \
        - 0.2 * np.exp(-((np.abs(lat) - 25) / 9) ** 2)
    c = np.clip((n * belt - 0.36) / 0.22, 0, 1) ** 1.6
    img = Image.fromarray((c * 255 + .5).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    img.save(OUT / 'clouds-2048.png', optimize=True)
    print('clouds-2048.png', (OUT / 'clouds-2048.png').stat().st_size)


def bake_painted(elev: np.ndarray) -> None:
    """C: Blue Marble July colours, simplified into flat painted areas (palette + mode filter), own sea ramp."""
    w, h = 4096, 2048
    src = Image.open(SRC / 'world.topo.bathy.200407.3x5400x2700.jpg').convert('RGB').resize((w, h), Image.LANCZOS)
    e = resize_float(elev, w, h)
    rgb = np.asarray(src).astype(np.float32) / 255
    # Land: a little warmer and more saturated than the photo, haze removed (a painter's "true colour").
    lum = rgb.mean(axis=2, keepdims=True)
    land = np.clip(lum + (rgb - lum) * 1.35, 0, 1) ** 0.78
    # Sea: own ramp by ETOPO depth (shelf turquoise -> open-sea blue -> deep navy).
    depth = np.clip(-e, 0, 6000)
    t = np.sqrt(depth / 6000)[..., None]
    shelf = np.array([0.33, 0.62, 0.66]); mid = np.array([0.14, 0.40, 0.56]); deep = np.array([0.08, 0.23, 0.40])
    ocean = np.where(t < 0.3, shelf + (mid - shelf) * (t / 0.3), mid + (deep - mid) * ((t - 0.3) / 0.7))
    # Painted relief: soft hillshade from ETOPO (light from the north-west) and snow caps above ~5.4 km.
    es = blur(np.clip(e, 0, 9000), 2)
    gy, gx = np.gradient(es)
    k = 1 / 450.0
    nx, ny = -gx * k, gy * k
    shade = (nx * -0.6 + ny * 0.6 + 1) / np.sqrt(nx * nx + ny * ny + 1)
    shade = np.clip(0.9 + 0.45 * (shade - 0.6), 0.6, 1.18)[..., None]
    snow = np.clip((es - 5400) / 1200, 0, 1)[..., None] * 0.8
    land = land * shade
    land = land + (np.array([0.94, 0.94, 0.92]) * shade - land) * snow
    blue = (rgb[..., 2] > rgb[..., 0] + 0.04) & (rgb[..., 2] >= rgb[..., 1] - 0.03)
    water = (e < -30) | ((e <= 0) & blue)
    mixed = np.where(water[..., None], ocean, land)
    img = Image.fromarray((np.clip(mixed, 0, 1) * 255 + .5).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))
    # Flat painted areas: a 56-colour palette, then a mode filter on the palette indices (no chroma noise).
    pal = img.quantize(colors=56, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = pal.filter(ImageFilter.ModeFilter(7)).filter(ImageFilter.ModeFilter(3))
    flat = np.asarray(pal.convert('RGB')).astype(np.float32)
    soft = np.asarray(img.filter(ImageFilter.GaussianBlur(3))).astype(np.float32)
    out = Image.fromarray(np.clip(flat * 0.62 + soft * 0.38, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    for size in (4096, 2048):
        save_jpg(out.resize((size, size // 2), Image.LANCZOS), f'painted-{size}.jpg')
    # Night: Black Marble lights softened into glowing pools (no hard posterised blocks).
    for size in (2048, 1024):
        night = Image.open(SRC / 'BlackMarble_2016_3km.jpg').convert('L').resize((size, size // 2), Image.LANCZOS)
        n = np.asarray(night.filter(ImageFilter.GaussianBlur(size / 1400))).astype(np.float32) / 255
        n = np.clip((n - 0.14) / 0.86, 0, 1) ** 1.1
        save_jpg(Image.fromarray((n * 255 + .5).astype(np.uint8)), f'painted-night-{size}.jpg', 80)


def bake_map(elev: np.ndarray) -> None:
    """D-172 "Mapa": a cartographic surface in our own palette (vegetation sage, dry cream, ice white, light sea),
    a soft ETOPO hillshade so it is never flat, and Natural Earth country borders (borders.json from borders.mjs)."""
    import json
    w, h = 4096, 2048
    src = Image.open(SRC / 'world.topo.bathy.200407.3x5400x2700.jpg').convert('RGB').resize((w, h), Image.LANCZOS)
    rgb = np.asarray(src.filter(ImageFilter.GaussianBlur(2))).astype(np.float32) / 255
    e = resize_float(elev, w, h)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    green = np.clip(((g - r) / (g + r + 1e-4) + 0.06) / 0.07, 0, 1)  # vegetation: green above red
    bright = rgb.mean(axis=2)
    ice = np.clip((bright - 0.62) / 0.15, 0, 1) * (np.abs(b - r) < 0.08)
    lat = np.linspace(90, -90, h)[:, None]
    ice = np.maximum(ice, (np.abs(lat) > 60) * np.clip((bright - 0.5) / 0.2, 0, 1))
    dry = np.array([0.95, 0.92, 0.83]); veg = np.array([0.74, 0.87, 0.72]); dense = np.array([0.62, 0.80, 0.62])
    snow = np.array([0.97, 0.97, 0.96])
    t = green[..., None]
    land = dry + (veg - dry) * np.clip(t * 1.6, 0, 1)
    land = land + (dense - land) * np.clip((t - 0.6) / 0.4, 0, 1)
    land = land + (snow - land) * ice[..., None]
    # Soft relief: the same hillshade as C, half strength, so mountains read but areas stay flat colours.
    es = blur(np.clip(e, 0, 9000), 2)
    gy, gx = np.gradient(es)
    nx, ny = -gx / 450.0, gy / 450.0
    shade = (nx * -0.6 + ny * 0.6 + 1) / np.sqrt(nx * nx + ny * ny + 1)
    land = land * np.clip(0.95 + 0.25 * (shade - 0.6), 0.8, 1.08)[..., None]
    depth = np.clip(-e, 0, 6000)
    tt = np.sqrt(depth / 6000)[..., None]
    sea = np.array([0.64, 0.82, 0.90]) + (np.array([0.56, 0.77, 0.87]) - np.array([0.64, 0.82, 0.90])) * np.clip(tt / 0.4, 0, 1)
    blue = (b > r + 0.04) & (b >= g - 0.03)
    water = (e < -30) | ((e <= 0) & blue)
    out = np.where(water[..., None], sea, land)
    img = Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8))
    pal = img.quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).filter(ImageFilter.ModeFilter(5))
    img = Image.fromarray((np.asarray(pal.convert('RGB')).astype(np.float32) * 0.7 +
                           np.asarray(img).astype(np.float32) * 0.3).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    # Country borders: thin warm grey, drawn at 2x and downsampled for smooth lines.
    big = img.resize((w * 2, h * 2), Image.BILINEAR)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(big)
    for line in json.loads((SRC / 'borders.json').read_text()):
        pts = [((lon + 180) / 360 * w * 2, (90 - la) / 180 * h * 2) for lon, la in line]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            if abs(x1 - x0) < w:  # skip the antimeridian jump
                draw.line([(x0, y0), (x1, y1)], fill=(122, 120, 112), width=3)
    img = big.resize((w, h), Image.LANCZOS)
    for size in (4096, 2048):
        save_jpg(img.resize((size, size // 2), Image.LANCZOS), f'map-{size}.jpg', 88)


def bake_elevation(elev: np.ndarray) -> None:
    e = resize_float(elev, 2048, 1024)
    v = np.sqrt(np.clip(e, 0, 8000) / 8000)
    Image.fromarray((v * 255 + .5).astype(np.uint8)).save(OUT / 'elevation-2048.png', optimize=True)
    print('elevation-2048.png', (OUT / 'elevation-2048.png').stat().st_size)


if __name__ == '__main__':
    elevation = etopo()
    only = sys.argv[2:] or ['elevation', 'satellite', 'clouds', 'painted']
    if 'elevation' in only: bake_elevation(elevation)
    if 'satellite' in only: bake_satellite(elevation)
    if 'clouds' in only: bake_clouds()
    if 'painted' in only: bake_painted(elevation)
    if 'map' in only: bake_map(elevation)
