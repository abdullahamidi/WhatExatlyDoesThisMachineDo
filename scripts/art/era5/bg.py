# Era V + finale backgrounds / world layers / fx (ART_ERA5 §6). Usage: python3 bg.py [name ...]
# Flora picks come from PixelLab job d46635a1 (64 cand.); set FLORA=<dir with f-<i>.png> (default scratch pl/flora).
from helpers import *
import random
F = A + 'finale/'; FX = A + 'fx/'; T = A + 'terrain/'
os.makedirs(F, exist_ok=True)
SEL = sys.argv[1:]
def want(n): return not SEL or n in SEL
SUN = (372, 290); SUN_R = 16.5           # sun centre (corner) + radius in bg/sky.png (measured: #ddc9a3 bbox 356..388 x 274..306)

def bands(rows):
    a = blank(1280, 720)
    for (y0, y1, k) in rows: rect(a, 0, y0, 1279, y1, k)
    return a
def streak(a, x0, y, w, k, rnd, step=3):
    """flat cloud streak: hard-edged, thicker in the middle (2 rows), tapering 1-row ends."""
    for x in range(x0, x0 + w):
        put(a, x, y, k)
        if x0 + w // 5 < x < x0 + w - w // 4: put(a, x, y - 1, k)
    xs = x0 + w // 3
    for x in range(xs, xs + w // 3): put(a, x, y - 2, k)

# ---------------------------------------------------------------- Era V sky: dusk violet bands + 360 deg eclipse horizon glow
def sky_violet():
    a = bands([(0, 109, 'x0'), (110, 209, 'd0'), (210, 319, 'd1'), (320, 429, 'd2'), (430, 519, 'd3'),
               (520, 579, 'k1'), (580, 629, 'r5'), (630, 659, 'a0'), (660, 719, 'r5')])
    rnd = random.Random(5)
    # band edges broken by short steps (no straight ruler lines over 1280 px)
    for (y, k_up, k_dn) in ((110, 'x0', 'd0'), (210, 'd0', 'd1'), (320, 'd1', 'd2'), (430, 'd2', 'd3'), (520, 'd3', 'k1'), (580, 'k1', 'r5')):
        x = 0
        while x < 1280:
            w = rnd.randint(40, 140); up = rnd.choice((0, 0, 1, 2))
            for xx in range(x, min(1280, x + w)):
                for d in range(up): put(a, xx, y + d, k_up)
            x += w
    for (x, y, w, k) in ((90, 180, 220, 'd1'), (640, 160, 300, 'd1'), (980, 270, 180, 'd2'), (180, 300, 160, 'd2'),
                         (520, 395, 260, 'd3'), (1040, 410, 200, 'd3'), (300, 500, 240, 'k1'), (760, 560, 180, 'r5')):
        streak(a, x, y, w, k, rnd)
    check(a, 'skyViolet'); save(a, F + 'sky-violet.png')

def eclipse():
    S = 48; c = 24.0; frames = []
    def sun(img):
        for y in range(S):
            for x in range(S):
                if math.hypot(x + .5 - c, y + .5 - c) <= SUN_R: put(img, x, y, 's4')
    def moon(img, dx):
        for y in range(S):
            for x in range(S):
                # partial phases: the moon only shows where it covers the sun (a bite), totality draws the full disc
                if math.hypot(x + .5 - c - dx, y + .5 - c) <= SUN_R + .3 and (dx < 1 or get(img, x, y) == 's4'): put(img, x, y, 'x0')
    def corona(img, strong):
        for y in range(S):
            for x in range(S):
                dx, dy = x + .5 - c, y + .5 - c; d = math.hypot(dx, dy); th = math.degrees(math.atan2(dy, dx)) % 360
                if SUN_R + .3 < d <= SUN_R + 1.4: put(img, x, y, 'x3')
                elif SUN_R + 1.4 < d <= SUN_R + 2.6 and strong: put(img, x, y, 'x2')
                # streamers: hard spikes at fixed angles (no soft halo)
                for (ang, ln) in ((20, 6), (160, 7), (200, 5), (340, 6), (95, 4), (265, 4)):
                    if abs((th - ang + 180) % 360 - 180) < 3.2 and SUN_R + 2.6 < d <= SUN_R + 2.6 + ln * (1 if strong else .6):
                        put(img, x, y, 'x2' if d > SUN_R + 4.5 else 'x3')
    for k, dx in enumerate([None, 22, 13, 5, 0.6, 0]):
        img = blank(S, S); sun(img)
        if dx is not None: moon(img, dx)
        if k == 4:                                   # diamond ring: one bright bead on the left limb + thin corona
            corona(img, False)
            bead = ['....3....', '....3....', '...343...', '..34443..', '33444443 3'[:9], '..34443..', '...343...', '....3....', '....3....']
            ascii_draw(img, bead, {'3': 'x3', '4': 'a2'}, ox=3, oy=19)
            for (x, y) in ((7, 23), (7, 24)): put(img, x, y, 's4')
        if k == 5:
            for y in range(S):
                for x in range(S):
                    if get(img, x, y) == 's4': put(img, x, y, None)
            moon(img, 0); corona(img, True)
        frames.append(img)
    s = sheet(frames); check(s, 'eclipse'); save(s, F + 'eclipse.png')

# ---------------------------------------------------------------- restored sky: clear blue bands, bright sun at the same spot
def sky_restored():
    a = bands([(0, 159, 'b0'), (160, 339, 'b1'), (340, 499, 'b2'), (500, 719, 'b3')])
    rnd = random.Random(9)
    for (y, k_up) in ((160, 'b0'), (340, 'b1'), (500, 'b2')):
        x = 0
        while x < 1280:
            w = rnd.randint(50, 160); up = rnd.choice((0, 1, 1, 2))
            for xx in range(x, min(1280, x + w)):
                for d in range(up): put(a, xx, y + d, k_up)
            x += w
    for (x, y, w, k) in ((700, 120, 260, 'b1'), (980, 230, 200, 'b2'), (120, 410, 240, 'b3'), (560, 455, 300, 'b3'), (1000, 470, 180, 'b3')):
        streak(a, x, y, w, k, rnd)
    for y in range(720):
        for x in range(SUN[0] - 20, SUN[0] + 21):
            d = math.hypot(x + .5 - SUN[0], y + .5 - SUN[1])
            if d <= SUN_R - 1: put(a, x, y, 'b3')
            elif d <= SUN_R + .2: put(a, x, y, 'a2')
    for (dx, dy) in ((-8, -9), (-9, -8), (-7, -10), (-10, -7)): put(a, SUN[0] + dx, SUN[1] + dy, 'a2')   # warm limb upper-left
    check(a, 'skyRestored'); save(a, F + 'sky-restored.png')

# ---------------------------------------------------------------- horizon field glow overlay (screen-fixed like the sky)
def horizon_glow():
    a = blank(1280, 720); rnd = random.Random(13)
    rows = [(530, 589, 'x1'), (590, 634, 'x2'), (635, 659, 'x3'), (660, 719, 'x2')]
    for (y0, y1, k) in rows: rect(a, 0, y0, 1279, y1, k)
    for (y, k) in ((530, 'x1'), (590, 'x2'), (635, 'x3')):
        x = 0
        while x < 1280:
            w = rnd.randint(30, 120); up = rnd.choice((0, 1, 2, 3))
            for xx in range(x, min(1280, x + w)):
                for d in range(1, up + 1): put(a, xx, y - d, k)
            x += w
    check(a, 'horizon'); save(a, F + 'horizon-glow.png')

# ---------------------------------------------------------------- restored skyline (same footprints as bg/skyline.png, healed)
BUILDINGS = [  # x0, x1, roof top row, kind
    (0, 22, 196, 'low'), (470, 511, 196, 'low'),
    (44, 106, 152, 'block'), (117, 187, 62, 'tower'), (192, 226, 128, 'garden'), (232, 244, 140, 'spire'), (248, 260, 150, 'spire'),
    (282, 334, 80, 'glass'), (345, 390, 122, 'block'), (398, 450, 108, 'dome'), (452, 468, 190, 'low'), (24, 42, 186, 'low'), (106, 116, 182, 'low'),
    (262, 280, 176, 'low'), (334, 344, 170, 'low'), (226, 232, 186, 'low')]
GROUND = 220
def skyline_restored():
    W, H = 512, 320; a = blank(W, H); rnd = random.Random(21)
    rect(a, 0, GROUND, W - 1, H - 1, 'i1')
    def body(x0, x1, top, lit='i3', mid='i2', dark='i1'):
        for y in range(top, GROUND):
            for x in range(x0, x1 + 1):
                t = (x - x0) / max(1, x1 - x0)
                put(a, x, y, lit if t < .22 else mid if t < .8 else dark)
    def windows(x0, x1, top, dx=3, dy=4, p=.38, glass=False):
        for y in range(top + 3, GROUND - 2, dy):
            for x in range(x0 + 2, x1 - 1, dx):
                if glass: put(a, x, y, 'b0'); put(a, x, y + 1, 'b0')
                if rnd.random() < p: put(a, x, y, 'a2' if rnd.random() < .5 else 'a1')
                elif not glass: put(a, x, y, 'i1')
    for (x0, x1, top, kind) in BUILDINGS:
        if kind == 'low':
            body(x0, x1, top); windows(x0, x1, top, 4, 5, .3)
        elif kind == 'block':
            body(x0, x1, top); windows(x0, x1, top)
            rect(a, x0 + 4, top - 4, x0 + 12, top - 1, 'i2')                          # roof plant room
            for x in range(x0 + 16, x1 - 4, 3): put(a, x, top - 1, 'g1'); put(a, x + 1, top - 1, 'g2')   # roof planting
        elif kind == 'tower':
            body(x0, x1, top); windows(x0, x1, top)
            body(x0 + 8, x1 - 8, top - 8); body(x0 + 20, x1 - 20, top - 16)        # setbacks
            for y in range(top - 32, top - 16): put(a, (x0 + x1) // 2, y, 'i3'); put(a, (x0 + x1) // 2 + 1, y, 'i1')
            put(a, (x0 + x1) // 2, top - 33, 'a2')                                   # aircraft lamp
            windows(x0 + 8, x1 - 8, top - 8, 3, 4, .3)
        elif kind == 'garden':
            body(x0, x1, top); windows(x0, x1, top, 3, 4, .45)
            for x in range(x0, x1 + 1):                                              # roof garden: tree crowns
                h = 2 + int(2 * abs(math.sin(x * .7)))
                for y in range(top - h, top): put(a, x, y, 'g1' if (x + y) % 5 else 'g2')
            for y in range(top + 6, GROUND - 6, 7):                                  # hanging vines on the lit side
                for d in range(3): put(a, x0 + 1, y + d, 'g1')
        elif kind == 'spire':
            body(x0, x1, top); windows(x0, x1, top, 3, 5, .3)
            cx = (x0 + x1) // 2
            for y in range(top - 14, top): put(a, cx, y, 'i3')
            for i in range(4): hline(a, cx - (4 - i), cx + (4 - i), top - 1 - i * 2, 'i2')
        elif kind == 'glass':
            body(x0, x1, top, 'i3', 'b0', 'i1'); windows(x0, x1, top, 3, 4, .25, glass=True)
            cx = (x0 + x1) // 2
            for y in range(top - 18, top): put(a, cx, y, 'i3'); put(a, cx + 1, y, 'i2')
            body(x0 + 10, x1 - 10, top - 6)
        elif kind == 'dome':
            body(x0, x1, top); windows(x0, x1, top)
            cx = (x0 + x1) / 2; r = (x1 - x0) / 2 - 3
            for y in range(int(top - r) - 1, top):
                for x in range(x0, x1 + 1):
                    if (x + .5 - cx) ** 2 + ((y + .5 - top) * 1.6) ** 2 <= r * r:
                        put(a, x, y, 'g2' if x < cx - r / 3 else 'g1')                # verdant dome (planted roof)
    # street trees along the ground line
    for x in range(3, W, 11):
        if rnd.random() < .7:
            h = rnd.randint(4, 7)
            for y in range(GROUND - h, GROUND):
                for xx in range(x - 2, x + 3):
                    if abs(xx - x) + max(0, (GROUND - 2 - y)) // 2 <= 2: put(a, xx, y, 'g1' if xx <= x else 'g0')
    check(a, 'skylineR'); save(a, F + 'skyline-restored.png')

# ---------------------------------------------------------------- restored mountains: same silhouette, blue haze ridge, green foot
def mountains_restored():
    a = load(A + 'bg/mountains.png'); H, W = a.shape[:2]; o = blank(W, H)
    for y in range(H):
        for x in range(W):
            n = get(a, x, y)
            if n == 'k1': put(o, x, y, 'b1')
            elif n == 'i3': put(o, x, y, 'g0')
    for x in range(W):                                        # green foothills: lower 10 rows of the ridge above the ground line
        col = [y for y in range(156) if get(o, x, y) == 'b1']
        if not col: continue
        top = min(col)
        for y in range(max(top, 156 - 10 - int(3 * math.sin(x * 2 * math.pi / 128) + 3 * math.sin(x * 2 * math.pi / 64))), 156): put(o, x, y, 'g1')
        put(o, x, top, 'b2') if x % 7 < 4 else None
    check(o, 'mountR'); save(o, F + 'mountains-restored.png')

# ---------------------------------------------------------------- green ground tile (recolour of terrain/ground.png, same seams)
def ground_green():
    a = load(T + 'ground.png'); o = a.copy(); H, W = a.shape[:2]
    mp = {'s0': 'g0', 's1': 'g1', 's2': 'g2', 'k0': 's1'}
    for y in range(H):
        for x in range(W):
            n = get(a, x, y)
            if n in mp: put(o, x, y, mp[n])
    rnd = random.Random(3)
    for _ in range(140):                                       # grass blade clusters, wrap-safe
        x, y = rnd.randrange(W), rnd.randrange(H)
        for (dx, dy) in ((0, 0), (1, -1), (0, -1), (2, 0)):
            put(o, (x + dx) % W, (y + dy) % H, 'g3' if dy else 'g2')
    check(o, 'groundG'); save(o, T + 'ground-green.png')

# ---------------------------------------------------------------- regrowth strips (succession: pioneers -> grasses -> shrubs)
FLORA = os.environ.get('FLORA', SCR + 'pl/flora/')
STAGES = {1: [13, 27, 2, 11, 28, 44], 2: [5, 15, 38, 52, 53, 59, 60, 49, 6, 43], 3: [3, 8, 16, 19, 35, 46, 48, 55, 25, 30]}
def regrowth():
    W, H = 512, 32
    for st, picks in STAGES.items():
        a = blank(W, H); rnd = random.Random(40 + st)
        x = rnd.randint(0, 20); spacing = {1: (26, 46), 2: (30, 54), 3: (44, 80)}[st]
        while x < W:
            i = rnd.choice(picks); sp = load(FLORA + f'f-{i}.png')[:27]           # drop PixelLab ground strip rows 27..31
            m = sp[:, :, 3] > 0; ys, xs = np.nonzero(m)
            sp = sp[ys.min():, xs.min():xs.max() + 1]; h, w = sp.shape[:2]
            ox, oy = x, H - h
            for yy in range(h):
                for xx in range(w):
                    if sp[yy, xx, 3]: a[oy + yy, (ox + xx) % W] = sp[yy, xx]   # wrap: strip tiles horizontally
            x += w + rnd.randint(*spacing) - w // 2
        check(a, f'regrowth{st}'); save(a, F + f'regrowth-{st}.png')

# ---------------------------------------------------------------- fx: beam (violet / white), seeds, birds
def fx():
    for name, ks in (('beam', ('x1', 'x2', 'x3', 'x3')), ('beam-white', ('b1', 'b2', 'b3', 'w0'))):
        frames = []
        for f in range(4):
            a = blank(16, 32)
            for y in range(32):
                put(a, 3, y, ks[0]); put(a, 12, y, ks[0])
                for x in (4, 5, 10, 11): put(a, x, y, ks[1])
                for x in range(6, 10): put(a, x, y, ks[2])
            for m in range(4):                                  # motes rise 8 px per frame (loops in 4 frames over a 32-row tile)
                y = (m * 8 + 5 - f * 8) % 32; x = (4, 10, 5, 11)[m]
                put(a, x, y, ks[3]); put(a, x, (y + 1) % 32, ks[2])
            frames.append(a)
        s = sheet(frames); check(s, name); save(s, FX + name + '.png')
    seeds = []
    for f in range(4):
        a = blank(8, 8)
        ascii_draw(a, ['........', '..3.3...', '.3.3.3..', '..333...', '...2....', '...2....', '........', '........'][:], {'3': 'b3', '2': 'k2'})
        if f % 2: put(a, 1, 2, None); put(a, 6, 2, 'b3')
        if f >= 2: put(a, 3, 5, None); put(a, 4, 5, 'k2')
        seeds.append(a)
    s = sheet(seeds); check(s, 'seed'); save(s, FX + 'seed.png')
    birds = []
    for rows in (['........', '##....##', '.##..##.', '...##...', '........'], ['........', '........', '.######.', '#..##..#', '........']):
        a = blank(8, 5); ascii_draw(a, rows, {'#': 'i1'}); birds.append(a)
    s = sheet(birds); check(s, 'bird'); save(s, FX + 'bird.png')

if __name__ == '__main__':
    for n, f in (('skyViolet', sky_violet), ('eclipse', eclipse), ('skyRestored', sky_restored), ('horizon', horizon_glow),
                 ('skyline', skyline_restored), ('mountains', mountains_restored), ('ground', ground_green), ('regrowth', regrowth), ('fx', fx)):
        if want(n): f(); print('ok', n)
