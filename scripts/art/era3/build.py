# Era III asset builder. usage: python3 build.py [part ...]   (default: all) -> ../out/
import sys, math, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pal import *
from PIL import Image

from helpers import *

# ---------------------------------------------------------------- boiler
def boiler():
    a = load(G + 'boiler-0.png')
    a = recolor(a, {'e0': 'r2'})                       # ember only as accent: bricks/rust -> rust ramp
    a = recolor(a, {'r5': 'r3', 'r4': 'r3', 'r3': 'r2', 'r2': 'r1'}, region=(76, 96, 0, 128))   # brick setting one value step darker (less orange area)
    # closed fire door plate in the window (cols 104..112, rows 60..68)
    rect(a, 104, 60, 112, 68, 'i2')
    hline(a, 104, 112, 60, 'i3'); vline(a, 104, 60, 68, 'i3')
    hline(a, 104, 112, 68, 'i1'); vline(a, 112, 60, 68, 'i1')
    for x in (106, 108, 110): put(a, x, 62, 'i0'); put(a, x, 63, 'e0')   # air-vent slots, dim ember
    rect(a, 106, 66, 110, 66, 'i4'); put(a, 110, 65, 'i4')                # latch bar
    # chimney seat plate on the smokebox top (cols 2..19, top row 18), fills down to the smokebox outline
    for x in range(2, 20):
        top = next(y for y in range(96) if a[y, x, 3])
        for y in range(18, top): put(a, x, y, 'i2')
        put(a, x, 18, 'ink'); put(a, x, 19, 'i4' if x < 12 else 'i3')
    vline(a, 2, 18, 22, 'ink'); vline(a, 19, 18, 22, 'ink')
    for x in (5, 9, 13, 17): put(a, x, 20, 'i5' if x < 12 else 'i4')
    check(a, 'boiler'); save(a, O + 'boiler.png'); return a

# ---------------------------------------------------------------- chimney 32x160, stack cols 9..22
def chimney():
    W, H = 32, 160; a = blank(W, H)
    x0, x1 = 9, 22
    for y in range(12, 148):
        for x in range(x0, x1 + 1): put(a, x, y, iron_col(x, x0, x1))
    # hoops every 18 rows
    for hy in range(24, 146, 18):
        for x in range(x0 - 1, x1 + 2):
            put(a, x, hy, 'i4' if x < x1 - 2 else 'i2'); put(a, x, hy + 1, 'i1' if x > x0 else 'i2')
        put(a, x0 - 1, hy, 'ink'); put(a, x0 - 1, hy + 1, 'ink'); put(a, x1 + 1, hy, 'ink'); put(a, x1 + 1, hy + 1, 'ink')
        for x in range(x0 + 2, x1, 3): put(a, x, hy + 1, 'i5' if x < 15 else 'i3')
    # crown: flare rows 6..11, lip rows 2..5
    for i, y in enumerate(range(6, 12)):
        w = 13 - i // 2                           # half-width at row
        lo, hi = 16 - w, 15 + w
        lo = max(lo, x0 - 3 + i // 2); hi = min(hi, x1 + 3 - i // 2)
        for x in range(lo, hi + 1): put(a, x, y, iron_col(x, lo, hi))
    for y in (2, 3, 4, 5):
        for x in range(4, 28): put(a, x, y, iron_col(x, 4, 27))
    hline(a, 4, 27, 2, 'ink'); hline(a, 5, 26, 3, 'i5'); hline(a, 4, 27, 5, 'i1'); put(a, 4, 3, 'ink'); put(a, 27, 3, 'ink')
    hline(a, 6, 25, 1, 'ink'); hline(a, 7, 24, 0, 'ink')     # dark mouth seen over the lip
    for x in range(4, 28):
        put(a, x, 6, 'ink' if x in (6, 25) else a_name(a, x, 6))
    # soot streaks under the crown
    for (x, y0, y1) in ((12, 12, 19), (13, 12, 15), (18, 12, 22), (19, 12, 16), (15, 12, 14)):
        vline(a, x, y0, y1, 'i0' if x > 14 else 'i1')
    # rust clusters (patches, not uniform)
    for (x, y) in ((11, 44), (12, 44), (12, 45), (11, 46), (12, 46), (13, 45), (17, 79), (18, 79), (18, 80), (19, 80), (17, 81),
                   (12, 98), (13, 98), (12, 99), (13, 100), (14, 99), (19, 116), (20, 117), (19, 118), (11, 133), (12, 134), (12, 135),
                   (16, 62), (16, 63), (17, 63), (20, 60), (20, 61), (14, 140), (15, 140), (15, 141)):
        put(a, x, y, 'r3' if x < 15 else 'r2')
    for (x, y) in ((12, 45), (18, 80), (13, 99), (12, 134)): put(a, x, y, 'r4')
    # petticoat + base flange
    for i, y in enumerate(range(148, 154)):
        lo, hi = x0 - 1 - i // 3, x1 + 1 + i // 3
        for x in range(lo, hi + 1): put(a, x, y, iron_col(x, lo, hi))
    for y in range(154, 160):
        for x in range(7, 25): put(a, x, y, iron_col(x, 7, 24))
    hline(a, 7, 24, 154, 'ink'); hline(a, 8, 23, 155, 'i4'); hline(a, 7, 24, 159, 'ink')
    for x in range(9, 24, 4): put(a, x, 157, 'i5' if x < 16 else 'i3')
    for (x, y) in ((21, 156), (22, 157), (20, 156), (9, 158), (10, 158)): put(a, x, y, 'r2')
    check(a, 'chimney'); save(a, O + 'chimney.png'); return a

def a_name(a, x, y):
    return name(a, x, y)

from parts2 import *
PARTS = {'boiler': boiler, 'chimney': chimney, **PARTS2}
if __name__ == '__main__':
    for p in (sys.argv[1:] or list(PARTS)):
        PARTS[p]()
        print('built', p)
