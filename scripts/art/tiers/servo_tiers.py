# Part evolution tiers, method A: crankServo (3 tiers), servoBase (machine.servoBase, 28x20, bottom origin, static):
# a low gearbox housing (x3-24, rows 3-15; lit left panel x4-7, round hub seat x8-19, dark right panel x20-23) on a
# full-width foot plate (rows 16-19), a small verdigris breather cap on top (x17-20, rows 0-2). The servo arm's hub disc
# (front layer) covers the seat at base x9-18, rows 5-14 in every arm frame; nothing new is drawn there.
#   MK II REINFORCED: base derust (the 5 rust px: 2 on the left panel by the seat, 2 on the right panel, 1 at the seat
#     edge, knocked off to value-matched iron); a welded gusset plate at each housing foot (right triangles, x0-2 and
#     x25-27, rows 13-15, standing on the foot plate and welded to the housing wall: the housing no longer rocks on
#     the plate); bright bolt heads: the 2 shadow-side housing bolts and the right foot bolt lifted to bright iron, a
#     new bolt head in each gusset.
#   MK III AS BUILT: a brass inspection cover on the lit left panel (x4-7, rows 5-14: ink lips top and bottom, brass
#     field lit left / shadowed right, #ffd27a glint at the upper left, 2 screw heads) and a warm pilot lamp in the
#     dark right panel (core x21-23, rows 8-10, ink ring); heartbeat low frame t3b = the lamp one ramp step dimmer.
# Alpha 0/255; every MK I opaque pixel stays opaque; palette = Rust Wasteland + the verdigris the shipped cap uses.
#   python scripts/art/tiers/servo_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

put = T.put
base = T.load_grid(os.path.join(T.MACHINE, 'era4', 'servo-base.png'))

# ---------- MK II REINFORCED ----------
t2 = T.copy_grid(base)
for (x, y), ch in {(7, 11): '3', (8, 11): 'K', (7, 12): '3', (20, 8): '1', (21, 8): '1'}.items():
    assert base[y][x] in 'cd', (x, y, base[y][x])
    t2[y][x] = ch
# gussets: left (lit) and right (shadow), hypotenuse inked, a bolt head in each
put(t2, 2, 12, 'K')
put(t2, 1, 13, 'K4')
put(t2, 0, 14, 'K45')
put(t2, 0, 15, 'K43')
put(t2, 25, 12, 'K')
put(t2, 25, 13, '1K')
put(t2, 25, 14, '41K')
put(t2, 25, 15, '10K')
# bright bolt heads: shadow-side housing bolts and the right foot bolt
for (x, y), ch in {(22, 6): '4', (22, 13): '4', (25, 18): '4'}.items():
    assert base[y][x] == '3', (x, y, base[y][x])
    t2[y][x] = ch

# ---------- MK III AS BUILT ----------
t3 = T.copy_grid(t2)
COVER = ['KKKK',      # ink lips top and bottom; the housing wall (x3) and the seat outline (x8) frame the sides
         'Cffd',
         'fdfd',      # brass screw heads at (5, 7) and (5, 12)
         'ffed',
         'ffe ',      # x7 rows 9-10 stay the seat outline (ink)
         'ffe ',
         'ffed',
         'fdfd',
         'eedd',
         'KKKK']
for i, row in enumerate(COVER):
    put(t3, 4, 5 + i, row)
LAMP = [' KKK ',
        'KABAK',
        'KBCBK',
        'KABAK',
        ' KKK ']
for i, row in enumerate(LAMP):
    put(t3, 20, 7 + i, row)

t3b = T.copy_grid(t3)
for y in range(8, 11):
    for x in range(21, 24):
        t3b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}[t3b[y][x]]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in [('servo-base-t2.png', t2), ('servo-base-t3.png', t3), ('servo-base-t3b.png', t3b)]:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
