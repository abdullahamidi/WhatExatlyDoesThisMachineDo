# Part evolution tiers, method A (PART_TIERS 5.1 / 7): motorTuning, the proof part.
# Worn motor (machine.motor, 64x48, centre origin) and motor plinth (machine.motorPlinth, 48x10, bottom origin) -> MK II-V
# as hand-pixelled char-grid edits of the shipped sprites: palette-locked (Rust Wasteland), alpha 0/255, same canvas,
# no resampling. MK I is the shipped file itself (never written here). Reserved zones kept clear on the motor:
#   x23-43 rows <= 7 (motorRetrofitKit sits there from Era II), x >= 52 (motor pulley 12x12 at (58,20) + belt),
#   rows >= 41 (plinth).
#   python scripts/art/tiers/motor_tiers.py [outRoot]
# Default outRoot: public/assets/machine/tiers. Writes worn-motor-t2..t5.png, worn-motor-t5b.png (heartbeat low frame)
# and motor-plinth-t2..t5.png. Identical, pixel for pixel, to the WP22-23 proof set.
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

copy, put, paint, remap = T.copy_grid, T.put, T.paint, T.remap

base = T.load_grid(os.path.join(T.MACHINE, 'worn-motor.png'))
H, W = len(base), len(base[0])

PLATE = (24, 37, 18, 25)  # x0, x1, y0, y1 inclusive: the faded warning plate (identity anchor)


def inplate(x, y):
    return PLATE[0] <= x <= PLATE[1] and PLATE[2] <= y <= PLATE[3]


def remap_np(g, m, region=lambda x, y: True):
    """Remap outside the warning plate (the plate is the identity mark and keeps its colours until MK IV)."""
    remap(g, m, lambda x, y: region(x, y) and not inplate(x, y))


def rust(g):
    return sum(1 for y in range(H) for x in range(W) if g[y][x] in 'abcde' and not inplate(x, y))


# ---------- T1 SALVAGED: the shipped art, untouched ----------
t1 = copy(base)

# ---------- T2 PATCHED: flaking orange scale knocked off (dark stains stay low), riveted patch, new bright bolts ----------
t2 = copy(t1)
remap_np(t2, {'e': '3', 'd': '3', 'c': '2'})
remap_np(t2, {'b': '2'}, lambda x, y: y <= 22)
# riveted patch plate over the worst corrosion, lower NDE bell (x9-14, rows 24-29), lit top-left
put(t2, 9, 24, '444443')
put(t2, 9, 25, '453353')
put(t2, 9, 26, '433332')
put(t2, 9, 27, '433332')
put(t2, 9, 28, '453352')
put(t2, 9, 29, '322221')
# second riveted patch over the cracked fins, upper DE side of the housing (x36-41, rows 11-15)
put(t2, 36, 11, '444443')
put(t2, 36, 12, '453351')
put(t2, 36, 13, '433331')
put(t2, 36, 14, '453351')
put(t2, 36, 15, '211111')
# fresh hex bolts on both feet + end-bell tie bolts (bright head, shadow right)
for (x, y) in [(20, 38), (23, 38), (38, 38), (41, 38)]:
    put(t2, x, y, '51')
for (x, y) in [(9, 11), (9, 32), (46, 12), (46, 31)]:
    put(t2, x, y, '5')

# ---------- T3 REINFORCED: rust gone, dust cleaned, machined rims, wider bolted foot flanges ----------
t3 = copy(t2)
remap_np(t3, {'b': '2', 'a': '1', 'c': '2', 'd': '3', 'e': '3'})
remap_np(t3, {'u': '4', 'q': '4', 'p': '3'}, lambda x, y: not (17 <= x <= 44 and 12 <= y <= 33))
# machined rims: NDE bell lit top + left edge, DE bell lit top, shadow right
for x in range(10, 17):
    t3[10][x] = '4'
for y in range(11, 23):
    paint(t3, 8, y, '4')
for y in range(23, 32):
    paint(t3, 8, y, '2')
for x in range(45, 48):
    paint(t3, x, 11, '4')
for y in range(13, 31):
    paint(t3, 48, y, '1')
# clamp bands (banded repair of the stator casting): two 2 px straps across every fin, rivets every 9 rows
BANDS = (20, 40)
for bx in BANDS:
    for y in range(9, 34):
        t3[y][bx] = '4'
        t3[y][bx + 1] = '2'
    for y in (12, 21, 30):
        t3[y][bx] = '5'
        t3[y + 1][bx] = '3'
# foot flanges: 2 px wider each side, bolted
put(t3, 16, 39, 'K5')
put(t3, 16, 40, 'KK')
put(t3, 44, 39, '1K')
put(t3, 44, 40, 'KK')

# ---------- T4 TUNED: fan cowl on the NDE, crisp nameplate, polished shaft, brass hoops ----------
t4 = copy(t3)
# re-cast end bell + housing: the T2 patch plates come off (refit, not repair): restore those cells from a clean pass of the base
clean = copy(base)
remap_np(clean, {'b': '2', 'a': '1', 'c': '2', 'd': '3', 'e': '3'})
remap_np(clean, {'u': '4', 'q': '4', 'p': '3'}, lambda x, y: not (17 <= x <= 44 and 12 <= y <= 33))
for y in range(24, 30):
    for x in range(9, 15):
        t4[y][x] = clean[y][x]
