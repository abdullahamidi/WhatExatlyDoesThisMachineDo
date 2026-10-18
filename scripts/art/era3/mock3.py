# Full-machine mock: era I + era II (ART_ERA2 CR1-3, CR6) + era III (this contract). Art-res compositor.
# usage: python3 mock3.py out.png [stage=3] [theta_deg=0] [fireStage=3] [frame=0] [gaugeFrame=17] [era3=1] [puffs=1]
import sys, math, os
sys.path.insert(0, '/tmp/claude-0/-home-user-WhatExatlyDoesThisMachineDo/0b9fa637-9555-52ff-9a39-17f862f1fdae/scratchpad/era2/tools')
import compose as C
from compose import *
E2 = '/home/user/WhatExatlyDoesThisMachineDo/public/assets/machine/era2/'
E3 = os.environ.get('E3', '/home/user/WhatExatlyDoesThisMachineDo/public/assets/machine/era3/')
FX = os.environ.get('FX', '/home/user/WhatExatlyDoesThisMachineDo/public/assets/fx/')
C.OX, C.OY, C.W, C.H = 460, 262, 924, 272
a = sys.argv + [None] * 9
out = a[1]; STAGE = int(a[2] or 3); TH = float(a[3] or 0); FIRE = int(a[4] or 3); FR = int(a[5] or 0); GF = int(a[6] or 17)
ERA3 = int(a[7] if a[7] is not None else 1); PUFFS = int(a[8] if a[8] is not None else 1)
MID, FRAME, BACK, FRONT = 20, 10, 0, 30

era1()
# ---- era II (CR1 hub y -22, CR2 spark on rack, CR3 kit -24)
sprite(E2 + 'generator-plinth.png', 264, 0, .5, 1, MID + 0)
sprite(E2 + 'generator.png', 264, -42, .5, .5, MID + 1)
for s in range(1, 4): sprite(E2 + f'coils-{s}.png', 264, -42, .5, .5, MID + 1 + s)
sprite(E2 + 'rot/pulley-generator-rot.png', 228, -22, .5, .5, MID + 5, frame=(20, 20, 0, 9))
raster_belt(None, (150, -56), 12, (228, -22), 8, hexc('#2e1a12'), hexc('#6e3a22'))
cap(228, -22)
sprite(E2 + 'motor-retrofit.png', -140, -51, .5, .5, MID + 3)
sprite(E2 + 'dynamo.png', 70, -36, .5, .5, FRAME + 2)
sprite(E2 + 'capacitor-rack.png', 340, 0, .5, 1, MID + 0)
sprite(E2 + 'spark-gap.png', 340, -53, .5, 1, MID + 6, frame=(32, 48, 2, 4))
sprite(E2 + 'transformer.png', 396, 0, .5, 1, MID + 0)
sprite(E2 + 'cable-mast.png', 436, 0, .5, 1, BACK)
def ccable(p, q, sag):
    cable(p, q, sag, hexc('#5fa8b4'), 31); cable((p[0], p[1] + 1), (q[0], q[1] + 1), sag, hexc('#2f5a62'), 31)
ccable((412, -60), (436, -108), 10); ccable((284, -68), (323, -38), 4); ccable((357, -38), (384, -60), 3)
cable((436, -108), (460, -116), 3, hexc('#2f5a62'), 31)

# ---- era III
PIPE_DEPTH = FRAME + 5          # above frame/back parts, behind every mid part (chimney, boiler, hammer, turbine)
STEAM = {'prof': ['#7d8286', '#5a5f63', '#3e4246', '#1f2225'], 'fl': [['#14110f', '#a3a6a4', '#7d8286', '#5a5f63', '#3e4246', '#14110f'],
                                                                     ['#14110f', '#7d8286', '#5a5f63', '#3e4246', '#2b2e31', '#14110f']], 'flEvery': 24}
