# Imhof-style hillshade (two lights, NW-biased) + smooth elevation texture from the project's ETOPO5 raster
# (public domain, NOAA). Everything in float, so no 8-bit stair-steps reach the shading.
# usage: python3 -I prep-relief.py <repo>/public/data/globe/elevation-2048.png <out-dir>
import sys, math
import numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
W, H = 4096, 2048
e = Image.open(src).convert('L').resize((W, H), Image.BICUBIC)
m = (np.asarray(e, np.float32) / 255.0) ** 2 * 8000.0

def box(a, r, axis):
    n = a.shape[axis]
    pad = [(0, 0), (0, 0)]; pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode='wrap' if axis == 1 else 'edge'), axis=axis, dtype=np.float64)
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)
def blur(a, r, k=3):
    for _ in range(k):
        a = box(box(a, r, 0), r, 1)
    return a
mb = blur(m, 10)                                      # palette base: ETOPO5 plateaus in the plains are blocky, smooth them
mh = blur(m, 5)                                       # hillshade base

lat = (90 - (np.arange(H) + 0.5) / H * 180)
px_y = 20015e3 / H                                    # metres per pixel north-south
px_x = (40075e3 / W) * np.maximum(np.cos(np.radians(lat)), 0.12)[:, None]
dzdy, dzdx = np.gradient(mh)
dzdx = dzdx / px_x; dzdy = dzdy / px_y                # image y grows southwards
Z = 3.0                                               # relief exaggeration, as on atlas plates
def shade(az, alt):
    a, h = math.radians(az), math.radians(alt)
    fade = np.clip((mh - 250.0) / 900.0, 0, 1)            # plains keep the source's own (smooth) shading
    nx, ny, nz = -dzdx * Z * fade, dzdy * Z * fade, np.ones_like(mb)
    n = np.sqrt(nx * nx + ny * ny + nz * nz)
    lx, ly, lz = math.sin(a) * math.cos(h), math.cos(a) * math.cos(h), math.sin(h)
    return (nx * lx + ny * ly + nz * lz) / n - math.sin(h)
s = np.clip((0.7 * shade(315, 38) + 0.3 * shade(20, 45)) * 5.0, -1, 1)
Image.fromarray((128 + s * 120).astype(np.uint8)).save(out + '/relief.png')
# elevation, sqrt-coded 8 bit with dither (decoded in the shader: m = (v/255)^2 * 8000)
v = np.sqrt(np.clip(mb, 0, 8000) / 8000.0) * 255.0
v = v + np.random.default_rng(7).uniform(-0.5, 0.5, v.shape)
Image.fromarray(np.clip(np.round(v), 0, 255).astype(np.uint8)).save(out + '/elev.png')
# soft tint map (greenness / humidity of the Natural Earth raster), 1024x512, wrapped blur
try:
    day = Image.open(out + '/day.jpg').convert('RGB').resize((1024, 512), Image.BOX)
    a = np.asarray(day, np.float32)
    for ch in range(3):
        a[..., ch] = blur(a[..., ch], 5, 2)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out + '/tint.png')
except FileNotFoundError:
    pass
