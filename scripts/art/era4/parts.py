# Era IV parts (hand-pixelled exact geometry + curated PixelLab). usage: python3 parts.py [part ...]
from helpers import *
import json, random
GEO = lambda: json.load(open(G + 'tower-geo.json'))
def outer(y): return GEO()['outer_world_x'][str(y)]
RINGS = [(-158, 1), (-224, 8), (-275, 16), (-331, 25)]       # (batten top row, harmonicCoil level)
DISH_Y = -361                                                # batten top row the dish trunnion bolts to

# ---------------------------------------------------------------- exciter 24x32 (Tesla-type steam oscillator), canvas (0,0) = (52,-142)
def exciter():
    a = blank(24, 32)
    # base flange rows 28..31
    for y in range(28, 32):
        for x in range(1, 23): put(a, x, y, iron_col(x, 1, 22))
    hline(a, 1, 22, 28, 'ink'); hline(a, 2, 21, 29, 'i4'); hline(a, 1, 22, 31, 'ink')
    for x in (3, 20): put(a, x, 30, 'i5' if x < 12 else 'i3')
    # cylinder rows 11..27 cols 4..19
    for y in range(11, 28):
        for x in range(4, 20): put(a, x, y, iron_col(x, 4, 19))
    for hy in (14, 24):
        for x in range(3, 21): put(a, x, hy, 'i4' if x < 15 else 'i2')
        put(a, 3, hy, 'ink'); put(a, 20, hy, 'ink')
    hline(a, 4, 19, 11, 'ink')
    # valve chest on the left, inlet nipple rows 14..17 (pipe P4 centre row 16 = y -126)
    for y in range(13, 22):
        for x in range(0, 5): put(a, x, y, 'i1')
    hline(a, 0, 4, 13, 'ink'); hline(a, 0, 4, 21, 'ink'); vline(a, 0, 13, 21, 'ink'); hline(a, 1, 3, 14, 'i3')
    vline(a, 1, 14, 17, 'i3'); vline(a, 2, 14, 17, 'i2'); put(a, 1, 19, 'i4')
    # sight glass: resonance tell-tale (accent)
    for y in range(17, 22): put(a, 12, y, 'v1'); put(a, 13, y, 'v0')
    put(a, 12, 17, 'v2'); hline(a, 11, 14, 16, 'ink'); hline(a, 11, 14, 22, 'ink'); vline(a, 11, 17, 21, 'ink'); vline(a, 14, 17, 21, 'ink')
    # gland rows 8..10, plunger rod rows 3..7 (cols 11,12), clamp eye rows 0..2 around corner (12,1)
    for y in range(8, 11):
        for x in range(7, 17): put(a, x, y, iron_col(x, 7, 16))
    hline(a, 7, 16, 8, 'ink')
    for y in range(3, 8): put(a, 10, y, 'ink'); put(a, 11, y, 'i5'); put(a, 12, y, 'i3'); put(a, 13, y, 'ink')
    hline(a, 10, 13, 0, 'ink'); put(a, 10, 1, 'ink'); put(a, 13, 1, 'ink'); put(a, 11, 1, 'i4'); put(a, 12, 1, 'i2')
    hline(a, 10, 13, 2, 'ink')
    # springs either side of the rod (rows 3..7)
    for y in range(3, 8):
        put(a, 8 + (y % 2), y, 'i3'); put(a, 15 - (y % 2), y, 'i2')
    for (x, y) in ((6, 19), (7, 19), (6, 20), (17, 25), (17, 26), (16, 26), (5, 26)): put(a, x, y, 'r2' if x > 10 else 'r3')
    check(a, 'exciter'); save(a, O + 'spire-exciter.png'); return a

