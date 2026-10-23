# A17 legacy-feed art (WP17 parts): hand-pixelled in the locked palette (ART_BRIEF Rust Wasteland + era accents).
# Deterministic: rerun to regenerate every PNG. Alpha 0/255 only, no resampling.
#   python scripts/art/a17/build.py [outRoot] [--no-boiler]   (default outRoot = public/assets)
# Writes machine/legacy/generator-glow.png (384x64, 4 cells), bellows.png (240x28, 4 cells), exciter-feed.png (16x28),
# backfeed-terminal.png (16x28), steam-lance.png (16x32) and patches machine/era3/boiler.png (tuyere collar).
# PixelLab references (style only, not copied): bellows job 5b7182c7 (cand. 16), insulator job c2a50bff (cand. 0),
# valve job 466ec779 (cand. 10).
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
OUT = os.path.abspath(ARGS[0]) if ARGS else os.path.join(ROOT, 'public', 'assets')

PAL = {
    '#': '#14110f', '0': '#1f2225', '1': '#2b2e31', '2': '#3e4246', '3': '#5a5f63', '4': '#7d8286', '5': '#a3a6a4',
    '6': '#2e1a12', '7': '#4e2a1a', '8': '#6e3a22', '9': '#8c4a2a', 'a': '#ad6236', 'b': '#c98552',
    'c': '#5f5244', 'd': '#8a7a64', 'e': '#a8957a', 'f': '#c9b28a', 'g': '#ddc9a3',
    'A': '#d9822b', 'B': '#f0a848', 'C': '#ffd27a',
    'o': '#2f5a62', 'p': '#5fa8b4', 'q': '#bff0ec', 'w': '#e8e0cc', 'E': '#6a2418', 'F': '#b8402a',
    'x': '#24162f', 'y': '#54367a', 'z': '#9a6ad0', 'Z': '#e0c8ff',
}
RGB = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in PAL.items()}
INV = {v: k for k, v in RGB.items()}


def canvas(w, h):
    return np.zeros((h, w, 4), np.uint8)


def put(a, x, y, k):
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]:
        a[y, x] = (0, 0, 0, 0) if k == '.' else RGB[k] + (255,)


def get(a, x, y):
    if not (0 <= y < a.shape[0] and 0 <= x < a.shape[1]) or a[y, x, 3] == 0:
        return '.'
    return INV[tuple(int(c) for c in a[y, x, :3])]


def rect(a, x0, y0, x1, y1, k):  # inclusive
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(a, x, y, k)


def stamp(a, ox, oy, rows, transparent='.'):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != transparent and ch != ' ':
                put(a, ox + i, oy + j, ch)


