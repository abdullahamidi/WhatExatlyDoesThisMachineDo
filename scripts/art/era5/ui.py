# UI art for the finale / prestige / achievements / title (ART_ERA5 §8-§10). Writes public/assets/ui/*.png
# Usage: python3 ui.py [name ...]. LEDGER=<path> PixelLab ledger pick (job c4639c43 #8).
from helpers import *
from fonts import F3, F5, text_mask
U = A + 'ui/'; os.makedirs(U, exist_ok=True)
SEL = sys.argv[1:]
def want(n): return not SEL or n in SEL

def plate(W, H, face=('r5', 'r4', 'r3', 'r2'), rivets=True):
    """cast plate: ink border, lit top/left bevel, shadow bottom/right bevel, face ramp by x (light upper-left)."""
    a = blank(W, H)
    for y in range(H):
        for x in range(W):
            put(a, x, y, face[1])
    for x in range(W): put(a, x, 0, 'ink'); put(a, x, H - 1, 'ink'); put(a, x, 1, face[0]); put(a, x, H - 2, face[3])
    for y in range(H): put(a, 0, y, 'ink'); put(a, W - 1, y, 'ink'); put(a, 1, y, face[0]) if 0 < y < H - 1 else None; put(a, W - 2, y, face[3]) if 0 < y < H - 1 else None
    if rivets:
        for (x, y) in ((3, 3), (W - 4, 3), (3, H - 4), (W - 4, H - 4)):
            put(a, x, y, 'a2' if face[0] == 'r5' else 'i5'); put(a, x + 1, y + 1, face[3])
    return a
def stamp(a, s, font, x0, y0, k='r0', hi='r5', scale=1, bevel=True):
    m = text_mask(s, font)
    for j in range(len(m)):
        for i in range(len(m[0])):
            if not m[j][i]: continue
            for dy in range(scale):
                for dx in range(scale):
                    x, y = x0 + i * scale + dx, y0 + j * scale + dy
                    if bevel: put(a, x + 1, y + 1, hi)
    for j in range(len(m)):
        for i in range(len(m[0])):
            if not m[j][i]: continue
            for dy in range(scale):
                for dx in range(scale):
                    put(a, x0 + i * scale + dx, y0 + j * scale + dy, k)
    return len(m[0]) * scale

def cast_text(s, scale=2):
    """raised cast letters (logo): fill a2/a1, lit top-left edge a2, shadow bottom-right r2, ink outline."""
    m = text_mask(s, F5); h, w = len(m) * scale, len(m[0]) * scale
    a = blank(w + 4, h + 4); M = np.zeros((h + 4, w + 4), bool)
    for j in range(len(m)):
        for i in range(len(m[0])):
            if m[j][i]: M[2 + j * scale:2 + (j + 1) * scale, 2 + i * scale:2 + (i + 1) * scale] = True
    for y in range(h + 4):
        for x in range(w + 4):
            if M[y, x]:
                up = not M[y - 1, x] or not M[y, x - 1]; dn = not M[y + 1, x] or not M[y, x + 1]
                put(a, x, y, 'a2' if up and not dn else 'r4' if dn and not up else 'a1')
    a = outline(a, 'ink')
    return a