# ---------------------------------------------------------------- standing wave sheet 8 x (16x270), rows y -412..-143, axis corner x 8 (= 64)
WL = 270
def wave():
    frames = []
    cs = [math.cos(math.pi / 2 + k * math.pi / 4) for k in range(8)]
    def amp(s): return 5.0 if s < 2 * WL / 3 else 4.0
    for k in range(8):
        a = blank(16, WL)
        prev = None
        for row in range(WL):
            s = WL - 0.5 - row
            env = amp(s) * abs(math.sin(3 * math.pi * s / WL))
            # dotted envelope (static: where a standing wave is drawn as its envelope)
            if env >= 1.5 and row % 2 == 0:
                put(a, 7 - int(round(env)), row, 'v0'); put(a, 8 + int(round(env)), row, 'v0')
        for row in range(WL):
            s = WL - 0.5 - row
            d = int(round(amp(s) * math.sin(3 * math.pi * s / WL) * cs[k]))
            if prev is not None and abs(d - prev) > 1:          # keep the line connected
                for dd in range(min(d, prev) + 1, max(d, prev)): put(a, 7 + dd, row, 'v1')
            put(a, 7 + d, row, 'v2'); put(a, 8 + d, row, 'v1'); prev = d
        for sn in (WL / 3, 2 * WL / 3):                          # interior nodes: fixed bright ticks
            row = int(round(WL - sn))
            hline(a, 5, 10, row, 'v1'); put(a, 7, row, 'v2'); put(a, 8, row, 'v2')
        frames.append(a)
    s = sheet(frames); check(s, 'wave'); save(s, O + 'spire-wave.png'); return s

