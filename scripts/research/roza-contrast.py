# [night-13a] Contrast audit of UI variant C "Róża" (docs/styles/ui-2026-11/KARTA-V2.md) against the real globe frames
# (docs/mockups/ui-2026-11/_frames). Research only, not part of any suite. Result: docs/notes/roza-contrast.md.
#
#   python3 scripts/research/roza-contrast.py          (needs Pillow + numpy)
#
# Backgrounds: pixels of the real game frames (DPR 2) in typical label regions (desert, ocean, night side incl. city
# lights, bright neutral = ice/snow/brightest light blocks, Africa under the dock, sky), with the old medallions
# masked out. Per region the darkest and brightest pixel (0.5 / 99.5 percentile of WCAG luminance, plus the absolute
# max) is kept. Colours/widths of the Róża inks are copied from mockups/ui-2026-11/v2/c/c.js and v2/common.js.
#
# For every mark three WCAG 2.x ratios are computed:
#   ink|halo  - ink composited over its halo (the edge the eye reads; constant when the halo is opaque),
#   ink|bg    - ink straight over the worst background (what is left where the halo thins out or anti-aliases),
#   halo|bg   - halo over the worst background (silhouette of the mark).
# Verdict (D-47 threshold 4.5:1 for text and gameplay marks): PASS when ink|halo >= 4.5 and the halo reaches at least
# 1 CSS px beyond the ink, or when ink|bg >= 4.5 on every background without help of the halo.
import os
import numpy as np
from PIL import Image

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
FR = os.path.join(REPO, 'docs/mockups/ui-2026-11/_frames')
S = 2
SKY = np.array([140, 195, 216])
DISCS = {  # old medallions in the frames (CSS px), from mockups/ui-2026-11/v2/clean-frames.py, + margin
    'game-p': [(150, 290, 25, 23), (58, 367, 25, 23), (121, 430, 40, 37), (194, 413, 26, 25),
               (218, 488, 40, 37), (291, 474, 27, 26)],
    'game-l': [(360, 129, 21, 16), (282, 183, 21, 17), (330, 229, 33, 29), (392, 215, 22, 19),
               (413, 275, 34, 31), (475, 263, 24, 21), (637, 320, 18, 22)],
}
# label regions (CSS px boxes x0, y0, x1, y1) where Róża notes, names, dock and dial sit
REGIONS = {
    'pustynia (Sahara, Arabia)': [('game-p', (0, 500, 260, 700)), ('game-l', (60, 270, 420, 412))],
    'ocean (Morze Śródziemne, Czarne, Atlantyk)': [('game-p', (0, 230, 412, 560)), ('game-l', (100, 90, 760, 412))],
    'noc + światła miast': [('game-p', (140, 230, 412, 470)), ('game-l', (380, 90, 760, 330))],
    'Afryka pod dokiem i tarczą': [('game-p', (0, 600, 412, 915))],
    'niebo': [('game-p', (0, 0, 412, 150)), ('game-l', (780, 0, 915, 412))],
}


def lin(c):
    c = np.asarray(c, dtype=np.float64) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lum(c):
    l = lin(c)
    return 0.2126 * l[..., 0] + 0.7152 * l[..., 1] + 0.0722 * l[..., 2]


def ratio(a, b):
    la, lb = float(lum(a)), float(lum(b))
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def over(fg, a, bg):  # sRGB-space alpha compositing, as the browser does for SVG
    return np.asarray(fg, float) * a + np.asarray(bg, float) * (1 - a)


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def region_pixels(frame, box):
    im = np.asarray(Image.open(os.path.join(FR, frame + '.png')).convert('RGB')).astype(float)
    h, w, _ = im.shape
    yy, xx = np.mgrid[0:h, 0:w]
    m = (xx >= box[0] * S) & (xx < box[2] * S) & (yy >= box[1] * S) & (yy < box[3] * S)
    for x, y, rx, ry in DISCS.get(frame, []):
        m &= ((xx - x * S) / (rx * S + 6)) ** 2 + ((yy - y * S) / (ry * S + 6)) ** 2 > 1
    px = im[m]
    return px


