# Resonator spire lattice tower 80x320. Canvas (0,0) = machine-local (24,-430); bottom row 319 = y -111 sits on the frame girder top (-110).
# Legs land on the frame posts: left shoe x 28..39 over post 29..38, right shoe x 88..99 over post 92..99. Axis = corner x 64.
from helpers import *
import json, random
W, H, CX = 80, 320, 40
OX, OY = 24, -430                      # canvas -> machine-local offset
TOP, BOT = 17, 319
def t_of(r): return min(1, max(0, (BOT - r) / (BOT - TOP)))
def d_of(r): return 6 + 24.5 * (1 - t_of(r)) ** 1.6          # leg centre distance from the axis
def w_of(r): return int(round(2 + 3 * (1 - t_of(r))))         # leg width 5 -> 2
def legL(r):
    w = w_of(r); x0 = int(math.floor(CX - d_of(r) - w / 2 + .5)); return x0, x0 + w - 1
def legR(r):
    x0, x1 = legL(r); return W - 1 - x1, W - 1 - x0
LCOL = {5: ['ink', 'i4', 'i3', 'i2', 'i1'], 4: ['ink', 'i4', 'i2', 'i1'], 3: ['ink', 'i3', 'i1'], 2: ['ink', 'i2']}
RCOL = {5: ['i3', 'i2', 'i1', 'i0', 'ink'], 4: ['i3', 'i1', 'i0', 'ink'], 3: ['i2', 'i0', 'ink'], 2: ['i1', 'ink']}
def battens():
    rows, b, h = [], 312, 40.0
    while b > 34:
        rows.append(b); b -= int(round(h)); h = max(15.0, h * 0.88)
    rows.append(19)                     # top tie under the crown
    return rows
