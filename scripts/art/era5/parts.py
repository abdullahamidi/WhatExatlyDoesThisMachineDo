# Era V machine parts (ART_ERA5 contract). Hand-pixelled from geometry; writes public/assets/machine/era5/*.png
# and SCR/era5-geo.json (ring ellipses, sockets) for the compositor. Usage: python3 parts.py [part ...]
from helpers import *
AX = 64                                   # spire axis (corner x)
CORE = (64, -490)                         # null core centre (corner), world art px
GEO = {'axis': AX, 'core': CORE}
SEL = sys.argv[1:]
def want(n): return not SEL or n in SEL

# ---------------------------------------------------------------- gallery 128x30, canvas (0,0) = world (0,-425)
def gallery():
    W, H = 128, 30; a = blank(W, H); oy = -425
    R = lambda y: y - oy                   # world row -> canvas row
    # deck plate world rows -418..-415 (canvas 7..10), x 0..127
    for x in range(W):
        put(a, x, 7, 'ink'); put(a, x, 8, 'i4' if x < 64 else 'i3'); put(a, x, 9, 'i2'); put(a, x, 10, 'ink')
    for x in (0, 127):
        for r in range(7, 11): put(a, x, r, 'ink')
    for x in range(4, 124, 8): put(a, x, 9, 'i5' if x < 64 else 'i4')       # bolt heads along the deck edge
    # cantilever Warren truss under each half: bottom chord (2,11) -> (55,28), mirror on the right
    def half(mx):
        X = (lambda x: x) if not mx else (lambda x: W - 1 - x)
        x0, y0, x1, y1 = 2, 11, 55, 28
        chord = lambda x: y0 + (y1 - y0) * (x - x0) / (x1 - x0)
        for x in range(x0, x1 + 1):
            y = int(round(chord(x)))
            put(a, X(x), y, 'i3'); put(a, X(x), y + 1, 'i1')
        verts = [12, 24, 36, 48]
        for vx in verts:
            yb = int(round(chord(vx)))
            for y in range(11, yb): put(a, X(vx), y, 'i2')
        # diagonals: from the foot of each vertical up to the deck at the next vertical (towards the tower = compression struts)
        pts = [x0] + verts
        for i in range(len(pts) - 1):
            xa, xb = pts[i], pts[i + 1]
            bres(a, X(xa + 1), 11, X(xb - 1), int(round(chord(xb - 1))) - 1, 'i2')
        # gusset plate on the tower leg + rivets
        for y in range(24, 30):
            for x in range(51, 57):
                if (x - 51) + (29 - y) <= 7: put(a, X(x), y, 'i3' if x < 54 else 'i2')
        put(a, X(53), 27, 'i5' if not mx else 'i4'); put(a, X(55), 28, 'ink')
        put(a, X(1), 11, 'ink'); put(a, X(1), 12, 'ink')                   # chord end cap under the deck tip
    half(False); half(True)
    check(a, 'gallery'); save(a, O + 'null-gallery.png')
    GEO['gallery'] = {'file': 'null-gallery.png', 'size': [W, H], 'canvasOrigin': [0, oy], 'socket': [64, -396], 'origin': [.5, 1],
                      'deckTop': -418, 'chordFeet': [[56, -397], [71, -397]]}