def backgrounds():
    out = {}
    for name, parts in REGIONS.items():
        px = np.concatenate([region_pixels(f, b) for f, b in parts])
        sky = np.abs(px - SKY).sum(axis=1) < 12
        if name == 'niebo':
            px = px[sky]
        else:
            px = px[~sky]
            if name.startswith('ocean'):
                px = px[(px[:, 2] > px[:, 0] + 25) & (px[:, 2] > px[:, 1] + 10)]
            if name.startswith('pustynia'):
                px = px[(px[:, 0] > px[:, 2] + 30)]
        L = lum(px)
        o = np.argsort(L)
        lo, hi, mx = px[o[int(len(o) * 0.005)]], px[o[int(len(o) * 0.995)]], px[o[-1]]
        out[name] = {'dark': lo, 'bright': hi, 'max': mx, 'n': len(px)}
    # bright neutral = ice / snow / saturated light blocks: low-saturation pixels anywhere on the globe
    allpx = np.concatenate([region_pixels(f, b) for f, b in [('game-p', (0, 200, 412, 915)), ('game-l', (60, 80, 760, 412))]])
    allpx = allpx[np.abs(allpx - SKY).sum(axis=1) >= 12]
    neu = allpx[(allpx.max(axis=1) - allpx.min(axis=1)) < 40]
    L = lum(neu)
    o = np.argsort(L)
    out['lód / śnieg / najjaśniejszy neutralny piksel'] = {'dark': neu[o[int(len(o) * 0.5)]], 'bright': neu[o[int(len(o) * 0.995)]], 'max': neu[o[-1]], 'n': len(neu)}
    return out


INK, DK, RED = hexc('#F5F2EA'), hexc('#0C1418'), hexc('#EA4A2A')
SKY_INK, SKY_HALO = hexc('#0C1418'), hexc('#EEF3F2')
# name, ink rgb, ink alpha, halo rgb, halo alpha, halo outer width (CSS px), kind, where (globe | sky)
MARKS = [
    ('Nazwa miasta po łuku (Alegreya 700, 13,5 px)', INK, 1, DK, 1, 1.5, 'tekst', 'globe'),
    ('Notka „ATH 14 z 24”, liczby glifów (Atkinson 700, 13,5–14,5 px)', INK, 1, DK, 1, 1.6, 'tekst', 'globe'),
    ('Podpisy doku (Atkinson 400, 12,5 px)', INK, 1, DK, 1, 1.4, 'tekst', 'globe'),
    ('Cyfry tarczy 0/6/12/18, „dzień 2 z 3” (12–12,5 px)', INK, 1, DK, 1, 1.3, 'tekst', 'globe'),
    ('Podpis wyłączony „za 1 dzień” (DIM, biel 55 %)', INK, 0.55, DK, 1, 1.4, 'tekst', 'globe'),
    ('Kreska róży — miejsce zajęte (biel 2,2 px)', INK, 1, DK, 1, 1.1, 'znak', 'globe'),
    ('Kreska róży — miejsce wolne (DIM 1,3 px)', INK, 0.55, DK, 1, 1.1, 'znak', 'globe'),
    ('Pierścień lotniska / tarczy (biel 1,3–1,6 px)', INK, 1, DK, 1, 1.15, 'znak', 'globe'),
    ('Zator: nazwa i notka w cynobrze (tekst)', RED, 1, DK, 1, 1.5, 'tekst', 'globe'),
    ('Zator: łuk odliczania (cynober 4 px)', RED, 1, DK, 1, 1.5, 'znak', 'globe'),
    ('Zator: kreski róży (cynober 2,2 px)', RED, 1, DK, 1, 1.1, 'znak', 'globe'),
    ('Zator: kreska startu łuku (cynober 2 px, bez obwódki)', RED, 1, DK, 1, 0.0, 'znak', 'globe'),
    ('Łuk doku przerywany (DIM 1,2 px na obwódce 70 %)', INK, 0.55, DK, 0.7, 1.1, 'dekor', 'globe'),
    ('Glif pasażera AFR #13302E (obrys ciemny)', hexc('#13302E'), 1, DK, 1, 1.1, 'znak', 'globe'),
    ('Glif pasażera NAM #0072B2 (obrys ciemny)', hexc('#0072B2'), 1, DK, 1, 1.1, 'znak', 'globe'),
    ('Glif pasażera EUN #009E73 (obrys ciemny)', hexc('#009E73'), 1, DK, 1, 1.1, 'znak', 'globe'),
    ('Glif pasażera ME #CC79A7 (obrys ciemny)', hexc('#CC79A7'), 1, DK, 1, 1.1, 'znak', 'globe'),
    ('Glif pasażera SAM #56B4E9 (obrys ciemny)', hexc('#56B4E9'), 1, DK, 1, 1.1, 'znak', 'globe'),
    ('Glif pasażera EUS #E69F00 (obrys ciemny)', hexc('#E69F00'), 1, DK, 1, 1.1, 'znak', 'globe'),
    ('Poziom: tarcza i dok na niebie (czerń na jasnej obwódce)', SKY_INK, 1, SKY_HALO, 1, 1.3, 'tekst', 'sky'),
    ('Poziom: podpis wyłączony na niebie (czerń 50 %)', SKY_INK, 0.5, SKY_HALO, 1, 1.4, 'tekst', 'sky'),
    ('„Tydzień 1”, „34 pasażerów”, „Airway”, pauza (czerń bez obwódki)', SKY_INK, 1, None, 0, 0.0, 'tekst', 'sky'),
]


