# Part evolution tiers, method A: motorRetrofit, motorRetrofitKit (machine.motorRetrofit, 32x16, centre origin, vibrates
# with the motor). 5 tiers (PART_TIERS 2.3): MK II box derust + bright cable gland; MK III second cyan insulator + strap
# clamps down to the motor top; MK IV brass terminal studs + orange live stripe on the lid; MK V warm pilot lamp on the
# box face (heartbeat low frame t5b).
# The kit sits on the motor (kit row 15 = motor row 7, the motor top outline is motor row 8): everything stays inside the
# 32x16 canvas, so it never covers more of the motor. Reserved: the Era III tie cable leaves the insulator top (kit
# (16,5)) up and to the left (kit rows <= 4 at x <= 12); the second insulator (x7-10, rows 7-9) stays below that path.
# Palette: Rust Wasteland + the cyan ramp the shipped kit already uses (#2f5a62 #5fa8b4 #bff0ec).
#   python scripts/art/tiers/retrofit_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

put, remap = T.put, T.remap

base = T.load_grid(os.path.join(T.MACHINE, 'era2', 'motor-retrofit.png'))
COPPER_CABLE = {(x, 14) for x in range(22, 26)}   # the copper cable core (identity, not rust)

# ---------- MK II PATCHED: box derust, bright cable gland where the cable leaves the box ----------
t2 = T.copy_grid(base)
remap(t2, {'c': '2', 'd': '2', 'b': '2', 'e': '3'}, lambda x, y: (x, y) not in COPPER_CABLE)
put(t2, 22, 12, 'KK')       # gland nut, 2 px proud of the cable: bright top, mid side (2 px clusters, no singletons)
put(t2, 22, 13, '55')
put(t2, 22, 14, '33')

# ---------- MK III REINFORCED: second insulator on the conduit head, strap clamps down to the motor top ----------
t3 = T.copy_grid(t2)
put(t3, 8, 7, 'KK')         # bushing insulator (the kit's cyan ramp) on the conduit cap
put(t3, 7, 8, 'KonK')      # lit left column, mid right column (2 px clusters)
put(t3, 7, 9, 'KonK')
for x in (12, 19):          # two vertical straps from the lid over the face (old bolt heads) down to the motor seam
    for y in range(9, 16):
        t3[y][x] = '4'

# ---------- MK IV TUNED: brass terminal studs on both insulators, orange live stripe on the lid ----------
t4 = T.copy_grid(t3)
put(t4, 15, 4, 'ff')        # brass terminal nut on each insulator cap
put(t4, 8, 6, 'ff')
for x in range(13, 19):     # live stripe between the straps (lid lower row)
    t4[10][x] = 'A'

# ---------- MK V AS BUILT: warm pilot lamp in the box face (3x3, ink ring = lid edge, bottom line, 2 side posts) ----------
# On a 32x16 part the ladder lamp's #d9822b corners are 4 lone pixels (workbench singletons, score -12 cap); the lamp
# here is an #f0a848 ring around the #ffd27a core, which reads the same at zoom 0.5.
t5 = T.copy_grid(t4)
put(t5, 14, 12, 'KBBBK')
put(t5, 14, 13, 'KBCBK')
put(t5, 14, 14, 'KBBBK')

# heartbeat low frame: the lamp one ramp step dimmer
t5b = T.copy_grid(t5)
for y in (12, 13, 14):
    for x in (15, 16, 17):
        t5b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}[t5b[y][x]]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in [('motor-retrofit-t2.png', t2), ('motor-retrofit-t3.png', t3), ('motor-retrofit-t4.png', t4),
                    ('motor-retrofit-t5.png', t5), ('motor-retrofit-t5b.png', t5b)]:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