# ---------------------------------------------------------------- chamber frame 128x116, canvas (0,0) = world (0,-534)
def chamber():
    W, H = 128, 116; a = blank(W, H); oy = -534
    R = lambda y: y - oy
    def post(x0):                    # twin-chord lattice post, 6 px (same language as the Era II mast / Era IV tower)
        top, bot = R(-524), R(-419)
        for r in range(top, bot + 1):
            put(a, x0, r, 'ink'); put(a, x0 + 1, r, 'i4'); put(a, x0 + 4, r, 'i2'); put(a, x0 + 5, r, 'ink')
        for r in range(top, bot - 2):
            ph = (r - top) % 8
            put(a, x0 + 2 + (ph >= 4) * 1 - 0, r, 'i3' if ph in (0, 1, 6, 7) else None) if False else None
            if ph in (0, 1): put(a, x0 + 2, r, 'i3')
            if ph in (2, 3): put(a, x0 + 3, r, 'i3') if ph == 2 else put(a, x0 + 3, r, 'i2')
            if ph in (4, 5): put(a, x0 + 3, r, 'i2')
            if ph in (6, 7): put(a, x0 + 2, r, 'i3') if ph == 7 else put(a, x0 + 2, r, 'i2')
        for r in range(top + 15, bot - 3, 16):
            put(a, x0 + 2, r, 'i4'); put(a, x0 + 3, r, 'i3'); put(a, x0 + 1, r, 'i5')
        for r in range(R(-421), R(-419) + 1):                                 # foot plate on the deck
            for x in range(x0 - 3, x0 + 9): put(a, x, r, iron_col(x, x0 - 3, x0 + 8))
        hline(a, x0 - 3, x0 + 8, R(-421), 'ink')
        put(a, x0 - 2, R(-420), 'i5'); put(a, x0 + 7, R(-420), 'i2')
    post(5); post(117)
    # yoke truss world -531..-524 (canvas 3..10), x 2..125: chords + N-diagonals; guy-eye lugs at the ends
    for x in range(2, 126):
        put(a, x, 3, 'ink'); put(a, x, 4, 'i4'); put(a, x, 5, 'i2')
        put(a, x, 8, 'i3'); put(a, x, 9, 'i1'); put(a, x, 10, 'ink')
    for x in range(4, 124):
        ph = (x - 4) % 8
        if ph in (0, 1): put(a, x, 6, 'i3'); put(a, x, 7, 'i2')
        elif ph in (2, 3): put(a, x, 6 + (ph - 2), 'i2')
        elif ph in (4, 5): put(a, x, 7 - (ph - 4), 'i2')
    for x in (2, 125):
        for r in range(3, 11): put(a, x, r, 'ink')
    for (cx) in (1, 126):                                                      # eye lug: ring around a 1px hole
        for (dx, dy, k) in ((-1, -1, 'ink'), (0, -1, 'i4'), (1, -1, 'ink'), (-1, 0, 'i3'), (1, 0, 'i1'), (-1, 1, 'ink'), (0, 1, 'i1'), (1, 1, 'ink')):
            put(a, cx + dx, 6 + dy, k)
        put(a, cx, 6, None)
    for x in range(8, 122, 8): put(a, x, 4, 'i5' if x < 64 else 'i3')
    # collar (lens-column seat) x 50..77, canvas rows 0..3 (top row 0 = world -534)
    for r in range(0, 4):
        for x in range(50, 78): put(a, x, r, iron_col(x, 50, 77))
    hline(a, 50, 77, 0, 'ink'); hline(a, 51, 76, 1, 'i4')
    # knee gussets post/yoke (triangles under the beam)
    for (x0, s) in ((11, 1), (116, -1)):
        for j in range(7):
            for i in range(7 - j):
                x = x0 + s * i
                put(a, x, 11 + j, 'i2' if i < 6 - j else 'ink')
        put(a, x0 + s * 1, 12, 'i5' if s > 0 else 'i4')
    # side electrodes at core height (world -490 = canvas 44): rod + insulator shed + violet tip, gap 5 px to the core rim
    cr = R(CORE[1])
    def electrode(xs, s):           # xs = first rod column next to the post, s = +1 towards the core
        for i in range(18):
            x = xs + s * i
            put(a, x, cr - 1, 'i4'); put(a, x, cr, 'i2'); put(a, x, cr + 1, 'i0')
        for i, x in enumerate([xs + s * 4, xs + s * 5, xs + s * 6]):        # porcelain insulator shed (sand)
            for r in range(cr - 3, cr + 4):
                put(a, x, r, 's4' if r < cr else 's2' if r == cr else 's0')
            put(a, x, cr - 4, 'ink'); put(a, x, cr + 4, 'ink')
        for i, x in enumerate([xs + s * 10, xs + s * 11]):
            for r in range(cr - 2, cr + 3): put(a, x, r, 's3' if r < cr else 's1')
        tip = [xs + s * 18, xs + s * 19, xs + s * 20]
        for x in tip:
            put(a, x, cr - 1, 'x1'); put(a, x, cr, 'x2'); put(a, x, cr + 1, 'x1')
        put(a, tip[-1], cr, 'x3')
    electrode(11, 1); electrode(116, -1)
    # top electrode: from the collar down, tip ends 2 rows above the core top (-518)
    for r in range(11, 13):
        put(a, 62, r, 'i4'); put(a, 63, r, 'i3'); put(a, 64, r, 'i2'); put(a, 65, r, 'i0')
    for x in range(62, 66): put(a, x, 13, 'x1'); put(a, x, 14, 'x2')
    put(a, 63, 14, 'x3')
    check(a, 'chamber'); save(a, O + 'null-chamber.png')
    GEO['chamber'] = {'file': 'null-chamber.png', 'size': [W, H], 'canvasOrigin': [0, oy], 'socket': [64, -419], 'origin': [.5, 1],
                      'guyEyes': [[1, -528], [126, -528]], 'collarTop': -534, 'electrodeTips': [[31, -490], [96, -490], [64, -520]]}