def tower():
    a = blank(W, H); rnd = random.Random(44)
    # core resonator rod (centre plane, behind the front lattice)
    for r in range(17, 289): put(a, 39, r, 'i3'); put(a, 40, r, 'i1')
    B = battens()
    # diagonals (front face): X per panel, single alternating diagonal where the panel is narrow
    for i in range(len(B) - 1):
        lo, hi = B[i], B[i + 1]             # lo = lower batten top row, hi = upper batten top row
        ya, yb = hi + 2, lo - 1
        xl_a, xr_a = legL(ya)[1] + 1, legR(ya)[0] - 1
        xl_b, xr_b = legL(yb)[1] + 1, legR(yb)[0] - 1
        if xr_a - xl_a >= 9:
            bres(a, xl_a, ya, xr_b, yb, 'i2'); bres(a, xr_a, ya, xl_b, yb, 'i2')
        else:
            if i % 2: bres(a, xl_a, ya, xr_b, yb, 'i2')
            else: bres(a, xr_a, ya, xl_b, yb, 'i2')
    # battens
    for b in B:
        x0, x1 = legL(b)[0], legR(b)[1]
        hline(a, x0, x1, b, 'i3'); hline(a, x0, x1, b + 1, 'i1')
        put(a, x0 - 1, b, 'ink'); put(a, x0 - 1, b + 1, 'ink'); put(a, x1 + 1, b, 'ink'); put(a, x1 + 1, b + 1, 'ink')
    # legs
    for r in range(TOP, 314):
        w = w_of(r); l0, _ = legL(r); r0, _ = legR(r)
        for j, k in enumerate(LCOL[w]): put(a, l0 + j, r, k)
        for j, k in enumerate(RCOL[w]): put(a, r0 + j, r, k)
    # gusset rivets at every leg/batten joint
    for b in B:
        l0, l1 = legL(b); r0, r1 = legR(b)
        put(a, l0 + 1, b, 'i5'); put(a, r1 - 1, b, 'i4')
        if b < 300: put(a, l1 + 1, b + 2, 'i2'); put(a, r0 - 1, b + 2, 'i1')   # small knee plates under battens
    # leg rivets
    for r in range(30, 310, 7):
        l0, l1 = legL(r); r0, r1 = legR(r)
        if l1 - l0 >= 3: put(a, l0 + 1, r, 'i5')
        if r1 - r0 >= 3: put(a, r0 + 1, r, 'i3')
    # shoes rows 314..319: left x 4..15, right x 64..75 (base plate bolted to the girder over the posts)
    for (x0, x1) in ((4, 15), (64, 75)):
        for r in range(314, 320):
            for x in range(x0, x1 + 1): put(a, x, r, iron_col(x, x0, x1))
        hline(a, x0, x1, 314, 'ink'); hline(a, x0 + 1, x1 - 1, 315, 'i4'); hline(a, x0, x1, 319, 'ink')
        for x in (x0 + 2, x1 - 2): put(a, x, 317, 'i5' if x < 40 else 'i4'); put(a, x, 318, 'i0')
    # legs flare into the shoes (rows 309..313)
    for r in range(309, 314):
        l0, l1 = legL(r); r0, r1 = legR(r)
        put(a, l0 - 1, r, 'ink') if r > 311 else None; put(a, r1 + 1, r, 'ink') if r > 311 else None
    # crown plate rows 12..16, x 28..51, and crystal claws rows 3..11
    for r in range(12, 17):
        for x in range(28, 52): put(a, x, r, iron_col(x, 28, 51))
    hline(a, 28, 51, 12, 'ink'); hline(a, 29, 50, 13, 'i4'); hline(a, 28, 51, 16, 'ink')
    for x in range(30, 51, 4): put(a, x, 14, 'i5' if x < 40 else 'i3')
    for r in range(5, 12):
        put(a, 28, r, 'ink'); put(a, 29, r, 'i4'); put(a, 30, r, 'i2'); put(a, 31, r, 'ink')
        put(a, 51, r, 'ink'); put(a, 50, r, 'i1'); put(a, 49, r, 'i2'); put(a, 48, r, 'ink')
    for (x, k) in ((29, 'ink'), (30, 'ink'), (31, 'i4'), (32, 'ink')): put(a, x, 4, k)
    for (x, k) in ((50, 'ink'), (49, 'ink'), (48, 'i2'), (47, 'ink')): put(a, x, 4, k)
    hline(a, 30, 32, 3, 'ink'); hline(a, 47, 49, 3, 'ink')
    # knee braces under the crown
    for i in range(3):
        put(a, legL(17)[0] - 1 - i, 17 + i, 'i2') if False else None
    # rust clusters (patches) on lower legs and battens
    for _ in range(26):
        r = rnd.randint(150, 308); side = rnd.choice((0, 1))
        x0, x1 = legL(r) if side == 0 else legR(r)
        if x1 - x0 < 3: continue
        x = rnd.randint(x0 + 1, x1 - 1)
        for (dx, dy) in ((0, 0), (0, 1), (1, 1) if side == 0 else (-1, 1), (0, 2)):
            if name(a, x + dx, r + dy) in ('i2', 'i3', 'i1', 'i4'): put(a, x + dx, r + dy, 'r2' if side else 'r3')
        put(a, x, r + 1, 'r4' if side == 0 else 'r3')
    for b in B[:6]:
        x = rnd.randint(legL(b)[1] + 2, legR(b)[0] - 4)
        put(a, x, b + 1, 'r2'); put(a, x + 1, b + 1, 'r2'); put(a, x + 1, b, 'r3')
    check(a, 'tower'); save(a, O + 'spire-tower.png')
    geo = {'battens_world_y': [b + OY for b in B],
           'outer_world_x': {str(r + OY): [legL(r)[0] + OX, legR(r)[1] + OX] for r in range(TOP, 314)}}
    json.dump(geo, open(G + 'tower-geo.json', 'w'))
    return a
if __name__ == '__main__':
    tower(); g = json.load(open(G + 'tower-geo.json'))
    print('battens world y', g['battens_world_y'])
    for y in g['battens_world_y']:
        if str(y) in g['outer_world_x']: print(y, g['outer_world_x'][str(y)])
