# eraRecolor (WP23a, Art Director): bakes the 6 era rows of a denizen from ONE colour master, exactly as
# docs/plan/DENIZEN_ART.md Appendix A. Deterministic and palette-only: every output code is one of the 25 colours
# (plus VIOLET_LIGHT on the row V rim). Ported from the WP22-23 denizen proof (tools/build.py era_rows / violet_rim).
#
# Row I    full sepia (SEPIA map; ink and the sand ramp map to themselves).
# Row II   accents come back as faded rust: #d9822b -> #8c4a2a, #f0a848 -> #ad6236; everything else sepia.
# Row III  accents, skin, wood/leather own: #d9822b #f0a848 #c98552 #ad6236 #8c4a2a.
# Row IV   + iron #1f2225 #2b2e31 #3e4246 #5a5f63 own.
# Row V    everything own + VIOLET_LIGHT rim: in every pixel row, each run of >= 7 opaque px gets its first interior
#          pixel on both flanks recoloured violet (the ink outline stays ink).
# whole    everything own.
# Per-sheet pins {code: first own row} delay a colour (e.g. the girl's raincoat yellow returns only in row III).
#
# CLI (debug): python -I erarecolor.py <in.png> <out.png> <row I|II|III|IV|V|whole> [pinCode=rowIndex ...]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pal import PAL, VIOLET_CODE, render, grid  # noqa: E402
from sheets import ERA_ROWS  # noqa: E402

SEPIA = {'0': 'a', '1': 'a', '2': 'b', 'c': 'b', '3': 's', 'd': 's', '4': 't', 'e': 't', 'p': 't',
         '5': 'u', 'f': 'u', 'A': 'u', 'q': 'u', 'B': 'v', 'r': 'v', 'C': 'w', 'x': 'w'}
FADED = {'A': 'd', 'B': 'e'}                                       # row II only
_OWN = {0: '', 1: '', 2: 'ABfed', 3: 'ABfed0123', 4: ''.join(PAL), 5: ''.join(PAL)}
RIM_ROW = ERA_ROWS.index('V')
RIM_MIN_RUN = 7

# the sepia targets are the only colours a row I cell may contain
SEPIA_ROW_CODES = set('K') | set(v for v in SEPIA.values()) | set(c for c in PAL if c not in SEPIA)


def code_for(ch, row, pins=None):
    """One master code -> its code in era row `row` (0..5)."""
    if ch == '.' or ch == 'K':
        return ch
    pins = pins or {}
    if ch in pins:
        return ch if row >= pins[ch] else SEPIA.get(ch, ch)
    if ch in _OWN[row]:
        return ch
    if row == 1 and ch in FADED:
        return FADED[ch]
    return SEPIA.get(ch, ch)


def violet_rim(rows, min_run=RIM_MIN_RUN):
    g = [list(r) for r in rows]
    for y, r in enumerate(rows):
        x = 0
        while x < len(r):
            if r[x] == '.':
                x += 1
                continue
            x0 = x
            while x < len(r) and r[x] != '.':
                x += 1
            x1 = x - 1                                               # run x0..x1 inclusive
            if x1 - x0 + 1 >= min_run:
                for xi in (x0 + 1, x1 - 1):
                    if r[xi] != 'K':
                        g[y][xi] = VIOLET_CODE
    return [''.join(r) for r in g]


def recolor_rows(rows, row, pins=None):
    out = [''.join(code_for(ch, row, pins) for ch in r) for r in rows]
    if row == RIM_ROW:
        out = violet_rim(out)
    return out


def recolor_image(im, row, pins=None):
    return render(recolor_rows(grid(im), row, pins))


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(__doc__ or 'usage: python -I erarecolor.py <in.png> <out.png> <row> [code=row ...]')
        sys.exit(2)
    from PIL import Image
    src, dst, rname = sys.argv[1], sys.argv[2], sys.argv[3]
    pins = {kv.split('=')[0]: int(kv.split('=')[1]) for kv in sys.argv[4:]}
    recolor_image(Image.open(src), ERA_ROWS.index(rname), pins).save(dst)
    print('ok', dst)