# ---------------------------------------------------------------- null core 64x64 (rotates) + static glint overlay
def core():
    S = 64; c = 32.0; a = blank(S, S); R0 = 28.0
    arms = 3; k = 0.36
    for y in range(S):
        for x in range(S):
            dx, dy = x + .5 - c, y + .5 - c; d = math.hypot(dx, dy)
            if d > R0: continue
            if d > R0 - 1.3: put(a, x, y, 'x2'); continue
            if d > R0 - 2.6: put(a, x, y, 'x1'); continue
            if d < 4.2: put(a, x, y, 'ink'); continue
            th = math.atan2(dy, dx)
            # logarithmic spiral arms: theta = ln(d/r0)/k ; membership by angular distance
            ph = (th - math.log(d / 4.0) / k) * arms / (2 * math.pi)
            f = ph - math.floor(ph)
            if d > 6 and abs(f - .5) < .11 * (0.55 + d / R0): put(a, x, y, 'x1')
            elif d < 9: put(a, x, y, 'ink')
            else: put(a, x, y, 'x0')
    check(a, 'core'); save(a, O + 'null-core.png')
    # glint: static upper-left limb highlight (not rotated, light stays upper-left)
    g = blank(S, S)
    for y in range(S):
        for x in range(S):
            dx, dy = x + .5 - c, y + .5 - c; d = math.hypot(dx, dy); th = math.degrees(math.atan2(dy, dx))
            if R0 - 1.3 < d <= R0 and -165 <= th <= -105: put(g, x, y, 'x3')
            if R0 - 2.6 < d <= R0 - 1.3 and -150 <= th <= -125: put(g, x, y, 'x2')
    check(g, 'glint'); save(g, O + 'null-core-glint.png')
    GEO['core'] = {'file': 'null-core.png', 'size': [S, S], 'centre': list(CORE), 'radius': R0, 'rotFrames': 64}

# ---------------------------------------------------------------- containment rings: ellipse (a,b) rotated t, centre = core
RINGS = [  # level gate, a, b, tilt deg (clockwise, +y down)
    {'id': 'ring1', 'level': 1, 'a': 36, 'b': 7, 't': -10},
    {'id': 'ring2', 'level': 8, 'a': 42, 'b': 10, 't': 16},
    {'id': 'ring3', 'level': 16, 'a': 46, 'b': 13, 't': -24},
    {'id': 'ring4', 'level': 25, 'a': 50, 'b': 18, 't': 30},
]
RW, RH = 112, 72; RC = (56, 36)
def ell(r, ph):
    t = math.radians(r['t']); x, y = r['a'] * math.cos(ph), r['b'] * math.sin(ph)
    return x * math.cos(t) - y * math.sin(t), x * math.sin(t) + y * math.cos(t)
def rings():
    out = []
    for r in RINGS:
        back, front = blank(RW, RH), blank(RW, RH)
        seen = {}
        n = 2400
        for i in range(n):
            ph = 2 * math.pi * i / n; X, Y = ell(r, ph)
            px, py = int(math.floor(RC[0] + X)), int(math.floor(RC[1] + Y))
            seen.setdefault((px, py), []).append(math.sin(ph))
        # pixel-perfect: drop L-corner pixels (a pixel whose two 4-neighbours on the path are also diagonal-adjacent)
        pts = set(seen)
        def nb4(p): return [q for q in ((p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)) if q in pts]
        for p in sorted(pts):
            n4 = nb4(p)
            if len(n4) == 2 and abs(n4[0][0] - n4[1][0]) == 1 and abs(n4[0][1] - n4[1][1]) == 1:
                # removing p keeps the path 8-connected
                pts.discard(p)
        for p in pts:
            s = sum(seen[p]) / len(seen[p])
            if s >= 0: put(front, p[0], p[1], 'x2')
            else: put(back, p[0], p[1], 'x1')
        # highlight: front pixels within 25 deg of the leftmost/top-left of the near arc
        for p in pts:
            if get(front, *p) == 'x2':
                dx, dy = p[0] + .5 - RC[0], p[1] + .5 - RC[1]
                ang = math.degrees(math.atan2(dy, dx))
                if 150 <= ang <= 185 or -185 <= ang <= -170: put(front, p[0], p[1], 'x3')
        check(back, r['id']); check(front, r['id'])
        save(back, O + f"{r['id']}-back.png"); save(front, O + f"{r['id']}-front.png")
        out.append(dict(r, size=[RW, RH], centre=list(CORE), back=f"{r['id']}-back.png", front=f"{r['id']}-front.png"))
    # bead 5x5
    b = blank(5, 5)
    ascii_draw(b, ['..2..', '.232.', '23332', '.232.', '..2..'], {'2': 'x2', '3': 'x3'})
    for (x, y) in ((1, 1), (3, 1), (1, 3), (3, 3)): put(b, x, y, 'x2')
    put(b, 2, 2, 'x3'); put(b, 1, 2, 'x3'); put(b, 2, 1, 'x3')
    ascii_draw(b, ['..1..', '.232.', '13331', '.232.', '..1..'], {'1': 'x1', '2': 'x2', '3': 'x3'})
    save(b, O + 'ring-bead.png')
    GEO['rings'] = out

