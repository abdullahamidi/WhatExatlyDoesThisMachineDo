# Part evolution tiers, method A: flywheel track, flywheelPedestal (machine.pedestal, 48x64, bottom origin, static).
# 3-tier ladder: MK I SALVAGED (shipped) -> MK II REINFORCED -> MK III AS BUILT (+ heartbeat low frame t3b).
# Hand-pixelled char-grid edits of the shipped sprite: palette-locked, alpha 0/255, same canvas, no resampling.
# In game the flywheel hub pulley (machine.pulleyFlywheel, depth 23, opaque disc r12 around pedestal (23.5, 7.5)) always
# covers the bearing housing (rows 0-10) and the middle of the saddle beam (rows 11-17, x13-34). MK III therefore puts
# its brass bearing-cap finish and the warm sight glass on the cross-tie (rows 39-44), where both read at zoom 0.5.
# Reserved: the crank->flywheel belt (row ~20, left leg) and the Era II generator belt (rows 20-26, right leg) pass
# over the legs at depth 25; nothing new is drawn there.
#   python scripts/art/tiers/pedestal_tiers.py [outRoot]
# Writes flywheel-pedestal-t2.png, -t3.png, -t3b.png under outRoot (default public/assets/machine/tiers).
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

put, remap = T.put, T.remap

base = T.load_grid(os.path.join(T.MACHINE, 'flywheel-pedestal.png'))
H, W = len(base), len(base[0])

# ---------- MK II REINFORCED: rust off (value-matched iron), gusset plates at the leg feet, bright anchor bolts ----------
t2 = T.copy_grid(base)
remap(t2, {'c': '2', 'd': '3', 'b': '2'})
# gussets: triangular plates in the angle between each leg and its foot flange; the leg outline stays, the plates sit
# against it (inner plates 5 rows, outer plates 4 rows). Lit from the upper left: plates facing up-left get '4'.
# left foot, inner side (leg inner outline x11 rows 53-56, x10 rows 57-58)
put(t2, 12, 54, 'K')
put(t2, 12, 55, '3K')
put(t2, 12, 56, '23K')
put(t2, 11, 57, '2523K')
put(t2, 11, 58, '11111K')
# left foot, outer side (leg outer outline x4 rows 53-56, x3 rows 57-58)
put(t2, 3, 55, 'K')
put(t2, 2, 56, 'K4')
put(t2, 1, 57, 'K4')
put(t2, 0, 58, 'K43')
# right foot (mirror x -> 47 - x), inner side faces up-left (lit), outer side faces up-right
put(t2, 35, 54, 'K')
put(t2, 34, 55, 'K4')
put(t2, 33, 56, 'K42')
put(t2, 32, 57, 'K4252')
put(t2, 31, 58, 'K11111')
put(t2, 44, 55, 'K')
put(t2, 44, 56, '3K')
put(t2, 45, 57, '3K')
put(t2, 45, 58, '23K')
# anchor bolts: 2 per foot, 2x2 bright heads (shadow lower right) on the foot face, replacing the old 1 px heads
for x in (2, 12, 33, 43):
    put(t2, x, 60, '55')
    put(t2, x, 61, '51')

# ---------- MK III AS BUILT: brass cross-tie strap, polished feet, warm sight glass on the cross-tie ----------
# (The bearing cap itself is always under the hub pulley; brass on the 2-3 px of saddle ends that show beside it read as
# rust specks next to the belt run in the zoom 1 composite, so the brass goes on the cross-tie as one clean band.)
t3 = T.copy_grid(t2)
# brass strap along the cross-tie top face (a clean straight band reads as brass, not rust): glint at the lit left end
for x in range(15, 33):
    t3[40][x] = 'f'
put(t3, 15, 40, 'CC')
t3[40][32] = 'd'
# polished top edges of the foot flanges
for x in list(range(1, 16)) + list(range(32, 47)):
    if t3[60][x] == '3':
        t3[60][x] = '4'
# sight glass: 2x2 warm lamp in a round ink bezel at the centre of the cross-tie (rows 40-43)
put(t3, 23, 40, 'KK')
put(t3, 22, 41, 'KCBK')
put(t3, 22, 42, 'KBAK')
put(t3, 23, 43, 'KK')

# heartbeat low frame: the lamp one ramp step dimmer
t3b = T.copy_grid(t3)
for y in (41, 42):
    for x in (23, 24):
        t3b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}[t3b[y][x]]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in [('flywheel-pedestal-t2.png', t2), ('flywheel-pedestal-t3.png', t3), ('flywheel-pedestal-t3b.png', t3b)]:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
