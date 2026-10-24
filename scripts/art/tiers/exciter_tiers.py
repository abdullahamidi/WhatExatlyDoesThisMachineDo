# Part evolution tiers, method A: gridExciter (3 tiers), exciterFeed (machine.exciterFeed, 16x28, bottom origin,
# static): a cyan glass post insulator (cap rows 2-3 under the cable lug, ferrule band row 4, 3 sheds at rows 6-8 /
# 10-12 / 14-16 with necks at rows 5 / 9 / 13 / 17, base cap row 18) on a riveted terminal box (rows 19-27) that takes
# a copper strap from the spire exciter on its left (rows 21-24, x0-5).
#   MK II REINFORCED: 2 more insulator discs: the necks at rows 9 and 13 become full sheds (11 px rims), so the post
#     carries 5 sheds at a 2-row pitch (bright rims, dark undersides between them: a higher-voltage stack in the same
#     height, as real post insulators gain sheds with rating); the ferrule band (row 4) brass; the box's 3 rust specks
#     knocked off to its iron.
#   MK III AS BUILT: a warm pilot lamp in the terminal box face (core x9-11, rows 22-24, ink ring); heartbeat low frame
#     t3b = the lamp one ramp step dimmer.
# Reserved: the cable lug cap (texture (10, 1)) and the cable that leaves it: rows 0-1 never change. Alpha 0/255; every
# MK I opaque pixel stays opaque; palette = Rust Wasteland + the cyan the shipped feed uses.
#   python scripts/art/tiers/exciter_tiers.py [outRoot]
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tierlib as T  # noqa: E402

put = T.put
base = T.load_grid(os.path.join(T.MACHINE, 'legacy', 'exciter-feed.png'))
RIM = 'KoonnnnmmmK'        # 11 px shed rim (x5-15), lit left
UNDER = 'Kmmm0mmmK'        # 9 px dark underside between rims (x6-14), the shipped underside

# ---------- MK II REINFORCED ----------
t2 = T.copy_grid(base)
for y in (7, 9, 11, 13, 15):
    put(t2, 5, y, RIM)
for y in (8, 10, 12, 14, 16):
    put(t2, 6, y, UNDER)
put(t2, 8, 4, 'Cffed')    # brass ferrule (was iron '54432'), glint at the lit left end
for (x, y) in ((10, 22), (8, 25), (9, 25)):
    assert base[y][x] in 'de', (x, y)
    t2[y][x] = '3'

# ---------- MK III AS BUILT ----------
t3 = T.copy_grid(t2)
put(t3, 9, 21, 'KKK')
put(t3, 8, 22, 'KABAK')
put(t3, 8, 23, 'KBCBK')
put(t3, 8, 24, 'KABAK')
put(t3, 9, 25, 'KKK')

t3b = T.copy_grid(t3)
for y in (22, 23, 24):
    for x in (9, 10, 11):
        t3b[y][x] = {'C': 'B', 'B': 'A', 'A': 'd'}[t3b[y][x]]


def main():
    out_root = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else T.TIERS
    for name, g in [('exciter-feed-t2.png', t2), ('exciter-feed-t3.png', t3), ('exciter-feed-t3b.png', t3b)]:
        dst = os.path.join(out_root, name)
        print('wrote %s %d B' % (T.rel(dst), T.save_grid(g, dst)))


if __name__ == '__main__':
    main()