def fmt(c):
    return '#%02X%02X%02X' % tuple(int(round(v)) for v in c)


def main():
    bgs = backgrounds()
    print('## Tła (WCAG luminancja; 0,5 / 99,5 percentyl, max)')
    for k, v in bgs.items():
        print(f"- {k}: ciemne {fmt(v['dark'])}, jasne {fmt(v['bright'])}, max {fmt(v['max'])} (n={v['n']})")
    print()
    print('| znak | ink│halo | najgorsze tło (ink bez obwódki) | ink│tło | halo│tło (sylwetka) | wynik |')
    print('|---|---|---|---|---|---|')
    for name, ink, ia, halo, ha, hw, kind, where in MARKS:
        cands = [(k, v[t]) for k, v in bgs.items() for t in ('dark', 'bright', 'max')
                 if (k == 'niebo') == (where == 'sky')]
        worst_ib, worst_bg, worst_hb = 99, None, 99
        worst_ih = 99
        for k, bg in cands:
            h = over(halo, ha, bg) if halo is not None else bg
            ih = ratio(over(ink, ia, h), h)
            ib = ratio(over(ink, ia, bg), bg)
            hb = ratio(h, bg) if halo is not None else float('nan')
            worst_ih = min(worst_ih, ih)
            if ib < worst_ib:
                worst_ib, worst_bg = ib, f'{k} {fmt(bg)}'
            if halo is not None:
                worst_hb = min(worst_hb, hb)
        thr = 4.5 if kind != 'dekor' else 3.0
        ok = (worst_ih >= thr and hw >= 1.0) or worst_ib >= thr
        hb = f'{worst_hb:.2f}' if halo is not None else '—'
        print(f'| {name} | {worst_ih:.2f} | {worst_bg} | {worst_ib:.2f} | {hb} | {"PASS" if ok else "FAIL"} (próg {thr}) |')
    # candidate fixes
    print('\n## Kandydaci na poprawki')
    tries = [
        ('AFR glif z jasnym obrysem #F5F2EA', hexc('#13302E'), INK),
        ('AFR glif rozjaśniony #2E6B64 na ciemnym obrysie', hexc('#2E6B64'), DK),
        ('AFR glif #5E9C93 na ciemnym obrysie', hexc('#5E9C93'), DK),
        ('NAM glif #0072B2 z jasnym obrysem', hexc('#0072B2'), INK),
        ('NAM glif rozjaśniony #3D9AD6 na ciemnym obrysie', hexc('#3D9AD6'), DK),
        ('cynober #EA4A2A na #000000', RED, hexc('#000000')),
        ('cynober jaśniejszy #F2603F na DK', hexc('#F2603F'), DK),
        ('cynober #FF6A45 na DK', hexc('#FF6A45'), DK),
        ('DIM 70 % na DK', over(INK, 0.7, DK), DK),
        ('DIM 62 % na DK', over(INK, 0.62, DK), DK),
        ('DIM na niebie 65 % czerni na #EEF3F2', over(SKY_INK, 0.65, SKY_HALO), SKY_HALO),
        ('DIM na niebie 72 % czerni na #EEF3F2', over(SKY_INK, 0.72, SKY_HALO), SKY_HALO),
        ('DIM na niebie #4A5559 (kryjący) na #EEF3F2', hexc('#4A5559'), SKY_HALO),
    ]
    for n, a, b in tries:
        print(f'- {n}: {ratio(a, b):.2f}')
    print(f"- DIM 55 % kompozyt na DK = {fmt(over(INK, .55, DK))}; na niebie 50 % = {fmt(over(SKY_INK, .5, SKY_HALO))}")


if __name__ == '__main__':
    main()