def outline(a, k='#'):
    """1-px ink outline on transparent pixels 4-adjacent to opaque ones."""
    h, w = a.shape[:2]
    m = a[:, :, 3] > 0
    out = a.copy()
    for y in range(h):
        for x in range(w):
            if m[y, x]:
                continue
            if any(0 <= y + dy < h and 0 <= x + dx < w and m[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y, x] = RGB[k] + (255,)
    return out


def check(a, name):
    al = set(np.unique(a[:, :, 3]).tolist())
    assert al <= {0, 255}, (name, al)
    for px in a.reshape(-1, 4):
        if px[3] and tuple(int(c) for c in px[:3]) not in INV:
            raise AssertionError((name, 'off palette', px))


def save(a, rel):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    check(a, rel)
    Image.fromarray(a, 'RGBA').save(p)
    print('wrote', rel, a.shape[1], 'x', a.shape[0])


# ---------------------------------------------------------------------------------------------------------------------
# machine.generatorGlow: 4 gauge frames (EE/s low -> high), 96x64 cells, laid 1:1 over machine/era2/generator.png
# (same socket, same origin). Glow lives INSIDE the generator silhouette only: field-coil turn gaps, armature air gap,
# terminal caps, brush sparks. Depth: drawn under the belt / generator pulley (componentDepth bias 4, see A17 spec).
# Coil turn-gap rows (generator texture): 25..35 odd, x 31..38 (left coil) / 64..71 (right coil).
# Armature: pixel centre (51.5, 48.5); air-gap ring = pixels whose centre lies 8.6..10.4 from it, outside pole metal.
GEN_W, GEN_H = 96, 64
GAP_ROWS = [25, 27, 29, 31, 33, 35]
COILS = [(30, 39), (63, 72)]   # inner copper columns of the left / right field coil (inclusive)
CAPS = [(33, 36), (66, 69)]    # terminal cap glass columns (rows 6..10)


def gen_ring(lo, hi):
    pts = []
    for y in range(GEN_H):
        for x in range(GEN_W):
            d = ((x + 0.5 - 52.0) ** 2 + (y + 0.5 - 49.0) ** 2) ** 0.5
            if lo <= d < hi:
                pts.append((x, y))
    return pts


def glow_cell(level, gen):
    a = canvas(GEN_W, GEN_H)
    # 1) field coils: turn gaps light up. Ramp per level: (edge colour, inner colour, hot-centre colour) on x0+1..x1-1.
    ramp = {0: ('o', 'o', 'o'), 1: ('o', 'p', 'p'), 2: ('o', 'p', 'q'), 3: ('p', 'q', 'q')}[level]
    for (x0, x1) in COILS:
        for i, y in enumerate(GAP_ROWS):
            if level == 0 and i % 2:
                continue
            for x in range(x0 + 1, x1):
                if x in (x0 + 1, x1 - 1):
                    k = ramp[0]
                elif x in (x0 + 2, x1 - 2):
                    k = ramp[1]
                else:
                    k = ramp[2]
                put(a, x, y, k)
        if level == 3:   # hottest: the copper rows between gaps get a pale core too (every other)
            for y in (26, 30, 34):
                for x in range(x0 + 3, x1 - 2):
                    put(a, x, y, 'p')
    # 2) armature air gap ring (visible around the r8 pulley), only where the generator has pixels
    if level >= 1:
        inner = {1: 'p', 2: 'p', 3: 'q'}[level]
        outer = {1: 'o', 2: 'o', 3: 'p'}[level]
        for (x, y) in gen_ring(8.6, 9.5):
            if gen[y, x, 3]:
                put(a, x, y, inner)
        if level >= 2:
            for (x, y) in gen_ring(9.5, 10.4):
                if gen[y, x, 3]:
                    put(a, x, y, outer)
    # 3) terminal caps: glass brightens
    for (x0, x1) in CAPS:
        if level >= 1:
            for y in (7, 10):
                put(a, x0 + 1, y, 'q')
        if level >= 2:
            for y in range(6, 11):
                for x in range(x0, x1 + 1):
                    if get(gen, x, y) in ('o', 'p'):
                        put(a, x, y, 'p' if level == 2 else 'q')
    # 4) level 3: brush sparks at the commutator ends (left / right of the armature) + a spark over each cap
    if level == 3:
        for (x, y) in [(41, 47), (42, 48), (41, 49), (62, 47), (61, 48), (62, 49)]:
            put(a, x, y, 'q')
        for (x, y) in [(34, 4), (35, 3), (67, 4), (68, 3)]:
            put(a, x, y, 'q')
    return a


def build_glow():
    gen = np.array(Image.open(os.path.join(ROOT, 'public/assets/machine/era2/generator.png')).convert('RGBA'))
    sheet = canvas(GEN_W * 4, GEN_H)
    for k in range(4):
        sheet[:, k * GEN_W:(k + 1) * GEN_W] = glow_cell(k, gen)
    save(sheet, 'machine/legacy/generator-glow.png')


# ---------------------------------------------------------------------------------------------------------------------
# machine.bellows: great forge bellows in side elevation, 4 frames (open, half, closed, half) in 60x28 cells, origin
# bottom-centre. Scale: 1 art px ~ 2.5 cm (motor 64 px ~ 1.6 m), so the 46 px board ~ 1.2 m = a real great bellows.
# Bottom board fixed on two iron legs; top board hinged at the iron snout (right) and pumped at its free end (left, pole
# handle); dark leather side panel with fold ribs radiating from the snout (the internal ribs of a great bellows).
# Nozzle core rows 16..17 (i3 over i1) at x 51..59 = the 2-bore feed-water hose that runs on to the boiler tuyere
# (machine y -12 / -11). Wood = sand ramp (bleached plank) so the part separates from the rust brick setting behind it.
BW, BH = 60, 28
LEFT_X = 5               # free end column of both boards
HINGE_X = 44             # last board column at the snout
TOP_AT_HINGE = 16        # top board rows 16..17 at the snout (2 px plank)
BELLY = 18               # last leather row; bottom board rows 19..20; legs 21..26; foot plates row 27
FRAME_DROP = [12, 6, 1, 6]   # rows the top board's free end rises above its hinge row (open, half, closed, half)


def bellows_cell(drop):
    a = canvas(BW, BH)
    n = HINGE_X - LEFT_X

    def top_row(x):  # top row of the top board at column x: even steps from the free end down to the hinge
        return TOP_AT_HINGE - ((HINGE_X - x) * drop // n if drop else 0)

    # leather side panel: from under the top board to the belly row, r1 base, r0 belly line
    for x in range(LEFT_X, HINGE_X + 1):
        for y in range(top_row(x) + 2, BELLY + 1):
            put(a, x, y, '6' if y == BELLY else '7')
    # fold ribs radiating from the snout: ridge r2 with an r0 valley under it
    span = BELLY - (top_row(LEFT_X) + 2)
    folds = (1, 2, 3) if span >= 9 else ((1, 2) if span >= 5 else ((1,) if span >= 2 else ()))
    for f in folds:
        ty = top_row(LEFT_X) + 2 + span * f // (len(folds) + 1)
        for x in range(LEFT_X + 1, HINGE_X - 2):
            t = (HINGE_X - 1 - x) / (HINGE_X - 1 - LEFT_X)
            y = BELLY - int(round((BELLY - ty) * t))
            if top_row(x) + 2 <= y < BELLY:
                put(a, x, y, '8')
                if get(a, x, y + 1) == '7':
                    put(a, x, y + 1, '6')
    # boards: 2 px planks, lit top row (s3) over shaded row (s1); iron straps
    for x in range(LEFT_X, HINGE_X + 1):
        r = top_row(x)
        put(a, x, r, 'f'); put(a, x, r + 1, 'd')
        put(a, x, BELLY + 1, 'f'); put(a, x, BELLY + 2, 'd')
    for bx in (12, 30):
        r = top_row(bx)
        put(a, bx, r, '4'); put(a, bx, r + 1, '2')
        put(a, bx, BELLY + 1, '4'); put(a, bx, BELLY + 2, '2')
    # pole handle at the free end: 2 px wood bar rising back-left from the top board end
    r = top_row(LEFT_X)
    for i in (1, 2, 3, 4):
        put(a, LEFT_X - i, r - i + 1, 'f')
        put(a, LEFT_X - i, r - i + 2, 'd')
    # iron snout block x 45..50 rows 14..20 with rivets; hinge knuckle at the board joint
    rect(a, 45, 14, 50, BELLY + 2, '3')
    rect(a, 45, 14, 50, 14, '4')
    rect(a, 50, 15, 50, BELLY + 2, '2')
    put(a, 46, 15, '5'); put(a, 46, 19, '5'); put(a, 49, 19, '5')
    put(a, HINGE_X, BELLY, '1')
    # nozzle pipe x 51..59: core rows 16 (i3) / 17 (i1) = hose profile; collar ring at x 51
    rect(a, 51, 16, BW - 1, 16, '3'); rect(a, 51, 17, BW - 1, 17, '1')
    put(a, 51, 15, '4'); put(a, 51, 18, '2')
    # legs under the bottom board, rows 21..26, foot plates on row 27
    for fx in (10, 34):
        rect(a, fx, BELLY + 3, fx + 2, BH - 2, '2')
        rect(a, fx, BELLY + 3, fx, BH - 2, '3')
        rect(a, fx - 1, BH - 1, fx + 3, BH - 1, '1')
    return outline(a)


def build_bellows():
    sheet = canvas(BW * 4, BH)
    for k, drop in enumerate(FRAME_DROP):
        sheet[:, k * BW:(k + 1) * BW] = bellows_cell(drop)
    save(sheet, 'machine/legacy/bellows.png')


# ---------------------------------------------------------------------------------------------------------------------
# machine.exciterFeed (16x28, origin bottom-centre): mains cable terminal standing on the frame girder between the spire
# exciter and the right spire leg. Cyan glass insulator (3 sheds) on a riveted iron terminal box; copper strap from the
# box into the exciter's right flank (cell x 0 = machine x 72). Cable lug = cell (10, 1).
EXCITER = [
    ".........###....",
    ".........#q#....",
    "........#qpo#...",
    "........#ppo#...",
    ".......#54432#..",
    ".......##ppo##..",
    "......#qqppooo#.",
    ".....#qqppppooo#",
    "......#ooo0ooo#.",
    ".......##ppo##..",
    "......#qqppooo#.",
    ".....#qqppppooo#",
    "......#ooo0ooo#.",
    ".......##ppo##..",
    "......#qqppooo#.",
    ".....#qqppppooo#",
    "......#ooo0ooo#.",
    ".......##ppo##..",
    "......#4554432#.",
    ".....###########",
    ".....#544444445#",
    "######433333332#",
    "b5bbaa433393332#",
    "aaaa99433333332#",
    "######433333332#",
    ".....#43a933332#",
    ".....#522222225#",
    ".....###########",
]


def build_exciter():
    assert len(EXCITER) == 28 and all(len(r) == 16 for r in EXCITER), [len(r) for r in EXCITER]
    a = canvas(16, 28)
    stamp(a, 0, 0, EXCITER)
    save(a, 'machine/legacy/exciter-feed.png')


# ---------------------------------------------------------------------------------------------------------------------
# machine.backfeedTerminal (16x28, origin top-centre): suspension string hanging under the null gallery deck. Bolted
# hanger plate (rows 0..2) with a violet lead-in bushing, clevis link, 4 cyan glass cap-and-pin discs, conductor clamp,
# cyan cable lug at the bottom (cell 7..8, 26). A copper jumper runs from the clamp up the right side into the bushing.
DISC = [
    "......#54#......",
    "....##qqpo##....",
    "...#qqppppoo#...",
    "....#oo00oo#....",
]
BACKFEED = (
    [
        "..#5444444445#..",
        "..#333333333z#..",
        "..############..",
        "......#43#..aaa.",
        "......#43#....a.",
    ]
    + DISC * 4
    + [
        "......#43#....a.",
        "....#544445#..a.",
        "....#333332aaab.",
        "....########....",
        "......#qo#......",
        "......#po#......",
        "......####......",
    ]
)


def build_backfeed():
    rows = [r for r in BACKFEED]
    # jumper: column 14 from row 3 to row 22 (copper, lit every 4th px)
    grid = [list(r) for r in rows]
    for y in range(3, 23):
        if grid[y][14] == '.':
            grid[y][14] = 'b' if y % 4 == 0 else 'a'
    rows = [''.join(r) for r in grid]
    assert len(rows) == 28 and all(len(r) == 16 for r in rows), [len(r) for r in rows]
    a = canvas(16, 28)
    stamp(a, 0, 0, rows)
    save(a, 'machine/legacy/backfeed-terminal.png')


# ---------------------------------------------------------------------------------------------------------------------
# machine.steamLance (16x32, origin top-centre): steam lance valve hung under the null gallery deck. Bolted mount plate
# (rows 0..2) under the deck (the lance tube runs up through the deck into the chamber), neck, globe valve body with a
# face-on rust handwheel, bonnet, then the flanged inlet stub matching the 4-bore steam riser (columns 6..9 = i4 i3 i2 i0,
# flange pair rows 28..29) so the riser from the manifold joins it seamlessly at the bottom edge (port = cell 8, 32).
def build_lance():
    a = canvas(16, 32)
    # mount plate
    stamp(a, 0, 0, [
        ".##############.",
        ".#544444444445#.",
        ".##############.",
    ])
    # neck (lance tube stub) rows 3..5
    for y in (3, 4, 5):
        stamp(a, 5, y, ["#4320#"])
    # valve body rows 6..18 (rounded globe, light upper-left)
    body = [
        "....########....",
        "..##44444433##..",
        ".#444333333322#.",
        ".#433333333322#.",
        "#4333333333322 0#"[0:16],
        "#43333333333220#",
        "#43333333333220#",
        "#43333333333220#",
        "#43333333333220#",
        ".#333333333220#.",
        ".#333333332220#.",
        "..##33322220##..",
        "....########....",
    ]
    body[4] = "#43333333333220#"
    stamp(a, 0, 6, body)
    # handwheel face-on, 10x10 at (3, 7): ink rim outline, rust rim, cross spokes, hub with nut
    wheel_mask = [
        "...####...",
        ".##....##.",
        ".#......#.",
        "#........#",
        "#........#",
        "#........#",
        "#........#",
        ".#......#.",
        ".##....##.",
        "...####...",
    ]
    ox, oy = 3, 7
    cx, cy = 4.5, 4.5
    for j, row in enumerate(wheel_mask):
        for i, ch in enumerate(row):
            if ch == '#':
                put(a, ox + i, oy + j, '#')
    # rim ring: first pixel inside the outline along each row/col
    for j in range(10):
        inside = [i for i in range(10) if wheel_mask[j][i] == '.' and any(wheel_mask[j][k] == '#' for k in range(i)) and any(wheel_mask[j][k] == '#' for k in range(i + 1, 10))]
        for i in inside:
            d = ((i + 0.5 - 5) ** 2 + (j + 0.5 - 5) ** 2) ** 0.5
            if d >= 3.3:
                lit = (i + j) < 9
                put(a, ox + i, oy + j, 'b' if lit else ('a' if (i + j) < 12 else '9'))
    # spokes (cross) and hub
    for i in range(1, 9):
        for (x, y) in ((ox + i, oy + 4), (ox + i, oy + 5), (ox + 4, oy + i), (ox + 5, oy + i)):
            if get(a, x, y) not in ('#', 'b', 'a', '9'):
                put(a, x, y, '8')
    rect(a, ox + 4, oy + 4, ox + 5, oy + 5, '6')
    put(a, ox + 4, oy + 4, '5')
    # bonnet / lower neck rows 19..23
    for y in range(19, 24):
        stamp(a, 5, y, ["#4320#"])
    # steam highlight: hot-steam tag (a small brass-free steam-white tell-tale on the lit neck)
    put(a, 6, 20, 'w'); put(a, 6, 21, 'w')
    # inlet stub rows 24..31: 4-bore steam profile (i4 i3 i2 i0) on columns 6..9, flange pair rows 28..29 (6 wide)
    for y in range(24, 32):
        stamp(a, 5, y, ["#4320#"])
    stamp(a, 4, 24, ["########"])
    stamp(a, 4, 25, ["#543320#"])
    stamp(a, 4, 26, ["########"])
    stamp(a, 5, 28, ["#5432#"])
    stamp(a, 5, 29, ["#4321#"])
    # open bottom: no ink under the stub (the riser continues), clear row 31 outline columns 5 and 10 stay ink
    save(a, 'machine/legacy/steam-lance.png')


# ---------------------------------------------------------------------------------------------------------------------
# Boiler tuyere collar (machine/era3/boiler.png): a small flanged iron collar on the firebox foot where the bellows hose
# enters (boiler connection 'tuyere' = texture (100, 74); hose columns 99 (i3) / 100 (i1) end on row 74 inside the
# collar rows 72..74, cols 97..102, left of the fire door). Idempotent.
def patch_boiler():
    p = os.path.join(ROOT, 'public/assets/machine/era3/boiler.png')
    a = np.array(Image.open(p).convert('RGBA'))
    stamp(a, 97, 72, [
        "#4433#",
        "#3322#",
        "#2211#",
    ])
    save(a, 'machine/era3/boiler.png')


if __name__ == '__main__':
    build_glow()
    build_bellows()
    build_exciter()
    build_backfeed()
    build_lance()
    if '--no-boiler' not in sys.argv:
        patch_boiler()