for y in range(11, 16):
    for x in range(36, 42):
        if x not in (40, 41):
            t4[y][x] = clean[y][x]
for y in range(23, 32):
    paint(t4, 8, y, '2')
cowl = {12: (5, 'KK'), 13: (4, 'K44'), 14: (3, 'K433'), 15: (3, 'K4333'), 16: (3, 'K4333'), 17: (3, 'K3111'),
        18: (3, 'K4333'), 19: (3, 'K3333'), 20: (3, 'K3111'), 21: (3, 'K3333'), 22: (3, 'K3332'), 23: (3, 'K3111'),
        24: (3, 'K3332'), 25: (3, 'K3222'), 26: (3, 'K2111'), 27: (3, 'K2222'), 28: (3, 'K2222'), 29: (3, 'K1111'),
        30: (3, 'KK111'), 31: (4, 'KK1'), 32: (5, 'KK')}
for y, (x0, s) in cowl.items():
    put(t4, x0, y, s)
# fix cowl outline corners
put(t4, 2, 15, 'K')
for y in range(16, 30):
    put(t4, 2, y, 'K')
    t4[y][3] = t4[y][3] if t4[y][3] != 'K' else '4'
put(t4, 2, 15, '.')
# nameplate: same footprint, cleaned cream enamel, orange hazard band, 4 rivets, spec rule
for y in range(18, 26):
    for x in range(24, 38):
        t4[y][x] = 'v'
for x in range(24, 38):
    t4[18][x] = 'w'
    t4[25][x] = '1'
for y in range(18, 25):
    t4[y][24] = '4'
    t4[y][37] = '2'
for x in range(26, 36):
    t4[20][x] = 'A'
    t4[21][x] = 'A'
for x in range(27, 35):
    t4[23][x] = 'u'
for (x, y) in [(25, 19), (36, 19), (25, 24), (36, 24)]:
    t4[y][x] = '3'
t4[18][24] = '5'
t4[18][37] = '4'
# polished shaft stub (bright top, keyway shadow)
put(t4, 51, 21, '5554')
put(t4, 51, 22, '4443')
put(t4, 51, 23, '2221')
# the iron clamp bands are replaced by brass hoops (clean bands = brass, never rust patches)
for bx in BANDS:
    for y in range(9, 34):
        t4[y][bx] = 'f'
        t4[y][bx + 1] = 'd'
    for y in (12, 21, 30):
        t4[y][bx] = 'e'
        t4[y + 1][bx] = 'c'
    t4[9][bx] = 'C'
# top fin highlight polished
for x in range(18, 44):
    if t4[11][x] in '34' and x not in (20, 21, 40, 41):
        t4[11][x] = '4'
    if t4[9][x] == '3':
        t4[9][x] = '4'

# ---------- T5 AS BUILT: pilot 'eye' lamp on the NDE bell, warm seam in the lower fin slot, brass foot bolts ----------
t5 = copy(t4)
for x in range(19, 43):
    if x not in (20, 21, 40, 41):
        t5[27][x] = 'A'
for x in range(27, 34):
    t5[27][x] = 'B'
put(t5, 10, 19, ' KKK ')
put(t5, 10, 20, 'KABAK')
put(t5, 10, 21, 'KBCBK')
put(t5, 10, 22, 'KABAK')
put(t5, 10, 23, ' KKK ')
for (x, y) in [(20, 38), (23, 38), (38, 38), (41, 38)]:
    put(t5, x, y, 'Bd')
t5[39][17] = 'B'

# heartbeat low frame (2-key pulse on the global clock): lamp and seam dim one ramp step
t5b = copy(t5)
for y in range(H):
    for x in range(W):
        if (10 <= x <= 14 and 19 <= y <= 23) or y == 27:
            t5b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}.get(t5b[y][x], t5b[y][x])

# ---------- motor plinth (machine.motorPlinth 48x10) rides the same track ----------
p1 = T.load_grid(os.path.join(T.MACHINE, 'motor-plinth.png'))
p2 = copy(p1)
remap(p2, {'e': '3', 'f': '4', 'd': '3', 'c': '2', 'u': '4'})
for (x, y) in [(2, 7), (45, 7)]:
    p2[y][x] = '5'
p3 = copy(p2)
remap(p3, {'b': '2', 's': '3'})
p4 = copy(p3)
for x in range(2, 45):
    if p4[1][x] == '3':
        p4[1][x] = '4'
for x in range(5, 43):
    if p4[7][x] == '3':
        p4[7][x] = '4'
p5 = copy(p4)
for (x, y) in [(2, 7), (45, 7)]:
    p5[y][x] = 'B'


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    outs = [('worn-motor-t2.png', t2), ('worn-motor-t3.png', t3), ('worn-motor-t4.png', t4), ('worn-motor-t5.png', t5),
            ('worn-motor-t5b.png', t5b), ('motor-plinth-t2.png', p2), ('motor-plinth-t3.png', p3),
            ('motor-plinth-t4.png', p4), ('motor-plinth-t5.png', p5)]
    for name, g in outs:
        dst = os.path.join(out_root, name)
        b = T.save_grid(g, dst)
        extra = ' rust px %d' % rust(g) if name.startswith('worn-motor') else ''
        print('wrote %s %d B%s' % (T.rel(dst), b, extra))


if __name__ == '__main__':
    main()