# ---------------------------------------------------------------- reveal nameplate (title card) 128x24
def nameplate():
    W, H = 136, 24; a = plate(W, H)
    s = 'RESTORATION ENGINE'; tw = len(text_mask(s, F5)[0])
    stamp(a, s, F5, (W - tw) // 2, 8, 'r0', 'r5')
    for x in range(6, W - 6, 2): put(a, x, 4, 'r2')                   # cast rib lines above/below the name
    for x in range(6, W - 6, 2): put(a, x, H - 5, 'r2')
    check(a, 'nameplate'); save(a, U + 'nameplate.png')

# ---------------------------------------------------------------- title logo 2 lines + mark
def logo():
    l1, l2 = cast_text('WHAT EXACTLY DOES'), cast_text('THIS MACHINE DO?')
    W = max(l1.shape[1], l2.shape[1]) + 24; H = l1.shape[0] + l2.shape[0] + 14
    a = plate(W, H, ('i4', 'i3', 'i2', 'i1'))
    for (img, y) in ((l1, 4), (l2, 4 + l1.shape[0] + 4)):
        x0 = (W - img.shape[1]) // 2
        for yy in range(img.shape[0]):
            for xx in range(img.shape[1]):
                if img[yy, xx, 3]: a[y + yy, x0 + xx] = img[yy, xx]
    import random
    rnd = random.Random(2)
    for _ in range(9):                                               # rust clusters on the iron plate border band
        x = rnd.choice([rnd.randint(3, 10), rnd.randint(W - 11, W - 4)]); y = rnd.randint(3, H - 5)
        for (dx, dy) in ((0, 0), (1, 0), (0, 1)):
            if get(a, x + dx, y + dy) in ('i3', 'i2'): put(a, x + dx, y + dy, 'r2')
    check(a, 'logo'); save(a, U + 'logo.png')
    # mark 32x32: gear (12 teeth) with a question-mark cut-out
    m = blank(32, 32); c = 16.0
    for y in range(32):
        for x in range(32):
            dx, dy = x + .5 - c, y + .5 - c; d = math.hypot(dx, dy); th = math.atan2(dy, dx)
            tooth = (math.cos(12 * th) > .2)
            if d <= 11 or (d <= 14.5 and tooth):
                put(m, x, y, 'i4' if dx + dy < -6 else 'i3' if dx + dy < 6 else 'i2')
    q = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..']
    for j, row in enumerate(q):
        for i, ch in enumerate(row):
            if ch == '#':
                for (ex, ey) in ((0, 0), (1, 0), (0, 1), (1, 1)): put(m, 11 + i * 2 + ex, 9 + j * 2 + ey, 'a1' if j < 4 else 'a2')
    m = outline(m, 'ink'); check(m, 'mark'); save(m, U + 'logo-mark.png')

# ---------------------------------------------------------------- 16px icons: echo, cycle, keepRunning, lock, check
ICON16 = {
 'echo': ['................', '.....222222.....', '...22......22...', '..2..333333..2..', '.2..3......3..2.', '.2.3..4444..3.2.',
          '2..3.4....4.3..2', '2.3..4.44.4..3.2', '2.3..4.44.4..3.2', '2..3.4....4.3..2', '.2.3..4444..3.2.', '.2..3......3..2.',
          '..2..333333..2..', '...22......22...', '.....222222.....', '................'],
 'cycle': ['................', '.....######.....', '...##aaaaaa##...', '..#aa######aa#..', '.#a##......#a#..', '.#a#........#...', '#a#......#.#....',
           '#a#.....#a#a#...', '#a#......#a#....', '#a#.......#.....', '.#a#........#...', '.#a##......##a#.', '..#aa######aa#..', '...##aaaaaa##...', '.....######.....', '................'],
 'keep': ['................', '....########....', '...#gggggggg#...', '..#gg######gg#..', '..#g#......#g#..', '..#g#.#....#g#..', '..#g#.##...#g#..',
          '..#g#.#g#..#g#..', '..#g#.#gg#.#g#..', '..#g#.#g#..#g#..', '..#g#.##...#g#..', '..#g#.#....#g#..', '..#gg######gg#..', '...#gggggggg#...', '....########....', '................'],
 'lock': ['................', '.....######.....', '....#iiiiii#....', '...#i#....#i#...', '...#i#....#i#...', '...#i#....#i#...', '..############..',
          '..#rrrrrrrrrr#..', '..#rrrrrrrrrr#..', '..#rrrr##rrrr#..', '..#rrrr##rrrr#..', '..#rrrrr#rrrr#..', '..#rrrrrrrrrr#..', '..#qqqqqqqqqq#..', '..############..', '................'],
 'check': ['................', '................', '.............##.', '............#gg#', '...........#gg#.', '..........#gg#..', '.##......#gg#...',
           '#gg#....#gg#....', '.#gg#..#gg#.....', '..#gg##gg#......', '...#gggg#.......', '....#gg#........', '.....##.........', '................', '................', '................'],
}
def icons16():
    km = {'#': 'ink', '2': 'x1', '3': 'x2', '4': 'x3', 'a': 'a1', 'g': 'g2', 'i': 'i4', 'r': 'r4', 'q': 'r2'}
    frames = []
    for n in ('echo', 'cycle', 'keep', 'lock', 'check'):
        a = blank(16, 16); ascii_draw(a, ICON16[n], km); frames.append(a)
    s = sheet(frames); check(s, 'icons16'); save(s, U + 'icons16.png')
    # echo icon 32x32 (prestige currency): three concentric violet rings + bright core, lit upper-left
    e = blank(32, 32)
    for y in range(32):
        for x in range(32):
            d = math.hypot(x + .5 - 16, y + .5 - 16); ul = (x + y) < 30
            if 13.2 < d <= 14.6: put(e, x, y, 'x2' if ul else 'x1')
            elif 9.0 < d <= 10.4: put(e, x, y, 'x3' if ul else 'x2')
            elif 4.8 < d <= 6.2: put(e, x, y, 'x3')
            elif d <= 2.6: put(e, x, y, 'w0')
    for (x, y) in ((9, 9), (10, 8), (8, 10)): put(e, x, y, 'x3')
    check(e, 'echo32'); save(e, U + 'echo.png')

# ---------------------------------------------------------------- memory perks 32x32 x5 + slot frame 36x36 x3
def perks():
    fr = []
    # 1 Muscle Memory: worn motor + gear (Era I start)
    a = blank(32, 32)
    for y in range(9, 22):
        for x in range(3, 21): put(a, x, y, iron_col(x, 3, 20) if (x - 3) % 3 else 'i1')
    for x in range(3, 21): put(a, x, 9, 'ink'); put(a, x, 21, 'ink')
    for y in range(9, 22): put(a, 3, y, 'ink'); put(a, 20, y, 'ink')
    for x in range(5, 19): put(a, x, 10, 'i4')
    rect(a, 7, 22, 9, 24, 'i2'); rect(a, 15, 22, 17, 24, 'i2'); hline(a, 5, 19, 25, 'ink')
    rect(a, 8, 14, 13, 16, 'r4'); put(a, 8, 14, 'a1')                    # faded warning plate
    for y in range(32):
        for x in range(32):
            dx, dy = x + .5 - 22, y + .5 - 21; d = math.hypot(dx, dy); th = math.atan2(dy, dx)
            if d <= 6.5 or (d <= 9 and math.cos(10 * th) > .25):
                if d <= 2: put(a, x, y, 'ink')
                else: put(a, x, y, 'r5' if dx + dy < -3 else 'r4' if dx + dy < 4 else 'r3')
    fr.append(outline(a))
    # 2 Residual Charge: Leyden jar with a violet charge
    a = blank(32, 32)
    for y in range(11, 28):
        for x in range(9, 23): put(a, x, y, 'i5' if x < 12 else 'i4' if x < 19 else 'i3')
    for y in range(18, 28):
        for x in range(9, 23): put(a, x, y, 'i4' if x < 13 else 'i3' if x < 19 else 'i2')      # foil
    for y in range(12, 18):
        for x in range(12, 20): put(a, x, y, 'x0')
    rect(a, 8, 9, 23, 10, 'r3'); hline(a, 8, 23, 9, 'r5')                  # wooden lid
    for y in range(3, 9): put(a, 15, y, 'r4'); put(a, 16, y, 'r2')
    for (x, y, k) in ((14, 2, 'a2'), (15, 1, 'a2'), (16, 1, 'r5'), (17, 2, 'r4'), (15, 2, 'r5'), (16, 2, 'r4'), (14, 3, 'r4'), (17, 3, 'r3'), (15, 3, 'r4'), (16, 3, 'r3')):
        put(a, x, y, k)
    for (x, y) in ((15, 11), (16, 12), (15, 13), (14, 14), (15, 15), (16, 16), (17, 17)): put(a, x, y, 'x3')
    for (x, y) in ((13, 13), (18, 14), (17, 12)): put(a, x, y, 'x2')
    fr.append(outline(a))
    # 3 Long Silence: hourglass (offline)
    a = blank(32, 32)
    rect(a, 7, 3, 24, 5, 'r4'); hline(a, 7, 24, 3, 'r5'); rect(a, 7, 26, 24, 28, 'r3'); hline(a, 7, 24, 26, 'r4')
    for y in range(6, 26):
        put(a, 8, y, 'r3'); put(a, 23, y, 'r2')
        t = abs(y - 15.5) / 10.0; hw = 1 + 6 * t
        for x in range(int(16 - hw), int(16 + hw)): put(a, x, y, 'i5' if x < 14 else 'i4')
    for y in range(19, 26):
        hw = 1 + 6 * abs(y - 15.5) / 10.0 - (25 - y) * .55
        for x in range(int(16 - hw), int(16 + hw)): put(a, x, y, 's3' if x < 16 else 's2')
    for y in range(7, 10):
        hw = 1 + 6 * abs(y - 15.5) / 10.0 - 2
        for x in range(int(16 - hw), int(16 + hw)): put(a, x, y, 's3')
    for y in range(14, 19): put(a, 15, y, 's3')
    fr.append(outline(a))
    # 4 Servo Recall: crank disc + arm + recall arrow
    a = blank(32, 32)
    for y in range(32):
        for x in range(32):
            d = math.hypot(x + .5 - 13, y + .5 - 19)
            if d <= 8: put(a, x, y, 'i4' if (x + y) < 30 else 'i3' if (x + y) < 36 else 'i2')
            if d <= 2.2: put(a, x, y, 'ink')
    for i in range(10):
        put(a, 13 + i, 19 - i, 'i5'); put(a, 14 + i, 19 - i, 'i3'); put(a, 13 + i, 18 - i, 'i4')
    for (x, y) in ((22, 8), (23, 8), (22, 9), (23, 9), (24, 9), (23, 10), (22, 10)): put(a, x, y, 'r4')
    put(a, 22, 8, 'a1')
    for th in range(200, 340, 6):                                         # recall arc (verdigris = Era IV servo)
        r = 12.5; x = 13 + r * math.cos(math.radians(th)); y = 19 + r * math.sin(math.radians(th))
        put(a, int(x), int(y), 'v1')
    for (x, y) in ((3, 16), (2, 15), (4, 15), (3, 14)): put(a, x, y, 'v2')
    fr.append(outline(a))
    # 5 Ledger: PixelLab pick (crop/pad only)
    led = load(os.environ.get('LEDGER', SCR + 'pl/ledger/l-8.png'))
    led = snap(led) if not check(led, 'ledger-src') else led
    fr.append(led)
    s = sheet(fr); check(s, 'perks'); save(s, U + 'perks.png')
    # slot frames 36x36: 0 locked (iron), 1 affordable (amber rim), 2 owned (violet rim + check pip)
    slots = []
    for st in range(3):
        rim = [('i3', 'i2', 'i1', 'i0'), ('a1', 'a0', 'r4', 'r2'), ('x3', 'x2', 'x1', 'x0')][st]
        a = blank(36, 36)
        for y in range(36):
            for x in range(36):
                edge = min(x, y, 35 - x, 35 - y)
                if edge == 0: put(a, x, y, 'ink')
                elif edge == 1: put(a, x, y, rim[0] if x + y < 35 else rim[2])
                elif edge == 2: put(a, x, y, rim[1] if x + y < 35 else rim[3])
                elif edge == 3: put(a, x, y, 'ink')
        for (x, y) in ((1, 1), (34, 1), (1, 34), (34, 34)): put(a, x, y, 'ink')
        if st == 2:
            for (x, y) in ((30, 30), (31, 29), (32, 28), (29, 29), (28, 28)): put(a, x, y, 'g3')
        slots.append(a)
    s = sheet(slots); check(s, 'slots'); save(s, U + 'perk-slot.png')

# ---------------------------------------------------------------- achievement badges 24x24 x16 (+ locked variants)
BADGES = [  # id, emblem rows (12x12), key map
 ('firstTurn', ['............', '.........##.', '........#aa#', '........#aa#', '.......#.##.', '......#.....', '.....#......', '...###......',
                '..#iii#.....', '..#iki#.....', '..#iii#.....', '...###......'], {'a': 'r4', 'i': 'i4', 'k': 'ink'}),
 ('steadyHand', ['....222.....', '..2.....2...', '.2......##..', '2......#aa#.', '2......#aa#.', '......#.##..', '.....#......', '...###......',
                 '..#iii#.....', '..#iki#.....', '..#iii#.....', '...###......'], {'a': 'r4', 'i': 'i4', 'k': 'ink', '2': 'k3'}),
 ('tireless', ['..3333333...', '.3.......3..', '3...222...3.', '3..2...2##..', '3.2....#aa#.', '..2....#aa#.', '......#.##..', '...###......',
               '..#iii#.....', '..#iki#.....', '..#iii#.....', '...###......'], {'a': 'a2', 'i': 'i4', 'k': 'ink', '2': 'a1', '3': 'a0'}),
 ('wornMotor', ['............', '............', '.##########.', '#iiiiiiiiii#', '#i5i5i5i5ii#', '#iiiiaaiiii#', '#i5i5aai5i##', '#iiiiiiiiii#',
                '.##########.', '..#ii..ii#..', '..####.####.', '............'], {'i': 'i3', '5': 'i1', 'a': 'r4'}),
 ('blueprint', ['............', '...#######..', '..#cccccc##.', '.#c2c2c2c#c#', '.#cccccc#cc#', '.#c22c2c#cc#', '.#cccccc#cc#', '.#c2c22c#c#.',
                '.#cccccc##..', '..#######...', '............', '............'], {'c': 'c0', '2': 'c2'}),
 ('eraElectric', ['......###...', '.....#22#...', '....#22#....', '...#22#.....', '..#2222###..', '.#22222222#.', '..###2222#..', '....#222#...',
                  '...#222#....', '...#22#.....', '..#2#.......', '..##........'], {'2': 'c1'}),
 ('eraThermal', ['.....#......', '....#e#.....', '....#e#..#..', '...#eae#.#e#', '..#eaae##ea#', '..#eaaae#eae', '.#eaa22aeaae', '.#ea2222aaa#',
                 '.#ea2222ae#.', '..#ea22ae#..', '...#eeee#...', '....####....'], {'e': 'e1', 'a': 'a0', '2': 'a2'}),
 ('eraResonance', ['..#v#.#v#...', '..#v#.#v#...', '..#v#.#v#...', '..#v#.#v#...', '..#v#.#v#...', '..#vv#vv#...', '...#vvv#....', '....#v#.....',
                   '....#v#.....', '...#iii#....', '..#iiiii#...', '..#######...'], {'v': 'v1', 'i': 'i4'}),
 ('eraExotic', ['....####....', '..##2222##..', '.#2200002#..', '.#20000002#.', '#2000kk0002#', '#200kkkk002#', '#200kkkk002#', '#2000kk0002#',
                '.#20000002#.', '.#2200002#..', '..##2222##..', '....####....'], {'2': 'x2', '0': 'x0', 'k': 'ink'}),
 ('restoration', ['....a.a.....', '..a.333.a...', '...333333...', '.a3333333a..', '..3333333...', '...33333....', '..a.....a...', '.....g......',
                  '....ggg.....', '...g.g.g....', '.....g......', '.ssssssssss.'], {'a': 'a1', '3': 'a2', 'g': 'g2', 's': 'g0'}),
 ('newCycle', ['....####....', '..##aaaa##..', '.#aa####aa#.', '#a#......#a#', '#a#.....###.', '#a#.....#a#.', '#a#....#aaa#', '#a#.....#a#.',
               '.#a#......#.', '..#aa##.....', '...##aa#....', '.....##.....'], {'a': 'g2'}),
 ('echoes', ['............', '...222222...', '..2......2..', '.2..3333..2.', '.2.3....3.2.', '2..3.44.3..2', '2..3.44.3..2', '.2.3....3.2.',
             '.2..3333..2.', '..2......2..', '...222222...', '............'], {'2': 'x1', '3': 'x2', '4': 'x3'}),
 ('longSilence', ['......####..', '....##ss#...', '...#ss##....', '..#ss#......', '..#s#.......', '.#ss#....3..', '.#ss#...333.', '.#ss#....3..',
                  '..#ss#......', '..#sss##..#.', '...##sss##..', '.....####...'], {'s': 's4', '3': 'k3'}),
 ('automation', ['............', '...#####....', '..#iiiii#...', '.#ii###ii#..', '.#i#kkk#i#..', '.#i#kkk#i###', '.#i#kkk#iiv#', '.#ii###ii###',
                 '..#iiiii#...', '...#####....', '..#######...', '..#iiiii#...'], {'i': 'i4', 'k': 'ink', 'v': 'v1'}),
 ('bigNumber', ['...######...', '..#ssssss#..', '.#s.s..s.s#.', '#ss......ss#', '#s......e.s#', '#s.....e..s#', '#ss...e..ss#', '#s...k....s#',
                '#ss......ss#', '.#ss.ee.ss#.', '..#ssssss#..', '...######...'], {'s': 's4', 'e': 'e1', 'k': 'ink'}),
 ('keeper', ['.....a......', '....aaa.....', '...#####....', '...#a2a#....', '...#####....', '....#i#.....', '....#r#.....', '....#i#.....',
             '...#iri#....', '...#iii#....', '..#rirri#...', '.#########..'], {'a': 'a2', '2': 'a1', 'i': 'i4', 'r': 'r3'}),
]
def badges():
    fr, lk = [], []
    for bid, rows, km in BADGES:
        a = blank(24, 24)
        # medallion: octagon plate, brass rim lit upper-left, iron face
        for y in range(24):
            for x in range(24):
                dx, dy = abs(x + .5 - 12), abs(y + .5 - 12)
                if max(dx, dy) <= 11.5 and dx + dy <= 16:
                    rim = max(dx, dy) > 10 or dx + dy > 14.6
                    if rim: put(a, x, y, 'r5' if (x + y) < 20 else 'r3' if (x + y) < 28 else 'r2')
                    else: put(a, x, y, 'i2' if (x + y) < 24 else 'i1')
        km2 = dict(km); km2.setdefault('#', 'ink')
        ascii_draw(a, rows, km2, 6, 6)
        a = outline(a, 'ink'); a = a if a.shape == (24, 24, 4) else a
        fr.append(a)
        # locked: same silhouette, face + emblem flattened to iron (status shown by shape + lock, not only colour)
        l = a.copy()
        for y in range(24):
            for x in range(24):
                n = get(l, x, y)
                if n is None or n == 'ink': continue
                put(l, x, y, 'i3' if n in ('r5', 'r3', 'r2') else 'i1' if n in ('i2', 'i1') else 'i2')
        lk.append(l)
    s = sheet(fr); check(s, 'badges'); save(s, U + 'badges.png')
    s = sheet(lk); check(s, 'badgesL'); save(s, U + 'badges-locked.png')
    json.dump([b[0] for b in BADGES], open(SCR + 'badge-ids.json', 'w'))

# ---------------------------------------------------------------- button 9-slice 24x24 x3 (normal / hover / pressed) + terminal panel 9-slice
def buttons():
    fr = []
    for st in range(3):
        face = [('i3', 'i2', 'i1', 'i0'), ('r4', 'r3', 'r2', 'r1'), ('i1', 'i0', 'i0', 'ink')][st]
        a = plate(24, 24, face, rivets=False)
        if st == 2:
            for x in range(1, 23): put(a, x, 1, 'i0')
        fr.append(a)
    s = sheet(fr); check(s, 'buttons'); save(s, U + 'button.png')
    # terminal panel 9-slice 24x24: iron-2 fill, rust border, ink outer (matches .hud-panel)
    p = blank(24, 24)
    for y in range(24):
        for x in range(24):
            e = min(x, y, 23 - x, 23 - y)
            put(p, x, y, 'ink' if e == 0 else 'r3' if e in (1, 2) else 'ink' if e == 3 else 'i0')
    for (x, y) in ((4, 4), (19, 4), (4, 19), (19, 19)): put(p, x, y, 'r1')
    check(p, 'panel'); save(p, U + 'panel.png')

if __name__ == '__main__':
    for n, f in (('nameplate', nameplate), ('logo', logo), ('icons16', icons16), ('perks', perks), ('badges', badges), ('buttons', buttons)):
        if want(n): f(); print('ok', n)
