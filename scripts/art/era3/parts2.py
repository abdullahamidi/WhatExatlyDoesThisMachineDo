# Era III parts (hand-pixelled + curated PixelLab). Imported by build.py.
from helpers import *

def radial(cx, cy, x, y):
    """unit vector from centre to pixel centre; light from upper-left -> dot<0 is lit."""
    dx, dy = x + .5 - cx, y + .5 - cy; d = math.hypot(dx, dy) or 1
    return dx / d, dy / d, d

# ---------------------------------------------------------------- steam hammer: static frame 48x96 + ram 12x36
def hammer():
    a = load(G + 'hammer-3.png')
    # 1. lift the ram (rod cols 22..25 rows 39..59, tup rows 60..69 cols 19..28) out of the frame
    ram_src = a[39:70, 18:30].copy()
    for y in range(39, 70):
        for x in range(18, 30): put(a, x, y, None)
    # gland under the crosshead stays: rows 39..41 cols 20..27 already part of the frame block? redraw a neat gland
    rect(a, 21, 39, 26, 41, 'i2'); hline(a, 21, 26, 39, 'i3'); vline(a, 20, 39, 41, 'ink'); vline(a, 27, 39, 41, 'ink'); hline(a, 20, 27, 42, 'ink')
    rect(a, 22, 42, 25, 42, 'ink')
    # 2. replace the blacksmith (horned) anvil with a steam-hammer anvil block + die
    for y in range(73, 89):
        for x in range(12, 36): put(a, x, y, None)
    rect(a, 18, 74, 29, 76, 'i2'); hline(a, 18, 29, 74, 'i4'); hline(a, 19, 28, 75, 'i3')       # die (top face row 74)
    vline(a, 17, 74, 76, 'ink'); vline(a, 30, 74, 76, 'ink'); hline(a, 17, 30, 73, 'ink')
    rect(a, 16, 77, 31, 80, 'i1'); hline(a, 16, 31, 77, 'i3'); vline(a, 15, 77, 80, 'ink'); vline(a, 32, 77, 80, 'ink')  # sow block
    for x in (18, 29): put(a, x, 79, 'i4')                                                          # wedge keys
    rect(a, 14, 81, 33, 88, 'i1'); hline(a, 14, 33, 81, 'i3'); vline(a, 14, 81, 88, 'i2')          # anvil block
    vline(a, 13, 81, 88, 'ink'); vline(a, 34, 81, 88, 'ink'); hline(a, 13, 34, 80, 'ink')
    vline(a, 33, 82, 88, 'i0'); hline(a, 15, 32, 88, 'i0')
    for (x, y) in ((16, 84), (17, 84), (17, 85), (30, 86), (31, 86), (22, 87), (23, 87)): put(a, x, y, 'r2')
    put(a, 17, 83, 'r3'); put(a, 30, 85, 'r3')
    # 3. valve chest: remove the top hand-wheel (rows 14..16 cols 32..36) -> steam inlet comes from above
    for y in range(14, 17):
        for x in range(32, 37): put(a, x, y, None)
    hline(a, 32, 37, 17, 'ink'); hline(a, 33, 36, 18, 'i3')
    check(a, 'hammer'); save(a, O + 'steam-hammer.png')
    # ram sprite 12x36: rod cols 4..7, tup rows 26..35 (striking face = bottom edge)
    r = blank(12, 36)
    for y in range(0, 26):
        put(r, 4, y, 'ink'); put(r, 5, y, 'i4'); put(r, 6, y, 'i2'); put(r, 7, y, 'ink')
    for y in range(0, 26, 6): put(r, 5, y, 'i5')                                                    # polish glints
    tup = ram_src[21:31]                                                                            # rows 60..69 of the source
    r[26:36] = tup
    rect(r, 1, 26, 10, 26, None) if False else None
    check(r, 'ram'); save(r, O + 'hammer-ram.png')
    return a

