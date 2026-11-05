# KARTA v2: remove the airport medallions baked into the real game frames (docs/mockups/ui-2026-11/_frames)
# so the mockups can propose new airport markers. Harmonic (Laplace) fill of each masked disc from its border.
# Usage: python3 mockups/ui-2026-11/v2/clean-frames.py   (needs Pillow + numpy)
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
SRC = os.path.join(REPO, 'docs/mockups/ui-2026-11/_frames')
OUT = os.path.join(REPO, 'docs/mockups/ui-2026-11/v2/_frames')
S = 2  # frames are DPR 2
# (x, y, rx, ry) in CSS px; keep in sync with common/data.js AIRPORTS (+ margin for the black rim).
DISCS = {
    'game-p': [(150, 290, 25, 23), (58, 367, 25, 23), (121, 430, 40, 37), (194, 413, 26, 25),
               (218, 488, 40, 37), (291, 474, 27, 26)],
    'game-l': [(360, 129, 21, 16), (282, 183, 21, 17), (330, 229, 33, 29), (392, 215, 22, 19),
               (413, 275, 34, 31), (475, 263, 24, 21), (637, 320, 18, 22)],
    'menu-p': [(314, 290, 22, 21), (252, 336, 24, 21), (291, 345, 33, 31), (313, 368, 19, 17),
               (289, 434, 34, 32), (256, 450, 24, 23), (269, 492, 24, 22), (195, 667, 27, 26)],
}

def fill(img, discs):
    a = img.astype(np.float32)
    h, w, _ = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    rng = np.random.default_rng(7)
    for x, y, rx, ry in discs:
        d = ((xx - x * S) / (rx * S)) ** 2 + ((yy - y * S) / (ry * S)) ** 2
        m_full = d <= 1
        ring = (d > 1) & (d <= 1.5)
        a[m_full] = a[ring].mean(axis=0)  # start from the surrounding colour, not grey
        pad = 4
        y0, y1 = max(0, int((y - ry) * S) - pad), min(h, int((y + ry) * S) + pad)
        x0, x1 = max(0, int((x - rx) * S) - pad), min(w, int((x + rx) * S) + pad)
        sub = a[y0:y1, x0:x1]; m = m_full[y0:y1, x0:x1]
        for _ in range(2500):
            avg = (np.roll(sub, 1, 0) + np.roll(sub, -1, 0) + np.roll(sub, 1, 1) + np.roll(sub, -1, 1)) / 4
            sub[m] = avg[m]
        # a little grain so the patch does not read as a smooth blob on the photo
        sub[m] += rng.normal(0, 4.0, (m.sum(), 3))
    return np.clip(a, 0, 255).astype(np.uint8)

os.makedirs(OUT, exist_ok=True)
for name, discs in DISCS.items():
    img = np.array(Image.open(os.path.join(SRC, name + '.png')).convert('RGB'))
    Image.fromarray(fill(img, discs)).save(os.path.join(OUT, name + '.png'), optimize=True)
    print('clean', name)
