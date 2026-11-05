# [night-11az] D-257: ratios of the implemented Róża inks over the real game stills taken by e2e/roza-contrast-live.mjs
# (docs/notes/roza-contrast.md measured the mockups; this re-measures the shipped skin, D-47). For every mark: the
# worst background under its boxes (0.5 / 99.5 percentile of WCAG luminance and the absolute max), then
# ink|halo (constant, opaque halo), ink|bg (the halo thinning out) and halo|bg (silhouette).
#   python3 scripts/research/roza-contrast-live.py <dir>      (Pillow + numpy)
import json, os, sys
import numpy as np
from PIL import Image

d = sys.argv[1] if len(sys.argv) > 1 else '.e2e/roza-contrast'
def lin(c):
    c = np.asarray(c, float) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lum(rgb): l = lin(rgb); return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]
def ratio(a, b): a, b = max(a, b), min(a, b); return (a + 0.05) / (b + 0.05)
def hexl(h): return float(lum(np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)])))
CHALK, INK, RED, SKYINK, SKYHALO = '#F5F2EA', '#0C1418', '#F2603F', '#0C1418', '#EEF3F2'
INKS = {  # mark -> (ink, halo) per orientation (landscape dock and dial are sky-inked)
    'tarcza 24 h (kreda/obwódka)': {'p': (CHALK, INK), 'l': (SKYINK, SKYHALO)},
    'dok: symbole (kreda/obwódka)': {'p': (CHALK, INK), 'l': (SKYINK, SKYHALO)},
    'dok: podpisy 12,5 px (kreda/obwódka)': {'p': (CHALK, INK), 'l': (SKYINK, SKYHALO)},
    'tydzień i pasażerowie (czerń/jasna obwódka)': {'p': (SKYINK, SKYHALO), 'l': (SKYINK, SKYHALO)},
    'zator: notka i zdanie (cynober/obwódka)': {'p': (RED, INK), 'l': (RED, INK)},
}
rows = []
for tag in ('p', 'l'):
    bg = np.asarray(Image.open(os.path.join(d, f'bg-{tag}.png')).convert('RGB'))
    L = lum(bg)
    boxes = json.load(open(os.path.join(d, f'boxes-{tag}.json')))
    for name, rects in boxes.items():
        if not rects: continue
        vals = np.concatenate([L[int(y0):int(y1), int(x0):int(x1)].ravel() for x0, y0, x1, y1 in rects])
        if not vals.size: continue
        lo, hi, mx = np.percentile(vals, 0.5), np.percentile(vals, 99.5), vals.max()
        ink, halo = INKS.get(name, {}).get(tag, (CHALK, INK))
        li, lh = hexl(ink), hexl(halo)
        rows.append((tag, name, len(rects), ratio(li, lh), min(ratio(li, lo), ratio(li, mx)), min(ratio(lh, lo), ratio(lh, mx))))
print('| kadr | znak | sztuk | tusz│obwódka | tusz│tło (najgorsze) | obwódka│tło (najgorsze) | D-47 |')
print('|---|---|---|---|---|---|---|')
for tag, name, n, ih, ib, hb in rows:
    print(f'| {"pion" if tag == "p" else "poziom"} | {name} | {n} | {ih:.2f} | {ib:.2f} | {hb:.2f} | {"PASS" if ih >= 4.5 or ib >= 4.5 else "FAIL"} |')