# ---------------------------------------------------------------- turbine 80x64 (casing + gearcase + alternator) and rotor 28x28
TC = (30, 34)      # casing centre corner (canvas)
AC = (68, 41)      # alternator centre corner
def turbine():
    W, H = 80, 64; a = blank(W, H)
    cx, cy = TC
    # bedplate rows 57..63 cols 4..76 with feet
    for y in range(57, 64):
        for x in range(4, 77): put(a, x, y, 'i1')
    hline(a, 4, 76, 57, 'ink'); hline(a, 5, 75, 58, 'i3'); hline(a, 4, 76, 63, 'ink'); vline(a, 4, 57, 63, 'ink'); vline(a, 76, 57, 63, 'ink')
    hline(a, 5, 75, 62, 'i0')
    for x in range(8, 74, 8): put(a, x, 60, 'i4'); put(a, x + 1, 60, 'i0')
    # cradle under casing and alternator
    for y in range(48, 57):
        for x in range(12, 49):
            if math.hypot(x + .5 - cx, y + .5 - cy) > 22: put(a, x, y, 'i2' if x < 30 else 'i1')
    for y in range(48, 57):
        put(a, 11 + (56 - y) // 3, y, 'ink'); put(a, 49 - (56 - y) // 3, y, 'ink')
    for y in range(50, 57):
        for x in range(58, 76): put(a, x, y, 'i1')
    hline(a, 58, 75, 50, 'ink'); vline(a, 58, 50, 56, 'ink'); vline(a, 75, 50, 56, 'ink'); hline(a, 59, 74, 51, 'i3')
    # gearcase bridge between casing and alternator rows 30..50
    for y in range(29, 51):
        for x in range(46, 64): put(a, x, y, 'i2' if y < 40 else 'i1')
    hline(a, 46, 63, 29, 'ink'); hline(a, 47, 62, 30, 'i3'); hline(a, 46, 63, 50, 'ink')
    for x in range(49, 62, 4): put(a, x, 32, 'i4'); put(a, x, 47, 'i3')
    # casing: flange ring r 21.5..24, body r 15..21.5, window lip r 13..15, window r<13
    for y in range(H):
        for x in range(W):
            ux, uy, d = radial(cx, cy, x, y)
            lit = -(ux + uy) / 1.414           # +1 upper-left .. -1 lower-right
            if d <= 24.3:
                if d > 23.4: k = 'ink'
                elif d > 21.5: k = 'i4' if lit > .45 else 'i3' if lit > -.2 else 'i2' if lit > -.7 else 'i1'
                elif d > 20.6: k = 'i1' if lit > -.3 else 'i0'
                elif d > 15.2: k = 'i3' if lit > .55 else 'i2' if lit > -.45 else 'i1'
                elif d > 14.3: k = 'i4' if lit < -.2 else 'i0'          # lip: lit on the lower-right inner edge (recess)
                elif d > 13.2: k = 'ink'
                else: k = 'i0' if (lit > 0 and d > 12.4) else 'ink'
                put(a, x, y, k)
    for i in range(12):                                                    # flange bolts r 22.6
        t = i * math.pi / 6 + math.pi / 12
        bx, by = cx + 22.6 * math.cos(t), cy + 22.6 * math.sin(t)
        put(a, int(math.floor(bx)), int(math.floor(by)), 'i5' if math.cos(t) + math.sin(t) < 0 else 'i0')
    # rust patches on casing body
    for (x, y) in ((16, 40), (17, 40), (16, 41), (17, 42), (18, 41), (40, 22), (41, 22), (41, 23), (42, 24), (24, 49), (25, 49), (25, 50), (26, 50),
                   (6, 61), (7, 61), (40, 61), (41, 61), (41, 62), (66, 53), (67, 53), (67, 54)):
        put(a, x, y, 'r2' if (x + y) % 3 else 'r3')
    put(a, 17, 41, 'r4'); put(a, 41, 23, 'r4')
    # nozzle chest on top: flange rows 1..2 cols 27..33, body rows 3..10 cols 27..34 narrowing into casing
    rect(a, 26, 3, 33, 11, 'i2'); vline(a, 26, 3, 11, 'ink'); vline(a, 33, 3, 11, 'ink'); vline(a, 27, 3, 11, 'i4'); vline(a, 32, 3, 11, 'i0')
    hline(a, 25, 34, 2, 'ink'); hline(a, 25, 34, 3, 'ink')
    rect(a, 26, 4, 33, 5, 'i3'); hline(a, 26, 33, 4, 'i4'); hline(a, 25, 34, 6, 'ink')                  # nozzle flange/collar
    for x in (27, 32): put(a, x, 5, 'i5')
    put(a, 35, 8, 'ink'); put(a, 36, 8, 'ink'); put(a, 35, 7, 'i4'); put(a, 36, 7, 'i3')                  # nozzle valve stem stub
    # alternator end-on: r 10, fins + end shield + terminal box
    ax, ay = AC
    for y in range(H):
        for x in range(W):
            ux, uy, d = radial(ax, ay, x, y)
            lit = -(ux + uy) / 1.414
            if d <= 10.3:
                if d > 9.4: k = 'ink'
                elif d > 7.5:
                    ang = math.atan2(uy, ux); fin = int((ang + math.pi) / (2 * math.pi) * 24) % 2
                    k = ('i4' if lit > .3 else 'i3' if lit > -.4 else 'i1') if fin == 0 else 'i0'
                elif d > 6.6: k = 'ink'
                elif d > 2.6: k = 'i3' if lit > .4 else 'i2' if lit > -.4 else 'i1'
                elif d > 1.6: k = 'i0'
                else: k = 'i4'
                put(a, x, y, k)
    for t in (0.6, 2.2, 3.8, 5.4):
        put(a, int(ax + 4.6 * math.cos(t)), int(ay + 4.6 * math.sin(t)), 'ink')                       # end-shield vents
    # terminal box on top of alternator rows 24..30 cols 63..72, aqua bushing rows 19..23 cols 66..69
    rect(a, 63, 25, 72, 30, 'i2'); hline(a, 62, 73, 24, 'ink'); vline(a, 62, 24, 30, 'ink'); vline(a, 73, 24, 30, 'ink'); hline(a, 63, 72, 25, 'i3')
    hline(a, 63, 72, 30, 'i0')
    put(a, 65, 27, 'i4'); put(a, 70, 27, 'i4')
    rect(a, 66, 20, 69, 23, 'c1'); vline(a, 66, 20, 23, 'c2'); vline(a, 69, 20, 23, 'c0'); hline(a, 65, 70, 22, 'c0'); hline(a, 66, 69, 19, 'ink')
    put(a, 65, 20, 'ink'); put(a, 70, 20, 'ink'); put(a, 65, 21, 'ink'); put(a, 70, 21, 'ink'); put(a, 65, 23, 'ink'); put(a, 70, 23, 'ink')
    put(a, 67, 18, 'i3'); put(a, 68, 18, 'i3')                                                          # wire stud (tie corner (68,18))
    check(a, 'turbine'); save(a, O + 'turbine.png')
    rotor()
    return a

def rotor():
    W = 28; a = blank(W, W); c = 14
    for y in range(W):
        for x in range(W):
            ux, uy, d = radial(c, c, x, y)
            if d > 12.3: continue
            ang = math.atan2(uy, ux)
            if d > 8.2:                                                   # 16 curved buckets
                ph = ((ang + 0.10 * (d - 8)) / (2 * math.pi) * 16) % 1
                k = 'i4' if ph < .45 else 'i2' if ph < .62 else 'ink'
                if d > 11.5: k = 'i1' if k != 'ink' else 'ink'            # shroud band
            elif d > 7.4: k = 'ink'
            elif d > 3.4:
                k = 'i2'
                ph = (ang / (2 * math.pi) * 4) % 1                        # 4 lightening holes
                if 4.6 < d < 6.4 and (ph < .12 or ph > .88): k = 'ink'
            elif d > 2.4: k = 'i1'
            else: k = 'i4'
            put(a, x, y, k)
    check(a, 'rotor'); save(a, O + 'turbine-rotor.png')

# ---------------------------------------------------------------- condenser 80x24
def condenser():
    W, H = 80, 24; a = blank(W, H)
    prof = {6: 'ink', 7: 'i4', 8: 'i3', 9: 'i3', 10: 'i2', 11: 'i2', 12: 'i2', 13: 'i2', 14: 'i1', 15: 'i1', 16: 'i1', 17: 'i0', 18: 'i0', 19: 'ink'}
    for y, k in prof.items():
        for x in range(8, 72): put(a, x, y, k)
    # domed water boxes cols 1..8 / 71..78
    for side in (0, 1):
        for y in range(7, 19):
            dy = abs(y + .5 - 13); w = int(round(6 * math.sqrt(max(0, 1 - (dy / 6.6) ** 2))))
            for i in range(w + 1):
                x = 7 - i if side == 0 else 72 + i
                k = prof.get(y, 'i2')
                if i == w: k = 'ink'
                put(a, x, y, k)
        fx = 8 if side == 0 else 71
        vline(a, fx, 5, 20, 'ink'); vline(a, fx + (1 if side == 0 else -1), 6, 19, 'i4' if side == 0 else 'i1')
        for y in range(7, 19, 3): put(a, fx, y, 'i5' if y < 12 else 'i3')
    # exhaust deck: flange plate rows 0..1 cols 4..76, neck rows 2..5 cols 14..66 (bolted)
    for y in range(2, 6):
        lo, hi = 14 - (y - 2), 66 + (y - 2)
        for x in range(lo, hi + 1): put(a, x, y, 'i2' if x < 40 else 'i1')
        put(a, lo, y, 'ink'); put(a, hi, y, 'ink')
    rect(a, 4, 0, 76, 1, 'i3'); hline(a, 4, 76, 0, 'ink'); hline(a, 5, 75, 1, 'i4' if True else 'i3')
    vline(a, 4, 0, 1, 'ink'); vline(a, 76, 0, 1, 'ink'); hline(a, 13, 67, 2, 'ink')
    for x in range(8, 74, 6): put(a, x, 1, 'i5' if x < 40 else 'i3')
    # tube-plate seams and rivets
    for sx in (28, 52):
        vline(a, sx, 7, 18, 'i1'); vline(a, sx + 1, 7, 18, 'i3')
    for x in range(10, 70, 4): put(a, x, 8, 'i5' if x < 40 else 'i4')
    # saddles rows 19..23
    for (s0, s1) in ((14, 23), (56, 65)):
        for y in range(19, 24):
            for x in range(s0, s1 + 1): put(a, x, y, 'i1')
        vline(a, s0, 19, 23, 'ink'); vline(a, s1, 19, 23, 'ink'); hline(a, s0, s1, 23, 'ink'); hline(a, s0 + 1, s1 - 1, 20, 'i3')
        put(a, s0 + 2, 22, 'i4'); put(a, s1 - 2, 22, 'i4')
    # hotwell sump (condensate outlet) rows 19..22 cols 38..43
    rect(a, 38, 19, 43, 22, 'i2'); vline(a, 37, 19, 22, 'ink'); vline(a, 44, 19, 22, 'ink'); hline(a, 37, 44, 23, 'ink'); hline(a, 38, 43, 20, 'i3')
    # cooling water nozzles: inlet low-left, outlet high-right
    rect(a, 0, 14, 1, 16, 'i2'); hline(a, 0, 1, 14, 'i4'); hline(a, 0, 1, 16, 'i0'); vline(a, 0, 13, 17, 'ink')
    rect(a, 78, 9, 79, 11, 'i2'); hline(a, 78, 79, 9, 'i4'); hline(a, 78, 79, 11, 'i0'); vline(a, 79, 8, 12, 'ink')
    for (x, y) in ((18, 15), (19, 15), (19, 16), (20, 16), (45, 11), (46, 11), (46, 12), (62, 16), (63, 16), (63, 17), (33, 3), (34, 3)):
        put(a, x, y, 'r2' if (x + y) % 2 else 'r3')
    put(a, 19, 16, 'r4')
    check(a, 'condenser'); save(a, O + 'condenser.png'); return a

# ---------------------------------------------------------------- pressure gauge 24x24 + needle sheet (25 frames, -135..+135 deg)
GC = (12, 10); GAUGE_FRAMES = 25
def gauge():
    W, H = 24, 24; a = blank(W, H); cx, cy = GC
    for y in range(H):
        for x in range(W):
            ux, uy, d = radial(cx, cy, x, y)
            lit = -(ux + uy) / 1.414
            if d <= 9.2:
                if d > 8.3: k = 'ink'
                elif d > 6.6: k = 'r5' if lit > .35 else 'r4' if lit > -.35 else 'r3'      # brass bezel
                elif d > 5.9: k = 'r2'
                else: k = 's4'
                put(a, x, y, k)
    for i in range(11):                                                   # ticks every 27 deg over 270
        t = math.radians(-135 + 27 * i)
        for rr in (4.8, 5.6):
            x = cx + rr * math.sin(t); y = cy - rr * math.cos(t)
            put(a, int(math.floor(x)), int(math.floor(y)), 'e1' if i >= 9 else 's0')
    put(a, 11, 13, 's1'); put(a, 12, 13, 's1')                            # makers plate smudge
    # siphon (pigtail ring) stem: ring rows 18..21, stem cols 11..12 rows 18..22, foot row 23 cols 8..15
    vline(a, 11, 18, 22, 'i3'); vline(a, 12, 18, 22, 'i1')
    ring(a, 14.0, 20.0, 1.2, 2.3, 'i2'); put(a, 13, 19, 'i4'); put(a, 15, 21, 'i0')
    hline(a, 8, 15, 23, 'ink'); hline(a, 9, 14, 22, 'i3'); put(a, 8, 22, 'ink'); put(a, 15, 22, 'ink')
    vline(a, 10, 18, 21, 'ink'); vline(a, 13, 18, 18, 'ink')
    check(a, 'gauge'); save(a, O + 'gauge.png')
    sheet = blank(W * GAUGE_FRAMES, H)
    for f in range(GAUGE_FRAMES):
        n = blank(W, H)
        t = math.radians(-135 + 270 * f / (GAUGE_FRAMES - 1))
        sx, sy = math.sin(t), -math.cos(t)
        for s in [i / 8 for i in range(-14, 46)]:                         # tail 1.75 px, tip 5.6 px
            x = cx + s * sx; y = cy + s * sy
            put(n, int(math.floor(x)), int(math.floor(y)), 'e1' if s > 3.2 else 'ink')
        put(n, 11, 9, 'i4'); put(n, 12, 9, 'i3'); put(n, 11, 10, 'i3'); put(n, 12, 10, 'i1')   # hub cap 2x2 on corner (12,10)
        sheet[:, f * W:(f + 1) * W] = n
    check(sheet, 'needle'); save(sheet, O + 'gauge-needle.png')
    return a

# ---------------------------------------------------------------- relief valves 16x24 (Ramsbottom pair: two columns, lever, spring)
def relief():
    W, H = 16, 24; a = blank(W, H)
    hline(a, 1, 14, 23, 'ink'); rect(a, 1, 21, 14, 22, 'i2'); hline(a, 1, 14, 21, 'i3'); vline(a, 1, 20, 23, 'ink'); vline(a, 14, 20, 23, 'ink'); hline(a, 2, 13, 20, 'ink')
    for cxl in (3, 10):                                                   # valve columns cols cxl..cxl+2
        rect(a, cxl, 9, cxl + 2, 19, 'i2'); vline(a, cxl, 9, 19, 'i3'); vline(a, cxl + 2, 9, 19, 'i1')
        vline(a, cxl - 1, 9, 19, 'ink'); vline(a, cxl + 3, 9, 19, 'ink')
        hline(a, cxl - 1, cxl + 3, 8, 'ink')
        rect(a, cxl - 1, 17, cxl + 3, 19, 'i2'); hline(a, cxl - 1, cxl + 3, 17, 'i4'); put(a, cxl - 2, 18, 'ink'); put(a, cxl + 4, 18, 'ink')
        put(a, cxl + 1, 7, 'r5'); put(a, cxl, 7, 'ink'); put(a, cxl + 2, 7, 'ink')          # brass valve caps
        put(a, cxl + 1, 6, 'a2')
    # spring between columns cols 7..8 rows 10..18
    for y in range(10, 19):
        put(a, 7, y, 'i4' if y % 2 else 'i1'); put(a, 8, y, 'i1' if y % 2 else 'i4')
    # lever row 5..6 across, handle running right to col 15
    hline(a, 1, 15, 5, 'i3'); hline(a, 1, 15, 6, 'i1'); put(a, 0, 5, 'ink'); put(a, 0, 6, 'ink'); hline(a, 1, 15, 4, 'ink')
    put(a, 15, 7, 'ink'); put(a, 15, 3, 'ink'); put(a, 15, 4, 'ink')
    put(a, 7, 7, 'i3'); put(a, 8, 7, 'i1'); put(a, 7, 8, 'ink'); put(a, 8, 8, 'ink')
    check(a, 'relief'); save(a, O + 'relief-valves.png'); return a

# ---------------------------------------------------------------- firebox glow 24x24 x 4 frames, 3 stages
# window = local cols 8..16 rows 8..16 (boiler cols 104..112, rows 60..68); door frame ring around it
def firebox():
    hot = ['r4', 'a0', 'a1', 'a2']
    for st in (1, 2, 3):
        sheet = blank(24 * 4, 24)
        for f in range(4):
            a = blank(24, 24)
            rnd = [(3 * f + i * 7) % 5 for i in range(32)]
            if st == 1:
                for i, x in enumerate((10, 12, 14)):                    # air-vent slots glow
                    put(a, x, 10, 'e1'); put(a, x, 11, 'a0' if (f + i) % 3 else 'e1')
                put(a, 9 + (f * 3) % 7, 16, 'e0')
            else:
                for y in range(8, 17):
                    for x in range(8, 17):
                        h = (16 - y) + (rnd[(x * 3 + y) % 32] - 2) * .6
                        lvl = 3 if h < 2.2 else 2 if h < 4.5 else 1 if h < 6.4 else 0
                        if st == 2: lvl = max(0, lvl - 1)
                        k = 'e0' if lvl == 0 and y < 11 else hot[lvl]
                        put(a, x, y, k)
                for x in range(9, 16, 2):                                 # grate bars silhouette
                    put(a, x, 16, 'ink')
                if st == 3:                                               # spill onto door frame + ash-pan lip
                    for x in range(6, 19):
                        put(a, x, 18, 'e1' if (x + f) % 3 else 'a0')      # full row: covers every stage-2 spill pixel
                    for y in range(9, 16, 2): put(a, 6, y, 'e1'); put(a, 18, y, 'e0')
                    for x in range(7, 18, 2): put(a, x, 21, 'a0' if (x + f) % 4 else 'e1')
                else:
                    for x in range(8, 17, 3): put(a, x + f % 2, 18, 'e0')
            sheet[:, f * 24:(f + 1) * 24] = a
        check(sheet, f'fire{st}'); save(sheet, O + f'firebox-{st}.png')

# ---------------------------------------------------------------- superheater 40x32 (canvas x -288..-249, y -105..-74)
def superheater():
    W, H = 40, 32; a = blank(W, H)
    # angle-iron stand: legs cols 3..4 / 26..27 rows 22..31, top rail row 21
    for x0 in (3, 26):
        vline(a, x0, 21, 31, 'i3'); vline(a, x0 + 1, 21, 31, 'i0')
    hline(a, 2, 28, 31, 'ink')
    # serpentine: runs at rows 11,15,19,23(?) -> 2 px tubes rows (10,11) (14,15) (18,19) (22,23), cols 6..25, bends alternate
    runs = [10, 14, 18, 22]
    for i, ry in enumerate(runs):
        hline(a, 6, 25, ry, 'i3'); hline(a, 6, 25, ry + 1, 'i1')
        for x in range(7, 25, 5): put(a, x, ry, 'i4')
    for i in range(3):
        y0, y1 = runs[i], runs[i + 1] + 1
        bx = 26 if i % 2 == 0 else 4
        for y in range(y0, y1 + 1):
            put(a, bx, y, 'e1' if 0 < y - y0 < y1 - y0 else 'e0'); put(a, bx + (1 if bx == 26 else -1), y, 'e0')
        put(a, bx, y0, 'e0'); put(a, bx, y1, 'e0')
    # hot glow under bottom run (heated by the smokebox uptake)
    for x in range(8, 24, 3): put(a, x, 24, 'e0')
    # inlet: bottom run continues right to the dome face (x -258 -> col 30) at rows 22..23
    hline(a, 26, 31, 22, 'i3'); hline(a, 26, 31, 23, 'i1'); put(a, 30, 21, 'ink'); put(a, 30, 24, 'ink'); put(a, 31, 21, 'i4'); put(a, 31, 24, 'i0')
    # outlet: top run left end rises at cols 4..5 to row 4, then right along rows 4..5 to col 39 (x -249), tee flange col 38..39
    for y in range(4, 11): put(a, 4, y, 'i3'); put(a, 5, y, 'i1')
    hline(a, 4, 39, 4, 'i3'); hline(a, 4, 39, 5, 'i1')
    for x in range(8, 36, 6): put(a, x, 4, 'i4')
    vline(a, 37, 2, 7, 'ink'); vline(a, 38, 3, 6, 'i4'); vline(a, 39, 3, 6, 'i2'); put(a, 38, 2, 'ink'); put(a, 39, 2, 'ink'); put(a, 38, 7, 'ink'); put(a, 39, 7, 'ink')
    put(a, 4, 4, 'i4'); put(a, 3, 4, 'ink'); put(a, 3, 5, 'ink'); put(a, 3, 6, 'ink')
    check(a, 'superheater'); save(a, O + 'superheater.png'); return a

# ---------------------------------------------------------------- induction heater 56x40 (canvas x -228..-173, y -76..-37)
# boiler col c -> local c - 76 ; boiler row r -> local r - 20
def heater():
    W, H = 56, 40; a = blank(W, H)
    cop = ['r2', 'r3', 'r4', 'r5']
    for b in range(7):                                                    # 7 vertical copper bands around the firebox, 3 px, pitch 5
        x0 = 13 + 5 * b
        for y in range(1, 37):
            put(a, x0, y, 'r5' if x0 < 30 else 'r4'); put(a, x0 + 1, y, 'r3'); put(a, x0 + 2, y, 'r2')
            if y in (1, 36): put(a, x0, y, 'r3'); put(a, x0 + 1, y, 'r2'); put(a, x0 + 2, y, 'r1')
        for y in range(4, 36, 8): put(a, x0, y + (b % 2) * 3, 'a1')            # glints
        put(a, x0 - 1, 0, 'ink'); hline(a, x0, x0 + 2, 0, 'ink')               # band clips on the firebox top edge
    # bus bar under the bands' top: row 2..3 (copper), strap to terminal box on the right face
    hline(a, 46, 50, 6, 'r4'); hline(a, 46, 50, 7, 'r2')
    # terminal box on firebox right face: cols 50..55 rows 6..16 (x -178..-173), aqua bushing rows 2..5 cols 52..53
    rect(a, 51, 7, 54, 15, 'i2'); vline(a, 50, 6, 16, 'ink'); vline(a, 55, 6, 16, 'ink'); hline(a, 50, 55, 6, 'ink'); hline(a, 50, 55, 16, 'ink')
    vline(a, 51, 7, 15, 'i3'); hline(a, 51, 54, 15, 'i0'); put(a, 53, 9, 'i4'); put(a, 53, 13, 'i4')
    rect(a, 52, 3, 54, 5, 'c1'); vline(a, 52, 3, 5, 'c2'); vline(a, 54, 3, 5, 'c0'); hline(a, 51, 55, 4, 'c0'); put(a, 52, 4, 'c1'); put(a, 53, 4, 'c2')
    put(a, 51, 3, 'ink'); put(a, 55, 3, 'ink'); put(a, 51, 5, 'ink'); put(a, 55, 5, 'ink'); hline(a, 52, 54, 2, 'ink'); put(a, 53, 1, 'i3')
    check(a, 'heater'); save(a, O + 'induction-heater.png'); return a

# ---------------------------------------------------------------- steam manifold 96x14 on piston block (canvas x -92..+3, y -182..-169)
def manifold():
    W, H = 96, 14; a = blank(W, H)
    prof = ['i4', 'i3', 'i2', 'i0']
    for x in range(0, 82):                                                # header rows 4..7, cols 0..81 (x -92..-11)
        for j, k in enumerate(prof): put(a, x, 4 + j, k)
    hline(a, 0, 81, 3, None)
    for fx in (0, 81):                                                    # end flanges 2 px x 6
        for x in (fx, fx + (1 if fx == 0 else -1)):
            vline(a, x, 3, 8, 'i3' if x == fx else 'i1'); put(a, x, 3, 'ink'); put(a, x, 8, 'ink')
    for dx in (20, 48, 76):                                               # drops onto the 3 cylinder caps, centre corner dx
        for y in range(8, 14):
            put(a, dx - 2, y, 'i4'); put(a, dx - 1, y, 'i3'); put(a, dx, y, 'i2'); put(a, dx + 1, y, 'i0')
        for x in range(dx - 3, dx + 3):                                   # collar rows 12..13 and tee boss rows 8..9
            put(a, x, 12, 'ink' if x in (dx - 3, dx + 2) else 'i3'); put(a, x, 13, 'ink' if x in (dx - 3, dx + 2) else 'i1')
        put(a, dx - 3, 8, 'ink'); put(a, dx + 2, 8, 'ink'); put(a, dx - 3, 9, 'ink'); put(a, dx + 2, 9, 'ink')
        put(a, dx - 1, 2, 'ink'); put(a, dx, 2, 'ink'); put(a, dx - 1, 3, 'i4'); put(a, dx, 3, 'i1')   # drain cock nub on top
    for x in range(6, 80, 12): put(a, x, 4, 'i5')
    check(a, 'manifold'); save(a, O + 'steam-manifold.png'); return a

PARTS2 = {'hammer': hammer, 'turbine': turbine, 'condenser': condenser, 'gauge': gauge, 'relief': relief, 'firebox': firebox,
          'superheater': superheater, 'heater': heater, 'manifold': manifold}

# ---------------------------------------------------------------- fx sheets 16x16 x 4 frames: steam puff (white) and coal smoke (grey)
def fx():
    os.makedirs(O + 'fx', exist_ok=True)
    for nm, ramp in (('steam-puff', ['k2', 's4', 'w0']), ('smoke', ['i3', 'i4', 'k1'])):
        sheet = blank(64, 16)
        for f in range(4):
            a = blank(16, 16)
            lobes = [(8, 9, 2.6 + f * .9), (6, 8 - f * .3, 1.8 + f * .7), (10.3, 7.6 - f * .4, 1.9 + f * .6), (8, 6 - f * .5, 1.6 + f * .6)]
            for y in range(16):
                for x in range(16):
                    inside = [((x + .5 - lx) ** 2 + (y + .5 - ly) ** 2) ** .5 / lr for lx, ly, lr in lobes]
                    m = min(inside)
                    if m <= 1:
                        # light from upper-left: offset sample
                        m2 = min(((x + 1.3 - lx) ** 2 + (y + 1.3 - ly) ** 2) ** .5 / lr for lx, ly, lr in lobes)
                        k = ramp[2] if m2 > .55 and (x + y) < 17 else ramp[1] if m2 <= .55 or y < 9 else ramp[0]
                        if y >= 10 and m > .6: k = ramp[0]
                        put(a, x, y, k)
            if f == 3:                                                   # last frame breaks up (dissolving)
                for (x, y) in ((7, 4), (9, 5), (5, 9), (11, 10), (8, 12), (6, 6), (10, 7)): put(a, x, y, None)
            sheet[:, f * 16:(f + 1) * 16] = a
        check(sheet, nm); save(sheet, O + 'fx/' + nm + '.png')
PARTS2['fx'] = fx