# ---------------------------------------------------------------- lens column 32x48, canvas (0,0) = world (48,-582)
LENSES = [(34, 24, 3), (22, 20, 3), (11, 16, 2)]   # (canvas row centre, width, half-thickness)
def lens_column():
    W, H = 32, 48; a = blank(W, H)
    # tapered struts: bottom x 2 / 29 (row 43) -> top x 7 / 24 (row 4); 2 px each (lit / shadow)
    for r in range(4, 44):
        t = (43 - r) / 39.0
        xl = int(round(2 + 5 * t)); xr = W - 1 - xl
        put(a, xl - 1, r, 'ink'); put(a, xl, r, 'i4'); put(a, xl + 1, r, 'i2'); put(a, xl + 2, r, 'ink')
        put(a, xr - 2, r, 'ink'); put(a, xr - 1, r, 'i3'); put(a, xr, r, 'i1'); put(a, xr + 1, r, 'ink')
    # bottom flange rows 44..47, top ring rows 0..3
    for r in range(44, 48):
        for x in range(0, 32): put(a, x, r, iron_col(x, 0, 31))
    hline(a, 0, 31, 44, 'ink'); hline(a, 1, 30, 45, 'i4'); hline(a, 0, 31, 47, 'ink')
    for x in (3, 28): put(a, x, 46, 'i5' if x < 16 else 'i3')
    for r in range(0, 4):
        for x in range(5, 27): put(a, x, r, iron_col(x, 5, 26))
    hline(a, 5, 26, 0, 'ink'); hline(a, 6, 25, 1, 'i4'); hline(a, 5, 26, 3, 'ink')
    # lenses: biconvex, edge-on; brass cells clamp the rims to the struts
    for (rc, w, ht) in LENSES:
        x0 = 16 - w // 2; x1 = 16 + w // 2 - 1
        for x in range(x0, x1 + 1):
            u = (x + .5 - 16) / (w / 2.0); h = ht * (1 - u * u)
            top = int(math.floor(rc - h)); bot = int(math.ceil(rc + h)) - 1
            if bot < top: top = bot = rc
            for r in range(top, bot + 1): put(a, x, r, 'i5')
            put(a, x, top, 'w0' if u < .2 else 'i5'); put(a, x, bot, 'i4')
            if u < -.2 and bot - top >= 2: put(a, x, top + 1, 'w0')
        for (cx, s) in ((x0 - 1, -1), (x1 + 1, 1)):                    # brass cell blocks 3x5
            for dx in range(3):
                for r in range(rc - 2, rc + 3):
                    xx = cx + s * dx if s > 0 else cx - dx
                    put(a, xx, r, 'ink' if r in (rc - 2, rc + 2) else ('r5' if r == rc - 1 else 'r3' if r == rc else 'r2'))
    check(a, 'lens'); save(a, O + 'lens-column.png')
    # light: converging cone (frame 0 dark), drawn BEHIND the column
    frames = [blank(W, H)]
    for lvl in range(3):
        f = blank(W, H)
        for r in range(2, 44):
            t = (43 - r) / 41.0; hw = 12 * (1 - t) + 1.5 * t
            for x in range(W):
                d = abs(x + .5 - 16)
                if d <= hw:
                    e = hw - d
                    k = ('x3' if e > hw * .55 else 'x2' if e > 1.2 else 'x1')
                    if lvl == 0: k = {'x3': 'x2', 'x2': 'x1', 'x1': 'x1'}[k]
                    if lvl == 1 and k == 'x3' and d > 1: k = 'x2'
                    put(f, x, r, k)
        frames.append(f)
    s = sheet([frames[0], frames[1], frames[2], frames[3]]); check(s, 'lenslight'); save(s, O + 'lens-light.png')
    GEO['lens'] = {'file': 'lens-column.png', 'size': [W, H], 'socket': [64, -535], 'origin': [.5, 1], 'canvasOrigin': [48, -582], 'lenses': LENSES}

