# Living world palette (WP23a, Art Director): the 25 Rust Wasteland colours of docs/plan/ART_BRIEF.md plus
# VIOLET_LIGHT (#9a6ad0, DENIZEN_ART 1.5: era V rim only). One character code per colour, used by every ASCII master.
# Ported from the WP22-23 denizen proof (tools/pal.py). Pure: Pillow only, no side effects on import.
from PIL import Image

PAL = {
    'K': '#14110f',                                                                # ink
    '0': '#1f2225', '1': '#2b2e31', '2': '#3e4246', '3': '#5a5f63', '4': '#7d8286', '5': '#a3a6a4',  # iron
    'a': '#2e1a12', 'b': '#4e2a1a', 'c': '#6e3a22', 'd': '#8c4a2a', 'e': '#ad6236', 'f': '#c98552',  # rust
    's': '#5f5244', 't': '#8a7a64', 'u': '#a8957a', 'v': '#c9b28a', 'w': '#ddc9a3',                  # sand
    'p': '#7a7468', 'q': '#9c9182', 'r': '#b8a98f', 'x': '#d2bf9c',                                  # sky
    'A': '#d9822b', 'B': '#f0a848', 'C': '#ffd27a',                                                  # accent
}
VIOLET_LIGHT = '#9a6ad0'
VIOLET_CODE = 'L'
ALL = dict(PAL, **{VIOLET_CODE: VIOLET_LIGHT})          # 26 codes: the 25 + violet

assert len(PAL) == 25 and len(set(PAL.values())) == 25


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


RGB = {k: rgb(v) for k, v in ALL.items()}
INV = {v: k for k, v in RGB.items()}
PALETTE_RGB = {rgb(v) for v in PAL.values()}          # the 25 only
TRANSPARENT = '.'


def render(rows, w=None):
    """ASCII rows -> RGBA image (alpha 0 or 255 only)."""
    h = len(rows)
    w = w or max(len(r) for r in rows)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, r in enumerate(rows):
        assert len(r) == w, ('row width', y, len(r), w, r)
        for x, ch in enumerate(r):
            if ch != TRANSPARENT:
                px[x, y] = RGB[ch] + (255,)
    return im


def grid(im):
    """RGBA image -> ASCII rows (alpha 0 -> '.'); raises on a colour that has no code."""
    im = im.convert('RGBA')
    px = im.load()
    out = []
    for y in range(im.height):
        s = ''
        for x in range(im.width):
            p = px[x, y]
            s += TRANSPARENT if p[3] == 0 else INV[p[:3]]
        out.append(s)
    return out