# ---------------------------------------------------------------- toroidal harmonic coil rings, sheets 4 frames (0 = no glint)
def coil_rings():
    out = []
    for i, (b, lvl) in enumerate(RINGS, 1):
        l, r = outer(b); span = r - l + 1; Wd = span + 8; Hh = 8
        base = blank(Wd, Hh); rr = 4.0
        rowc = ['ink', 'r4', 'r3', 'r3', 'r2', 'r2', 'r1', 'ink']
        for y in range(Hh):
            for x in range(Wd):
                # stadium: inside if within the rect core or the end circles
                cx = min(max(x + .5, rr), Wd - rr); d = math.hypot(x + .5 - cx, y + .5 - rr)
                if d <= rr:
                    edge = d > rr - 1.0
                    put(base, x, y, 'ink' if edge else rowc[y])
        for x in range(2, Wd // 3): 
            if name(base, x, 1) == 'r4': put(base, x, 1, 'r5')        # lit upper-left of the tube
        for x in range(Wd - Wd // 4, Wd - 1):
            for y in (1, 2):
                n = name(base, x, y)
                if n in ('r4', 'r3'): put(base, x, y, {'r4': 'r3', 'r3': 'r2'}[n])
        # toroidal winding: diagonal wire gaps every 3 px (one value step darker)
        dark = {'r5': 'r4', 'r4': 'r3', 'r3': 'r2', 'r2': 'r1'}
        for y in range(2, 7):
            for x in range(2, Wd - 2):
                n = name(base, x, y)
                if n in dark and (x + y) % 3 == 0: put(base, x, y, dark[n])
        rnd = random.Random(100 + i)
        for _ in range(max(2, Wd // 14)):                       # verdigris patina clusters (lower half)
            x = rnd.randint(4, Wd - 6)
            for (dx, dy, k) in ((0, 5, 'v0'), (1, 5, 'v0'), (1, 4, 'v1'), (2, 5, 'v0'), (1, 6, 'v0'), (3, 6, 'v0')):
                if name(base, x + dx, dy) not in (None, 'ink'): put(base, x + dx, dy, k)
        frames = [base]
        for f in (1, 2, 3):                                     # glint travelling left -> right along the front
            a = base.copy(); gx = int(round(Wd * f / 4))
            for (dx, dy, k) in ((-1, 2, 'v1'), (0, 2, 'v2'), (1, 2, 'v2'), (2, 2, 'v1'), (0, 3, 'v1'), (1, 3, 'v1')):
                if name(a, gx + dx, dy) not in (None, 'ink'): put(a, gx + dx, dy, k)
            frames.append(a)
        s = sheet(frames); check(s, f'ring{i}'); save(s, O + f'coil-ring-{i}.png')
        out.append({'id': f'coilRing{i}', 'level': lvl, 'w': Wd, 'h': Hh, 'centre': [64, b + 1], 'x': [64 - Wd // 2, 64 + Wd // 2 - 1]})
    json.dump(out, open(G + 'rings.json', 'w')); print(out); return out

# ---------------------------------------------------------------- quartz crystal cluster, sheet 4 x (32x48), bottom row on the crown plate
CRY = [  # (base centre x, base y, angle deg (+ = lean right), half width, prism length, tip length)
    (16.0, 47.0, 0, 6.0, 30, 10),
    (10.5, 46.0, -24, 3.0, 13, 5),
    (21.5, 46.0, 24, 3.0, 13, 5),
]
FACE = [  # per frame: (left face, centre face, right face, core, sparkle)
    ('i4', 'v0', 'i1', None, None), ('v1', 'v0', 'i2', 'v1', None), ('v2', 'v1', 'v0', 'v2', 'v2'), ('v1', 'v0', 'i2', 'v1', 'v1')]
def crystal():
    frames = []
    for f in range(4):
        lf, cf, rf, core, spk = FACE[f]
        a = blank(32, 48); lab = {}
        for ci, (bx, by, ang, hw, L, T) in enumerate(CRY):
            th = math.radians(ang); ux, uy = math.cos(th), math.sin(th); vx, vy = math.sin(th), -math.cos(th)   # u across, v up
            for y in range(48):
                for x in range(32):
                    px, py = x + .5 - bx, y + .5 - by
                    u = px * ux + py * uy; v = px * vx + py * vy
                    if v < 0 or v > L + T: continue
                    w = hw if v <= L else hw * (1 - (v - L) / T)
                    if abs(u) > w: continue
                    if u < -hw / 3: k = lf
                    elif u > hw / 2.2: k = rf
                    else: k = cf
                    if ci == 0 and core and abs(u) < 1.2 and 6 < v < L - 2: k = core
                    lab[(x, y)] = (ci, k, u, v, w)
        # paint back-to-front: side crystals first, main last
        for ci in (1, 2, 0):
            for (x, y), (c, k, u, v, w) in lab.items():
                if c == ci: put(a, x, y, k)
        # outline: any filled pixel with an empty 4-neighbour, plus seams where the main crystal overlaps a side crystal
        m = a[:, :, 3] > 0; edge = []
        for (x, y) in lab:
            for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if not (0 <= xx < 32 and 0 <= yy < 48) or not m[yy, xx]: edge.append((x, y)); break
        for (x, y) in edge: put(a, x, y, 'ink')
        for (x, y), (c, k, u, v, w) in lab.items():
            if c == 0 and abs(abs(u) - w) < 0.6 and (x, y) not in edge:
                for xx in (x - 1, x + 1):
                    if (xx, y) in lab and lab[(xx, y)][0] != 0: put(a, x, y, 'ink')
        # termination facet edges (one value step darker) and a lit ridge
        for (x, y), (c, k, u, v, w) in lab.items():
            if (x, y) in edge: continue
            if c == 0 and v > 30 and abs(u + hw_main() / 3) < 0.55: put(a, x, y, 'i4' if f == 0 else 'v2')
        if spk:
            for (x, y) in ((14, 12), (13, 20), (14, 28), (7, 38)): put(a, x, y, spk)
        hline(a, 9, 23, 47, 'ink')                              # flat seat on the crown plate
        frames.append(a)
    s = sheet(frames); check(s, 'crystal'); save(s, O + 'crystal.png'); return s
def hw_main(): return CRY[0][3]

# ---------------------------------------------------------------- acoustic mirror dish 40x64 (concave to the left; right one = flipX)
def dish():
    """Exact side elevation of a paraboloid mirror: the rim circle is edge-on (vertical line at the rim plane), the back is the
    parabola -> filled D silhouette. Seams of constant depth are vertical lines. Feed pole leaves the rim plane to the focus."""
    W, H = 40, 64; a = blank(W, H); f = 18.75; vx = 34; cy = 32; xr = 22          # vertex back x, rim plane x
    for y in range(2, 62):
        v = y + .5 - cy; xb = int(math.floor(vx - v * v / (4 * f)))               # back surface (right edge)
        xb = max(xb, xr + 1)
        for x in range(xr, xb + 1):
            t = (y - 2) / 59.0
            k = 'i4' if t < .18 else 'i3' if t < .42 else 'i2' if t < .72 else 'i1'
            put(a, x, y, k)
        put(a, xb, y, 'ink'); put(a, xr, y, 'ink')
        put(a, xr + 1, y, 'i5' if v < -6 else 'i4' if v < 12 else 'i3')            # rim lip (lit edge)
    for y in (2, 61):
        v = y + .5 - cy; xb = max(int(math.floor(vx - v * v / (4 * f))), xr + 1); hline(a, xr, xb, y, 'ink')
    for sx in (26, 30):                                                            # constant-depth seams = vertical lines
        for y in range(2, 62):
            n = name(a, sx, y); v = y + .5 - cy; xb = int(math.floor(vx - v * v / (4 * f)))
            if n not in (None, 'ink') and sx < xb - 1:
                put(a, sx, y, {'i4': 'i3', 'i3': 'i2', 'i2': 'i1', 'i1': 'i0', 'i5': 'i4'}[n])
                if y % 6 == 3: put(a, sx + 1, y, 'i5' if v < 0 else 'i3')
    for (x, y) in ((24, 12), (25, 12), (25, 13), (28, 44), (28, 45), (29, 45), (24, 52), (32, 30), (32, 31)):
        if name(a, x, y) not in (None, 'ink'): put(a, x, y, 'r3' if y < 40 else 'r2')
    # back hub + trunnion arm to the tower leg (cols 35..39)
    for y in range(28, 37):
        for x in range(35, 38): put(a, x, y, 'i2')
    hline(a, 35, 37, 28, 'ink'); hline(a, 35, 37, 36, 'ink'); vline(a, 38, 28, 36, 'ink'); put(a, 36, 29, 'i4'); put(a, 36, 35, 'i0')
    for y in range(30, 35): put(a, 39, y, 'i1')
    put(a, 39, 30, 'ink'); put(a, 39, 34, 'ink'); put(a, 37, 32, 'i5')
    # feed pole (rows 31..32) from the rim plane to the horn at the focus (x ~15)
    for x in range(14, xr): put(a, x, 31, 'i3'); put(a, x, 32, 'i1')
    # listening horn, bell open to the right (towards the mirror)
    bell = {12: (30, 33), 13: (30, 33), 14: (29, 34), 15: (28, 35), 16: (27, 36), 17: (26, 37)}
    for x, (y0, y1) in bell.items():
        for y in range(y0, y1 + 1): put(a, x, y, 'ink' if y in (y0, y1) else ('r5' if y < 31 else 'r4' if y < 33 else 'r3'))
    vline(a, 17, 27, 36, 'r2'); put(a, 16, 28, 'a1')
    for y in range(30, 34):
        for x in range(8, 12): put(a, x, y, iron_col(x, 8, 11))
    hline(a, 8, 11, 30, 'ink'); hline(a, 8, 11, 33, 'ink'); put(a, 9, 31, 'v1')
    check(a, 'dish'); save(a, O + 'emitter-dish.png'); return a

# ---------------------------------------------------------------- dish waves sheet 6 x (40x64), fronts travel left; frame 0 empty
def dish_waves():
    frames = [blank(40, 64)]
    fx, fy = 40 + 15, 32                                        # dish focus in this canvas
    for k in range(1, 6):
        a = blank(40, 64)
        for (r, kk) in ((10 + 7 * k, 'v2'), (10 + 7 * k + 1, 'v1'), (10 + 7 * (k - 1), 'v0')):
            if k == 1 and kk == 'v0': continue
            for y in range(64):
                dy = y + .5 - fy
                if abs(dy) > r * 0.55 or abs(dy) > 26: continue
                x = int(math.floor(fx - math.sqrt(max(0, r * r - dy * dy))))
                if 0 <= x < 40 and name(a, x, y) is None: put(a, x, y, kk)
        frames.append(a)
    s = sheet(frames); check(s, 'waves'); save(s, O + 'dish-waves.png'); return s

# ---------------------------------------------------------------- Koenig tuning fork on a resonance box, sheet 4 x (22x44); frame 0 rest
def fork():
    frames = []
    for f in range(4):
        a = blank(22, 44); spread = (0, 1, 0, -1)[f]
        # box rows 34..43, open mouth on the left
        for y in range(34, 44):
            for x in range(0, 22): put(a, x, y, 'r3')
        hline(a, 0, 21, 34, 'ink'); hline(a, 1, 20, 35, 'r4'); hline(a, 0, 21, 43, 'ink'); vline(a, 0, 34, 43, 'ink'); vline(a, 21, 34, 43, 'ink')
        hline(a, 4, 20, 38, 'r2'); hline(a, 6, 17, 41, 'r2'); vline(a, 20, 36, 42, 'r2'); hline(a, 1, 20, 42, 'r2')
        for y in range(36, 42):
            for x in range(1, 4): put(a, x, y, 'ink' if x < 3 else 'i0')
        vline(a, 4, 36, 41, 'r4')
        # turned mount rows 30..33
        for y in range(30, 34):
            for x in range(8, 14): put(a, x, y, brass_col(x, 8, 13) if y != 30 else 'ink')
        hline(a, 7, 14, 33, 'ink') if False else None
        put(a, 8, 33, 'ink'); put(a, 13, 33, 'ink')
        # stem rows 24..29 cols 9..12
        for y in range(24, 30):
            for j, k in enumerate(['ink', 'i4', 'i2', 'ink']): put(a, 9 + j, y, k)
        # U bend rows 19..23 (cols 5..16), tines 4 px apart so they never touch when squeezed
        for y in range(19, 24):
            for x in range(5, 17): put(a, x, y, 'i3' if y < 22 else 'i2')
        vline(a, 5, 19, 22, 'ink'); vline(a, 16, 19, 22, 'ink'); hline(a, 6, 15, 23, 'ink')
        for y in (19, 20): hline(a, 9, 12, y, None)
        hline(a, 9, 12, 21, 'ink')
        # tines rows 1..20, tips displaced by +-spread (bend grows with height)
        for y in range(1, 21):
            off = int(round(spread * (20 - y) / 19.0))
            for j, k in enumerate(['ink', 'i5', 'i3', 'ink']): put(a, 5 - off + j, y, k)
            for j, k in enumerate(['ink', 'i3', 'i1', 'ink']): put(a, 13 + off + j, y, k)
        for x in range(5 - spread, 9 - spread): put(a, x, 1, 'ink')
        for x in range(13 + spread, 17 + spread): put(a, x, 1, 'ink')
        frames.append(a)
    s = sheet(frames); check(s, 'fork'); save(s, O + 'koenig-fork.png'); return s

# ---------------------------------------------------------------- calliope: three steam whistles on the manifold studs (curated PixelLab whistle-0)
def calliope():
    src = load(os.path.dirname(os.path.abspath(__file__)) + '/src/whistle-0.png'); src = recolor(src, {'a1': 'r5'})
    for y in range(0, 33):                                      # patina specks on the bells -> verdigris
        for x in range(64):
            n = name(src, x, y)
            if n == 'i3': put(src, x, y, 'v0')
            elif n == 'i4': put(src, x, y, 'v1')
            elif n == 'i2': put(src, x, y, 'v0')
    a = blank(72, 40)
    cols = [x for x in range(64) if src[:, x, 3].any()]
    groups, g = [], [cols[0]]
    for x in cols[1:]:
        if x == g[-1] + 1: g.append(x)
        else: groups.append(g); g = [x]
    groups.append(g)
    targets = [-72, -44, -16]                                   # stud corners (machine-local x)
    for grp, tx in zip(groups, targets):
        stub = [x for x in grp if src[39, x, 3]]
        sc = (stub[0] + stub[-1] + 1) / 2.0                     # stub centre corner
        off = int(round(tx + 80 - sc))
        for x in grp:
            for y in range(40):
                if src[y, x, 3]: a[y, x + off] = src[y, x]
    check(a, 'calliope'); save(a, O + 'calliope.png'); return a

# ---------------------------------------------------------------- servo gearbox 28x20 (output shaft end-on at corner (14,10))
def servo_base():
    a = blank(28, 20)
    for y in range(16, 20):
        for x in range(0, 28): put(a, x, y, iron_col(x, 0, 27))
    hline(a, 0, 27, 16, 'ink'); hline(a, 1, 26, 17, 'i4'); hline(a, 0, 27, 19, 'ink')
    for x in (2, 25): put(a, x, 18, 'i5' if x < 14 else 'i3')
    for y in range(3, 16):
        for x in range(3, 25): put(a, x, y, iron_col(x, 3, 24))
    hline(a, 4, 23, 3, 'ink'); hline(a, 4, 23, 4, 'i4'); put(a, 3, 3, None); put(a, 24, 3, None); put(a, 3, 4, 'ink'); put(a, 24, 4, 'ink')
    ring(a, 14, 10, 4.0, 6.0, 'i1'); ring(a, 14, 10, 4.6, 5.4, 'i4'); ring(a, 14, 10, 5.6, 6.6, 'ink')
    disc(a, 14, 10, 4.0, 'i0')
    for (x, y) in ((5, 6), (22, 6), (5, 13), (22, 13)): put(a, x, y, 'i5' if x < 14 else 'i3')
    # status lamp on top (resonance accent)
    hline(a, 17, 20, 2, 'ink'); put(a, 18, 1, 'v2'); put(a, 19, 1, 'v1'); hline(a, 18, 19, 0, 'ink'); put(a, 17, 1, 'ink'); put(a, 20, 1, 'ink')
    for (x, y) in ((7, 11), (8, 11), (7, 12), (20, 8), (21, 8)): put(a, x, y, 'r2')
    put(a, 7, 11, 'r3')
    check(a, 'servoBase'); save(a, O + 'servo-base.png'); return a

# ---------------------------------------------------------------- servo arm 48x48, hub corner (24,24), pin corner (24,5) (r 19 = hand-crank knob radius)
def servo_arm():
    a = blank(48, 48)
    for y in range(6, 24):
        for j, k in enumerate(['ink', 'i3', 'i3', 'ink']): put(a, 22 + j, y, k)
    disc(a, 24, 24, 5.5, 'ink'); disc(a, 24, 24, 4.5, 'i3'); ring(a, 24, 24, 2.5, 3.5, 'i2'); disc(a, 24, 24, 1.5, 'i4')
    disc(a, 24, 5, 3.6, 'ink'); disc(a, 24, 5, 2.7, 'i3'); disc(a, 24, 5, 1.5, 'r4')
    check(a, 'servoArm'); save(a, O + 'servo-arm.png'); return a

PARTS = {'exciter': exciter, 'wave': wave, 'rings': coil_rings, 'crystal': crystal, 'dish': dish, 'waves': dish_waves,
         'fork': fork, 'calliope': calliope, 'servoBase': servo_base, 'servoArm': servo_arm}
if __name__ == '__main__':
    for p in (sys.argv[1:] or list(PARTS)):
        PARTS[p](); print('built', p)