WATER = {'prof': ['#5a5f63', '#2b2e31'], 'fl': [['#14110f', '#7d8286', '#3e4246', '#14110f'], ['#14110f', '#5a5f63', '#2b2e31', '#14110f']], 'flEvery': 24}
def pipe(pts, st, depth=PIPE_DEPTH):
    """orthogonal polyline through pixel-corner points; bore n = len(prof) px centred on the corner line."""
    n = len(st['prof']); h = n // 2; px = []
    P = lambda x, y, c: px.append((C.OX + x, C.OY + y, hexc(c)))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if y0 == y1:                                  # horizontal: rows y0-h .. y0+h-1, cols [min, max)
            lo, hi = min(x0, x1), max(x0, x1)
            for x in range(lo, hi):
                for j in range(n): P(x, y0 - h + j, st['prof'][j])
            L = hi - lo
            marks = [0, L - 2] + list(range(st['flEvery'], L - 4, st['flEvery']))
            for m in marks:
                for k in range(2):
                    for j, c in enumerate(st['fl'][k]): P(lo + m + k, y0 - h - 1 + j, c)
        else:                                         # vertical: cols x0-h .. x0+h-1 (profile left->right)
            lo, hi = min(y0, y1), max(y0, y1)
            for y in range(lo, hi):
                for j in range(n): P(x0 - h + j, y, st['prof'][j])
            L = hi - lo
            marks = [0, L - 2] + list(range(st['flEvery'], L - 4, st['flEvery']))
            for m in marks:
                for k in range(2):
                    for j, c in enumerate(st['fl'][k]): P(x0 - h - 1 + j, lo + m + k, c)
    for (x, y) in pts[1:-1]:                          # elbow / tee fitting: (n+2)^2 block
        s = n + 2
        for j in range(s):
            for i in range(s):
                c = '#14110f' if i in (0, s - 1) or j in (0, s - 1) else ('#7d8286' if i + j <= s // 2 + 1 else '#5a5f63' if i + j < s else '#3e4246')
                P(x - h - 1 + i, y - h - 1 + j, c)
    items.append((depth, len(items), ('pix', px)))

U = int(os.environ.get('UNLOCK', '9'))   # 1 boiler 2 firebox 3 heater 4 hammer 5 superheater 6 condenser 7 turbine 8 relief 9 all
if ERA3:
    has = lambda n: U >= n
    if has(6): sprite(E3 + 'condenser.png', -402, 0, .5, 1, MID + 0)
    if has(7):
        sprite(E3 + 'turbine.png', -402, -24, .5, 1, MID + 1)
        k = int(round((TH * 6 % 360) / 360 * 64)) % 64
        sprite(E3 + 'rot/turbine-rotor-rot.png', -412, -54, .5, .5, MID + 2, frame=(28, 28, k, 8))
    if has(4):
        s = 7 * (1 + math.cos(math.radians(TH)))
        sprite(E3 + 'hammer-ram.png', -334, -22 - round(s), .5, 1, MID + 0)
        sprite(E3 + 'steam-hammer.png', -334, 0, .5, 1, MID + 1)
    sprite(E3 + 'boiler.png', -240, 0, .5, 1, MID + 0)
    sprite(E3 + 'chimney.png', -293, -78, .5, 1, MID + 1)
    if has(2) and FIRE >= 1: sprite(E3 + f'firebox-{FIRE}.png', -196, -32, .5, .5, MID + 2, frame=(24, 24, FR, 4))
    if has(3): sprite(E3 + 'induction-heater.png', -200, -36, .5, 1, MID + 3)
    if has(5): sprite(E3 + 'superheater.png', -268, -73, .5, 1, MID + 2)
    if has(8): sprite(E3 + 'relief-valves.png', -214, -77, .5, 1, MID + 2)
    sprite(E3 + 'gauge.png', -192, -77, .5, 1, MID + 2)
    sprite(E3 + 'gauge-needle.png', -192, -77, .5, 1, MID + 3, frame=(24, 24, GF, 25))
    sprite(E3 + 'steam-manifold.png', -44, -168, .5, 1, BACK + 2)
    pipe([(-246, -91), (-246, -112), (-98, -112), (-98, -176), (-92, -176)], STEAM)       # P1 boiler -> piston manifold
    if has(4): pipe([(-246, -91), (-246, -112), (-323, -112), (-323, -79)], STEAM)         # P2 boiler -> hammer valve chest
    if has(7): pipe([(-246, -91), (-246, -112), (-412, -112), (-412, -86)], STEAM)         # P3 boiler -> turbine nozzle
    if has(6): pipe([(-358, -3), (-308, -3), (-308, -46), (-304, -46)], WATER, depth=MID - 1)   # W1 condensate -> boiler feed
    if has(3): ccable((-140, -54), (-175, -74), 3)                                         # C1 retrofit kit -> induction heater
    sh = [(-304, 128)] + ([(-358, 48)] if has(4) else []) + ([(-442, 80)] if has(6) else [])
    for (x, w) in sh:
        items.append((-1, len(items), ('pix', [(C.OX + x + i, C.OY + j, hexc('#5f5244')) for i in range(w) for j in (0, 1)])))
    if PUFFS:
        sprite(FX + 'smoke.png', -293, -246, .5, .5, 40, frame=(16, 16, 1, 4)); sprite(FX + 'smoke.png', -287, -262, .5, .5, 40, frame=(16, 16, 2, 4))
        sprite(FX + 'smoke.png', -278, -276, .5, .5, 40, frame=(16, 16, 3, 4))
        if has(8): sprite(FX + 'steam-puff.png', -218, -88, .5, .5, 40, frame=(16, 16, 1, 4))
        if has(4): sprite(FX + 'steam-puff.png', -334, -100, .5, .5, 40, frame=(16, 16, 0, 4))
        sprite(FX + 'steam-puff.png', -70, -184, .5, .5, 40, frame=(16, 16, 2, 4))
render(out, 2)