# ---------------------------------------------------------------- aperture clamshell 64x28 x6, canvas (0,0) = world (32,-610)
def aperture():
    W, H = 64, 28; frames = []
    hinge = [(19.0, 22.0), (45.0, 22.0)]; cen = (32.0, 22.0); R1, R0 = 13.0, 10.0
    for k, ang in enumerate([0, 18, 36, 54, 72, 90]):
        a = blank(W, H)
        # drum rows 22..27 x 19..44
        for r in range(22, 28):
            for x in range(19, 45): put(a, x, r, iron_col(x, 19, 44))
        hline(a, 19, 44, 22, 'ink'); hline(a, 20, 43, 23, 'i4'); hline(a, 19, 44, 27, 'ink')
        for x in (22, 32, 41): put(a, x, 25, 'i5' if x < 32 else 'i3')
        if k >= 1:                                       # opening: violet light in the drum mouth
            wv = min(22, 4 + 4 * k)
            for x in range(32 - wv // 2, 32 + wv // 2): put(a, x, 22, 'x2' if abs(x + .5 - 32) < wv / 2 - 2 else 'x1')
            if k >= 3:
                for x in range(29, 35): put(a, x, 22, 'x3')
        th = math.radians(ang)
        for side in (0, 1):
            hx, hy = hinge[side]; s = -1 if side == 0 else 1
            for r in range(H):
                for x in range(W):
                    # inverse-rotate the pixel centre about the hinge into the closed pose
                    px, py = x + .5 - hx, r + .5 - hy
                    rot = s * th             # left petal: theta = -ang (tip swings out-left), right: +ang
                    qx = px * math.cos(-rot) - py * math.sin(-rot); qy = px * math.sin(-rot) + py * math.cos(-rot)
                    cx_, cy_ = qx + hx - cen[0], qy + hy - cen[1]
                    d = math.hypot(cx_, cy_)
                    if not (R0 <= d <= R1 and cy_ <= 0): continue
                    if (side == 0 and cx_ > 0) or (side == 1 and cx_ <= 0): continue
                    # closed-pose shading: outer shell lit upper-left, inner face violet-dark when open
                    outer = d > R1 - 1.1
                    ca = math.degrees(math.atan2(cy_, cx_))      # -180..0
                    if outer: kcol = 'ink' if ca > -40 else 'i4' if ca < -110 else 'i3'
                    elif d < R0 + 1.0: kcol = 'x1' if k >= 2 else 'i1'
                    else: kcol = 'i2' if ca < -100 else 'i1'
                    if abs(cx_) < 1.0: kcol = 'ink'           # petal seam
                    put(a, x, r, kcol)
            # hinge pin
            put(a, int(hx) - (1 if side == 0 else 0), int(hy) - 1, 'i5' if side == 0 else 'i3')
        frames.append(a)
    s = sheet(frames); check(s, 'aperture'); save(s, O + 'aperture.png')
    GEO['aperture'] = {'file': 'aperture.png', 'frame': [W, H], 'frames': 6, 'socket': [64, -583], 'origin': [.5, 1], 'canvasOrigin': [32, -610],
                       'beamFoot': [64, -588]}

# ---------------------------------------------------------------- resonant siphon tube 12x30 (+ arcs overlay per stage)
SIPHONS = [[30, 98], [18, 110], [42, 86]]   # stage 1/10/20 pair centres (corner x); base row -419 on the deck
def siphon():
    W, H = 12, 30; a = blank(W, H)
    # ceramic base rows 24..29 (sand), glass envelope rows 5..23 x 2..9 rounded top, electrode cap rows 0..4
    for r in range(24, 30):
        for x in range(1, 11): put(a, x, r, 's4' if x < 3 else 's3' if x < 6 else 's2' if x < 9 else 's0')
        put(a, 0, r, 'ink'); put(a, 11, r, 'ink')
    hline(a, 0, 11, 24, 'ink'); hline(a, 0, 11, 29, 'ink'); hline(a, 1, 10, 26, 'r3')   # brass band
    for r in range(7, 24):
        put(a, 2, r, 'i4'); put(a, 9, r, 'i3')
        for x in range(3, 9): put(a, x, r, 'x0')
    for x in range(3, 9): put(a, x, 6, 'i4')
    put(a, 3, 6, None); put(a, 8, 6, None); put(a, 2, 7, 'ink'); put(a, 9, 7, 'ink'); put(a, 3, 6, 'i4'); put(a, 8, 6, 'i3')
    put(a, 2, 6, None); put(a, 9, 6, None)
    for x in range(4, 8): put(a, x, 5, 'i4')
    # internal grid + filament (violet glow, small)
    for r in range(9, 23, 3): hline(a, 4, 7, r, 'x1')
    for r in range(8, 23): put(a, 5, r, 'x2'); put(a, 6, r, 'x1')
    put(a, 3, 8, 'w0'); put(a, 3, 9, 'w0')                        # glass glint upper-left
    # electrode cap + ball rows 0..4
    for r in range(2, 5): put(a, 5, r, 'i4'); put(a, 6, r, 'i2')
    for (x, y, k) in ((5, 0, 'x3'), (6, 0, 'x2'), (4, 1, 'x2'), (5, 1, 'x3'), (6, 1, 'x2'), (7, 1, 'x1')): put(a, x, y, k)
    check(a, 'siphon'); save(a, O + 'siphon-tube.png')
    # arcs: one overlay per stage (both sides), canvas 128x64, (0,0) = world (0,-500); frames 4 (0 none)
    cx, cy = CORE; ox, oy = 0, -500; arcs = []
    import random
    for st, (xl, xr) in enumerate(SIPHONS):
        fr = [blank(128, 64)]
        for f in range(1, 4):
            img = blank(128, 64); rnd = random.Random(100 * st + f)
            for x0 in (xl, xr):
                p0 = (x0, -449.5)
                v = (cx - p0[0], cy - p0[1]); L = math.hypot(*v); u = (v[0] / L, v[1] / L)
                p1 = (cx - u[0] * 28.5, cy - u[1] * 28.5)
                n = int(math.hypot(p1[0] - p0[0], p1[1] - p0[1]))
                pts = []; jit = 0
                for i in range(n + 1):
                    t = i / n
                    if 0 < i < n and i % 3 == 0: jit = max(-2, min(2, jit + rnd.choice((-1, 0, 1))))
                    if i in (0, n): jit = 0
                    x = p0[0] + (p1[0] - p0[0]) * t - u[1] * jit; y = p0[1] + (p1[1] - p0[1]) * t + u[0] * jit
                    pts.append((int(math.floor(x)) - ox, int(math.floor(y)) - oy))
                for (x, y), (x2, y2) in zip(pts, pts[1:]): bres(img, x, y, x2, y2, 'x3' if f == 2 else 'x2')
                if f == 2:
                    for (x, y) in pts[::4]: put(img, x + 1, y, 'x1')
            fr.append(img)
        s = sheet(fr); check(s, 'arcs'); save(s, O + f'siphon-arcs-{st + 1}.png'); arcs.append(f'siphon-arcs-{st + 1}.png')
    GEO['siphon'] = {'file': 'siphon-tube.png', 'size': [W, H], 'origin': [.5, 1], 'pairs': SIPHONS, 'baseY': -419, 'arcs': arcs,
                     'arcCanvasOrigin': [0, -500], 'arcFrame': [128, 64]}

# ---------------------------------------------------------------- inversion ghost (violet outline of the mirrored hand crank)
def ghost():
    src = load(A + 'machine/hand-crank.png')[:, ::-1].copy()
    m = src[:, :, 3] > 0; H, W = m.shape; g = blank(W, H)
    for y in range(H):
        for x in range(W):
            if not m[y, x]: continue
            edge = any(not (0 <= y + dy < H and 0 <= x + dx < W) or not m[y + dy, x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge: put(g, x, y, 'x2')
    # hub ring and knob core inside (thin, keeps the ghost readable but light)
    for y in range(H):
        for x in range(W):
            d = math.hypot(x + .5 - 24, y + .5 - 24)
            if 2.5 < d < 3.6: put(g, x, y, 'x3')
    check(g, 'ghost'); save(g, O + 'inversion-ghost.png')
    GEO['ghost'] = {'file': 'inversion-ghost.png', 'size': [48, 48], 'socket': [0, -56], 'rotFrames': 80, 'ratio': 1.75}

# ---------------------------------------------------------------- name plate 40x11 x6 on the frame top girder face
PLATE_TEXT = ['???????', 'R?S????', 'RES?OR?', 'REST?RE', 'RESTOR?', 'RESTORE']
def plate():
    from fonts import F3, text_mask
    W, H = 40, 11; frames = []
    for i, s in enumerate(PLATE_TEXT):
        a = blank(W, H)
        for r in range(H):
            for x in range(W): put(a, x, r, brass_col(x, 0, W - 1) if r not in (0, H - 1) else 'ink')
        for r in range(1, H - 1): put(a, 0, r, 'ink'); put(a, W - 1, r, 'ink')
        hline(a, 1, W - 2, 1, 'r5'); hline(a, 1, W - 2, H - 2, 'r1')
        for (x, y) in ((2, 2), (W - 3, 2), (2, H - 3), (W - 3, H - 3)): put(a, x, y, 'a2' if x < 20 else 'r5')
        m = text_mask(s, F3); tw = len(m[0]); x0 = (W - tw) // 2
        for j in range(5):
            for k in range(tw):
                if m[j][k]: put(a, x0 + k, 3 + j, 'r0'); put(a, x0 + k + 1, 4 + j, 'r5') if not (k + 1 < tw and j + 1 < 5 and m[j + 1][k + 1]) and get(a, x0 + k + 1, 4 + j) != 'r0' else None
        for j in range(5):                                   # re-stamp letters so the drop highlight never covers them
            for k in range(tw):
                if m[j][k]: put(a, x0 + k, 3 + j, 'r0')
        if i == 0:                                          # era I: dust caked, unreadable (sand clusters over letters)
            for (x, y) in ((8, 3), (9, 4), (14, 5), (15, 5), (21, 3), (22, 4), (28, 6), (29, 5), (31, 4), (11, 7), (25, 7)):
                put(a, x, y, 's2'); put(a, x + 1, y, 's1')
        frames.append(a)
    s = sheet(frames); check(s, 'plate'); save(s, O + 'name-plate.png')
    GEO['plate'] = {'file': 'name-plate.png', 'frame': [W, H], 'frames': 6, 'socket': [64, -102], 'origin': [.5, .5], 'text': PLATE_TEXT}

# ---------------------------------------------------------------- gravitic anchor 32x128 (+ glow stage sheets), socket (+-520, 0)
ANCHOR_COLLARS = [(32, 38), (60, 66), (88, 94)]
def anchor():
    import random
    W, H = 32, 128; a = blank(W, H); rnd = random.Random(7)
    # eye lug rows 0..12: ring r 6.5 about corner (16,7), hole r 2.6
    for y in range(0, 14):
        for x in range(W):
            d = math.hypot(x + .5 - 16, y + .5 - 7)
            if 2.6 < d <= 6.5:
                ang = math.degrees(math.atan2(y + .5 - 7, x + .5 - 16))
                k = 'ink' if d > 5.6 else ('i4' if -170 < ang < -60 else 'i3' if (ang <= -170 or ang >= 120 or -60 <= ang < 0) else 'i1')
                if d < 3.5: k = 'ink'
                put(a, x, y, k)
    for y in range(12, 14):
        for x in range(13, 19): put(a, x, y, iron_col(x, 13, 18))
    # domed octagonal cap rows 13..25, x 2..29
    for y in range(13, 26):
        ch = max(0, 4 - (y - 13)) if y < 17 else max(0, y - 23)
        x0, x1 = 2 + ch, 29 - ch
        for x in range(x0, x1 + 1): put(a, x, y, iron_col(x, x0, x1))
        put(a, x0, y, 'ink'); put(a, x1, y, 'ink')
    hline(a, 6, 25, 13, 'ink'); hline(a, 4, 27, 25, 'ink'); hline(a, 5, 26, 14, 'i4'); hline(a, 4, 12, 15, 'i5')
    hline(a, 3, 28, 21, 'i1'); hline(a, 3, 28, 22, 'ink')
    for x in (5, 10, 16, 21, 26): put(a, x, 18, 'i5' if x < 16 else 'i3'); put(a, x, 19, 'i0')
    # shaft x 5..26 rows 26..121, two riveted plate seams
    for y in range(26, 122):
        for x in range(5, 27): put(a, x, y, iron_col(x, 5, 26))
        put(a, 11, y, 'i1' if y % 2 else 'i2'); put(a, 20, y, 'i0')
    for y in range(29, 120, 5): put(a, 12, y, 'i4'); put(a, 21, y, 'i2'); put(a, 7, y + 2, 'i5')
    # collars x 1..30, 7 rows
    for (y0, y1) in ANCHOR_COLLARS:
        for y in range(y0, y1 + 2):
            for x in range(1, 31): put(a, x, y, iron_col(x, 1, 30))
        hline(a, 1, 30, y0, 'ink'); hline(a, 2, 29, y0 + 1, 'i4'); hline(a, 1, 30, y1 + 1, 'ink')
        hline(a, 2, 29, y0 + 3, 'x0')                       # coil groove (dark violet seam = unlit coil)
        for x in range(3, 30, 4): put(a, x, y0 + 2, 'i5' if x < 16 else 'i3'); put(a, x, y1, 'i5' if x < 16 else 'i3'); put(a, x, y1 + 0, 'i4')
        hline(a, 5, 26, y1 + 2, 'i0'); hline(a, 5, 26, y1 + 3, 'i1')
    # rust: clustered patches (4..9 px) on plates, darker core, lit rim upper-left
    import random as _r
    rr = _r.Random(11)
    for _ in range(11):
        y = rr.randint(44, 112); x = rr.randint(6, 22)
        if any(y0 - 2 <= y <= y1 + 5 for (y0, y1) in ANCHOR_COLLARS): continue
        shape = [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (1, 2), (2, 2), (1, 3)][: rr.randint(5, 10)]
        for (dx, dy) in shape:
            if get(a, x + dx, y + dy) in ('i1', 'i2', 'i3', 'i4', 'i0'): put(a, x + dx, y + dy, 'r2' if x + dx > 15 else 'r3')
        put(a, x + 1, y + 1, 'r1'); put(a, x, y, 'r4' if x < 16 else 'r3')
    # rust streak under each collar (water run-off)
    for (y0, y1) in ANCHOR_COLLARS:
        for x in (8, 17, 24):
            for dy in range(2, 2 + rr.randint(2, 5)):
                if get(a, x, y1 + dy) is not None: put(a, x, y1 + dy, 'r2' if x > 15 else 'r3')
    # earth mound rows 114..127 (heaped where the pile was driven): trapezoid, sand ramp lit upper-left
    for y in range(114, 128):
        t = (y - 114) / 13.0; hw = 9 + 7 * t ** .7
        x0, x1 = int(round(16 - hw)), int(round(16 + hw)) - 1
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            k = 's3' if u < .22 and y < 121 else 's2' if u < .5 else 's1' if u < .8 else 's0'
            if y == 114 + int(3 * abs(u - .5) * 2) : k = 's3' if u < .5 else 's2'
            put(a, x, y, k)
        put(a, x0, y, 's2'); put(a, x1, y, 's0')
    for (x, y) in ((10, 119), (11, 120), (12, 120), (20, 118), (21, 119), (22, 121), (6, 124), (25, 125), (26, 125)):
        put(a, x, y, 's0')
    for (x, y) in ((8, 122), (23, 123), (15, 126)): put(a, x, y, 'k0'); put(a, x + 1, y, 'i2')
    check(a, 'anchor'); save(a, O + 'gravitic-anchor.png')
    # glow stage sheets: stage n lights collars 1..n; frames 0 (unlit), 1 x1, 2 x2 + x3 glints, 3 x1
    for st in (1, 2, 3):
        frames = []
        for f in range(4):
            g = blank(W, H)
            for i, (y0, y1) in enumerate(ANCHOR_COLLARS[::-1][:st]):     # bottom collar first (closest to the ground)
                if f == 0: continue
                k = {1: 'x1', 2: 'x2', 3: 'x1'}[f]
                hline(g, 2, 29, y0 + 3, k)
                if f == 2:
                    for x in (5, 13, 21, 27): put(g, x, y0 + 3, 'x3')
            frames.append(g)
        sh = sheet(frames); check(sh, 'aglow'); save(sh, O + f'anchor-glow-{st}.png')
    GEO['anchor'] = {'file': 'gravitic-anchor.png', 'size': [W, H], 'origin': [.5, 1], 'sockets': [[-520, 0], [520, 0]],
                     'eye': [0, -121], 'glow': ['anchor-glow-1.png', 'anchor-glow-2.png', 'anchor-glow-3.png'], 'collarsCanvasRows': ANCHOR_COLLARS}

if __name__ == '__main__':
    for n, f in (('gallery', gallery), ('chamber', chamber), ('core', core), ('rings', rings), ('lens', lens_column),
                 ('aperture', aperture), ('siphon', siphon), ('ghost', ghost), ('plate', plate), ('anchor', anchor)):
        if want(n): f()
    gp = SCR + 'era5-geo.json'
    old = json.load(open(gp)) if os.path.exists(gp) else {}
    old.update(GEO); json.dump(old, open(gp, 'w'), indent=1)
    print('ok', list(GEO))
