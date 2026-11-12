# Bakes the night-lights equirect texture from Natural Earth populated places (public domain).
# usage: python3 -I prep-data.py <places.geojson> <out-dir>
import json, sys, math
import numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
W, H = 4096, 2048
g = json.load(open(src))
img = np.zeros((H, W), np.float32)
for f in g['features']:
    lon, lat = f['geometry']['coordinates']; p = f['properties']
    pop = max(p.get('pop_max') or 0, p.get('pop_min') or 0)
    if pop < 80000: continue
    x = (lon + 180) / 360 * W; y = (90 - lat) / 180 * H
    v = min(1.0, 0.50 + math.log10(pop / 80000) * 0.38)
    r = 0.55 + math.log10(pop / 80000) * 0.85
    # dot widens toward the poles in equirect space
    sx = r / max(0.25, math.cos(math.radians(lat)))
    x0, x1 = int(x - 4 * sx), int(x + 4 * sx) + 1
    ys = np.arange(int(y - 4 * r), int(y + 4 * r) + 2)
    xs = np.arange(x0, x1)
    if ys[0] < 0 or ys[-1] >= H: continue
    gy = np.exp(-((ys - y) ** 2) / (2 * r * r))[:, None]
    gx = np.exp(-((xs - x) ** 2) / (2 * sx * sx))[None, :]
    patch = v * gy * gx
    for i, xx in enumerate(xs):
        img[ys[0]:ys[-1] + 1, xx % W] += patch[:, i]
img = np.clip(img, 0, 1)
im = Image.fromarray((img * 255).astype(np.uint8))
im = im.filter(ImageFilter.GaussianBlur(0.5))
im.save(out + '/lights.png')
